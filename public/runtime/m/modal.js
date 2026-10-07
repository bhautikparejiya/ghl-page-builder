/* PageForge runtime module: modal (popups) — automatic triggers and how often they show. */
(function (G) {
  var u = G.u, attr = u.attr, store = u.store, EDITOR = u.EDITOR;
  var DAY = 86400000;
  var TTL = { day: DAY, week: 7 * DAY, once: Infinity };

  G.define("modal", function (el, ctx) {
    if (EDITOR) return;
    // Legacy popups only have data-once ("true" = once per session).
    var freq = attr(el, "data-pf-freq", attr(el, "data-once", "true") === "true" ? "session" : "always");
    var key = "pf-pop-" + (ctx.pageId || "") + "-" + el.id;
    var opened = false;

    function seen() {
      if (freq === "session") {
        var ss = store("sessionStorage");
        return !!(ss && ss.getItem(key));
      }
      if (TTL[freq]) {
        var ls = store("localStorage");
        var at = ls && parseInt(ls.getItem(key) || "", 10);
        return !!at && Date.now() - at < TTL[freq];
      }
      return false;
    }
    function remember() {
      try {
        if (freq === "session") store("sessionStorage").setItem(key, "1");
        else if (TTL[freq]) store("localStorage").setItem(key, String(Date.now()));
      } catch (e) {}
    }
    function autoOpen() {
      if (opened || seen()) return;
      opened = true;
      remember();
      G.open(el);
    }

    var delay = parseFloat(attr(el, "data-auto-open", "0"));
    if (delay > 0) setTimeout(autoOpen, delay * 1000);

    if (attr(el, "data-exit-intent", "false") === "true") {
      document.addEventListener("mouseout", function h(e) {
        if (!e.relatedTarget && e.clientY <= 0) {
          document.removeEventListener("mouseout", h);
          autoOpen();
        }
      });
    }

    var pct = parseFloat(attr(el, "data-pf-scroll-open", "0"));
    if (pct > 0) {
      var onScroll = function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        if (max <= 0 || (window.scrollY / max) * 100 >= pct) {
          window.removeEventListener("scroll", onScroll);
          autoOpen();
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    var idle = parseFloat(attr(el, "data-pf-idle", "0"));
    if (idle > 0) {
      var timer;
      var reset = function () {
        clearTimeout(timer);
        timer = setTimeout(autoOpen, idle * 1000);
      };
      ["mousemove", "keydown", "scroll", "touchstart"].forEach(function (ev) {
        window.addEventListener(ev, reset, { passive: true });
      });
      reset();
    }
  });
})(window.GPB);
