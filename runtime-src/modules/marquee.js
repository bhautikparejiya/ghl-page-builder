/* PageForge runtime module: marquee */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("marquee", function (el) {
    var track = el.querySelector(".gpb-marquee-track");
    if (!track || EDITOR) return;
    all(track, ":scope > *").forEach(function (c) {
      var clone = c.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
    el.classList.add("is-running");
  });
})(window.GPB);
