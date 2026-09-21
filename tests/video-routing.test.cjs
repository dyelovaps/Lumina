const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function scenario({ recover = true, latest = false, delayed = false, ingredients = false, initialMode = 'video' } = {}) {
  const events = [];
  let mode = initialMode;
  let pending = 0;
  let generated = false;
  const node = (label, click = () => {}) => ({
    innerText: label, textContent: label, disabled: false,
    getAttribute: () => '', closest: () => null, click,
    getBoundingClientRect: () => ({ width: 200, height: 40 }),
  });
  const box = node('');
  box.focus = () => {};
  box.dataset = {};
  box.getAttribute = (key) => key === 'placeholder'
    ? (mode === 'edit' ? 'Describe your edit' : mode === 'image' ? 'Describe your image' : 'Describe your video') : '';
  const duration = node('6s'); // Stale video controls must not override the editor.
  const video = node('Make a video', () => { events.push('video'); mode = 'video'; });
  const ingredient = node('Ingredients', () => events.push('ingredients'));
  const image = node('Image', () => { mode = 'image'; });
  const generate = node('Generate', () => { events.push('generate'); generated = true; });
  const context = {
    window: {}, location: { pathname: '/imagine', hash: '' }, innerHeight: 1000,
    chrome: { runtime: { onMessage: { addListener() {} } } },
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    setTimeout(fn) {
      if (pending && --pending === 0) mode = 'edit';
      fn();
    },
    document: {
      querySelector: () => ({}),
      querySelectorAll(selector) {
        if (selector.startsWith('button,')) return [ ...(initialMode === 'video' ? [duration] : []),
          ...(recover ? [video, image] : []), ...(ingredients ? [ingredient] : []), generate];
        if (selector === 'textarea' || selector.startsWith('[placeholder]')) return [box];
        return [];
      },
    },
    events,
    upload(urls, framePair) {
      context.uploaded = { urls: Array.from(urls || []), framePair };
      events.push(latest ? 'latest' : 'upload');
      if (delayed) pending = 2;
      else mode = 'edit';
    },
    videos: () => generated ? ['https://example.test/result.mp4'] : [],
    getBox: () => box,
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  const instrumented = source.replace(/\}\)\(\);\s*$/, `
    findPromptBox = getBox;
    attachImages = async (urls, framePair) => upload(urls, framePair);
    attachVideoImages = async attachments => {
      globalThis.receivedAttachments = attachments;
      upload(attachments.map(a => a.url));
    };
    composerImages = () => Array.from(globalThis.receivedAttachments || []);
    clickLatestStill = async () => upload();
    setNativeValue = () => events.push('prompt');
    clickAspect = clickOutputs = async () => events.push('settings');
    clickDuration = clickQuality = clickResolution = async () => events.push('video-settings');
    collectVideos = videos;
    collectImages = videos;
    globalThis.submit = submitPrompt;
    globalThis.isVideo = looksLikeVideoComposer;
  })();`);
  vm.runInNewContext(instrumented, context);
  return { context, events, run: () => context.submit({ mediaKind: 'video',
    prompt: 'Slow camera movement', images: latest ? [] : ['data:image/png;base64,AA'],
    useLatestImage: latest, outputs: 1 }) };
}

for (const options of [{}, { latest: true }, { delayed: true }]) {
  test(`Returns from the image editor before writing video prompt: ${JSON.stringify(options)}`, async () => {
    const { run, events } = scenario(options);
    const result = await run();
    assert.equal(result.ok, true);
    assert.ok(events.indexOf('video') > events.findIndex(e => e === 'upload' || e === 'latest'));
    assert.ok(events.indexOf('settings') > events.indexOf('video'));
    assert.ok(events.indexOf('prompt') > events.indexOf('video'));
    assert.equal(events.filter(e => e === 'generate').length, 1);
  });
}

test('An unrecoverable editor receives neither prompt nor generation, even with stale duration controls', async () => {
  const { run, events, context } = scenario({ recover: false });
  const result = await run();
  assert.equal(result.ok, false);
  assert.equal(context.isVideo(), false);
  assert.equal(events.includes('prompt'), false);
  assert.equal(events.includes('generate'), false);
});

test('Ingredients sends all images without interpreting them as start/end frames', async () => {
  const { context, events } = scenario({ ingredients: true });
  const result = await context.submit({ mediaKind: 'video', grokMode: 'ingredients',
    images: ['A', 'B', 'C'], prompt: 'Animate together' });
  assert.equal(result.ok, true);
  assert.deepEqual(context.uploaded.urls, ['A', 'B', 'C']);
  assert.equal(context.uploaded.framePair, undefined);
  assert.equal(events.includes('ingredients'), false);
});

test('Reference video generation does not require a separate Ingredients tab', async () => {
  const { context, events } = scenario();
  assert.equal((await context.submit({ mediaKind: 'video', grokMode: 'ingredients', images: ['A'], prompt: 'Animate' })).ok, true);
  assert.equal(events.includes('prompt'), true);
});

test('Image editing waits for the editor and does not apply video settings', async () => {
  const { context, events } = scenario({ initialMode: 'image' });
  const result = await context.submit({ mediaKind: 'image', grokMode: 'i2i', images: ['A'], prompt: 'Change the sky' });
  assert.equal(result.ok, true);
  assert.equal(events.includes('video-settings'), false);
  assert.equal(events.includes('video'), false);
});

test('Text-to-image refuses to write in a video composer if the mode switch fails', async () => {
  const { context, events } = scenario({ recover: false });
  const result = await context.submit({ mediaKind: 'image', grokMode: 't2i', prompt: 'Photo' });
  assert.equal(result.ok, false);
  assert.equal(events.includes('prompt'), false);
});

test('Missing required images and incomplete frame pairs fail before submitting', async () => {
  for (const payload of [
    { mediaKind: 'video', grokMode: 'frame2v', images: [] },
    { mediaKind: 'image', grokMode: 'i2i', images: [] },
    { mediaKind: 'video', grokMode: 'frame2v', images: ['A'], framePair: 'startEnd' },
  ]) {
    const { context, events } = scenario();
    assert.equal((await context.submit(payload)).ok, false);
    assert.equal(events.includes('prompt'), false);
  }
});

test('Video submission uses role-aware uploads for scene plus references', async () => {
  const { context } = scenario();
  const attachments = [{ url: 'SCENE', role: 'first', name: 'Scene' }, { url: 'PERSON', role: 'reference', name: 'Person' }];
  const result = await context.submit({ mediaKind: 'video', grokMode: 'frame2v', images: ['SCENE'],
    attachments, prompt: 'Animate', framePair: 'startOnly' });
  assert.equal(result.ok, true);
  assert.equal(context.receivedAttachments, attachments);
});
