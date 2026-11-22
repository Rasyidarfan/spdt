/*
 * SPDT - Fuzzy search dropdown komoditas (MAIN world, halaman /dokumen/<id>/edit)
 * -----------------------------------------------------------
 * Dropdown Jenis Barang di Blok V/VI adalah PrimeVue <Select filter> dengan
 * filterMatchMode "contains": "bwg putih" atau "bawnag" tidak ketemu.
 *
 * Tanpa menambah komponen apa pun, script ini mengganti computed
 * `visibleOptions` pada setiap instance Select (dicari lewat pohon vnode Vue)
 * dengan versi fuzzy. Kotak cari, virtual scroller, navigasi keyboard, dan
 * pemilihan tetap milik komponen aslinya; hanya daftar hasilnya yang berubah:
 *   - setiap kata kunci harus cocok (urutan kata bebas), dicocokkan ke label
 *     & kode, mis. "bwg ptih", "putih bawang", "0117052"
 *   - cocok sebagai substring > awal kata > huruf berurutan (subsequence)
 *     > salah ketik 1 huruf (kata >= 4 huruf) / 2 huruf (kata >= 7 huruf)
 *   - hasil diurutkan dari yang paling cocok
 *
 * Sekaligus memperbaiki bug bawaan: daftar hasil tampak kosong bila opsi yang
 * sedang terpilih ada jauh di bawah (posisi virtual scroller tidak di-reset).
 *
 * Toggle: atribut <html data-spdt-fuzzy="0|1"> diset oleh fuzzy-komoditas.js
 * (isolated world, membaca chrome.storage).
 */
(function () {
  "use strict";

  var MIN_OPTIONS = 30; // hanya dropdown besar (komoditas); dropdown satuan dsb. dibiarkan
  var patched = new WeakSet();
  var normCache = new WeakMap(); // opsi → label ternormalisasi (opsi tidak dimodifikasi)

  function isOn() { return document.documentElement.getAttribute("data-spdt-fuzzy") !== "0"; }
  function onEditPage() { return /^\/dokumen\/[^/]+\/edit\/?$/.test(location.pathname); }

  function norm(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  // jarak edit Damerau (OSA) dengan batas; > max dikembalikan max+1
  function editDist(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev2 = null, prev = [], cur, i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }

  // huruf token muncul berurutan di teks; skor makin tinggi makin rapat
  function subseq(tok, text) {
    var ti = 0, first = -1, last = -1;
    for (var i = 0; i < text.length && ti < tok.length; i++) {
      if (text[i] === tok[ti]) { if (first < 0) first = i; last = i; ti++; }
    }
    if (ti < tok.length) return 0;
    return tok.length / (last - first + 1); // 0..1
  }

  // skor 0 = tidak cocok. Urutan: substring (awal teks 10, awal kata 8, tengah 6)
  // > salah ketik (5/4) > huruf berurutan rapat (3.5..5) > huruf berurutan renggang (1..2)
  function scoreToken(tok, text, words) {
    var idx = text.indexOf(tok);
    if (idx === 0) return 10;
    if (idx > 0) return text[idx - 1] === " " ? 8 : 6;
    if (/^\d+$/.test(tok)) return 0; // kode angka: hanya substring
    var best = 0;
    if (tok.length >= 4) {
      var max = tok.length >= 7 ? 2 : 1;
      for (var w = 0; w < words.length && best < 5; w++) {
        var word = words[w];
        // bandingkan juga dengan awalan kata sepanjang token (ketikan belum selesai)
        var d = Math.min(editDist(tok, word, max), editDist(tok, word.slice(0, tok.length), max));
        if (d <= max) best = Math.max(best, 6 - d); // d=1 → 5, d=2 → 4
      }
    }
    if (tok.length >= 2 && best < 5) {
      var dens = subseq(tok, text); // 0..1
      if (dens >= 0.5) best = Math.max(best, 2 + 3 * dens);
      else if (dens > 0) best = Math.max(best, 1 + dens * 2);
    }
    return best;
  }

  function fuzzyFilter(options, query, labelOf) {
    var toks = norm(query).split(" ").filter(Boolean);
    if (!toks.length) return options;
    var out = [];
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      if (!o || typeof o !== "object") continue;
      if (o.value === "") continue; // "---PILIH ...---"
      var text = normCache.get(o);
      if (text === undefined) { text = norm(labelOf(o)); normCache.set(o, text); }
      var words = text.split(" "), total = 0, ok = true;
      for (var t = 0; t < toks.length; t++) {
        var s = scoreToken(toks[t], text, words);
        if (!s) { ok = false; break; }
        total += s;
      }
      if (ok) out.push({ o: o, s: total, i: i });
    }
    out.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    return out.map(function (x) { return x.o; });
  }

  // Bug bawaan PrimeVue: bila opsi terpilih ada jauh di bawah, virtual scroller
  // tetap memakai posisi lama (translate3d(0, 840px)) setelah daftar difilter,
  // sehingga hasil cari ter-render di luar area terlihat dan daftar tampak kosong.
  function fixScroller(p) {
    setTimeout(function () {
      var vs = p.virtualScroller;
      if (!vs || !p.overlayVisible) return;
      try {
        if (vs.scrollToIndex) vs.scrollToIndex(0);
        if (vs.setContentPosition) vs.setContentPosition();
      } catch (e) { /* versi PrimeVue berbeda: abaikan */ }
    }, 0);
  }

  function patch(c) {
    if (patched.has(c)) return;
    var ctx = c.ctx;
    var desc = Object.getOwnPropertyDescriptor(ctx, "visibleOptions");
    if (!desc || !desc.get || !desc.configurable) return;
    patched.add(c);
    var orig = desc.get;
    var memo = { opts: null, q: null, res: null };
    var lastQ = null;
    Object.defineProperty(ctx, "visibleOptions", {
      enumerable: true, configurable: true,
      get: function () {
        var p = c.proxy;
        var q = p.filterValue, opts = p.options; // dibaca lewat proxy → reaktif
        // hanya saat ada teks cari: dropdown dibuka tanpa teks tetap menggulir ke opsi terpilih
        if (!p.overlayVisible) lastQ = null;
        else if (q && q !== lastQ) { lastQ = q; fixScroller(p); }
        if (!q || !isOn() || p.optionGroupLabel || !Array.isArray(opts)) return orig();
        // dropdown tertutup: kembalikan semua opsi. Label terpilih dihitung dari
        // visibleOptions, jadi kalau teks cari tertinggal (filter tidak di-reset
        // saat ditutup) label baris tampil kosong walau nilainya tetap ada.
        if (!p.overlayVisible) return opts;
        if (memo.opts === opts && memo.q === q) return memo.res;
        var labelOf = function (o) { return p.getOptionLabel ? p.getOptionLabel(o) : (o && o.label); };
        memo = { opts: opts, q: q, res: fuzzyFilter(opts, q, labelOf) };
        return memo.res;
      },
      set: desc.set
    });
  }

  function scan() {
    if (!onEditPage()) return;
    var rootEl = document.querySelector("#app");
    var root = rootEl && rootEl._vnode;
    if (!root) return;
    var stack = [root], n = 0;
    while (stack.length && n < 200000) {
      var vn = stack.pop(); n++;
      if (!vn) continue;
      var c = vn.component;
      if (c) {
        if (c.type && c.type.name === "Select" && c.props && c.props.filter &&
            Array.isArray(c.props.options) && c.props.options.length >= MIN_OPTIONS) patch(c);
        stack.push(c.subTree);
        continue;
      }
      if (vn.suspense) stack.push(vn.suspense.activeBranch);
      if (Array.isArray(vn.children)) for (var i = vn.children.length - 1; i >= 0; i--) stack.push(vn.children[i]);
    }
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(scan, 300); }
  // baris baru / ganti dokumen → instance Select baru
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  // sebelum dropdown dibuka (klik / keyboard), pastikan instance-nya sudah di-patch
  document.addEventListener("pointerdown", function (e) {
    if (e.target && e.target.closest && e.target.closest(".p-select")) scan();
  }, true);
  document.addEventListener("focusin", function (e) {
    if (e.target && e.target.closest && e.target.closest(".p-select")) scan();
  }, true);
  schedule();
})();
