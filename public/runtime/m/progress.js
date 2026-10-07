/* PageForge runtime module: progress */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("progress", function (el) {
    var bar = el.querySelector(".gpb-progress-bar");
    if (!bar) return;
    var v = Math.max(0, Math.min(100, parseFloat(attr(el, "data-value", "75")))) + "%";
    if (EDITOR) {
      bar.style.width = v;
      return;
    }
    inView(el, function () {
      bar.style.width = v;
    });
  });
})(window.GPB);
