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
