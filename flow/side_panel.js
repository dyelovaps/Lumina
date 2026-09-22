/**
 * Flow Kit — Lumina Side Panel Script
 * Handles Google Flow connection monitoring, real image/video automation against
 * the local FlowKit agent (http://127.0.0.1:8100/api), and the request log.
 */

const FLOW_API = 'http://127.0.0.1:8100/api';

const TYPE_LABELS = {
  GENERATE_IMAGE:           'GEN IMAGE',
  REGENERATE_IMAGE:         'REGEN IMAGE',
  EDIT_IMAGE:               'EDIT IMAGE',
  GENERATE_CHARACTER_IMAGE: 'GEN REF',
  REGENERATE_CHARACTER_IMAGE: 'REGEN REF',
  EDIT_CHARACTER_IMAGE:     'EDIT REF',
  GENERATE_VIDEO:           'GEN VIDEO',
  GENERATE_VIDEO_REFS:      'GEN VIDEO REFS',
  UPSCALE_VIDEO:            'UPSCALE VIDEO',
  IMAGE_GENERATION:         'GEN IMAGE',
  VIDEO_GENERATION:         'GEN VIDEO',
  GEN_IMG:                  'GEN IMAGE',
  GEN_VID:                  'GEN VIDEO',
  GEN_VID_REF:              'GEN VIDEO REFS',
  UPSCALE:                  'UPSCALE VIDEO',
  UPS_IMG:                  'UPSCALE IMAGE',
  POLL:                     'CHECK GEN VIDEO',
  CREDITS:                  'CHECK CREDIT',
  CREATE_PROJECT:           'CREATE PROJECT',
  UPLOAD:                   'UPLOAD IMAGE',
  MEDIA:                    'READ MEDIA',
  TRACKING:                 'GOOGLE FLOW TRACK',
  URL_REFRESH:              'URL REFRESH',
  TRPC:                     'TRPC',
  API:                      'API',
};

function formatType(type) {
  if (!type) return '—';
  return TYPE_LABELS[type] || type.slice(0, 10).toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return '—';
  }
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, len) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len) + '…';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Local FlowKit API helper ─────────────────────────────────
//
// Every /flow/* route is mounted under /api in the agent (see main.py:
// `app.include_router(flow_router, prefix="/api")` on top of the router's own
// `prefix="/flow"`), so the real path is `/api/flow/...`. Calling `/flow/...`
// directly 404s — that was the root cause of every "nothing happens" report.

async function flowPost(path, body) {
  const res = await fetch(`${FLOW_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok) {
    const detail = data && (data.detail || data.error);
    const msg = typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

// ── State Update ─────────────────────────────────────────────

function updateStatus(data) {
  if (!data) return;

  const dot = document.getElementById('conn-dot');
  const connected = data.agentConnected;
  if (dot) {
    dot.textContent = connected ? '● Connecté' : '● Déconnecté';
    dot.className = connected ? 'pill ok' : 'pill err';
  }

  const toggle = document.getElementById('main-toggle');
  if (toggle) {
    toggle.checked = !data.manualDisconnect;
  }

  const stateBadge = document.getElementById('state-badge');
  if (stateBadge) {
    const st = data.state || 'off';
    const labelMap = { off: 'Arrêté', idle: 'Prêt', running: 'En cours' };
    stateBadge.textContent = labelMap[st] || st;
    stateBadge.className = { idle: 'pill ok', running: 'pill run', off: 'pill err' }[st] || 'pill wait';
  }

  const tokenEl = document.getElementById('token-status');
  if (tokenEl) {
    tokenEl.textContent = connected
      ? 'Service local connecté · Session Google Flow active dans Chrome'
      : 'Service local FlowKit non connecté';
    tokenEl.style.color = connected ? 'var(--sage)' : 'var(--amber)';
  }

  const m = data.metrics || {};
  const totalEl = document.getElementById('m-total');
  const succEl = document.getElementById('m-success');
  const failEl = document.getElementById('m-failed');

  if (totalEl) totalEl.textContent = m.requestCount || 0;
  if (succEl) succEl.textContent = m.successCount || 0;
  if (failEl) failEl.textContent = m.failedCount || 0;
}

// ── Request Log Update ───────────────────────────────────────

let _logEntries = [];

function updateRequestLog(entries) {
  const tbody = document.getElementById('log-body');
  const countEl = document.getElementById('log-count');
  if (!tbody) return;

  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucune requête pour le moment</td></tr>';
    if (countEl) countEl.textContent = '0';
    return;
  }

  if (countEl) countEl.textContent = entries.length;
  _logEntries = entries;

  const rows = entries.map((entry) => {
    const shortId = entry.id ? String(entry.id).slice(0, 8) : '—';
    const type = formatType(entry.type || entry.method);
    const time = formatTime(entry.time || entry.timestamp || entry.createdAt);
    const status = entry.status || entry.state || 'pending';
    const error = entry.error || '';

    let badgeHtml;
    if (status === 'COMPLETED' || status === 'success') {
      badgeHtml = '<span class="pill ok">✓ Fait</span>';
    } else if (status === 'FAILED' || status === 'failed' || (typeof status === 'number' && status >= 400)) {
      badgeHtml = '<span class="pill err">✗ Échec</span>';
    } else if (status === 'PROCESSING' || status === 'running') {
      badgeHtml = '<span class="pill run">⏳ En cours</span>';
    } else {
      badgeHtml = '<span class="pill wait">⟳ Envoyé</span>';
    }

    const errorDisplay = error
      ? `<td style="color:var(--danger);" title="${escHtml(error)}">${escHtml(truncate(error, 24))}</td>`
      : `<td style="color:var(--muted);">—</td>`;

    return `<tr>
      <td style="font-family:monospace; color:var(--paper); cursor:pointer; text-decoration:underline;" data-request-id="${escHtml(entry.id || '')}">${escHtml(shortId)}</td>
      <td><strong>${escHtml(type)}</strong></td>
      <td style="color:var(--muted);">${escHtml(time)}</td>
      <td>${badgeHtml}</td>
      ${errorDisplay}
    </tr>`;
  });

  tbody.innerHTML = rows.join('');

  tbody.querySelectorAll('[data-request-id]').forEach((td) => {
    td.addEventListener('click', () => {
      const reqId = td.getAttribute('data-request-id');
      if (reqId) showRequestDetail(reqId);
    });
  });
}

// ── Detail Modal ─────────────────────────────────────────────

function showRequestDetail(reqId) {
  const entry = _logEntries.find((e) => e.id === reqId);
  if (!entry) return;

  const overlay = document.getElementById('detail-overlay');
  const title = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');
  if (!overlay || !title || !body) return;

  title.textContent = `Requête ${String(reqId).slice(0, 12)}`;

  const fields = [
    ['ID', entry.id],
    ['Type', formatType(entry.type || entry.method)],
    ['Heure', formatTime(entry.time || entry.timestamp || entry.createdAt)],
    ['Statut', entry.status || entry.state || 'pending'],
    ['Code HTTP', entry.httpStatus || '—'],
    ['URL', entry.url || '—'],
    ['Payload', entry.payloadSummary || '—'],
    ['Réponse', entry.responseSummary || '—'],
    ['Erreur', entry.error || '—'],
  ];

  body.innerHTML = fields
    .map(([label, value]) => {
      let style = 'color: var(--fg);';
      if (label === 'Erreur' && value && value !== '—') style = 'color: var(--danger); font-weight:600;';
      if (label === 'Statut' && (value === 'COMPLETED' || value === 'success')) style = 'color: var(--sage); font-weight:600;';
      return `<div style="display:flex; gap:10px; margin-bottom:8px; border-bottom:1px solid var(--line); padding-bottom:6px;">
        <span style="width:90px; flex-shrink:0; color:var(--muted); font-size:11px; text-transform:uppercase;">${escHtml(label)}</span>
        <span style="${style} word-break:break-all;">${escHtml(String(value || '—'))}</span>
      </div>`;
    })
    .join('');

  overlay.classList.add('open');
}

const closeBtn = document.getElementById('detail-close');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    document.getElementById('detail-overlay')?.classList.remove('open');
  });
}

const overlayEl = document.getElementById('detail-overlay');
if (overlayEl) {
  overlayEl.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove('open');
    }
  });
}

// ── Ingrédients & Références (selectable, actually wired) ────
//
// Each item can be toggled on/off (click the tile). Selected items get
// uploaded to Flow on demand — once per project — and their media_id is sent
// as a reference on the next image or video generation.

const ingredients = {
  chars: [],
  locs: [],
  props: [],
};

function allIngredientItems() {
  return [...ingredients.chars, ...ingredients.locs, ...ingredients.props];
}

function selectedIngredientItems() {
  return allIngredientItems().filter((item) => item.included);
}

function updateRefCount() {
  const el = document.getElementById('flow-ref-count');
  if (!el) return;
  const n = selectedIngredientItems().length;
  if (n === 0) {
    el.textContent = 'Aucune référence sélectionnée.';
  } else {
    el.textContent = `${n} référence${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''} — envoyée${n > 1 ? 's' : ''} avec la prochaine génération.`;
  }
}

async function ensureIngredientUploaded(item, projectId) {
  if (item.mediaId && item.mediaProjectId === projectId) return item.mediaId;
  const res = await flowPost('/flow/upload-image', {
    image_base64: item.dataUrl,
    mime_type: item.mime,
    project_id: projectId,
    file_name: item.name || 'reference.png',
  });
  if (!res || !res.media_id) throw new Error(`Échec de l'import de la référence "${item.name}".`);
  item.mediaId = res.media_id;
  item.mediaProjectId = projectId;
  return item.mediaId;
}

async function getSelectedReferenceMediaIds(projectId, { max } = {}) {
  const items = selectedIngredientItems();
  const limited = typeof max === 'number' ? items.slice(0, max) : items;
  const ids = [];
  for (const item of limited) {
    ids.push(await ensureIngredientUploaded(item, projectId));
  }
  return ids;
}

function setupIngredientInput(btnId, fileInputId, containerId, category) {
  const btn = document.getElementById(btnId);
  const fileInput = document.getElementById(fileInputId);
  const container = document.getElementById(containerId);
  if (!btn || !fileInput || !container) return;

  btn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const item = {
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          dataUrl: evt.target.result,
          mime: file.type || 'image/png',
          included: true,
          mediaId: null,
          mediaProjectId: null,
        };
        ingredients[category].push(item);
        renderIngredientTiles(containerId, category, btnId);
        updateRefCount();
      };
      reader.readAsDataURL(file);
    });
    fileInput.value = '';
  });
}

function renderIngredientTiles(containerId, category, btnId) {
  const container = document.getElementById(containerId);
  const addBtn = document.getElementById(btnId);
  if (!container || !addBtn) return;

  container.innerHTML = '';
  container.appendChild(addBtn);

  ingredients[category].forEach((item) => {
    const tile = document.createElement('div');
    tile.className = 'tile selectable' + (item.included ? ' sel' : '');
    tile.title = item.included ? 'Cliquer pour exclure de la prochaine génération' : 'Cliquer pour inclure comme référence';
    tile.innerHTML = `
      <span class="tile-check">✓</span>
      <img src="${item.dataUrl}" alt="${escHtml(item.name)}" />
      <input type="text" value="${escHtml(item.name)}" readonly />
    `;
    tile.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      item.included = !item.included;
      renderIngredientTiles(containerId, category, btnId);
      updateRefCount();
    });
    container.insertBefore(tile, addBtn);
  });
}

function initIngredients() {
  setupIngredientInput('flow-add-char', 'flow-file-char', 'flow-chars', 'chars');
  setupIngredientInput('flow-add-loc', 'flow-file-loc', 'flow-locs', 'locs');
  setupIngredientInput('flow-add-prop', 'flow-file-prop', 'flow-props', 'props');
  updateRefCount();
}

// ── Single-image upload slot (base image / start frame / end frame) ──

function createSingleSlot(slotContainerId, fileInputId, label) {
  const state = { file: null, dataUrl: null, mime: null, mediaId: null, mediaProjectId: null };
  const container = document.getElementById(slotContainerId);
  const fileInput = document.getElementById(fileInputId);

  function render() {
    if (!container) return;
    container.innerHTML = '';
    const div = document.createElement('div');
    if (state.dataUrl) {
      div.className = 'slot filled';
      div.innerHTML = `
        <img src="${state.dataUrl}" alt="${escHtml(label)}" />
        <span class="slot-label">${escHtml(label)}</span>
        <button type="button" class="slot-remove" title="Retirer">&times;</button>
      `;
      div.querySelector('.slot-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        state.file = null; state.dataUrl = null; state.mime = null;
        state.mediaId = null; state.mediaProjectId = null;
        render();
      });
    } else {
      div.className = 'slot';
      div.innerHTML = `<span>+ ${escHtml(label)}</span>`;
      div.addEventListener('click', () => fileInput.click());
    }
    container.appendChild(div);
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        state.file = file;
        state.dataUrl = evt.target.result;
        state.mime = file.type || 'image/png';
        state.mediaId = null;
        state.mediaProjectId = null;
        render();
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  render();

  return {
    get hasFile() { return !!state.dataUrl; },
    async ensureUploaded(projectId) {
      if (!state.dataUrl) return null;
      if (state.mediaId && state.mediaProjectId === projectId) return state.mediaId;
      const res = await flowPost('/flow/upload-image', {
        image_base64: state.dataUrl,
        mime_type: state.mime,
        project_id: projectId,
        file_name: (state.file && state.file.name) || 'image.png',
      });
      if (!res || !res.media_id) throw new Error(`Échec de l'import de l'image (${label}).`);
      state.mediaId = res.media_id;
      state.mediaProjectId = projectId;
      return state.mediaId;
    },
  };
}

// ── Generic segmented-control / mode-button wiring ────────────

function wireSeg(containerId, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return { get: () => null };
  let current = null;
  el.querySelectorAll('button').forEach((btn) => {
    if (btn.classList.contains('on')) current = btn.dataset.val;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      el.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      current = btn.dataset.val;
      if (onChange) onChange(current);
    });
  });
  return { get: () => current };
}

function wireModes(containerId, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return { get: () => null };
  let current = null;
  el.querySelectorAll('button').forEach((btn) => {
    if (btn.classList.contains('on')) current = btn.dataset.mode;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      el.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      current = btn.dataset.mode;
      if (onChange) onChange(current);
    });
  });
  return { get: () => current };
}

function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function readProjectId() {
  return (document.getElementById('flow-project-id')?.value || '').trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Results gallery ────────────────────────────────────────────

let resultSeq = 0;

function showResultsSection() {
  const el = document.getElementById('flow-results-section');
  if (el) el.style.display = '';
}

function renderResultMedia(kind, url) {
  if (!url) return '';
  return kind === 'video'
    ? `<video src="${escHtml(url)}" controls preload="metadata"></video>`
    : `<img src="${escHtml(url)}" alt="" loading="lazy" />`;
}

function wireResultActions(card, { mediaId, projectId }) {
  card.querySelectorAll('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const quality = btn.dataset.dl;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const res = await fetch(`${FLOW_API}/flow/export-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_id: mediaId, project_id: projectId, quality }),
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try { const j = await res.json(); msg = j.detail || msg; } catch { /* ignore */ }
          throw new Error(msg);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `flow-${mediaId}-${quality}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (e) {
        alert(`Export ${quality.toUpperCase()} impossible : ${e.message || e}`);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });
}

function addResult({ kind, prompt, url, mediaId, projectId, error, pending }) {
  showResultsSection();
  const grid = document.getElementById('flow-results');
  if (!grid) return null;

  const card = document.createElement('div');
  card.className = 'result-card' + (error ? ' errored' : '');
  card.dataset.kind = kind;
  card.dataset.mediaId = mediaId || '';
  card.dataset.projectId = projectId || '';
  card.dataset.prompt = prompt || '';

  if (pending) {
    card.innerHTML = `
      <div class="rc-body">
        <p class="rc-prompt">${escHtml(truncate(prompt, 90))}</p>
        <p class="rc-status">Génération en cours…</p>
      </div>`;
  } else if (error) {
    card.innerHTML = `
      <div class="rc-body">
        <p class="rc-prompt">${escHtml(truncate(prompt, 90))}</p>
        <p class="rc-status" style="color: var(--danger);">${escHtml(error)}</p>
      </div>`;
  } else {
    const dlButtons = kind === 'image' && mediaId
      ? `<button type="button" data-dl="2k">2K</button><button type="button" data-dl="4k">4K</button>`
      : '';
    card.innerHTML = renderResultMedia(kind, url) + `
      <div class="rc-body">
        <p class="rc-prompt">${escHtml(truncate(prompt, 90))}</p>
        <div class="rc-actions">
          <a href="${escHtml(url)}" target="_blank" rel="noopener">Ouvrir</a>
          ${dlButtons}
        </div>
      </div>`;
    wireResultActions(card, { mediaId, projectId });
  }

  grid.prepend(card);
  return card;
}

function finishVideoResult(card, { url, error }) {
  if (!card) return;
  const prompt = card.dataset.prompt || '';
  if (error) {
    card.classList.add('errored');
    card.innerHTML = `
      <div class="rc-body">
        <p class="rc-prompt">${escHtml(truncate(prompt, 90))}</p>
        <p class="rc-status" style="color: var(--danger);">${escHtml(error)}</p>
      </div>`;
    return;
  }
  card.innerHTML = renderResultMedia('video', url) + `
    <div class="rc-body">
      <p class="rc-prompt">${escHtml(truncate(prompt, 90))}</p>
      <div class="rc-actions"><a href="${escHtml(url)}" target="_blank" rel="noopener">Ouvrir</a></div>
    </div>`;
}

// ── Video polling ──────────────────────────────────────────────
//
// A submit answers with either `workflows` (Omni text-to-video — poll
// /flow/check-omni-status) or `operations` (every other video path — poll
// /flow/check-status). Both are real batch-operation shapes from the agent;
// see agent/services/flow_client.py and agent/services/omni_flash.py.

async function pollVideoResult(submitted, projectId, { shouldContinue = () => true, onTick, intervalMs = 4000, timeoutMs = 300000 } = {}) {
  let workflows = submitted && submitted.workflows;
  let operations = submitted && submitted.operations;
  if ((!workflows || !workflows.length) && (!operations || !operations.length)) {
    throw new Error('Réponse de génération inattendue (ni opération ni workflow à surveiller).');
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!shouldContinue()) throw new Error('Arrêté par l’utilisateur.');
    await sleep(intervalMs);
    if (onTick) onTick(Math.round((Date.now() - start) / 1000));

    if (workflows && workflows.length) {
      const res = await flowPost('/flow/check-omni-status', {
        workflows, project_id: projectId, include_encoded_video: false,
      });
      const list = (res && res.workflows) || [];
      if (list.length) {
        workflows = list.map((w) => ({ name: w.name, primary_media_id: w.primary_media_id, project_id: w.project_id }));
      }
      const failed = list.find((w) => w.status === 'FAILED' || w.error);
      if (failed) throw new Error(failed.error || 'Échec de la génération vidéo.');
      if (list.length && list.every((w) => w.done)) {
        const url = list[0]?.media?.url;
        if (url) return { url };
        throw new Error('Vidéo terminée mais aucune URL renvoyée par Google Flow.');
      }
    } else {
      const res = await flowPost('/flow/check-status', { operations });
      const list = (res && res.operations) || [];
      if (list.length) operations = list;
      const op = list[0];
      if (op && op.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL') {
        const url = op.operation?.metadata?.video?.fifeUrl;
        if (url) return { url };
      }
      if (op && op.status === 'MEDIA_GENERATION_STATUS_FAILED') {
        throw new Error(op.error || op.complaint || 'Échec de la génération vidéo.');
      }
    }
  }
  throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)}s) en attendant la vidéo.`);
}

// ── Image panel ──────────────────────────────────────────────

const IMAGE_ASPECT_MAP = {
  '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  '1:1': 'IMAGE_ASPECT_RATIO_SQUARE',
};

let imageMode = 't2i';
let imageRunning = false;
let imageBaseSlot = null;
let imageAspectCtrl = { get: () => '16:9' };
let imageCountCtrl = { get: () => '1' };

function initImagePanel() {
  imageBaseSlot = createSingleSlot('flow-image-base-slot', 'flow-image-base-file', 'Image de base');

  wireModes('flow-image-modes', (mode) => {
    imageMode = mode;
    const wrap = document.getElementById('flow-image-base-wrap');
    if (wrap) wrap.style.display = mode === 'i2i' ? '' : 'none';
  });

  imageAspectCtrl = wireSeg('flow-image-aspect');
  imageCountCtrl = wireSeg('flow-image-count');

  const runBtn = document.getElementById('run-flow-image');
  const stopBtn = document.getElementById('stop-flow-image');
  if (runBtn) runBtn.addEventListener('click', () => { if (!imageRunning) runImageBatch(); });
  if (stopBtn) stopBtn.addEventListener('click', () => { imageRunning = false; });
}

async function runImageBatch() {
  const errEl = document.getElementById('flow-image-err');
  const progressEl = document.getElementById('flow-image-progress');
  const runBtn = document.getElementById('run-flow-image');
  const stopBtn = document.getElementById('stop-flow-image');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  const prompts = (document.getElementById('flow-prompts')?.value || '')
    .split('\n').map((p) => p.trim()).filter(Boolean);
  if (!prompts.length) { showErr(errEl, 'Veuillez saisir au moins un prompt.'); return; }

  const projectId = readProjectId();
  if (!UUID_RE.test(projectId)) {
    showErr(errEl, "Identifiant de projet Google Flow invalide (attendu au format UUID, ex: c9ca385f-46c8-4ab2-bd4e-b31bce53e627)."); return;
  }
  if (imageMode === 'i2i' && !imageBaseSlot.hasFile) {
    showErr(errEl, 'Le mode Image → Image nécessite une image de base.'); return;
  }

  const seedRaw = (document.getElementById('flow-seed')?.value || '').trim();
  const baseSeed = seedRaw && !isNaN(parseInt(seedRaw, 10)) ? parseInt(seedRaw, 10) : null;
  const aspect = IMAGE_ASPECT_MAP[imageAspectCtrl.get() || '16:9'];
  const count = parseInt(imageCountCtrl.get() || '1', 10);
  const model = document.getElementById('flow-image-model')?.value || 'NANO_BANANA_PRO';

  imageRunning = true;
  runBtn.disabled = true; runBtn.textContent = 'Envoi en cours…';
  stopBtn.style.display = 'inline-flex';

  try {
    let sourceMediaId = null;
    if (imageMode === 'i2i') {
      progressEl.textContent = "Import de l'image de base…";
      sourceMediaId = await imageBaseSlot.ensureUploaded(projectId);
    }

    let refIds = [];
    if (selectedIngredientItems().length) {
      progressEl.textContent = 'Import des références sélectionnées…';
      refIds = await getSelectedReferenceMediaIds(projectId);
    }

    for (let i = 0; i < prompts.length && imageRunning; i++) {
      const prompt = prompts[i];
      progressEl.textContent = `Image ${i + 1}/${prompts.length} — envoi…`;
      const seed = baseSeed !== null ? baseSeed + i * 97 : undefined;

      try {
        const body = {
          prompt,
          project_id: projectId,
          aspect_ratio: aspect,
          image_model: model,
          count,
          seed,
          reference_media_ids: refIds.length ? refIds : undefined,
        };
        const data = imageMode === 'i2i'
          ? await flowPost('/flow/edit-image', { ...body, source_media_id: sourceMediaId })
          : await flowPost('/flow/generate-image', body);

        const media = (data && data.media) || [];
        media.forEach((m) => {
          addResult({
            kind: 'image',
            prompt,
            url: m?.image?.generatedImage?.fifeUrl,
            mediaId: m?.image?.generatedImage?.mediaId,
            projectId,
          });
        });
        if (!media.length) addResult({ kind: 'image', prompt, error: 'Aucune image renvoyée par Google Flow.' });
        (data?.failed_variants || []).forEach((f) => {
          addResult({ kind: 'image', prompt, error: `Variante ${f.index} : ${f.error}` });
        });
      } catch (e) {
        addResult({ kind: 'image', prompt, error: e.message || String(e) });
      }
    }
  } catch (e) {
    showErr(errEl, e.message || String(e));
  } finally {
    imageRunning = false;
    runBtn.disabled = false; runBtn.textContent = 'Générer les images';
    stopBtn.style.display = 'none';
    progressEl.textContent = '';
    setTimeout(fetchLog, 500);
    setTimeout(fetchStatus, 500);
  }
}

// ── Video panel ──────────────────────────────────────────────

const VIDEO_ASPECT_MAP = {
  '16:9': 'VIDEO_ASPECT_RATIO_LANDSCAPE',
  '9:16': 'VIDEO_ASPECT_RATIO_PORTRAIT',
};

let videoMode = 't2v';
let videoEngine = 'omni_flash';
let videoRunning = false;
let videoStartSlot = null;
let videoEndSlot = null;
let videoAspectCtrl = { get: () => '16:9' };
let videoDurationCtrl = { get: () => '8' };
let videoResCtrl = { get: () => '720p' };

function updateVideoModeUI() {
  const engineWrap = document.getElementById('flow-video-engine-wrap');
  const startWrap = document.getElementById('flow-video-start-wrap');
  const endWrap = document.getElementById('flow-video-end-wrap');
  const refsHint = document.getElementById('flow-video-refs-hint');
  const fieldset = document.getElementById('flow-video-fieldset');

  if (engineWrap) engineWrap.style.display = videoMode === 'i2v' ? '' : 'none';
  if (startWrap) startWrap.style.display = (videoMode === 'i2v' || videoMode === 'fe2v') ? '' : 'none';
  if (endWrap) endWrap.style.display = videoMode === 'fe2v' ? '' : 'none';
  if (refsHint) refsHint.style.display = videoMode === 'r2v' ? '' : 'none';

  // Only Image → Vidéo can pick Veo. Every other mode runs on Omni Flash
  // because Veo start+end chaining and Veo r2v are not on Flow's batch API
  // today (see flowkit-local/CLAUDE.md — UNSUPPORTED_ON_BATCH_API).
  const engine = videoMode === 'i2v' ? videoEngine : 'omni_flash';
  if (fieldset) fieldset.disabled = engine === 'veo'; // Veo ignores duration/resolution entirely
}

function initVideoPanel() {
  videoStartSlot = createSingleSlot('flow-video-start-slot', 'flow-video-start-file', 'Départ');
  videoEndSlot = createSingleSlot('flow-video-end-slot', 'flow-video-end-file', 'Fin');

  wireModes('flow-video-modes', (mode) => { videoMode = mode; updateVideoModeUI(); });
  const engineCtrl = wireSeg('flow-video-engine', (val) => { videoEngine = val; updateVideoModeUI(); });
  void engineCtrl;

  videoAspectCtrl = wireSeg('flow-video-aspect');
  videoDurationCtrl = wireSeg('flow-video-duration');
  videoResCtrl = wireSeg('flow-video-res');

  updateVideoModeUI();

  const runBtn = document.getElementById('run-flow-video');
  const stopBtn = document.getElementById('stop-flow-video');
  if (runBtn) runBtn.addEventListener('click', () => { if (!videoRunning) runVideoBatch(); });
  if (stopBtn) stopBtn.addEventListener('click', () => { videoRunning = false; });
}

async function runVideoBatch() {
  const errEl = document.getElementById('flow-video-err');
  const progressEl = document.getElementById('flow-video-progress');
  const runBtn = document.getElementById('run-flow-video');
  const stopBtn = document.getElementById('stop-flow-video');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  const prompts = (document.getElementById('flow-prompts')?.value || '')
    .split('\n').map((p) => p.trim()).filter(Boolean);
  if (!prompts.length) { showErr(errEl, 'Veuillez saisir au moins un prompt.'); return; }

  const projectId = readProjectId();
  if (!UUID_RE.test(projectId)) {
    showErr(errEl, "Identifiant de projet Google Flow invalide (attendu au format UUID, ex: c9ca385f-46c8-4ab2-bd4e-b31bce53e627)."); return;
  }

  const engine = videoMode === 'i2v' ? videoEngine : 'omni_flash';
  const aspect = VIDEO_ASPECT_MAP[videoAspectCtrl.get() || '16:9'];
  const duration = parseInt(videoDurationCtrl.get() || '8', 10);
  const resolution = videoResCtrl.get() || '720p';

  if ((videoMode === 'i2v' || videoMode === 'fe2v') && !videoStartSlot.hasFile) {
    showErr(errEl, 'Ce mode nécessite une image de départ.'); return;
  }
  if (videoMode === 'fe2v' && !videoEndSlot.hasFile) {
    showErr(errEl, 'Le mode Début + Fin nécessite aussi une image de fin.'); return;
  }
  const refCount = selectedIngredientItems().length;
  if (videoMode === 'r2v' && refCount === 0) {
    showErr(errEl, 'Sélectionnez au moins une référence (Ingrédients & Références) pour ce mode.'); return;
  }
  if (videoMode === 'r2v' && refCount > 7) {
    showErr(errEl, 'Google Flow accepte au maximum 7 références par vidéo — désélectionnez-en quelques-unes.'); return;
  }

  videoRunning = true;
  runBtn.disabled = true; runBtn.textContent = 'Envoi en cours…';
  stopBtn.style.display = 'inline-flex';

  try {
    let startId = null;
    let endId = null;
    let refIds = [];

    if (videoMode === 'i2v' || videoMode === 'fe2v') {
      progressEl.textContent = "Import de l'image de départ…";
      startId = await videoStartSlot.ensureUploaded(projectId);
    }
    if (videoMode === 'fe2v') {
      progressEl.textContent = "Import de l'image de fin…";
      endId = await videoEndSlot.ensureUploaded(projectId);
    }
    if (videoMode === 'r2v') {
      progressEl.textContent = 'Import des références sélectionnées…';
      refIds = await getSelectedReferenceMediaIds(projectId, { max: 7 });
    }

    for (let i = 0; i < prompts.length && videoRunning; i++) {
      const prompt = prompts[i];
      const sceneId = `scene-${Date.now()}-${i}`;
      progressEl.textContent = `Vidéo ${i + 1}/${prompts.length} — envoi…`;
      let card = null;

      try {
        let submitted;
        if (videoMode === 't2v') {
          submitted = await flowPost('/flow/generate-video-omni-text', {
            prompt, project_id: projectId, scene_id: sceneId,
            duration_s: duration, aspect_ratio: aspect,
          });
        } else if (videoMode === 'i2v') {
          submitted = await flowPost('/flow/generate-video', {
            start_image_media_id: startId, prompt, project_id: projectId, scene_id: sceneId,
            aspect_ratio: aspect, model_family: engine, duration_s: duration, resolution,
          });
        } else if (videoMode === 'fe2v') {
          submitted = await flowPost('/flow/generate-video', {
            start_image_media_id: startId, end_image_media_id: endId, prompt,
            project_id: projectId, scene_id: sceneId, aspect_ratio: aspect,
            model_family: 'omni_flash', duration_s: duration, resolution,
          });
        } else {
          submitted = await flowPost('/flow/generate-video-refs', {
            reference_media_ids: refIds, prompt, project_id: projectId, scene_id: sceneId,
            aspect_ratio: aspect, model_family: 'omni_flash', duration_s: duration, resolution,
          });
        }

        card = addResult({ kind: 'video', prompt, pending: true });
        progressEl.textContent = `Vidéo ${i + 1}/${prompts.length} — génération en cours…`;
        const result = await pollVideoResult(submitted, projectId, {
          shouldContinue: () => videoRunning,
          onTick: (elapsedS) => {
            progressEl.textContent = `Vidéo ${i + 1}/${prompts.length} — génération en cours (${elapsedS}s)…`;
          },
        });
        finishVideoResult(card, { url: result.url });
      } catch (e) {
        if (card) finishVideoResult(card, { error: e.message || String(e) });
        else addResult({ kind: 'video', prompt, error: e.message || String(e) });
      }
    }
  } catch (e) {
    showErr(errEl, e.message || String(e));
  } finally {
    videoRunning = false;
    runBtn.disabled = false; runBtn.textContent = 'Générer les vidéos';
    stopBtn.style.display = 'none';
    progressEl.textContent = '';
    setTimeout(fetchLog, 500);
    setTimeout(fetchStatus, 500);
  }
}

// ── Generation-type tabs (Image / Vidéo) ──────────────────────

function initGenTypeTabs() {
  const seg = document.getElementById('flow-gen-type');
  const imgPanel = document.getElementById('flow-panel-image');
  const vidPanel = document.getElementById('flow-panel-video');
  if (!seg || !imgPanel || !vidPanel) return;

  seg.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      seg.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      const type = btn.dataset.genType;
      imgPanel.style.display = type === 'image' ? '' : 'none';
      vidPanel.style.display = type === 'video' ? '' : 'none';
    });
  });
}

// ── Project ID field ───────────────────────────────────────────

function initProjectIdField() {
  const el = document.getElementById('flow-project-id');
  if (!el) return;
  el.addEventListener('input', () => {
    const val = el.value.trim();
    const match = val.match(/project\/([a-f0-9-]{36})/i);
    if (match && match[1]) {
      el.value = match[1];
      const statusEl = document.getElementById('flow-project-status');
      if (statusEl) {
        statusEl.textContent = `Projet extrait : ${match[1].slice(0, 8)}…`;
        statusEl.style.color = 'var(--sage)';
      }
    }
  });
}

async function detectActiveProject() {
  const statusEl = document.getElementById('flow-project-status');
  const inputEl = document.getElementById('flow-project-id');
  if (!statusEl || !inputEl) return;

  try {
    const res = await fetch(`${FLOW_API}/active-project`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.project_id) {
        inputEl.value = data.project_id;
        statusEl.textContent = `Projet actif : ${data.project_name || data.project_id}`;
        statusEl.style.color = 'var(--sage)';
        return;
      }
    }
  } catch {
    /* service local not listening on 8100 */
  }
  statusEl.textContent = 'Projet manuel (service local indisponible ou aucun projet actif)';
  statusEl.style.color = 'var(--muted)';
}

// ── Results toolbar ────────────────────────────────────────────

function initResultsToolbar() {
  const btn = document.getElementById('flow-results-clear');
  const grid = document.getElementById('flow-results');
  if (btn && grid) btn.addEventListener('click', () => { grid.innerHTML = ''; });
}

// ── Initial Fetch & Background Listeners ─────────────────────

function fetchStatus() {
  chrome.runtime.sendMessage({ type: 'STATUS' }, (data) => {
    if (chrome.runtime.lastError) return;
    updateStatus(data);
  });
}

function fetchLog() {
  chrome.runtime.sendMessage({ type: 'REQUEST_LOG' }, (data) => {
    if (chrome.runtime.lastError) return;
    if (data && data.log) updateRequestLog(data.log);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_PUSH') {
    fetchStatus();
  }
  if (msg.type === 'REQUEST_LOG_UPDATE') {
    if (msg.log) updateRequestLog(msg.log);
  }
});

// ── Event Handlers ───────────────────────────────────────────

const toggleEl = document.getElementById('main-toggle');
if (toggleEl) {
  toggleEl.addEventListener('change', (e) => {
    const msgType = e.target.checked ? 'RECONNECT' : 'DISCONNECT';
    chrome.runtime.sendMessage({ type: msgType }, () => {
      if (chrome.runtime.lastError) return;
      setTimeout(fetchStatus, 400);
    });
  });
}

const flowBtn = document.getElementById('btn-flow');
if (flowBtn) {
  flowBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_FLOW_TAB' }, () => {
      if (chrome.runtime.lastError) return;
    });
  });
}

const tokenBtn = document.getElementById('btn-token');
if (tokenBtn) {
  tokenBtn.addEventListener('click', () => {
    tokenBtn.textContent = 'Ouverture…';
    tokenBtn.disabled = true;
    chrome.runtime.sendMessage({ type: 'REFRESH_TOKEN' }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
      tokenBtn.textContent = 'Reconnecter la page';
      tokenBtn.disabled = false;
    });
  });
}

// ── Zoom Controller ──────────────────────────────────────────
function initZoom() {
  const zoomSelect = document.getElementById('flow-zoom-select');
  if (!zoomSelect) return;

  function applyZoom(val) {
    if (document?.documentElement?.style) {
      document.documentElement.style.setProperty('--ui-zoom', val);
      document.documentElement.style.zoom = val;
    }
    if (window.chrome?.storage?.local) {
      window.chrome.storage.local.set({ luminaZoom: val });
    }
  }

  if (window.chrome?.storage?.local) {
    window.chrome.storage.local.get(['luminaZoom'], (bag) => {
      const saved = bag?.luminaZoom || '1.15';
      zoomSelect.value = saved;
      applyZoom(saved);
    });
  } else {
    applyZoom('1.15');
  }

  zoomSelect.addEventListener('change', (e) => {
    applyZoom(e.target.value);
  });
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initZoom();
  fetchStatus();
  fetchLog();
  initIngredients();
  initGenTypeTabs();
  initImagePanel();
  initVideoPanel();
  initProjectIdField();
  initResultsToolbar();
  detectActiveProject();
});
