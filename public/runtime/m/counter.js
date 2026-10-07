/* PageForge runtime module: counter */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("counter", function (el) {
    var num = el.querySelector(".gpb-counter-num") || el;
    var raw = attr(el, "data-target", "100");
    var target = parseFloat(raw) || 0;
    var decimals = (raw.split(".")[1] || "").length;
    var fmt = function (v) {
      return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };
    if (EDITOR) {
      num.textContent = fmt(target);
      return;
    }
    var duration = parseInt(attr(el, "data-duration", "2000"), 10);
    num.textContent = fmt(0);
    inView(el, function () {
      var start = performance.now();
      (function tick(now) {
        var p = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        num.textContent = fmt(target * eased);
        if (p < 1) setTimeout(function () { tick(performance.now()); }, 16);
      })(start);
    });
  });
})(window.GPB);
