/*!
 * PageForge — loader
 * Usage (HighLevel "Custom Code" element):
 *   <div data-gpb-page="PAGE_ID"></div>
 *   <script src="https://YOUR-APP.vercel.app/loader.js" async></script>
 * Renders the published page inside Shadow DOM so its styles never clash with the funnel.
 */
(function () {
  if (window.__gpbLoader) return window.__gpbLoader.scan();
  var cs = document.currentScript;
  var base = cs ? new URL(cs.src, location.href).origin : "";
  var queue = [];

  function withRuntime(cb) {
    if (window.GPB && window.GPB.init) return cb();
    queue.push(cb);
    if (document.querySelector("script[data-gpb-runtime]")) return;
    var s = document.createElement("script");
    s.src = base + "/runtime.js";
    s.async = true;
    s.setAttribute("data-gpb-runtime", "");
    s.onload = function () {
      queue.splice(0).forEach(function (fn) {
        fn();
      });
    };
    document.head.appendChild(s);
  }

  function addFont(href) {
    if (!href || document.querySelector('link[data-gpb-font="' + href + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.setAttribute("data-gpb-font", href);
    document.head.appendChild(l);
  }

  function runScripts(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".gpb-root script"), function (old) {
      var s = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (a) {
        s.setAttribute(a.name, a.value);
      });
      s.text = old.text;
      old.parentNode.replaceChild(s, old);
    });
  }

  function mount(host) {
    if (host.__gpbMounted) return;
    host.__gpbMounted = true;
    var id = host.getAttribute("data-gpb-page");
    host.style.display = "block";
    host.style.width = "100%";
    fetch(base + "/api/public/pages/" + encodeURIComponent(id))
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (p) {
        addFont(p.fontUrl);
        var root = host.attachShadow ? host.shadowRoot || host.attachShadow({ mode: "open" }) : host;
        root.innerHTML =
          "<style>.gpb-root{visibility:hidden}</style>" +
          '<link rel="stylesheet" href="' + base + '/runtime.css">' +
          "<style>" + p.css + "</style>" +
          '<div class="gpb-root">' + p.html + "</div>";
        runScripts(root);
        withRuntime(function () {
          window.GPB.init(root, { api: base, pageId: id });
        });
      })
      .catch(function (err) {
        console.warn("[PageForge] Could not load page " + id + ":", err.message);
      });
  }

  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-gpb-page]"), mount);
  }

  window.__gpbLoader = { scan: scan };
  scan();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  // Funnel builders sometimes render custom code late — watch briefly for new containers.
  if ("MutationObserver" in window) {
    var mo = new MutationObserver(scan);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
      mo.disconnect();
    }, 15000);
  }
})();
