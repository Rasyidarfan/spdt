/*
 * Rekap Bridge (content script) — berjalan di konteks halaman SPDT.
 * Popup mengirim pesan ke sini; pengambilan data (fetch) dilakukan di sini
 * agar memakai sesi/cookie halaman (lolos Cloudflare), bukan dari popup.
 */
(function () {
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

  async function pages(urlFn) {
    var p = 1, out = [], last = 1;
    do {
      var r = await fetch(urlFn(p), { headers: H, credentials: "include" });
      if (!r.ok) throw new Error("HTTP " + r.status + " saat ambil data.");
      var ct = r.headers.get("content-type") || "";
      if (ct.indexOf("application/json") === -1) throw new Error("Respons bukan JSON (sesi/login?).");
      var j = await r.json();
      out = out.concat(j.data || []);
      last = (j.meta && j.meta.last_page) || 1;
      p++;
    } while (p <= last && p <= 50);
    return out;
  }

  async function load(codes, kd) {
    kd = kd || "08";
    var userMap = {}, recs = [], kabName = {};
    for (var i = 0; i < codes.length; i++) {
      var code = codes[i];
      (await pages((function (code) {
        return function (p) { return BASE + "/api/user?page=" + p + "&full_code=" + code + "&search=&per_page=100"; };
      })(code))).forEach(function (u) {
        userMap[u.id] = { username: u.username, nama: u.nama };
        if (u.kabupaten && u.kabupaten.nama_kab) kabName[code] = u.kabupaten.nama_kab;
      });
      (await pages((function (code) {
        return function (p) { return BASE + "/api/sample?page=" + p + "&full_code=" + code + "&kd_kuesioner=" + kd + "&search=&per_page=100"; };
      })(code))).forEach(function (s) {
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
    return { recs: recs, userMap: userMap, kabName: kabName };
  }

  async function defaultKabs() {
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
      return "9702, 9705, 9706";
    }
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== "SPDT_REKAP") return;
    (async function () {
      try {
        if (msg.cmd === "default") sendResponse({ ok: true, data: await defaultKabs() });
        else if (msg.cmd === "load") sendResponse({ ok: true, data: await load(msg.codes, msg.kd) });
        else sendResponse({ ok: false, error: "Perintah tidak dikenal." });
      } catch (e) {
        sendResponse({ ok: false, error: (e && e.message) ? e.message : String(e) });
      }
    })();
    return true; // respons async
  });
})();
