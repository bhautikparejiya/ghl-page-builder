/* PageForge runtime module: accordion */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("accordion", function (el) {
    el.addEventListener("click", function (e) {
      var head = closest(e.target, ".gpb-acc-head", el);
      if (!head) return;
      e.preventDefault();
      var item = head.closest(".gpb-acc-item");
      var open = !item.classList.contains("is-open");
      if (attr(el, "data-single", "true") === "true") {
        all(el, ".gpb-acc-item").forEach(function (i) {
          i.classList.remove("is-open");
        });
      }
      item.classList.toggle("is-open", open);
    });
  });
})(window.GPB);
