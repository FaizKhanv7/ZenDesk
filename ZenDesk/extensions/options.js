// options.js — Manage QuickText shortcuts

const keyInput = document.getElementById('shortcut-key');
const valueInput = document.getElementById('shortcut-value');
const addButton = document.getElementById('add-shortcut');
const list = document.getElementById('shortcuts-list');
const saveTip = document.getElementById('save-tip');

// Load and display shortcuts
function loadShortcuts() {
  chrome.storage.sync.get({ quicktext: {} }, (data) => {
    const shortcuts = data.quicktext;
    list.innerHTML = '';

    const entries = Object.entries(shortcuts);
    
    if (entries.length === 0) {
      list.innerHTML = '<p style="color: #666; font-style: italic;">No shortcuts yet. Add one below!</p>';
      return;
    }

    for (const [key, val] of entries) {
      const div = document.createElement('div');
      div.className = 'shortcut-item';
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(key)}</strong>: ${escapeHtml(val)}
        </div>
        <button class="delete-btn" data-key="${escapeHtml(key)}">Delete</button>
      `;
      list.appendChild(div);
    }

    // Hook up delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteShortcut(btn.dataset.key));
    });
  });
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add or update shortcut
addButton.addEventListener('click', () => {
  const key = keyInput.value.trim();
  const val = valueInput.value.trim();

  if (!key || !val) {
    alert('Please fill in both fields');
    return;
  }

  if (!key.startsWith('/')) {
    alert('Shortcut must start with "/"');
    return;
  }

  chrome.storage.sync.get({ quicktext: {} }, (data) => {
    const shortcuts = data.quicktext;
    shortcuts[key] = val;
    
    chrome.storage.sync.set({ quicktext: shortcuts }, () => {
      if (chrome.runtime.lastError) {
        alert('Error saving shortcut: ' + chrome.runtime.lastError.message);
        return;
      }
      
      keyInput.value = '';
      valueInput.value = '';
      saveTip.classList.remove('hidden');
      setTimeout(() => saveTip.classList.add('hidden'), 3000);
      loadShortcuts();
    });
  });
});

// Delete shortcut
function deleteShortcut(key) {
  if (!confirm(`Delete shortcut "${key}"?`)) {
    return;
  }

  chrome.storage.sync.get({ quicktext: {} }, (data) => {
    const shortcuts = data.quicktext;
    delete shortcuts[key];
    
    chrome.storage.sync.set({ quicktext: shortcuts }, () => {
      if (chrome.runtime.lastError) {
        alert('Error deleting shortcut: ' + chrome.runtime.lastError.message);
        return;
      }
      loadShortcuts();
    });
  });
}

// Allow Enter key to add shortcut
keyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    valueInput.focus();
  }
});

valueInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addButton.click();
  }
});

// Initial load
loadShortcuts();