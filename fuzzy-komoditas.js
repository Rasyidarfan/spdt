/*
 * SPDT - Toggle fuzzy search dropdown komoditas (isolated world)
 * Meneruskan pengaturan "fuzzyKomoditas" dari chrome.storage ke
 * fuzzy-komoditas-hook.js (MAIN world) lewat atribut <html data-spdt-fuzzy>.
 */
(function () {
  "use strict";
  function set(on) { document.documentElement.setAttribute("data-spdt-fuzzy", on ? "1" : "0"); }
  try {
    chrome.storage.sync.get({ fuzzyKomoditas: true }, function (v) { set(v.fuzzyKomoditas); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === "sync" && "fuzzyKomoditas" in ch) set(ch.fuzzyKomoditas.newValue);
    });
  } catch (e) { set(true); }
})();
