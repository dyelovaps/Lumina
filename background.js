import "./role.js";
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

  // Rôle du navigateur (role.js) : Grok refusé en « Flow seulement », quel que soit l'envoyeur (lot, file, Agnes).
  if (msg?.type === "ENSURE_IMAGINE" || msg?.type === "SEND_TO_TAB") {
    globalThis.LuminaRole.get().then((role) => {
      if (!globalThis.LuminaRole.allows(role, "grok")) {
        sendResponse({ ok: false, error: globalThis.LuminaRole.refusal(role, "grok") });
        return;
      }
      handleGrok(msg, sendResponse);
    });
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

// Traitement Grok (inchangé) : appelé seulement si le rôle du navigateur autorise Grok.
function handleGrok(msg, sendResponse) {
  if (msg.type === "ENSURE_IMAGINE") {
    ensureImagineTab()
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return;
  }
  ensureImagineTab()
    .then(async (tab) => {
      // Nouvel envoi : toujours depuis l'accueil d'Imagine. Resté sur la page d'une ancienne vidéo (/imagine/post/…),
      // l'image se dépose dans le formulaire de cette page et l'import n'est pas confirmé (constaté le 29/09/2026).
      if (msg.payload?.type === "SUBMIT_PROMPT" && !isImagineHome(tab.url)) {
        await chrome.tabs.update(tab.id, { url: IMAGINE_URL, active: true });
        await waitForComplete(tab.id);
      }
      const res = await sendToTab(tab.id, msg.payload);
      sendResponse(res ?? { ok: false, error: "Pas de réponse de grok.com" });
    })
    .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
}

async function sendToTab(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch (err) {
    const msg = String(err?.message || err);
    // Renvoi UNIQUEMENT si le message n'a jamais été reçu (script absent de la page).
    // Si le script l'a reçu puis que la page a changé (« message port closed »), le prompt est
    // peut-être déjà parti chez Grok : le renvoyer lancerait une 2e génération (bug de la boucle).
    const neverDelivered = /receiving end does not exist|could not establish connection/i.test(msg);
    if (payload?.type === "SUBMIT_PROMPT" && !neverDelivered) {
      // Le prompt est parti puis Grok a changé de page : on NE renvoie PAS le prompt,
      // on demande au script de la nouvelle page de reprendre l'attente du résultat.
      return await resumeWait(tabId, msg);
    }
    await injectContent(tabId);
    await wait(400);
    try {
      return await chrome.tabs.sendMessage(tabId, payload);
    } catch (err2) {
      throw new Error(
        "Lumina n’est pas branché sur la page. Rechargez grok.com/imagine (F5), puis Correction rapide. " +
          (err2?.message || ""),
      );
    }
  }
}

async function resumeWait(tabId, firstError) {
  await waitForComplete(tabId);
  for (let i = 0; i < 3; i++) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "RESUME_WAIT" });
    } catch (err) {
      const m = String(err?.message || err);
      if (/receiving end does not exist|could not establish connection/i.test(m)) {
        await injectContent(tabId).catch(() => {});
        await wait(600);
        continue;
      }
      // Nouvelle navigation pendant l'attente : on reprend encore.
      await waitForComplete(tabId);
    }
  }
  return {
    ok: false,
    error: "La page Grok a changé pendant la génération (" + firstError + "). Aucun renvoi automatique : " +
      "vérifiez l’onglet Grok avant de relancer.",
  };
}

async function injectContent(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  } catch {
    /* css optional */
  }
}

function isImagineHome(url) {
  try {
    return /^\/imagine\/?$/.test(new URL(url || "").pathname);
  } catch {
    return false;
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
