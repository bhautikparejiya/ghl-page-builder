/* PageForge runtime module: carousel */
(function (G) {
  var u = G.u, all = u.all, attr = u.attr, inView = u.inView, store = u.store, closest = u.closest, EDITOR = u.EDITOR;
  G.define("carousel", function (el) {
    var track = el.querySelector(".gpb-car-track");
    if (!track) return;
    // Legacy carousels set slides per view with an attribute; newer ones use per-device CSS.
    if (el.hasAttribute("data-per-view")) el.style.setProperty("--gpb-pv", attr(el, "data-per-view", "1"));
    function slides() {
      return all(track, ".gpb-car-slide");
    }
    function step() {
      var s = slides();
      return s.length > 1 ? s[1].offsetLeft - s[0].offsetLeft : track.clientWidth;
    }
    function go(dir) {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (dir > 0 && track.scrollLeft >= max) track.scrollTo({ left: 0, behavior: "smooth" });
      else if (dir < 0 && track.scrollLeft <= 2) track.scrollTo({ left: max, behavior: "smooth" });
      else track.scrollBy({ left: dir * step(), behavior: "smooth" });
    }
    el.addEventListener("click", function (e) {
      if (closest(e.target, ".gpb-car-prev", el)) {
        e.preventDefault();
        go(-1);
      } else if (closest(e.target, ".gpb-car-next", el)) {
        e.preventDefault();
        go(1);
      }
    });
    if (EDITOR) return;

    var dotsWrap = el.querySelector(".gpb-car-dots");
    if (dotsWrap) {
      dotsWrap.innerHTML = "";
      slides().forEach(function (s, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Go to slide " + (i + 1));
        b.addEventListener("click", function () {
          track.scrollTo({ left: s.offsetLeft - slides()[0].offsetLeft, behavior: "smooth" });
        });
        dotsWrap.appendChild(b);
      });
      var sync = function () {
        var i = Math.round(track.scrollLeft / (step() || 1));
        all(dotsWrap, "button").forEach(function (b, j) {
          b.classList.toggle("is-active", i === j);
        });
      };
      track.addEventListener("scroll", sync, { passive: true });
      sync();
    }

    var ms = parseInt(attr(el, "data-autoplay", "0"), 10);
    if (ms > 0) {
      var paused = false;
      el.addEventListener("mouseenter", function () {
        paused = true;
      });
      el.addEventListener("mouseleave", function () {
        paused = false;
      });
      setInterval(function () {
        if (!paused && !document.hidden) go(1);
      }, Math.max(1500, ms));
    }
  });
})(window.GPB);
