const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function page({ missingRole = '', confirm = true, dropUpload = false, noMenu = false } = {}) {
  const thumbnails = [];
  let open = null;
  const visibleNode = (text = '') => ({ innerText: text,
    getBoundingClientRect: () => ({ width: 160, height: 55 }),
    getAttribute: () => '', querySelector: () => null });
  const options = ['first', 'last', 'reference'].filter(r => r !== missingRole).map(role => ({
    ...visibleNode({ first: 'Première image\nL’image marque le début de la vidéo',
      last: 'Dernière image\nL’image marque la fin de la vidéo',
      reference: 'Référence\nL’image sert de guide à la vidéo et ne remplace pas la première image' }[role]),
    getAttribute: attr => attr === 'aria-checked' && confirm && open?.role === role ? 'true' : '',
    click() { open.role = role; open = null; },
    dispatchEvent() { open = null; },
  }));
  const input = { accept: 'image/*' };
  const menu = { ...visibleNode(), querySelectorAll: () => options };
  const ctx = {
    window: {}, location: { pathname: '/imagine', hash: '' },
    chrome: { runtime: { onMessage: { addListener() {} } } },
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    setTimeout: fn => fn(), KeyboardEvent: class {},
    document: {
      querySelector: () => ({}),
      querySelectorAll: selector => selector === 'input[type="file"]' ? [input]
        : selector.includes('[role="menu"]') && open ? [menu] : [],
    },
    thumbs: () => [...thumbnails],
    upload(file) {
      if (dropUpload) return;
      const img = { ...visibleNode(), src: file.url, role: 'first', click() { if (!noMenu) open = img; }, closest: () => null };
      const remove = { ...visibleNode('Remove image'), click() { thumbnails.splice(thumbnails.indexOf(img), 1); } };
      img.parentElement = { parentElement: null, querySelector: () => null,
        querySelectorAll: selector => selector === 'img' ? [img] : [remove] };
      // Prepending catches any assumption that the last thumbnail is the new one.
      thumbnails.unshift(img);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  vm.runInNewContext(source.replace(/\}\)\(\);\s*$/, `
    composerImages = thumbs;
    fileToItem = async url => ({ url });
    setInputFiles = async (input, files) => upload(files[0]);
    globalThis.attach = attachVideoImages;
  })();`), ctx);
  return { ctx, thumbnails };
}

test('Assigns verified start/end/reference roles, including long menu descriptions', async () => {
  const { ctx, thumbnails } = page();
  await ctx.attach(['first', 'last', 'reference', 'reference'].map((role, i) => ({ url: String(i), role, name: String(i) })));
  assert.deepEqual(thumbnails.map(t => t.role), ['reference', 'reference', 'last', 'first']);
});

test('The next scene replaces previous composer attachments', async () => {
  const { ctx, thumbnails } = page();
  await ctx.attach([{ url: 'OLD', role: 'first', name: 'Old scene' }]);
  await ctx.attach([{ url: 'NEW', role: 'first', name: 'New scene' }, { url: 'REF', role: 'reference', name: 'Character' }]);
  assert.deepEqual(thumbnails.map(t => t.src), ['REF', 'NEW']);
});

test('Missing reference role aborts rather than using a first-frame default', async () => {
  const { ctx } = page({ missingRole: 'reference' });
  await assert.rejects(ctx.attach([{ url: 'REF', role: 'reference', name: 'Character' }]), /Rôle reference introuvable/);
});

test('A missing role reports the menu options Grok actually showed', async () => {
  const { ctx } = page({ missingRole: 'reference' });
  await assert.rejects(ctx.attach([{ url: 'REF', role: 'reference', name: 'Character' }]),
    /Options vues dans le menu Grok : « Première image », « Dernière image »/);
});

test('Unconfirmed role selection aborts the upload workflow', async () => {
  const { ctx } = page({ confirm: false });
  await assert.rejects(ctx.attach([{ url: 'REF', role: 'reference', name: 'Character' }]), /n’a pas pu être confirmé/);
});

test('A silently rejected upload is reported before any role can be assigned', async () => {
  const { ctx } = page({ dropUpload: true });
  await assert.rejects(ctx.attach([{ url: 'REF', role: 'reference', name: 'Character' }]), /non confirmé/);
});

test('Grok without role menu: several images become @Image N mentions instead of failing', async () => {
  const { ctx, thumbnails } = page({ noMenu: true });
  const res = await ctx.attach([{ url: 'S', role: 'first', name: 'Scène 1' }, { url: 'R', role: 'reference', name: 'Fraisandro.png' }]);
  assert.equal(thumbnails.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(res.mentions)), [
    { n: 1, label: 'the opening frame of this shot' }, { n: 2, label: 'Fraisandro' }]);
});

test('Grok without role menu: a lone character reference is refused (it would become the first frame)', async () => {
  const { ctx } = page({ noMenu: true });
  await assert.rejects(ctx.attach([{ url: 'R', role: 'reference', name: 'Fraisandro' }]), /serait utilisée comme première image/);
});

test('Grok without role menu: a lone scene image needs no mention', async () => {
  const { ctx } = page({ noMenu: true });
  const res = await ctx.attach([{ url: 'S', role: 'first', name: 'Scène 1' }]);
  assert.equal(res.mentions.length, 0);
});
