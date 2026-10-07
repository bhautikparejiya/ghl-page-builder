/* PageForge runtime module: pricing */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("pricing", function (el) {
    if (EDITOR) return;
    var input = el.querySelector(".gpb-price-switch input");
    function apply() {
      var yearly = !!(input && input.checked);
      all(el, "[data-monthly]").forEach(function (p) {
        p.textContent = p.getAttribute(yearly ? "data-yearly" : "data-monthly") || p.textContent;
      });
      el.classList.toggle("is-yearly", yearly);
    }
    if (input) input.addEventListener("change", apply);
    apply();
  });
})(window.GPB);
