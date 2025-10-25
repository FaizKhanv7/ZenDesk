// background.js: Core Security & Tab Management Service Worker

// 1. CONSTANTS (Hard-coded distractions and safe sites)
// These define the first layer of security/distraction filtering
const DISTRACTING_SITES = ["youtube.com/shorts", "instagram.com", "tiktok.com", "reddit.com"];
const SAFE_EXCLUDE = ["docs.google.com", "drive.google.com", "mail.google.com"];

// 2. INITIALIZATION
// Set default storage values (focusMode and readingList) upon install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ readingList: [], focusMode: false });
});

// 3. CORE HELPER FUNCTIONS

// Helper: Gets all open tabs from the browser
async function getAllTabs() {
    return new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => resolve(tabs));
    });
}

// Security Check: Determines if a tab matches the hard-coded distraction list AND is not a safe site
function isDistracting(tab) {
    const url = tab.url;
    if (!url || !url.startsWith('http')) return false;

    // 1. Skip if it's a known safe/study site
    if (SAFE_EXCLUDE.some(safe => url.includes(safe))) {
        return false;
    }

    // 2. Check if it's a basic distraction
    return DISTRACTING_SITES.some(site => url.includes(site));
}

// Security Action: Closes a tab, but only if it's not audible, and always saves the URL to the reading list
async function safeCloseTab(tab) {
    // Security Check: Do not close audible tabs (e.g., streaming video/audio)
    if (tab.audible) {
        console.log(`Skipped audible tab: ${tab.title}`);
        return false;
    }

    try {
        // 1. Save to reading list (the "safety net")
        const res = await chrome.storage.local.get({ readingList: [] });
        const list = res.readingList;
        list.push({ url: tab.url, title: tab.title, savedAt: Date.now() });
        await chrome.storage.local.set({ readingList: list });

        // 2. Remove the tab
        await chrome.tabs.remove(tab.id);
        console.log(`Closed and saved tab: ${tab.title}`);
        return true; // Successfully closed
    } catch (e) {
        console.error(`Error closing tab ${tab.id}: ${e}`);
        return false;
    }
}

// Duplicates Handler: Finds and closes duplicate URLs using the safeCloseTab function
async function closeDuplicateTabs() {
    const tabs = await getAllTabs();
    const seenUrls = new Set();
    const tabsToClose = [];

    for (const tab of tabs) {
        // Normalize URL to ignore query parameters and hashes for comparison
        try {
            const url = new URL(tab.url);
            url.hash = '';
            url.search = '';
            const normalizedUrl = url.toString();

            if (seenUrls.has(normalizedUrl)) {
                tabsToClose.push(tab); // This is the duplicate instance
            } else {
                seenUrls.add(normalizedUrl); // Keep the first instance
            }
        } catch (e) {
            // Skip invalid URLs
        }
    }

    let closedCount = 0;
    for (const tab of tabsToClose) {
        const closed = await safeCloseTab(tab);
        if (closed) closedCount++;
    }

    return closedCount;
}

// 4. BACKGROUND MESSAGING (Handles communication with popup and AI module)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // --- Focus Mode Activation ---
    if (msg.action === "activateFocusMode") {
        // Immediately update storage state
        chrome.storage.local.set({ focusMode: true }, () => sendResponse({ ok: true }));

        // Find and close basic distractions safely
        getAllTabs().then(tabs => {
            let closedCount = 0;
            const promises = tabs
                .filter(tab => isDistracting(tab)) // Use safe filter
                .map(async (tab) => {
                    const closed = await safeCloseTab(tab); // Use safe closure
                    if (closed) closedCount++;
                });

            // Wait for all closing operations to finish before showing notification
            Promise.all(promises).then(() => {
                if (closedCount > 0) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon-128.png', // Ensure this icon file exists
                        title: 'Focus Mode Active',
                        message: `Closed ${closedCount} basic distraction tabs.`,
                        priority: 2
                    });
                }
            });
        });
        return true; // Must return true for async sendResponse
    }

    // --- Focus Mode Deactivation ---
    if (msg.action === "deactivateFocusMode") {
        chrome.storage.local.set({ focusMode: false }, () => sendResponse({ ok: true }));
        return true;
    }
    
    // --- Duplicates Closing Handler ---
    if (msg.action === "closeDuplicates") {
        closeDuplicateTabs().then(closedCount => {
            sendResponse({ closed: closedCount });

            if (closedCount > 0) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon-128.png', // Ensure this icon file exists
                    title: 'Declutter Complete',
                    message: `Closed ${closedCount} duplicate tabs.`,
                    priority: 1
                });
            }
        });
        return true;
    }

    // --- Reading List Retrieval (For Popup/Demo) ---
    if (msg.action === "getReadingList") {
        chrome.storage.local.get({ readingList: [] }, res => {
            sendResponse({ readingList: res.readingList });
        });
        return true;
    }
});