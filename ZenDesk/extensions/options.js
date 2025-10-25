// options.js — Manage QuickText shortcuts

const form = document.getElementById('shortcut-form');
const keyInput = document.getElementById('key');
const valueInput = document.getElementById('value');
const list = document.getElementById('shortcut-list');

// Load and display shortcuts
function loadShortcuts() {
  chrome.storage.sync.get({ quicktext: {} }, (data) => {
    const shortcuts = data.quicktext;
    list.innerHTML = '';

    for (const [key, val] of Object.entries(shortcuts)) {
      const li = document.createElement('li');
      li.innerHTML = `<b>${key}</b>: ${val} 
        <button class="delete-btn" data-key="${key}">❌</button>`;
      list.appendChild(li);
    }

    // Hook up delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteShortcut(btn.dataset.key));
    });
  });
}

// Add or update shortcut
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const key = keyInput.value.trim();
  const val = valueInput.value.trim();

  if (!key.startsWith('/')) {
    alert('Shortcut must start with "/"');
    return;
  }

  chrome.storage.sync.get({ quicktext: {} }, (data) => {
    const shortcuts = data.quicktext;
    shortcuts[key] = val;
    chrome.storage.sync.set({ quicktext: shortcuts }, () => {
      keyInput.value = '';
      valueInput.value = '';
      loadShortcuts();
    });
  });
});

// Delete shortcut
function deleteShortcut(key) {
  chrome.storage.sync.get({ quicktext: {} }, (data) => {
    const shortcuts = data.quicktext;
    delete shortcuts[key];
    chrome.storage.sync.set({ quicktext: shortcuts }, loadShortcuts);
  });
}

loadShortcuts();
