/*
 * Modul Rekap — dipakai oleh popup.
 * Mengambil data dari API SPDT (sesi login pengguna), menghitung rekap
 * "entry selesai per operator per hari", lalu mengunduh file .xls multi-sheet:
 *   1) Pivot Harian   : operator x tanggal (selesai) + Total/Error/Belum
 *   2) Per Kuesioner  : operator x kd_kuesioner (selesai)
 *   3) Detail         : satu baris per dokumen
 *
 * Definisi: selesai = flag_error "C", error = "E", belum = null/lainnya.
 * Operator = user_modified, tanggal = date_modified (zona WIT/Asia-Jayapura).
 * Mengunduh SEMUA tanggal (tanpa filter rentang).
 */
window.SPDTRekap = (function () {
  "use strict";

  var BASE = "https://spdtntp.web.bps.go.id";
  var H = { accept: "application/json", "x-requested-with": "XMLHttpRequest" };
  var _cache = null; // { key, recs, userMap, kabName }

  function tgl(iso) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jayapura", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(iso));
    } catch (e) { return (iso || "").slice(0, 10); }
  }

  async function pages(urlFn, onProgress) {
    var p = 1, out = [], last = 1;
    do {
      var r = await fetch(urlFn(p), { headers: H, credentials: "include" });
      if (!r.ok) throw new Error("HTTP " + r.status + " — pastikan sudah login di tab SPDT.");
      var j = await r.json();
      out = out.concat(j.data || []);
      last = (j.meta && j.meta.last_page) || 1;
      if (onProgress) onProgress(p, last);
      p++;
    } while (p <= last && p <= 50);
    return out;
  }

  function statusLabel(flag) {
    if (flag === "C") return "Selesai";
    if (flag === "E") return "Error";
    return "Belum";
  }

  // Ambil kabupaten default dari /petugas (kd_prov+kd_kab petugas),
  // digabung daftar 3 kabupaten Papua Pegunungan. Fallback bila gagal.
  async function defaultKabs() {
    var fallback = "9702, 9705, 9706";
    try {
      var r = await fetch(BASE + "/petugas", { headers: { accept: "text/html" }, credentials: "include" });
      var html = await r.text();
      var doc = new DOMParser().parseFromString(html, "text/html");
      var sc = Array.prototype.slice.call(doc.querySelectorAll("script"))
        .find(function (s) { return (s.textContent || "").trim().startsWith('{"component"'); });
      var u = JSON.parse(sc.textContent).props.auth.user;
      var own = ("" + (u.kd_prov || "") + (u.kd_kab || "")).replace(/\s+/g, "");
      var set = new Set(["9702", "9705", "9706"]);
      if (own && own.length >= 4) set.add(own);
      return Array.from(set).sort().join(", ");
    } catch (e) {
      return fallback;
    }
  }

  function parseCodes(str) {
    return (str || "").split(",").map(function (s) { return s.trim(); })
      .filter(function (s) { return /^\d{3,}$/.test(s); });
  }

  // Muat data (dengan cache) untuk sekumpulan kode kabupaten + kuesioner.
  async function load(codes, kd, prog) {
    kd = kd || "08";
    prog = prog || function () {};
    var key = codes.join(",") + "|" + kd;
    if (_cache && _cache.key === key) return _cache;

    var userMap = {}, recs = [], kabName = {};
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      prog("Operator " + code + "…");
      (await pages(function (p) {
        return BASE + "/api/user?page=" + p + "&full_code=" + code + "&search=&per_page=100";
      })).forEach(function (u) {
        userMap[u.id] = { username: u.username, nama: u.nama };
        if (u.kabupaten && u.kabupaten.nama_kab) kabName[code] = u.kabupaten.nama_kab;
      });

      prog("Sample " + code + "…");
      var samples = await pages(function (p) {
        return BASE + "/api/sample?page=" + p + "&full_code=" + code +
          "&kd_kuesioner=" + kd + "&search=&per_page=100";
      }, function (cur, last) { prog("Sample " + code + " hal " + cur + "/" + last + "…"); });
      samples.forEach(function (s) {
        if (s.kabupaten && s.kabupaten.nama_kab) kabName[code] = s.kabupaten.nama_kab;
        (s.dokumens || []).forEach(function (d) {
          recs.push({
            code: code, id_sample: s.id_sample, id_dokumen: d.id_dokumen,
            kd_kuesioner: d.kd_kuesioner, uid: d.user_modified, flag: d.flag_error,
            tanggal: tgl(d.date_modified), nurt: s.nurt, nama_krt: s.nama_krt, alamat: s.alamat,
          });
        });
      });
    }
    _cache = { key: key, recs: recs, userMap: userMap, kabName: kabName };
    return _cache;
  }

  var KNOWN = { "9702": "JAYAWIJAYA", "9705": "MAMBERAMO TENGAH", "9706": "YALIMO" };
  function kabOf(c, code) { return (c.kabName[code] || KNOWN[code] || code); }

  // Hitung Clean/Error/Belum per kabupaten (untuk ditampilkan di popup).
  async function tally(codes, kd, prog) {
    var c = await load(codes, kd, prog);
    return codes.map(function (code) {
      var rs = c.recs.filter(function (r) { return r.code === code; });
      return {
        code: code, nama: kabOf(c, code),
        clean: rs.filter(function (r) { return r.flag === "C"; }).length,
        error: rs.filter(function (r) { return r.flag === "E"; }).length,
        belum: rs.filter(function (r) { return r.flag !== "C" && r.flag !== "E"; }).length,
        total: rs.length,
      };
    });
  }

  // --- SpreadsheetML (XML Spreadsheet 2003) ---------------------------------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cell(v) {
    var num = typeof v === "number" && isFinite(v);
    return '<Cell><Data ss:Type="' + (num ? "Number" : "String") + '">' +
      (num ? v : esc(v == null ? "" : v)) + "</Data></Cell>";
  }
  function sheetXml(name, rows) {
    var body = rows.map(function (row) { return "<Row>" + row.map(cell).join("") + "</Row>"; }).join("");
    return '<Worksheet ss:Name="' + esc(name.slice(0, 31)) + '"><Table>' + body + "</Table></Worksheet>";
  }
  function workbook(sheets) {
    return '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' + sheets.join("") + "</Workbook>";
  }
  function download(xml, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function generate(codes, kd, prog) {
    var c = await load(codes, kd, prog);
    var recs = c.recs, userMap = c.userMap;
    var nm = function (uid) { return userMap[uid] || {}; };
    var selesai = recs.filter(function (r) { return r.flag === "C"; });
    var dates = Array.from(new Set(selesai.map(function (r) { return r.tanggal; }))).sort();
    var kues = Array.from(new Set(recs.map(function (r) { return r.kd_kuesioner; }))).sort();

    var ops = {};
    recs.forEach(function (r) {
      var k = r.code + "|" + r.uid;
      var o = ops[k] || (ops[k] = { code: r.code, uid: r.uid, perHari: {}, perKues: {}, C: 0, E: 0, B: 0 });
      if (r.flag === "C") { o.C++; o.perHari[r.tanggal] = (o.perHari[r.tanggal] || 0) + 1; o.perKues[r.kd_kuesioner] = (o.perKues[r.kd_kuesioner] || 0) + 1; }
      else if (r.flag === "E") o.E++;
      else o.B++;
    });
    var list = Object.values(ops).sort(function (a, b) {
      return kabOf(c, a.code).localeCompare(kabOf(c, b.code)) || b.C - a.C;
    });

    var s1 = [["No", "Kabupaten", "Username", "Nama"].concat(dates, ["Total Selesai", "Error", "Belum"])];
    list.forEach(function (o, i) {
      s1.push([i + 1, kabOf(c, o.code), nm(o.uid).username || ("ID " + o.uid), nm(o.uid).nama || ""]
        .concat(dates.map(function (d) { return o.perHari[d] || 0; }), [o.C, o.E, o.B]));
    });
    s1.push(["", "TOTAL", "", ""].concat(
      dates.map(function (d) { return selesai.filter(function (r) { return r.tanggal === d; }).length; }),
      [selesai.length, recs.filter(function (r) { return r.flag === "E"; }).length,
       recs.filter(function (r) { return r.flag !== "C" && r.flag !== "E"; }).length]));

    var s2 = [["No", "Kabupaten", "Username", "Nama"].concat(kues.map(function (k) { return "K" + k; }), ["Total Selesai"])];
    list.forEach(function (o, i) {
      s2.push([i + 1, kabOf(c, o.code), nm(o.uid).username || ("ID " + o.uid), nm(o.uid).nama || ""]
        .concat(kues.map(function (k) { return o.perKues[k] || 0; }), [o.C]));
    });

    var s3 = [["Kabupaten", "ID Sample", "ID Dokumen", "Kuesioner", "Username", "Nama", "Status", "Tanggal", "NURT", "Nama KRT", "Alamat"]];
    recs.slice().sort(function (a, b) {
      return kabOf(c, a.code).localeCompare(kabOf(c, b.code)) || a.tanggal.localeCompare(b.tanggal);
    }).forEach(function (r) {
      s3.push([kabOf(c, r.code), r.id_sample, r.id_dokumen, r.kd_kuesioner, nm(r.uid).username || ("ID " + r.uid),
        nm(r.uid).nama || "", statusLabel(r.flag), r.tanggal, r.nurt, r.nama_krt, r.alamat]);
    });

    var xml = workbook([sheetXml("Pivot Harian", s1), sheetXml("Per Kuesioner", s2), sheetXml("Detail", s3)]);
    var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jayapura" }).format(new Date()).replace(/-/g, "");
    download(xml, "rekap_entry_selesai_" + today + ".xls");
    return { operator: list.length, selesai: selesai.length, dates: dates };
  }

  return { defaultKabs: defaultKabs, parseCodes: parseCodes, tally: tally, generate: generate };
})();
