/*
 * SPDT - Filter Status Dokumen & Operator: hook data tabel (MAIN world, document_start)
 * -----------------------------------------------------------
 * Tabel "Daftar Sampel" asli memuat data via XHR GET /api/sample?page=&per_page=...
 * Server tidak punya filter status/operator, jadi saat filter aktif hook ini:
 *   1. mengambil SEMUA sampel (full_code + kd_kuesioner + search yang sama),
 *   2. menyaring per status (C = flag_error "C", E = "E", B = belum ada dokumen)
 *      dan/atau operator (user_created ATAU user_modified dokumen = id operator),
 *   3. memotong sesuai page/per_page yang diminta tabel,
 *   4. mengembalikannya sebagai respons XHR biasa (meta.total ikut disesuaikan),
 * sehingga tabel, paginasi, dan tombol bawaan aplikasi tetap dipakai apa adanya.
 *
 * Filter dibaca dari sessionStorage (ditulis sample-filter.js):
 *   "spdtSF"   = status C | E | B   (kosong = semua)
 *   "spdtSFop" = id user operator   (kosong = semua)
 * Filter tidak aktif → permintaan diteruskan ke server tanpa perubahan.
 *
 * Untuk SETIAP respons tabel (disaring maupun asli) hook mengirim
 * {__spdtSFRows} berisi user_created/user_modified per baris, dipakai
 * sample-filter.js untuk mengisi kolom "Operator".
 */
(function () {
  "use strict";
  if (window.__spdtSFHook) return;
  window.__spdtSFHook = 1;

  var TTL = 120000; // cache 2 menit; tombol "Muat ulang" mengosongkan
  var cache = {};
  var H = { accept: "application/json", "x-requested-with": "XMLHttpRequest" };
  // penanda "muat ulang" tak terlihat dari sample-filter.js (U+200B/C/D, U+2060), mentah atau ter-encode
  var ZW = /%E2%80%8[BCD]|%E2%81%A0|[\u200B-\u200D\u2060]/gi;
  var TABLE_URL = /^(https:\/\/spdtntp\.web\.bps\.go\.id)?\/api\/sample\?/;

  function filters() {
    var st = "", op = "";
    try {
      st = sessionStorage.getItem("spdtSF") || "";
      op = sessionStorage.getItem("spdtSFop") || "";
    } catch (e) {}
    return { st: /^[CEB]$/.test(st) ? st : "", op: /^\d+$/.test(op) ? op : "" };
  }

  function docOf(s, kd) {
    return s.dokumen && s.dokumen.kd_kuesioner === kd ? s.dokumen
      : (s.dokumens || []).find(function (x) { return x.kd_kuesioner === kd; }) || null;
  }

  function statusOf(d) {
    if (!d) return "B";
    return d.flag_error === "C" ? "C" : d.flag_error === "E" ? "E" : "B";
  }

  function loadAll(fc, kd, search) {
    var k = fc + "|" + kd + "|" + search;
    var c = cache[k];
    if (c && Date.now() - c.t < TTL) return c.p;
    var p = (async function () {
      var page = 1, last = 1, list = [], lrt = null;
      do {
        var url = "/api/sample?page=" + page + "&full_code=" + encodeURIComponent(fc) +
          "&kd_kuesioner=" + encodeURIComponent(kd) + "&search=" + encodeURIComponent(search) + "&per_page=500";
        var r = await fetch(url, { headers: H, credentials: "include" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        var j = await r.json();
        list = list.concat(j.data || []);
        lrt = j.last_run_time;
        last = (j.meta && j.meta.last_page) || 1;
        page++;
      } while (page <= last && page <= 100);
      list.forEach(function (s) {
        var d = docOf(s, kd);
        s.__st = statusOf(d);
        s.__ops = d ? [d.user_created, d.user_modified].filter(function (x) { return x != null; }).map(String) : [];
      });
      return { list: list, last_run_time: lrt };
    })();
    cache[k] = { t: Date.now(), p: p };
    p.catch(function () { delete cache[k]; });
    return p;
  }

  function post(msg) { window.postMessage(msg, location.origin); }

  function postRows(url, data, all) {
    try {
      var q = new URL(url, location.origin).searchParams;
      var kd = q.get("kd_kuesioner") || "";
      post({
        __spdtSFRows: true,
        all: !!all,
        fc: q.get("full_code") || "",
        rows: (data || []).map(function (s) {
          var d = docOf(s, kd);
          return { id: s.id_sample, nama: s.nama_krt, alamat: s.alamat, uc: d ? d.user_created : null, um: d ? d.user_modified : null };
        }),
      });
    } catch (e) {}
  }

  function def(o, k, v) { Object.defineProperty(o, k, { configurable: true, get: function () { return v; } }); }

  function respond(xhr, text) {
    def(xhr, "readyState", 4);
    def(xhr, "status", 200);
    def(xhr, "statusText", "OK");
    def(xhr, "responseURL", location.origin + xhr.__sfu);
    def(xhr, "responseText", text);
    def(xhr, "response", xhr.responseType === "json" ? JSON.parse(text) : text);
    xhr.getAllResponseHeaders = function () { return "content-type: application/json\r\n"; };
    xhr.getResponseHeader = function (n) { return /^content-type$/i.test(n) ? "application/json" : null; };
    ["readystatechange", "load", "loadend"].forEach(function (t) { xhr.dispatchEvent(new Event(t)); });
  }

  async function serve(xhr, f, sendArgs) {
    try {
      var q = new URL(xhr.__sfu, location.origin).searchParams;
      var fc = q.get("full_code") || "", kd = q.get("kd_kuesioner") || "";
      var search = (q.get("search") || "").trim();
      var per = Math.max(1, parseInt(q.get("per_page"), 10) || 10);
      var page = Math.max(1, parseInt(q.get("page"), 10) || 1);

      var all = await loadAll(fc, kd, search);
      var byOp = function (s) { return !f.op || s.__ops.indexOf(f.op) !== -1; };
      var bySt = function (s) { return !f.st || s.__st === f.st; };

      // jumlah status (dalam filter operator) & jumlah per operator (dalam filter status)
      var counts = { C: 0, E: 0, B: 0 }, ops = {};
      all.list.forEach(function (s) {
        if (byOp(s)) counts[s.__st]++;
        if (bySt(s)) s.__ops.filter(function (v, i, a) { return a.indexOf(v) === i; })
          .forEach(function (id) { ops[id] = (ops[id] || 0) + 1; });
      });
      var rows = all.list.filter(function (s) { return byOp(s) && bySt(s); });

      var total = rows.length;
      var lastPage = Math.max(1, Math.ceil(total / per));
      if (page > lastPage) page = lastPage;
      var start = (page - 1) * per;
      var data = rows.slice(start, start + per);

      respond(xhr, JSON.stringify({
        data: data,
        links: { first: null, last: null, prev: null, next: null },
        meta: {
          current_page: page, from: total ? start + 1 : null, last_page: lastPage, links: [],
          path: location.origin + "/api/sample", per_page: per, to: total ? start + data.length : null, total: total,
        },
        last_run_time: all.last_run_time,
      }));
      postRows(xhr.__sfu, all.list, true); // peta lengkap untuk halaman yang di-cache aplikasi
      postRows(xhr.__sfu, data);
      post({ __spdtSFInfo: true, counts: counts, ops: ops, total: total, st: f.st, op: f.op });
    } catch (e) {
      post({ __spdtSFInfo: true, error: (e && e.message) || String(e) });
      SEND.apply(xhr, sendArgs); // gagal → tampilkan data asli tanpa filter
    }
  }

  var OPEN = XMLHttpRequest.prototype.open, SEND = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) {
    this.__sfm = String(m || "").toUpperCase();
    this.__sfu = String(u || "");
    if (/\/api\/sample\?/.test(this.__sfu) && ZW.test(this.__sfu)) {
      ZW.lastIndex = 0;
      this.__sfu = this.__sfu.replace(ZW, "");
      var args = Array.prototype.slice.call(arguments);
      args[1] = this.__sfu;
      return OPEN.apply(this, args);
    }
    ZW.lastIndex = 0;
    return OPEN.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__sfm === "GET" && TABLE_URL.test(this.__sfu) && /^\/sample\/?$/.test(location.pathname)) {
      if (/^https?:/.test(this.__sfu)) this.__sfu = this.__sfu.replace(location.origin, "");
      var f = filters();
      if (f.st || f.op) { serve(this, f, arguments); return; }
      // tanpa filter: teruskan ke server, tapi kirim info operator per baris ke panel
      var self = this;
      this.addEventListener("loadend", function () {
        if (self.status !== 200) return;
        try { postRows(self.__sfu, JSON.parse(self.responseText).data); } catch (e) {}
      });
    }
    return SEND.apply(this, arguments);
  };

  window.addEventListener("message", function (ev) {
    if (ev.source === window && ev.data && ev.data.__spdtSFClear) cache = {};
  });
})();
