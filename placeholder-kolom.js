/*
 * SPDT - Placeholder judul kolom (halaman /dokumen/<id>/edit)
 * -----------------------------------------------------------
 * Setiap text input di tabel isian yang masih kosong diberi placeholder
 * sesuai judul kolomnya (mis. "H-1 Jumlah", "H-3 Nilai (Rp)", "Sebulan Jumlah"),
 * supaya operator tahu sel mana yang sedang diisi tanpa melihat ke header.
 *
 * Judul diambil dari header bertingkat (colSpan/rowSpan diperhitungkan):
 * grup + sub-judul, tanpa baris nomor kolom "(1)".."(n)". Judul grup yang
 * berupa instruksi panjang (mis. "Kolom (6)-(7) Ditanyakan Kepada ...")
 * dilewati, dan keterangan dalam kurung di judul grup ("(Kemarin)") dibuang.
 * Placeholder hanya tampil saat input kosong (perilaku bawaan browser).
 */
(function () {
  "use strict";

  var enabled = true;
  var GROUP_MAX = 25; // judul grup lebih panjang dari ini = instruksi, dilewati
  var LONG = 24;      // judul lebih panjang dari ini diawali nomor kolom "(n)" (input sempit memotong teks)
  var CSS = "input[data-spdt-ph]::placeholder{color:rgba(148,163,184,.55);font-style:italic;opacity:1}";

  function onEditPage() { return /^\/dokumen\/[^/]+\/edit\/?$/.test(location.pathname); }

  function ensureCss() {
    if (document.getElementById("spdt-ph-css")) return;
    var st = document.createElement("style");
    st.id = "spdt-ph-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }

  // grid[baris][kolom] = sel header (memperhitungkan colSpan & rowSpan)
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

  // judul tiap kolom logis: gabungan sel header dari atas ke bawah
  function columnLabels(thead) {
    var grid = headerGrid(thead), labels = [], ncol = 0;
    grid.forEach(function (row) { ncol = Math.max(ncol, row.length); });
    for (var c = 0; c < ncol; c++) {
      var parts = [], seen = [], num = "";
      grid.forEach(function (row) {
        var cell = row[c];
        if (!cell || seen.indexOf(cell) !== -1) return;
        seen.push(cell);
        var t = clean(cell.textContent);
        if (/^\(\d+\)$/.test(t)) { num = t; return; }      // baris nomor kolom
        if (!t) return;
        if (cell.colSpan > 1) {                             // judul grup
          if (t.length > GROUP_MAX) return;
          t = clean(t.replace(/\([^)]*\)/g, ""));
        }
        if (t) parts.push(t);
      });
      var full = parts.join(" ");
      labels[c] = { ph: num && full.length > LONG ? num + " " + full : full, full: full };
    }
    return labels;
  }

  function colStart(td) {
    var c = 0, e = td.previousElementSibling;
    while (e) { c += e.colSpan || 1; e = e.previousElementSibling; }
    return c;
  }

  function apply() {
    if (!enabled || !onEditPage()) return;
    ensureCss();
    document.querySelectorAll("table").forEach(function (table) {
      if (!table.tHead || !table.tBodies.length) return;
      var labels = null;
      table.querySelectorAll("tbody td input[type=text], tbody td input:not([type])").forEach(function (inp) {
        if (inp.placeholder && !inp.hasAttribute("data-spdt-ph")) return; // placeholder asli server
        labels = labels || columnLabels(table.tHead);
        var td = inp.closest("td");
        var lbl = td.colSpan > 1 ? null : labels[colStart(td)];
        if (!lbl || !lbl.ph) return;
        if (inp.getAttribute("placeholder") !== lbl.ph) {
          inp.setAttribute("placeholder", lbl.ph);
          inp.setAttribute("data-spdt-ph", "1");
          if (lbl.ph.length > LONG && !inp.title) { inp.title = lbl.full; inp.setAttribute("data-spdt-ph-title", "1"); }
        }
      });
    });
  }

  function clearAll() {
    document.querySelectorAll("input[data-spdt-ph]").forEach(function (inp) {
      inp.removeAttribute("placeholder");
      inp.removeAttribute("data-spdt-ph");
      if (inp.hasAttribute("data-spdt-ph-title")) { inp.removeAttribute("title"); inp.removeAttribute("data-spdt-ph-title"); }
    });
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 200); }

  // baris baru / ganti blok / render ulang (perubahan atribut kita sendiri tidak memicu)
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });

  try {
    chrome.storage.sync.get({ placeholderKolom: true }, function (v) {
      enabled = v.placeholderKolom;
      if (enabled) apply(); else clearAll();
    });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && "placeholderKolom" in ch) {
        enabled = ch.placeholderKolom.newValue;
        if (enabled) apply(); else clearAll();
      }
    });
  } catch (e) { apply(); }
})();
