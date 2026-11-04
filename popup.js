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

// ---- Rekap (unduh .xls) ----
const KAB_NAMES = { "9702": "JAYAWIJAYA", "9705": "MAMBERAMO TENGAH", "9706": "YALIMO" };
const rkBtn = document.getElementById("rkDownload");
const rkStatus = document.getElementById("rkStatus");

function setRk(msg, cls) {
  rkStatus.textContent = msg || "";
  rkStatus.className = "rk-status" + (cls ? " " + cls : "");
}

rkBtn.addEventListener("click", async () => {
  const kabs = {};
  document.querySelectorAll(".kab:checked").forEach((c) => { kabs[c.value] = KAB_NAMES[c.value]; });
  if (!Object.keys(kabs).length) { setRk("Pilih minimal satu kabupaten.", "err"); return; }

  const kd = (document.getElementById("rkKd").value || "08").trim();
  const dateFrom = document.getElementById("rkFrom").value;
  const dateTo = document.getElementById("rkTo").value;

  rkBtn.disabled = true;
  setRk("Memulai…");
  try {
    const res = await window.SPDTRekap.generate({
      kabs, kd, dateFrom, dateTo,
      onProgress: (m) => setRk(m),
    });
    setRk(`Terunduh · ${res.operator} operator · ${res.selesai} selesai`, "ok");
  } catch (e) {
    setRk("Gagal: " + (e && e.message ? e.message : e), "err");
  } finally {
    rkBtn.disabled = false;
  }
});
