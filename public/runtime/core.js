/*!
 * PageForge — widget runtime (core)
 * Powers published pages (inside Shadow DOM via loader.js, or standalone hosted pages) and the editor canvas.
 * Interactive widgets live in separate modules that register with GPB.define(); live pages load only the ones they use.
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
  function params() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return { get: function () { return null; }, has: function () { return false; } };
    }
  }
  var cssEscape = function (id) {
    return window.CSS && CSS.escape ? CSS.escape(id) : id;
  };

  /* ───────────────────────── registry ───────────────────────── */
  var widgets = {};
  var roots = [];

  function define(name, fn) {
    widgets[name] = fn;
    // Modules can arrive after the page was initialised.
    roots.forEach(function (r) {
      initWidgets(r.root, r.ctx);
    });
  }

  /* ───────────────────────── popups ───────────────────────── */
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

  /* ──────────────────── {{url.param}} tokens ──────────────────── */
  var TOKEN = /\{\{\s*url\.([\w-]+)(?:\s*\|\s*([^}]*))?\s*\}\}/g;
  function fillTokens(str) {
    var p = params();
    return str.replace(TOKEN, function (_m, key, def) {
      var v = p.get(key);
      return v != null && v !== "" ? v : (def || "").trim();
    });
  }
  function urlTokens(root) {
    if (EDITOR) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.indexOf("{{") >= 0) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      n.nodeValue = fillTokens(n.nodeValue);
    });
    all(root, "a[href*='{{'], input[value*='{{']").forEach(function (el) {
      var a = el.tagName === "A" ? "href" : "value";
      var v = fillTokens(el.getAttribute(a));
      if (a === "href" && /^\s*javascript:/i.test(v)) v = "#";
      el.setAttribute(a, v);
      if (a === "value") el.value = v;
    });
  }

  /* ──────────────────── display conditions ──────────────────── */
  var returning = (function () {
    var ls = store("localStorage");
    var seen = ls && ls.getItem("pf-visited");
    try {
      if (ls && !seen) ls.setItem("pf-visited", String(Date.now()));
    } catch (e) {}
    return !!seen;
  })();

  function conditionMet(c) {
    var now = Date.now();
    if (c.from && now < new Date(c.from).getTime()) return false;
    if (c.to && now > new Date(c.to).getTime()) return false;
    if (c.param) {
      var parts = String(c.param).split("=");
      var v = params().get(parts[0].trim());
      if (v == null) return false;
      if (parts.length > 1 && v.toLowerCase() !== parts.slice(1).join("=").trim().toLowerCase()) return false;
    }
    if (c.visitor === "new" && returning) return false;
    if (c.visitor === "returning" && !returning) return false;
    return true;
  }
  function conditions(root) {
    all(root, "[data-pf-cond]").forEach(function (el) {
      if (!once(el, "cond")) return;
      var ok = true;
      try {
        ok = EDITOR || conditionMet(JSON.parse(el.getAttribute("data-pf-cond")));
      } catch (e) {}
      if (ok) el.classList.add("pf-cond-ok");
    });
  }

  /* ──────────────────── A/B tests ──────────────────── */
  function abTests(root, ctx) {
    var groups = {};
    all(root, "[data-pf-ab]").forEach(function (el) {
      if (EDITOR) return el.classList.add("pf-ab-on");
      var t = el.getAttribute("data-pf-ab");
      (groups[t] = groups[t] || []).push(el);
    });
    var chosen = {};
    Object.keys(groups).forEach(function (t) {
      var els = groups[t];
      if (els.some(function (e) { return e.__gpbAb; })) return;
      var ls = store("localStorage");
      var key = "pf-ab-" + (ctx.pageId || "") + "-" + t;
      var names = els.map(function (e) { return attr(e, "data-pf-variant", "A"); });
      var pick = ls && ls.getItem(key);
      if (!pick || names.indexOf(pick) < 0) {
        pick = names[Math.floor(Math.random() * names.length)];
        try {
          ls && ls.setItem(key, pick);
        } catch (e) {}
      }
      els.forEach(function (e, i) {
        e.__gpbAb = true;
        if (names[i] === pick) e.classList.add("pf-ab-on");
        else e.remove();
      });
      chosen[t] = pick;
    });
    var keys = Object.keys(chosen);
    if (!keys.length) return;
    ctx.ab = Object.assign(ctx.ab || {}, chosen);
    if (ctx.api && ctx.pageId) {
      var body = JSON.stringify({ pageId: ctx.pageId, variants: chosen });
      try {
        if (!(navigator.sendBeacon && navigator.sendBeacon(ctx.api + "/api/public/ab", new Blob([body], { type: "text/plain" })))) {
          fetch(ctx.api + "/api/public/ab", { method: "POST", body: body, keepalive: true });
        }
      } catch (e) {}
    }
  }

  /* ──────────────────── scroll effects ──────────────────── */
  var scrollEls = [];
  var ticking = false;
  function updateScroll() {
    ticking = false;
    var h = window.innerHeight;
    scrollEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      // -1 (below the fold) … 0 (centered) … 1 (above)
      var p = Math.max(-1, Math.min(1, (h / 2 - (r.top + r.height / 2)) / (h / 2 + r.height / 2)));
      var k = parseFloat(attr(el, "data-pf-speed", "4")) / 10;
      var fx = el.getAttribute("data-pf-scroll");
      if (fx === "parallax") el.style.transform = "translate3d(0," + (p * k * 160).toFixed(1) + "px,0)";
      else if (fx === "fade") el.style.opacity = String(Math.max(0, 1 - Math.abs(p) * k * 1.6).toFixed(3));
      else if (fx === "scale") el.style.transform = "scale(" + (1 - Math.max(0, -p) * k * 0.35).toFixed(3) + ")";
    });
  }
  function scrollEffects(root) {
    if (EDITOR || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    all(root, "[data-pf-scroll]").forEach(function (el) {
      if (once(el, "scroll")) scrollEls.push(el);
    });
    if (scrollEls.length && !scrollEffects.bound) {
      scrollEffects.bound = true;
      var onScroll = function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }
    updateScroll();
  }

  /* ──────────────────────── lead forms ──────────────────────── */
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
  // First-touch attribution survives navigating to a second page in the same visit.
  (function () {
    var p = params();
    var ss = store("sessionStorage");
    if (!ss) return;
    var found = {};
    UTM.forEach(function (k) {
      if (p.get(k)) found[k] = p.get(k);
    });
    try {
      if (Object.keys(found).length && !ss.getItem("pf-utm")) ss.setItem("pf-utm", JSON.stringify(found));
    } catch (e) {}
  })();

  function fieldValue(f, name) {
    var els = all(f, '[name="' + name.replace(/"/g, "") + '"]');
    var vals = [];
    els.forEach(function (el) {
      if (el.disabled) return;
      if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
      if (el.value) vals.push(el.value);
    });
    return vals;
  }

  function form(f, ctx) {
    if (!once(f, "form")) return;
    var started = Date.now();
    var msg = f.querySelector(".gpb-form-msg");

    // Hidden fields can copy values from the page URL: {{url.utm_source}}.
    all(f, "input[data-pf-dynamic]").forEach(function (h) {
      h.value = fillTokens(h.value);
    });

    /* Conditional fields */
    var conds = all(f, "[data-show-if]");
    function applyConditions() {
      conds.forEach(function (box) {
        var vals = fieldValue(f, box.getAttribute("data-show-if"));
        var want = (box.getAttribute("data-show-value") || "").trim().toLowerCase();
        var show = EDITOR || (want ? vals.some(function (v) { return v.toLowerCase() === want; }) : vals.length > 0);
        box.classList.toggle("pf-hidden", !show);
        all(box, "input,select,textarea").forEach(function (i) {
          i.disabled = !show;
        });
      });
    }
    if (conds.length) {
      f.addEventListener("input", applyConditions);
      f.addEventListener("change", applyConditions);
      applyConditions();
    }

    /* Steps */
    var steps = all(f, ".pf-form-step");
    var step = 0;
    var back = f.querySelector(".pf-form-back");
    var next = f.querySelector(".pf-form-next");
    var submit = f.querySelector(".pf-form-submit");
    var bar = f.querySelector(".pf-form-progress span");
    function showStep(i) {
      step = i;
      steps.forEach(function (s, j) {
        s.classList.toggle("is-active", j === i);
      });
      if (back) back.hidden = i === 0;
      if (next) next.hidden = i === steps.length - 1;
      if (submit) submit.hidden = i !== steps.length - 1;
      if (bar) bar.style.width = ((i + 1) / steps.length) * 100 + "%";
    }
    function stepValid() {
      var inputs = all(steps[step], "input,select,textarea");
      for (var k = 0; k < inputs.length; k++) {
        if (!inputs[k].disabled && inputs[k].checkValidity && !inputs[k].checkValidity()) {
          inputs[k].reportValidity && inputs[k].reportValidity();
          return false;
        }
      }
      return true;
    }
    if (steps.length > 1 && !EDITOR) {
      showStep(0);
      if (next)
        next.addEventListener("click", function () {
          if (stepValid()) showStep(Math.min(steps.length - 1, step + 1));
        });
      if (back)
        back.addEventListener("click", function () {
          showStep(Math.max(0, step - 1));
        });
    }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (EDITOR) return;
      if (steps.length > 1 && step < steps.length - 1) {
        if (stepValid()) showStep(step + 1);
        return;
      }
      var btn = submit || f.querySelector("[type=submit]");
      var fields = {};
      var hp = "";
      new FormData(f).forEach(function (v, k) {
        if (k === "_hp") hp = String(v);
        else if (typeof v === "string") {
          if (fields[k] === undefined) fields[k] = v;
          else fields[k] = [].concat(fields[k], v);
        }
      });
      if (f.getAttribute("data-utm") === "true") {
        var p = params();
        var first = {};
        try {
          first = JSON.parse((store("sessionStorage") || { getItem: function () { return null; } }).getItem("pf-utm") || "{}");
        } catch (err) {}
        UTM.forEach(function (k) {
          var v = p.get(k) || first[k];
          if (v && !fields[k]) fields[k] = v;
        });
        fields.page_url = window.location.href.split("#")[0];
        if (document.referrer) fields.referrer = document.referrer;
      }
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
          ab: ctx.ab || null,
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
            if (window.fbq) window.fbq("track", "Lead");
          } catch (err) {}
          if (res.d.redirectUrl) {
            window.location.href = res.d.redirectUrl;
            return;
          }
          f.reset();
          if (steps.length > 1) showStep(0);
          done(res.d.message, true);
        })
        .catch(function () {
          done("Network error. Please try again.", false);
        });
    });
  }

  /* ───────────────────────── bootstrap ───────────────────────── */
  function initWidgets(root, ctx) {
    all(root, "[data-gpb]").forEach(function (el, i) {
      var type = el.getAttribute("data-gpb");
      if (widgets[type] && once(el, "w")) {
        try {
          widgets[type](el, ctx, i);
        } catch (err) {
          console.warn("[PageForge] widget error", type, err);
        }
      }
    });
  }

  function initAll(root, ctx) {
    conditions(root);
    abTests(root, ctx);
    urlTokens(root);
    initWidgets(root, ctx);
    all(root, '[data-gpb-anim]:not([data-gpb-anim=""])').forEach(animate);
    all(root, "form[data-gpb-form]").forEach(function (f) {
      form(f, ctx);
    });
    scrollEffects(root);
  }

  function findPopup(root, id) {
    var el = null;
    try {
      el = root.querySelector("#" + cssEscape(id));
    } catch (err) {}
    return el && el.classList.contains("gpb-modal") ? el : null;
  }

  function bindRoot(root) {
    if (!once(root, "root")) return;
    root.addEventListener("click", function (e) {
      var t = e.target;
      var opener = t.closest && t.closest('[data-gpb-open]:not([data-gpb-open=""])');
      if (opener && !EDITOR) {
        e.preventDefault();
        openModal(findPopup(root, opener.getAttribute("data-gpb-open").replace(/^#/, "")));
        return;
      }
      var modal = t.closest && t.closest(".gpb-modal");
      if (modal && !EDITOR) {
        var onOverlay = t === modal && modal.getAttribute("data-pf-overlay-close") !== "false";
        if (onOverlay || (t.closest && t.closest(".gpb-modal-close"))) {
          e.preventDefault();
          closeModal(modal);
          return;
        }
      }
      var a = t.closest && t.closest('a[href^="#"]');
      if (a && !EDITOR) {
        var href = a.getAttribute("href");
        if (href.length > 1) {
          var popup = findPopup(root, href.slice(1));
          if (popup) {
            e.preventDefault();
            openModal(popup);
            return;
          }
          var target = null;
          try {
            target = root.querySelector("#" + cssEscape(href.slice(1)));
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
    var ctx = { api: opts.api || "", pageId: opts.pageId || "", root: root, ab: null };
    roots.push({ root: root, ctx: ctx });
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

  window.GPB = {
    __v: 2,
    init: init,
    define: define,
    open: openModal,
    close: closeModal,
    editor: EDITOR,
    u: { all: all, once: once, attr: attr, inView: inView, store: store, closest: closest, EDITOR: EDITOR },
  };

  if (EDITOR) {
    var boot = function () {
      document.body.classList.add("gpb-root", "gpb-editor");
      init(document, { observe: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
