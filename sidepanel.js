const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const SAMPLE = {
  pairs: [
    {
      image: {
        scene: "Studio photo minimaliste, fond pierre noire mate",
        subject: "Lena, même visage que la référence, objet en laiton poli sur un socle",
        style: "Photographie de studio, grain argentique fin",
        lighting: "Lumière rasante, reflets contrôlés sur le métal",
        composition: "Plan large, sujet centré, beaucoup de vide",
        characters: ["lena"],
        location: "studio",
        props: ["verre-laiton"],
      },
      video: {
        motion: "Travelling avant très lent, poussière en suspension",
        camera: "Presque fixe, rack focus vers le laiton",
        mood: "Calme, tactile, silence de studio",
        characters: ["lena"],
      },
    },
    {
      image: {
        scene: "Côte bretonne au crépuscule, mer calme",
        subject: "Lena devant le phare, même manteau, même visage",
        style: "Plan large, grain argentique",
        lighting: "Lumière rase du soir, horizon pâle",
        composition: "Ligne d’horizon basse, phare dans le tiers droit",
        characters: ["lena"],
        location: "phare",
      },
      video: {
        motion: "Vagues lentes, un oiseau traverse le cadre, Lena immobile",
        camera: "Caméra presque immobile, très léger panoramique",
        mood: "Crépuscule, air salin, temps suspendu",
        characters: ["lena"],
        location: "phare",
      },
    },
  ],
};

const state = {
  mode: "pipeline",
  running: false,
  jobs: [],
  pairs: [blankPair()],
  refs: [],
  images: [],
  stills: [],
  promptText: "",
  promptInput: "text",
  settings: {
    concurrent: 1,
    delay: 1500,
    aspect: "9:16",
    folder: "lumina",
    continuity: false,
    outputs: 1,
    maxScenes: 15,
    speed: true,
    pass: "both",
    step: false,
    force480p: false,
    duration: 6,
    quality: "speed",
    resolution: "1080p",
    appendRules: true,
    framePair: "startEnd",
    referenceSelection: "matching",
    refSelV2: true,
    lint: true,
    cleanImage: true,
    copyComplete: false,
    dirImages: "Images",
    dirClips: "Clip video",
    dirComplete: "Video complete",
    dirScript: "Script",
  },
  paused: false,
  journal: [],
};

const chromeApi = globalThis.chrome;
let batchActive = false;

$("#json-sample").value = JSON.stringify(SAMPLE, null, 2);

if (chromeApi?.storage?.local) {
  chromeApi.storage.local
    .get(["lumina"])
    .then((bag) => {
      const saved = bag.lumina || {};
      if (typeof saved.mode === "string") state.mode = saved.mode;
      if (saved.settings && typeof saved.settings === "object") {
        Object.assign(state.settings, saved.settings);
      }
      state.settings.concurrent = 1;
      state.settings.continuity = false;
      if (!saved.settings?.fmtV4) {
        // Règles de tous les projets : vidéo 9:16, 1080p si Grok le permet (sinon 720p automatiquement).
        state.settings.aspect = "9:16";
        state.settings.resolution = "1080p";
        state.settings.force480p = false;
        state.settings.appendRules = true;
        state.settings.fmtV4 = true;
      }
      if (!saved.settings?.refSelV2) {
        // v2 : par défaut, seules les références des persos/lieux cités partent avec chaque plan.
        state.settings.referenceSelection = "matching";
        state.settings.refSelV2 = true;
      }
      if (Array.isArray(saved.pairs) && saved.pairs.length) state.pairs = saved.pairs;
      if (Array.isArray(saved.refs)) state.refs = saved.refs;
      if (Array.isArray(saved.images)) state.images = saved.images;
      if (Array.isArray(saved.stills)) state.stills = saved.stills;
      if (typeof saved.promptText === "string") state.promptText = saved.promptText;
      if (saved.promptInput === "json" || saved.promptInput === "text") state.promptInput = saved.promptInput;
      if (Array.isArray(saved.jobs)) state.jobs = saved.jobs;
      if (Array.isArray(saved.journal)) state.journal = saved.journal;
      $("#prompts").value = state.promptText;
      $("#reference-selection").value = state.settings.referenceSelection || "all";
      $("#concurrent").value = String(state.settings.concurrent);
      $("#delay").value = String(state.settings.delay);
      $("#aspect").value = state.settings.aspect;
      $("#folder").value = state.settings.folder;
      $("#outputs").value = String(state.settings.outputs || 1);
      $("#max-scenes").value = String(state.settings.maxScenes || 10);
      $("#max-label").textContent = String(state.settings.maxScenes || 10);
      $("#speed").checked = (state.settings.quality || "speed") === "speed";
      $("#step").checked = Boolean(state.settings.step);
      $("#force480p").checked = (state.settings.resolution || "480p") === "480p";
      $("#copy-complete").checked = Boolean(state.settings.copyComplete);
      if ($("#lint")) $("#lint").checked = state.settings.lint !== false;
      if ($("#clean-image")) $("#clean-image").checked = state.settings.cleanImage !== false;
      if ($("#grok-video-only")) $("#grok-video-only").checked = state.settings.grokVideoOnly !== false;
      if ($("#append-rules")) $("#append-rules").checked = state.settings.appendRules !== false;
      if ($("#ep-serie")) $("#ep-serie").value = state.settings.lastSerie || "";
      if ($("#ep-num")) $("#ep-num").value = state.settings.lastEp || "";
      if ($("#pilot")) $("#pilot").checked = Boolean(state.settings.pilot);
      $("#dir-images").value = state.settings.dirImages || "Images";
      $("#dir-clips").value = state.settings.dirClips || "Clip video";
      $("#dir-complete").value = state.settings.dirComplete || "Video complete";
      $("#dir-script").value = state.settings.dirScript || "Script";
      $("#continuity").checked = state.settings.continuity !== false;
      $("#c-label").textContent = String(state.settings.concurrent);
      $("#d-label").textContent = String(state.settings.delay);
      setMode(state.mode, true);
      renderAll();
    })
    .catch(() => renderAll());
}

function persist() {
  state.promptText = $("#prompts")?.value || "";
  chromeApi?.storage?.local
    ?.set({
      lumina: {
        mode: state.mode,
        settings: state.settings,
        pairs: state.pairs,
        refs: state.refs.slice(0, 24),
        images: state.images.slice(0, 8),
        stills: (state.stills || []).slice(0, 40).map((s) => ({
          ...s,
          dataUrl: s.dataUrl,
        })),
        promptText: state.promptText,
        promptInput: state.promptInput,
        jobs: state.jobs,
        journal: (state.journal || []).slice(-200),
      },
    })
    .catch(() => {});
}

function blankPair() {
  return {
    id: "p" + Math.random().toString(36).slice(2, 8),
    title: "",
    imagePrompt: "",
    videoPrompt: "",
    skip: false,
    duration: 6,
  };
}

function clipDur(item) {
  const n = Number(item?.duration);
  if (n === 6 || n === 10 || n === 15) return n;
  return Number(state.settings?.duration) || 6;
}

function durPillsHtml(item) {
  const d = clipDur(item);
  return `<div class="seg mini-dur">
    <button type="button" data-dur="6" class="${d === 6 ? "on" : ""}">6 s</button>
    <button type="button" data-dur="10" class="${d === 10 ? "on" : ""}">10 s</button>
    <button type="button" data-dur="15" class="${d === 15 ? "on" : ""}">15 s</button>
  </div>`;
}

function needsImages(mode) {
  return mode === "frame2v" || mode === "ingredients" || mode === "i2i";
}

function setMode(mode, silent) {
  state.mode = mode;
  $$("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  const pair = mode === "pipeline";
  const montage = mode === "montage";
  $("#pair-box").hidden = !pair;
  $("#single-box").hidden = pair || montage;
  $("#images-box").hidden = !needsImages(mode);
  const mb = $("#montage-box");
  if (mb) mb.hidden = !montage;
  const pw = $("#pass-wrap");
  if (pw) pw.hidden = !pair;
  $("#frame-pills").hidden = mode !== "frame2v";
  $("#video-settings").hidden = mode === "t2i" || mode === "i2i";
  $("#images-hint").textContent = mode === "ingredients"
    ? "Ces images et les références sélectionnées seront jointes avec le rôle Référence dans le mode Vidéo."
    : mode === "i2i" ? "Une image commune, ou une image par prompt d’édition."
    : "Début + fin : deux images communes ou deux images par prompt. Sinon, une image commune ou une image par clip.";
  if (montage && !silent) {
    state.settings.step = true;
    const st = $("#step");
    if (st) st.checked = true;
  }
  if (!silent) persist();
  setPromptInput(state.promptInput, true);
  updatePreview();
  renderStills();
}

$$("[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$("[data-tab]").forEach((b) => b.classList.toggle("on", b === btn));
    $$(".page").forEach((p) => p.classList.toggle("on", p.id === btn.dataset.tab));
  });
});

$$("[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

$("#concurrent").addEventListener("input", (e) => {
  state.settings.concurrent = Number(e.target.value);
  $("#c-label").textContent = e.target.value;
  persist();
});
$("#delay").addEventListener("input", (e) => {
  state.settings.delay = Number(e.target.value);
  $("#d-label").textContent = e.target.value;
  persist();
});
$("#aspect").addEventListener("change", (e) => {
  state.settings.aspect = e.target.value;
  persist();
});
$("#folder").addEventListener("change", (e) => {
  state.settings.folder = e.target.value || "Lumina";
  persist();
});
function bindDir(id, key, fallback) {
  const el = $("#" + id);
  if (!el) return;
  el.addEventListener("change", (e) => {
    state.settings[key] = e.target.value.trim() || fallback;
    persist();
  });
}
bindDir("dir-images", "dirImages", "Images");
bindDir("dir-clips", "dirClips", "Clip video");
bindDir("dir-complete", "dirComplete", "Video complete");
bindDir("dir-script", "dirScript", "Script");
$("#outputs").addEventListener("change", (e) => {
  setOutputs(Number(e.target.value) || 1);
});
$("#reference-selection").addEventListener("change", (e) => {
  state.settings.referenceSelection = e.target.value;
  persist();
});
$("#max-scenes").addEventListener("input", (e) => {
  state.settings.maxScenes = Number(e.target.value) || 10;
  $("#max-label").textContent = e.target.value;
  persist();
  updatePreview();
});
$("#speed").addEventListener("change", (e) => {
  state.settings.speed = e.target.checked;
  state.settings.quality = e.target.checked ? "speed" : "quality";
  persist();
  paintClipPills();
});
$("#force480p")?.addEventListener("change", (e) => {
  state.settings.force480p = e.target.checked;
  state.settings.resolution = e.target.checked ? "480p" : "720p";
  persist();
  paintClipPills();
});
$("#lint")?.addEventListener("change", (e) => {
  state.settings.lint = e.target.checked;
  persist();
});
$("#append-rules")?.addEventListener("change", (e) => {
  state.settings.appendRules = e.target.checked;
  persist();
});
$("#grok-video-only")?.addEventListener("change", (e) => {
  state.settings.grokVideoOnly = e.target.checked;
  persist();
});
$("#clean-image")?.addEventListener("change", (e) => {
  state.settings.cleanImage = e.target.checked;
  persist();
});
$("#copy-complete")?.addEventListener("change", (e) => {
  state.settings.copyComplete = e.target.checked;
  persist();
});
$("#step").addEventListener("change", (e) => {
  state.settings.step = e.target.checked;
  persist();
});
$("#pass-pills").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pass]");
  if (!btn) return;
  state.settings.pass = btn.dataset.pass;
  $$("#pass-pills [data-pass]").forEach((b) => b.classList.toggle("on", b === btn));
  persist();
  updatePreview();
});
$("#export-lot").addEventListener("click", exportLot);
$("#export-journal")?.addEventListener("click", () => {
  const text = (state.journal || []).map((l) => l.t + "  " + l.msg).join("\n") || "Journal vide.";
  const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  void saveDownload(dataUrl, state.settings.dirScript || "Script", "journal", "txt");
  log("Export journal.txt");
});
$("#next").addEventListener("click", goNextScene);
$("#next-2")?.addEventListener("click", goNextScene);
function goNextScene() {
  state.paused = false;
  persist();
  renderJobs();
  log("Scène suivante");
}
$("#out-pills").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-out]");
  if (!btn) return;
  setOutputs(Number(btn.dataset.out));
});

function setPromptInput(kind, silent) {
  state.promptInput = kind === "json" ? "json" : "text";
  $$("#input-pills [data-input]").forEach((b) =>
    b.classList.toggle("on", b.dataset.input === state.promptInput),
  );
  const json = state.promptInput === "json";
  const jb = $("#json-box");
  const tb = $("#text-prompt-box");
  const cw = $("#clip-text-wrap");
  if (jb) jb.hidden = !json;
  if (tb) tb.hidden = json;
  if (cw) cw.hidden = json;
  if (!silent) persist();
}

$("#input-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-input]");
  if (!btn) return;
  setPromptInput(btn.dataset.input);
});

function setOutputs(n) {
  state.settings.outputs = Math.max(1, Math.min(4, n));
  $("#outputs").value = String(state.settings.outputs);
  $$("#out-pills [data-out]").forEach((b) =>
    b.classList.toggle("on", Number(b.dataset.out) === state.settings.outputs),
  );
  persist();
  updatePreview();
}

function paintClipPills() {
  $$("#frame-pills [data-frame]").forEach((b) =>
    b.classList.toggle("on", b.dataset.frame === state.settings.framePair),
  );
  $$("#dur-pills [data-dur]").forEach((b) =>
    b.classList.toggle("on", Number(b.dataset.dur) === Number(state.settings.duration || 6)),
  );
  $$("#qual-pills [data-qual]").forEach((b) =>
    b.classList.toggle("on", b.dataset.qual === (state.settings.quality || "speed")),
  );
  $$("#res-pills [data-res]").forEach((b) =>
    b.classList.toggle("on", b.dataset.res === (state.settings.resolution || "480p")),
  );
  $$("#aspect-pills [data-aspect]").forEach((b) =>
    b.classList.toggle("on", b.dataset.aspect === (state.settings.aspect || "16:9")),
  );
}

$("#frame-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-frame]");
  if (!btn) return;
  state.settings.framePair = btn.dataset.frame;
  $$("#frame-pills [data-frame]").forEach((b) => b.classList.toggle("on", b === btn));
  persist();
});
$("#dur-all")?.addEventListener("click", () => {
  const d = clipDur();
  state.pairs.forEach((p) => {
    p.duration = d;
  });
  (state.stills || []).forEach((s) => {
    s.duration = d;
  });
  persist();
  renderPairs();
  renderStills();
  log("Durée " + d + " s appliquée à tous les clips");
});
$("#dur-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-dur]");
  if (!btn) return;
  state.settings.duration = Number(btn.dataset.dur) || 6;
  persist();
  paintClipPills();
});
$("#qual-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-qual]");
  if (!btn) return;
  state.settings.quality = btn.dataset.qual;
  state.settings.speed = btn.dataset.qual === "speed";
  $("#speed").checked = state.settings.speed;
  persist();
  paintClipPills();
});
$("#res-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-res]");
  if (!btn) return;
  state.settings.resolution = btn.dataset.res;
  state.settings.force480p = btn.dataset.res === "480p";
  $("#force480p").checked = state.settings.force480p;
  persist();
  paintClipPills();
});
$("#aspect-pills")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-aspect]");
  if (!btn) return;
  state.settings.aspect = btn.dataset.aspect;
  $("#aspect").value = btn.dataset.aspect;
  persist();
  paintClipPills();
});
$("#continuity").addEventListener("change", (e) => {
  state.settings.continuity = e.target.checked;
  persist();
});
$("#prompts").addEventListener("input", () => {
  persist();
  updatePreview();
});

$("#add-pair").addEventListener("click", () => {
  const p = blankPair();
  p.duration = clipDur();
  state.pairs.push(p);
  persist();
  renderPairs();
});

$("#pairs").addEventListener("click", (e) => {
  const card = e.target.closest(".card-pair");
  if (!card) return;
  const i = state.pairs.findIndex((p) => p.id === card.dataset.id);
  if (i < 0) return;
  const durBtn = e.target.closest("[data-dur]");
  if (durBtn) {
    state.pairs[i].duration = Number(durBtn.dataset.dur) || 6;
    persist();
    renderPairs();
    return;
  }
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === "skip") state.pairs[i].skip = !state.pairs[i].skip;
  if (act === "del") {
    state.pairs.splice(i, 1);
    if (!state.pairs.length) state.pairs.push(blankPair());
  }
  if (act === "up" && i > 0) {
    const [x] = state.pairs.splice(i, 1);
    state.pairs.splice(i - 1, 0, x);
  }
  if (act === "down" && i < state.pairs.length - 1) {
    const [x] = state.pairs.splice(i, 1);
    state.pairs.splice(i + 1, 0, x);
  }
  persist();
  renderPairs();
});

$("#pairs").addEventListener("input", (e) => {
  const card = e.target.closest(".card-pair");
  if (!card) return;
  const pair = state.pairs.find((p) => p.id === card.dataset.id);
  if (!pair) return;
  if (e.target.dataset.field === "image") pair.imagePrompt = e.target.value;
  if (e.target.dataset.field === "video") pair.videoPrompt = e.target.value;
  if (e.target.dataset.field === "title") pair.title = e.target.value;
  persist();
  $("#pair-count").textContent = pairLabel(readyPairs().length);
  const stem = sceneStem(pair, state.pairs.indexOf(pair));
  const hint = card.querySelector(".stem");
  if (hint) hint.textContent = stem;
  updatePreview();
});

$("#copy-json").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#json-sample").value);
    $("#copy-json").textContent = "Copié";
    setTimeout(() => {
      $("#copy-json").textContent = "Copier";
    }, 1200);
  } catch {
    /* ignore */
  }
});

$("#load-json").addEventListener("click", () => {
  $("#json-sample").value = JSON.stringify(SAMPLE, null, 2);
  applyJsonEditor();
});

$("#apply-json").addEventListener("click", applyJsonEditor);
$("#json-sample").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    applyJsonEditor();
  }
});

function applyJsonEditor() {
  const err = $("#json-err");
  const raw = $("#json-sample").value.trim();
  if (!raw) {
    err.hidden = false;
    err.textContent = "JSON vide.";
    return;
  }
  try {
    JSON.parse(raw);
  } catch (e) {
    err.hidden = false;
    err.textContent = "JSON invalide : " + (e.message || e);
    return;
  }
  err.hidden = true;
  applyIngest(ingestPromptSource(raw));
  setPromptInput("text");
  log("JSON appliqué");
}

$("#import").addEventListener("click", () => $("#file").click());
$("#file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  if (/\.md$/i.test(file.name) || looksLikeScript(text)) applyIngest({ kind: "pairs", pairs: parseSceneScript(text) });
  else applyIngest(ingestPromptSource(text));
  e.target.value = "";
});
$("#import-script").addEventListener("click", () => $("#script-file").click());
$("#script-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  applyIngest({ kind: "pairs", pairs: parseSceneScript(await file.text()) });
  e.target.value = "";
});
$("#sheet-btn")?.addEventListener("click", () => void makeContactSheet());
$("#assemble-btn")?.addEventListener("click", () => void assembleComplete());
$("#sheet-btn-q")?.addEventListener("click", () => void makeContactSheet());
$("#assemble-btn-q")?.addEventListener("click", () => void assembleComplete());

function bindRefTray(boxId, kind, inputId) {
  const box = $("#" + boxId);
  const input = $("#" + inputId);
  if (!box || !input) return;
  box.addEventListener("click", (e) => {
    if (e.target.closest(".tile-add")) input.click();
    const del = e.target.closest("[data-del]");
    if (del) {
      state.refs = state.refs.filter((r) => r.id !== del.dataset.del);
      persist();
      renderRefs();
    }
  });
  box.addEventListener("input", onRefName);
  input.addEventListener("change", (e) => void addRefFiles(kind, e.target.files));
}
bindRefTray("chars", "character", "ref-char");
bindRefTray("locs", "location", "ref-loc");
bindRefTray("props", "prop", "ref-prop");

function onRefName(e) {
  if (!e.target.dataset.name) return;
  const ref = state.refs.find((r) => r.id === e.target.dataset.name);
  if (ref) {
    ref.name = e.target.value.slice(0, 40);
    persist();
  }
}

$("#src-files").addEventListener("change", (e) => void addSrcFiles(e.target.files));
$("#still-files")?.addEventListener("change", (e) => void addStillFiles(e.target.files));
$("#still-tiles")?.addEventListener("click", (e) => {
  if (e.target.closest(".tile-add")) $("#still-files").click();
});
$("#link-clips")?.addEventListener("click", () => linkClips("order"));
$("#link-titles")?.addEventListener("click", () => linkClips("title"));
$("#still-cards")?.addEventListener("input", (e) => {
  const card = e.target.closest(".still-card");
  if (!card) return;
  const still = state.stills.find((s) => s.id === card.dataset.id);
  if (!still) return;
  if (e.target.dataset.field === "video") still.videoPrompt = e.target.value;
  if (e.target.dataset.field === "title") still.title = e.target.value;
  persist();
  updateMontagePreview();
});
$("#still-cards")?.addEventListener("click", (e) => {
  const card = e.target.closest(".still-card");
  if (!card) return;
  const i = state.stills.findIndex((s) => s.id === card.dataset.id);
  if (i < 0) return;
  const durBtn = e.target.closest("[data-dur]");
  if (durBtn) {
    state.stills[i].duration = Number(durBtn.dataset.dur) || 6;
    persist();
    renderStills();
    return;
  }
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  if (btn.dataset.act === "skip") state.stills[i].skip = !state.stills[i].skip;
  if (btn.dataset.act === "del") state.stills.splice(i, 1);
  if (btn.dataset.act === "up" && i > 0) {
    const [x] = state.stills.splice(i, 1);
    state.stills.splice(i - 1, 0, x);
  }
  if (btn.dataset.act === "down" && i < state.stills.length - 1) {
    const [x] = state.stills.splice(i, 1);
    state.stills.splice(i + 1, 0, x);
  }
  persist();
  renderStills();
});
$("#src-images").addEventListener("click", (e) => {
  if (e.target.closest(".tile-add")) $("#src-files").click();
  const del = e.target.closest("[data-del]");
  if (del) {
    state.images = state.images.filter((r) => r.id !== del.dataset.del);
    persist();
    renderSrcImages();
  }
});

$("#run").addEventListener("click", () => void runBatch(true));
$("#stop").addEventListener("click", () => void stopBatch());
$("#fix").addEventListener("click", () => {
  if (state.running) return;
  state.jobs = state.jobs.map((j) =>
    j.status === "error" || j.status === "cancelled"
      ? { ...j, status: "queued", error: undefined, progress: 0 }
      : j,
  );
  persist();
  renderJobs();
  void runBatch(false);
});

async function stopBatch() {
  state.running = false;
  state.paused = false;
  stopProgressTick();
  state.jobs = state.jobs.map((j) =>
    j.status === "queued" || j.status === "running" ? { ...j, status: "cancelled", error: "Arrêté" } : j,
  );
  persist();
  renderJobs();
  try {
    await chromeApi.runtime.sendMessage({ type: "SEND_TO_TAB", payload: { type: "CANCEL" } });
  } catch {
    /* ignore */
  }
}

async function addRefFiles(kind, files) {
  if (!files?.length) return;
  for (const file of [...files].slice(0, 16)) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await resizeFile(file);
    state.refs.push({
      id: "r" + Math.random().toString(36).slice(2, 8),
      kind,
      name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      dataUrl,
    });
  }
  state.refs = state.refs.slice(0, 24);
  persist();
  renderRefs();
}

function resizeFile(file, max = 720) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", max > 720 ? 0.92 : 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function addSrcFiles(files) {
  if (!files?.length) return;
  for (const file of [...files].slice(0, 8)) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await resizeFile(file);
    state.images.push({
      id: "s" + Math.random().toString(36).slice(2, 8),
      name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      dataUrl,
    });
  }
  state.images = state.images.slice(0, 8);
  persist();
  renderSrcImages();
}

function titleFromFile(name) {
  return String(name || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[-_\s]+/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

async function addStillFiles(files) {
  if (!files?.length) return;
  const list = [...files].filter((f) => f.type.startsWith("image/"));
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  for (const file of list.slice(0, 40)) {
    const dataUrl = await resizeFile(file, 1920);
    const base = file.name.replace(/\.[^.]+$/, "");
    state.stills.push({
      id: "st" + Math.random().toString(36).slice(2, 8),
      file: file.name,
      stem: slug(base),
      title: titleFromFile(file.name),
      videoPrompt: "",
      skip: false,
      duration: clipDur(),
      dataUrl,
    });
  }
  state.stills = state.stills.slice(0, 40);
  persist();
  renderStills();
}

function parseClipBlocks(raw) {
  return String(raw || "")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function linkClips(how) {
  const blocks = parseClipBlocks($("#clip-prompts")?.value || "");
  if (!blocks.length && state.mode === "montage") {
    const ingested = ingestPromptSource($("#clip-prompts")?.value || "");
    if (ingested.kind === "pairs") {
      applyClipPairs(ingested.pairs, how);
      return;
    }
  }
  if (how === "title") {
    const scenes = looksLikeScript($("#clip-prompts")?.value || "")
      ? parseSceneScript($("#clip-prompts").value)
      : [];
    if (scenes.length) {
      applyClipPairs(scenes, "title");
      return;
    }
  }
  state.stills.forEach((s, i) => {
    if (blocks[i]) s.videoPrompt = blocks[i];
  });
  persist();
  renderStills();
  log("Prompts reliés dans l’ordre — " + Math.min(blocks.length, state.stills.length) + " clips");
}

function applyClipPairs(pairs, how) {
  const used = new Set();
  for (const p of pairs) {
    const key = slug(p.title || "");
    let still =
      how === "title"
        ? state.stills.find((s) => !used.has(s.id) && (s.stem === key || slug(s.title) === key || s.stem.includes(key)))
        : null;
    if (!still) still = state.stills.find((s) => !used.has(s.id) && !s.videoPrompt.trim());
    if (!still) continue;
    used.add(still.id);
    still.videoPrompt = p.videoPrompt || p.video || "";
    if (p.title && !still.title) still.title = p.title;
    if (p.duration) still.duration = clipDur(p);
  }
  persist();
  renderStills();
  log("Prompts reliés par titre — " + used.size + " clips");
}

function readyStills() {
  return (state.stills || []).filter((s) => !s.skip && s.videoPrompt.trim() && (s.dataUrl || s.chainPrev));
}

function renderStills() {
  const tiles = $("#still-tiles");
  const cards = $("#still-cards");
  if (!tiles || !cards) return;
  tiles.innerHTML =
    (state.stills || [])
      .map((s) => `<div class="tile">${s.dataUrl ? `<img src="${s.dataUrl}" alt="" />` : "<span>↪ suite</span>"}</div>`)
      .join("") + `<button type="button" class="tile-add">Ajouter les images</button>`;
  cards.innerHTML = (state.stills || [])
    .map(
      (s, i) => `<article class="still-card${s.skip ? " skipped" : ""}" data-id="${s.id}">
      ${s.dataUrl ? `<img src="${s.dataUrl}" alt="" />` : `<div class="still-suite">↪ dernière image du clip précédent</div>`}
      <div>
        <div class="still-meta">
          <span>${String(i + 1).padStart(2, "0")} · ${escapeHtml(s.title || s.stem)}</span>
          <div class="tools">
            <button type="button" class="icon-btn" data-act="skip">${s.skip ? "●" : "○"}</button>
            <button type="button" class="icon-btn" data-act="up">↑</button>
            <button type="button" class="icon-btn" data-act="down">↓</button>
            <button type="button" class="icon-btn" data-act="del">✕</button>
          </div>
        </div>
        <input data-field="title" type="text" value="${escapeHtml(s.title || "")}" placeholder="titre = nom du fichier" />
        <textarea data-field="video" placeholder="Prompt vidéo pour cette image">${escapeHtml(s.videoPrompt || "")}</textarea>
        <p class="k tight">Durée du clip</p>
        ${durPillsHtml(s)}
        <p class="stem">${escapeHtml(sceneStem(s, i))}.mp4</p>
      </div>
    </article>`,
    )
    .join("");
  updateMontagePreview();
}

function updateMontagePreview() {
  const el = $("#montage-preview");
  if (!el) return;
  const n = state.stills.length;
  const ready = readyStills().length;
  const miss = state.stills.filter((s) => !s.skip && !s.videoPrompt.trim()).length;
  if (!n) {
    el.textContent = "Aucune image. Dépose tes stills (01-titre.jpg…).";
    return;
  }
  el.textContent = `${n} image${n > 1 ? "s" : ""} · ${ready} clip${ready > 1 ? "s" : ""} prêt${ready > 1 ? "s" : ""}${miss ? " · " + miss + " prompt" + (miss > 1 ? "s" : "") + " manquant" + (miss > 1 ? "s" : "") : ""} · ${state.settings.duration || 6}s ${state.settings.quality || "speed"} ${state.settings.resolution || "480p"} ${state.settings.aspect || "16:9"}`;
}

function filledPairs() {
  return readyPairs();
}

function readyPairs() {
  const pass = state.settings.pass || "both";
  return state.pairs.filter((p) => {
    if (p.skip) return false;
    if (pass === "images") return Boolean(p.imagePrompt.trim());
    if (pass === "videos") return Boolean(p.videoPrompt.trim());
    return Boolean(p.imagePrompt.trim() && p.videoPrompt.trim());
  });
}

function slug(s) {
  const t = String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return t || "scene";
}

function sceneStem(pair, index) {
  const n = String(index + 1).padStart(2, "0");
  const title = (pair.title || "").trim() || pair.imagePrompt || pair.videoPrompt || "scene";
  return n + "-" + slug(title);
}

function log(msg) {
  state.journal = [...(state.journal || []), { t: new Date().toISOString().slice(11, 19), msg: String(msg) }].slice(-200);
  renderJournal();
}

function pairLabel(n) {
  return n <= 1 ? n + " paire" : n + " paires";
}

function updatePreview() {
  const el = $("#lot-preview");
  if (!el) return;
  const cap = Math.max(1, state.settings.maxScenes || 10);
  const nOut = Math.max(1, state.settings.outputs || 1);
  if (state.mode === "montage") {
    const n = Math.min(cap, readyStills().length);
    const miss = state.stills.filter((s) => !s.skip && !s.videoPrompt.trim()).length;
    if (!n) {
      el.textContent = "Stills → Clips : dépose tes images, relie les prompts. 1 image = 1 clip.";
      return;
    }
    el.textContent = `${n} clip${n > 1 ? "s" : ""} × ${nOut} = ${n * nOut} génération${n * nOut > 1 ? "s" : ""} · ${state.settings.duration || 6}s ${state.settings.quality} ${state.settings.resolution}${miss ? " · " + miss + " prompts manquants" : ""}`;
    return;
  }
  if (state.mode === "pipeline") {
    const n = Math.min(cap, filledPairs().length);
    if (!n) {
      el.textContent = "Aucune paire complète. 10 scènes en lot mixte = 10 images + 10 vidéos (1 variante).";
      return;
    }
    const pass = state.settings.pass || "both";
    const img = pass === "videos" ? 0 : n;
    const vid = pass === "images" ? 0 : n;
    const gens = (img + vid) * nOut;
    const parts = [];
    if (img) parts.push(`${img} image${img > 1 ? "s" : ""}`);
    if (vid) parts.push(`${vid} vidéo${vid > 1 ? "s" : ""}`);
    el.textContent = `${n} scène${n > 1 ? "s" : ""} → ${parts.join(" + ")} × ${nOut} = ${gens} génération${gens > 1 ? "s" : ""} Imagine.`;
    return;
  }
  const prompts = ingestPromptSource($("#prompts")?.value || "").prompts;
  const n = Math.min(cap, prompts.length);
  if (!n) {
    el.textContent = "Ajoutez des prompts. 1 variante = 1 pièce par scène.";
    return;
  }
  const video = state.mode === "t2v" || state.mode === "frame2v" || state.mode === "ingredients";
  const kind = video ? "vidéo" : "image";
  const gens = n * nOut;
  el.textContent = `${n} scène${n > 1 ? "s" : ""} × ${nOut} ${kind}${nOut > 1 ? "s" : ""} = ${gens} génération${gens > 1 ? "s" : ""}.`;
}

function renderAll() {
  renderPairs();
  renderRefs();
  renderSrcImages();
  renderStills();
  renderJobs();
  renderJournal();
  setOutputs(state.settings.outputs || 1);
  paintClipPills();
  setPromptInput(state.promptInput || "text", true);
  $$("#pass-pills [data-pass]").forEach((b) =>
    b.classList.toggle("on", b.dataset.pass === (state.settings.pass || "both")),
  );
  updatePreview();
}

function renderPairs() {
  const ready = filledPairs().length;
  $("#pair-count").textContent = pairLabel(ready);
  updatePreview();
  $("#pairs").innerHTML = state.pairs
    .map((p, i) => {
      const stem = sceneStem(p, i);
      return `<article class="card-pair${p.skip ? " skipped" : ""}" data-id="${p.id}">
        <header>
          <span>Scène ${String(i + 1).padStart(2, "0")}</span>
          <div class="tools">
            <button type="button" class="icon-btn" data-act="skip" aria-label="Ignorer">${p.skip ? "●" : "○"}</button>
            <button type="button" class="icon-btn" data-act="up" aria-label="Monter">↑</button>
            <button type="button" class="icon-btn" data-act="down" aria-label="Descendre">↓</button>
            <button type="button" class="icon-btn" data-act="del" aria-label="Retirer">✕</button>
          </div>
        </header>
        <label class="title-row">Titre
          <input data-field="title" type="text" value="${escapeHtml(p.title || "")}" placeholder="ex. phare-crepuscule" />
        </label>
        <p class="stem">${escapeHtml(stem)}.jpg + ${escapeHtml(stem)}.mp4</p>
        <p class="k tight">Durée du clip</p>
        ${durPillsHtml(p)}
        ${pairGauges(p, i)}
        <div class="cols">
          <label>Prompt image
            <textarea data-field="image" placeholder='{ "scene": "…", "subject": "…" }'>${escapeHtml(p.imagePrompt)}</textarea>
          </label>
          <label>Prompt vidéo
            <textarea data-field="video" placeholder='{ "motion": "…", "camera": "…" }'>${escapeHtml(p.videoPrompt)}</textarea>
          </label>
        </div>
      </article>`;
    })
    .join("");
}

function renderRefs() {
  renderTileGroup("chars", "character", "Ajouter un personnage");
  renderTileGroup("locs", "location", "Ajouter un lieu");
  renderTileGroup("props", "prop", "Ajouter un prop");
}

function renderTileGroup(id, kind, label) {
  const items = state.refs.filter((r) => r.kind === kind);
  $("#" + id).innerHTML =
    items
      .map(
        (r) => `<div class="tile">
        <img src="${r.dataUrl}" alt="" />
        <input data-name="${r.id}" value="${escapeHtml(r.name)}" />
        <button type="button" class="icon-btn" data-del="${r.id}" aria-label="Retirer">✕</button>
      </div>`,
      )
      .join("") + `<button type="button" class="tile-add">${label}</button>`;
}

function renderSrcImages() {
  const root = $("#src-images");
  if (!root) return;
  root.innerHTML =
    state.images
      .map(
        (r) => `<div class="tile">
        <img src="${r.dataUrl}" alt="" />
        <button type="button" class="icon-btn" data-del="${r.id}" aria-label="Retirer">✕</button>
      </div>`,
      )
      .join("") + `<button type="button" class="tile-add">Ajouter des images</button>`;
}

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function looksLikeJson(raw) {
  const s = raw.trim();
  return (s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"));
}

// Prompts d'un mode simple : un script « ## Scène » donne ses prompts vidéo (modes vidéo)
// ou image (modes image) au lieu de faire échouer le lancement.
function promptsFromSource(raw) {
  const src = ingestPromptSource(raw);
  if (src.kind !== "pairs") return src.prompts || [];
  const video = ["t2v", "frame2v", "ingredients", "montage"].includes(state.mode);
  return src.pairs.filter((p) => !p.skip)
    .map((p) => (video ? p.videoPrompt || p.imagePrompt : p.imagePrompt || p.videoPrompt))
    .filter(Boolean);
}

function ingestPromptSource(raw) {
  const t = raw.trim();
  if (!t) return { kind: "prompts", prompts: [] };
  if (looksLikeJson(t)) {
    try {
      return ingestJson(JSON.parse(t));
    } catch {
      /* fall through */
    }
  }
  if (looksLikeScript(t)) return { kind: "pairs", pairs: parseSceneScript(t) };
  return {
    kind: "prompts",
    prompts: t
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function ingestJson(data) {
  if (typeof data === "string") return { kind: "prompts", prompts: data.trim() ? [data.trim()] : [] };
  if (Array.isArray(data)) {
    if (
      data.length &&
      data.every((x) => x && typeof x === "object" && (x.image || x.video || x.image_prompt || x.video_prompt))
    ) {
      return {
        kind: "pairs",
        pairs: data.map((x) => ({
          imagePrompt: asText(x.image ?? x.image_prompt ?? x.imagePrompt ?? ""),
          videoPrompt: asText(x.video ?? x.video_prompt ?? x.videoPrompt ?? ""),
          title: asText(x.title ?? x.scene ?? ""),
          skip: Boolean(x.skip),
          duration: clipDur({ duration: x.duration ?? x.video?.duration }),
        })),
      };
    }
    return {
      kind: "prompts",
      prompts: data.map((x) => (typeof x === "string" ? x : asText(x.prompt ?? x))).filter(Boolean),
    };
  }
  if (data && typeof data === "object") {
    if (Array.isArray(data.pairs)) return ingestJson(data.pairs);
    if (Array.isArray(data.prompts)) return ingestJson(data.prompts);
    if (data.image || data.video) {
      return {
        kind: "pairs",
        pairs: [{ imagePrompt: asText(data.image), videoPrompt: asText(data.video) }],
      };
    }
    return { kind: "prompts", prompts: [JSON.stringify(data, null, 2)] };
  }
  return { kind: "prompts", prompts: [] };
}

function applyIngest(ingested) {
  if (ingested.kind === "pairs") {
    if (state.mode === "montage" && state.stills.length) {
      applyClipPairs(ingested.pairs, "title");
      return;
    }
    setMode("pipeline");
    state.pairs = ingested.pairs.map((p) => ({ ...blankPair(), ...p, id: blankPair().id }));
    if (!state.pairs.length) state.pairs = [blankPair()];
    persist();
    renderPairs();
    return;
  }
  if (state.mode === "montage") {
    $("#clip-prompts").value = ingested.prompts.join("\n\n");
    linkClips("order");
    return;
  }
  if (state.mode === "pipeline") {
    state.pairs = ingested.prompts.map((imagePrompt) => ({
      ...blankPair(),
      imagePrompt,
      videoPrompt: "",
    }));
    if (!state.pairs.length) state.pairs = [blankPair()];
    persist();
    renderPairs();
    return;
  }
  $("#prompts").value = ingested.prompts.join("\n\n");
  persist();
}

// Explique pourquoi « Lancer le lot » ne démarre pas (au lieu d'un bouton qui semble inactif).
function runHint(msg) {
  if (msg) log(msg);
  const el = $("#run-hint");
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}

async function runBatch(rebuild, opts = {}) {
  runHint("");
  if (state.running || batchActive) {
    // Pause pas à pas restée ouverte alors qu'il ne reste rien à faire : on la clôt et on relance.
    if (state.paused && !state.jobs.some((j) => j.status === "queued")) {
      state.paused = false;
      for (let i = 0; i < 20 && batchActive; i++) await wait(150);
    }
    if (state.running || batchActive) {
      runHint(state.paused
        ? "Un lot est en pause : clique « Scène suivante » ou « Arrêter » (onglet File) avant d’en lancer un autre."
        : "Un lot est déjà en cours : attends la fin ou clique « Arrêter » (onglet File).");
      return;
    }
  }
  const hasQueued = state.jobs.some((j) => j.status === "queued");
  if (rebuild || !hasQueued) {
    const previousJobs = state.jobs;
    if (state.mode === "montage") {
      const stills = readyStills().slice(0, Math.max(1, state.settings.maxScenes || 15));
      if (!stills.length) return runHint("Stills → vidéo : aucun still prêt (il faut une image et un prompt vidéo).");
      state.jobs = stills.map((s) => {
        const i = Math.max(0, state.stills.indexOf(s));
        return {
          id: `m${Date.now()}_${i}`,
          prompt: s.videoPrompt,
          role: "video",
          pairIndex: i,
          title: s.title || "",
          stem: sceneStem(s, i),
          status: "queued",
          progress: 0,
          urls: [],
          attach: s.dataUrl ? [s.dataUrl] : [],
          clipNum: s.num ?? i + 1,
          chainPrev: Boolean(s.chainPrev && !s.dataUrl),
          savePath: s.savePath || "",
          duration: clipDur(s),
          framePair: "startOnly",
          agnes: s.agnes,
        };
      });
    } else if (state.mode === "pipeline") {
      const pairs = filledPairs().slice(0, Math.max(1, state.settings.maxScenes || 10));
      if (!pairs.length) return runHint("Aucune paire image/vidéo remplie.");
      const pass = state.settings.pass || "both";
      if (pass === "videos" && pairs.some((p) => !previousJobs.some((j) =>
        j.role === "image" && j.status === "done" && j.urls?.length &&
        j.sourcePairId === p.id && j.prompt === p.imagePrompt))) {
        runHint("Vidéos seules : générez d’abord les images de ces paires avec « Images seules ».");
        return;
      }
      state.jobs = pairs.flatMap((p) => {
        const i = Math.max(0, state.pairs.indexOf(p));
        const pairId = `p${Date.now()}_${i}`;
        const imageId = `${pairId}_img`;
        const stem = sceneStem(p, i);
        const jobs = [];
        if (pass !== "videos") {
          jobs.push({
            id: imageId,
            prompt: p.imagePrompt,
            pairedPrompt: p.videoPrompt,
            role: "image",
            sourcePairId: p.id,
            pairId,
            pairIndex: i,
            agnes: p.agnes,
            clipNum: p.num,
            title: p.title || "",
            stem,
            status: "queued",
            progress: 0,
            urls: [],
          });
        }
        if (pass !== "images") {
          jobs.push({
            id: `${pairId}_vid`,
            prompt: p.videoPrompt,
            pairedPrompt: p.imagePrompt,
            role: "video",
            sourcePairId: p.id,
            pairId,
            pairIndex: i,
            agnes: p.agnes,
            clipNum: p.num,
            title: p.title || "",
            stem,
            parentId: pass === "videos" ? undefined : imageId,
            status: "queued",
            progress: 0,
            urls: [],
            attach: pass === "videos" ? [previousJobs.find((j) =>
              j.role === "image" && j.status === "done" && j.urls?.length &&
              j.sourcePairId === p.id && j.prompt === p.imagePrompt).urls[0]] : [],
            framePair: "startOnly",
            duration: clipDur(p),
          });
        }
        return jobs;
      });
    } else if (state.mode === "frame2v") {
      const prompts = promptsFromSource($("#prompts").value);
      if (!prompts.length) return runHint("Image → Vidéo : écris au moins un prompt.");
      if (!state.images.length) return runHint("Image → Vidéo : ajoute au moins une image de départ.");
      const startEnd = (state.settings.framePair || "startEnd") === "startEnd";
      const count = Math.min(prompts.length, Math.max(1, state.settings.maxScenes || 15));
      if (startEnd && (state.images.length < 2 || (state.images.length !== 2 && state.images.length < count * 2))) {
        return runHint("Début + fin : fournissez deux images communes, ou deux images par prompt.");
      }
      if (!startEnd && state.images.length !== 1 && state.images.length < count) {
        return runHint("Image → Vidéo : fournissez une image commune, ou une image par prompt.");
      }
      if (startEnd && prompts.length === 1) {
        state.jobs = [
          {
            id: `j${Date.now()}_0`,
            prompt: prompts[0],
            role: "video",
            status: "queued",
            progress: 0,
            urls: [],
            pairIndex: 0,
            stem: sceneStem({ title: state.images[0].name || "clip", imagePrompt: prompts[0] }, 0),
            attach: state.images.slice(0, 2).map((img) => img.dataUrl),
            framePair: "startEnd",
          },
        ];
      } else if (startEnd) {
        state.jobs = prompts.slice(0, Math.max(1, state.settings.maxScenes || 15)).map((prompt, i) => ({
          id: `j${Date.now()}_${i}`,
          prompt,
          role: "video",
          status: "queued",
          progress: 0,
          urls: [],
          pairIndex: i,
          stem: sceneStem({ title: "", imagePrompt: prompt }, i),
          attach: [
            (state.images[i * 2] || state.images[0]).dataUrl,
            (state.images[i * 2 + 1] || state.images[1] || state.images[0]).dataUrl,
          ],
          framePair: "startEnd",
        }));
      } else {
        state.jobs = prompts.slice(0, Math.max(1, state.settings.maxScenes || 15)).map((prompt, i) => ({
          id: `j${Date.now()}_${i}`,
          prompt,
          role: "video",
          status: "queued",
          progress: 0,
          urls: [],
          pairIndex: i,
          stem: sceneStem({ title: "", imagePrompt: prompt }, i),
          attach: [(state.images[i] || state.images[0]).dataUrl],
          framePair: "startOnly",
        }));
      }
    } else {
      const prompts = promptsFromSource($("#prompts").value);
      if (!prompts.length) return runHint("Aucun prompt : écris ou colle au moins un prompt.");
      if (needsImages(state.mode) && state.mode !== "ingredients" && !state.images.length) return runHint("Ce mode nécessite au moins une image.");
      if (state.mode === "i2i" && state.images.length !== 1 && state.images.length < Math.min(prompts.length, state.settings.maxScenes || 10)) {
        return runHint("Image → Image : fournissez une image commune, ou une image par prompt.");
      }
      state.jobs = prompts.slice(0, Math.max(1, state.settings.maxScenes || 10)).map((prompt, i) => ({
        id: `j${Date.now()}_${i}`,
        prompt,
        status: "queued",
        progress: 0,
        urls: [],
        pairIndex: i,
        stem: sceneStem({ title: "", imagePrompt: prompt }, i),
        attach:
          state.mode === "ingredients"
            ? state.images.map((img) => img.dataUrl)
            : state.mode !== "i2i" ? [] : state.images[i]
              ? [state.images[i].dataUrl]
              : state.images[0]
                ? [state.images[0].dataUrl]
                : [],
      }));
    }
    for (const job of state.jobs) {
      job.mode = state.mode;
      job.settings = { ...state.settings };
      job.role ||= ["t2v", "frame2v", "ingredients", "montage"].includes(state.mode) ? "video" : "image";
      job.duration = clipDur(job);
      // Mode Ingrédients : les références SONT la matière du clip, on les envoie toutes.
      const selection = state.mode === "ingredients" && state.settings.referenceSelection !== "none"
        ? "all" : state.settings.referenceSelection || "matching";
      job.references = (selection === "none" ? [] : selection === "matching"
        ? refsForPrompt(job.prompt + "\n" + (job.pairedPrompt || "")) : state.refs)
        .filter((r) => r.dataUrl).map(({ name, kind, dataUrl }) => ({ name, kind, dataUrl }));
    }
  }
  // Règle : Grok ne fabrique que des vidéos (une génération d'image force plusieurs générations décomptées)
  if (state.settings.grokVideoOnly !== false && state.jobs.some((j) => j.status === "queued" && j.role === "image")) {
    state.jobs = state.jobs.filter((j) => j.role !== "image" || j.status !== "queued");
    return runHint("Grok est réservé à la vidéo (Réglages → « Grok : vidéo uniquement ») : faites les images avec ChatGPT ou Agnes, puis utilisez Stills → Clips.");
  }
  if (!state.jobs.some((j) => j.status === "queued")) return runHint("Rien à lancer.");
  if (rebuild && state.settings.lint !== false && !opts.pilot) {
    const issues = lintJobs(state.jobs.filter((j) => j.status === "queued"));
    const sig = JSON.stringify(issues);
    if (issues.length && lintAcknowledged !== sig) {
      lintAcknowledged = sig;
      runHint(`Contrôle : ${issues.length} point(s) à vérifier — ` +
        issues.slice(0, 5).map((x) => `${x.stem} : ${x.msg}`).join(" · ") +
        (issues.length > 5 ? " …" : "") + " — Corrige, ou clique à nouveau sur « Lancer le lot » pour lancer quand même.");
      for (const x of issues) log(`⚠ ${x.stem} : ${x.msg}`);
      return;
    }
  }
  lintAcknowledged = "";
  state.running = true;
  state.paused = false;
  batchActive = true;
  log("Lot lancé — " + (state.mode === "montage" ? "stills→clips" : state.settings.pass || "both") + " × " + state.settings.outputs);
  startProgressTick();
  persist();
  $$("[data-tab]").find((b) => b.dataset.tab === "queue")?.click();
  renderJobs();

  try {
    const ping = await chromeApi.runtime.sendMessage({
      type: "SEND_TO_TAB",
      payload: { type: "PING" },
    });
    if (!ping?.ok) {
      failAll(
        ping?.error ||
          "Onglet grok.com/imagine introuvable. Ouvrez la page, rechargez-la (F5), puis Correction rapide.",
      );
      return;
    }

    // All jobs drive the same Imagine tab and must run sequentially.
    await worker();
  } catch (err) {
    failAll("Lot interrompu : " + (err?.message || String(err)));
    return;
  } finally {
    batchActive = false;
  }
  stopProgressTick();
  if (state.running) state.running = false;
  persist();
  renderJobs();
  if (state.jobs.some((j) => j.status === "done")) {
    await makeContactSheet().catch(() => {});
    if (state.jobs.some((j) => j.status === "done" && (j.role === "video" || !j.role))) {
      await assembleComplete().catch(() => {});
    }
  }
}

function parentReady(job) {
  if (!job.parentId) return true;
  const parent = state.jobs.find((p) => p.id === job.parentId);
  return parent?.status === "done";
}

async function worker() {
  while (state.running) {
    for (const child of state.jobs.filter((j) => j.status === "queued" && j.parentId)) {
      const parent = state.jobs.find((j) => j.id === child.parentId);
      if (!parent || ["error", "cancelled"].includes(parent.status) || (parent.status === "done" && !parent.urls?.length)) {
        child.status = "error";
        child.error = "L’image source de cette scène n’a pas été générée.";
      }
    }
    const job = state.jobs.find((j) => j.status === "queued" && parentReady(j));
    if (!job) {
      const blocked = state.jobs.some(
        (j) =>
          j.status === "queued" &&
          j.parentId &&
          state.jobs.some((p) => p.id === j.parentId && (p.status === "running" || p.status === "queued")),
      );
      if (blocked) {
        await wait(400);
        continue;
      }
      return;
    }
    job.status = "running";
    job.progress = 8;
    persist();
    renderJobs();
    if (state.settings.delay) await wait(state.settings.delay);
    if (!state.running) return;
    const settings = job.settings || state.settings;
    const mode = job.mode || state.mode;
    const kind =
      job.role === "video"
        ? "video"
        : job.role === "image"
          ? "image"
          : mode === "t2v" || mode === "frame2v" || mode === "ingredients" || mode === "montage"
            ? "video"
            : "image";
    const grokMode =
      mode === "pipeline"
        ? job.role === "video"
          ? "frame2v"
          : "t2i"
        : mode === "montage"
          ? "frame2v"
          : mode;
    const parent = job.parentId ? state.jobs.find((j) => j.id === job.parentId) : null;
    if (job.chainPrev) {
      const prev = state.jobs[state.jobs.indexOf(job) - 1];
      try {
        if (!prev || prev.status !== "done" || !prev.urls?.length) throw new Error("le clip précédent n’a pas été généré");
        job.attach = [await lastFrameOf(await (await fetch(prev.urls[0])).blob())];
      } catch (err) {
        job.status = "error";
        job.error = "Suite : " + err.message;
        persist();
        renderJobs();
        continue;
      }
    }
    const images = parent ? parent.urls.slice(0, 1) : (job.attach || []);
    const references = job.references || [];
    const attachments = kind === "video" ? [
      ...images.map((url, i) => ({ url, role: grokMode === "ingredients" ? "reference" : i === 1 && job.framePair === "startEnd" ? "last" : "first", name: `Scène ${i + 1}` })),
      ...references.map((r) => ({ url: r.dataUrl, role: "reference", name: r.name || r.kind || "Référence" })),
    ] : [];
    log(`${job.stem || "Scène"} : ${images.length} image(s) de scène, ${references.length} référence(s)` +
      (references.length ? " — " + references.map((r) => r.name || r.kind).join(", ") : ""));
    const res = await chromeApi.runtime.sendMessage({
      type: "SEND_TO_TAB",
      payload: {
        type: "SUBMIT_PROMPT",
        prompt: promptForGrok(job.prompt, kind),
        mediaKind: kind,
        grokMode,
        aspectRatio: settings.aspect,
        outputs: Math.max(1, Math.min(4, settings.outputs || 1)),
        preferSpeed: (settings.quality || "speed") === "speed",
        force480p: (settings.resolution || "480p") === "480p",
        duration: clipDur(job),
        quality: settings.quality || "speed",
        resolution: settings.resolution || "480p",
        timeoutMs: /1080/.test(String(settings.resolution || "")) ? 360000 : /720/.test(String(settings.resolution || "")) ? 240000 : 180000,
        images: kind === "video" ? images : [...images, ...references.map((r) => r.dataUrl)],
        attachments,
        framePair: kind === "video" && grokMode === "frame2v" ? (job.framePair || "startOnly") : "",
      },
    });
    if (!state.running) return;
    if (!res?.ok) {
      if (/arr[eê]t/i.test(res?.error || "")) {
        job.status = "cancelled";
        job.error = "Arrêté";
      } else if (/quota|limit|crédits|credits|upgrade|supergrok|too many/i.test(res?.error || "")) {
        job.status = "error";
        job.error = res.error;
        await stopBatch();
        failAll("Quota Imagine atteint — lot en pause.");
        return;
      } else {
        job.status = "error";
        job.error = res?.error || "Échec";
      }
    } else {
      job.status = "done";
      job.progress = 100;
      job.urls = (res.urls || []).slice(0, Math.max(1, Math.min(4, settings.outputs || 1)));
      const stem = job.stem || sceneStem({ title: job.title, imagePrompt: job.prompt }, job.pairIndex || 0);
      const ext = kind === "video" ? "mp4" : "jpg";
      const sub =
        kind === "video" ? state.settings.dirClips || "Clip video" : state.settings.dirImages || "Images";
      for (const url of job.urls) {
        await saveDownload(url, sub, stem, ext);
        if (kind === "video" && state.settings.copyComplete) {
          await saveDownload(url, state.settings.dirComplete || "Video complete", stem, ext);
        }
      }
      if (job.savePath && job.urls[0]) {
        try {
          log("Rangé → " + (await saveToBridge(job.urls[0], job.savePath)));
        } catch (err) {
          log(`Pont : ${stem} non rangé dans l’épisode (${err.message}) — copie dans Téléchargements seulement.`);
        }
      }
      log(`${kind === "video" ? "Clip" : "Image"} ${stem}.${ext}`);
      // Plan venu d'Agnes : le rendu devient une prise du plan (agnes-bridge.js).
      if (job.agnes && typeof onAgnesJobDone === "function") void onAgnesJobDone(job, kind);
    }
    if (res?.ok && res.surplus > 0) {
      // Grok a généré plus que demandé pour un seul envoi : lot arrêté avant de consommer davantage de quota.
      log(`⚠ Grok a lancé ${res.surplus} génération(s) de plus que demandé pour ${job.stem || "ce plan"} — lot arrêté. Vérifiez l'onglet Grok avant de relancer.`);
      persist();
      failAll(`Arrêt de sécurité : Grok a généré ${res.surplus} vidéo(s) en trop.`);
      return;
    }
    persist();
    renderJobs();
    // Pas à pas : pause entre deux scènes seulement (jamais après la dernière, sinon le lot reste bloqué).
    if (state.running && state.settings.step && state.jobs.some((j) => j.status === "queued")) {
      state.paused = true;
      persist();
      renderJobs();
      log("Pause — Scène suivante");
      $$("[data-tab]").find((b) => b.dataset.tab === "queue")?.click();
      while (state.running && state.paused) await wait(250);
    }
  }
}

function failAll(error) {
  state.jobs = state.jobs.map((j) =>
    j.status === "queued" || j.status === "running" ? { ...j, status: "error", error } : j,
  );
  state.running = false;
  state.paused = false;
  stopProgressTick();
  persist();
  renderJobs();
}

function exportLot() {
  const payload = {
    lumina: 1,
    mode: state.mode,
    pairs: state.pairs.map((p) => ({
      title: p.title || "",
      skip: Boolean(p.skip),
      image: p.imagePrompt,
      video: p.videoPrompt,
      duration: clipDur(p),
    })),
    prompts: $("#prompts")?.value || "",
    settings: {
      aspect: state.settings.aspect,
      outputs: state.settings.outputs,
      pass: state.settings.pass,
      maxScenes: state.settings.maxScenes,
      continuity: state.settings.continuity,
    },
  };
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lot.json";
  a.click();
  URL.revokeObjectURL(a.href);
  const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(text);
  void saveDownload(dataUrl, state.settings.dirScript || "Script", "lot", "json");
  log("Export lot.json");
}

async function saveDownload(url, sub, stem, ext) {
  const base = state.settings.folder || "Lumina";
  const filename = `${base}/${sub}/${stem}.${ext}`;
  try {
    await chromeApi.runtime.sendMessage({ type: "DOWNLOAD", url, filename });
  } catch (err) {
    log("Échec download " + filename);
  }
}

function renderJournal() {
  const el = $("#journal");
  if (!el) return;
  const lines = state.journal || [];
  el.textContent = lines.length ? lines.map((l) => l.t + "  " + l.msg).join("\n") : "Journal vide.";
}

function renderJobs() {
  const next = $("#next");
  if (next) next.hidden = !state.paused;
  const bar = $("#step-bar");
  const lab = $("#step-label");
  if (bar) bar.classList.toggle("show", Boolean(state.paused));
  if (bar) bar.hidden = !state.paused;
  if (lab && state.paused) {
    const done = state.jobs.filter((j) => j.status === "done").length;
    const total = state.jobs.length;
    lab.textContent = `Scène ${done} / ${total} terminée — clique Scène suivante`;
  }
  const root = $("#jobs");
  if (!state.jobs.length) {
    root.className = "empty";
    root.textContent = "Aucun job. Composez un lot, puis lancez.";
    return;
  }
  root.className = "";
  const groups = [];
  for (const job of state.jobs) {
    const key = job.pairId || job.id;
    let g = groups.find((x) => x.id === key);
    if (!g) {
      g = { id: key, index: job.pairIndex ?? groups.length, jobs: [] };
      groups.push(g);
    }
    g.jobs.push(job);
  }
  root.innerHTML = groups
    .map((g) => {
      const head = g.jobs.some((j) => j.pairId)
        ? `<p class="k">Paire ${String(g.index + 1).padStart(2, "0")}</p>`
        : "";
      return (
        head +
        g.jobs
          .map((j) => {
            const waiting =
              j.status === "queued" && j.parentId && state.jobs.find((p) => p.id === j.parentId)?.status !== "done";
            const pill =
              j.status === "running" ? "run" : j.status === "done" ? "ok" : j.status === "error" ? "err" : waiting ? "wait" : "";
            const label = waiting ? "attend l’image" : j.status;
            const role = j.role === "video" ? "Vidéo" : j.role === "image" ? "Image" : "";
            const thumb = j.urls?.[0] && !/\.mp4|video/i.test(j.urls[0]) ? j.urls[0] : "";
            const parentThumb = j.parentId ? state.jobs.find((p) => p.id === j.parentId)?.urls?.[0] : "";
            const img = thumb || parentThumb;
            return `<article class="job">
        <div class="meta">
          ${img ? `<img src="${escapeHtml(img)}" alt="" />` : `<span class="ph"></span>`}
          <span class="pill ${pill}">${label}</span>
        </div>
        <div class="role">${escapeHtml(role)}</div>
        <div class="prompt">${escapeHtml(j.prompt)}</div>
        ${j.pairedPrompt ? `<div class="paired">${escapeHtml(j.pairedPrompt)}</div>` : ""}
        ${gaugeHtml(j)}
        ${j.error ? `<div class="err">${escapeHtml(j.error)}</div>` : ""}
      </article>`;
          })
          .join("")
      );
    })
    .join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#39;";
  });
}

function gaugePct(job) {
  if (!job) return 0;
  if (job.status === "done") return 100;
  if (job.status === "queued") return 0;
  if (job.status === "cancelled") return job.progress || 0;
  return Math.max(0, Math.min(100, job.progress || 0));
}

function gaugeHtml(job) {
  if (!job) return `<div class="gauge" data-st="queued"><i style="width:0%"></i></div>`;
  return `<div class="gauge" data-st="${job.status}" data-gauge="${job.id}"><i style="width:${gaugePct(job)}%"></i></div>`;
}

function pairGauges(pair, index) {
  const img = state.jobs.find((j) => j.pairIndex === index && j.role === "image");
  const vid = state.jobs.find((j) => j.pairIndex === index && j.role === "video");
  if (!img && !vid) {
    return `<div class="gauge twin" data-st="queued"><i style="width:0%"></i></div>
            <div class="gauge twin" data-st="queued"><i style="width:0%"></i></div>`;
  }
  return (img ? gaugeHtml(img) : `<div class="gauge twin" data-st="queued"><i></i></div>`) +
    (vid ? gaugeHtml(vid) : `<div class="gauge twin" data-st="queued"><i></i></div>`);
}

let progressTimer = 0;
function startProgressTick() {
  stopProgressTick();
  progressTimer = setInterval(() => {
    let n = 0;
    for (const j of state.jobs) {
      if (j.status === "running") {
        j.progress = Math.min(92, (j.progress || 8) + 3);
        n++;
      }
    }
    if (n) paintGauges();
  }, 700);
}
function stopProgressTick() {
  clearInterval(progressTimer);
  progressTimer = 0;
}
function paintGauges() {
  for (const j of state.jobs) {
    const bar = document.querySelector(`[data-gauge="${j.id}"]`);
    if (!bar) continue;
    bar.dataset.st = j.status;
    const i = bar.querySelector("i");
    if (i) i.style.width = gaugePct(j) + "%";
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseDurToken(text) {
  const m = String(text || "").match(/\b(6|10|15)\s*s(?:ec(?:ondes?)?)?\b/i);
  return m ? Number(m[1]) : undefined;
}

function looksLikeScript(raw) {
  return /^#{1,3}\s+\S+/m.test(raw.trim());
}

function parseSceneScript(raw) {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const chunks = text.split(/^#{1,3}\s+/m).map((s) => s.trim()).filter(Boolean);
  return chunks.map((block) => {
    const nl = block.indexOf("\n");
    const title = (nl < 0 ? block : block.slice(0, nl)).trim().replace(/#+$/, "").trim();
    const body = nl < 0 ? "" : block.slice(nl + 1).trim();
    let imagePrompt = body;
    let videoPrompt = "";
    const split = body.split(/^\s*(?:#{2,3}\s*)?(?:vid[eé]o|video|motion|clip)\s*:?\s*$/im);
    if (split.length > 1) {
      imagePrompt = split[0].trim();
      videoPrompt = split.slice(1).join("\n").trim();
    } else {
      const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      if (paras.length >= 2) {
        imagePrompt = paras[0];
        videoPrompt = paras.slice(1).join("\n\n");
      }
    }
    return { title, imagePrompt, videoPrompt, skip: false, duration: clipDur({ duration: parseDurToken(title + "\n" + videoPrompt) }) };
  }).filter((p) => p.title || p.imagePrompt || p.videoPrompt);
}

// ── Contrôle qualité des prompts (mêmes règles que prod-fruits/controle.py) ──
let lintAcknowledged = "";
const WORD_BUDGET = { 6: 12, 10: 22, 15: 33 };

function lintJobs(jobs) {
  const chars = state.refs.filter((r) => r.kind === "character").map((r) => refKey(r.name)).filter(Boolean);
  const out = [];
  for (const job of jobs) {
    const stem = job.stem || "scène";
    for (const msg of lintPrompt(job.prompt, job.role === "video" ? "video" : "image", clipDur(job), chars)) {
      out.push({ stem, msg });
    }
    if (job.role !== "video" || !job.references || job.attach?.length || job.chainPrev) continue;
    const sent = new Set(job.references.map((r) => refKey(r.name)));
    const seen = visibleCharacters(String(job.prompt).toLowerCase(), chars);
    const missing = seen.filter((k) => !sent.has(k));
    if (missing.length) out.push({ stem, msg: "sans référence envoyée : " + missing.join(", ") });
  }
  return out;
}

function visibleCharacters(low, chars) {
  const norm = refKey(low).replace(/-/g, " ");
  const withDna = chars.filter((k) => new RegExp(`\\b${k.replace(/-/g, " ")}, (the adult|her head|his head)`).test(norm));
  if (withDna.length) return withDna;
  return chars.filter((k) => new RegExp(`\\b${k.replace(/-/g, " ")}\\b`).test(norm) &&
    !new RegExp(`\\b${k.replace(/-/g, " ")}\\b[^.]{0,40}off[- ]screen`).test(norm));
}

function lintPrompt(prompt, kind, duration, chars) {
  const text = String(prompt || "");
  const low = text.toLowerCase();
  const issues = [];
  const lines = [...text.matchAll(/«([\s\S]*?)»/g)].map((m) => m[1]);
  if (kind === "image") {
    if (lines.length && state.settings.cleanImage === false) issues.push("dialogue dans le prompt image (sous-titres incrustés)");
    return issues;
  }
  const words = lines.reduce((n, l) => n + (l.match(/[\wÀ-ÿ'’-]+/g) || []).length, 0);
  const budget = WORD_BUDGET[duration] || Math.round(duration * 2.2);
  if (words > budget) issues.push(`dialogue trop long : ${words} mots pour ${duration} s (max ${budget})`);
  const seen = visibleCharacters(low, chars);
  const speakers = new Set();
  for (const m of text.matchAll(/«/g)) {
    const before = low.slice(Math.max(0, m.index - 220), m.index);
    let best = null, at = -1;
    for (const k of seen) {
      const i = before.lastIndexOf(k.replace(/-/g, " "));
      if (i > at) { at = i; best = k; }
    }
    if (best) speakers.add(best);
  }
  if (speakers.size > 1) issues.push(`${speakers.size} locuteurs (${[...speakers].join(", ")}) : un seul par plan`);
  if (seen.length >= 2 && !/looks? (directly )?at|eyes on|facing each other|gazes? at|eyeline/i.test(text)) {
    issues.push("regards non indiqués (« looks directly at… », « eyes on… »)");
  }
  if (seen.length >= 2 && lines.length && !/only \w+ speaks|does not speak|listens/i.test(text)) {
    issues.push("préciser qui écoute (« X listens… », « Only X speaks »)");
  }
  if (!/no music/i.test(text)) issues.push("« No music » absent");
  return issues;
}

// Clé de référence : sans accents, minuscules, sans extension, espaces/_ → tirets
// (« France Travail », « France-Travail.png », « @france-travail » → « france-travail »).
function refKey(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\.(png|jpe?g|webp|gif)$/, "").trim().replace(/[\s_]+/g, "-");
}

const TAG_LINE_RE = /^[ \t]*(?:@[\w-]+[ \t]*)+$/gm;

function promptTags(text) {
  return (String(text || "").match(TAG_LINE_RE) || []).flatMap((l) => l.match(/@[\w-]+/g) || []).map((t) => refKey(t.slice(1)));
}

// Texte réellement envoyé à Grok : sans ligne @tags ni étiquette « IMAGE: ».
function promptForGrok(text, kind) {
  let t = String(text || "").replace(TAG_LINE_RE, "").replace(/^\s*image\s*:\s*/i, "").trim();
  if (kind === "image" && state.settings.cleanImage !== false) t = imageWithoutDialogue(t);
  if (state.settings.appendRules !== false) t = withPermanentRules(t, kind);
  return t;
}

// Règles de tous les projets, ajoutées si le prompt ne les contient pas déjà :
// jeu humain et subtil, regards vers l'interlocuteur, image nette sans grain, pas de musique.
function withPermanentRules(text, kind) {
  const add = [];
  if (!/subtle/i.test(text)) {
    add.push(kind === "video"
      ? "Natural human behaviour, subtle restrained acting, calm natural conversational voices, no exaggerated expressions; whoever speaks looks at the person they are talking to."
      : "Human, natural body language, subtle restrained expression.");
  }
  if (!/no film grain/i.test(text)) add.push("Tack-sharp, crisp image, no film grain, no noise.");
  if (kind === "video" && !/no music/i.test(text)) add.push("No music. No song. Ambient sound only.");
  return add.length ? `${text} ${add.join(" ")}` : text;
}

// Une image ne doit contenir ni réplique ni texte : sinon Grok incruste des sous-titres.
function imageWithoutDialogue(text) {
  let t = String(text).replace(/«[\s\S]*?»/g, "")
    .replace(/,?\s*and (says|speaks|asks|replies|whispers|answers)[^.:]*:\s*/gi, ". ")
    .replace(/[ \t]+/g, " ").replace(/\s+([.,])/g, "$1").trim();
  if (!/no (on-screen )?text|no subtitles/i.test(t)) {
    t += " No text, no letters, no subtitles, no captions; any signage is blurred and unreadable.";
  }
  return t;
}

function refsForPrompt(text) {
  const tags = promptTags(text);
  const names = [];
  try {
    const j = JSON.parse(text);
    const bag = []
      .concat(j.characters || [], j.character || [], j.location || [], j.locations || [], j.props || [], j.prop || [])
      .map((x) => String(x).toLowerCase());
    names.push(...bag);
  } catch {
    /* plain text */
  }
  const blob = String(text).toLowerCase();
  const keyBlob = refKey(blob);
  return state.refs.filter((r) => {
    const n = (r.name || "").toLowerCase().trim();
    const k = refKey(r.name);
    if (!k) return false;
    if (names.includes(n) || names.map(refKey).includes(k)) return true;
    // Avec une ligne @tags, elle fait foi (les lieux décrits en périphrase y sont nommés).
    if (tags.length) return tags.includes(k);
    return blob.includes(n) || keyBlob.includes(k);
  });
}

function doneStills() {
  return state.jobs
    .filter((j) => j.status === "done" && j.role !== "video")
    .sort((a, b) => (a.pairIndex || 0) - (b.pairIndex || 0));
}

function doneClips() {
  return state.jobs
    .filter((j) => j.status === "done" && (j.role === "video" || (!j.role && /\.mp4|video/i.test(j.urls?.[0] || ""))))
    .sort((a, b) => (a.pairIndex || 0) - (b.pairIndex || 0));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = url;
  });
}

async function makeContactSheet() {
  const stills = doneStills().filter((j) => j.urls?.[0]);
  if (!stills.length) {
    log("Planche : aucune image terminée");
    return;
  }
  const cols = Math.min(4, stills.length);
  const rows = Math.ceil(stills.length / cols);
  const cellW = 320;
  const cellH = 220;
  const pad = 12;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellW + pad * 2;
  canvas.height = rows * cellH + pad * 2 + 36;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0c0e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e8e6df";
  ctx.font = "14px Segoe UI, sans-serif";
  ctx.fillText("Lumina — planche", pad, 24);
  for (let i = 0; i < stills.length; i++) {
    const job = stills[i];
    const x = pad + (i % cols) * cellW;
    const y = 40 + Math.floor(i / cols) * cellH;
    ctx.fillStyle = "#141518";
    ctx.fillRect(x, y, cellW - 8, cellH - 8);
    try {
      const img = await loadImage(job.urls[0]);
      const iw = cellW - 16;
      const ih = cellH - 36;
      ctx.drawImage(img, x + 4, y + 4, iw, ih);
    } catch {
      ctx.fillStyle = "#1b3a6b";
      ctx.fillRect(x + 4, y + 4, cellW - 16, cellH - 36);
    }
    ctx.fillStyle = "#e8e6df";
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.fillText((job.stem || sceneStem({ title: job.title }, job.pairIndex || i)).slice(0, 36), x + 6, y + cellH - 14);
  }
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  await saveDownload(dataUrl, state.settings.dirScript || "Script", "planche", "jpg");
  log("Planche miniatures → Script/planche.jpg");
}

async function assembleComplete() {
  const clips = doneClips().filter((j) => j.urls?.[0]);
  if (!clips.length) {
    log("Assembler : aucun clip terminé");
    return;
  }
  const dirClips = state.settings.dirClips || "Clip video";
  const lines = clips.map((j) => `file '../${dirClips}/${j.stem || sceneStem({ title: j.title }, j.pairIndex || 0)}.mp4'`);
  const concat = lines.join("\n") + "\n";
  const concatUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(concat);
  await saveDownload(concatUrl, state.settings.dirScript || "Script", "concat", "txt");

  const bat = `@echo off
cd /d "%~dp0"
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy "..\\${state.settings.dirComplete || "Video complete"}\\film.mp4"
if errorlevel 1 (
  echo Installez ffmpeg et relancez assembler.bat depuis le dossier Script.
  pause
)
`;
  await saveDownload("data:text/plain;charset=utf-8," + encodeURIComponent(bat), state.settings.dirScript || "Script", "assembler", "bat");

  const items = clips.map((j) => ({
    src: j.urls[0],
    title: j.stem || j.title || "scene",
  }));
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"/><title>Lumina — Video complete</title>
<style>
body{margin:0;background:#0b0c0e;color:#e8e6df;font:14px/1.4 Segoe UI,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px}
video{width:100%;background:#000}
ol{padding-left:18px;color:#8b8d93}
</style>
<main>
<h1>Video complete</h1>
<p id="now"></p>
<video id="v" controls autoplay></video>
<ol>${items.map((it) => `<li>${escapeHtml(it.title)}</li>`).join("")}</ol>
</main>
<script>
const clips = ${JSON.stringify(items)};
const v = document.getElementById("v");
const now = document.getElementById("now");
let i = 0;
function play(n){
  i = n;
  if (!clips[i]) return;
  now.textContent = (i+1) + " / " + clips.length + " — " + clips[i].title;
  v.src = clips[i].src;
  v.play();
}
v.addEventListener("ended", () => play(i+1));
play(0);
</script>`;
  await saveDownload(
    "data:text/html;charset=utf-8," + encodeURIComponent(html),
    state.settings.dirComplete || "Video complete",
    "playlist",
    "html",
  );
  log("Video complete : playlist.html + Script/concat.txt + assembler.bat");
}

// ── Zoom Controller ──────────────────────────────────────────
const zoomSelect = $("#global-zoom-select");
function applyLuminaZoom(val) {
  if (document?.documentElement?.style) {
    document.documentElement.style.setProperty("--ui-zoom", val);
    document.documentElement.style.zoom = val;
  }
  if (chromeApi?.storage?.local) {
    chromeApi.storage.local.set({ luminaZoom: val });
  }
}

if (zoomSelect) {
  if (chromeApi?.storage?.local) {
    chromeApi.storage.local.get(["luminaZoom"]).then((bag) => {
      const saved = bag.luminaZoom || "1.15";
      zoomSelect.value = saved;
      applyLuminaZoom(saved);
    });
  } else {
    applyLuminaZoom("1.15");
  }

  zoomSelect.addEventListener("change", (e) => {
    applyLuminaZoom(e.target.value);
  });
}

/* Runner de file pilotée par Claude Code (moteur GROK IMAGINE).
 *
 * Tire les jobs "grok" déposés dans le pont local (prod-fruits/lumina_bridge.py),
 * génère via l'onglet grok.com/imagine (SUBMIT_PROMPT → res.urls), et enregistre
 * le média dans le dossier projet via le pont (plus via Téléchargements).
 */
const BRIDGE = 'http://127.0.0.1:8177';

async function bridgeFetch(path, init) {
  let r;
  try {
    r = await fetch(BRIDGE + path, init);
  } catch (e) {
    throw new Error('Pont injoignable sur ' + BRIDGE + ' (lance lumina_bridge.py).');
  }
  if (!r.ok) throw new Error('pont ' + path + ' → HTTP ' + r.status);
  return r.json();
}

function bridgePost(path, body) {
  return bridgeFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* Envoie UN prompt à Grok et renvoie l'URL du rendu.
 * opts = { startUrl?, aspect?, duration? } — startUrl = image de départ (image→vidéo). */
async function grokSubmit(prompt, kind, opts = {}) {
  const ping = await chromeApi.runtime.sendMessage({ type: 'SEND_TO_TAB', payload: { type: 'PING' } });
  if (!ping?.ok) throw new Error(ping?.error || 'Onglet grok.com/imagine introuvable (ouvre-le puis F5).');

  const s = state.settings;
  const startUrl = opts.startUrl || null;
  const grokMode = kind === 'video' ? (startUrl ? 'frame2v' : 't2v') : 't2i';
  // Image : les références des persos/lieux du plan partent avec le prompt (identité fruit).
  const images = startUrl ? [startUrl] : kind === 'image' ? (opts.refs || []) : [];
  const attachments = (kind === 'video' && startUrl)
    ? [{ url: startUrl, role: 'first', name: 'Scène 1' }] : [];

  const res = await chromeApi.runtime.sendMessage({
    type: 'SEND_TO_TAB',
    payload: {
      type: 'SUBMIT_PROMPT',
      prompt,
      mediaKind: kind,
      grokMode,
      aspectRatio: opts.aspect || s.aspect || '9:16',
      outputs: 1,
      preferSpeed: (s.quality || 'speed') === 'speed',
      force480p: (s.resolution || '480p') === '480p',
      duration: opts.duration || s.duration || 6,
      quality: s.quality || 'speed',
      resolution: s.resolution || '480p',
      timeoutMs: 240000,
      images,
      attachments,
      framePair: (kind === 'video' && startUrl) ? 'startOnly' : '',
    },
  });
  if (!res?.ok) throw new Error(res?.error || 'Échec de génération Grok.');
  const url = (res.urls || [])[0];
  if (!url) throw new Error('Grok n’a renvoyé aucune URL.');
  return url;
}

/* Récupère les octets (host_permissions couvrent grok/x.ai/twimg) et les envoie au pont. */
async function saveToBridge(url, relPath) {
  if (!relPath) throw new Error('job sans chemin de sortie (out / out_video).');
  const blob = await (await fetch(url)).blob();
  const saved = await bridgeFetch('/save', {
    method: 'POST',
    headers: { 'X-Save-Path': encodeURIComponent(relPath), 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  return saved.saved;
}

/* Références importées dans Lumina correspondant aux clés @ du job (ou aux noms du prompt). */
function refsForQueueJob(job) {
  const keys = (job.refs || []).map(refKey);
  const refs = keys.length ? state.refs.filter((r) => keys.includes(refKey(r.name)))
    : refsForPrompt(job.prompt_image || job.prompt || '');
  const missing = keys.filter((k) => !state.refs.some((r) => refKey(r.name) === k));
  if (missing.length) log(`${job.scene || job.id} : pas de référence importée pour ${missing.join(', ')}`);
  return refs.filter((r) => r.dataUrl).slice(0, 7).map((r) => r.dataUrl);
}

/* Dernière image d'un clip (continuité « (suite) ») → data URL JPEG. */
async function lastFrameOf(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise((ok, ko) => { v.onloadedmetadata = ok; v.onerror = () => ko(new Error('clip précédent illisible')); });
    v.currentTime = Math.max(0, v.duration - 0.05);
    await new Promise((ok) => { v.onseeked = ok; });
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Génère un job. "scene" = image (t2i) PUIS vidéo (image→vidéo) pour garder la cohérence. */
async function generateInLumina(job) {
  if (state.settings.grokVideoOnly !== false && (job.kind === "image" || (job.kind === "scene" && !job.chain_from))) {
    throw new Error("Grok est réservé à la vidéo (Réglages → « Grok : vidéo uniquement ») : image à faire avec ChatGPT ou Agnes.");
  }
  const opts = { aspect: job.aspect, duration: job.duration, refs: refsForQueueJob(job) };

  if (job.kind === 'image') {
    return [{ url: await grokSubmit(job.prompt, 'image', opts), out: job.out }];
  }
  if (job.kind === 'video') {
    return [{ url: await grokSubmit(job.prompt, 'video', opts), out: job.out }];
  }
  if (job.kind === 'scene') {
    let imgUrl;
    if (job.chain_from) {
      // Continuité : on repart de la dernière image du clip précédent (déjà enregistré par le pont).
      const r = await fetch(`${BRIDGE}/file?path=${encodeURIComponent(job.chain_from)}`);
      if (!r.ok) throw new Error(`clip précédent introuvable (${job.chain_from}) : génère d’abord la scène précédente.`);
      imgUrl = await lastFrameOf(await r.blob());
    } else {
      imgUrl = await grokSubmit(job.prompt_image || job.prompt, 'image', opts);
    }
    const out = [];
    if (job.out_image) out.push({ url: imgUrl, out: job.out_image });
    const vidUrl = await grokSubmit(job.prompt_video || job.prompt, 'video', { ...opts, startUrl: imgUrl });
    out.push({ url: vidUrl, out: job.out_video || job.out });
    return out;
  }
  throw new Error('job.kind inconnu : ' + job.kind);
}

let queueRunning = false;

/* Tire <batchSize> jobs "grok", génère, enregistre, marque "done" (ou "error"). */
async function runLuminaQueue(batchSize = 1) {
  if (queueRunning) { log('File : génération déjà en cours.'); return 0; }
  queueRunning = true;
  const btn = $('#run-queue');
  if (btn) btn.disabled = true;
  try {
    const { jobs } = await bridgeFetch(`/queue?claim=${batchSize}&engine=grok`);
    if (!jobs.length) { log('File vide.'); return 0; }

    for (const job of jobs) {
      try {
        const outputs = await generateInLumina(job);
        let last;
        for (const o of outputs) last = await saveToBridge(o.url, o.out);
        await bridgePost('/done', { id: job.id, out: last });
        log(`OK ${job.scene || job.id} → ${last}`);
      } catch (e) {
        log(`Échec job ${job.id} : ${e.message}`);
        // Marque "error" côté pont → « Relancer échecs » le remet en file.
        await bridgePost('/fail', { id: job.id, error: e.message }).catch(() => {});
      }
    }
    return jobs.length;
  } catch (e) {
    log('File : ' + e.message);
    return 0;
  } finally {
    queueRunning = false;
    if (btn) btn.disabled = false;
  }
}

async function requeueLuminaFailures() {
  try {
    const r = await bridgePost('/requeue', {});
    log(`File : ${r.requeued} job(s) remis en attente.`);
  } catch (e) {
    log('File : ' + e.message);
  }
}

if (typeof window !== "undefined") {
  window.runLuminaQueue = runLuminaQueue;
} else {
  globalThis.runLuminaQueue = runLuminaQueue;
}

$("#run-queue")?.addEventListener("click", () => void runLuminaQueue(1));
$("#requeue")?.addEventListener("click", () => void requeueLuminaFailures());

/* Étape 3 : épisode préparé dans prod-fruits → cartes Stills → clips, dans l'ordre.
 * req = { serie, ep, only? } (pilote auto) ; sinon lit les champs du panneau.
 * Renvoie "" si l'import a réussi, sinon le message d'erreur (aussi affiché sous « Lancer le lot »). */
async function importEpisode(req) {
  const serie = req?.serie || $("#ep-serie")?.value.trim();
  const ep = req?.ep || $("#ep-num")?.value.trim();
  const fail = (msg) => { runHint(msg); return msg; };
  if (!serie || !ep) return fail("Indique la série et l’épisode (ex. fruit-drama-france et ep1).");
  state.settings.lastSerie = serie;
  state.settings.lastEp = ep;
  if ($("#ep-serie")) $("#ep-serie").value = serie;
  if ($("#ep-num")) $("#ep-num").value = ep;
  const only = (req?.only || []).join(",");
  let data;
  try {
    const r = await fetch(`${BRIDGE}/episode?serie=${encodeURIComponent(serie)}&ep=${encodeURIComponent(ep)}` +
      (only ? `&only=${only}` : ""));
    data = await r.json();
    if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
  } catch (e) {
    return fail("Import : " + (/fetch/i.test(e.message) ? "pont injoignable (lance lancer_pont.bat)" : e.message));
  }
  if (data.images_manquantes?.length) {
    return fail(`Images manquantes dans 2-images : ${data.images_manquantes.map((n) => "IMG " + String(n).padStart(2, "0")).join(", ")}. Génère-les (codex_images.py) puis réimporte.`);
  }
  const cache = {};
  const stills = [];
  for (const c of data.clips) {
    let dataUrl = null;
    try {
      if (c.image) {
        if (!cache[c.image]) {
          const r = await fetch(`${BRIDGE}/file?path=${encodeURIComponent(c.image)}`);
          if (!r.ok) throw new Error(`image illisible : ${c.image}`);
          cache[c.image] = await resizeFile(await r.blob(), 1920);
        }
        dataUrl = cache[c.image];
      } else if (c.suite && c.chain_file) {
        // Reprise d'un « suite » seul : dernière image du clip précédent déjà enregistré.
        const r = await fetch(`${BRIDGE}/file?path=${encodeURIComponent(c.chain_file)}`);
        if (!r.ok) throw new Error(`clip précédent introuvable : ${c.chain_file}`);
        dataUrl = await lastFrameOf(await r.blob());
      }
    } catch (e) {
      return fail("Import : " + e.message);
    }
    const nn = String(c.num).padStart(2, "0");
    stills.push({
      id: "st" + Math.random().toString(36).slice(2, 8),
      num: c.num,
      file: c.image || "",
      stem: slug(`${nn}-${c.titre}`),
      title: `${nn} — ${c.titre}${c.suite ? " (suite)" : ""}`,
      videoPrompt: c.prompt,
      skip: false,
      duration: clipDur({ duration: c.duree }),
      dataUrl,
      chainPrev: Boolean(c.suite && !dataUrl),
      savePath: c.save,
    });
  }
  state.stills = stills;
  persist();
  renderStills();
  runHint(`${data.code} — ${data.titre} importé : ${stills.length} clips (${stills.filter((s) => s.chainPrev).length} en suite).` +
    (req ? "" : " Clique « Lancer le lot »."));
  return "";
}
$("#ep-import")?.addEventListener("click", () => void importEpisode());
if ($("#ep-serie")) $("#ep-serie").value = state.settings.lastSerie || "";
if ($("#ep-num")) $("#ep-num").value = state.settings.lastEp || "";

/* Pilote auto : Lumina surveille le pont ; quand Claude (pilote.py) dépose une demande, elle importe
 * l'épisode, lance le lot sans clic ni pause, puis rend le résultat clip par clip au pont. */
let pilotBusy = false;
async function pilotTick() {
  if (!state.settings.pilot || pilotBusy || state.running || batchActive) return;
  let demande;
  try {
    demande = (await (await fetch(`${BRIDGE}/pilote/prendre`)).json()).demande;
  } catch {
    return; // pont éteint : on réessaie au prochain tour
  }
  if (!demande) return;
  pilotBusy = true;
  const report = (body) => fetch(`${BRIDGE}/pilote/fini`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: demande.id, ...body }),
  }).catch(() => {});
  try {
    log(`Pilote auto : ${demande.agnes ? "Agnes « " + (demande.agnes.projet || "projet ouvert") + " »" : demande.serie + " " + demande.ep}${demande.only?.length ? " (clips " + demande.only.join(", ") + ")" : ""}`);
    // Demande « lancer-agnes » : les plans viennent du projet Agnes (agnes-bridge.js), pas d'un épisode du pont.
    const fromAgnes = demande.agnes && typeof importFromAgnes === "function";
    if (!fromAgnes && state.mode !== "montage") setMode("montage");
    const err = fromAgnes ? await importFromAgnes({ ...demande.agnes, pilot: true }) : await importEpisode(demande);
    if (err) return void (await report({ erreur: err, clips: [] }));
    const step = state.settings.step;
    state.settings.step = false; // jamais de pause « Scène suivante » en pilote
    state.jobs = []; // le compte rendu ne doit jamais reprendre un ancien lot
    try {
      await runBatch(true, { pilot: true });
    } finally {
      state.settings.step = step;
    }
    const clips = state.jobs.map((j) => ({
      num: j.clipNum, ok: j.status === "done", erreur: j.status === "done" ? null : j.error || j.status,
    }));
    await report({ clips });
    log(`Pilote auto : terminé — ${clips.filter((c) => c.ok).length}/${clips.length} clips réussis.`);
  } catch (e) {
    await report({ erreur: e.message, clips: [] });
  } finally {
    pilotBusy = false;
  }
}
if (typeof setInterval === "function" && typeof window !== "undefined") setInterval(() => void pilotTick(), 8000);
$("#pilot")?.addEventListener("change", (e) => {
  state.settings.pilot = e.target.checked;
  persist();
  runHint(e.target.checked ? "Pilote auto activé : laisse l’onglet grok.com/imagine ouvert, Lumina lancera les épisodes envoyés par Claude." : "");
});

renderAll();
