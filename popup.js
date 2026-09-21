document.getElementById("open-panel")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
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
