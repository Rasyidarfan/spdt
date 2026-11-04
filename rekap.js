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
 */
window.SPDTRekap = (function () {
  "use strict";

  var BASE = "https://spdtntp.web.bps.go.id";
  var H = { accept: "application/json", "x-requested-with": "XMLHttpRequest" };

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
    var body = rows.map(function (row) {
      return "<Row>" + row.map(cell).join("") + "</Row>";
    }).join("");
    return '<Worksheet ss:Name="' + esc(name.slice(0, 31)) + '"><Table>' + body + "</Table></Worksheet>";
  }
  function workbook(sheets) {
    return '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      sheets.join("") + "</Workbook>";
  }
  function download(xml, filename) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /**
   * opts = { kabs: {code:name}, kd: "08", dateFrom: "YYYY-MM-DD"|"", dateTo: "...", onProgress }
   */
  async function generate(opts) {
    var kabs = opts.kabs, kd = opts.kd || "08";
    var from = opts.dateFrom || "", to = opts.dateTo || "";
    var prog = opts.onProgress || function () {};

    var userMap = {}, recs = [];
    var codes = Object.keys(kabs);
    for (var ci = 0; ci < codes.length; ci++) {
      var code = codes[ci], kab = kabs[code];
      prog("Mengambil operator " + kab + "…");
      (await pages(function (p) {
        return BASE + "/api/user?page=" + p + "&full_code=" + code + "&search=&per_page=100";
      })).forEach(function (u) { userMap[u.id] = { username: u.username, nama: u.nama }; });

      prog("Mengambil sample " + kab + "…");
      (await pages(function (p) {
        return BASE + "/api/sample?page=" + p + "&full_code=" + code +
          "&kd_kuesioner=" + kd + "&search=&per_page=100";
      }, function (cur, last) { prog("Sample " + kab + " hal " + cur + "/" + last + "…"); }))
        .forEach(function (s) {
          (s.dokumens || []).forEach(function (d) {
            recs.push({
              kab: kab, id_sample: s.id_sample, id_dokumen: d.id_dokumen,
              kd_kuesioner: d.kd_kuesioner, uid: d.user_modified, flag: d.flag_error,
              tanggal: tgl(d.date_modified), nurt: s.nurt, nama_krt: s.nama_krt, alamat: s.alamat,
            });
          });
        });
    }

    // filter tanggal
    if (from) recs = recs.filter(function (r) { return r.tanggal >= from; });
    if (to) recs = recs.filter(function (r) { return r.tanggal <= to; });

    var nm = function (uid) { return userMap[uid] || {}; };
    var selesai = recs.filter(function (r) { return r.flag === "C"; });
    var dates = [...new Set(selesai.map(function (r) { return r.tanggal; }))].sort();
    var kues = [...new Set(recs.map(function (r) { return r.kd_kuesioner; }))].sort();

    // kelompok per operator
    var ops = {};
    recs.forEach(function (r) {
      var k = r.kab + "|" + r.uid;
      var o = ops[k] || (ops[k] = { kab: r.kab, uid: r.uid, perHari: {}, perKues: {}, C: 0, E: 0, B: 0 });
      if (r.flag === "C") { o.C++; o.perHari[r.tanggal] = (o.perHari[r.tanggal] || 0) + 1; o.perKues[r.kd_kuesioner] = (o.perKues[r.kd_kuesioner] || 0) + 1; }
      else if (r.flag === "E") o.E++;
      else o.B++;
    });
    var list = Object.values(ops).sort(function (a, b) {
      return a.kab.localeCompare(b.kab) || b.C - a.C;
    });

    // Sheet 1: Pivot Harian
    var s1 = [["No", "Kabupaten", "Username", "Nama"].concat(dates, ["Total Selesai", "Error", "Belum"])];
    list.forEach(function (o, i) {
      s1.push([i + 1, o.kab, nm(o.uid).username || ("ID " + o.uid), nm(o.uid).nama || ""]
        .concat(dates.map(function (d) { return o.perHari[d] || 0; }), [o.C, o.E, o.B]));
    });
    s1.push(["", "TOTAL", "", ""].concat(
      dates.map(function (d) { return selesai.filter(function (r) { return r.tanggal === d; }).length; }),
      [selesai.length, recs.filter(function (r) { return r.flag === "E"; }).length,
       recs.filter(function (r) { return r.flag !== "C" && r.flag !== "E"; }).length]));

    // Sheet 2: Per Kuesioner
    var s2 = [["No", "Kabupaten", "Username", "Nama"].concat(kues.map(function (k) { return "K" + k; }), ["Total Selesai"])];
    list.forEach(function (o, i) {
      s2.push([i + 1, o.kab, nm(o.uid).username || ("ID " + o.uid), nm(o.uid).nama || ""]
        .concat(kues.map(function (k) { return o.perKues[k] || 0; }), [o.C]));
    });

    // Sheet 3: Detail
    var s3 = [["Kabupaten", "ID Sample", "ID Dokumen", "Kuesioner", "Username", "Nama", "Status", "Tanggal", "NURT", "Nama KRT", "Alamat"]];
    recs.sort(function (a, b) { return a.kab.localeCompare(b.kab) || a.tanggal.localeCompare(b.tanggal); })
      .forEach(function (r) {
        s3.push([r.kab, r.id_sample, r.id_dokumen, r.kd_kuesioner, nm(r.uid).username || ("ID " + r.uid),
          nm(r.uid).nama || "", statusLabel(r.flag), r.tanggal, r.nurt, r.nama_krt, r.alamat]);
      });

    var xml = workbook([
      sheetXml("Pivot Harian", s1),
      sheetXml("Per Kuesioner", s2),
      sheetXml("Detail", s3),
    ]);
    var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jayapura" }).format(new Date()).replace(/-/g, "");
    download(xml, "rekap_entry_selesai_" + today + ".xls");

    return { operator: list.length, selesai: selesai.length, dates: dates, records: recs.length };
  }

  return { generate: generate };
})();
