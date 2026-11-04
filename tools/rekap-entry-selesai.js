/*
 * Rekap "entry selesai per operator per hari" -> unduh CSV
 * -----------------------------------------------------------
 * Cara pakai: buka https://spdtntp.web.bps.go.id (sudah login),
 * buka DevTools Console, tempel seluruh isi file ini, Enter.
 * File rekap_entry_selesai_YYYYMMDD.csv akan terunduh.
 *
 * Definisi: entry selesai = dokumen flag_error === "C".
 * Operator = user_modified, hari = date_modified (zona WIT/Asia-Jayapura).
 * Ubah KABS / KD sesuai kebutuhan.
 */
(async () => {
  const KABS = { "9702": "JAYAWIJAYA", "9705": "MAMBERAMO TENGAH", "9706": "YALIMO" };
  const KD = "08"; // kode kuesioner
  const FLAG_SELESAI = "C";

  const H = { accept: "application/json", "x-requested-with": "XMLHttpRequest" };
  const pages = async (url) => {
    let p = 1, out = [], last = 1;
    do {
      const r = await fetch(url(p), { headers: H, credentials: "include" });
      const j = await r.json();
      out = out.concat(j.data || []);
      last = (j.meta && j.meta.last_page) || 1;
      p++;
    } while (p <= last && p <= 30);
    return out;
  };
  const tgl = (iso) => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jayapura", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(iso));
    } catch (e) { return (iso || "").slice(0, 10); }
  };

  const userMap = {}, rows = [];
  for (const code of Object.keys(KABS)) {
    (await pages((p) => `https://spdtntp.web.bps.go.id/api/user?page=${p}&full_code=${code}&search=&per_page=100`))
      .forEach((u) => { userMap[u.id] = { username: u.username, nama: u.nama }; });
    (await pages((p) => `https://spdtntp.web.bps.go.id/api/sample?page=${p}&full_code=${code}&kd_kuesioner=${KD}&search=&per_page=100`))
      .forEach((s) => (s.dokumens || []).forEach((d) => {
        if (d.flag_error === FLAG_SELESAI) rows.push({ kab: KABS[code], uid: d.user_modified, tanggal: tgl(d.date_modified) });
      }));
  }

  const dates = [...new Set(rows.map((r) => r.tanggal))].sort();
  const byOp = {};
  rows.forEach((r) => {
    const k = r.kab + "|" + r.uid;
    (byOp[k] = byOp[k] || { kab: r.kab, uid: r.uid, c: {}, t: 0 });
    byOp[k].c[r.tanggal] = (byOp[k].c[r.tanggal] || 0) + 1;
    byOp[k].t++;
  });
  const list = Object.values(byOp).sort((a, b) => a.kab.localeCompare(b.kab) || b.t - a.t);

  const sep = ";";
  const esc = (v) => { v = v == null ? "" : "" + v; return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const head = ["No", "Kabupaten", "Username", "Nama", ...dates, "Total"];
  const lines = [head.map(esc).join(sep)];
  list.forEach((o, i) => {
    const u = userMap[o.uid] || {};
    lines.push([i + 1, o.kab, u.username || ("ID " + o.uid), u.nama || "", ...dates.map((d) => o.c[d] || 0), o.t].map(esc).join(sep));
  });
  lines.push(["", "TOTAL", "", "", ...dates.map((d) => rows.filter((r) => r.tanggal === d).length), rows.length].map(esc).join(sep));

  const csv = "﻿" + lines.join("\r\n");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jayapura" }).format(new Date()).replace(/-/g, "");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "rekap_entry_selesai_" + today + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  console.log("Rekap terunduh. Operator:", list.length, "Total selesai:", rows.length, "Tanggal:", dates.join(", "));
})();
