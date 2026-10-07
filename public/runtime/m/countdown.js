/* PageForge runtime module: countdown */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("countdown", function (el, ctx, index) {
    var deadline;
    var evergreen = parseInt(attr(el, "data-evergreen", "0"), 10);
    if (evergreen > 0 && !EDITOR) {
      var ls = store("localStorage");
      var key = "gpb-cd-" + (ctx.pageId || "") + "-" + index;
      var saved = ls && parseInt(ls.getItem(key) || "", 10);
      deadline = saved || Date.now() + evergreen * 60000;
      try {
        if (ls && !saved) ls.setItem(key, String(deadline));
      } catch (e) {}
    }
    var parts = {
      d: el.querySelector(".gpb-cd-days"),
      h: el.querySelector(".gpb-cd-hours"),
      m: el.querySelector(".gpb-cd-minutes"),
      s: el.querySelector(".gpb-cd-seconds"),
    };
    var pad = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    var redirected = false;
    function tick() {
      var end = deadline;
      if (!end) {
        end = evergreen > 0 ? Date.now() + evergreen * 60000 : new Date(attr(el, "data-date", "")).getTime();
      }
      var diff = Math.max(0, (end || 0) - Date.now());
      var t = Math.floor(diff / 1000);
      if (parts.d) parts.d.textContent = pad(Math.floor(t / 86400));
      if (parts.h) parts.h.textContent = pad(Math.floor((t % 86400) / 3600));
      if (parts.m) parts.m.textContent = pad(Math.floor((t % 3600) / 60));
      if (parts.s) parts.s.textContent = pad(t % 60);
      var expired = diff <= 0 && !!end;
      el.classList.toggle("is-expired", expired && !EDITOR);
      if (expired && !EDITOR && attr(el, "data-expired-hide", "") === "true") {
        var box = el.closest(".pf-widget") || el;
        box.style.display = "none";
      }
      var url = attr(el, "data-expired-redirect", "");
      if (expired && url && !EDITOR && !redirected) {
        redirected = true;
        window.location.href = url;
      }
    }
    tick();
    setInterval(tick, 1000);
  });
})(window.GPB);
