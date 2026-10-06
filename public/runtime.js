/*!
 * Page Builder Pro — widget runtime
 * Powers interactive widgets on published pages (inside Shadow DOM via loader.js, or standalone /p/:id)
 * and inside the editor canvas (loaded as runtime.js?editor=1).
 */
(function () {
  if (window.GPB && window.GPB.__v) return;

  var cs = document.currentScript;
  var EDITOR = !!(cs && /[?&]editor=1/.test(cs.src));

  function all(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }
  function once(el, key) {
    el.__gpb = el.__gpb || {};
    if (el.__gpb[key]) return false;
    el.__gpb[key] = true;
    return true;
  }
  function attr(el, name, def) {
    var v = el.getAttribute(name);
    return v == null || v === "" ? def : v;
  }
  /** Calls cb once when el enters the viewport (IntersectionObserver + scroll/geometry fallback). */
  function inView(el, cb) {
    var done = false;
    var io = null;
    function cleanup() {
      if (io) io.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    }
    function fire() {
      if (done) return;
      done = true;
      cleanup();
      cb();
    }
    function check() {
      var r = el.getBoundingClientRect();
      var h = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < h * 0.92 && r.bottom > 0) fire();
    }
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) fire();
          });
        },
        { threshold: 0.15 }
      );
      io.observe(el);
    }
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    setTimeout(check, 60);
  }
  function store(kind) {
    try {
      return window[kind];
    } catch (e) {
      return null;
    }
  }
  function closest(target, sel, within) {
    var el = target && target.closest ? target.closest(sel) : null;
    return el && within.contains(el) ? el : null;
  }

  /* ───────────────────────── widgets ───────────────────────── */
  var widgets = {
    tabs: function (el) {
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
    },

    accordion: function (el) {
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
    },

    counter: function (el) {
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
    },

    countdown: function (el, ctx, index) {
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
        var url = attr(el, "data-expired-redirect", "");
        if (expired && url && !EDITOR && !redirected) {
          redirected = true;
          window.location.href = url;
        }
      }
      tick();
      setInterval(tick, 1000);
    },

    "before-after": function (el) {
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
    },

    carousel: function (el) {
      var track = el.querySelector(".gpb-car-track");
      if (!track) return;
      el.style.setProperty("--gpb-pv", attr(el, "data-per-view", "1"));
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
    },

    pricing: function (el) {
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
    },

    progress: function (el) {
      var bar = el.querySelector(".gpb-progress-bar");
      if (!bar) return;
      var v = Math.max(0, Math.min(100, parseFloat(attr(el, "data-value", "75")))) + "%";
      if (EDITOR) {
        bar.style.width = v;
        return;
      }
      inView(el, function () {
        bar.style.width = v;
      });
    },

    typing: function (el) {
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
    },

    modal: function (el, ctx) {
      if (EDITOR) return;
      var ss = store("sessionStorage");
      var key = "gpb-modal-" + (ctx.pageId || "") + "-" + el.id;
      function autoOpen() {
        if (attr(el, "data-once", "true") === "true") {
          if (ss && ss.getItem(key)) return;
          try {
            ss && ss.setItem(key, "1");
          } catch (e) {}
        }
        openModal(el);
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
    },

    navbar: function (el) {
      el.addEventListener("click", function (e) {
        if (closest(e.target, ".gpb-nav-toggle", el)) {
          e.preventDefault();
          el.classList.toggle("is-open");
        } else if (closest(e.target, ".gpb-nav-links a", el)) {
          el.classList.remove("is-open");
        }
      });
    },

    marquee: function (el) {
      var track = el.querySelector(".gpb-marquee-track");
      if (!track || EDITOR) return;
      all(track, ":scope > *").forEach(function (c) {
        var clone = c.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
      el.classList.add("is-running");
    },
  };

  function openModal(m) {
    if (!m) return;
    m.classList.add("is-open");
  }
  function closeModal(m) {
    if (m) m.classList.remove("is-open");
  }

  /* ──────────────────── entrance animations ──────────────────── */
  function animate(el) {
    if (EDITOR || !once(el, "anim")) return;
    el.classList.add("gpb-anim-ready");
    inView(el, function () {
      setTimeout(function () {
        el.classList.add("gpb-anim-in");
      }, parseInt(attr(el, "data-gpb-delay", "0"), 10));
    });
  }

  /* ──────────────────────── lead forms ──────────────────────── */
  function form(f, ctx) {
    if (!once(f, "form")) return;
    var started = Date.now();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (EDITOR) return;
      var msg = f.querySelector(".gpb-form-msg");
      var btn = f.querySelector("[type=submit]");
      var fields = {};
      var hp = "";
      new FormData(f).forEach(function (v, k) {
        if (k === "_hp") hp = String(v);
        else if (typeof v === "string") fields[k] = fields[k] ? fields[k] + ", " + v : v;
      });
      var label = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending…";
      }
      function done(text, ok) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = label;
        }
        if (msg) {
          msg.textContent = text;
          msg.className = "gpb-form-msg " + (ok ? "is-success" : "is-error");
        }
      }
      fetch(ctx.api + "/api/public/forms", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          pageId: ctx.pageId,
          formId: f.getAttribute("data-gpb-form"),
          fields: fields,
          hp: hp,
          t: Date.now() - started,
        }),
      })
        .then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, d: d };
          });
        })
        .then(function (res) {
          if (!res.ok) return done(res.d.error || "Something went wrong. Please try again.", false);
          try {
            window.dispatchEvent(new CustomEvent("gpb:lead", { detail: { formId: f.getAttribute("data-gpb-form") } }));
            if (window.dataLayer) window.dataLayer.push({ event: "gpb_lead", formId: f.getAttribute("data-gpb-form") });
          } catch (err) {}
          if (res.d.redirectUrl) {
            window.location.href = res.d.redirectUrl;
            return;
          }
          f.reset();
          done(res.d.message, true);
        })
        .catch(function () {
          done("Network error. Please try again.", false);
        });
    });
  }

  /* ───────────────────────── bootstrap ───────────────────────── */
  function initAll(root, ctx) {
    all(root, "[data-gpb]").forEach(function (el, i) {
      var type = el.getAttribute("data-gpb");
      if (widgets[type] && once(el, "w")) {
        try {
          widgets[type](el, ctx, i);
        } catch (err) {
          console.warn("[PageBuilderPro] widget error", type, err);
        }
      }
    });
    all(root, '[data-gpb-anim]:not([data-gpb-anim=""])').forEach(animate);
    all(root, "form[data-gpb-form]").forEach(function (f) {
      form(f, ctx);
    });
  }

  function bindRoot(root) {
    if (!once(root, "root")) return;
    root.addEventListener("click", function (e) {
      var t = e.target;
      var opener = t.closest && t.closest('[data-gpb-open]:not([data-gpb-open=""])');
      if (opener && !EDITOR) {
        e.preventDefault();
        var id = opener.getAttribute("data-gpb-open").replace(/^#/, "");
        openModal(root.querySelector("#" + (window.CSS && CSS.escape ? CSS.escape(id) : id)));
        return;
      }
      var modal = t.closest && t.closest(".gpb-modal");
      if (modal && !EDITOR && (t === modal || (t.closest && t.closest(".gpb-modal-close")))) {
        e.preventDefault();
        closeModal(modal);
        return;
      }
      var a = t.closest && t.closest('a[href^="#"]');
      if (a && !EDITOR) {
        var href = a.getAttribute("href");
        if (href.length > 1) {
          var target = null;
          try {
            target = root.querySelector(href);
          } catch (err) {}
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") all(root, ".gpb-modal.is-open").forEach(closeModal);
    });
  }

  function init(root, opts) {
    opts = opts || {};
    root = root || document;
    var ctx = { api: opts.api || "", pageId: opts.pageId || "", root: root };
    bindRoot(root);
    initAll(root, ctx);
    if (opts.observe && "MutationObserver" in window) {
      var timer;
      new MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          initAll(root, ctx);
        }, 120);
      }).observe(root.body || root, { childList: true, subtree: true });
    }
  }

  window.GPB = { __v: 1, init: init, open: openModal, editor: EDITOR };

  if (EDITOR) {
    var boot = function () {
      document.body.classList.add("gpb-root", "gpb-editor");
      init(document, { observe: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
