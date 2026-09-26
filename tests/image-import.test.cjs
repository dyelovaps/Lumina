const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function importer({ endControl = true, firstControl = true, multiple = true, sidebar = false } = {}) {
  const writes = [];
  let slot = 'first';
  const input = { multiple, dispatchEvent(e) {
    if (e.type === 'change') writes.push({ slot, files: Array.from(this.files) });
  } };
  const button = (text, onClick) => ({ innerText: text, getAttribute: () => '', closest: () => null,
    getBoundingClientRect: () => ({ width: 100, height: 30 }), click: onClick });
  const buttons = [
    ...(firstControl ? [button('First frame', () => { slot = 'first'; })] : []),
    ...(endControl ? [button('Last frame', () => { slot = 'last'; })] : []),
    ...(sidebar ? [{ ...button('', () => { writes.push({ slot: 'PROJECT DIALOG', files: [] }); }), getAttribute: a => a === 'aria-label' ? 'Ajouter un projet' : '' }] : []),
  ];
  const context = {
    window: {}, location: { pathname: '/imagine', hash: '' },
    chrome: { runtime: { onMessage: { addListener() {} } } },
    document: {
      querySelector: s => s === 'input[type="file"]' ? input : {},
      querySelectorAll: s => s === 'input[type="file"]' ? [input] : s.startsWith('button,') ? buttons : [],
    },
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    setTimeout: fn => fn(),
    Event: class { constructor(type) { this.type = type; } },
    DataTransfer: class {
      files = [];
      items = { add: f => this.files.push(f) };
    },
    File: class { constructor(parts, name, options) { this.name = name; this.type = options.type; } },
    fetch: async () => ({ ok: true, blob: async () => ({ type: 'image/png' }) }),
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `
    const realComposerImages = composerImages;
    composerImages = () => globalThis.thumbs ? globalThis.thumbs() : realComposerImages();
    globalThis.attach = attachImages;
    globalThis.file = fileToItem;
  })();`), context);
  return { context, writes };
}

test('Start and end frames can share a file input only through their explicit controls', async () => {
  const { context, writes } = importer();
  await context.attach(['A', 'B'], 'startEnd');
  assert.deepEqual(writes.map(w => w.slot), ['first', 'last']);
  assert.deepEqual(writes.map(w => w.files[0].name), ['lumina-1.png', 'lumina-2.png']);
});

test('Missing end-frame control does not overwrite the start frame', async () => {
  const { context, writes } = importer({ endControl: false });
  await assert.rejects(context.attach(['A', 'B'], 'startEnd'), /dernière image/);
  assert.equal(writes.length, 1);
});

test('Missing start-frame control stops before importing', async () => {
  const { context, writes } = importer({ firstControl: false });
  await assert.rejects(context.attach(['A', 'B'], 'startEnd'), /première image/);
  assert.equal(writes.length, 0);
});

test('Reference images go one at a time into the composer field, never via the sidebar "Ajouter un projet"', async () => {
  const { context, writes } = importer({ multiple: false, sidebar: true });
  context.thumbs = () => writes.filter(w => w.files.length).map(() => ({}));
  await context.attach(['A', 'B', 'C'], '');
  assert.deepEqual(writes.map(w => w.files.map(f => f.name)), [['lumina-1.png'], ['lumina-2.png'], ['lumina-3.png']]);
});

test('An image that never shows up in the composer stops the job', async () => {
  const { context } = importer();
  context.thumbs = () => [];
  await assert.rejects(context.attach(['A'], ''), /non confirmé/);
});

test('An HTTP failure is rejected instead of uploading its error page', async () => {
  const { context } = importer();
  context.fetch = async () => ({ ok: false, status: 403 });
  await assert.rejects(context.file('https://example.test/image', 0), /403/);
});
