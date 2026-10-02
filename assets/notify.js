// Sends the organiser email alert from the visitor's browser.
// The server saves the entry and returns the alert fields; FormSubmit only
// accepts browser requests from diabesityexpo.com (it blocks server calls).
// keepalive lets the request finish even if the page navigates away.
window.expoNotify = function (fields) {
  if (!fields || typeof fields !== "object") return;
  try {
    fetch("https://formsubmit.co/ajax/oratorkhizer@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.assign({ _template: "table", _captcha: "false" }, fields)),
      keepalive: true,
      mode: "cors",
    }).catch(function () {});
  } catch (e) {}
};
