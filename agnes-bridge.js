/* Onglet Agnes : pont entre le panneau Lumina et Agnes Studio Pro (agnes/index.html, copie synchronisée
 * par scripts/sync-agnes.cjs). Les deux pages ont la même origine chrome-extension:// et se parlent par
 * BroadcastChannel("lumina-agnes") ; le côté Agnes est plugins/plugin-lumina.js.
 *   - Import : plans d'un projet Agnes → cartes Stills → Clips ou paires du Lot mixte, références comprises.
 *   - Retour : chaque rendu Grok d'un plan Agnes devient une prise de ce plan (onAgnesJobDone).
 *   - Pilote auto : une demande { agnes: { projet } } du pont est importée puis lancée (importFromAgnes).
 * Chargé après sidepanel.js : utilise state, $, persist, log, runBatch, resizeFile, refKey, slug… */

const AGNES_PATH = "agnes/index.html";
const agnesBC = typeof BroadcastChannel === "function" ? new BroadcastChannel("lumina-agnes") : null;
const agnesPending = new Map();
let agnesLast = null; // dernier état reçu d'Agnes (projet ouvert, liste des projets)

function agnesUrl() {
  return chromeApi.runtime.getURL(AGNES_PATH);
}

function agnesHint(msg) {
  const el = $("#agnes-hint");
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
}

agnesBC?.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.to !== "lumina") return;
  const wait = m.rid && agnesPending.get(m.rid);
  if (wait) {
    agnesPending.delete(m.rid);
    clearTimeout(wait.timer);
    if (/:error$/.test(m.type)) wait.reject(new Error(m.error || "erreur Agnes"));
    else wait.resolve(m);
    return;
  }
  if (m.type === "hello") void agnesRefresh();
  if (m.type === "push" && m.data) {
    void applyAgnesExport(m.data, { mode: state.settings.agnesMode || "auto" }).then((msg) => {
      agnesHint(msg);
      runHint(msg);
      $$("[data-tab]").find((b) => b.dataset.tab === "control")?.click();
    });
  }
});

function agnesRequest(type, body = {}, timeoutMs = 8000) {
  if (!agnesBC) return Promise.reject(new Error("BroadcastChannel indisponible"));
  const rid = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      agnesPending.delete(rid);
      reject(new Error("Agnes ne répond pas"));
    }, timeoutMs);
    agnesPending.set(rid, { resolve, reject, timer });
    agnesBC.postMessage({ to: "agnes", type, rid, ...body });
  });
}

async function agnesTab() {
  const base = agnesUrl();
  const tabs = await chromeApi.tabs.query({});
  return tabs.find((t) => (t.url || "").startsWith(base)) || null;
}

async function openAgnes(active = true) {
  const tab = await agnesTab();
  if (tab?.id) {
    if (active) {
      await chromeApi.tabs.update(tab.id, { active: true });
      if (tab.windowId != null) await chromeApi.windows?.update(tab.windowId, { focused: true }).catch(() => {});
    }
    return tab;
  }
  return chromeApi.tabs.create({ url: agnesUrl(), active });
}

/* Agnes ouverte et prête (plugin Lumina chargé) ; sinon l'ouvre en arrière-plan et attend son démarrage. */
async function ensureAgnes() {
  try {
    return await agnesRequest("ping", {}, 1500);
  } catch {
    /* fermée ou encore en chargement */
  }
  await openAgnes(false);
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      return await agnesRequest("ping", {}, 1500);
    } catch {
      await wait(500);
    }
  }
  throw new Error("Agnes ne démarre pas (extension « Lumina » décochée dans ⚙ d’Agnes ?)");
}

async function agnesRefresh() {
  const status = $("#agnes-status");
  try {
    agnesLast = await agnesRequest("ping", {}, 1500);
  } catch {
    agnesLast = null;
  }
  if (status) {
    const p = agnesLast?.project;
    status.textContent = p
      ? `Agnes ouverte — projet « ${p.name} » : ${p.shots} plan(s)${p.selected ? `, ${p.selected} coché(s)` : ""}.`
      : "Agnes n’est pas ouverte (elle s’ouvrira seule à l’import).";
  }
  const sel = $("#agnes-project");
  if (sel && agnesLast?.projects) {
    const keep = state.settings.agnesProject || "";
    sel.innerHTML = `<option value="">Projet ouvert dans Agnes</option>` +
      agnesLast.projects.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${p.shots})</option>`).join("");
    sel.value = agnesLast.projects.some((p) => p.id === keep) ? keep : "";
  }
  return agnesLast;
}

/* Grok propose 6, 10 ou 15 s ; Agnes 4 à 12 s. */
function grokDuration(sec) {
  const d = Number(sec) || 6;
  return d <= 7 ? 6 : d <= 12 ? 10 : 15;
}

/* Ligne @tags : désigne exactement les références du plan (retirée du prompt envoyé à Grok). */
function agnesTagged(prompt, refs) {
  const tags = (refs || []).map(refKey).filter(Boolean);
  return tags.length ? `${tags.map((t) => "@" + t).join(" ")}\n${prompt}` : prompt;
}

const AGNES_REF_KIND = { personnage: "character", decor: "location", objet: "prop" };

/* data = { project, shots: [{ shotId, num, title, imagePrompt, videoPrompt, duration, still: Blob, chainPrev, refs }],
 *          refs: [{ name, kind, blob }], skipped: [{ num, reason }] } — voir plugin-lumina.js.
 * Remplit les stills ou les paires de Lumina ; renvoie le compte rendu. */
async function applyAgnesExport(data, opts = {}) {
  const shots = data.shots || [];
  const notes = (data.skipped || []).map((x) => `plan ${x.num} ignoré (${x.reason})`);
  if (!shots.length) return "Agnes : aucun plan à importer" + (notes.length ? " — " + notes.join(" · ") : ".");
  const link = (s) => ({ projectId: data.project.id, shotId: s.shotId, num: s.num });

  // Références : remplacent celles de Lumina qui portent le même nom.
  const refs = [];
  for (const r of data.refs || []) {
    refs.push({
      id: "r" + Math.random().toString(36).slice(2, 8),
      kind: AGNES_REF_KIND[r.kind] || "character",
      name: String(r.name || "réf").slice(0, 40),
      dataUrl: await resizeFile(r.blob),
    });
  }
  const names = new Set(refs.map((r) => refKey(r.name)));
  state.refs = [...refs, ...state.refs.filter((r) => !names.has(refKey(r.name)))].slice(0, 24);

  const video = shots.filter((s) => s.videoPrompt);
  const withStill = video.filter((s) => s.still || s.chainPrev);
  let mode = opts.mode || "auto";
  if (mode === "auto") mode = video.length && withStill.length === video.length ? "montage" : "pipeline";

  if (mode === "montage") {
    const stills = [];
    for (const s of shots) {
      if (!s.videoPrompt) { notes.push(`plan ${s.num} sans prompt vidéo`); continue; }
      if (!s.still && !s.chainPrev) { notes.push(`plan ${s.num} sans image`); continue; }
      const nn = String(s.num).padStart(2, "0");
      stills.push({
        id: "st" + Math.random().toString(36).slice(2, 8),
        num: s.num,
        file: "",
        stem: slug(`${nn}-${s.title}`),
        title: `${nn} — ${s.title}${s.chainPrev && !s.still ? " (suite)" : ""}`,
        videoPrompt: agnesTagged(s.videoPrompt, s.refs),
        skip: false,
        duration: grokDuration(s.duration),
        dataUrl: s.still ? await resizeFile(s.still, 1920) : null,
        chainPrev: Boolean(s.chainPrev && !s.still),
        savePath: "",
        agnes: link(s),
      });
    }
    state.stills = stills.slice(0, 40);
  } else {
    state.pairs = shots.map((s) => ({
      id: "p" + Math.random().toString(36).slice(2, 8),
      num: s.num,
      title: `${String(s.num).padStart(2, "0")} ${s.title}`,
      // Plan vidéo sans prompt image : Grok part de la description du plan pour faire l'image de départ.
      imagePrompt: agnesTagged(s.imagePrompt || s.videoPrompt, s.refs),
      videoPrompt: s.videoPrompt ? agnesTagged(s.videoPrompt, s.refs) : "",
      skip: false,
      duration: grokDuration(s.duration),
      agnes: link(s),
    }));
    const imageOnly = state.pairs.filter((p) => !p.videoPrompt).length;
    state.settings.pass = imageOnly === state.pairs.length ? "images" : "both";
    if (imageOnly && state.settings.pass === "both") notes.push(`${imageOnly} plan(s) image seule : lancez-les ensuite avec « Images seules »`);
    const noImg = shots.filter((s) => s.videoPrompt && !s.imagePrompt).length;
    if (noImg) notes.push(`${noImg} plan(s) sans prompt image : l’image part du prompt vidéo`);
    const lost = shots.filter((s) => s.still).length;
    if (lost) notes.push(`${lost} image(s) validée(s) non utilisée(s) en Lot mixte (choisissez Stills → Clips pour les garder)`);
  }
  const count = mode === "montage" ? state.stills.length : state.pairs.length;
  state.settings.maxScenes = Math.min(40, Math.max(state.settings.maxScenes || 10, count));
  if ($("#max-scenes")) $("#max-scenes").value = String(state.settings.maxScenes);
  if ($("#max-label")) $("#max-label").textContent = String(state.settings.maxScenes);
  if (state.mode !== mode) setMode(mode, Boolean(opts.pilot));
  persist();
  renderAll();
  log(`Agnes « ${data.project.name} » : ${count} plan(s) importé(s) en ${mode === "montage" ? "Stills → Clips" : "Lot mixte"}, ${refs.length} référence(s).`);
  return `Agnes « ${data.project.name} » : ${count} plan(s) en ${mode === "montage" ? "Stills → Clips" : "Lot mixte"}` +
    (refs.length ? `, ${refs.length} référence(s)` : "") + "." + (notes.length ? " " + notes.join(" · ") + "." : "");
}

/* opts = { projectId?, projet? (nom), scope?, mode?, pilot? } — renvoie "" si l'import a réussi, sinon l'erreur. */
async function importFromAgnes(opts = {}) {
  const fail = (msg) => { agnesHint(msg); runHint(msg); return msg; };
  let status;
  try {
    status = await ensureAgnes();
  } catch (e) {
    return fail("Agnes : " + e.message);
  }
  let projectId = opts.projectId || "";
  if (!projectId && opts.projet) {
    const want = refKey(opts.projet);
    const hit = (status.projects || []).find((p) => p.id === opts.projet || refKey(p.name) === want);
    if (!hit) return fail(`Agnes : projet « ${opts.projet} » introuvable (${(status.projects || []).map((p) => p.name).join(", ")}).`);
    projectId = hit.id;
  }
  let res;
  try {
    res = await agnesRequest("export", {
      projectId: projectId || undefined,
      scope: opts.scope || (opts.pilot ? "all" : "selected"),
      withDna: opts.withDna ?? state.settings.agnesDna !== false,
    }, 120000);
  } catch (e) {
    return fail("Agnes : export impossible — " + e.message);
  }
  const msg = await applyAgnesExport(res.data, { mode: opts.mode || state.settings.agnesMode || "auto", pilot: opts.pilot });
  agnesHint(msg);
  runHint(msg + (opts.pilot ? "" : " Clique « Lancer le lot »."));
  return res.data.shots.length ? "" : msg;
}

/* Appelé par le worker de sidepanel.js quand un job issu d'Agnes est terminé. */
async function onAgnesJobDone(job, kind) {
  if (state.settings.agnesReturn === false || !job.urls?.[0]) return;
  try {
    const blob = await (await fetch(job.urls[0])).blob();
    await ensureAgnes();
    await agnesRequest("take", { projectId: job.agnes.projectId, shotId: job.agnes.shotId, role: kind, blob }, 60000);
    log(`Agnes : ${kind === "video" ? "clip" : "image"} rangé dans le plan ${job.agnes.num}.`);
  } catch (e) {
    log(`Agnes : rendu du plan ${job.agnes.num} non rangé (${e.message}) — il reste dans Téléchargements.`);
  }
}

/* Réglages de l'onglet (conservés avec ceux de Lumina). */
function bindAgnesTab() {
  const s = state.settings;
  const setup = (id, key, read, write) => {
    const el = $(id);
    if (!el) return;
    write(el);
    el.addEventListener("change", () => {
      s[key] = read(el);
      persist();
    });
  };
  setup("#agnes-mode", "agnesMode", (el) => el.value, (el) => { el.value = s.agnesMode || "auto"; });
  setup("#agnes-scope", "agnesScope", (el) => el.value, (el) => { el.value = s.agnesScope || "selected"; });
  setup("#agnes-project", "agnesProject", (el) => el.value, () => {});
  setup("#agnes-dna", "agnesDna", (el) => el.checked, (el) => { el.checked = s.agnesDna !== false; });
  setup("#agnes-return", "agnesReturn", (el) => el.checked, (el) => { el.checked = s.agnesReturn !== false; });
}

$("#agnes-open")?.addEventListener("click", () => void openAgnes(true).then(() => setTimeout(agnesRefresh, 2500)));
const agnesImportClick = async (run) => {
  agnesHint("Import depuis Agnes…");
  const err = await importFromAgnes({
    projectId: state.settings.agnesProject || "",
    scope: state.settings.agnesScope || "selected",
  });
  if (!err && run) void runBatch(true);
};
$("#agnes-import")?.addEventListener("click", () => void agnesImportClick(false));
$("#agnes-import-run")?.addEventListener("click", () => void agnesImportClick(true));
$$("[data-tab]").find((b) => b.dataset.tab === "agnes")?.addEventListener("click", () => {
  bindAgnesTabOnce();
  void agnesRefresh();
});

// Les réglages de Lumina sont relus en asynchrone au démarrage : l'onglet se règle à sa première ouverture.
let agnesBound = false;
function bindAgnesTabOnce() {
  if (agnesBound) return;
  agnesBound = true;
  bindAgnesTab();
}
