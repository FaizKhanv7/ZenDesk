// ===============================
// popup.js: ZenDesk (Simplified Toggle Edition)
// ===============================

const summarizeBtn = document.getElementById("summarize");
const analyzeTabsBtn = document.getElementById("analyze-tabs");
const focusToggleBtn = document.getElementById("focus-toggle");
const results = document.getElementById("results");
const focusTimerEl = document.getElementById("focus-timer");

// ------------------------------
// Helper: show results
// ------------------------------
function showResult(html) { results.innerHTML = html; }

// ------------------------------
// Dummy emails loader
// ------------------------------
async function loadDummyEmails() {
  const resp = await fetch(chrome.runtime.getURL("dummy_emails.json"));
  const data = await resp.json();
  return data.emails;
}

// ------------------------------
// Simple summarizer
// ------------------------------
function summarizeEmails(emails) {
  const unread = emails.filter(e => e.unread);
  const counts = unread.reduce((acc, e) => {
    acc[e.label] = (acc[e.label] || 0) + 1;
    return acc;
  }, {});
  const tldrParts = Object.entries(counts).map(([k, v]) => `${v} ${k}`);
  const tldr = `${unread.length} new emails: ${tldrParts.join(", ")}`;
  const subjects = unread.map(s => s.subject).slice(0, 5).join(" • ");
  return { tldr, subjects, unread };
}

// ------------------------------
// Focus score calculation
// ------------------------------
async function updateFocusScore() {
  const tabs = await chrome.tabs.query({});
  const emails = await loadDummyEmails();
  const unread = emails.filter(e => e.unread).length;
  let score = Math.max(10, 100 - (tabs.length * 5) - (unread * 8));
  console.log(`Focus Score: ${score}`);
}


// ------------------------------
// Focus Mode Toggle
// ------------------------------
focusToggleBtn.addEventListener("click", async () => {
  const { focusMode } = await chrome.storage.local.get({ focusMode: false });

  if (!focusMode) {
    chrome.runtime.sendMessage({ action: "activateFocusMode", interval: 30 * 60 * 1000 }, (r) => {
      if (r?.ok) {
        showResult("<b>Focus Mode Activated</b> — closing distracting tabs.");
        updateFocusButton(true);
        updateFocusScore();
      }
    });
  } else {
    chrome.runtime.sendMessage({ action: "deactivateFocusMode" }, (r) => {
      if (r?.ok) {
        showResult("<b>Focus Mode Deactivated</b>");
        updateFocusButton(false);
        updateFocusScore();
      }
    });
  }
});

function updateFocusButton(isActive) {
  if (isActive) {
    focusToggleBtn.classList.add("active");
    focusToggleBtn.textContent = "🛑 Deactivate Focus Mode";
    document.body.style.backgroundColor = "#d4f7d0"; // green background
  } else {
    focusToggleBtn.classList.remove("active");
    focusToggleBtn.textContent = "🎯 Activate Focus Mode";
    document.body.style.backgroundColor = "#ffd6d6"; // red background
  }
}

// ------------------------------
// Sync button state on popup open
// ------------------------------
chrome.storage.local.get(["focusMode"], ({ focusMode }) => {
  updateFocusButton(focusMode);
});

// ------------------------------
// Summarize Inbox
// ------------------------------
summarizeBtn.addEventListener("click", async () => {
  const emails = await loadDummyEmails();
  const s = summarizeEmails(emails);
  showResult(`<b>TL;DR:</b> ${s.tldr}<br/><i>${s.subjects}</i> <br/><button id="mark-news">Mark newsletters read</button>`);

  document.getElementById("mark-news").addEventListener("click", () => {
    const updated = emails.map(e => e.label === "newsletter" ? { ...e, unread: false } : e);
    showResult(`<b>Marked newsletters read (demo)</b>`);
    updateFocusScore();
  });
  updateFocusScore();
});

// ------------------------------
// Declutter Tabs
// ------------------------------
analyzeTabsBtn.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  const groups = { work: [], learn: [], distract: [], other: [] };
  const workSites = ["notion", "docs.google", "drive.google", "slack", "calendar.google", "figma"];
  const learnSites = ["youtube", "coursera", "edx", "khanacademy", "medium", "wikipedia"];
  const distractSites = ["reddit", "twitter", "x.com", "instagram", "tiktok", "netflix", "discord"];

  for (const tab of tabs) {
    const url = tab.url || "";
    if (workSites.some(s => url.includes(s))) groups.work.push(tab.id);
    else if (learnSites.some(s => url.includes(s))) groups.learn.push(tab.id);
    else if (distractSites.some(s => url.includes(s))) groups.distract.push(tab.id);
    else groups.other.push(tab.id);
  }

  async function createGroup(tabIds, color, title) {
    if (tabIds.length === 0) return;
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { color, title });
  }

  await createGroup(groups.work, "blue", "Work");
  await createGroup(groups.learn, "green", "Learning");
  await createGroup(groups.distract, "red", "Distractions");
  await createGroup(groups.other, "grey", "Other");

  showResult(`
    ✅ Tabs automatically grouped:<br>
    - ${groups.work.length} Work<br>
    - ${groups.learn.length} Learning<br>
    - ${groups.distract.length} Distractions<br>
    - ${groups.other.length} Other
  `);

  updateFocusScore();
});

// ------------------------------
// Custom Blocked Websites
// ------------------------------
function loadBlockedSites() {
  chrome.storage.local.get(["blockedSites"], (res) => {
    const list = res.blockedSites || [];
    const ul = document.getElementById("blocked-list");
    ul.innerHTML = "";

    list.forEach((site, index) => {
      const li = document.createElement("li");
      li.textContent = site;
      li.style.marginBottom = "5px";

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.className = "btn small";
      removeBtn.style.marginLeft = "10px";
      removeBtn.addEventListener("click", () => {
        list.splice(index, 1);
        chrome.storage.local.set({ blockedSites: list }, loadBlockedSites);
      });

      li.appendChild(removeBtn);
      ul.appendChild(li);
    });
  });
}

document.getElementById("add-block").addEventListener("click", () => {
  const input = document.getElementById("block-input");
  const newSite = input.value.trim();
  if (!newSite) return;

  chrome.storage.local.get(["blockedSites"], (res) => {
    const list = res.blockedSites || [];
    if (!list.includes(newSite)) {
      list.push(newSite);
      chrome.storage.local.set({ blockedSites: list }, () => {
        input.value = "";
        loadBlockedSites();
      });
    }
  });
});

// ------------------------------
// Initial load
// ------------------------------
updateFocusScore();
loadBlockedSites();
