/*
 * SPDT - Backup Draf ke File (content script, isolated world)
 * -----------------------------------------------------------
 * Menerima payload dokumen dari backup-hook.js (MAIN world) lalu menyimpan
 * SATU cadangan terbaru per dokumen di chrome.storage.local. Popup bisa
 * meminta daftar / isi cadangan untuk diunduh sebagai file .json.
 *
 * Tujuan: selama server gagal menyimpan (bug SQL dbo.dokumen), seluruh
 * isian tetap punya salinan independen yang bisa diunduh ke disk.
 */
(function () {
  "use strict";

  var PREFIX = "bk:";

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.__spdtBackup !== true || typeof d.body !== "string") return;
    saveBackup(d.body, d.at, d.status);
  });

  function meta(body) {
    try {
      var b = JSON.parse(body);
      return {
        id_dokumen: b.id_dokumen,
        encrypted_id: b.encrypted_id,
        id_sample: b.id_sample,
        nurt: b.nurt_utama || b.nurt || b.id_sample || "",
        nama_krt: b.nama_krt || "",
        kd_kuesioner: b.kd_kuesioner || "",
        kab: (b.kabupaten && b.kabupaten.nama_kab) || "",
        full_code: "" + (b.kd_prov || "") + (b.kd_kab || ""),
      };
    } catch (e) { return null; }
  }

  function saveBackup(body, at, status) {
    var m = meta(body);
    if (!m || !m.id_dokumen) return;
    var rec = { meta: m, body: body, at: at || Date.now(), status: status || null };
    var obj = {};
    obj[PREFIX + m.id_dokumen] = rec;
    try {
      chrome.storage.local.set(obj, function () {
        console.log("[SPDT_BK] backup tersimpan:", m.id_dokumen, "K" + m.kd_kuesioner, "(" + body.length + " bytes, status " + (status || "?") + ")");
      });
    } catch (e) {}
  }

  function currentEncryptedId() {
    var mm = location.pathname.match(/dokumen\/([^\/]+)\/edit/);
    return mm ? mm[1] : null;
  }

  // ---- jembatan ke popup ----
  chrome.runtime.onMessage.addListener(function (msg, sender, send) {
    if (!msg || msg.type !== "SPDT_BK") return;
    (async function () {
      try {
        if (msg.cmd === "list") {
          var all = await chrome.storage.local.get(null);
          var items = Object.keys(all)
            .filter(function (k) { return k.indexOf(PREFIX) === 0; })
            .map(function (k) { return { key: k, meta: all[k].meta, at: all[k].at, status: all[k].status, bytes: (all[k].body || "").length }; });
          items.sort(function (a, b) { return b.at - a.at; });
          send({ ok: true, items: items, activeEnc: currentEncryptedId() });
        } else if (msg.cmd === "get") {
          var r = await chrome.storage.local.get(msg.key);
          send({ ok: true, rec: r[msg.key] || null });
        } else if (msg.cmd === "getAll") {
          var all2 = await chrome.storage.local.get(null);
          var recs = Object.keys(all2)
            .filter(function (k) { return k.indexOf(PREFIX) === 0; })
            .map(function (k) { return all2[k]; });
          send({ ok: true, recs: recs });
        } else if (msg.cmd === "delete") {
          await chrome.storage.local.remove(msg.key);
          send({ ok: true });
        } else {
          send({ ok: false, error: "perintah tidak dikenal" });
        }
      } catch (e) { send({ ok: false, error: (e && e.message) || String(e) }); }
    })();
    return true; // async
  });
})();
