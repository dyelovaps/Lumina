const ver = document.getElementById("ver");
if (ver) ver.textContent = "v" + chrome.runtime.getManifest().version;

document.getElementById("open-panel")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

// Agnes Studio : réutilise l'onglet déjà ouvert (une seule Agnes à la fois, même stockage)
document.getElementById("open-agnes")?.addEventListener("click", async () => {
  const url = chrome.runtime.getURL("agnes/index.html");
  const open = (await chrome.tabs.query({})).find((t) => (t.url || "").startsWith(url));
  if (open?.id) {
    await chrome.tabs.update(open.id, { active: true });
    if (open.windowId != null) await chrome.windows.update(open.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
  window.close();
});

document.getElementById("open-imagine")?.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://grok.com/imagine" });
  window.close();
});

document.getElementById("open-flow")?.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "OPEN_FLOW_TAB" });
  if (result?.ok) window.close();
});
