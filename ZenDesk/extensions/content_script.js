// content_script.js
// Listen for input events and replace shortcodes like /email with saved text from chrome.storage
// This is a simple approach: on input blur or space it checks for shortcode at the end.

function replaceShortcodesInElement(el, shortcuts) {
  // Only text inputs and textareas
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return;
  const val = el.value || el.innerText;
  if (!val) return;
  const tokens = val.split(/\s/);
  const last = tokens[tokens.length - 1];
  if (shortcuts[last]) {
    tokens[tokens.length - 1] = shortcuts[last];
    const newVal = tokens.join(" ");
    if (el.value !== undefined) el.value = newVal;
    else el.innerText = newVal;
    // trigger events so page knows value changed
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Load shortcuts and attach input listeners
chrome.storage.local.get(["shortcuts"], (res) => {
  const shortcuts = res.shortcuts || { "/email": "you@example.com", "/addr": "123 Main Street" };

  document.addEventListener("keydown", (e) => {
    // Check for space or enter to trigger replace
    if (e.key === " " || e.key === "Enter") {
      const el = document.activeElement;
      replaceShortcodesInElement(el, shortcuts);
    }
  });

  // Also handle blur (user leaves input)
  document.addEventListener("focusout", (e) => {
    replaceShortcodesInElement(e.target, shortcuts);
  });
});
