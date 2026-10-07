/* PageForge runtime module: navbar */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("navbar", function (el) {
    el.addEventListener("click", function (e) {
      if (closest(e.target, ".gpb-nav-toggle", el)) {
        e.preventDefault();
        el.classList.toggle("is-open");
      } else if (closest(e.target, ".gpb-nav-links a", el)) {
        el.classList.remove("is-open");
      }
    });
  });
})(window.GPB);
