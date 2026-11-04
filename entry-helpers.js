/*
 * SPDT - Entry Helpers
 * -----------------------------------------------------------
 * 1) Enter  -> pindah ke input berikutnya (seperti Tab) pada field entri.
 * 2) Titik "." -> otomatis jadi koma "," pada field angka (InputNumber),
 *    karena locale id-ID memakai koma sebagai pemisah desimal.
 *
 * Keduanya bisa dinyalakan/dimatikan dari halaman pengaturan ekstensi.
 */
(function () {
  "use strict";

  var cfg = { enterNav: true, commaDecimal: true };

  try {
    chrome.storage.sync.get(cfg, function (v) { cfg = v; });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "sync") return;
      if ("enterNav" in ch) cfg.enterNav = ch.enterNav.newValue;
      if ("commaDecimal" in ch) cfg.commaDecimal = ch.commaDecimal.newValue;
    });
  } catch (e) { /* storage tak tersedia -> pakai default */ }

  function entryInputs() {
    return Array.prototype.slice
      .call(document.querySelectorAll("input.p-inputnumber-input, input.p-inputtext"))
      .filter(function (x) {
        return x.offsetParent !== null && !x.disabled && !x.readOnly;
      });
  }

  // (2) Titik -> koma pada field angka
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

  // (1) Enter -> input berikutnya
  document.addEventListener("keydown", function (e) {
    if (!cfg.enterNav) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    var el = e.target;
    if (!el || !el.matches || !el.matches("input")) return;
    // jangan ganggu Enter di dropdown/combobox (untuk memilih opsi)
    if (el.closest(".p-dropdown, .p-select, [role=combobox], .p-dropdown-panel, .p-select-overlay, .p-autocomplete")) return;
    var all = entryInputs();
    var i = all.indexOf(el);
    if (i < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var n = all[i + 1];
    if (n) { n.focus(); try { n.select(); } catch (_) {} }
  }, true);
})();
