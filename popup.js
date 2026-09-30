const ver = document.getElementById("ver");
if (ver) ver.textContent = "v" + chrome.runtime.getManifest().version;

// Rôle de ce navigateur (role.js) : compte du profil Chrome affiché, boutons interdits grisés.
const R = globalThis.LuminaRole;
const WHY = {
  tout: "Grok, Agnes et Google Flow dans ce navigateur. Un seul navigateur doit avoir Lumina active.",
  principal: "Grok et Agnes ici ; Google Flow tourne dans le navigateur « Flow seulement » (autre compte Google).",
  flow: "Google Flow seulement (compte Flow de ce navigateur). Grok, Agnes, pilote et file sont coupés : aucun doublon.",
};
async function applyRole() {
  const role = await R.get();
  const sel = document.getElementById("role-select");
  if (sel) sel.value = role;
  const why = document.getElementById("role-why");
  if (why) why.textContent = WHY[role] || "";
  const off = (id, what) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = !R.allows(role, what);
    b.title = b.disabled ? R.refusal(role, what) : "";
  };
  off("open-agnes", "agnes");
  off("open-imagine", "grok");
  off("open-flow", "flow");
  const panel = document.querySelector("#open-panel small");
  if (panel) panel.textContent = role === "flow" ? "Onglet Google Flow" : "Lots Grok, file, pilote auto";
}
R.profile().then((email) => {
  const el = document.getElementById("role-profile");
  if (el) el.textContent = email ? `Chrome — ${email}` : "Chrome — profil sans compte Google";
});
document.getElementById("role-select")?.addEventListener("change", async (e) => {
  await R.set(e.target.value);
  void applyRole();
});
void applyRole();

document.getElementById("open-panel")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

// Agnes Studio : réutilise l'onglet déjà ouvert (une seule Agnes à la fois, même stockage)
document.getElementById("open-agnes")?.addEventListener("click", async () => {
  if (!R.allows(await R.get(), "agnes")) return;
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
  if (!R.allows(await R.get(), "grok")) return;
  await chrome.tabs.create({ url: "https://grok.com/imagine" });
  window.close();
});

document.getElementById("open-flow")?.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "OPEN_FLOW_TAB" });
  if (result?.ok) window.close();
});
