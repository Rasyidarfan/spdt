/*
 * SPDT - Penanda Baris Aktif
 * -----------------------------------------------------------
 * Memberi penanda KUNING pada baris yang sedang aktif (sedang diisi) di
 * tabel entri, supaya operator tidak kehilangan posisi baris saat mengetik.
 *
 * Catatan: fitur "freeze kolom komoditas" DIHAPUS karena server sudah
 * menyediakannya secara native.
 */
(function () {
  "use strict";

  var ACCENT = "#facc15"; // kuning penanda baris aktif
  var ROW_LINES = "inset 0 3px 0 0 " + ACCENT + ", inset 0 -3px 0 0 " + ACCENT;

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function targetTables() {
    return Array.prototype.slice.call(document.querySelectorAll("table"))
      .filter(function (t) {
        return /Jenis Barang|Komoditas/i.test(t.textContent) && /Nilai/i.test(t.textContent);
      });
  }

  // Bersihkan penanda aktif dari SELURUH sel tabel, supaya tanda lama
  // pasti hilang saat pindah baris.
  function clearActive(table) {
    Array.prototype.slice
      .call(table.querySelectorAll("tbody td, tbody th"))
      .forEach(function (c) {
        c.style.backgroundColor = "";
        if (c.style.boxShadow) c.style.boxShadow = "";
      });
    table.querySelectorAll("tbody tr[data-spdt-active]").forEach(function (r) {
      r.removeAttribute("data-spdt-active");
    });
  }

  function markActiveRow(table, tr) {
    clearActive(table);
    if (!tr || tr.parentElement.tagName !== "TBODY") return;
    tr.setAttribute("data-spdt-active", "1");
    // Garis kuning atas-bawah sepanjang baris + bar kiri pada sel pertama.
    Array.prototype.slice.call(tr.children).forEach(function (c, i) {
      c.style.backgroundColor = "rgba(250,204,21,.14)";
      var leftBar = i === 0 ? "inset 6px 0 0 0 " + ACCENT + ", " : "";
      c.style.boxShadow = leftBar + ROW_LINES;
    });
  }

  function attachActiveRow(table) {
    if (table.getAttribute("data-spdt-listen")) return;
    table.setAttribute("data-spdt-listen", "1");
    table.addEventListener("focusin", function (e) {
      var tr = e.target.closest && e.target.closest("tr");
      if (tr) markActiveRow(table, tr);
    });
    table.addEventListener("click", function (e) {
      var tr = e.target.closest && e.target.closest("tbody tr");
      if (tr) markActiveRow(table, tr);
    });
  }

  var enabled = true; // toggle "markerBaris" dari pengaturan

  function applyAll() {
    if (!enabled) return;
    targetTables().forEach(function (table) {
      attachActiveRow(table);
      var active = table.querySelector("tbody tr[data-spdt-active]");
      if (active) markActiveRow(table, active);
    });
  }

  function clearAll() {
    targetTables().forEach(function (table) {
      clearActive(table);
    });
  }

  var mo = new MutationObserver(function () { run(); });
  var run = debounce(function () {
    mo.disconnect();
    try { applyAll(); } finally {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }, 150);

  window.addEventListener("resize", run);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  try {
    chrome.storage.sync.get({ markerBaris: true }, function (v) {
      enabled = v.markerBaris;
      if (enabled) applyAll(); else clearAll();
    });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && "markerBaris" in ch) {
        enabled = ch.markerBaris.newValue;
        if (enabled) run(); else clearAll();
      }
    });
  } catch (e) { /* tanpa storage -> tetap aktif */ }

  applyAll();
  [300, 800, 1500, 3000].forEach(function (ms) { setTimeout(applyAll, ms); });
})();
