const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function panel() {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, dataset: {},
      addEventListener() {}, classList: { toggle() {} }, click() {} });
    return nodes.get(id);
  };
  const sent = [];
  let active = 0;
  let maxActive = 0;
  const context = {
    document: { querySelector: node, querySelectorAll: () => [] },
    setTimeout: (fn) => fn(),
    chrome: { runtime: { async sendMessage({ payload }) {
      if (payload.type === 'PING') return { ok: true };
      sent.push(payload);
      maxActive = Math.max(maxActive, ++active);
      await Promise.resolve();
      active--;
      if (context.onSubmit) context.onSubmit(payload);
      if (context.failImage && payload.mediaKind === 'image') return { ok: false, error: 'Image failed' };
      return { ok: true, urls: [`https://example.test/${sent.length}.${payload.mediaKind === 'video' ? 'mp4' : 'jpg'}`] };
    } } },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'sidepanel.js'), 'utf8');
  vm.runInNewContext(source.replace(/renderAll\(\);\s*$/, `
    persist = renderJobs = renderJournal = startProgressTick = stopProgressTick = () => {};
    saveDownload = makeContactSheet = assembleComplete = async () => {};
    globalThis.state = state;
    globalThis.run = runBatch;
    globalThis.setMode = setMode;
  `), context);
  context.state.settings.delay = 0;
  context.state.settings.step = false;
  node('#prompts').value = 'First scene\n\nSecond scene';
  return { ...context, context, sent, node, maxActive: () => maxActive };
}

const images = ['A', 'B', 'C', 'D'].map(dataUrl => ({ dataUrl, name: dataUrl }));

for (const mode of ['t2v', 't2i', 'i2i', 'ingredients', 'frame2v', 'montage', 'pipeline']) {
  test(`${mode}: sends the correct media and source images`, async () => {
    const p = panel();
    p.state.mode = mode;
    p.state.images = images.slice(0, 2);
    p.state.settings.pass = 'videos'; // Must not affect non-pipeline modes.
    p.state.stills = [{ id: 's1', videoPrompt: 'Animate', dataUrl: 'STILL', duration: 10 }];
    p.state.pairs = [{ id: 'pair', imagePrompt: 'Photo', videoPrompt: 'Motion' }];
    if (mode === 'pipeline') p.state.settings.pass = 'both';
    await p.run(true);
    assert.ok(p.sent.length);
    const expectedKind = ['t2i', 'i2i', 'pipeline'].includes(mode) ? 'image' : 'video';
    assert.equal(p.sent[0].mediaKind, expectedKind);
    assert.deepEqual(Array.from(p.sent[0].images),
      ['t2i', 't2v', 'pipeline'].includes(mode) ? [] :
        mode === 'montage' ? ['STILL'] : mode === 'i2i' ? ['A'] : ['A', 'B']);
    assert.equal(p.sent[0].framePair, mode === 'frame2v' ? 'startEnd' : mode === 'montage' ? 'startOnly' : '');
    assert.equal(p.sent[0].useLatestImage, undefined);
    if (mode === 'pipeline') {
      assert.equal(p.sent[1].grokMode, 'frame2v');
      assert.deepEqual(Array.from(p.sent[1].images), ['https://example.test/1.jpg']);
    }
    assert.ok(p.state.jobs.every(j => j.role && j.mode === mode && j.status === 'done'));
  });
}

test('Images pass then videos pass keeps the matching image for each pair', async () => {
  const p = panel();
  p.state.pairs = ['one', 'two'].map(id => ({ id, imagePrompt: id, videoPrompt: 'Animate ' + id }));
  p.state.settings.pass = 'images';
  await p.run(true);
  p.state.settings.pass = 'videos';
  await p.run(true);
  assert.deepEqual(p.sent.slice(2).map(s => Array.from(s.images)), [
    ['https://example.test/1.jpg'], ['https://example.test/2.jpg'],
  ]);
});

test('Videos pass without matching saved images does not use an unrelated visible image', async () => {
  const p = panel();
  p.state.settings.pass = 'videos';
  p.state.pairs = [{ id: 'one', imagePrompt: 'Photo', videoPrompt: 'Motion' }];
  await p.run(true);
  assert.equal(p.sent.length, 0);
  assert.match(p.state.journal.at(-1).msg, /générez d’abord/);
});

test('Failed parent images fail their video jobs instead of leaving them queued', async () => {
  const p = panel();
  p.context.failImage = true;
  p.state.pairs = [{ id: 'one', imagePrompt: 'Photo', videoPrompt: 'Motion' }];
  await p.run(true);
  assert.equal(p.sent.length, 1);
  assert.ok(p.state.jobs.every(j => j.status === 'error'));
});

test('Mode and generation settings stay attached to queued jobs; one tab runs serially', async () => {
  const p = panel();
  p.state.mode = 't2v';
  p.state.settings.concurrent = 3;
  p.context.onSubmit = () => { p.state.mode = 't2i'; p.state.settings.outputs = 4; };
  await p.run(true);
  assert.equal(p.maxActive(), 1);
  assert.ok(p.sent.every(s => s.mediaKind === 'video' && s.outputs === 1));
});

test('Incomplete frame pairs are rejected before submission', async () => {
  for (const [mode, count] of [['frame2v', 1], ['frame2v', 3]]) {
    const p = panel();
    p.state.mode = mode;
    p.state.images = Array.from({ length: count }, (_, i) => ({ dataUrl: String(i) }));
    await p.run(true);
    assert.equal(p.sent.length, 0);
    assert.ok(p.state.journal.length);
  }
});

test('Start, end and library references are distinct attachments without truncation', async () => {
  const p = panel();
  p.state.mode = 'frame2v';
  p.state.images = images.slice(0, 2);
  p.state.refs = ['char', 'loc', 'prop'].map(kind => ({ kind, name: kind, dataUrl: kind }));
  await p.run(true);
  assert.deepEqual(Array.from(p.sent[0].attachments, a => a.role), ['first', 'last', 'reference', 'reference', 'reference']);
  assert.deepEqual(Array.from(p.sent[0].attachments, a => a.url), ['A', 'B', 'char', 'loc', 'prop']);
});

test('Stills and mixed-lot videos include the reference library alongside the scene', async () => {
  for (const mode of ['montage', 'pipeline']) {
    const p = panel();
    p.state.mode = mode;
    p.state.refs = [{ name: 'Person', dataUrl: 'REF' }];
    p.state.stills = [{ id: 's', videoPrompt: 'Move', dataUrl: 'SCENE' }];
    p.state.pairs = [{ id: 'p', imagePrompt: 'Photo', videoPrompt: 'Move' }];
    await p.run(true);
    const video = p.sent.find(s => s.mediaKind === 'video');
    assert.deepEqual(Array.from(video.attachments, a => a.role), ['first', 'reference']);
    assert.equal(video.attachments[1].url, 'REF');
  }
});

test('References alone can generate an Ingredients clip', async () => {
  const p = panel();
  p.state.mode = 'ingredients';
  p.state.refs = [{ name: 'Character', dataUrl: 'REF' }];
  await p.run(true);
  assert.equal(p.sent[0].attachments.length, 1);
  assert.equal(p.sent[0].attachments[0].role, 'reference');
});

test('Reference selection supports matching names and explicit exclusion', async () => {
  for (const selection of ['matching', 'none']) {
    const p = panel();
    p.state.mode = 't2v';
    p.state.settings.referenceSelection = selection;
    p.state.refs = [{ name: 'First', dataUrl: 'MATCH' }, { name: 'Unused', dataUrl: 'OTHER' }];
    await p.run(true);
    assert.deepEqual(Array.from(p.sent[0].attachments, a => a.url), selection === 'matching' ? ['MATCH'] : []);
  }
});

test('Pass and frame controls are only shown for their applicable modes', () => {
  const p = panel();
  for (const mode of ['t2v', 't2i', 'i2i', 'ingredients', 'frame2v', 'montage', 'pipeline']) {
    p.setMode(mode, true);
    assert.equal(p.node('#pass-wrap').hidden, mode !== 'pipeline');
    assert.equal(p.node('#frame-pills').hidden, mode !== 'frame2v');
    assert.equal(p.node('#video-settings').hidden, ['t2i', 'i2i'].includes(mode));
  }
});
