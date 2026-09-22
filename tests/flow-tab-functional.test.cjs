const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const sidePanelHtmlPath = path.join(root, 'flow', 'side_panel.html');
const sidePanelJsPath = path.join(root, 'flow', 'side_panel.js');

function createMockEnvironment() {
  const elements = new Map();
  const listeners = new Map();
  const postRequests = [];

  class MockElement {
    constructor(id = '', tagName = 'DIV') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this.value = '';
      this.textContent = '';
      this.style = {};
      this.dataset = {};
      this._classes = new Set();
      const self = this;
      this.classList = {
        add(...cs) { cs.forEach((c) => self._classes.add(c)); },
        remove(...cs) { cs.forEach((c) => self._classes.delete(c)); },
        contains(c) { return self._classes.has(c); },
        toggle(c, force) {
          if (force === true) this.add(c);
          else if (force === false) this.remove(c);
          else if (this.contains(c)) this.remove(c);
          else this.add(c);
        },
      };
      this.children = [];
      this.files = [];
      this.disabled = false;
      this.type = '';
      this.placeholder = '';
      this.src = '';
      this.href = '';
      this.title = '';
      this.eventListeners = {};
    }

    get className() {
      return Array.from(this._classes).join(' ');
    }

    set className(val) {
      this._classes = new Set(String(val || '').split(/\s+/).filter(Boolean));
    }

    get innerHTML() {
      return this._innerHTML || '';
    }

    set innerHTML(html) {
      this._innerHTML = html;
      this.children = [];
      if (typeof html === 'string' && html.includes('slot-remove')) {
        const btn = new MockElement('', 'BUTTON');
        btn.classList.add('slot-remove');
        this.children.push(btn);
      }
    }

    addEventListener(event, fn) {
      if (!this.eventListeners[event]) this.eventListeners[event] = [];
      this.eventListeners[event].push(fn);
    }

    dispatchEvent(event) {
      const evt = typeof event === 'string' ? { type: event, target: this, preventDefault() {} } : event;
      if (!evt.target) evt.target = this;
      if (!evt.preventDefault) evt.preventDefault = () => {};
      const fns = this.eventListeners[evt.type] || [];
      fns.forEach((fn) => fn(evt));
    }

    click() {
      this.dispatchEvent({ type: 'click', target: this, preventDefault() {} });
    }

    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    }

    insertBefore(newNode, refNode) {
      const idx = this.children.indexOf(refNode);
      if (idx >= 0) this.children.splice(idx, 0, newNode);
      else this.children.push(newNode);
      newNode.parentNode = this;
      return newNode;
    }

    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }

    querySelectorAll(sel) {
      const results = [];
      const matchSel = (node) => {
        if (sel === 'button' && node.tagName === 'BUTTON') return true;
        if (sel === 'input' && node.tagName === 'INPUT') return true;
        if (sel.startsWith('.')) {
          const cls = sel.slice(1);
          if (node.classList.contains(cls)) return true;
        }
        if (sel.startsWith('[')) {
          const m = sel.match(/\[([a-z0-9-]+)/i);
          if (m && (m[1] in node.dataset || node.hasAttribute?.(m[1]))) return true;
        }
        return false;
      };

      const search = (node) => {
        if (node !== this && matchSel(node)) results.push(node);
        (node.children || []).forEach(search);
      };
      search(this);
      return results;
    }
  }

  function getElement(id, tagName = 'DIV') {
    if (!elements.has(id)) {
      elements.set(id, new MockElement(id, tagName));
    }
    return elements.get(id);
  }

  const flowGenType = getElement('flow-gen-type');
  const btnImg = new MockElement('', 'BUTTON'); btnImg.dataset.genType = 'image'; btnImg.classList.add('on');
  const btnVid = new MockElement('', 'BUTTON'); btnVid.dataset.genType = 'video';
  flowGenType.appendChild(btnImg); flowGenType.appendChild(btnVid);

  const flowImageModes = getElement('flow-image-modes');
  const btnT2I = new MockElement('', 'BUTTON'); btnT2I.dataset.mode = 't2i'; btnT2I.classList.add('on');
  const btnI2I = new MockElement('', 'BUTTON'); btnI2I.dataset.mode = 'i2i';
  flowImageModes.appendChild(btnT2I); flowImageModes.appendChild(btnI2I);

  const flowVideoModes = getElement('flow-video-modes');
  const btnT2V = new MockElement('', 'BUTTON'); btnT2V.dataset.mode = 't2v'; btnT2V.classList.add('on');
  const btnI2V = new MockElement('', 'BUTTON'); btnI2V.dataset.mode = 'i2v';
  const btnFE2V = new MockElement('', 'BUTTON'); btnFE2V.dataset.mode = 'fe2v';
  const btnR2V = new MockElement('', 'BUTTON'); btnR2V.dataset.mode = 'r2v';
  flowVideoModes.appendChild(btnT2V); flowVideoModes.appendChild(btnI2V);
  flowVideoModes.appendChild(btnFE2V); flowVideoModes.appendChild(btnR2V);

  const flowImageAspect = getElement('flow-image-aspect');
  ['16:9', '9:16', '1:1'].forEach((v, idx) => {
    const b = new MockElement('', 'BUTTON'); b.dataset.val = v; if (idx === 0) b.classList.add('on');
    flowImageAspect.appendChild(b);
  });

  const flowImageCount = getElement('flow-image-count');
  ['1', '2', '3', '4'].forEach((v, idx) => {
    const b = new MockElement('', 'BUTTON'); b.dataset.val = v; if (idx === 0) b.classList.add('on');
    flowImageCount.appendChild(b);
  });

  const flowVideoAspect = getElement('flow-video-aspect');
  ['16:9', '9:16'].forEach((v, idx) => {
    const b = new MockElement('', 'BUTTON'); b.dataset.val = v; if (idx === 0) b.classList.add('on');
    flowVideoAspect.appendChild(b);
  });

  const flowVideoDuration = getElement('flow-video-duration');
  ['4', '6', '8', '10'].forEach((v, idx) => {
    const b = new MockElement('', 'BUTTON'); b.dataset.val = v; if (v === '8') b.classList.add('on');
    flowVideoDuration.appendChild(b);
  });

  const flowVideoRes = getElement('flow-video-res');
  ['360p', '720p'].forEach((v, idx) => {
    const b = new MockElement('', 'BUTTON'); b.dataset.val = v; if (v === '720p') b.classList.add('on');
    flowVideoRes.appendChild(b);
  });

  const flowVideoEngine = getElement('flow-video-engine');
  ['omni_flash', 'veo'].forEach((v, idx) => {
    const b = new MockElement('', 'BUTTON'); b.dataset.val = v; if (idx === 0) b.classList.add('on');
    flowVideoEngine.appendChild(b);
  });

  getElement('flow-prompts', 'TEXTAREA');
  getElement('flow-project-id', 'INPUT');
  getElement('flow-seed', 'INPUT');
  getElement('flow-image-model', 'SELECT').value = 'NANO_BANANA_PRO';
  getElement('run-flow-image', 'BUTTON');
  getElement('stop-flow-image', 'BUTTON');
  getElement('run-flow-video', 'BUTTON');
  getElement('stop-flow-video', 'BUTTON');
  getElement('flow-add-char', 'BUTTON');
  getElement('flow-file-char', 'INPUT');
  getElement('flow-chars', 'DIV');
  getElement('flow-add-loc', 'BUTTON');
  getElement('flow-file-loc', 'INPUT');
  getElement('flow-locs', 'DIV');
  getElement('flow-add-prop', 'BUTTON');
  getElement('flow-file-prop', 'INPUT');
  getElement('flow-props', 'DIV');
  getElement('flow-image-base-slot', 'DIV');
  getElement('flow-image-base-file', 'INPUT');
  getElement('flow-video-start-slot', 'DIV');
  getElement('flow-video-start-file', 'INPUT');
  getElement('flow-video-end-slot', 'DIV');
  getElement('flow-video-end-file', 'INPUT');

  class MockFileReader {
    readAsDataURL(file) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: `data:${file.type || 'image/png'};base64,mockdata` } });
        }
      }, 0);
    }
  }

  const documentMock = {
    documentElement: { style: { setProperty() {}, zoom: 1 } },
    getElementById: (id) => getElement(id),
    createElement: (tag) => new MockElement('', tag),
    body: getElement('body', 'BODY'),
    querySelectorAll: () => Array.from(elements.values()),
    addEventListener: (event, fn) => { listeners.set(event, fn); },
  };

  const fetchMock = async (url, options = {}) => {
    const u = String(url);
    if (options.method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      postRequests.push({ url: u, body });

      if (u.endsWith('/flow/upload-image')) {
        return {
          ok: true,
          json: async () => ({ media_id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }),
        };
      }

      if (u.endsWith('/flow/generate-image')) {
        return {
          ok: true,
          json: async () => ({
            media: [{ image: { generatedImage: { mediaId: 'img-123', fifeUrl: 'https://example.test/image.jpg' } } }],
          }),
        };
      }

      if (u.endsWith('/flow/edit-image')) {
        return {
          ok: true,
          json: async () => ({
            media: [{ image: { generatedImage: { mediaId: 'img-edit-123', fifeUrl: 'https://example.test/edited.jpg' } } }],
          }),
        };
      }

      if (u.endsWith('/flow/generate-video-omni-text')) {
        return {
          ok: true,
          json: async () => ({
            workflows: [{ name: 'wf-1', primary_media_id: 'vid-1', done: true, media: { url: 'https://example.test/video-omni.mp4' } }],
          }),
        };
      }

      if (u.endsWith('/flow/generate-video')) {
        return {
          ok: true,
          json: async () => ({
            workflows: [{ name: 'wf-2', primary_media_id: 'vid-2', done: true, media: { url: 'https://example.test/video-i2v.mp4' } }],
          }),
        };
      }

      if (u.endsWith('/flow/generate-video-refs')) {
        return {
          ok: true,
          json: async () => ({
            workflows: [{ name: 'wf-3', primary_media_id: 'vid-3', done: true, media: { url: 'https://example.test/video-r2v.mp4' } }],
          }),
        };
      }

      if (u.endsWith('/flow/check-omni-status')) {
        return {
          ok: true,
          json: async () => ({
            workflows: [{ name: 'wf-1', primary_media_id: 'vid-1', done: true, media: { url: 'https://example.test/video-done.mp4' } }],
          }),
        };
      }
    }

    if (u.endsWith('/active-project')) {
      return {
        ok: true,
        json: async () => ({ project_id: 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc', project_name: 'Test Google Flow' }),
      };
    }

    return { ok: true, json: async () => ({}) };
  };

  const chromeMock = {
    runtime: {
      sendMessage: (msg, callback) => {
        if (msg.type === 'STATUS') callback?.({ agentConnected: true, state: 'idle', metrics: {} });
        if (msg.type === 'REQUEST_LOG') callback?.({ log: [] });
      },
      lastError: null,
      onMessage: { addListener: () => {} },
    },
    storage: { local: { get: (keys, cb) => cb({ luminaZoom: '1.15' }), set: () => {} } },
  };

  const context = {
    document: documentMock,
    window: { chrome: chromeMock },
    chrome: chromeMock,
    fetch: fetchMock,
    FileReader: MockFileReader,
    setTimeout: (fn) => fn(),
    alert: () => {},
    console: { log() {}, error() {} },
  };

  const source = fs.readFileSync(sidePanelJsPath, 'utf8');
  vm.runInNewContext(source, context);

  return { context, elements, postRequests, triggerDOMContentLoaded: () => listeners.get('DOMContentLoaded')?.() };
}

test('Flow HTML contains all required elements for the 6 generation modes and options', () => {
  const html = fs.readFileSync(sidePanelHtmlPath, 'utf8');
  assert.match(html, /id="flow-gen-type"/);
  assert.match(html, /data-mode="t2i"/);
  assert.match(html, /data-mode="i2i"/);
  assert.match(html, /data-mode="t2v"/);
  assert.match(html, /data-mode="i2v"/);
  assert.match(html, /data-mode="fe2v"/);
  assert.match(html, /data-mode="r2v"/);
  assert.match(html, /id="flow-image-model"/);
  assert.match(html, /id="flow-image-aspect"/);
  assert.match(html, /id="flow-image-count"/);
  assert.match(html, /id="flow-video-duration"/);
  assert.match(html, /id="flow-video-res"/);
  assert.match(html, /id="flow-project-id"/);
});

test('Extracts UUID from full Google Flow project URL', () => {
  const env = createMockEnvironment();
  env.triggerDOMContentLoaded();
  const input = env.elements.get('flow-project-id');
  input.value = 'https://flow.google.com/project/aa93cad6-1b97-4b4f-96eb-d717e89bc7fc';
  input.dispatchEvent('input');
  assert.equal(input.value, 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc');
});

test('Text to Image (t2i) sends correct payload with model, aspect ratio, count and seed', async () => {
  const env = createMockEnvironment();
  env.triggerDOMContentLoaded();

  const prompts = env.elements.get('flow-prompts');
  const proj = env.elements.get('flow-project-id');
  const seed = env.elements.get('flow-seed');
  const runBtn = env.elements.get('run-flow-image');

  prompts.value = 'A futuristic city at dusk';
  proj.value = 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc';
  seed.value = '12345';

  runBtn.click();
  await new Promise((r) => setTimeout(r, 10));

  const req = env.postRequests.find((r) => r.url.endsWith('/flow/generate-image'));
  assert.ok(req, 'Expected /flow/generate-image request');
  assert.equal(req.body.prompt, 'A futuristic city at dusk');
  assert.equal(req.body.project_id, 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc');
  assert.equal(req.body.image_model, 'NANO_BANANA_PRO');
  assert.equal(req.body.aspect_ratio, 'IMAGE_ASPECT_RATIO_LANDSCAPE');
  assert.equal(req.body.count, 1);
  assert.equal(req.body.seed, 12345);
});

test('Text to Video (t2v) sends correct payload to Omni text-to-video endpoint', async () => {
  const env = createMockEnvironment();
  env.triggerDOMContentLoaded();

  const prompts = env.elements.get('flow-prompts');
  const proj = env.elements.get('flow-project-id');
  const runBtn = env.elements.get('run-flow-video');

  prompts.value = 'A cinematic drone shot over snow mountains';
  proj.value = 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc';

  runBtn.click();
  await new Promise((r) => setTimeout(r, 10));

  const req = env.postRequests.find((r) => r.url.endsWith('/flow/generate-video-omni-text'));
  assert.ok(req, 'Expected /flow/generate-video-omni-text request');
  assert.equal(req.body.prompt, 'A cinematic drone shot over snow mountains');
  assert.equal(req.body.project_id, 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc');
  assert.equal(req.body.duration_s, 8);
  assert.equal(req.body.aspect_ratio, 'VIDEO_ASPECT_RATIO_LANDSCAPE');
});

test('Image to Image (i2i) uploads base image and calls edit-image', async () => {
  const env = createMockEnvironment();
  env.triggerDOMContentLoaded();

  const btnI2I = env.elements.get('flow-image-modes').children.find((c) => c.dataset.mode === 'i2i');
  btnI2I.click();

  const baseFile = env.elements.get('flow-image-base-file');
  baseFile.files = [{ name: 'base.png', type: 'image/png' }];
  baseFile.dispatchEvent('change');
  await new Promise((r) => setTimeout(r, 10));

  const prompts = env.elements.get('flow-prompts');
  const proj = env.elements.get('flow-project-id');
  prompts.value = 'Make it a neon cyberpunk city';
  proj.value = 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc';

  const runBtn = env.elements.get('run-flow-image');
  runBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  const uploadReq = env.postRequests.find((r) => r.url.endsWith('/flow/upload-image'));
  assert.ok(uploadReq, 'Expected /flow/upload-image request');

  const editReq = env.postRequests.find((r) => r.url.endsWith('/flow/edit-image'));
  assert.ok(editReq, 'Expected /flow/edit-image request');
  assert.equal(editReq.body.prompt, 'Make it a neon cyberpunk city');
  assert.ok(editReq.body.source_media_id, 'Source media ID should be passed');
});

test('Image to Video (i2v) uploads start frame and calls generate-video', async () => {
  const env = createMockEnvironment();
  env.triggerDOMContentLoaded();

  const btnI2V = env.elements.get('flow-video-modes').children.find((c) => c.dataset.mode === 'i2v');
  btnI2V.click();

  const startFile = env.elements.get('flow-video-start-file');
  startFile.files = [{ name: 'start.png', type: 'image/png' }];
  startFile.dispatchEvent('change');
  await new Promise((r) => setTimeout(r, 10));

  const prompts = env.elements.get('flow-prompts');
  const proj = env.elements.get('flow-project-id');
  prompts.value = 'Animate waves crashing';
  proj.value = 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc';

  const runBtn = env.elements.get('run-flow-video');
  runBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  const vidReq = env.postRequests.find((r) => r.url.endsWith('/flow/generate-video'));
  assert.ok(vidReq, 'Expected /flow/generate-video request');
  assert.equal(vidReq.body.prompt, 'Animate waves crashing');
  assert.ok(vidReq.body.start_image_media_id, 'Start image media ID should be passed');
});

test('Ingredient to Video (r2v) uploads visual references and calls generate-video-refs', async () => {
  const env = createMockEnvironment();
  env.triggerDOMContentLoaded();

  const charFile = env.elements.get('flow-file-char');
  charFile.files = [{ name: 'character.png', type: 'image/png' }];
  charFile.dispatchEvent('change');
  await new Promise((r) => setTimeout(r, 10));

  const btnR2V = env.elements.get('flow-video-modes').children.find((c) => c.dataset.mode === 'r2v');
  btnR2V.click();

  const prompts = env.elements.get('flow-prompts');
  const proj = env.elements.get('flow-project-id');
  prompts.value = 'Character walking in forest';
  proj.value = 'aa93cad6-1b97-4b4f-96eb-d717e89bc7fc';

  const runBtn = env.elements.get('run-flow-video');
  runBtn.click();
  await new Promise((r) => setTimeout(r, 20));

  const refsReq = env.postRequests.find((r) => r.url.endsWith('/flow/generate-video-refs'));
  assert.ok(refsReq, 'Expected /flow/generate-video-refs request');
  assert.equal(refsReq.body.prompt, 'Character walking in forest');
  assert.ok(Array.isArray(refsReq.body.reference_media_ids), 'reference_media_ids should be an array');
  assert.equal(refsReq.body.reference_media_ids.length, 1);
});
