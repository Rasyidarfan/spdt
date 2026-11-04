/*
 * Modul Rekap (popup). Pengambilan data dilakukan di content script
 * (rekap-bridge.js) lewat pesan, agar fetch memakai sesi halaman SPDT
 * (lolos Cloudflare). Popup hanya menghitung & membangun file .xls.
 *
 * Definisi: selesai = flag_error "C", error = "E", belum = lainnya.
 * Operator = user_modified, hari = date_modified (WIT). Unduh SEMUA tanggal.
 */
window.SPDTRekap = (function () {
  "use strict";

  var _cache = null; // { key, recs, userMap, kabName }
  var KNOWN = { "9702": "JAYAWIJAYA", "9705": "MAMBERAMO TENGAH", "9706": "YALIMO" };

  // --- jembatan ke content script ------------------------------------------
  async function bridge(cmd, extra) {
    var tabs = await chrome.tabs.query({ url: "https://spdtntp.web.bps.go.id/*" });
    if (!tabs.length) throw new Error("Buka tab SPDT (spdtntp.web.bps.go.id) dulu.");
    var tab = tabs.find(function (t) { return t.active; }) || tabs[0];
    var resp;
    try {
      resp = await chrome.tabs.sendMessage(tab.id, Object.assign({ type: "SPDT_REKAP", cmd: cmd }, extra || {}));
    } catch (e) {
      throw new Error("Tidak terhubung ke tab SPDT. Refresh tab SPDT lalu coba lagi.");
    }
    if (!resp) throw new Error("Tidak ada respons dari tab SPDT. Refresh tab SPDT.");
    if (!resp.ok) throw new Error(resp.error || "Gagal mengambil data.");
    return resp.data;
  }

  function parseCodes(str) {
    return (str || "").split(",").map(function (s) { return s.trim(); })
      .filter(function (s) { return /^\d{3,}$/.test(s); });
  }

  async function defaultKabs() { return bridge("default"); }

  async function load(codes, kd) {
    kd = kd || "08";
    var key = codes.join(",") + "|" + kd;
    if (_cache && _cache.key === key) return _cache;
    var data = await bridge("load", { codes: codes, kd: kd });
    _cache = { key: key, recs: data.recs, userMap: data.userMap, kabName: data.kabName };
    return _cache;
  }

  function kabOf(c, code) { return (c.kabName[code] || KNOWN[code] || code); }
  function statusLabel(s) { return s === "C" ? "Selesai" : s === "E" ? "Error" : "Belum"; }

  // Terapkan filter subsektor (kosong = semua).
  function filterSub(recs, sub) {
    if (!sub) return recs;
    return recs.filter(function (r) { return r.kd_subsektor === sub; });
  }

  async function tally(codes, kd, sub) {
    var c = await load(codes, kd);
    return codes.map(function (code) {
      var rs = filterSub(c.recs.filter(function (r) { return r.code === code; }), sub);
      return {
        code: code, nama: kabOf(c, code),
        clean: rs.filter(function (r) { return r.status === "C"; }).length,
        error: rs.filter(function (r) { return r.status === "E"; }).length,
        belum: rs.filter(function (r) { return r.status === "B"; }).length,
        total: rs.length,
      };
    });
  }

  // --- SpreadsheetML (XML Spreadsheet 2003) ---------------------------------
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function cell(v) {
    var num = typeof v === "number" && isFinite(v);
    return '<Cell><Data ss:Type="' + (num ? "Number" : "String") + '">' + (num ? v : esc(v == null ? "" : v)) + "</Data></Cell>";
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

  async function generate(codes, kd, sub) {
    var c = await load(codes, kd);
    var recs = filterSub(c.recs, sub);
    var userMap = c.userMap;
    var nm = function (uid) { return userMap[uid] || {}; };
    var clean = recs.filter(function (r) { return r.status === "C"; });
    var dates = Array.from(new Set(clean.map(function (r) { return r.tanggal; }).filter(Boolean))).sort();

    // Sheet 1: Pivot Harian (operator x tanggal, sampel selesai) + Total/Error
    var ops = {};
    recs.forEach(function (r) {
      if (r.uid == null) return; // sampel belum dientry: tanpa operator
      var k = r.code + "|" + r.uid;
      var o = ops[k] || (ops[k] = { code: r.code, uid: r.uid, perHari: {}, C: 0, E: 0 });
      if (r.status === "C") { o.C++; o.perHari[r.tanggal] = (o.perHari[r.tanggal] || 0) + 1; }
      else if (r.status === "E") o.E++;
    });
    var list = Object.values(ops).sort(function (a, b) {
      return kabOf(c, a.code).localeCompare(kabOf(c, b.code)) || b.C - a.C;
    });
    var s1 = [["No", "Kabupaten", "Username", "Nama"].concat(dates, ["Total Selesai", "Error"])];
    list.forEach(function (o, i) {
      s1.push([i + 1, kabOf(c, o.code), nm(o.uid).username || ("ID " + o.uid), nm(o.uid).nama || ""]
        .concat(dates.map(function (d) { return o.perHari[d] || 0; }), [o.C, o.E]));
    });
    s1.push(["", "TOTAL", "", ""].concat(
      dates.map(function (d) { return clean.filter(function (r) { return r.tanggal === d; }).length; }),
      [clean.length, recs.filter(function (r) { return r.status === "E"; }).length]));

    // Sheet 2: Ringkasan per Kabupaten (berbasis SAMPEL)
    var s2 = [["No", "Kabupaten", "Total Sampel", "Clean", "Error", "Belum"]];
    codes.forEach(function (code, i) {
      var rs = recs.filter(function (r) { return r.code === code; });
      s2.push([i + 1, kabOf(c, code), rs.length,
        rs.filter(function (r) { return r.status === "C"; }).length,
        rs.filter(function (r) { return r.status === "E"; }).length,
        rs.filter(function (r) { return r.status === "B"; }).length]);
    });
    s2.push(["", "TOTAL", recs.length,
      recs.filter(function (r) { return r.status === "C"; }).length,
      recs.filter(function (r) { return r.status === "E"; }).length,
      recs.filter(function (r) { return r.status === "B"; }).length]);

    // Sheet 3: Detail (satu baris per SAMPEL)
    var s3 = [["Kabupaten", "ID Sample", "Subsektor", "Kuesioner", "Status", "Username", "Nama", "Tanggal", "NURT", "Nama KRT", "Alamat"]];
    recs.slice().sort(function (a, b) {
      return kabOf(c, a.code).localeCompare(kabOf(c, b.code)) ||
        (a.status).localeCompare(b.status) || ("" + a.tanggal).localeCompare("" + b.tanggal);
    }).forEach(function (r) {
      s3.push([kabOf(c, r.code), r.id_sample, r.kd_subsektor, r.kues, statusLabel(r.status),
        r.uid ? (nm(r.uid).username || ("ID " + r.uid)) : "", r.uid ? (nm(r.uid).nama || "") : "",
        r.tanggal, r.nurt, r.nama_krt, r.alamat]);
    });

    var xml = workbook([sheetXml("Pivot Harian", s1), sheetXml("Ringkasan Kabupaten", s2), sheetXml("Detail", s3)]);
    var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jayapura" }).format(new Date()).replace(/-/g, "");
    download(xml, "rekap_entry_selesai_" + today + ".xls");
    return { operator: list.length, selesai: clean.length, total: recs.length, dates: dates };
  }

  return { defaultKabs: defaultKabs, parseCodes: parseCodes, tally: tally, generate: generate };
})();
