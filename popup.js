/* Pengaturan ekstensi — disimpan di chrome.storage.sync */
const DEFAULTS = {
  autosaveEnabled: true,
  autosaveSeconds: 100,
  commaDecimal: true,
  markerBaris: true,
};

const BOOL_KEYS = ["autosaveEnabled", "commaDecimal", "markerBaris"];
const statusEl = document.getElementById("status");
let statusTimer = null;

function flash() {
  statusEl.classList.add("show");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove("show"), 1200);
}

function save(partial) {
  chrome.storage.sync.set(partial, flash);
}

// Muat nilai tersimpan
chrome.storage.sync.get(DEFAULTS, (v) => {
  BOOL_KEYS.forEach((k) => { document.getElementById(k).checked = !!v[k]; });
  document.getElementById("autosaveSeconds").value = v.autosaveSeconds;
});

// Toggle boolean
BOOL_KEYS.forEach((k) => {
  document.getElementById(k).addEventListener("change", (e) => {
    save({ [k]: e.target.checked });
  });
});

// Durasi (detik)
const secEl = document.getElementById("autosaveSeconds");
function commitSeconds() {
  let n = parseInt(secEl.value, 10);
  if (isNaN(n)) n = DEFAULTS.autosaveSeconds;
  n = Math.min(3600, Math.max(5, n));
  secEl.value = n;
  save({ autosaveSeconds: n });
}
secEl.addEventListener("change", commitSeconds);
secEl.addEventListener("blur", commitSeconds);

// ---- Backup draf dokumen ----
const bkList = document.getElementById("bkList");
const bkRefresh = document.getElementById("bkRefresh");
const bkDownloadAll = document.getElementById("bkDownloadAll");
const bkStatus = document.getElementById("bkStatus");

function setBk(msg, cls) {
  bkStatus.textContent = msg || "";
  bkStatus.className = "rk-status" + (cls ? " " + cls : "");
}

async function bkBridge(cmd, extra) {
  const tabs = await chrome.tabs.query({ url: "https://spdtntp.web.bps.go.id/*" });
  if (!tabs.length) throw new Error("Buka tab SPDT dulu.");
  const tab = tabs.find((t) => t.active) || tabs[0];
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tab.id, Object.assign({ type: "SPDT_BK", cmd }, extra || {}));
  } catch (e) {
    throw new Error("Tidak terhubung ke tab SPDT. Refresh tab SPDT lalu coba lagi.");
  }
  if (!resp || !resp.ok) throw new Error((resp && resp.error) || "Gagal.");
  return resp;
}

function fmtTime(ms) {
  try {
    return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jayapura", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  } catch (e) { return ""; }
}

function downloadJson(text, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

function bkFileName(m) {
  return "spdt_backup_" + (m.encrypted_id || m.id_dokumen) + "_K" + (m.kd_kuesioner || "") + "_" +
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
}

async function downloadOne(key) {
  setBk("Menyiapkan…");
  const r = await bkBridge("get", { key });
  if (!r.rec) { setBk("Cadangan tidak ada.", "err"); return; }
  downloadJson(r.rec.body, bkFileName(r.rec.meta));
  setBk("Terunduh.", "ok");
}

async function deleteOne(key) {
  await bkBridge("delete", { key });
  await refreshBackups();
}

function renderBackups(items, activeEnc) {
  if (!items || !items.length) { bkList.innerHTML = '<tbody><tr><td style="text-align:left;color:#a1a1aa">Belum ada cadangan. Buka dokumen & klik Simpan.</td></tr></tbody>'; return; }
  const rows = items.map((it) => {
    const m = it.meta || {};
    const act = (activeEnc && m.encrypted_id === activeEnc) ? ' style="background:rgba(250,204,21,.12)"' : "";
    const st = it.status === 200 ? "" : (it.status ? ' · <span class="c-err">gagal</span>' : "");
    const label = (m.kab || m.full_code || "") + " · " + (m.nurt || "") + "<br><span style=\"color:#a1a1aa\">" + (m.nama_krt || "") + " · K" + (m.kd_kuesioner || "") + " · " + fmtTime(it.at) + st + "</span>";
    return "<tr" + act + "><td style=\"text-align:left\">" + label + "</td>" +
      "<td><button class=\"bk-dl\" data-key=\"" + it.key + "\" style=\"cursor:pointer;background:#facc15;border:0;border-radius:5px;padding:3px 7px;font-weight:700\">⬇</button> " +
      "<button class=\"bk-del\" data-key=\"" + it.key + "\" style=\"cursor:pointer;background:#3f3f46;color:#f4f4f5;border:0;border-radius:5px;padding:3px 7px\">✕</button></td></tr>";
  }).join("");
  bkList.innerHTML = "<tbody>" + rows + "</tbody>";
  bkList.querySelectorAll(".bk-dl").forEach((b) => b.addEventListener("click", () => downloadOne(b.dataset.key).catch((e) => setBk("Gagal: " + e.message, "err"))));
  bkList.querySelectorAll(".bk-del").forEach((b) => b.addEventListener("click", () => deleteOne(b.dataset.key).catch((e) => setBk("Gagal: " + e.message, "err"))));
}

async function refreshBackups() {
  setBk("Memuat…");
  try {
    const r = await bkBridge("list");
    renderBackups(r.items, r.activeEnc);
    setBk(r.items.length ? (r.items.length + " dokumen tercadang") : "", r.items.length ? "ok" : "");
  } catch (e) {
    setBk("Gagal: " + e.message, "err");
    bkList.innerHTML = "";
  }
}

bkRefresh.addEventListener("click", () => refreshBackups());
bkDownloadAll.addEventListener("click", async () => {
  setBk("Menyiapkan…");
  try {
    const r = await bkBridge("getAll");
    if (!r.recs || !r.recs.length) { setBk("Belum ada cadangan.", "err"); return; }
    const payload = r.recs.map((rec) => ({ meta: rec.meta, at: rec.at, status: rec.status, data: JSON.parse(rec.body) }));
    downloadJson(JSON.stringify(payload, null, 2), "spdt_backup_semua_" + new Date().toISOString().slice(0, 10) + ".json");
    setBk("Terunduh " + r.recs.length + " dokumen.", "ok");
  } catch (e) { setBk("Gagal: " + e.message, "err"); }
});

refreshBackups();

// ---- Rekap (unduh .xls + tally Clean/Error) ----
const rkKabs = document.getElementById("rkKabs");
const rkKd = document.getElementById("rkKd");
const rkSub = document.getElementById("rkSub");
const rkBtn = document.getElementById("rkDownload");
const rkRefresh = document.getElementById("rkRefresh");
const rkStatus = document.getElementById("rkStatus");
const rkCounts = document.getElementById("rkCounts");

function setRk(msg, cls) {
  rkStatus.textContent = msg || "";
  rkStatus.className = "rk-status" + (cls ? " " + cls : "");
}

function currentCodes() { return window.SPDTRekap.parseCodes(rkKabs.value); }

function renderCounts(rows) {
  if (!rows || !rows.length) { rkCounts.innerHTML = ""; return; }
  let tc = 0, te = 0, tb = 0;
  const body = rows.map((r) => {
    tc += r.clean; te += r.error; tb += r.belum;
    return `<tr><td>${r.nama || r.code}</td><td class="c-clean">${r.clean}</td>` +
      `<td class="c-err">${r.error}</td><td>${r.belum}</td></tr>`;
  }).join("");
  rkCounts.innerHTML =
    `<thead><tr><th>Kabupaten</th><th>Clean</th><th>Error</th><th>Belum</th></tr></thead>` +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr><td>TOTAL</td><td class="c-clean">${tc}</td><td class="c-err">${te}</td><td>${tb}</td></tr></tfoot>`;
}

async function refreshCounts() {
  const codes = currentCodes();
  if (!codes.length) { setRk("Isi kode kabupaten dulu.", "err"); return; }
  const kd = (rkKd.value || "08").trim();
  const sub = (rkSub.value || "").trim();
  rkRefresh.disabled = true; rkBtn.disabled = true;
  setRk("Mengambil data…");
  try {
    const rows = await window.SPDTRekap.tally(codes, kd, sub);
    renderCounts(rows);
    setRk("Diperbarui.", "ok");
  } catch (e) {
    setRk("Gagal: " + (e && e.message ? e.message : e), "err");
  } finally {
    rkRefresh.disabled = false; rkBtn.disabled = false;
  }
}

rkRefresh.addEventListener("click", refreshCounts);

rkBtn.addEventListener("click", async () => {
  const codes = currentCodes();
  if (!codes.length) { setRk("Isi kode kabupaten dulu.", "err"); return; }
  const kd = (rkKd.value || "08").trim();
  const sub = (rkSub.value || "").trim();
  rkBtn.disabled = true; rkRefresh.disabled = true;
  setRk("Menyiapkan unduhan…");
  try {
    const res = await window.SPDTRekap.generate(codes, kd, sub);
    setRk(`Terunduh · ${res.selesai} selesai / ${res.total} sampel`, "ok");
  } catch (e) {
    setRk("Gagal: " + (e && e.message ? e.message : e), "err");
  } finally {
    rkBtn.disabled = false; rkRefresh.disabled = false;
  }
});

// simpan kabupaten & kuesioner di memori browser
rkKabs.addEventListener("change", () => chrome.storage.local.set({ rekapKabs: rkKabs.value }));
rkKd.addEventListener("change", () => chrome.storage.local.set({ rekapKd: rkKd.value }));
rkSub.addEventListener("change", () => chrome.storage.local.set({ rekapSub: rkSub.value }));

// muat nilai tersimpan; jika kabupaten belum ada, ambil default dari /petugas
(async () => {
  const v = await chrome.storage.local.get({ rekapKabs: "", rekapKd: "08", rekapSub: "" });
  rkKd.value = v.rekapKd || "08";
  rkSub.value = v.rekapSub || "";
  if (v.rekapKabs && v.rekapKabs.trim()) {
    rkKabs.value = v.rekapKabs;
  } else {
    setRk("Mengambil kabupaten default…");
    rkKabs.value = await window.SPDTRekap.defaultKabs();
    chrome.storage.local.set({ rekapKabs: rkKabs.value });
    setRk("");
  }
  refreshCounts(); // tampilkan Clean/Error awal
})();
