/* Lumina — dossiers de classement choisis par l'utilisateur.
 *
 * Chaque type de fichier (images Grok, clips, vidéo complète, script, images et
 * vidéos Flow) peut être rangé dans un dossier choisi avec la fenêtre du
 * gestionnaire de fichiers (File System Access API). Le dossier est mémorisé
 * dans IndexedDB, partagé entre le panneau Grok et l'iframe Flow (même origine
 * d'extension). Sans dossier choisi, ou si Chrome n'a plus l'autorisation
 * d'écrire, l'appelant retombe sur Téléchargements.
 *
 * Chrome redemande l'autorisation après un redémarrage : elle ne peut être
 * accordée que sur un clic. Les boutons « Lancer » appellent authorizeAll() ;
 * choisir « Autoriser à chaque visite » dans la fenêtre de Chrome évite la
 * question les fois suivantes.
 */
(function () {
  const DB_NAME = 'lumina-folders';
  const STORE = 'handles';
  const supported = typeof globalThis.showDirectoryPicker === 'function';
  const cache = new Map();
  const listeners = new Set();

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
      });
    } finally {
      db.close();
    }
  }

  async function get(key) {
    if (cache.has(key)) return cache.get(key);
    let handle = null;
    try { handle = (await tx('readonly', (s) => s.get(key))) || null; } catch { /* IndexedDB indisponible */ }
    cache.set(key, handle);
    return handle;
  }

  async function keys() {
    try { return (await tx('readonly', (s) => s.getAllKeys())) || []; } catch { return []; }
  }

  function notify(key) {
    listeners.forEach((fn) => { try { fn(key); } catch { /* ignore */ } });
  }

  /* Ouvre la fenêtre de l'explorateur. Renvoie le dossier choisi, ou null si annulé. */
  async function pick(key) {
    if (!supported) throw new Error('Ce navigateur ne permet pas de choisir un dossier (Chrome 86+ requis).');
    const current = await get(key);
    let handle;
    try {
      handle = await globalThis.showDirectoryPicker({
        id: ('lumina-' + key).slice(0, 32),
        mode: 'readwrite',
        startIn: current || 'downloads',
      });
    } catch (e) {
      if (e?.name === 'AbortError') return null;
      throw e;
    }
    await tx('readwrite', (s) => s.put(handle, key));
    cache.set(key, handle);
    notify(key);
    return handle;
  }

  async function forget(key) {
    try { await tx('readwrite', (s) => s.delete(key)); } catch { /* ignore */ }
    cache.set(key, null);
    notify(key);
  }

  async function permission(handle, ask) {
    if (!handle) return 'none';
    const opts = { mode: 'readwrite' };
    try {
      let st = await handle.queryPermission(opts);
      if (st === 'prompt' && ask) st = await handle.requestPermission(opts);
      return st;
    } catch {
      return 'denied';
    }
  }

  /* À appeler depuis un clic : redemande l'accès aux dossiers mémorisés. */
  async function authorizeAll() {
    let ok = 0;
    for (const key of await keys()) {
      if ((await permission(await get(key), true)) === 'granted') ok++;
    }
    notify(null);
    return ok;
  }

  async function uniqueFile(dir, name) {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 1; n < 1000; n++) {
      const candidate = n === 1 ? name : `${stem} (${n})${ext}`;
      try {
        await dir.getFileHandle(candidate);
      } catch (e) {
        if (e?.name === 'NotFoundError') return dir.getFileHandle(candidate, { create: true });
        throw e;
      }
    }
    throw new Error('trop de fichiers du même nom : ' + name);
  }

  function cleanPart(part) {
    return String(part).replace(/[<>:"\\|?*\u0000-\u001f]+/g, '_').replace(/^\.+$/, '_').trim() || '_';
  }

  /* Écrit <data> (Blob, data:/blob:/https URL) sous le dossier <key>.
   * Renvoie { ok: true, path } ou { ok: false, reason } — jamais d'exception. */
  async function save(key, filename, data) {
    try {
      const root = await get(key);
      if (!root) return { ok: false, reason: 'none' };
      if ((await permission(root, false)) !== 'granted') return { ok: false, reason: 'permission' };
      const parts = String(filename).split(/[\\/]+/).filter(Boolean).map(cleanPart);
      const name = parts.pop() || 'fichier';
      let dir = root;
      for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
      const blob = data instanceof Blob ? data : await (await fetch(data)).blob();
      const fh = await uniqueFile(dir, name);
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return { ok: true, path: [root.name, ...parts, fh.name].join('/') };
    } catch (e) {
      return { ok: false, reason: e?.message || String(e) };
    }
  }

  /* Rend chaque <div class="folder-row" data-folder-key data-folder-label>. */
  function mount(scope = document) {
    const rows = [...scope.querySelectorAll('.folder-row[data-folder-key]')];
    const render = async (row) => {
      const key = row.dataset.folderKey;
      const label = row.dataset.folderLabel || key;
      const handle = await get(key);
      const perm = handle ? await permission(handle, false) : 'none';
      const state = !handle ? 'Téléchargements (par défaut)'
        : perm === 'granted' ? handle.name
          : handle.name + ' — cliquer « Réautoriser »';
      row.innerHTML = `
        <span class="folder-label">${label}</span>
        <span class="folder-path" title="${handle ? handle.name : ''}">${state.replace(/</g, '&lt;')}</span>
        <span class="folder-actions">
          ${handle && perm !== 'granted' ? '<button type="button" data-act="auth" title="Réautoriser l’écriture">Réautoriser</button>' : ''}
          <button type="button" data-act="pick" title="Choisir le dossier dans l’explorateur">Choisir…</button>
          ${handle ? '<button type="button" data-act="forget" title="Revenir à Téléchargements">Retirer</button>' : ''}
        </span>`;
      row.classList.toggle('set', Boolean(handle));
      row.classList.toggle('locked', Boolean(handle) && perm !== 'granted');
      row.querySelector('[data-act="pick"]')?.addEventListener('click', async () => {
        try { await pick(key); } catch (e) { alert(e.message || e); }
      });
      row.querySelector('[data-act="forget"]')?.addEventListener('click', () => void forget(key));
      row.querySelector('[data-act="auth"]')?.addEventListener('click', async () => {
        await permission(handle, true);
        notify(key);
      });
    };
    rows.forEach((r) => void render(r));
    listeners.add((key) => rows.filter((r) => !key || r.dataset.folderKey === key).forEach((r) => void render(r)));
  }

  globalThis.LuminaFolders = { supported, get, pick, forget, save, authorizeAll, mount, onChange: (fn) => listeners.add(fn) };
})();
