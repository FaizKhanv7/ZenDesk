// background.js
// Keeps track of reading list and provides tab declutter functions.

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ readingList: [], focusMode: false });
});

// Helper: get all tabs
async function getAllTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => resolve(tabs));
  });
}

// Declutter logic: find duplicate URLs and distracting domains
async function analyzeTabs() {
  const tabs = await getAllTabs();
  const domains = {};
  const duplicates = [];
  const distracting = [];
  tabs.forEach(t => {
    try {
      const url = new URL(t.url);
      const domain = url.hostname.replace('www.', '');
      domains[domain] = (domains[domain] || 0) + 1;
      // naive distraction detection:
      if (domain.includes("twitter.com") || domain.includes("facebook.com") || domain.includes("instagram.com") || domain.includes("tiktok.com") || domain.includes("reddit.com") || domain.includes("youtube.com")) {
        distracting.push({ id: t.id, title: t.title, url: t.url, domain });
      }
    } catch (e) {}
  });
  // duplicates: domains with count>1
  for (const [domain, count] of Object.entries(domains)) {
    if (count > 1) duplicates.push(domain);
  }
  return { tabCount: tabs.length, duplicates, distracting, tabs };
}

// Save reading list: close tab and save metadata
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "analyzeTabs") {
    analyzeTabs().then(result => sendResponse({ result }));
    return true;
  }
  if (msg.action === "saveToReadingList") {
    const { url, title } = msg;
    chrome.storage.local.get(["readingList"], (res) => {
      const list = res.readingList || [];
      list.push({ url, title, savedAt: Date.now() });
      chrome.storage.local.set({ readingList: list }, () => sendResponse({ ok: true }));
    });
    return true;
  }
  if (msg.action === "activateFocusMode") {
    chrome.storage.local.set({ focusMode: true }, () => sendResponse({ ok: true }));
    // close distracting tabs
    analyzeTabs().then(({ distracting }) => {
      distracting.forEach(d => {
        chrome.tabs.remove(d.id);
      });
    });
    return true;
  }
  if (msg.action === "deactivateFocusMode") {
    chrome.storage.local.set({ focusMode: false }, () => sendResponse({ ok: true }));
    return true;
  }
});
