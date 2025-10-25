// options.js
const shortcutEl = document.getElementById("shortcut");
const expansionEl = document.getElementById("expansion");
const addBtn = document.getElementById("add");
const listEl = document.getElementById("list");

function refresh() {
  chrome.storage.local.get(["shortcuts"], (res) => {
    const sc = res.shortcuts || {};
    listEl.innerHTML = "";
    Object.entries(sc).forEach(([k,v]) => {
      const li = document.createElement("li");
      li.innerHTML = `${k} → ${v} <button data-key="${k}">Delete</button>`;
      listEl.appendChild(li);
    });
    document.querySelectorAll("button[data-key]").forEach(b => {
      b.addEventListener("click", (e) => {
        const key = e.target.dataset.key;
        chrome.storage.local.get(["shortcuts"], (r) => {
          const s = r.shortcuts || {};
          delete s[key];
          chrome.storage.local.set({ shortcuts: s }, refresh);
        });
      });
    });
  });
}

addBtn.addEventListener("click", () => {
  const key = shortcutEl.value.trim();
  const val = expansionEl.value.trim();
  if (!key || !val) return alert("Provide both fields");
  chrome.storage.local.get(["shortcuts"], (res) => {
    const sc = res.shortcuts || {};
    sc[key] = val;
    chrome.storage.local.set({ shortcuts: sc }, () => {
      shortcutEl.value = ""; expansionEl.value = "";
      refresh();
    });
  });
});

refresh();
