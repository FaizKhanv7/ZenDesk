// ===============================
// popup.js: ZenDesk
// ===============================

const summarizeBtn = document.getElementById("summarize");
const analyzeTabsBtn = document.getElementById("analyze-tabs");
const activateBtn = document.getElementById("activate");
const deactivateBtn = document.getElementById("deactivate");
const results = document.getElementById("results");
const focusScoreEl = document.getElementById("focus-score");
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
  let tldrParts = [];
  for (const [k, v] of Object.entries(counts)) tldrParts.push(`${v} ${k}`);
  const tldr = `${unread.length} new emails: ${tldrParts.join(", ")}`;
  const subjects = unread.map(s => s.subject).slice(0,5).join(" • ");
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
  focusScoreEl.textContent = `Focus Score: ${score}`;
}

// ------------------------------
// Update Focus Mode countdown
// ------------------------------
function updateFocusTime() {
  chrome.storage.local.get(['focusMode', 'focusEndTime'], ({ focusMode, focusEndTime }) => {
    if (!focusMode || !focusEndTime) {
      focusTimerEl.textContent = 'Focus Mode: Off';
      return;
    }
    const timeLeft = Math.max(0, focusEndTime - Date.now());
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    focusTimerEl.textContent = `Focus Mode: ${minutes}:${seconds.toString().padStart(2, '0')} left`;

    // Auto-deactivate if time is up
    if (timeLeft <= 0) {
      focusTimerEl.textContent = 'Focus Mode: Off';
      chrome.runtime.sendMessage({ action: 'deactivateFocusMode' });
    }
  });
}
setInterval(updateFocusTime, 1000);
updateFocusTime();

// ------------------------------
// Button event listeners
// ------------------------------

// Summarize inbox
summarizeBtn.addEventListener("click", async () => {
  const emails = await loadDummyEmails();
  const s = summarizeEmails(emails);
  showResult(`<b>TL;DR:</b> ${s.tldr}<br/><i>${s.subjects}</i> <br/><button id="mark-news">Mark newsletters read</button>`);

  document.getElementById("mark-news").addEventListener("click", () => {
    const updated = emails.map(e => e.label === "newsletter" ? {...e, unread:false} : e);
    showResult(`<b>Marked newsletters read (demo)</b>`);
    updateFocusScore();
  });
  updateFocusScore();
});

// Declutter tabs / analyze
// Declutter tabs / analyze and group
analyzeTabsBtn.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  const groups = {
    work: [],
    learn: [],
    distract: [],
    other: []
  };

  const workSites = ["notion", "docs.google", "drive.google", "slack", "calendar.google", "figma"];
  const learnSites = ["youtube", "coursera", "edx", "khanacademy", "medium", "wikipedia"];
  const distractSites = ["reddit", "twitter", "x.com", "instagram", "tiktok", "netflix", "discord"];

  // Categorize each tab by URL
  for (const tab of tabs) {
    const url = tab.url || "";
    if (workSites.some(s => url.includes(s))) groups.work.push(tab.id);
    else if (learnSites.some(s => url.includes(s))) groups.learn.push(tab.id);
    else if (distractSites.some(s => url.includes(s))) groups.distract.push(tab.id);
    else groups.other.push(tab.id);
  }

  // Function to create a tab group
  async function createGroup(tabIds, color, title) {
    if (tabIds.length === 0) return;
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { color, title });
  }

  // Actually make the groups
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
// Focus Mode buttons
// ------------------------------
activateBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "activateFocusMode", interval: 30 * 60 * 1000 }, (r) => {
    showResult("<b>Focus Mode Activated</b> — closing distracting tabs.");
    updateFocusScore();
  });
});

deactivateBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "deactivateFocusMode" }, (r) => {
    showResult("<b>Focus Mode Deactivated</b>");
    updateFocusScore();
  });
});

// ------------------------------
// Initial load
// ------------------------------
updateFocusScore();
updateFocusTime();

