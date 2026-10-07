/* PageForge runtime module: before-after */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("before-after", function (el) {
    el.style.setProperty("--pos", attr(el, "data-start", "50") + "%");
    var dragging = false;
    function move(e) {
      var r = el.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      el.style.setProperty("--pos", Math.max(0, Math.min(100, (x / r.width) * 100)) + "%");
    }
    el.addEventListener("pointerdown", function (e) {
      if (EDITOR && !closest(e.target, ".gpb-ba-handle", el)) return;
      dragging = true;
      move(e);
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", function (e) {
      if (dragging) move(e);
    });
    el.addEventListener("pointerup", function () {
      dragging = false;
    });
    el.addEventListener("pointercancel", function () {
      dragging = false;
    });
  });
})(window.GPB);
