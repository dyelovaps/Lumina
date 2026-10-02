/**
 * Flow Kit — Chrome Extension Background Service Worker
 *
 * Connects to local Python agent via WebSocket (agent runs WS server).
 * Mints reCAPTCHA and runs Flow's batchexecute RPCs inside the Flow tab.
 *
 * Flow moved to flow.google.com in September 2026 and stopped minting the
 * `Bearer ya29.…` the old REST host needed. The current path is `batch_rpc`:
 * the agent builds an `f.req` envelope, this worker mints a captcha for it and
 * runs the POST in the page's MAIN world, where the `at` CSRF token lives.
 * The bearer capture and the `api_request` / `trpc_request` proxies below are
 * the pre-migration path. The agent no longer sends either — it speaks only
 * `batch_rpc`. They stay so an extension updated ahead of its agent keeps
 * serving an older one; remove them once no agent in the wild sends them.
 */

const AGENT_WS_URL = 'ws://127.0.0.1:9222';
// NOTE: This is a browser-restricted public API key — safe to ship in extension bundles.
const API_KEY = 'AIzaSyBtrm0o5ab1c-Ec8ZuLcGt3oJAA5VWt3pY';

// labs.google/fx/tools/flow still resolves but redirects here, so in practice a
// signed-in tab is only ever flow.google.com/*. The legacy patterns stay for an
// old pinned tab. Every tab lookup in this file goes through this list.
const flowUrls = [
  'https://flow.google.com/*',
  'https://labs.google/fx/tools/flow*',
  'https://labs.google/fx/*/tools/flow*',
];
const FLOW_TAB_URL = 'https://flow.google.com/';

let ws = null;
let flowKey = null;
let callbackSecret = null;  // Auth secret for HTTP callback, received from server on WS connect
let state = 'off'; // off | idle | running
let manualDisconnect = true;
let metrics = {
  tokenCapturedAt: null,
  requestCount: 0,   // captcha-consuming requests only (gen image/video/upscale)
  successCount: 0,
  failedCount: 0,
  lastError: null,
};

// ─── URL → Log Type Classifier ─────────────────────────────

// Visible log types — only these appear in the request log
const _VISIBLE_TYPES = new Set(['GEN_IMG', 'GEN_VID', 'GEN_VID_REF', 'UPSCALE', 'TRACKING', 'URL_REFRESH']);

function _classifyApiUrl(url) {
  if (url.includes('uploadImage'))                     return 'UPLOAD';
  if (url.includes('batchGenerateImages'))              return 'GEN_IMG';
  if (url.includes('UpsampleVideo'))                   return 'UPSCALE';
  if (url.includes('ReferenceImages'))                 return 'GEN_VID_REF';
  if (url.includes('batchAsyncGenerateVideo'))          return 'GEN_VID';
  if (url.includes('batchCheckAsync'))                  return 'POLL';
  if (url.includes('upsampleImage'))                   return 'UPS_IMG';
  if (url.includes('/media/'))                         return 'MEDIA';
  if (url.includes('/credits'))                        return 'CREDITS';
  return 'API';
}

// ─── Request Log ────────────────────────────────────────────

let requestLog = [];

function addRequestLog(entry) {
  requestLog.unshift(entry);
  if (requestLog.length > 100) requestLog.pop();
  broadcastRequestLog();
}

function updateRequestLog(id, updates) {
  const entry = requestLog.find((e) => e.id === id);
  if (entry) Object.assign(entry, updates);
  broadcastRequestLog();
}

function broadcastRequestLog() {
  chrome.runtime.sendMessage({ type: 'REQUEST_LOG_UPDATE', log: requestLog }).catch(() => {});
}

// ─── Startup ────────────────────────────────────────────────

let initializationPromise = null;

chrome.runtime.onInstalled.addListener(() => {
  void ensureInitialized();
});
chrome.runtime.onStartup.addListener(() => {
  void ensureInitialized();
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  await ensureInitialized();
  if (manualDisconnect) return;
  if (alarm.name === 'lumina-flow-reconnect') connectToAgent();
  if (alarm.name === 'lumina-flow-keepAlive') keepAlive();
  if (alarm.name === 'lumina-flow-token-refresh') {
    // Passive maintenance must never create browser tabs. If the user has no
    // Flow tab open, wait for an explicit action or an actual RPC to open one.
    await captureTokenFromFlowTab({ createIfMissing: false });
  }
});

function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = initialize().catch((error) => {
      initializationPromise = null;
      console.error('[FlowAgent] Initialization failed', error);
      throw error;
    });
  }
  return initializationPromise;
}

async function initialize() {
  const data = await chrome.storage.local.get(['flowKey', 'metrics', 'callbackSecret', 'luminaFlowEnabled', 'luminaFlowPace']);
  if (data.flowKey) flowKey = data.flowKey;
  if (PACE_PRESETS[data.luminaFlowPace]) pacePreset = data.luminaFlowPace;
  if (data.metrics) Object.assign(metrics, data.metrics);
  if (data.callbackSecret) callbackSecret = data.callbackSecret;
  manualDisconnect = data.luminaFlowEnabled !== true;
  // Rôle « principal » (role.js) : Flow tourne dans l'autre profil Chrome, jamais de connexion ici.
  if (!(await flowRoleAllows())) manualDisconnect = true;
  if (manualDisconnect) return;
  connectToAgent();
  chrome.alarms.create('lumina-flow-keepAlive', { periodInMinutes: 0.4 });
}

// MV3 workers can be suspended and restarted without onStartup firing.
// Rehydrate the persisted Flow key on every worker start.
void ensureInitialized();

// ─── Token Capture ──────────────────────────────────────────

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details?.requestHeaders?.length) return;
    const authHeader = details.requestHeaders.find(
      (h) => h.name?.toLowerCase() === 'authorization',
    );
    const value = authHeader?.value || '';
    if (!value.startsWith('Bearer ya29.')) return;

    const token = value.replace(/^Bearer\s+/i, '').trim();
    if (!token) return;

    // Always update — even if same token string, refresh the timestamp
    flowKey = token;
    metrics.tokenCapturedAt = Date.now();
    chrome.storage.local.set({ flowKey, metrics });
    console.log('[FlowAgent] Bearer token captured');

    // Notify agent
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'token_captured', flowKey }));
    }
  },
  { urls: ['https://aisandbox-pa.googleapis.com/*', 'https://labs.google/*'] },
  ['requestHeaders', 'extraHeaders'],
);

let _openingFlowTab = false;

async function captureTokenFromFlowTab({ createIfMissing = false } = {}) {
  let tabs = await chrome.tabs.query({ url: flowUrls });
  if (!tabs.length) {
    if (!createIfMissing) {
      console.log('[FlowAgent] No Flow tab found — passive refresh skipped');
      return { skipped: 'NO_FLOW_TAB' };
    }
    if (_openingFlowTab) {
      console.log('[FlowAgent] Flow tab already opening, skipping');
      return;
    }
    _openingFlowTab = true;
    try {
      console.log('[FlowAgent] No Flow tab found — opening one for explicit refresh');
      const opened = await chrome.tabs.create({ url: FLOW_TAB_URL, active: false });
      await sleep(3000);
      const target = opened?.id ? await chrome.tabs.get(opened.id).catch(() => null) : null;
      if (!target) {
        console.log('[FlowAgent] Flow tab not ready yet after open');
        return;
      }
      await chrome.scripting.executeScript({
        target: { tabId: target.id },
        files: ['flow/content.js'],
      });
      console.log('[FlowAgent] Token refresh triggered on newly opened Flow tab');
    } catch (e) {
      console.error('[FlowAgent] Token refresh failed after opening tab:', e);
    } finally {
      _openingFlowTab = false;
    }
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['flow/content.js'],
    });
    console.log('[FlowAgent] Token refresh triggered on Flow tab');
  } catch (e) {
    console.error('[FlowAgent] Token refresh failed:', e);
  }
}

// ─── WebSocket to Agent ─────────────────────────────────────

function connectToAgent() {
  if (manualDisconnect) return;
  if (ws?.readyState === WebSocket.CONNECTING) return;
  if (ws?.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(AGENT_WS_URL);
  } catch (e) {
    console.error('[FlowAgent] WS connect error:', e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[FlowAgent] Connected to agent');
    chrome.alarms.clear('lumina-flow-reconnect');
    setState('idle');

    // Token refresh alarm — 45 min gives buffer before ~60 min expiry
    chrome.alarms.create('lumina-flow-token-refresh', { periodInMinutes: 45 });

    // Send current state + resend token if we have one
    ws.send(JSON.stringify({
      type: 'extension_ready',
      flowKeyPresent: !!flowKey,
      extensionVersion: chrome.runtime.getManifest().version,
      flowUrlSupported: chrome.runtime.getManifest().host_permissions?.includes('https://flow.google.com/*') === true,
      tokenAge: flowKey && metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
    }));
    if (flowKey) {
      ws.send(JSON.stringify({ type: 'token_captured', flowKey }));
    }
  };

  ws.onmessage = async ({ data }) => {
    try {
      const msg = JSON.parse(data);

      if (msg.method === 'batch_rpc') {
        await handleBatchRpc(msg);
      } else if (msg.method === 'api_request') {
        await handleApiRequest(msg);
      } else if (msg.method === 'trpc_request') {
        await handleTrpcRequest(msg);
      } else if (msg.method === 'solve_captcha') {
        await handleSolveCaptcha(msg);
      } else if (msg.method === 'get_status') {
        sendToAgent({
          id: msg.id,
          result: {
            state,
            flowKeyPresent: !!flowKey,
            manualDisconnect,
            tokenAge: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
            metrics,
          },
        });
      } else if (msg.type === 'callback_secret') {
        callbackSecret = msg.secret;
        chrome.storage.local.set({ callbackSecret: msg.secret });
        console.log('[FlowAgent] Received callback secret');
      } else if (msg.type === 'pong') {
        // keepalive response
      }
    } catch (e) {
      console.error('[FlowAgent] Message error:', e);
    }
  };

  ws.onclose = () => {
    setState('off');
    chrome.alarms.clear('lumina-flow-token-refresh');
    if (!manualDisconnect) scheduleReconnect();
  };

  ws.onerror = (e) => {
    console.error('[FlowAgent] WS error:', e);
    metrics.lastError = 'WS_ERROR';
    chrome.storage.local.set({ metrics });
  };
}

function scheduleReconnect() {
  chrome.alarms.create('lumina-flow-reconnect', { delayInMinutes: 0.083 }); // ~5s
}

function keepAlive() {
  void reportFlowState();
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  } else {
    connectToAgent();
  }
}

function sendToAgent(msg) {
  // API responses (with msg.id) go via HTTP — immune to WS disconnect
  if (msg.id) {
    fetch('http://127.0.0.1:8100/api/ext/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    }).catch(() => {
      // HTTP failed — fallback to WS
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    });
    return;
  }
  // Non-response messages (ping, status) or no secret yet — use WS
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ─── reCAPTCHA Solving ──────────────────────────────────────

async function requestCaptchaFromTab(tabId, requestId, pageAction) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: 'GET_CAPTCHA',
      requestId,
      pageAction,
    });
  } catch (error) {
    const msg = error?.message || '';
    const shouldInject =
      msg.includes('Receiving end does not exist') ||
      msg.includes('Could not establish connection');
    if (!shouldInject) throw error;

    // Inject content script and retry
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['flow/content.js'],
    });
    await sleep(200);
    return await chrome.tabs.sendMessage(tabId, {
      type: 'GET_CAPTCHA',
      requestId,
      pageAction,
    });
  }
}

/** Try to wake a discarded Flow tab so `sendMessage` can reach it.
 *  Chrome auto-discards backgrounded tabs to save memory; the tab still shows
 *  up in `chrome.tabs.query` but cross-context calls fail with "No current
 *  window" / "No tab with id". A reload re-hydrates it. */
async function reviveTabIfNeeded(tab) {
  if (!tab?.discarded) return tab;
  try {
    await chrome.tabs.reload(tab.id);
    await sleep(2500);
    return await chrome.tabs.get(tab.id);
  } catch {
    return null;
  }
}

function captchaFromTab(tabId, requestId, captchaAction) {
  return Promise.race([
    requestCaptchaFromTab(tabId, requestId, captchaAction),
    new Promise((_, rej) => setTimeout(() => rej(new Error('CAPTCHA_TIMEOUT')), 30000)),
  ]);
}

async function solveCaptcha(requestId, captchaAction) {
  let tabs = await chrome.tabs.query({ url: flowUrls });

  // No Flow tab at all — spawn one and let it settle. Keep the exact tab id:
  // a redirected or stale tab must not make us select some older candidate.
  if (!tabs.length) {
    let opened;
    try {
      opened = await chrome.tabs.create({ url: FLOW_TAB_URL, active: false });
      await sleep(3000);
    } catch (e) {
      return { error: e.message || 'NO_FLOW_TAB' };
    }
    const target = opened?.id ? await chrome.tabs.get(opened.id).catch(() => null) : null;
    if (!target) return { error: 'NO_FLOW_TAB' };
    tabs = [target];
  }

  // Try each Flow tab in turn. A tab that answers "no grecaptcha" is a tab
  // sitting on a page that never loaded it — another Flow tab may well be
  // fine. Returning on the first one let one stale tab veto every generation.
  const errors = [];
  for (const candidate of tabs) {
    const tab = await reviveTabIfNeeded(candidate);
    if (!tab) continue;
    try {
      const resp = await captchaFromTab(tab.id, requestId, captchaAction);
      if (!resp?.token) {
        errors.push(resp?.error || 'NO_TOKEN');
        continue;
      }
      return resp;
    } catch (e) {
      const msg = e?.message || '';
      errors.push(msg);
      // Tab evaporated mid-call (window closed, discarded again, navigated
      // away). Move on to the next candidate rather than failing the job.
      if (
        msg.includes('No current window') ||
        msg.includes('No tab with id') ||
        msg.includes('Receiving end does not exist')
      ) {
        continue;
      }
      return { error: msg };
    }
  }

  // Every candidate failed — last-ditch, spawn a fresh temporary tab and
  // target THAT exact tab. Previously we re-queried all Flow tabs and picked
  // fresh[0], which could select the same stale tab again while leaking the
  // newly-created one on every retry.
  let recoveryTab = null;
  try {
    recoveryTab = await chrome.tabs.create({ url: FLOW_TAB_URL, active: false });
    await sleep(3000);
    const target = await chrome.tabs.get(recoveryTab.id);
    if (!target || target.discarded) return { error: 'NO_FLOW_TAB' };
    return await captchaFromTab(target.id, requestId, captchaAction);
  } catch (e) {
    return { error: e?.message || errors[0] || 'NO_FLOW_TAB' };
  } finally {
    // A recovery tab is disposable: there were already Flow tabs available
    // for the signed RPC. Do not let CAPTCHA retries accumulate root tabs.
    if (recoveryTab?.id) {
      try { await chrome.tabs.remove(recoveryTab.id); } catch { /* already gone */ }
    }
  }
}

async function handleSolveCaptcha(msg) {
  const { id, params } = msg;
  if (pace.cooldownUntil > Date.now()) {
    sendToAgent({ id, result: { error: 'FLOW_COOLDOWN' } });
    return;
  }
  const result = await solveCaptcha(id, params?.captchaAction || 'VIDEO_GENERATION');

  // Standalone captcha solve counts as captcha-consuming
  metrics.requestCount++;
  if (result?.token) {
    metrics.successCount++;
  } else {
    metrics.failedCount++;
    metrics.lastError = result?.error || 'NO_TOKEN';
  }
  chrome.storage.local.set({ metrics });

  sendToAgent({ id, result });
}

// ─── Rythme anti-restriction ────────────────────────────────
//
// Google Flow classe un profil en « robot » quand les générations (chacune
// porte un reCAPTCHA neuf) s'enchaînent à cadence fixe, sans pause, et que les
// RPC partent en rafale. Tout batch_rpc passe donc par une file unique : un
// écart minimal entre deux RPC, un écart plus long (avec aléa) entre deux
// générations, et une mise au repos exponentielle dès que Flow signale une
// limite (429, RESOURCE_EXHAUSTED, reCAPTCHA refusé…). Le panneau lit le même
// réglage (luminaFlowPace) pour espacer ses prompts et ses sondages.

const PACE_PRESETS = {
  prudent: { genGapMs: 30000, rpcGapMs: 2500, jitter: 0.35 },
  normal:  { genGapMs: 18000, rpcGapMs: 1500, jitter: 0.3 },
  rapide:  { genGapMs: 9000,  rpcGapMs: 800,  jitter: 0.25 },
};
const COOLDOWN_BASE_MS = 60000;
const COOLDOWN_MAX_MS = 15 * 60000;
const THROTTLE_RE = /RESOURCE_EXHAUSTED|UNUSUAL_ACTIVITY|unusual traffic|too many requests|rate.?limit|recaptcha[^"\]]{0,60}(?:fail|invalid|denied|refus)/i;

let pacePreset = 'normal';
const pace = { lastRpcAt: 0, nextGenAt: 0, cooldownUntil: 0, strikes: 0, lastReason: null };
let rpcChain = Promise.resolve();

function paceConfig() {
  return PACE_PRESETS[pacePreset] || PACE_PRESETS.normal;
}

function jittered(ms) {
  const j = paceConfig().jitter;
  return Math.round(ms * (1 - j / 2 + Math.random() * j));
}

function paceStatus() {
  return {
    preset: pacePreset,
    genGapMs: paceConfig().genGapMs,
    cooldownUntil: pace.cooldownUntil,
    cooldownLeftMs: Math.max(0, pace.cooldownUntil - Date.now()),
    strikes: pace.strikes,
    lastReason: pace.lastReason,
  };
}

function broadcastPace() {
  chrome.runtime.sendMessage({ type: 'PACE_PUSH', pace: paceStatus() }).catch(() => {});
}

function isThrottled(out) {
  if (!out) return false;
  if (out.error) return /CAPTCHA|429|RESOURCE_EXHAUSTED|UNUSUAL/i.test(out.error);
  if (out.status === 429 || out.status === 403) return true;
  return THROTTLE_RE.test((out.text || '').slice(0, 4000));
}

function registerThrottle(reason) {
  pace.strikes = Math.min(pace.strikes + 1, 8);
  const wait = Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * 2 ** (pace.strikes - 1));
  pace.cooldownUntil = Date.now() + jittered(wait);
  pace.lastReason = String(reason || 'LIMITE').slice(0, 160);
  console.warn(`[FlowAgent] Limite Google Flow détectée (${pace.lastReason}) — repos ${Math.round(wait / 1000)}s`);
  broadcastPace();
}

function registerGenSuccess() {
  if (pace.strikes > 0) {
    pace.strikes--;
    broadcastPace();
  }
}

// Serialise every RPC; generates also wait for their own slot and for the
// end of any cooldown. A generate during cooldown fails fast so the agent never
// burns a reCAPTCHA against a profile Flow is already throttling.
function pacedRpc(cmd) {
  const run = async () => {
    const isGen = !!cmd.captchaAction;
    if (isGen) {
      if (pace.cooldownUntil > Date.now()) {
        const s = Math.ceil((pace.cooldownUntil - Date.now()) / 1000);
        return { error: `FLOW_COOLDOWN: pause anti-restriction, reprise dans ${s}s` };
      }
      const waitGen = pace.nextGenAt - Date.now();
      if (waitGen > 0) await sleep(waitGen);
    }
    const waitRpc = pace.lastRpcAt + jittered(paceConfig().rpcGapMs) - Date.now();
    if (waitRpc > 0) await sleep(waitRpc);
    try {
      const out = await runBatchRpc(cmd);
      if (isGen) {
        if (isThrottled(out)) registerThrottle(out.error || `HTTP ${out.status}`);
        else if (!out.error) registerGenSuccess();
      } else if (out?.status === 429) {
        registerThrottle('HTTP 429');
      }
      return out;
    } finally {
      pace.lastRpcAt = Date.now();
      if (isGen) pace.nextGenAt = Date.now() + jittered(paceConfig().genGapMs);
    }
  };
  const p = rpcChain.then(run, run);
  rpcChain = p.catch(() => {});
  return p;
}

chrome.storage.onChanged?.addListener?.((changes, area) => {
  if (area === 'local' && changes.luminaFlowPace) {
    pacePreset = PACE_PRESETS[changes.luminaFlowPace.newValue] ? changes.luminaFlowPace.newValue : 'normal';
    broadcastPace();
  }
});

// ─── Page-context RPC runner (the current path) ─────────────
//
// Flow's frontend signs its calls with cookies and a per-page `at` token, and
// every generate carries a single-use reCAPTCHA. None of that can be replayed
// from the service worker, so the request has to be issued by the Flow page
// itself: mint a fresh captcha through the grecaptcha bridge, then run the
// batchexecute POST in the page's MAIN world, where at / f.sid / bl live.

const CAPTCHA_SLOT = '__CAPTCHA__';
const MAX_RPC_TEXT = 32000000; // the project listing alone is past 17 MB

async function runBatchRpc(cmd) {
  const tabs = await chrome.tabs.query({ url: flowUrls });
  let candidate = tabs.find((t) => !t.discarded) || tabs[0];
  if (!candidate) {
    // No Flow tab — open one and give the app a moment to boot, otherwise
    // WIZ_global_data is not on the page yet and `at` comes back empty. Keep
    // the exact created tab id so redirects/stale tabs cannot hijack recovery.
    let opened;
    try {
      opened = await chrome.tabs.create({ url: FLOW_TAB_URL, active: false });
      await sleep(5000);
      candidate = opened?.id ? await chrome.tabs.get(opened.id).catch(() => null) : null;
    } catch (e) {
      return { error: e?.message || 'NO_FLOW_TAB' };
    }
    if (!candidate) return { error: 'NO_FLOW_TAB' };
  }
  // Chrome discards backgrounded tabs; executeScript throws on a dead one.
  const tab = await reviveTabIfNeeded(candidate);
  if (!tab) return { error: 'FLOW_TAB_DISCARDED' };

  let freq = cmd.freq;
  if (cmd.captchaAction) {
    const solved = await solveCaptcha(cmd.id, cmd.captchaAction);
    if (!solved?.token) return { error: `CAPTCHA_FAILED: ${solved?.error || 'no token'}` };
    freq = freq.split(CAPTCHA_SLOT).join(solved.token);
  }

  const [injected] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    args: [cmd.rpcid, freq, MAX_RPC_TEXT, cmd.match || null],
    func: async (rpcid, freqStr, maxText, match) => {
      const wiz = globalThis.WIZ_global_data || {};
      const at = wiz.SNlM0e;
      const sid = wiz.FdrFJe;
      const bl = wiz.cfb2h;
      if (!at) return { error: 'NO_AT_TOKEN' };
      const reqid = Math.floor(Math.random() * 900000) + 100000;
      // Match Flow's own WIZ metadata. GEM_PIX_2 (Nano Banana Pro) rejects
      // image generation when source-path is missing even though Lite may not.
      const sourcePath = location.pathname || '/';
      const hl = (document.documentElement.lang || navigator.language || 'en').split('-')[0];
      const url =
        `/_/AiSandboxAngularFrontend/data/batchexecute?rpcids=${encodeURIComponent(rpcid)}` +
        `&source-path=${encodeURIComponent(sourcePath)}` +
        `&bl=${encodeURIComponent(bl || '')}&f.sid=${encodeURIComponent(sid || '')}` +
        `&hl=${encodeURIComponent(hl)}&_reqid=${reqid}&rt=c`;
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'x-same-domain': '1',
        },
        body: new URLSearchParams({ 'f.req': freqStr, at }),
      });
      const text = await resp.text();
      // The project listing is tens of megabytes and all we ever want from it
      // is one entry. Cutting it down here keeps that payload inside the tab
      // instead of pushing it through the bridge on every poll.
      if (match) {
        const found = text.indexOf(match);   // not `at` — that is the CSRF token above
        return {
          status: resp.status,
          matched: found !== -1,
          text: found === -1 ? '' : text.slice(found, found + 800),
        };
      }
      return { status: resp.status, text: text.slice(0, maxText) };
    },
  });

  return injected?.result || { error: 'NO_INJECTION_RESULT' };
}

async function handleBatchRpc(msg) {
  const { id, params } = msg;
  const { rpcid, freq, captchaAction, match } = params || {};
  if (!rpcid || !freq) {
    sendToAgent({ id, status: 400, error: 'INVALID_BATCH_RPC' });
    return;
  }

  setState('running');
  const hasCaptcha = !!captchaAction;
  if (hasCaptcha) metrics.requestCount++;
  // Polls and listing lookups run constantly; only the generates are worth
  // a row in the log the popup shows.
  const visible = hasCaptcha;
  if (visible) {
    addRequestLog({
      id, type: `RPC:${rpcid}`, time: new Date().toISOString(),
      status: 'processing', error: null, outputUrl: null, url: rpcid,
      payloadSummary: freq.slice(0, 200),
    });
  }

  try {
    const out = await pacedRpc({ id, rpcid, freq, captchaAction, match });
    if (out.error) {
      if (hasCaptcha) { metrics.failedCount++; metrics.lastError = out.error; }
      if (visible) updateRequestLog(id, { status: 'failed', error: out.error });
      sendToAgent({ id, status: 502, error: out.error });
    } else {
      if (hasCaptcha) { metrics.successCount++; metrics.lastError = null; }
      if (visible) {
        updateRequestLog(id, {
          status: 'success', httpStatus: out.status,
          responseSummary: (out.text || '').slice(0, 300),
        });
      }
      sendToAgent({ id, status: out.status, data: out.text });
    }
  } catch (e) {
    const err = e?.message || 'BATCH_RPC_FAILED';
    if (hasCaptcha) { metrics.failedCount++; metrics.lastError = err; }
    if (visible) updateRequestLog(id, { status: 'failed', error: err });
    sendToAgent({ id, status: 500, error: err });
  }

  chrome.storage.local.set({ metrics });
  setState('idle');
}

// ─── API Request Proxy ──────────────────────────────────────

async function handleTrpcRequest(msg) {
  const { id, params } = msg;
  const { url, method = 'POST', headers = {}, body, responseMode = 'json' } = params;

  if (!url || !url.startsWith('https://labs.google/')) {
    sendToAgent({ id, error: 'INVALID_TRPC_URL' });
    return;
  }

  setState('running');
  // TRPC calls don't consume captcha — don't count in metrics

  const logId = id;
  const logType = url.includes('createProject') ? 'CREATE_PROJECT' : 'TRPC';
  // TRPC calls are silent — don't show in request log

  const fetchHeaders = { 'Content-Type': 'application/json', ...headers };
  if (flowKey) {
    fetchHeaders['authorization'] = `Bearer ${flowKey}`;
  }

  try {
    const resp = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    let data;
    if (responseMode === 'url') {
      // fetch() has already followed the authenticated Flow redirect. Return
      // only the final signed URL and cancel the body so large videos are not
      // buffered in the extension or copied through the WebSocket bridge.
      data = {
        url: resp.url,
        contentType: resp.headers.get('content-type'),
      };
      await resp.body?.cancel();
    } else {
      data = await resp.json();
    }
    chrome.storage.local.set({ metrics });
    updateRequestLog(logId, { status: 'success' });
    sendToAgent({ id, status: resp.status, data });
  } catch (e) {
    console.error('[FlowAgent] tRPC request failed:', e);
    chrome.storage.local.set({ metrics });
    updateRequestLog(logId, { status: 'failed', error: e.message || 'TRPC_FETCH_FAILED' });
    sendToAgent({ id, error: e.message || 'TRPC_FETCH_FAILED' });
  } finally {
    setState('idle');
  }
}

// Legacy REST proxy against aisandbox-pa. No current agent sends `api_request`;
// kept only so an extension updated ahead of its agent still serves an older
// one. It needs a `Bearer ya29.…` that Flow stopped minting, so it 401s on any
// post-migration profile — as does sendTelemetry below, which early-returns
// without a flowKey. Nothing here reaches aisandbox-pa any more; when the
// oldest agent in the wild speaks batch_rpc, this and the host permission go.
async function handleApiRequest(msg) {
  const { id, params } = msg;
  const { url, method, headers, body, captchaAction } = params;

  if (!url) {
    sendToAgent({ id, error: 'MISSING_URL' });
    return;
  }

  if (!url.startsWith('https://aisandbox-pa.googleapis.com/')) {
    sendToAgent({ id, error: 'INVALID_URL' });
    return;
  }

  setState('running');
  const hasCaptcha = !!captchaAction;
  if (hasCaptcha) metrics.requestCount++;

  const logId = id;
  const logType = _classifyApiUrl(url);
  if (_VISIBLE_TYPES.has(logType)) {
    const payloadSummary = body ? JSON.stringify(body).slice(0, 200) : null;
    addRequestLog({ id: logId, type: logType, time: new Date().toISOString(), status: 'processing', error: null, outputUrl: null, url, payloadSummary });
  }

  try {
    // Step 1: Solve captcha if needed
    let captchaToken = null;
    if (captchaAction) {
      const captchaResult = await solveCaptcha(id, captchaAction);
      captchaToken = captchaResult?.token || null;
      if (!captchaToken) {
        // Cannot proceed without captcha — API will 403
        const err = captchaResult?.error || 'CAPTCHA_FAILED';
        console.error(`[FlowAgent] Captcha failed for ${captchaAction}: ${err}`);
        sendToAgent({ id, status: 403, error: `CAPTCHA_FAILED: ${err}` });
        if (hasCaptcha) { metrics.failedCount++; metrics.lastError = `CAPTCHA_FAILED: ${err}`; }
        chrome.storage.local.set({ metrics });
        updateRequestLog(logId, { status: 'failed', error: `CAPTCHA_FAILED: ${err}` });
        setState('idle');
        return;
      }
    }

    // Step 2: Inject captcha token into body
    let finalBody = body;
    if (captchaToken && finalBody) {
      finalBody = JSON.parse(JSON.stringify(finalBody)); // deep clone
      if (finalBody.clientContext?.recaptchaContext) {
        finalBody.clientContext.recaptchaContext.token = captchaToken;
      }
      if (finalBody.requests && Array.isArray(finalBody.requests)) {
        for (const req of finalBody.requests) {
          if (req.clientContext?.recaptchaContext) {
            req.clientContext.recaptchaContext.token = captchaToken;
          }
        }
      }
    }

    // Step 3: Use flowKey for auth
    const activeFlowKey = flowKey;
    if (!activeFlowKey) {
      sendToAgent({ id, status: 503, error: 'NO_FLOW_KEY' });
      if (hasCaptcha) { metrics.failedCount++; metrics.lastError = 'NO_FLOW_KEY'; }
      chrome.storage.local.set({ metrics });
      updateRequestLog(logId, { status: 'failed', error: 'NO_FLOW_KEY' });
      setState('idle');
      return;
    }

    const fetchHeaders = { ...(headers || {}) };
    fetchHeaders['authorization'] = `Bearer ${activeFlowKey}`;

    // Step 4: Make the API call from browser context
    const response = await fetch(url, {
      method: method || 'POST',
      headers: fetchHeaders,
      credentials: 'include',
      body: method === 'GET' ? undefined : JSON.stringify(finalBody),
    });

    let responseData;
    const responseText = await response.text();
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    sendToAgent({
      id,
      status: response.status,
      data: responseData,
    });

    const responseSummary = responseText ? responseText.slice(0, 300) : null;
    if (response.ok) {
      if (hasCaptcha) { metrics.successCount++; metrics.lastError = null; }
      updateRequestLog(logId, { status: 'success', httpStatus: response.status, responseSummary });
    } else {
      if (hasCaptcha) { metrics.failedCount++; metrics.lastError = `API_${response.status}`; }
      updateRequestLog(logId, { status: 'failed', error: `API_${response.status}`, httpStatus: response.status, responseSummary });
    }
  } catch (e) {
    sendToAgent({
      id,
      status: 500,
      error: e.message || 'API_REQUEST_FAILED',
    });
    if (hasCaptcha) { metrics.failedCount++; metrics.lastError = e.message; }
    updateRequestLog(logId, { status: 'failed', error: e.message || 'API_REQUEST_FAILED' });
  }

  chrome.storage.local.set({ metrics });
  setState('idle');
}

// ─── State & Popup ──────────────────────────────────────────

function setState(newState) {
  state = newState;
  const badges = { idle: '●', running: '▶', off: '○' };
  const colors = { idle: '#22c55e', running: '#f59e0b', off: '#6b7280' };
  chrome.action.setBadgeText({ text: badges[state] || '' });
  chrome.action.setBadgeBackgroundColor({ color: colors[state] || '#000' });
  broadcastStatus();
}

function broadcastStatus() {
  chrome.runtime.sendMessage({ type: 'STATUS_PUSH' }).catch(() => {});
}

const FLOW_MESSAGES = new Set(['PACE_STATUS', 'PACE_RESET', 'STATUS', 'DISCONNECT', 'RECONNECT', 'REQUEST_LOG', 'OPEN_FLOW_TAB', 'REFRESH_TOKEN', 'TEST_CAPTCHA', 'TRPC_MEDIA_URLS', 'FLOW_CHECK', 'FLOW_OPEN_PROJECT', 'FLOW_DESCRIBE', 'FLOW_PREPARE']);
chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (!FLOW_MESSAGES.has(msg?.type)) return false;
  ensureInitialized().then(() => handleFlowMessage(msg, reply))
    .catch((err) => reply({ ok: false, error: String(err.message || err) }));
  return true;
});

function handleFlowMessage(msg, reply) {
  if (msg.type === 'PACE_STATUS') {
    reply(paceStatus());
    return false;
  }

  if (msg.type === 'PACE_RESET') {
    pace.cooldownUntil = 0;
    pace.strikes = 0;
    pace.lastReason = null;
    broadcastPace();
    reply(paceStatus());
    return false;
  }

  if (msg.type === 'STATUS') {
    reply({
      connected: ws?.readyState === WebSocket.OPEN,
      agentConnected: ws?.readyState === WebSocket.OPEN,
      flowKeyPresent: !!flowKey,
      manualDisconnect,
      tokenAge: metrics.tokenCapturedAt ? Date.now() - metrics.tokenCapturedAt : null,
      metrics: {
        requestCount: metrics.requestCount,
        successCount: metrics.successCount,
        failedCount: metrics.failedCount,
        lastError: metrics.lastError,
      },
      state,
      pace: paceStatus(),
    });
    return false;
  }

  if (msg.type === 'DISCONNECT') {
    manualDisconnect = true;
    chrome.storage.local.set({ luminaFlowEnabled: false });
    for (const name of ['lumina-flow-reconnect', 'lumina-flow-keepAlive', 'lumina-flow-token-refresh']) chrome.alarms.clear(name);
    setState('off');
    if (ws) ws.close();
    reply({ ok: true });
    return true;
  }

  if (msg.type === 'RECONNECT' || msg.type === 'OPEN_FLOW_TAB' || msg.type === 'FLOW_OPEN_PROJECT') {
    // Rôle « principal » : ni connexion ni page Flow ici (une deuxième page Flow bloquerait le compte).

    flowRoleAllows().then((ok) => {
      if (ok) return handleFlowMessageAllowed(msg, reply);

      globalThis.LuminaRole.get().then((role) => {
        const error = globalThis.LuminaRole.refusal(role, 'flow');
        reply({ ok: false, error, warning: error });
      });
    });
    return true;
  }

  return handleFlowMessageAllowed(msg, reply);
}

function handleFlowMessageAllowed(msg, reply) {
  if (msg.type === 'RECONNECT') {
    manualDisconnect = false;
    chrome.storage.local.set({ luminaFlowEnabled: true });
    chrome.alarms.create('lumina-flow-keepAlive', { periodInMinutes: 0.4 });
    connectToAgent();
    reply({ ok: true });
    setTimeout(() => void reportFlowState(), 1500);
    return true;
  }

  if (msg.type === 'REQUEST_LOG') {
    reply({ log: requestLog });
    return true;
  }

  if (msg.type === 'OPEN_FLOW_TAB') {
    chrome.tabs.query({ url: flowUrls }).then((tabs) => {
      if (tabs.length) {
        chrome.tabs.update(tabs[0].id, { active: true });
        reply({ ok: true, tabId: tabs[0].id });
      } else {
        chrome.tabs.create({ url: FLOW_TAB_URL })
          .then((tab) => reply({ ok: true, tabId: tab.id }))
          .catch((e) => reply({ error: e.message }));
      }
    }).catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'REFRESH_TOKEN') {
    captureTokenFromFlowTab({ createIfMissing: true })
      .then(() => reply({ ok: true }))
      .catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'TEST_CAPTCHA') {
    solveCaptcha(`test-${Date.now()}`, msg.pageAction || 'IMAGE_GENERATION')
      .then((r) => reply(r))
      .catch((e) => reply({ error: e.message }));
    return true;
  }

  if (msg.type === 'TRPC_MEDIA_URLS') {
    handleTrpcMediaUrls(msg.trpcUrl, msg.body);
    reply({ ok: true });
    return true;
  }

  if (msg.type === 'FLOW_PREPARE') {
    prepareFlowComposer(msg).then(reply).catch((e) => reply({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (msg.type === 'FLOW_DESCRIBE') {
    describeFlowPage().then(reply).catch((e) => reply({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (msg.type === 'FLOW_CHECK') {
    flowCheck(msg.compte || '').then(reply).catch((e) => reply({ ok: false, blocking: true, warning: String(e?.message || e) }));
    return true;
  }

  if (msg.type === 'FLOW_OPEN_PROJECT') {
    openFlowProject(msg.url).then(reply).catch((e) => reply({ ok: false, warning: String(e?.message || e) }));
    return true;
  }

  return false;
}

// ─── Vérification avant tout envoi (Lumina, 30/09/2026) ─────
//
// Deux pages Flow ouvertes (même compte ou non, même navigateur ou non) font
// redemander la connexion au compte et bloquent les générations. Avant chaque
// envoi, le panneau Flow et Agnes demandent ce bilan ; tant qu'il n'est pas bon,
// rien ne part. Les autres navigateurs ne sont visibles que s'ils sont eux aussi
// reliés à FlowKit (nombre de connexions de l'agent).

async function flowTabEmail(tab) {
  if (tab.discarded) return '';
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        const wiz = globalThis.WIZ_global_data || {};
        if (typeof wiz.oPEP7c === 'string' && wiz.oPEP7c.includes('@')) return wiz.oPEP7c;
        for (const el of document.querySelectorAll('[aria-label*="@"]')) {
          const m = el.getAttribute('aria-label').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
          if (m) return m[0];
        }
        return '';
      },
    });
    return String(res?.result || '').toLowerCase();
  } catch {
    return '';
  }
}

async function flowCheck(compte) {
  const tabs = await chrome.tabs.query({ url: flowUrls });
  const emails = [];
  for (const t of tabs) emails.push(await flowTabEmail(t));
  let agentConnections = null;
  try {
    const h = await (await fetch('http://127.0.0.1:8100/health')).json();
    agentConnections = h?.ws?.active_connections ?? null;
  } catch { /* FlowKit arrêté : signalé par l'appelant */ }
  const want = String(compte || '').trim().toLowerCase();
  const email = emails.find(Boolean) || '';
  const warnings = [];
  if (tabs.length > 1) {
    warnings.push(`Google Flow est ouvert ${tabs.length} fois (onglets ou fenêtres). Fermez-le partout sauf une fois, dans tous vos navigateurs : sinon Flow redemande la connexion au compte et bloque les générations. Rien n'est envoyé tant que ce n'est pas réglé.`);
  } else if (!tabs.length) {
    warnings.push("Aucun onglet Google Flow ouvert : ouvrez le projet (bouton Ouvrir), vérifiez le compte connecté, puis relancez. Rien n'est envoyé.");
  }
  if (agentConnections > 1) {
    warnings.push(`FlowKit reçoit ${agentConnections} connexions : Flow est aussi actif depuis un autre navigateur. Fermez Google Flow dans les autres navigateurs, puis relancez.`);
  }
  if (tabs.length === 1 && want && email && email !== want) {
    warnings.push(`Le compte ouvert dans Google Flow (${email}) n'est pas celui du projet (${want}) : changez de compte dans l'onglet Flow (avatar en haut à droite), puis relancez.`);
  }
  return {
    ok: !warnings.length,
    blocking: warnings.length > 0,
    tabs: tabs.length,
    email,
    accountChecked: Boolean(want && email),
    agentConnections,
    warning: warnings.join(' '),
  };
}

// ─── Rôle du navigateur et bilan déposé au pont (30/09/2026) ───
//
// Deux profils Chrome, deux comptes Google : le profil « Flow seulement » fait Flow, le profil « Principal »
// fait Grok et Agnes. Agnes (profil Principal) ne voit pas les pages Flow de l'autre profil : ce profil dépose
// donc son bilan au pont (POST /flow/etat), qu'Agnes relit avant chaque envoi. Le pont ne distribue rien.

const PONT_URL = 'http://127.0.0.1:8177';

async function flowRoleAllows() {
  const R = globalThis.LuminaRole;
  return !R || R.allows(await R.get(), 'flow');
}

let reportTimer = null;
async function reportFlowState() {
  const R = globalThis.LuminaRole;
  if (!R) return;
  const role = await R.get();
  if (!R.allows(role, 'flow')) return;
  try {
    const check = await flowCheck('');
    const body = {
      role,
      profil: await R.profile(),
      tabs: check.tabs,
      email: check.email,
      agentConnections: check.agentConnections,
      warning: check.warning,
      blocking: check.blocking,
      pace: paceStatus(),
      flowActive: !manualDisconnect && ws?.readyState === WebSocket.OPEN,
    };
    await fetch(PONT_URL + '/flow/etat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    /* pont arrêté : Agnes le signalera (bilan trop ancien) */
  }
}

function scheduleFlowReport() {
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => void reportFlowState(), 1500);
}

chrome.tabs.onRemoved?.addListener(scheduleFlowReport);
chrome.tabs.onUpdated?.addListener((_, info) => { if (info.status === 'complete') scheduleFlowReport(); });

// Passage au rôle « principal » : la connexion Flow de ce profil est coupée aussitôt.
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !changes.luminaRole) return;
  flowRoleAllows().then((ok) => {
    if (ok) { scheduleFlowReport(); return; }
    manualDisconnect = true;
    chrome.storage.local.set({ luminaFlowEnabled: false });
    for (const name of ['lumina-flow-reconnect', 'lumina-flow-keepAlive', 'lumina-flow-token-refresh']) chrome.alarms.clear(name);
    setState('off');
    if (ws) ws.close();
  });
});

// ─── Diagnostic de la page Flow (lecture seule, 30/09/2026) ───
//
// Décrit la zone de saisie de la page Flow (champs de texte, boutons, sélecteurs de fichier) pour préparer
// l'injection du prompt SANS envoi (l'utilisatrice clique Générer elle-même). Lecture seule, dans l'espace isolé
// de l'extension : aucun clic, aucune écriture, rien n'est exécuté dans la page, reCAPTCHA n'est pas touché.
// Le résultat est déposé au pont (POST /flow/diagnostic) pour Claude.
async function describeFlowPage() {
  const tabs = await chrome.tabs.query({ url: flowUrls });
  if (tabs.length !== 1) return { ok: false, error: `Google Flow doit être ouvert une seule fois (${tabs.length} page(s) trouvée(s)).` };
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const box = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
      const attrs = (el) => ({
        tag: el.tagName.toLowerCase(), id: el.id || '', name: el.getAttribute('name') || '', role: el.getAttribute('role') || '',
        placeholder: el.getAttribute('placeholder') || '', aria: el.getAttribute('aria-label') || '',
        cls: String(el.className || '').slice(0, 120), editable: el.isContentEditable || false, box: box(el),
        text: (el.innerText || el.value || '').trim().slice(0, 60),
      });
      const champs = [...document.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"], [role="textbox"]')]
        .filter(vis).slice(0, 20).map(attrs);
      const boutons = [...document.querySelectorAll('button, [role="button"]')].filter(vis).slice(0, 80)
        .map((b) => ({ text: (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40), aria: b.getAttribute('aria-label') || '',
          disabled: Boolean(b.disabled || b.getAttribute('aria-disabled') === 'true'), box: box(b),
          // 02/10 — état d'un bouton bascule (ex. « Agent » activé ou non)
          etat: ['aria-pressed', 'aria-checked', 'aria-selected', 'aria-expanded', 'data-state'].map((k) => b.getAttribute(k) ? k + '=' + b.getAttribute(k) : '').filter(Boolean).join(' ') }));
      const fichiers = [...document.querySelectorAll('input[type="file"]')].map((f) => ({ accept: f.accept || '', multiple: f.multiple, id: f.id || '' }));
      // Messages des générations en échec (bloc avec le bouton « Réessayer ») : texte visible du bloc
      const echecs = [...document.querySelectorAll('button[aria-label="Réessayer"]')].filter(vis).slice(0, 5).map((b) => {
        let bloc = b;
        for (let i = 0; i < 6 && bloc.parentElement; i++) { bloc = bloc.parentElement; if ((bloc.innerText || '').length > 60) break; }
        return (bloc.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 400);
      });
      return { url: location.pathname, titre: document.title, champs, boutons, fichiers, echecs, vue: [innerWidth, innerHeight] };
    },
  });
  const rapport = { ok: true, date: new Date().toISOString(), ...(res?.result || {}) };
  try {
    await fetch(PONT_URL + '/flow/diagnostic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rapport) });
    rapport.pont = true;
  } catch {
    rapport.pont = false;
  }
  return rapport;
}

// ─── Préparation de la zone de saisie Flow, SANS envoi (30/09/2026) ───
//
// Pour le mode manuel d'Agnes : dans l'unique page Flow, Lumina choisit l'image de départ (et de fin) par son nom
// exact (« Carte NN - titre.jpg », envoyée par Agnes dans le projet) via Début / Fin → « Sélectionner une image » →
// « Ajouter au prompt », puis écrit le prompt dans la zone de saisie comme un collage. Elle lit les réglages
// affichés (« Vidéo · 720p · 8 s … ») pour les comparer à la carte. Elle NE CLIQUE JAMAIS sur « Lancer la
// génération » : l'utilisatrice génère elle-même (seul ce clic déclenche le contrôle anti-robot de Google).
// Espace isolé de l'extension : reCAPTCHA n'est pas touché.
function reloadAndWait(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, 30000);
    function done() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpd);
      setTimeout(resolve, 2500); // l'application Flow démarre après le chargement de la page
    }
    function onUpd(id, info) { if (id === tabId && info.status === 'complete') done(); }
    chrome.tabs.onUpdated.addListener(onUpd);
    chrome.tabs.reload(tabId).catch(done);
  });
}

async function prepareFlowComposer({ images = [], ingredients = [], prompt = '', reglages = null } = {}) {
  const tabs = await chrome.tabs.query({ url: flowUrls });
  if (tabs.length !== 1) return { ok: false, error: `Google Flow doit être ouvert une seule fois (${tabs.length} page(s) trouvée(s)).` };
  await chrome.tabs.update(tabs[0].id, { active: true });
  if (tabs[0].windowId != null) await chrome.windows.update(tabs[0].windowId, { focused: true }).catch(() => {});
  // Les images qu'Agnes vient d'envoyer dans le projet (par FlowKit) n'apparaissent dans la page Flow ouverte
  // qu'après un rechargement (constaté le 30/09/2026) : on recharge d'abord, puis on attend que la page soit prête.
  if (images.length || ingredients.length) {
    await reloadAndWait(tabs[0].id);
  }
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    args: [images, ingredients, prompt, reglages],
    func: async (images, ingredients, prompt, reglages) => {
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const txt = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');
      const boutons = () => [...document.querySelectorAll('button, [role="button"]')].filter(vis);
      const attendre = async (trouver, ms = 6000) => {
        const fin = Date.now() + ms;
        while (Date.now() < fin) { const el = trouver(); if (el) return el; await pause(150); }
        return null;
      };
      // Appui complet (souris + clic), comme un vrai clic ; jamais sur « Lancer la génération »
      const appuyer = (el) => {
        if (!el || /lancer la g[ée]n[ée]ration/i.test(el.getAttribute('aria-label') || '')) throw new Error('bouton interdit');
        const r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, view: window, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
        for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o));
        el.click();
      };
      const etapes = [];
      // Page juste rechargée : l'application Flow met quelques secondes à afficher la zone de saisie
      const editeur = await attendre(() => document.querySelector('.ProseMirror[contenteditable="true"]'), 20000);
      if (!editeur) return { ok: false, error: 'Zone de saisie de Flow introuvable : ouvrez le projet sur l’écran de création.', etapes };
      await attendre(() => boutons().find((b) => (b.getAttribute('aria-label') || '') === 'Déclencheur des paramètres'), 10000);
      await pause(800);
      // 02/10/2026 — Mode « Agent » de Flow : la zone de saisie n'a plus le menu « Vidéo · 720p · 8 s » ni Début / Fin
      // (boutons « Agent », « Instructions pour l'agent », « Paramètres »). Rien n'est écrit : un prompt confié à l'agent
      // pourrait lancer autre chose qu'une vidéo. L'utilisatrice repasse en mode normal, puis relance.
      const aria = (b) => b.getAttribute('aria-label') || '';
      if (!boutons().some((b) => aria(b) === 'Déclencheur des paramètres')) {
        const agent = boutons().some((b) => aria(b) === "Instructions pour l'agent" || txt(b) === 'Agent');
        return { ok: false, agent, etapes, error: agent
          ? 'Google Flow est en mode « Agent » : cliquez sur le bouton « Agent » sous la zone de saisie de Flow pour revenir au mode normal (menu « Vidéo · 720p · 8 s » visible), puis relancez. Rien n’a été écrit dans Flow.'
          : 'Menu des réglages de Google Flow introuvable (« Vidéo · 720p · 8 s ») : la page a peut-être changé. Lancez le diagnostic de la page Flow pour Claude. Rien n’a été écrit dans Flow.' };
      }

      // 0) Réglages (menu « Vidéo · 720p · 8 s … ») AVANT les images : changer de mode pourrait les effacer.
      //    Modèle d'abord (il décide des durées proposées), puis mode Images, format, résolution, durée, x1.
      const regEtapes = [];
      if (reglages) {
        const declencheur = () => boutons().find((b) => (b.getAttribute('aria-label') || '') === 'Déclencheur des paramètres');
        const d0 = declencheur();
        if (!d0) regEtapes.push('menu des réglages introuvable');
        else {
          appuyer(d0);
          const menu = await attendre(() => boutons().find((b) => /^(4|6|8|10) s$/.test(txt(b)) || txt(b) === 'x1'));
          if (!menu) regEtapes.push('menu des réglages non ouvert');
          else {
            const choisir = async (etiquette, trouver) => {
              const b = await attendre(trouver, 3000);
              if (!b) { regEtapes.push(etiquette + ' : introuvable'); return false; }
              appuyer(b); await pause(350); return true;
            };
            const court = (b) => txt(b).length <= 24;
            await choisir('onglet Vidéo', () => boutons().find((b) => court(b) && /(^|\s)Vidéo$/.test(txt(b))));
            if (reglages.modele) {
              const liste = boutons().find((b) => (b.getAttribute('aria-label') || '') === 'Sélectionner une famille de modèles');
              if (!liste) regEtapes.push('choix du modèle introuvable');
              else if (!txt(liste).startsWith(reglages.modele)) {
                appuyer(liste);
                await choisir('modèle ' + reglages.modele, () => boutons().find((b) => txt(b).endsWith(reglages.modele) && b !== liste));
              }
            }
            if (reglages.mode) await choisir('mode ' + reglages.mode, () => boutons().find((b) => court(b) && txt(b).endsWith(' ' + reglages.mode)));
            if (reglages.format) await choisir('format ' + reglages.format, () => boutons().find((b) => court(b) && txt(b).endsWith(reglages.format)));
            if (reglages.resolution) await choisir(reglages.resolution, () => boutons().find((b) => txt(b) === reglages.resolution));
            if (reglages.duree) await choisir(reglages.duree, () => boutons().find((b) => txt(b) === reglages.duree));
            await choisir('x1', () => boutons().find((b) => txt(b) === 'x1'));
            // fermeture du menu : Échap, puis clic sur le déclencheur s'il est encore ouvert
            document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
            await pause(300);
            if (boutons().some((b) => txt(b) === 'x1')) { const d1 = declencheur(); if (d1) appuyer(d1); await pause(300); }
          }
        }
      }

      // Zone de saisie : le bloc qui contient l'éditeur ET le bouton des réglages (on n'agit que là-dedans)
      let zone = editeur.parentElement;
      while (zone && !zone.querySelector('[aria-label="Déclencheur des paramètres"]')) zone = zone.parentElement;
      zone = zone || document.body;
      const dansZone = () => [...zone.querySelectorAll('button, [role="button"]')].filter(vis);

      // 0 bis) Images restées d'une carte précédente (image de début/fin ou ingrédients) : retirées de la zone de saisie
      for (let n = 0; n < 10; n++) {
        const croix = dansZone().find((b) => /^Ingrédient( image)?$/.test(b.getAttribute('aria-label') || '') && /^cancel/.test(txt(b)));
        if (!croix) break;
        appuyer(croix); await pause(300);
      }

      // Choix d'une image par son nom dans « Sélectionner une image », puis « Ajouter au prompt »
      const choisirImage = async (ouvrir, nom, libelle) => {
        appuyer(ouvrir);
        const item = await attendre(() => boutons().find((b) => txt(b) === nom || txt(b).endsWith(' ' + nom) || txt(b).startsWith(nom)));
        if (!item) {
          etapes.push(`${libelle} « ${nom} » introuvable dans la liste`);
          const fermer = boutons().find((b) => (b.getAttribute('aria-label') || '') === 'Fermer');
          if (fermer) appuyer(fermer);
          return false;
        }
        appuyer(item);
        const ajouter = await attendre(() => boutons().find((b) => txt(b) === 'Ajouter au prompt' && !b.disabled));
        if (!ajouter) { etapes.push(`« Ajouter au prompt » introuvable pour « ${nom} »`); return false; }
        appuyer(ajouter);
        await attendre(() => !boutons().some((b) => txt(b) === 'Ajouter au prompt') || null, 4000);
        etapes.push(`${libelle} : ${nom}`);
        return true;
      };

      // 1 bis) Mode Ingrédients : pas de Début / Fin, les images deviennent des références du prompt
      for (const nom of ingredients.slice(0, 7)) {
        const ajout = dansZone().find((b) => (b.getAttribute('aria-label') || '') === 'Ajouter des ingrédients au champ du prompt');
        if (!ajout) { etapes.push('bouton « Ajouter des ingrédients » introuvable'); break; }
        await choisirImage(ajout, nom, 'image référence');
      }

      // 1) Mode Images : Début (puis Fin) → image par son nom → « Ajouter au prompt »
      const roles = ['Début', 'Fin'];
      for (let i = 0; i < images.length && i < 2; i++) {
        const nom = images[i];
        const role = dansZone().find((b) => txt(b) === roles[i]);
        if (!role) { etapes.push(`bouton « ${roles[i]} » introuvable`); continue; }
        await choisirImage(role, nom, 'image ' + roles[i].toLowerCase());
      }

      // 2) Prompt : remplace le contenu de la zone de saisie, comme un collage
      let promptOk = false;
      if (prompt) {
        editeur.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, prompt);
        await pause(300);
        promptOk = txt(editeur).startsWith(prompt.slice(0, 40).replace(/\s+/g, ' ').trim());
        if (!promptOk) {
          // repli : collage simulé (ProseMirror gère l'événement « paste »)
          const dt = new DataTransfer();
          dt.setData('text/plain', prompt);
          editeur.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
          await pause(300);
          promptOk = txt(editeur).includes(prompt.slice(0, 40).replace(/\s+/g, ' ').trim());
        }
        etapes.push(promptOk ? 'prompt écrit' : 'prompt non écrit');
      }

      // 3) Réglages affichés (lecture seule)
      const etiquette = boutons().find((b) => (b.getAttribute('aria-label') || '') === 'Déclencheur des paramètres');
      return {
        ok: true, prompt: promptOk,
        images: etapes.filter((e) => /^image (début|fin) :/.test(e)).length,
        references: etapes.filter((e) => e.startsWith('image référence :')).length,
        reglagesEtapes: regEtapes,
        reglages: etiquette ? txt(etiquette).replace(/crop_(\d+)_(\d+)/, '$1:$2') : '',
        etapes,
      };
    },
  });
  return res?.result || { ok: false, error: 'Aucune réponse de la page Flow.' };
}

// Ouvre un projet dans l'onglet Flow existant (jamais un deuxième onglet Flow).
async function openFlowProject(url) {
  if (!/^https:\/\/(flow\.google\.com|labs\.google)\//.test(String(url || ''))) {
    return { ok: false, warning: 'Adresse de projet Flow invalide.' };
  }
  const tabs = await chrome.tabs.query({ url: flowUrls });
  if (tabs.length > 1) {
    return { ok: false, warning: `Google Flow est ouvert ${tabs.length} fois : fermez-le partout sauf une fois avant d'ouvrir un projet.` };
  }
  if (tabs.length === 1) {
    await chrome.tabs.update(tabs[0].id, { url, active: true });
    if (tabs[0].windowId != null) await chrome.windows.update(tabs[0].windowId, { focused: true }).catch(() => {});
    return { ok: true, tabId: tabs[0].id };
  }
  const tab = await chrome.tabs.create({ url, active: true });
  return { ok: true, tabId: tab.id };
}

// ─── TRPC Media URL Extractor ──────────────────────────────

function handleTrpcMediaUrls(trpcUrl, bodyText) {
  try {
    // Extract all fresh GCS signed URLs
    const urlRegex = /https:\/\/storage\.googleapis\.com\/ai-sandbox-videofx\/(?:image|video)\/[0-9a-f-]{36}\?[^"'\s]+/g;
    const matches = bodyText.match(urlRegex) || [];
    if (!matches.length) return;

    // Deduplicate and parse
    const urlMap = {};
    for (const rawUrl of matches) {
      // Unescape JSON-escaped URLs
      const url = rawUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
      const mediaMatch = url.match(/\/(image|video)\/([0-9a-f-]{36})\?/);
      if (mediaMatch) {
        const [, mediaType, mediaId] = mediaMatch;
        // Keep last occurrence (freshest)
        urlMap[mediaId] = { mediaType, url, mediaId };
      }
    }

    const entries = Object.values(urlMap);
    if (!entries.length) return;

    console.log(`[FlowAgent] Captured ${entries.length} fresh media URLs from TRPC`);
    // URL refresh is silent — don't show in request log

    // Forward to agent for DB update
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'media_urls_refresh',
        urls: entries,
      }));
    }
  } catch (e) {
    console.error('[FlowAgent] Failed to extract TRPC media URLs:', e);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

