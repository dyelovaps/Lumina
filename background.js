import "./flow/background.js";

const IMAGINE_URL = "https://grok.com/imagine";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_SIDEPANEL") {
    const tabId = sender.tab?.id;
    const open = tabId
      ? chrome.sidePanel.open({ tabId })
      : chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
          if (tab?.id) return chrome.sidePanel.open({ tabId: tab.id });
        });
    Promise.resolve(open)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg?.type === "ENSURE_IMAGINE") {
    ensureImagineTab()
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg?.type === "SEND_TO_TAB") {
    ensureImagineTab()
      .then(async (tab) => {
        const res = await sendToTab(tab.id, msg.payload);
        sendResponse(res ?? { ok: false, error: "Pas de réponse de grok.com" });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "DOWNLOAD") {
    const filename = sanitizePath(msg.filename || "lumina/file");
    chrome.downloads.download(
      { url: msg.url, filename, saveAs: false, conflictAction: "uniquify" },
      (id) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, id });
        }
      },
    );
    return true;
  }

  return false;
});

async function sendToTab(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    await injectContent(tabId);
    await wait(400);
    try {
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch (err) {
      throw new Error(
        "Lumina n’est pas branché sur la page. Rechargez grok.com/imagine (F5), puis Correction rapide. " +
          (err?.message || ""),
      );
    }
  }
}

async function injectContent(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  } catch {
    /* css optional */
  }
}

async function ensureImagineTab() {
  const tabs = await chrome.tabs.query({});
  const grok = tabs.filter((t) => /https:\/\/([a-z0-9-]+\.)?grok\.com\//i.test(t.url || ""));
  const imagine = grok.find((t) => /imagine/i.test(t.url || "")) || grok[0];
  if (imagine?.id) {
    if (!/imagine/i.test(imagine.url || "")) {
      await chrome.tabs.update(imagine.id, { url: IMAGINE_URL, active: true });
      await waitForComplete(imagine.id);
    } else {
      await chrome.tabs.update(imagine.id, { active: true });
    }
    return chrome.tabs.get(imagine.id);
  }
  const created = await chrome.tabs.create({ url: IMAGINE_URL, active: true });
  await waitForComplete(created.id);
  return created;
}

function waitForComplete(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 12000);
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 800);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitizePath(path) {
  return path.replace(/\\/g, "/").replace(/[^a-zA-Z0-9/._\- ]+/g, "_").replace(/^\/+/, "");
}
