// popup.js
const summarizeBtn = document.getElementById("summarize");
const analyzeTabsBtn = document.getElementById("analyze-tabs");
const focusBtn = document.getElementById("focus-mode");
const results = document.getElementById("results");
const focusScoreEl = document.getElementById("focus-score");

function showResult(html) { results.innerHTML = html; }

// Load dummy_emails.json shipped in extension
async function loadDummyEmails() {
  const resp = await fetch(chrome.runtime.getURL("dummy_emails.json"));
  const data = await resp.json();
  return data.emails;
}

// Simple summarizer (counts labels, creates TLDR line)
function summarizeEmails(emails) {
  const unread = emails.filter(e => e.unread);
  const counts = unread.reduce((acc, e) => {
    acc[e.label] = (acc[e.label] || 0) + 1;
    return acc;
  }, {});
  let tldrParts = [];
  for (const [k, v] of Object.entries(counts)) {
    tldrParts.push(`${v} ${k}`);
  }
  const tldr = `${unread.length} new emails: ${tldrParts.join(", ")}`;
  // also a simple single-sentence summary combining subjects
  const subjects = unread.map(s => s.subject).slice(0,5).join(" • ");
  return { tldr, subjects, unread };
}

// Focus score: naive: 100 - (tabs * 5) - (unread * 8) clamped
async function updateFocusScore() {
  const tabs = await chrome.tabs.query({});
  const emails = await loadDummyEmails();
  const unread = emails.filter(e => e.unread).length;
  let score = Math.max(10, 100 - (tabs.length * 5) - (unread * 8));
  focusScoreEl.textContent = `Focus Score: ${score}`;
}

summarizeBtn.addEventListener("click", async () => {
  const emails = await loadDummyEmails();
  const s = summarizeEmails(emails);
  showResult(`<b>TL;DR:</b> ${s.tldr}<br/><i>${s.subjects}</i> <br/><button id="mark-news">Mark newsletters read</button>`);
  // hook mark-news
  document.getElementById("mark-news").addEventListener("click", async () => {
    // demo: mark newsletters unread=false in memory (we can't write to file)
    const updated = emails.map(e => e.label === "newsletter" ? {...e, unread:false} : e);
    showResult(`<b>Marked newsletters read (demo)</b>`);
    updateFocusScore();
  });
  updateFocusScore();
});

analyzeTabsBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "analyzeTabs" }, (resp) => {
    const r = resp.result;
    let html = `<b>Open Tabs:</b> ${r.tabCount}<br/>`;
    if (r.duplicates.length) html += `<b>Duplicate domains:</b> ${r.duplicates.join(", ")}<br/>`;
    if (r.distracting.length) {
      html += `<b>Distracting tabs:</b><ul>`;
      r.distracting.slice(0,5).forEach(d => {
        html += `<li>${d.title} — <small>${d.domain}</small> 
          <button class="savebtn" data-url="${d.url}" data-title="${d.title}">Save to Read</button></li>`;
      });
      html += `</ul>`;
    } else html += `<i>No obvious distractions detected</i>`;
    showResult(html);

    // attach listeners for Save to Read
    document.querySelectorAll(".savebtn").forEach(btn => {
      btn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "saveToReadingList", url: btn.dataset.url, title: btn.dataset.title }, (r) => {
          if (r.ok) showResult("<b>Saved to reading list</b>");
        });
      });
    });
  });
  updateFocusScore();
});

focusBtn.addEventListener("click", () => {
  // toggle on
  chrome.runtime.sendMessage({ action: "activateFocusMode" }, (r) => {
    showResult("<b>Focus Mode Activated</b> — closing distracting tabs.");
    updateFocusScore();
  });
});

// on popup open
updateFocusScore();
