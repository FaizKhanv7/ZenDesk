// background.js: Core Security & Tab Management Service Worker

// 1. CONSTANTS
const DEFAULT_DISTRACTING_SITES = ["youtube.com", "instagram.com", "tiktok.com", "reddit.com"];
const SAFE_EXCLUDE = ["docs.google.com", "drive.google.com", "mail.google.com"];
const DEFAULT_FOCUS_INTERVAL = 30 * 60 * 1000; // 30 minutes in ms

// 2. GLOBAL VARIABLES
let focusIntervalId = null;

// 3. INITIALIZATION
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    readingList: [],
    focusMode: false,
    focusInterval: DEFAULT_FOCUS_INTERVAL,
    blockedSites: [], // NEW: user-added sites
  });
});

chrome.runtime.onStartup.addListener(async () => {
  const { focusMode, focusInterval } = await chrome.storage.local.get({
    focusMode: false,
    focusInterval: DEFAULT_FOCUS_INTERVAL,
  });
  if (focusMode) startFocusMode(focusInterval);
});

// 4. CORE HELPER FUNCTIONS
async function getAllTabs() {
  return new Promise((resolve) => chrome.tabs.query({}, resolve));
}

// ✅ UPDATED: now includes user-defined blocked sites
async function isDistracting(tab) {
  const url = tab.url;
  if (!url || !url.startsWith("http")) return false;
  if (SAFE_EXCLUDE.some((safe) => url.includes(safe))) return false;

  // Get user’s custom blocked sites
  const res = await chrome.storage.local.get({ blockedSites: [] });
  const userBlocked = res.blockedSites || [];

  // Merge defaults + user list (avoid duplicates)
  const allBlocked = [...new Set([...DEFAULT_DISTRACTING_SITES, ...userBlocked])];

  return allBlocked.some((site) => url.includes(site));
}

async function safeCloseTab(tab) {
  if (tab.audible) {
    console.log(`Skipped audible tab: ${tab.title}`);
    return false;
  }
  try {
    const res = await chrome.storage.local.get({ readingList: [] });
    const list = res.readingList;
    list.push({ url: tab.url, title: tab.title, savedAt: Date.now() });
    await chrome.storage.local.set({ readingList: list });

    await chrome.tabs.remove(tab.id);
    console.log(`Closed and saved tab: ${tab.title}`);
    return true;
  } catch (e) {
    console.error(`Error closing tab ${tab.id}: ${e}`);
    return false;
  }
}

async function closeDuplicateTabs() {
  const tabs = await getAllTabs();
  const seenUrls = new Set();
  const tabsToClose = [];

  for (const tab of tabs) {
    try {
      const url = new URL(tab.url);
      url.hash = "";
      url.search = "";
      const normalizedUrl = url.toString();

      if (seenUrls.has(normalizedUrl)) tabsToClose.push(tab);
      else seenUrls.add(normalizedUrl);
    } catch (e) {}
  }

  let closedCount = 0;
  for (const tab of tabsToClose) {
    const closed = await safeCloseTab(tab);
    if (closed) closedCount++;
  }

  if (closedCount > 0) {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon-128.png",
        title: "Declutter Complete",
        message: `Closed ${closedCount} duplicate tabs.`,
        priority: 1,
      });
    }
  }
  return closedCount;
}

// 5. FOCUS MODE LOOP
async function closeDistractingTabs() {
  const tabs = await getAllTabs();
  let closedCount = 0;

  for (const tab of tabs) {
    if (await isDistracting(tab)) {
      const closed = await safeCloseTab(tab);
      if (closed) closedCount++;
    }
  }

  if (closedCount > 0) {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon-128.png",
        title: "Focus Mode Active",
        message: `Closed ${closedCount} distraction tabs.`,
        priority: 2,
      });
    }
  }

  // Also clean up duplicates each interval
  await closeDuplicateTabs();
}

async function startFocusMode(interval = DEFAULT_FOCUS_INTERVAL) {
  await closeDistractingTabs(); // run immediately

  if (focusIntervalId) clearInterval(focusIntervalId);
  focusIntervalId = setInterval(closeDistractingTabs, interval);
  console.log(`Focus mode running every ${interval / 1000 / 60} minutes`);
}

function stopFocusMode() {
  if (focusIntervalId) clearInterval(focusIntervalId);
  focusIntervalId = null;
}

// 6. REAL-TIME TAB MONITORING
chrome.tabs.onCreated.addListener(async (tab) => {
  const { focusMode } = await chrome.storage.local.get({ focusMode: false });
  if (focusMode && (await isDistracting(tab))) await safeCloseTab(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const { focusMode } = await chrome.storage.local.get({ focusMode: false });
    if (focusMode && (await isDistracting(tab))) await safeCloseTab(tab);
  }
});

// 7. MESSAGE HANDLER
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "activateFocusMode") {
    const interval = msg.interval ?? DEFAULT_FOCUS_INTERVAL;
    chrome.storage.local.set({ focusMode: true, focusInterval: interval }, () => {
      startFocusMode(interval);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === "deactivateFocusMode") {
    chrome.storage.local.set({ focusMode: false }, () => {
      stopFocusMode();
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === "closeDuplicates") {
    closeDuplicateTabs().then((closedCount) => sendResponse({ closed: closedCount }));
    return true;
  }

  if (msg.action === "getReadingList") {
    chrome.storage.local.get({ readingList: [] }, (res) => {
      sendResponse({ readingList: res.readingList });
    });
    return true;
  }
});
