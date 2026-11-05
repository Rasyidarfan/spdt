/*
 * SPDT - Backup Hook (berjalan di MAIN world halaman)
 * -----------------------------------------------------------
 * Menangkap body permintaan PUT /api/dokumen/<id> (payload lengkap dokumen)
 * setiap kali tombol Simpan ditekan — baik berhasil (200) maupun gagal (500).
 * Payload berisi SELURUH isian (Blok I..VII / K4,K5,K6, dll).
 *
 * MAIN world tidak bisa memakai chrome.storage, jadi payload dikirim ke
 * content script (backup.js) lewat window.postMessage untuk disimpan.
 */
(function () {
  "use strict";
  if (window.__spdtBkHook) return;
  window.__spdtBkHook = 1;

  var O = XMLHttpRequest.prototype.open, S = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return O.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) {
    try {
      if (this.__m === "PUT" && /\/api\/dokumen\//.test(this.__u || "") && typeof b === "string" && b.length > 2) {
        var self = this;
        // kirim payload + status (status diketahui setelah selesai)
        this.addEventListener("loadend", function () {
          try {
            window.postMessage({
              __spdtBackup: true,
              url: self.__u,
              body: b,
              status: self.status,
              at: Date.now(),
            }, window.location.origin);
          } catch (e) {}
        });
      }
    } catch (e) {}
    return S.apply(this, arguments);
  };
})();
