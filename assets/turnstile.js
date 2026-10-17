/* Bot protection for the forms on this site: Cloudflare Turnstile, rendered
   invisibly ('interaction-only'), plus the time the form has been on screen.
   Usage: var g = BotGuard(emptyDivInsideForm); ... token = await g.wait(); g.ms(); g.reset(); */
(function () {
  if (typeof window === "undefined") return;
  var SITEKEY = "0x4AAAAAAFZJWkXyld4s97kl";
  var loading = null;
  function load() {
    if (window.turnstile) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (res) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = function () { res(); }; s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function Guard(el) {
    var g = this; g.t0 = Date.now(); g.token = ""; g.id = null; g.on = !!(SITEKEY && el);
    if (!g.on) return;
    load().then(function () {
      if (!window.turnstile) { g.on = false; return; }
      try {
        g.id = window.turnstile.render(el, {
          sitekey: SITEKEY, appearance: "interaction-only",
          callback: function (t) { g.token = t; },
          "expired-callback": function () { g.token = ""; },
          "error-callback": function () { g.token = ""; }
        });
      } catch (e) { g.on = false; }
    });
  }
  Guard.prototype.ms = function () { return Date.now() - this.t0; };
  Guard.prototype.wait = function () {
    var g = this, end = Date.now() + 8000;
    return new Promise(function (res) {
      (function poll() { if (g.token || !g.on || Date.now() >= end) return res(g.token); setTimeout(poll, 200); })();
    });
  };
  Guard.prototype.reset = function () {
    this.token = "";
    try { if (window.turnstile && this.id != null) window.turnstile.reset(this.id); } catch (e) {}
  };
  window.BotGuard = function (el) { return new Guard(el); };
  window.BotGuard.MSG = "We could not confirm this was sent by a person. Please refresh the page and try again.";
})();
