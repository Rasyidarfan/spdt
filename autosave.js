/*
 * SPDT - Auto Save
 * -----------------------------------------------------------
 * Menekan tombol "Simpan" milik aplikasi (ikon floppy di bar bawah) setiap
 * N detik (diatur dari halaman pengaturan), saat di halaman edit dokumen.
 * Memakai tombol aplikasi supaya data & token CSRF selalu terbaru. Senyap:
 * notifikasi "Data berhasil disimpan!" bawaan aplikasi yang muncul.
 */
(function () {
  "use strict";

  var cfg = { autosaveEnabled: true, autosaveSeconds: 100 };
  var timer = null;

  function onEditPage() {
    return /\/dokumen\/[^/]+\/edit/.test(location.pathname);
  }

  function dialogOpen() {
    return !!document.querySelector(".p-dialog-mask, .p-dialog, [role=dialog]");
  }

  function saveButton() {
    return Array.prototype.slice
      .call(document.querySelectorAll("button"))
      .filter(function (b) { return b.getBoundingClientRect().top > 600; })
      .find(function (b) { return /p-button-primary/.test(b.className); });
  }

  function tick() {
    if (!onEditPage() || dialogOpen()) return;
    var b = saveButton();
    if (b && !b.disabled) b.click();
  }

  function schedule() {
    if (timer) { clearInterval(timer); timer = null; }
    var secs = Number(cfg.autosaveSeconds) || 100;
    if (secs < 5) secs = 5; // batas aman minimum
    if (cfg.autosaveEnabled) timer = setInterval(tick, secs * 1000);
  }

  try {
    chrome.storage.sync.get(cfg, function (v) { cfg = v; schedule(); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "sync") return;
      var changed = false;
      if ("autosaveEnabled" in ch) { cfg.autosaveEnabled = ch.autosaveEnabled.newValue; changed = true; }
      if ("autosaveSeconds" in ch) { cfg.autosaveSeconds = ch.autosaveSeconds.newValue; changed = true; }
      if (changed) schedule();
    });
  } catch (e) {
    schedule(); // tanpa storage -> pakai default 100 detik
  }
})();
