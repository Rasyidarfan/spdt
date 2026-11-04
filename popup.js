/* Pengaturan ekstensi — disimpan di chrome.storage.sync */
const DEFAULTS = {
  autosaveEnabled: true,
  autosaveSeconds: 100,
  enterNav: true,
  commaDecimal: true,
  freeze: true,
};

const BOOL_KEYS = ["autosaveEnabled", "enterNav", "commaDecimal", "freeze"];
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

// ---- Rekap (unduh .xls + tally Clean/Error) ----
const rkKabs = document.getElementById("rkKabs");
const rkKd = document.getElementById("rkKd");
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
  rkRefresh.disabled = true; rkBtn.disabled = true;
  setRk("Mengambil data…");
  try {
    const rows = await window.SPDTRekap.tally(codes, kd, (m) => setRk(m));
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
  rkBtn.disabled = true; rkRefresh.disabled = true;
  setRk("Menyiapkan unduhan…");
  try {
    const res = await window.SPDTRekap.generate(codes, kd, (m) => setRk(m));
    setRk(`Terunduh · ${res.operator} operator · ${res.selesai} selesai`, "ok");
  } catch (e) {
    setRk("Gagal: " + (e && e.message ? e.message : e), "err");
  } finally {
    rkBtn.disabled = false; rkRefresh.disabled = false;
  }
});

// simpan kabupaten & kuesioner di memori browser
rkKabs.addEventListener("change", () => chrome.storage.local.set({ rekapKabs: rkKabs.value }));
rkKd.addEventListener("change", () => chrome.storage.local.set({ rekapKd: rkKd.value }));

// muat nilai tersimpan; jika kabupaten belum ada, ambil default dari /petugas
(async () => {
  const v = await chrome.storage.local.get({ rekapKabs: "", rekapKd: "08" });
  rkKd.value = v.rekapKd || "08";
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
