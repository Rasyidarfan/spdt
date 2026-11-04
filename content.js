/*
 * SPDT - Freeze Kolom Komoditas
 * -----------------------------------------------------------
 * Membuat HANYA kolom komoditas (Kode + Jenis Barang) pada tabel entri
 * tetap menempel / terlihat ketika tabel discroll ke kanan, plus penanda
 * KUNING pada baris yang sedang aktif (sedang diisi).
 *
 * - Tidak menambah tombol/UI apa pun, otomatis menyesuaikan.
 * - Sel komoditas di body memakai colSpan=2 (membentang di bawah header
 *   "Kode" + "Jenis Barang"), jadi pencocokan kolom dilakukan berbasis
 *   posisi (geometri), bukan indeks, supaya akurat.
 */
(function () {
  "use strict";

  var ACCENT = "#facc15"; // kuning penanda baris aktif
  var FROZEN = "data-spdt-frozen";

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function effectiveBg(el) {
    var e = el;
    while (e) {
      var c = getComputedStyle(e).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
      e = e.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || "#111827";
  }

  function findScrollContainer(table) {
    var p = table.parentElement;
    while (p) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return p;
      p = p.parentElement;
    }
    return null;
  }

  function headText(c) { return (c.textContent || "").trim().toLowerCase(); }

  // Pembatas tipis saja (tidak menutupi kolom Satuan di sebelah kanan).
  function baseShadow() {
    return "4px 0 6px -4px rgba(0,0,0,.55), -4px 0 6px -4px rgba(0,0,0,.4)";
  }

  function freezeTable(table) {
    if (table.offsetParent === null) return; // tab tersembunyi

    var head0 = table.querySelector("thead tr");
    if (!head0) return;
    var hc = Array.prototype.slice.call(head0.children);

    var jenis = null, kode = null;
    hc.forEach(function (c) {
      var t = headText(c);
      if (t.indexOf("jenis barang") !== -1 || t.indexOf("komoditas") !== -1) jenis = c;
      if (t.indexOf("kode") === 0) kode = c;
    });
    if (!jenis) return;

    var container = findScrollContainer(table);
    if (!container) return;

    var bg = effectiveBg(table.querySelector("tbody td") || table);
    var base = container.getBoundingClientRect().left; // tepi kiri viewport scroll
    var scrollW = container.scrollWidth;

    // Posisi natural (jarak dari origin konten), tidak terpengaruh scroll saat ini.
    function nat(cell) {
      var r = cell.getBoundingClientRect();
      var l = r.left - base + container.scrollLeft;
      return { l: l, r: l + r.width, w: r.width };
    }

    // Bersihkan frozen sebelumnya (hitung ulang dari nol).
    table.querySelectorAll("[" + FROZEN + "]").forEach(function (c) {
      c.style.position = ""; c.style.left = ""; c.style.zIndex = "";
      c.style.background = ""; c.style.boxShadow = ""; c.style.backgroundClip = "";
      c.removeAttribute(FROZEN);
    });

    // Rentang kolom target: dari kiri "Kode" (kalau ada) s/d kanan "Jenis Barang".
    var jr = nat(jenis);
    var tL = kode ? nat(kode).l : jr.l;
    var tR = jr.r;

    var rows = Array.prototype.slice.call(table.querySelectorAll("thead tr, tbody tr"));
    rows.forEach(function (row) {
      var isHead = row.parentElement.tagName === "THEAD";
      Array.prototype.slice.call(row.children).forEach(function (cell) {
        var g = nat(cell);
        if (g.w <= 0) return;
        if (g.w > scrollW * 0.5) return;            // lewati sel full-width (bar/grup)
        if (cell.colSpan && cell.colSpan >= 4) return;
        var overlap = Math.min(g.r, tR) - Math.max(g.l, tL);
        if (overlap <= Math.min(10, g.w * 0.3)) return; // harus tumpang tindih cukup
        cell.style.position = "sticky";
        cell.style.left = g.l + "px";
        cell.style.zIndex = isHead ? "31" : "21";
        cell.style.background = bg;
        cell.style.backgroundClip = "padding-box";
        cell.dataset.spdtBg = bg;
        cell.style.boxShadow = baseShadow();
        cell.setAttribute(FROZEN, "1");
      });
    });

    attachActiveRow(table);

    // Pertahankan penanda baris aktif setelah freeze dihitung ulang.
    var active = table.querySelector("tbody tr[data-spdt-active]");
    if (active) markActiveRow(table, active);
  }

  // ---- Penanda KUNING baris aktif ------------------------------------------
  var ROW_LINES = "inset 0 3px 0 0 " + ACCENT + ", inset 0 -3px 0 0 " + ACCENT;

  // Bersihkan penanda aktif dari SELURUH sel tabel (bukan hanya baris beratribut),
  // supaya tanda lama pasti hilang saat pindah baris.
  function clearActive(table) {
    Array.prototype.slice
      .call(table.querySelectorAll("tbody td, tbody th"))
      .forEach(function (c) {
        c.style.backgroundColor = "";
        if (c.hasAttribute(FROZEN)) {
          c.style.background = c.dataset.spdtBg;
          c.style.boxShadow = baseShadow();
        } else if (c.style.boxShadow) {
          c.style.boxShadow = "";
        }
      });
    table.querySelectorAll("tbody tr[data-spdt-active]").forEach(function (r) {
      r.removeAttribute("data-spdt-active");
    });
  }

  function markActiveRow(table, tr) {
    clearActive(table);
    if (!tr || tr.parentElement.tagName !== "TBODY") return;
    tr.setAttribute("data-spdt-active", "1");

    // Garis kuning atas-bawah sepanjang baris (terlihat walau sel berisi input),
    // + bar kiri pada sel pertama & sel komoditas.
    Array.prototype.slice.call(tr.children).forEach(function (c, i) {
      c.style.backgroundColor = "rgba(250,204,21,.14)";
      var leftBar = i === 0 ? "inset 6px 0 0 0 " + ACCENT + ", " : "";
      if (c.hasAttribute(FROZEN)) {
        c.style.background = c.dataset.spdtBg;        // tetap solid agar tak tembus
        c.style.boxShadow = "inset 6px 0 0 0 " + ACCENT + ", " + ROW_LINES + ", " + baseShadow();
      } else {
        c.style.boxShadow = leftBar + ROW_LINES;
      }
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

  var enabled = true; // toggle "freeze" dari pengaturan

  function targetTables() {
    return Array.prototype.slice.call(document.querySelectorAll("table"))
      .filter(function (t) {
        return /Jenis Barang|Komoditas/i.test(t.textContent) && /Nilai/i.test(t.textContent);
      });
  }

  function applyAll() {
    if (!enabled) return;
    targetTables().forEach(freezeTable);
  }

  // Bersihkan semua gaya freeze + penanda saat fitur dimatikan.
  function clearAll() {
    targetTables().forEach(function (table) {
      table.querySelectorAll("[" + FROZEN + "]").forEach(function (c) {
        c.style.position = ""; c.style.left = ""; c.style.zIndex = "";
        c.style.background = ""; c.style.boxShadow = ""; c.style.backgroundClip = "";
        c.style.backgroundColor = ""; c.removeAttribute(FROZEN);
      });
      table.querySelectorAll("tbody tr[data-spdt-active]").forEach(function (r) {
        r.removeAttribute("data-spdt-active");
        Array.prototype.slice.call(r.children).forEach(function (c) {
          c.style.backgroundColor = ""; c.style.boxShadow = "";
        });
      });
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
    chrome.storage.sync.get({ freeze: true }, function (v) {
      enabled = v.freeze;
      if (enabled) applyAll(); else clearAll();
    });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && "freeze" in ch) {
        enabled = ch.freeze.newValue;
        if (enabled) run(); else clearAll();
      }
    });
  } catch (e) { /* tanpa storage -> tetap aktif */ }

  applyAll();
  [300, 800, 1500, 3000].forEach(function (ms) { setTimeout(applyAll, ms); });
})();
