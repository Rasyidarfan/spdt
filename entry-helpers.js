/*
 * SPDT - Entry Helpers
 * -----------------------------------------------------------
 * Titik "." -> otomatis jadi koma "," pada field angka (InputNumber),
 * karena locale id-ID memakai koma sebagai pemisah desimal.
 *
 * Catatan: fitur "Enter -> pindah input" DIHAPUS karena server sudah
 * menyediakannya secara native.
 *
 * Bisa dinyalakan/dimatikan dari halaman pengaturan ekstensi.
 */
(function () {
  "use strict";

  var cfg = { commaDecimal: true };

  try {
    chrome.storage.sync.get(cfg, function (v) { cfg = v; });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "sync") return;
      if ("commaDecimal" in ch) cfg.commaDecimal = ch.commaDecimal.newValue;
    });
  } catch (e) { /* storage tak tersedia -> pakai default */ }

  // Titik -> koma pada field angka
  document.addEventListener("keydown", function (e) {
    if (!cfg.commaDecimal) return;
    if (e.key !== "." && e.code !== "NumpadDecimal") return;
    var el = e.target;
    if (!el || !el.matches || !el.matches(".p-inputnumber-input")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var s = el.selectionStart, en = el.selectionEnd;
    if (s == null) { s = el.value.length; en = s; }
    try {
      el.setRangeText(",", s, en, "end");
    } catch (_) {
      el.value = el.value.slice(0, s) + "," + el.value.slice(en);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: ",", inputType: "insertText" }));
  }, true);
})();
