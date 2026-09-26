// plugins/plugin-stills.js — Stills → Clip
// Importe d'un coup toutes les images de plan (faites dans ChatGPT, Midjourney…), les classe par le numéro
// au début du nom de fichier (01, 02, 03… / plan_04 / 05b), associe à chacune son prompt (liste numérotée
// collée ou importée, ou fichier .txt du même nom) et crée les plans Image → Vidéo prêts à animer avec Agnes.
// Deux images du même numéro avec « a/b », « debut/fin » ou « start/end » deviennent un plan Première + dernière frame.
AgnesPlugins.register("stills", {
  name: "Stills → Clip",
  version: "1.0",
  AGNES_ASPECTS: [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4]],

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.items = []; this.sidecars = {};
    var cfg = core.pluginSettings("stills", { aspect: "auto", duration: 5, strategy: "anchor", motion: "subtle", lock: true, order: "name", common: "", run: false });
    this.cfg = cfg;

    var view = core.ui.addTab("stills", "Stills → Clip",
      '<div class="card"><h3>1. Vos images de plan</h3>' +
      '<p class="hint">Numérotez les fichiers au début du nom : <b>01.png, 02.png…</b> ou <b>plan_03.jpg</b>. Pour un plan début/fin, donnez le même numéro avec <b>a/b</b>, <b>debut/fin</b> ou <b>start/end</b> (ex. 05a.png + 05b.png). ' +
      'Vous pouvez glisser aussi un <b>01.txt</b> par image : il devient son prompt.</p>' +
      '<div class="dropzone" id="stDrop" tabindex="0" role="button">Glissez vos images ici (et vos .txt / .json / .csv de prompts) — ou cliquez pour choisir<input type="file" id="stFiles" multiple accept="image/*,.txt,.md,.json,.csv" hidden></div>' +
      '<div class="row-inline" style="margin-top:8px"><span class="hint" id="stCount" style="margin:0"></span><button class="small-btn" id="stClear">Tout retirer</button></div></div>' +

      '<div class="card"><h3>2. Les prompts d\'animation</h3>' +
      '<p class="hint">Un prompt par plan, précédé de son numéro : « 01 : Léa tourne lentement la tête vers la fenêtre ». Sans numéros, séparez les prompts par une ligne vide : ils sont pris dans l\'ordre. ' +
      'Décrivez le <b>mouvement</b> plutôt que l\'image (elle est déjà là).</p>' +
      '<textarea id="stPrompts" rows="8" placeholder="01 : Léa pose son dossier sur le comptoir, regard fatigué&#10;02 : L\'agent lève les yeux de son écran, sans se lever&#10;03 : La porte vitrée se referme doucement derrière elle"></textarea>' +
      '<div class="row-inline" style="margin-top:8px"><label class="small-btn" style="cursor:pointer">Importer une liste (.txt, .md, .json, .csv)<input type="file" id="stPromptFile" accept=".txt,.md,.json,.csv" hidden></label></div>' +
      '<div class="field" style="margin-top:10px"><label>Texte ajouté à chaque prompt (facultatif)</label><input type="text" id="stCommon" placeholder="realistic handheld feel, natural light, no text, no music"></div></div>' +

      '<div class="card"><h3>3. Réglages des plans</h3><div class="ext-cols">' +
      '<div class="field"><label>Format</label><select id="stAspect"><option value="auto">Automatique (d\'après chaque image)</option><option value="project">Celui du projet</option>' +
      this.AGNES_ASPECTS.map(function (a) { return '<option value="' + a[0] + '">' + a[0] + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Durée (s)</label><input type="number" id="stDuration" min="1" max="18" style="width:90px"></div>' +
      '<div class="field"><label>Tenue de la scène</label><select id="stStrategy"></select></div>' +
      '<div class="field"><label>Mouvement</label><select id="stMotion"></select></div>' +
      '<div class="field"><label>Images sans numéro</label><select id="stOrder"><option value="name">Ordre alphabétique du nom</option><option value="date">Date du fichier</option></select></div>' +
      '</div><label class="hint"><input type="checkbox" id="stLock"> Verrou d\'identité (rien d\'inventé, pas de coupe, même personnage)</label></div>' +

      '<div class="card" id="stPreviewCard" style="display:none"><h3>4. Vérification</h3><div id="stSummary" class="hint"></div><div id="stRows"></div>' +
      '<div class="row-inline" style="margin-top:10px"><button class="primary-btn" id="stCreate">Créer les plans</button>' +
      '<label class="hint" style="margin:0"><input type="checkbox" id="stRun"> Lancer l\'animation tout de suite</label></div></div>');
    var $ = function (id) { return view.querySelector("#" + id); };
    this.$ = $;
    $("stStrategy").innerHTML = App.optionsHtml(App.I2V_STRATEGIES.filter(function (s) { return s[0] !== "refs"; }), cfg.strategy);
    $("stMotion").innerHTML = App.optionsHtml(App.MOTIONS, cfg.motion);
    $("stAspect").value = cfg.aspect; $("stDuration").value = cfg.duration; $("stOrder").value = cfg.order;
    $("stLock").checked = cfg.lock; $("stCommon").value = cfg.common; $("stRun").checked = cfg.run;

    // ---------- Import ----------
    var drop = $("stDrop");
    drop.addEventListener("click", function (e) { if (e.target.id !== "stFiles") $("stFiles").click(); });
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("stFiles").click(); } });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("over"); self.addFiles(Array.prototype.slice.call(e.dataTransfer.files || [])); });
    $("stFiles").addEventListener("change", function () { var f = Array.prototype.slice.call(this.files || []); this.value = ""; self.addFiles(f); });
    $("stClear").addEventListener("click", function () { self.items.forEach(function (it) { URL.revokeObjectURL(it.url); }); self.items = []; self.sidecars = {}; self.render(); });
    $("stPromptFile").addEventListener("change", function () {
      var f = this.files[0]; this.value = ""; if (!f) return;
      f.text().then(function (t) { $("stPrompts").value = self.promptFileToText(t, f.name); self.applyPrompts(true); });
    });
    $("stPrompts").addEventListener("input", function () { self.applyPrompts(true); });
    view.addEventListener("change", function (e) {
      if (["stAspect", "stDuration", "stStrategy", "stMotion", "stOrder", "stLock", "stCommon", "stRun"].indexOf(e.target.id) === -1) return;
      cfg.aspect = $("stAspect").value; cfg.duration = App.clamp($("stDuration").value, 1, 18); cfg.strategy = $("stStrategy").value;
      cfg.motion = $("stMotion").value; cfg.order = $("stOrder").value; cfg.lock = $("stLock").checked; cfg.common = $("stCommon").value.trim(); cfg.run = $("stRun").checked;
      cfg.save(); if (e.target.id === "stOrder") self.sort(); self.render();
    });
    // Modifications ligne par ligne
    $("stRows").addEventListener("input", function (e) {
      var it = self.itemOf(e.target); if (!it) return;
      if (e.target.getAttribute("data-s") === "prompt") { it.prompt = e.target.value; it.promptSrc = "manuel"; }
    });
    $("stRows").addEventListener("change", function (e) {
      var it = self.itemOf(e.target); if (!it) return;
      var f = e.target.getAttribute("data-s");
      if (f === "num") { var v = parseInt(e.target.value, 10); it.num = isNaN(v) ? null : v; it.manualNum = true; self.sort(); self.applyPrompts(false); }
      if (f === "role") { it.role = e.target.value; self.render(); }
    });
    $("stRows").addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]"), it = b && self.itemOf(b); if (!it) return;
      URL.revokeObjectURL(it.url); self.items.splice(self.items.indexOf(it), 1); self.render();
    });
    $("stCreate").addEventListener("click", function () { self.create(); });
  },

  // ---------- Fichiers ----------
  parseName: function (name) {
    var base = name.replace(/\.[^.]+$/, "");
    var m = base.match(/^\s*(?:plan|shot|sc[eè]ne|scene|still|image|img|p)?[\s_\-.#]*(\d{1,4})(?:[\s_\-.]*(a|b|start|end|debut|début|fin|first|last|in|out))?(?=$|[\s_\-.()\[\]])/i);
    if (!m) return { num: null, role: "single", base: base };
    var suf = (m[2] || "").toLowerCase(), role = "single";
    if (/^(a|start|debut|début|first|in)$/.test(suf)) role = "start";
    if (/^(b|end|fin|last|out)$/.test(suf)) role = "end";
    var rest = base.slice(m[0].length).replace(/^[\s_\-.]+/, "").replace(/[_]+/g, " ").trim();
    return { num: parseInt(m[1], 10), role: role, base: base, rest: rest };
  },
  addFiles: function (files) {
    var self = this, App = window.AgnesApp, chain = Promise.resolve(), texts = [];
    files.forEach(function (f) {
      if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name)) {
        chain = chain.then(function () {
          var p = self.parseName(f.name), url = URL.createObjectURL(f);
          return App.loadImage(url).then(function (img) {
            self.items.push({ id: App.uid(), file: f, url: url, name: f.name, num: p.num, role: p.role, rest: p.rest || "", w: img.naturalWidth, h: img.naturalHeight, prompt: "", promptSrc: "" });
          }).catch(function () { URL.revokeObjectURL(url); });
        });
      } else texts.push(f);
    });
    texts.forEach(function (f) {
      chain = chain.then(function () {
        return f.text().then(function (t) {
          var p = self.parseName(f.name);
          // « 01.txt » à côté de « 01.png » = prompt de ce plan ; sinon, c'est une liste de prompts
          if (p.num != null && !/\n\s*\n|\n\s*\d{1,4}\s*[:.)\-–—]/.test(t.trim()) && !/\.(json|csv)$/i.test(f.name)) self.sidecars[p.num + (p.role !== "single" ? p.role : "")] = t.trim();
          else { var ta = self.$("stPrompts"); ta.value = (ta.value.trim() ? ta.value.trim() + "\n\n" : "") + self.promptFileToText(t, f.name); }
        });
      });
    });
    chain.then(function () { self.sort(); self.applyPrompts(false); });
  },
  sort: function () {
    var order = this.cfg.order, cmp = function (a, b) { return a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" }); };
    var numbered = this.items.filter(function (i) { return i.num != null; }).sort(function (a, b) { return a.num - b.num || (a.role === "end") - (b.role === "end") || cmp(a, b); });
    var rest = this.items.filter(function (i) { return i.num == null; }).sort(order === "date" ? function (a, b) { return a.file.lastModified - b.file.lastModified; } : cmp);
    this.items = numbered.concat(rest);
  },

  // ---------- Prompts ----------
  promptFileToText: function (t, name) {
    if (/\.json$/i.test(name)) {
      try {
        var j = JSON.parse(t), out = [];
        if (Array.isArray(j)) j.forEach(function (x, i) {
          if (typeof x === "string") out.push(x);
          else if (x) out.push(String(x.n || x.num || x.id || x.plan || x.shot || i + 1).replace(/\D/g, "") + " : " + (x.prompt || x.text || x.description || ""));
        });
        else Object.keys(j).forEach(function (k) { out.push(k.replace(/\D/g, "") + " : " + j[k]); });
        return out.join("\n\n");
      } catch (e) { return t; }
    }
    if (/\.csv$/i.test(name)) {
      return t.split(/\r?\n/).filter(Boolean).map(function (l) {
        var m = l.match(/^\s*"?(\d{1,4})[a-z]?"?\s*[;,\t]\s*"?(.*?)"?\s*$/i); return m ? m[1] + " : " + m[2].replace(/""/g, '"') : l;
      }).join("\n");
    }
    return t;
  },
  parsePrompts: function (text) {
    var map = {}, list = [], cur = null, curList = null;
    var NUM = /^\s*(?:[-*•]\s*)?(?:#+\s*)?(?:\*\*)?\s*(?:plan|shot|sc[eè]ne|scene|still|image|img|p)?\s*[#n°]*\s*\[?(\d{1,4})\s*(a|b|debut|début|fin|start|end)?\]?\s*(?:\*\*)?\s*[:.)\]\-–—;,|]\s*(.*)$/i;
    String(text || "").replace(/\r/g, "").split("\n").forEach(function (line) {
      if (!line.trim()) { cur = null; curList = null; return; }
      var m = line.match(NUM);
      if (m && m[3] !== undefined) {
        var suf = (m[2] || "").toLowerCase(), key = parseInt(m[1], 10) + (/^(a|debut|début|start)$/.test(suf) ? "start" : /^(b|fin|end)$/.test(suf) ? "end" : "");
        map[key] = m[3].replace(/\*\*/g, "").trim(); cur = key; curList = null; return;
      }
      if (cur != null) { map[cur] += " " + line.trim(); return; }
      if (curList != null) { list[curList] += " " + line.trim(); return; }
      list.push(line.trim()); curList = list.length - 1;
    });
    return { map: map, list: list };
  },
  applyPrompts: function (fromText) {
    var self = this, p = this.parsePrompts(this.$("stPrompts").value), li = 0;
    this.items.forEach(function (it) {
      if (it.promptSrc === "manuel" && !fromText) return;
      var k = it.num != null ? String(it.num) : null, v = null, src = "";
      if (k != null) {
        v = p.map[k + (it.role !== "single" ? it.role : "")] || p.map[k] || self.sidecars[k + (it.role !== "single" ? it.role : "")] || self.sidecars[k];
        src = v ? "numéro" : "";
      }
      if (!v && p.list.length && !Object.keys(p.map).length) {
        // prompts sans numéro : un par plan, dans l'ordre (les deux images d'une paire partagent le même)
        if (!(it.role === "end" && self.items.some(function (o) { return o !== it && o.num === it.num && o.role === "start"; }))) { v = p.list[li++]; src = v ? "ordre" : ""; }
      }
      if (!v && it.rest && it.rest.length > 12) { v = it.rest; src = "nom du fichier"; }
      it.prompt = v || ""; it.promptSrc = src;
    });
    this.render();
  },

  // ---------- Aperçu ----------
  aspectOf: function (it) {
    var App = window.AgnesApp, c = this.cfg;
    if (c.aspect === "project") return App.getProject().aspect;
    if (c.aspect !== "auto") return c.aspect;
    var r = it.w / it.h, best = this.AGNES_ASPECTS[0];
    this.AGNES_ASPECTS.forEach(function (a) { if (Math.abs(Math.log(a[1] / r)) < Math.abs(Math.log(best[1] / r))) best = a; });
    return best[0];
  },
  plan: function () {
    // Regroupe les paires début/fin d'un même numéro
    var shots = [], used = new Set(), self = this;
    this.items.forEach(function (it) {
      if (used.has(it)) return;
      if (it.num != null && it.role === "start") {
        var end = self.items.find(function (o) { return o !== it && !used.has(o) && o.num === it.num && o.role === "end"; });
        if (end) { used.add(it); used.add(end); shots.push({ num: it.num, start: it, end: end, prompt: it.prompt || end.prompt }); return; }
      }
      used.add(it); shots.push({ num: it.num, single: it, prompt: it.prompt });
    });
    return shots;
  },
  itemOf: function (el) { var r = el.closest("[data-st]"); return r ? this.items.find(function (i) { return i.id === r.getAttribute("data-st"); }) : null; },
  render: function () {
    var self = this, App = window.AgnesApp, esc = App.esc, $ = this.$, shots = this.plan();
    $("stCount").textContent = this.items.length ? this.items.length + " image(s) · " + shots.length + " plan(s)" : "";
    $("stPreviewCard").style.display = this.items.length ? "" : "none";
    if (!this.items.length) return;
    var missing = shots.filter(function (s) { return !s.prompt; }).length, nonum = this.items.filter(function (i) { return i.num == null; }).length;
    var dups = {}; shots.forEach(function (s) { if (s.num != null) dups[s.num] = (dups[s.num] || 0) + 1; });
    var dupNums = Object.keys(dups).filter(function (k) { return dups[k] > 1; });
    $("stSummary").innerHTML = shots.length + " plans à créer" +
      (shots.some(function (s) { return s.start; }) ? " (dont " + shots.filter(function (s) { return s.start; }).length + " en début/fin)" : "") +
      (missing ? ' · <span style="color:var(--danger)">' + missing + " sans prompt</span>" : " · tous ont un prompt") +
      (nonum ? " · " + nonum + " image(s) sans numéro, placée(s) à la fin" : "") +
      (dupNums.length ? ' · <span style="color:var(--danger)">numéro(s) en double : ' + dupNums.join(", ") + "</span>" : "");
    $("stRows").innerHTML = shots.map(function (s, i) {
      var imgs = (s.start ? [s.start, s.end] : [s.single]), it = imgs[0];
      return '<div class="ext-row" data-st="' + it.id + '">' +
        imgs.map(function (x) { return '<img class="ext-thumb" src="' + x.url + '" alt="' + esc(x.name) + '" title="' + esc(x.name) + '" style="width:72px;height:72px">'; }).join("") +
        '<div style="display:flex;flex-direction:column;gap:4px;width:130px">' +
        '<label class="hint" style="margin:0">N° <input type="number" data-s="num" min="0" value="' + (it.num == null ? "" : it.num) + '" style="width:64px"></label>' +
        '<span class="ext-tag">' + (s.start ? "Début + fin" : "Image → Vidéo") + '</span><span class="ext-tag">' + self.aspectOf(it) + '</span>' +
        (s.start ? "" : '<select data-s="role" title="Rôle de l\'image" style="font-size:11px"><option value="single"' + (it.role === "single" ? " selected" : "") + '>image seule</option><option value="start"' + (it.role === "start" ? " selected" : "") + '>début</option><option value="end"' + (it.role === "end" ? " selected" : "") + '>fin</option></select>') +
        '</div>' +
        '<div class="grow"><textarea data-s="prompt" rows="3" placeholder="Prompt d\'animation de ce plan…">' + esc(s.prompt || "") + '</textarea>' +
        '<span class="hint" style="margin:0">' + esc(it.name) + (it.promptSrc ? " · prompt trouvé par " + it.promptSrc : s.prompt ? "" : " · aucun prompt trouvé") + '</span></div>' +
        '<button class="small-btn" data-rm aria-label="Retirer">✕</button></div>';
    }).join("");
  },

  // ---------- Création des plans ----------
  create: function () {
    var self = this, core = this.core, App = window.AgnesApp, cfg = this.cfg, proj = core.getProject();
    var shots = this.plan();
    if (!shots.length) return;
    var lib = (proj.library || []).length, created = [], chain = Promise.resolve();
    var btn = this.$("stCreate"); btn.disabled = true; core.toast("Import des images dans la bibliothèque…");
    function libItem(it, label) {
      return App.addLibraryItem(it.file, { name: label, kind: "source" }, proj);
    }
    shots.forEach(function (s, i) {
      chain = chain.then(function () {
        var n = s.num != null ? String(s.num).padStart(2, "0") : "x" + (i + 1);
        var first = s.start || s.single, prompt = [s.prompt || "", cfg.common].filter(Boolean).join(", ");
        var base = { prompt: prompt, aspect: self.aspectOf(first), duration: cfg.duration, lock: cfg.lock, stillNo: s.num };
        if (s.start) {
          return Promise.all([libItem(s.start, "Plan " + n + " — début"), libItem(s.end, "Plan " + n + " — fin")]).then(function (r) {
            created.push(core.addShot(Object.assign(base, { mode: "frames", startRef: r[0].id, endRef: r[1].id })));
          });
        }
        return libItem(s.single, "Plan " + n).then(function (item) {
          created.push(core.addShot(Object.assign(base, { mode: "i2v", sourceRef: item.id, i2v: cfg.strategy, motion: cfg.motion })));
        });
      });
    });
    chain.then(function () {
      core.saveProject(); App.render();
      if (cfg.run) App.enqueueMany(created, proj);
      core.toast(created.length + " plans créés" + (cfg.run ? " et mis en file d'animation." : " — vérifiez-les dans le Storyboard puis lancez la file."), "ok");
      self.items.forEach(function (it) { URL.revokeObjectURL(it.url); }); self.items = []; self.sidecars = {}; self.render();
      App.showView("viewStoryboard");
    }).catch(function (e) { core.toast("Stills → Clip : " + (e.message || e), "err"); })
      .finally(function () { btn.disabled = false; });
  }
});
