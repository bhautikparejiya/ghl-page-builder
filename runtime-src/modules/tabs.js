/* PageForge runtime module: tabs */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("tabs", function (el) {
    function show(i) {
      all(el, ".gpb-tab-btn").forEach(function (b, j) {
        b.classList.toggle("is-active", i === j);
      });
      all(el, ".gpb-tab-panel").forEach(function (p, j) {
        p.classList.toggle("is-active", i === j);
      });
    }
    el.addEventListener("click", function (e) {
      var b = closest(e.target, ".gpb-tab-btn", el);
      if (!b) return;
      e.preventDefault();
      show(all(el, ".gpb-tab-btn").indexOf(b));
    });
    var btns = all(el, ".gpb-tab-btn");
    var active = btns.findIndex(function (b) {
      return b.classList.contains("is-active");
    });
    show(active < 0 ? 0 : active);
  });
})(window.GPB);
