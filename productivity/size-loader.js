/* Xeneon Edge — Size Loader
   Reads ?size=m|l|xl from URL and sets data-size on <html>.
   Must be loaded in <head> (before render) to avoid FOUC.     */
(function () {
  "use strict";
  try {
    var s = (new URLSearchParams(location.search).get("size") || "l").toLowerCase();
    if (s !== "m" && s !== "l" && s !== "xl") s = "l";
    document.documentElement.dataset.size = s;
  } catch (_) {
    document.documentElement.dataset.size = "l";
  }
})();
