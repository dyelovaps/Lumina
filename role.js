/* Rôle de ce navigateur (profil Chrome) — Lumina 1.13.6, 30/09/2026.
 *
 * Deux profils Chrome avec deux comptes Google différents peuvent avoir chacun leur Lumina, sans doublon :
 *   - « tout »      : Grok, Agnes, pilote, file ET Google Flow (par défaut, comme avant) ;
 *   - « principal » : Grok, Agnes, pilote, file ; Google Flow coupé (il tourne dans l'autre profil) ;
 *   - « flow »      : Google Flow seulement ; Grok, Agnes, pilote et file coupés (rien n'est pris au pont).
 * Le rôle est rangé dans chrome.storage.local, propre à chaque profil : chaque navigateur se souvient du sien.
 * Chargé par popup.html, sidepanel.html (script classique) et background.js (import). */
(() => {
  const KEY = "luminaRole";
  const ROLES = {
    tout: { label: "Tout (Grok, Agnes, Flow)", allows: ["grok", "agnes", "pilote", "file", "flow"] },
    principal: { label: "Principal (Grok, Agnes, sans Flow)", allows: ["grok", "agnes", "pilote", "file"] },
    flow: { label: "Flow seulement", allows: ["flow"] },
  };
  const WHAT = { grok: "Grok", agnes: "Agnes Studio", pilote: "le pilote auto", file: "la file de Claude", flow: "Google Flow" };

  function get() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(KEY, (d) => resolve(ROLES[d?.[KEY]] ? d[KEY] : "tout"));
      } catch {
        resolve("tout");
      }
    });
  }

  function set(role) {
    if (!ROLES[role]) return Promise.resolve(false);
    return new Promise((resolve) => chrome.storage.local.set({ [KEY]: role }, () => resolve(true)));
  }

  function allows(role, what) {
    return (ROLES[role] || ROLES.tout).allows.includes(what);
  }

  function refusal(role, what) {
    return `${WHAT[what] || what} est désactivé dans ce navigateur (rôle « ${(ROLES[role] || ROLES.tout).label} »). ` +
      "Changez le rôle dans la petite fenêtre Lumina si c'est voulu.";
  }

  // Compte Google du profil Chrome (autorisations « identity » et « identity.email ») ; "" si non connecté.
  function profile() {
    return new Promise((resolve) => {
      try {
        if (!chrome.identity?.getProfileUserInfo) return resolve("");
        chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, (info) => resolve(String(info?.email || "").toLowerCase()));
      } catch {
        resolve("");
      }
    });
  }

  globalThis.LuminaRole = { KEY, ROLES, get, set, allows, refusal, profile };
})();
