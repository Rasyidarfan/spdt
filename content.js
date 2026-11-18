/*
 * SPDT - Penanda Baris Aktif (+ Kolom Aktif di Blok V)
 * -----------------------------------------------------------
 * Memberi penanda KUNING pada baris yang sedang aktif (sedang diisi) di
 * tabel entri, supaya operator tidak kehilangan posisi baris saat mengetik.
 * Di Blok V (header bertingkat H-1..H-7 / Jumlah-Nilai / nomor kolom) kolom
 * yang sedang diisi juga ditandai: judul kolom kuning + sel kolom diwarnai tipis.
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

  // ---------- kolom aktif (Blok V) ----------
  var COL_CSS =
    "table [data-spdt-col]{background-image:linear-gradient(rgba(250,204,21,.10),rgba(250,204,21,.10))}" +
    "table td[data-spdt-col] input{background-image:linear-gradient(rgba(250,204,21,.10),rgba(250,204,21,.10));border-color:rgba(250,204,21,.55)!important}" +
    "table thead [data-spdt-col]{color:" + ACCENT + "!important;background-image:linear-gradient(rgba(250,204,21,.18),rgba(250,204,21,.18));box-shadow:inset 0 -3px 0 0 " + ACCENT + "}" +
    "table thead [data-spdt-col='g']{box-shadow:none;background-image:linear-gradient(rgba(250,204,21,.10),rgba(250,204,21,.10))}";

  function ensureColCss() {
    if (document.getElementById("spdt-col-css")) return;
    var st = document.createElement("style");
    st.id = "spdt-col-css";
    st.textContent = COL_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // Blok V: header punya grup "H-1 (Kemarin)" .. "H-7"
  function isBlokV(table) {
    return !!(table.tHead && /H-1/.test(table.tHead.textContent) && /H-7/.test(table.tHead.textContent));
  }

  // indeks kolom logis tiap sel dalam baris (memperhitungkan colSpan & rowSpan header)
  function headerGrid(thead) {
    var grid = [];
    Array.prototype.forEach.call(thead.rows, function (tr, r) {
      grid[r] = grid[r] || [];
      var c = 0;
      Array.prototype.forEach.call(tr.cells, function (cell) {
        while (grid[r][c]) c++;
        for (var dr = 0; dr < cell.rowSpan; dr++) {
          grid[r + dr] = grid[r + dr] || [];
          for (var dc = 0; dc < cell.colSpan; dc++) grid[r + dr][c + dc] = cell;
        }
        c += cell.colSpan;
      });
    });
    return grid;
  }

  function colStart(td) {
    var c = 0, e = td.previousElementSibling;
    while (e) { c += e.colSpan || 1; e = e.previousElementSibling; }
    return c;
  }

  function clearCol(table) {
    table.querySelectorAll("[data-spdt-col]").forEach(function (c) { c.removeAttribute("data-spdt-col"); });
  }

  function markActiveCol(table, col) {
    clearCol(table);
    if (col == null || col < 0) return;
    ensureColCss();
    var seen = [];
    headerGrid(table.tHead).forEach(function (row) {
      var cell = row[col];
      if (!cell || seen.indexOf(cell) !== -1) return;
      seen.push(cell);
      cell.setAttribute("data-spdt-col", cell.colSpan > 1 ? "g" : "1");
    });
    Array.prototype.forEach.call(table.tBodies, function (tb) {
      Array.prototype.forEach.call(tb.rows, function (tr) {
        var c = 0;
        Array.prototype.some.call(tr.cells, function (cell) {
          if (c === col && cell.colSpan === 1) { cell.setAttribute("data-spdt-col", "1"); return true; }
          c += cell.colSpan;
          return c > col;
        });
      });
    });
  }

  function focusCol(table, target) {
    if (!isBlokV(table)) return;
    var td = target.closest && target.closest("tbody td");
    if (!td || !td.querySelector("input, .p-select") || td.colSpan > 1) return;
    var col = colStart(td);
    table.setAttribute("data-spdt-colidx", String(col));
    markActiveCol(table, col);
  }

  function attachActiveRow(table) {
    if (table.getAttribute("data-spdt-listen")) return;
    table.setAttribute("data-spdt-listen", "1");
    table.addEventListener("focusin", function (e) {
      var tr = e.target.closest && e.target.closest("tr");
      if (tr) markActiveRow(table, tr);
      if (enabled) focusCol(table, e.target);
    });
    table.addEventListener("click", function (e) {
      var tr = e.target.closest && e.target.closest("tbody tr");
      if (tr) markActiveRow(table, tr);
      if (enabled) focusCol(table, e.target);
    });
  }

  var enabled = true; // toggle "markerBaris" dari pengaturan

  function applyAll() {
    if (!enabled) return;
    targetTables().forEach(function (table) {
      attachActiveRow(table);
      var active = table.querySelector("tbody tr[data-spdt-active]");
      if (active) markActiveRow(table, active);
      // baris baru / render ulang → tandai ulang kolom aktif
      var ci = table.getAttribute("data-spdt-colidx");
      if (ci && isBlokV(table)) markActiveCol(table, parseInt(ci, 10));
    });
  }

  function clearAll() {
    targetTables().forEach(function (table) {
      clearActive(table);
      clearCol(table);
      table.removeAttribute("data-spdt-colidx");
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
