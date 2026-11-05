/*
 * SPDT - Diagnosa error 500 (READ-ONLY, tidak mengubah data apa pun)
 * ------------------------------------------------------------------
 * Mengecek status GET daftar sampel per kuesioner untuk kabupaten 9706
 * (Yalimo) + pencarian rumah tangga "yeliso". Tujuannya memastikan apakah
 * error 500 berasal dari sisi SERVER (bahkan saat hanya MEMBACA data).
 *
 * Cara pakai:
 *   1. Di tab SPDT mana pun yang sudah login, buka Console (F12).
 *      (Jika pertama kali: ketik  allow pasting  lalu Enter.)
 *   2. Tempel SELURUH isi file ini -> Enter.
 *   3. Tunggu ~5 detik, salin tabel hasil yang tercetak lalu kirim ke saya.
 *
 * Catatan: ubah FULL_CODE / SEARCH bila ingin menguji kabupaten/RT lain.
 */
(async function () {
  "use strict";
  var B = "https://spdtntp.web.bps.go.id";
  var FULL_CODE = "9706";          // Yalimo
  var SEARCH_RT = "yeliso";        // nama KRT yang diduga bermasalah
  var H = { accept: "application/json", "x-requested-with": "XMLHttpRequest" };

  async function probe(label, qs) {
    try {
      var r = await fetch(B + "/api/sample?" + qs, { headers: H, credentials: "include" });
      var note = "";
      if (r.status >= 500) note = "SERVER ERROR";
      else if ((r.headers.get("content-type") || "").indexOf("json") > -1) {
        var j = await r.json();
        note = "rows " + ((j.data && j.data.length) || 0) + " / total " + (j.meta && j.meta.total);
      } else note = "non-JSON (sesi?)";
      return { label: label, status: r.status, note: note };
    } catch (e) { return { label: label, status: "ERR", note: String(e).slice(0, 60) }; }
  }

  var tests = [
    ["k08 semua",      "page=1&full_code=" + FULL_CODE + "&kd_kuesioner=08&search=&per_page=10"],
    ["k08 cari KRT",   "page=1&full_code=" + FULL_CODE + "&kd_kuesioner=08&search=" + SEARCH_RT + "&per_page=10"],
    ["k01 semua",      "page=1&full_code=" + FULL_CODE + "&kd_kuesioner=01&search=&per_page=10"],
    ["k05 semua",      "page=1&full_code=" + FULL_CODE + "&kd_kuesioner=05&search=&per_page=10"],
    ["k06 semua",      "page=1&full_code=" + FULL_CODE + "&kd_kuesioner=06&search=&per_page=10"],
    ["k07 semua",      "page=1&full_code=" + FULL_CODE + "&kd_kuesioner=07&search=&per_page=10"],
  ];

  var out = [];
  for (var i = 0; i < tests.length; i++) out.push(await probe(tests[i][0], tests[i][1]));

  console.log("%c=== DIAGNOSA SPDT 500 (read-only) ===", "font-weight:bold;font-size:14px");
  console.table(out);
  console.log("Salin baris berikut dan kirim ke Claude:");
  console.log(out.map(function (o) { return o.label + " => " + o.status + " (" + o.note + ")"; }).join("\n"));
})();
