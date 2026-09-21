(() => {
  if (window.__luminaBound) return;
  window.__luminaBound = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const SKIP = /chat|nouveau|new conversation|history|historique|login|sign|settings|menu|profil|account/i;
  let aborted = false;
  let submitting = false;

  function isImagine() {
    return /\/imagine/i.test(location.pathname + location.hash);
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 8 && r.height > 8 && style.visibility !== "hidden" && style.display !== "none";
  }

  function textOf(el) {
    return (el.innerText || el.textContent || "").trim();
  }

  function isNavAway(el) {
    const a = el.closest("a");
    const href = a?.getAttribute("href") || "";
    if (!href) return false;
    if (/imagine/i.test(href)) return false;
    return /chat|^\/$|login/i.test(href);
  }

  function findPromptBox() {
    const nodes = [
      ...document.querySelectorAll("textarea"),
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('[role="textbox"]'),
    ].filter(visible);
    if (!nodes.length) return null;
    return nodes.sort((a, b) => scoreBox(b) - scoreBox(a))[0];
  }

  function scoreBox(el) {
    const r = el.getBoundingClientRect();
    const hint = (
      el.getAttribute("placeholder") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("data-placeholder") ||
      ""
    ).toLowerCase();
    let score = r.width;
    if (/prompt|imagine|describe|décrivez|vidéo|video|image/.test(hint)) score += 2500;
    if (r.bottom > innerHeight * 0.45) score += 600;
    if (r.top < 140) score -= 1200;
    return score;
  }

  function findClickable(predicates) {
    const buttons = [
      ...document.querySelectorAll("button, a, [role='button'], [role='tab'], [role='radio'], [role='option'], [role='menuitem']"),
    ].filter(visible).filter((el) => {
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
      const t = textOf(el);
      if (t.length > 56) return false;
      if (SKIP.test(t)) return false;
      if (SKIP.test(el.getAttribute("aria-label") || "")) return false;
      if (isNavAway(el)) return false;
      return true;
    });
    for (const pred of predicates) {
      const hit = buttons.find(pred);
      if (hit) return hit;
    }
    return null;
  }

  function setNativeValue(el, value) {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    el.focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, value);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  }

  function looksLikeVideoComposer() {
    // Uploading a still can open the editor while video controls remain behind it.
    if (looksLikeImageEdit()) return false;
    if (
      findClickable([
        (el) => /^6\s*s$/i.test(textOf(el).trim()),
        (el) => /^10\s*s$/i.test(textOf(el).trim()),
        (el) => /^15\s*s$/i.test(textOf(el).trim()),
      ])
    )
      return true;
    const box = findPromptBox();
    const hint = (
      (box && (box.getAttribute("placeholder") || box.getAttribute("aria-label") || box.dataset.placeholder)) ||
      ""
    ).toLowerCase();
    if (/modification|édit(er|ion)|edit (this )?image|transform/.test(hint)) return false;
    if (/vid[ée]o|video|motion|animate/.test(hint)) return true;
    return false;
  }

  function looksLikeImageEdit() {
    const box = findPromptBox();
    const hint = (
      (box && (box.getAttribute("placeholder") || box.getAttribute("aria-label") || box.dataset.placeholder)) ||
      ""
    ).toLowerCase();
    if (/modifi|édit(er|ion)|edit (this )?image|describe your edit/.test(hint)) return true;
    for (const el of document.querySelectorAll("[placeholder], textarea, [contenteditable='true'], [role='textbox'], div, span, p")) {
      if (!visible(el)) continue;
      const t = (el.getAttribute("placeholder") || el.getAttribute("aria-label") || "") + " " + textOf(el);
      if (t.length > 10 && t.length < 120 && /d[ée]crivez votre modification|describe your (edit|modification)/i.test(t)) return true;
    }
    return false;
  }

  async function clickVideoSurface() {
    const preds = [
      (el) => /cr[ée]er une vid[ée]o|create (a )?video|make (a )?video/i.test(textOf(el).trim()),
      (el) => /cr[ée]er une vid[ée]o|create (a )?video|make (a )?video|animate|animer/i.test((el.getAttribute("aria-label") || el.getAttribute("title") || "").trim()),
      (el) => /^(vid[ée]o|video)$/i.test(textOf(el).trim()),
      (el) => /^(vid[ée]o|video)$/i.test((el.getAttribute("aria-label") || "").trim()),
      (el) => el.getAttribute("role") === "tab" && /vid[ée]o|video/i.test(textOf(el) + (el.getAttribute("aria-label") || "")),
      (el) => /image\s*(to|→|-)?\s*vid[ée]o|animer|animate/i.test(textOf(el)),
    ];
    for (let i = 0; i < 20; i++) {
      if (aborted) return false;
      if (looksLikeVideoComposer()) {
        await sleep(500);
        if (aborted) return false;
        if (looksLikeVideoComposer()) return true;
      }
      const tab = findClickable(preds);
      if (tab && !tab.disabled && tab.getAttribute("aria-disabled") !== "true") {
        tab.click();
        // Let the new composer mount before trying another control.
        for (let j = 0; j < 8; j++) {
          await sleep(250);
          if (aborted) return false;
          if (looksLikeVideoComposer()) return true;
        }
      } else await sleep(250);
      if (looksLikeVideoComposer()) return true;
    }
    return looksLikeVideoComposer();
  }

  async function clickMode(kind, grokMode) {
    const wantVideo =
      kind === "video" ||
      grokMode === "frame2v" ||
      grokMode === "t2v" ||
      grokMode === "ingredients" ||
      grokMode === "montage";
    if (wantVideo) {
      await clickVideoSurface();
    } else {
      const tabRe = /^(image|photo)$/i;
      const tab = findClickable([
        (el) => tabRe.test(textOf(el).trim()) && textOf(el).length < 12,
        (el) => tabRe.test((el.getAttribute("aria-label") || "").trim()),
        (el) => el.getAttribute("role") === "tab" && tabRe.test(textOf(el).trim()),
      ]);
      tab?.click();
      await sleep(300);
    }
  }

  async function clickLabel(re) {
    const btn = findClickable([
      (el) => re.test(textOf(el)),
      (el) => re.test(el.getAttribute("aria-label") || ""),
    ]);
    btn?.click();
    await sleep(200);
    return Boolean(btn);
  }

  async function fileToItem(url, i) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Impossible de charger l’image source (HTTP " + res.status + ").");
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("La source reçue n’est pas une image.");
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[blob.type] || "img";
    return new File([blob], `lumina-${i + 1}.${ext}`, { type: blob.type });
  }

  async function setInputFiles(input, files) {
    if (files.length > 1 && !input.multiple) {
      throw new Error("Ce champ Imagine n’accepte qu’une image. Les ingrédients ne peuvent pas être importés ensemble ici.");
    }
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function attachImages(urls, framePair) {
    if (!urls?.length) return;
    const files = [];
    for (const [i, url] of urls.entries()) files.push(await fileToItem(url, i));

    if (framePair === "startEnd" && files.length >= 2) {
      if (!(await clickLabel(/first frame|start frame|premi[eè]re|d[ée]but|start image|frame 1/i))) {
        throw new Error("Option Début + fin indisponible : contrôle de première image introuvable.");
      }
      const inputs = [...document.querySelectorAll('input[type="file"]')];
      if (inputs[0]) await setInputFiles(inputs[0], [files[0]]);
      else {
        const opener = findClickable([
          (el) => /ajouter|add image|upload|joindre|parcourir|first|d[ée]but/i.test(textOf(el)),
        ]);
        opener?.click();
        await sleep(200);
        const input = document.querySelector('input[type="file"]');
        if (!input) throw new Error("Import de la première image introuvable.");
        await setInputFiles(input, [files[0]]);
      }
      await sleep(250);
      if (!(await clickLabel(/last frame|end frame|derni[eè]re|\bfin\b|end image|frame 2/i))) {
        throw new Error("Option Début + fin indisponible : contrôle de dernière image introuvable.");
      }
      const inputs2 = [...document.querySelectorAll('input[type="file"]')];
      const endInput = inputs2[1] || inputs2[0];
      if (!endInput) throw new Error("Import de la dernière image introuvable.");
      await setInputFiles(endInput, [files[1]]);
      await sleep(250);
      return;
    }

    const opener = findClickable([
      (el) => /ajouter|add image|upload|joindre|parcourir/i.test(textOf(el)),
      (el) => /upload|attach|add image|ajouter|joindre/i.test(el.getAttribute("aria-label") || ""),
    ]);
    opener?.click();
    await sleep(200);
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error("Import d’image introuvable dans Imagine. Aucune génération lancée.");
    await setInputFiles(input, files);
    await sleep(250);
  }

  // Thumbnail menus belong to the prompt composer, never to the results gallery.
  function composerImages() {
    const box = findPromptBox();
    const form = box?.closest("form");
    if (form) return [...form.querySelectorAll("img")].filter(visible);
    for (let root = box?.parentElement; root && root !== document.body; root = root.parentElement) {
      const rect = root.getBoundingClientRect();
      if (rect.height > 500) break;
      const imgs = [...root.querySelectorAll("img")].filter(visible);
      if (imgs.length && root.querySelector("button, [role='button']")) return imgs;
    }
    return [];
  }

  function roleOption(role) {
    const re = {
      first: /^(premi[eè]re image|first (image|frame)|start (image|frame))(?=\s|$)/i,
      last: /^(derni[eè]re image|last (image|frame)|end (image|frame))(?=\s|$)/i,
      reference: /^(r[ée]f[ée]rence|reference)(?=\s|$)/i,
    }[role];
    const menus = [...document.querySelectorAll('[role="menu"], [role="listbox"], [data-radix-menu-content]')].filter(visible);
    const candidates = menus.length ? menus.flatMap((menu) => [...menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], button')])
      : [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]')];
    return candidates.filter(visible).find((el) => !el.disabled && el.getAttribute("aria-disabled") !== "true" && re?.test(textOf(el)));
  }

  async function assignImageRole(img, role, name) {
    const trigger = img.closest('button, [role="button"], [aria-haspopup="menu"]') ||
      img.parentElement?.querySelector('[aria-haspopup="menu"], [aria-haspopup="listbox"]') || img;
    trigger.click();
    let option;
    for (let i = 0; i < 20 && !aborted; i++) {
      option = roleOption(role);
      if (option) break;
      await sleep(200);
    }
    if (!option || aborted) throw new Error(aborted ? "Arrêté" : `Rôle ${role} introuvable pour « ${name} ». Aucun prompt envoyé.`);
    option.click();
    await sleep(250);
    // Reopen the same menu to verify selection instead of assuming a click worked.
    trigger.click();
    for (let i = 0; i < 20 && !aborted; i++) {
      const selected = roleOption(role);
      if (selected && (selected.getAttribute("aria-checked") === "true" || selected.getAttribute("aria-selected") === "true" ||
        selected.getAttribute("data-state") === "checked" || selected.querySelector('[data-state="checked"], [data-state="on"], [data-icon="check"], .lucide-check'))) {
        selected.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
        return;
      }
      await sleep(200);
    }
    throw new Error(aborted ? "Arrêté" : `Le rôle de « ${name} » n’a pas pu être confirmé. Vérifiez son menu dans Imagine.`);
  }

  async function attachVideoImages(attachments) {
    if (!attachments.length) return;
    while (composerImages().length) {
      if (aborted) throw new Error("Arrêté");
      const current = composerImages();
      let remove;
      for (let root = current[0].parentElement, depth = 0; root && depth < 4; root = root.parentElement, depth++) {
        if (root.querySelectorAll("img").length !== 1) break;
        remove = [...root.querySelectorAll("button, [role='button']")].find((el) =>
          /remove|supprimer|retirer|delete|close|fermer/i.test(textOf(el) + " " + (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "")) ||
          el.querySelector("svg.lucide-x"));
        if (remove) break;
      }
      if (!remove) throw new Error("Retirez les anciennes images du formulaire Imagine : leur bouton de retrait n’a pas été identifié.");
      remove.click();
      for (let i = 0; i < 20 && composerImages().length >= current.length && !aborted; i++) await sleep(200);
      if (composerImages().length >= current.length) throw new Error("Le retrait des anciennes images n’a pas été confirmé.");
    }
    for (const [i, attachment] of attachments.entries()) {
      if (aborted) throw new Error("Arrêté");
      const before = new Set(composerImages());
      const previousSources = new Set([...before].map((img) => img.currentSrc || img.src));
      const file = await fileToItem(attachment.url, i);
      let input = [...document.querySelectorAll('input[type="file"]')].find((el) => !el.disabled && (!el.accept || /image|\.png|\.jpg|\.webp/i.test(el.accept)));
      if (!input) {
        await clickLabel(/importer des m[ée]dias|upload|attach|importer|add image|joindre/i);
        for (let j = 0; j < 20 && !input && !aborted; j++) {
          await sleep(200);
          input = [...document.querySelectorAll('input[type="file"]')].find((el) => !el.disabled && (!el.accept || /image|\.png|\.jpg|\.webp/i.test(el.accept)));
        }
      }
      if (!input) throw new Error("Import d’image introuvable. Aucun prompt envoyé.");
      input.value = "";
      await setInputFiles(input, [file]);
      let added;
      for (let j = 0; j < 60 && !aborted; j++) {
        const current = composerImages();
        // Require one additional thumbnail; do not assign a role to a gallery image.
        const fresh = current.filter((img) => !previousSources.has(img.currentSrc || img.src));
        if (current.length === before.size + 1 && fresh.length === 1) { added = fresh[0]; break; }
        await sleep(250);
      }
      if (!added) throw new Error(aborted ? "Arrêté" : `Import de « ${attachment.name} » non confirmé dans le formulaire. Aucun prompt envoyé.`);
      await assignImageRole(added, attachment.role, attachment.name || `Image ${i + 1}`);
    }
    if (composerImages().length !== attachments.length) throw new Error("Le nombre d’images jointes a changé. Aucun prompt envoyé.");
  }

  function collectVideos() {
    const urls = new Set();
    const walk = (root) => {
      for (const v of root.querySelectorAll("video")) {
        if (v.currentSrc) urls.add(v.currentSrc);
        if (v.src) urls.add(v.src);
        for (const s of v.querySelectorAll("source")) if (s.src) urls.add(s.src);
      }
      for (const a of root.querySelectorAll("a[href]")) {
        if (/\.mp4(\?|$)/i.test(a.href)) urls.add(a.href);
      }
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return [...urls].filter((u) => u && !u.startsWith("blob:chrome") && (u.startsWith("blob:") || u.startsWith("http") || u.startsWith("https")));
  }

  function collectImages() {
    const urls = new Set();
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:")) continue;
      if (img.width >= 160 && img.height >= 160) urls.add(src);
    }
    return [...urls];
  }

  async function clickAspect(ratio) {
    if (!ratio) return;
    const compact = ratio.replace(/\s/g, "");
    const btn = findClickable([
      (el) => textOf(el).replace(/\s/g, "") === compact,
      (el) => (el.getAttribute("aria-label") || "").includes(compact),
    ]);
    btn?.click();
    await sleep(200);
  }

  async function clickOutputs(n) {
    const wanted = String(n);
    const btn = findClickable([
      (el) => textOf(el).trim() === wanted && textOf(el).length < 4,
      (el) =>
        textOf(el).trim() === wanted &&
        el.closest("[role='listbox'], [role='radiogroup'], fieldset, [class*='count'], [class*='output']"),
      (el) =>
        new RegExp(`^${wanted}\\s*(x|×|vidéo|video|image|clip)?$`, "i").test(textOf(el).trim()) &&
        textOf(el).length < 14,
    ]);
    btn?.click();
    await sleep(200);
    if (Number(n) > 1 && !btn) throw new Error("Le sélecteur de variantes est introuvable. Choisissez 1 variante pour cette interface.");
  }

  async function clickDuration(sec) {
    if (!sec) return;
    const n = String(sec);
    const btn = findClickable([
      (el) => new RegExp(`^${n}\\s*s(ec(ondes?)?)?$`, "i").test(textOf(el).trim()),
      (el) => textOf(el).trim() === n && el.closest("[class*='duration'], [class*='time'], fieldset, [role='radiogroup']"),
      (el) => (el.getAttribute("aria-label") || "").includes(n + "s"),
    ]);
    btn?.click();
    await sleep(150);
  }

  async function clickQuality(q) {
    const re = q === "quality" ? /^(quality|qualité)$/i : /^(speed|rapide)$/i;
    const btn = findClickable([
      (el) => re.test(textOf(el).trim()),
      (el) => re.test(el.getAttribute("aria-label") || ""),
    ]);
    btn?.click();
    await sleep(150);
  }

  async function clickResolution(res) {
    if (!res) return;
    const compact = String(res).replace(/\s/g, "").toLowerCase();
    const num = compact.replace(/p$/, "");
    const btn = findClickable([
      (el) => textOf(el).replace(/\s/g, "").toLowerCase() === compact,
      (el) => textOf(el).replace(/\s/g, "").toLowerCase() === num,
      (el) => (el.getAttribute("aria-label") || "").replace(/\s/g, "").toLowerCase().includes(compact),
      (el) => compact === "1080p" && /1080|full\s*hd|fhd/i.test(textOf(el) + (el.getAttribute("aria-label") || "")),
    ]);
    btn?.click();
    await sleep(150);
  }

  async function clickLatestStill() {
    const imgs = [...document.querySelectorAll("img")].filter(visible).filter((img) => {
      const src = img.currentSrc || img.src;
      return src && !src.startsWith("data:") && img.width >= 160 && img.height >= 160;
    });
    const last = imgs[imgs.length - 1];
    last?.click();
    await sleep(250);
  }

  async function submitPrompt(payload) {
    aborted = false;
    if (!isImagine()) {
      return {
        ok: false,
        error: "Vous n’êtes pas sur grok.com/imagine (chat détecté). Ouvrez Imagine, F5, puis relancez.",
      };
    }
    const kind = payload.mediaKind || "image";
    const wantVideo = kind === "video";
    const attachments = wantVideo ? payload.attachments || [] : [];
    if (attachments.some((a) => !a.url || !["first", "last", "reference"].includes(a.role))) {
      return { ok: false, error: "Image ou rôle de pièce jointe invalide." };
    }
    if (["frame2v", "ingredients", "i2i", "montage"].includes(payload.grokMode) && !payload.images?.length && !attachments.length) {
      return { ok: false, error: "Ce mode nécessite une image source. Aucune génération lancée." };
    }
    if (payload.framePair === "startEnd" && payload.images?.length !== 2) {
      return { ok: false, error: "Début + fin nécessite exactement deux images." };
    }
    await clickMode(kind, payload.grokMode);
    if (attachments.length) await attachVideoImages(attachments);
    else if (payload.images?.length) await attachImages(payload.images, payload.framePair);
    else if (payload.useLatestImage) await clickLatestStill();
    if (aborted) return { ok: false, error: "Arrêté" };

    // Importing/opening a still may replace the composer with the image editor.
    // Recover before writing the motion prompt or applying video settings.
    if (wantVideo && (payload.images?.length || payload.useLatestImage)) {
      await sleep(1000);
    }
    if (wantVideo && !(await clickVideoSurface())) {
      return {
        ok: false,
        error: aborted ? "Arrêté" : "Impossible d’activer le compositeur vidéo après l’import. Aucun prompt envoyé. Ouvrez « Créer une vidéo », puis relancez le clip.",
      };
    }
    if (!wantVideo && looksLikeVideoComposer()) {
      return { ok: false, error: "Imagine est resté en mode Vidéo. Aucun prompt image envoyé." };
    }
    if (payload.grokMode === "i2i") {
      for (let i = 0; i < 20 && !looksLikeImageEdit() && !aborted; i++) await sleep(250);
      if (!looksLikeImageEdit()) return { ok: false, error: "L’éditeur d’image n’a pas été détecté après l’import. Aucun prompt envoyé." };
    }
    if (!wantVideo && !payload.images?.length && looksLikeImageEdit()) {
      return { ok: false, error: "L’éditeur contient encore une image. Ouvrez une nouvelle création Imagine pour générer depuis le texte." };
    }
    await clickAspect(payload.aspectRatio);
    await clickOutputs(payload.outputs || 1);
    if (wantVideo) {
      await clickDuration(payload.duration || 6);
      await clickQuality(payload.quality || (payload.preferSpeed ? "speed" : "quality"));
      await clickResolution(payload.resolution || (payload.force480p ? "480p" : "720p"));
    }
    if (aborted) return { ok: false, error: "Arrêté" };

    if (wantVideo && !looksLikeVideoComposer()) {
      return { ok: false, error: "Le compositeur vidéo a changé. Aucun prompt envoyé ; relancez le clip depuis le mode Vidéo." };
    }
    if (attachments.length && composerImages().length !== attachments.length) {
      return { ok: false, error: "Des images ont disparu du formulaire. Aucun prompt envoyé." };
    }

    const box = findPromptBox();
    if (!box) return { ok: false, error: "Invite introuvable — restez sur grok.com/imagine." };

    box.focus();
    setNativeValue(box, payload.prompt);
    await sleep(200);
    if (aborted) return { ok: false, error: "Arrêté" };
    if (wantVideo && looksLikeImageEdit()) {
      return {
        ok: false,
        error: "Le prompt est parti en édition d’image. Onglet Vidéo, une seule image, Correction rapide.",
      };
    }

    const snapshot = wantVideo ? collectVideos : collectImages;
    const before = new Set(snapshot());
    const generate = findClickable(
      wantVideo
        ? [
            (el) => /générer une vid[ée]o|generate video|make video/i.test(textOf(el)),
            (el) => /^(générer|generate)$/i.test(textOf(el).trim()),
            (el) => /générer|generate/i.test(el.getAttribute("aria-label") || ""),
            (el) => el.getAttribute("type") === "submit" && !SKIP.test(textOf(el)),
          ]
        : [
            (el) => payload.grokMode === "i2i" && /^(modifier|éditer|appliquer|edit|apply)( (l[’']image|image|changes|modifications))?$/i.test(textOf(el).trim()),
            (el) => /^(générer|generate)$/i.test(textOf(el).trim()),
            (el) => /générer une image|generate image/i.test(textOf(el)),
            (el) => /générer|generate/i.test(el.getAttribute("aria-label") || ""),
            (el) => el.getAttribute("type") === "submit" && !SKIP.test(textOf(el)),
          ],
    );

    if (generate) generate.click();
    else {
      box.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
      );
    }

    const wanted = Math.max(1, Math.min(4, Number(payload.outputs) || 1));
    const extra = /1080/.test(String(payload.resolution || "")) ? 180000 : /720/.test(String(payload.resolution || "")) ? 60000 : 0;
    const timeout = Date.now() + (payload.timeoutMs || (180000 + extra));
    while (Date.now() < timeout) {
      await sleep(400);
      if (aborted) return { ok: false, error: "Arrêté" };
      if (!isImagine()) {
        return { ok: false, error: "La page a quitté Imagine. Rouvrez grok.com/imagine." };
      }
      const now = snapshot().filter((u) => !before.has(u));
      if (now.length >= wanted) return { ok: true, urls: now.slice(0, wanted) };
      const err = [...document.querySelectorAll("div, p, span")].find(
        (el) => /rate limit|trop de requêtes|try again|quota|upgrade/i.test(textOf(el)) && visible(el),
      );
      if (err && textOf(err).length < 180) return { ok: false, error: textOf(err) };
    }
    return {
      ok: false,
      error: wantVideo
        ? "Délai dépassé — aucune vidéo détectée. Cliquez l’onglet Vidéo, F5, Correction rapide."
        : "Délai dépassé — aucune image détectée.",
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "PING") {
      sendResponse({ ok: true, imagine: isImagine(), href: location.href });
      return false;
    }
    if (msg?.type === "CANCEL") {
      aborted = true;
      sendResponse({ ok: true });
      return false;
    }
    if (msg?.type === "SUBMIT_PROMPT") {
      if (submitting) {
        sendResponse({ ok: false, error: "Une génération Lumina est déjà en cours dans cet onglet." });
        return false;
      }
      submitting = true;
      submitPrompt(msg)
        .finally(() => { submitting = false; })
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    return false;
  });

  if (isImagine() && !document.querySelector(".lumina-connected")) {
    const bar = document.createElement("div");
    bar.className = "lumina-connected";
    bar.textContent = "Lumina connecté";
    bar.setAttribute("aria-hidden", "true");
    document.documentElement.appendChild(bar);
  }
})();
