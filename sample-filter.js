/*
 * SPDT - Filter Status Dokumen & Operator + kolom Operator (content script, halaman /sample)
 * -----------------------------------------------------------
 * - Panel di kartu Pencarian: dropdown Status Dokumen & Operator. Pilihan disimpan
 *   di sessionStorage ("spdtSF", "spdtSFop") dan dibaca sample-filter-hook.js,
 *   yang menyaring data TABEL ASLI. Panel memicu tabel memuat ulang & menampilkan jumlah.
 * - Kolom "Operator" disisipkan di tabel asli (sebelum kolom tombol): nama
 *   user_created & user_modified dokumen; bila sama cukup satu nama.
 *   Nama diambil dari /api/user?full_code=<kab>.
 */
(function () {
  "use strict";

  var LABEL = { C: "Clean", E: "Error", B: "Belum" };
  var enabled = true;
  var panel = null;
  var info = null;        // {counts, ops, total, st, op} | {error}
  var pageRows = null;    // [{id, nama, alamat, uc, um}] untuk baris tabel saat ini
  var byKey = {};         // "nama|alamat" -> {uc, um} | "dup" — cadangan saat aplikasi memakai cache halaman
  var users = {};         // kab -> Promise<{id: nama}>
  var names = {};         // id -> nama (gabungan semua kab yang dimuat)
  var curKab = "";

  function onSamplePage() { return /^\/sample\/?$/.test(location.pathname); }
  function ss(k, v) {
    try {
      if (arguments.length === 1) return sessionStorage.getItem(k) || "";
      v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k);
    } catch (e) { return ""; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- data user (nama operator) ----------
  function currentKab() {
    var t = Array.prototype.slice.call(document.querySelectorAll(".p-select-label, .p-dropdown-label"))
      .map(function (e) { return (e.textContent || "").trim(); })
      .find(function (x) { return /^\[\d{4}\]/.test(x); });
    return t ? t.slice(1, 5) : "";
  }

  function loadUsers(kab) {
    if (!kab) return Promise.resolve({});
    if (users[kab]) return users[kab];
    users[kab] = (async function () {
      var map = {}, page = 1, last = 1;
      do {
        var r = await fetch("/api/user?page=" + page + "&full_code=" + encodeURIComponent(kab) + "&search=&per_page=100",
          { headers: { accept: "application/json", "x-requested-with": "XMLHttpRequest" }, credentials: "include" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        var j = await r.json();
        (j.data || []).forEach(function (u) { map[u.id] = u.nama || u.username || String(u.id); names[u.id] = map[u.id]; });
        last = (j.meta && j.meta.last_page) || 1;
        page++;
      } while (page <= last && page <= 20);
      return map;
    })();
    users[kab].catch(function () { delete users[kab]; });
    return users[kab];
  }

  function nameOf(id) { return id == null ? "" : (names[id] || ("#" + id)); }

  // ---------- memicu tabel memuat ulang ----------
  // Aplikasi meng-cache hasil per (kata Cari, halaman) dan tidak memuat ulang bila
  // kata Cari kosong / pernah dicari. Jadi di akhir kotak "Cari" ditambahkan penanda
  // tak terlihat yang UNIK tiap kali (kombinasi karakter zero-width dari penghitung).
  // Hook membuang karakter ini dari URL, jadi pencarian ke server tetap sama.
  var ZW_CHARS = ["\u200B", "\u200C", "\u200D", "\u2060"];
  var ZW_RE = /[\u200B-\u200D\u2060]/g;
  function marker() {
    var n = (parseInt(ss("spdtSFn"), 10) || 0) + 1;
    ss("spdtSFn", String(n));
    var s = "";
    do { s += ZW_CHARS[n % 4]; n = Math.floor(n / 4); } while (n > 0);
    return s;
  }
  function reloadTable() {
    var inp = Array.prototype.slice.call(document.querySelectorAll("input.p-inputtext"))
      .find(function (i) { return !panel || !panel.contains(i); });
    if (!inp) return;
    var nv = inp.value.replace(ZW_RE, "") + marker();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(inp, nv);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ---------- panel ----------
  var CSS =
    "#spdt-sf{border:1px solid rgba(250,204,21,.45);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}" +
    "#spdt-sf .t{font-weight:700;font-size:13px;color:#facc15}" +
    "#spdt-sf label{font-size:11px;color:#a1a1aa;margin-bottom:-4px}" +
    "#spdt-sf select{width:100%;padding:7px 9px;border-radius:6px;border:1px solid #3f3f46;background:transparent;color:inherit;font-size:13px}" +
    "#spdt-sf select option{background:#18181b;color:#f4f4f5}" +
    "#spdt-sf .cnt{display:flex;gap:6px;flex-wrap:wrap}" +
    "#spdt-sf .cnt span{padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px}" +
    "#spdt-sf .C{background:#16a34a;color:#fff}#spdt-sf .E{background:#dc2626;color:#fff}#spdt-sf .B{background:#3f3f46;color:#e4e4e7}" +
    "#spdt-sf .m{font-size:11px;color:#a1a1aa}#spdt-sf .err{color:#f87171}" +
    "#spdt-sf .rf{cursor:pointer;background:none;border:0;color:#facc15;font-size:12px;text-align:left;padding:0}" +
    ".spdt-op{font-size:12px;line-height:1.35;white-space:nowrap}.spdt-op small{display:block;color:#a1a1aa;font-size:10px}";

  function ensureUi() {
    var card = Array.prototype.slice.call(document.querySelectorAll(".card"))
      .find(function (c) { return /Pencarian/.test(c.textContent) && c.querySelector(".p-select, .p-dropdown"); });
    if (!card) return false;
    if (panel && card.contains(panel)) return true;
    if (!document.getElementById("spdt-sf-css")) {
      var s = document.createElement("style");
      s.id = "spdt-sf-css"; s.textContent = CSS;
      document.head.appendChild(s);
    }
    panel = document.createElement("div");
    panel.id = "spdt-sf";
    panel.innerHTML =
      '<div class="t">Filter Tambahan</div>' +
      '<label>Status Dokumen</label>' +
      '<select class="st"><option value="">Semua</option><option value="C">Clean</option>' +
      '<option value="E">Error</option><option value="B">Belum</option></select>' +
      '<label>Operator</label>' +
      '<select class="op"><option value="">Semua operator</option></select>' +
      '<div class="cnt"></div><div class="m"></div>' +
      '<button class="rf" type="button">↻ Muat ulang data</button>';
    card.appendChild(panel);
    var st = panel.querySelector(".st"), op = panel.querySelector(".op");
    st.value = ss("spdtSF");
    st.addEventListener("change", function () { ss("spdtSF", st.value); onFilterChange(); });
    op.addEventListener("change", function () { ss("spdtSFop", op.value); onFilterChange(); });
    panel.querySelector(".rf").addEventListener("click", function () {
      window.postMessage({ __spdtSFClear: true }, location.origin);
      if (ss("spdtSF") || ss("spdtSFop")) render("Memuat ulang…");
      reloadTable();
    });
    fillOperators();
    render();
    return true;
  }

  function onFilterChange() {
    info = null;
    render((ss("spdtSF") || ss("spdtSFop")) ? "Menyaring… (mengambil semua sampel)" : "");
    reloadTable();
  }

  // Daftar operator = user kabupaten terpilih; bila jumlah per operator sudah
  // diketahui (filter aktif), yang punya dokumen tampil di atas beserta jumlahnya.
  function fillOperators() {
    if (!panel) return;
    var kab = currentKab();
    loadUsers(kab).then(function (map) {
      if (!panel) return;
      var sel = panel.querySelector(".op");
      var cur = ss("spdtSFop");
      var ops = (info && info.ops) || null;
      var ids = Object.keys(map);
      if (cur && ids.indexOf(cur) === -1) ids.push(cur);
      ids.sort(function (a, b) {
        var ca = ops ? (ops[a] || 0) : 0, cb = ops ? (ops[b] || 0) : 0;
        if (ca !== cb) return cb - ca;
        return nameOf(a).localeCompare(nameOf(b));
      });
      sel.innerHTML = '<option value="">Semua operator</option>' + ids.map(function (id) {
        var n = ops ? (ops[id] || 0) : null;
        return '<option value="' + esc(id) + '">' + esc(nameOf(id)) + (n != null ? " (" + n + ")" : "") + "</option>";
      }).join("");
      sel.value = cur;
    }).catch(function () {});
  }

  function render(msg) {
    if (!panel) return;
    var st = ss("spdtSF"), op = ss("spdtSFop");
    var cnt = panel.querySelector(".cnt"), m = panel.querySelector(".m");
    m.className = "m";
    if (!st && !op) { cnt.innerHTML = ""; m.textContent = msg || ""; return; }
    if (info && info.error) { cnt.innerHTML = ""; m.className = "m err"; m.textContent = "Gagal menyaring (" + info.error + "), menampilkan data asli."; return; }
    if (info && info.counts) {
      cnt.innerHTML = '<span class="C">Clean ' + info.counts.C + '</span><span class="E">Error ' + info.counts.E +
        '</span><span class="B">Belum ' + info.counts.B + "</span>";
      var parts = [];
      if (st) parts.push(LABEL[st]);
      if (op) parts.push("operator " + nameOf(op));
      m.textContent = msg || ("Tabel menampilkan " + info.total + " sampel · " + parts.join(" · ") + ".");
    } else {
      cnt.innerHTML = "";
      m.textContent = msg || "Menyaring…";
    }
  }

  // ---------- kolom Operator di tabel asli ----------
  function nativeTable() {
    return Array.prototype.slice.call(document.querySelectorAll("table"))
      .find(function (t) { return /Nama KRT/.test(t.tHead ? t.tHead.textContent : ""); });
  }

  function key(nama, alamat) {
    return (String(nama || "").trim() + "|" + String(alamat || "").trim()).toUpperCase().replace(/\s+/g, " ");
  }
  function remember(rows) {
    (rows || []).forEach(function (r) {
      var k = key(r.nama, r.alamat), v = { uc: r.uc, um: r.um };
      var prev = byKey[k];
      if (prev && prev !== "dup" && (String(prev.uc) !== String(v.uc) || String(prev.um) !== String(v.um))) byKey[k] = "dup";
      else if (!prev) byKey[k] = v;
    });
  }

  function opCellHtml(r) {
    if (!r || (r.uc == null && r.um == null)) return '<span style="color:#71717a">–</span>';
    if (r.uc == null || r.um == null || String(r.uc) === String(r.um)) return esc(nameOf(r.uc != null ? r.uc : r.um));
    return esc(nameOf(r.uc)) + "<small>entri</small>" + esc(nameOf(r.um)) + "<small>ubah</small>";
  }

  var applying = false;
  function applyColumn() {
    if (!enabled || !onSamplePage()) return;
    var t = nativeTable();
    if (!t) return;
    applying = true;
    try {
      var hr = t.tHead && t.tHead.rows[0];
      if (hr && !hr.querySelector(".spdt-op-h")) {
        var last = hr.cells[hr.cells.length - 1];
        var th = last.cloneNode(false);
        th.classList.add("spdt-op-h");
        th.innerHTML = '<div class="p-datatable-column-header-content"><span class="p-datatable-column-title">Operator</span></div>';
        hr.insertBefore(th, last);
      }
      var trs = Array.prototype.slice.call(t.tBodies[0] ? t.tBodies[0].rows : []);
      var dataRows = trs.filter(function (tr) { return tr.cells.length > 2; });
      var ok = pageRows && pageRows.length === dataRows.length;
      var heads = hr ? Array.prototype.map.call(hr.cells, function (c) { return c.textContent.trim(); }) : [];
      var iNama = heads.indexOf("Nama KRT"), iAlamat = heads.indexOf("Alamat");
      dataRows.forEach(function (tr, i) {
        var td = tr.querySelector("td.spdt-op");
        if (!td) {
          var lastTd = tr.cells[tr.cells.length - 1];
          td = lastTd.cloneNode(false);
          td.classList.add("spdt-op");
          tr.insertBefore(td, lastTd);
        }
        var r = ok ? pageRows[i] : null;
        // cocokkan juga nama KRT, supaya tidak salah baris saat tabel sedang berganti
        if (r && r.nama && tr.textContent.indexOf(r.nama) === -1) r = null;
        if (!r && iNama >= 0 && iAlamat >= 0 && tr.cells[iNama] && tr.cells[iAlamat]) {
          var hit = byKey[key(tr.cells[iNama].textContent, tr.cells[iAlamat].textContent)];
          if (hit && hit !== "dup") r = hit;
        }
        var html = r ? opCellHtml(r) : "";
        if (td.getAttribute("data-h") !== html) { td.innerHTML = html; td.setAttribute("data-h", html); }
      });
      // baris "tidak ada data" (satu sel colspan) → lebarkan
      trs.forEach(function (tr) {
        if (tr.cells.length === 1 && tr.cells[0].colSpan > 1 && hr && tr.cells[0].colSpan < hr.cells.length) tr.cells[0].colSpan = hr.cells.length;
      });
    } finally { applying = false; }
  }

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data) return;
    if (ev.data.__spdtSFInfo) {
      info = ev.data;
      render();
      fillOperators();
    } else if (ev.data.__spdtSFRows) {
      remember(ev.data.rows);
      if (ev.data.all) { applyColumn(); return; } // seluruh sampel (dari hook), hanya untuk peta cadangan
      pageRows = ev.data.rows || [];
      var kab = (ev.data.fc || "").slice(0, 4) || currentKab();
      loadUsers(kab).then(function () { applyColumn(); fillOperators(); }).catch(function () { applyColumn(); });
      setTimeout(applyColumn, 50);
    }
  });

  function teardown() {
    if (panel) { panel.remove(); panel = null; }
    document.querySelectorAll(".spdt-op, .spdt-op-h").forEach(function (e) { e.remove(); });
  }

  function tick() {
    if (!enabled) {
      if (ss("spdtSF") || ss("spdtSFop")) { ss("spdtSF", ""); ss("spdtSFop", ""); if (onSamplePage()) reloadTable(); }
    }
    if (!enabled || !onSamplePage()) { teardown(); return; }
    if (!ensureUi()) return;
    var kab = currentKab();
    if (kab !== curKab) {
      // operator kabupaten lain tidak berlaku → reset filter operator
      if (curKab && ss("spdtSFop")) { ss("spdtSFop", ""); info = null; render(); reloadTable(); }
      curKab = kab;
      fillOperators();
    }
    applyColumn();
  }

  var t = null;
  new MutationObserver(function () {
    if (applying) return;
    clearTimeout(t); t = setTimeout(tick, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });

  try {
    chrome.storage.sync.get({ filterStatus: true }, function (v) { enabled = v.filterStatus; tick(); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && "filterStatus" in ch) { enabled = ch.filterStatus.newValue; tick(); }
    });
  } catch (e) { tick(); }
})();
