/* Rôle de ce navigateur (role.js) : deux profils Chrome, deux comptes Google, sans doublon de génération. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function loadRole(stored) {
  const store = { luminaRole: stored };
  const context = {
    chrome: {
      storage: { local: { get: (k, cb) => cb({ [k]: store[k] }), set: (o, cb) => { Object.assign(store, o); cb?.(); } } },
      identity: { getProfileUserInfo: (opts, cb) => cb({ email: 'Pro@Exemple.fr' }) },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(read('role.js'), context);
  return { R: context.LuminaRole, store };
}

test('Rôles : « tout » par défaut, « principal » sans Flow, « flow » sans Grok/Agnes/pilote/file', async () => {
  const { R } = loadRole(undefined);
  assert.equal(await R.get(), 'tout');
  for (const w of ['grok', 'agnes', 'pilote', 'file', 'flow']) assert.ok(R.allows('tout', w), w);
  assert.ok(!R.allows('principal', 'flow'));
  for (const w of ['grok', 'agnes', 'pilote', 'file']) assert.ok(R.allows('principal', w), w);
  assert.ok(R.allows('flow', 'flow'));
  for (const w of ['grok', 'agnes', 'pilote', 'file']) assert.ok(!R.allows('flow', w), w);
  assert.match(R.refusal('flow', 'grok'), /Grok est désactivé dans ce navigateur/);
});

test('Rôles : mémorisé par navigateur, valeur inconnue = « tout », compte du profil lu', async () => {
  const { R, store } = loadRole('n-importe-quoi');
  assert.equal(await R.get(), 'tout');
  assert.equal(await R.set('flow'), true);
  assert.equal(store.luminaRole, 'flow');
  assert.equal(await R.set('pirate'), false);
  assert.equal(await R.profile(), 'pro@exemple.fr');
});

test('Blocages réels (pas seulement grisés) : Grok, file, pilote, Agnes, Flow', () => {
  const bg = read('background.js');
  assert.match(bg, /import "\.\/role\.js";/);
  assert.match(bg, /msg\?\.type === "ENSURE_IMAGINE" \|\| msg\?\.type === "SEND_TO_TAB"/);
  assert.match(bg, /if \(!globalThis\.LuminaRole\.allows\(role, "grok"\)\)/);
  const panel = read('sidepanel.js');
  assert.match(panel, /const refusGrok = await roleRefuse\("grok"\);/);
  assert.match(panel, /const refusFile = await roleRefuse\('file'\);/);
  assert.match(panel, /if \(await roleRefuse\("pilote"\)\) return;/);
  assert.match(read('agnes-bridge.js'), /const refus = await roleRefuse\("agnes"\);/);
  const flow = read('flow/background.js');
  assert.match(flow, /if \(!\(await flowRoleAllows\(\)\)\) manualDisconnect = true;/);
  assert.match(flow, /msg\.type === 'RECONNECT' \|\| msg\.type === 'OPEN_FLOW_TAB' \|\| msg\.type === 'FLOW_OPEN_PROJECT'/);
  assert.match(flow, /PONT_URL \+ '\/flow\/etat'/);
  assert.match(read('flow/side_panel.js'), /if \(!R\.allows\(role, 'flow'\)\) throw new Error\(R\.refusal\(role, 'flow'\)\);/);
});

test('Petite fenêtre : compte du profil, rôle modifiable, boutons interdits grisés', () => {
  const html = read('popup.html');
  assert.match(html, /id="role-select"/);
  assert.match(html, /<option value="principal">Principal \(Grok, Agnes, sans Flow\)<\/option>/);
  assert.match(html, /<script src="role\.js"><\/script>\s*<script src="popup\.js"><\/script>/);
  const js = read('popup.js');
  assert.match(js, /off\("open-agnes", "agnes"\);/);
  assert.match(js, /off\("open-imagine", "grok"\);/);
  assert.match(js, /off\("open-flow", "flow"\);/);
  const manifest = JSON.parse(read('manifest.json'));
  assert.ok(manifest.permissions.includes('identity') && manifest.permissions.includes('identity.email'));
});
