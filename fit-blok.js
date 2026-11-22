/*
 * SPDT - Kunci navigasi blok (halaman /dokumen/<id>/edit)
 * -----------------------------------------------------------
 * Di form isian ada 3 scroll vertikal bertumpuk: halaman, kartu tengah
 * (tab Blok + judul blok + tabel), dan area tabel. Tinggi maks. area tabel
 * dari server (calc(100vh-112px-7rem)) tidak mengurangi tinggi tab & judul
 * blok, sehingga kartu tengah ikut ter-scroll dan navigasi blok, judul blok,
 * serta judul kolom hilang ke atas.
 *
 * Script ini menyetel max-height area tabel = sisa ruang di kartu tengah,
 * sehingga kartu tengah tidak lagi ter-scroll. Hanya tabel yang ter-scroll
 * (judul kolom tabel sudah sticky dari server).
 */
(function () {
  "use strict";

  var enabled = true;
  var MIN_H = 200;

  function onEditPage() { return /^\/dokumen\/[^/]+\/edit\/?$/.test(location.pathname); }

  function innerAreas() {
    return Array.prototype.slice.call(document.querySelectorAll(".p-scrollarea-viewport"))
      .filter(function (v) { return v.clientHeight > 0 && v.querySelector(":scope > * > table, :scope > table"); });
  }

  function reset() {
    document.querySelectorAll("[data-spdt-fit]").forEach(function (v) {
      v.style.maxHeight = "";
      v.removeAttribute("data-spdt-fit");
    });
  }

  function fit() {
    if (!enabled || !onEditPage()) { reset(); return; }
    var areas = innerAreas();
    areas.forEach(function (inner) {
      var mid = inner.parentElement && inner.parentElement.closest(".p-scrollarea-viewport");
      if (!mid) return;
      // blok berisi >1 tabel (mis. Blok VII): biarkan perilaku asli server
      if (areas.filter(function (o) { return mid.contains(o); }).length > 1) {
        if (inner.hasAttribute("data-spdt-fit")) { inner.style.maxHeight = ""; inner.removeAttribute("data-spdt-fit"); }
        return;
      }
      // JANGAN kosongkan max-height dulu untuk mengukur: area tabel sesaat jadi
      // tidak ter-scroll, browser me-reset scrollTop ke 0, dan tabel melompat ke
      // atas setiap ada mutasi DOM (buka dropdown, ketik, dll). Rumus di bawah
      // tetap benar dengan max-height yang sedang berlaku karena "tail" adalah
      // isi di bawah tabel, tidak bergantung pada tinggi tabel itu sendiri.
      var mr = mid.getBoundingClientRect(), ir = inner.getBoundingClientRect();
      var topIn = ir.top - mr.top + mid.scrollTop;               // posisi tabel di dalam kartu tengah
      var tail = mid.scrollHeight - (topIn + inner.offsetHeight); // isi di bawah tabel (tombol Tambah, padding)
      var mh = Math.max(MIN_H, Math.floor(mid.clientHeight - topIn - tail)) + "px";
      if (inner.style.maxHeight === mh && inner.hasAttribute("data-spdt-fit")) return; // tidak berubah: jangan sentuh
      var st = inner.scrollTop;
      inner.style.maxHeight = mh;
      inner.setAttribute("data-spdt-fit", "1");
      if (inner.scrollTop !== st) inner.scrollTop = st;           // pertahankan posisi scroll tabel
    });
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(fit, 150); }

  // hanya perubahan struktur (ganti tab, tambah baris) — bukan atribut style milik kita sendiri
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);

  try {
    chrome.storage.sync.get({ fitBlok: true }, function (v) { enabled = v.fitBlok; fit(); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && "fitBlok" in ch) { enabled = ch.fitBlok.newValue; fit(); }
    });
  } catch (e) { fit(); }
})();
