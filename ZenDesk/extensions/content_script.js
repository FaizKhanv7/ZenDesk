// content_script.js
// Replace shortcodes like /email or /addr with user-defined text stored in chrome.storage.sync

function replaceShortcodesInElement(el, shortcuts) {
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

    // Trigger input event so site reacts to new value
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// --- live shortcut sync ---
let shortcuts = {};

// Load from chrome.storage.sync (shared with options.html)
chrome.storage.sync.get({ quicktext: { "/email": "you@example.com", "/addr": "123 Main Street" } }, (res) => {
  shortcuts = res.quicktext;
});

// Update shortcuts when changed
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.quicktext) {
    shortcuts = changes.quicktext.newValue || {};
    console.log("QuickText updated:", shortcuts);
  }
});

// Replace on space or enter
document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    const el = document.activeElement;
    replaceShortcodesInElement(el, shortcuts);
  }
});

// Replace on blur (when leaving input)
document.addEventListener("focusout", (e) => {
  replaceShortcodesInElement(e.target, shortcuts);
});
