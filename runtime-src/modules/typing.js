/* PageForge runtime module: typing */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("typing", function (el) {
    var target = el.querySelector(".gpb-typing-text");
    if (!target || EDITOR) return;
    var words = attr(el, "data-words", "").split("|").filter(Boolean);
    if (!words.length) return;
    var w = 0,
      i = words[0].length,
      deleting = true;
    target.textContent = words[0];
    setTimeout(function loop() {
      var word = words[w];
      i += deleting ? -1 : 1;
      target.textContent = word.slice(0, i);
      var delay = deleting ? 45 : 90;
      if (!deleting && i >= word.length) {
        deleting = true;
        delay = 1600;
      } else if (deleting && i <= 0) {
        deleting = false;
        w = (w + 1) % words.length;
        word = words[w];
        delay = 300;
      }
      setTimeout(loop, delay);
    }, 1800);
  });
})(window.GPB);
