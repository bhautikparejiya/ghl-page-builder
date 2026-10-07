/*!
 * PageForge — loader
 * Usage (HighLevel "Custom Code" element):
 *   <div data-gpb-page="PAGE_ID"></div>
 *   <script src="https://YOUR-APP.vercel.app/loader.js" async></script>
 * Renders the published page inside Shadow DOM (default) so its styles never clash with the funnel,
 * or inline when the page is set to "inline" embed mode. Only the widget scripts the page uses are loaded.
 */
(function () {
  if (window.__gpbLoader) return window.__gpbLoader.scan();
  var cs = document.currentScript;
  var base = cs ? new URL(cs.src, location.href).origin : "";
  var scripts = {};

  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = src;
        s.async = false;
        s.onload = s.onerror = function () {
          resolve();
        };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  /** Core first (it defines window.GPB), then the page's widget modules in parallel. */
  function loadRuntime(modules) {
    var core = window.GPB && window.GPB.define ? Promise.resolve() : loadScript(base + "/runtime/core.js");
    return core.then(function () {
      return Promise.all(
        (modules || []).map(function (m) {
          return loadScript(base + "/runtime/m/" + encodeURIComponent(m) + ".js");
        })
      );
    });
  }

  function addHeadLink(href, attr) {
    if (!href || document.querySelector("link[" + attr + '="' + href + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.setAttribute(attr, href);
    document.head.appendChild(l);
  }

  function cssLinks(modules) {
    return ['<link rel="stylesheet" href="' + base + '/runtime/core.css">']
      .concat(
        (modules || []).map(function (m) {
          return '<link rel="stylesheet" href="' + base + "/runtime/m/" + encodeURIComponent(m) + '.css">';
        })
      )
      .join("");
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
        addHeadLink(p.fontUrl, "data-gpb-font");
        var inline = p.embedMode === "inline" || !host.attachShadow;
        var root = inline ? host : host.shadowRoot || host.attachShadow({ mode: "open" });
        root.innerHTML =
          "<style>.gpb-root{visibility:hidden}</style>" +
          cssLinks(p.modules) +
          "<style>" + p.css + "</style>" +
          '<div class="gpb-root">' + p.html + "</div>";
        runScripts(root);
        loadRuntime(p.modules).then(function () {
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
