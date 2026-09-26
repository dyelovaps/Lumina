// plugins/plugin-tts.js — Voix-off & dialogues
// Onglet « Voix » : fournisseur de synthèse vocale (ElevenLabs, OpenAI ou API compatible), casting vocal
// par personnage (même voix sur toute la série), dialogue de chaque plan (« NOM : réplique »), enregistrement
// au micro ou import d'un fichier. La voix est attachée au plan : l'Assemblage et le kit FFmpeg la mixent
// automatiquement (décalage, volume, atténuation du son du clip pendant la voix).
AgnesPlugins.register("tts", {
  name: "Voix-off & dialogues",
  version: "1.0",

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    var cfg = core.pluginSettings("tts", {
      provider: "elevenlabs",
      elevenKey: "", elevenModel: "eleven_multilingual_v2", elevenLang: "fr", stability: 0.5, similarity: 0.75,
      openaiKey: "", openaiBase: "https://api.openai.com/v1", openaiModel: "gpt-4o-mini-tts",
      gap: 0.25, voices: []
    });
    this.core = core; this.cfg = cfg; this.busy = {};
    var OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
    this.OPENAI_VOICES = OPENAI_VOICES;

    var view = core.ui.addTab("voix", "Voix",
      '<div class="card"><h3>Synthèse vocale</h3>' +
      '<p class="hint">Les clés restent dans ce navigateur et ne partent que vers le fournisseur choisi. Une voix générée est attachée au plan : ' +
      'l\'Assemblage et le kit FFmpeg la mixent automatiquement. Rappel : le prompt vidéo, lui, reste « sans texte ni musique ».</p>' +
      '<div class="ext-cols">' +
      '<div class="field"><label>Fournisseur</label><select id="ttsProvider">' +
      '<option value="elevenlabs">ElevenLabs (meilleur rendu en français)</option><option value="openai">OpenAI TTS</option>' +
      '<option value="compatible">API compatible OpenAI (URL personnalisée)</option></select></div>' +
      '<div class="field tts-el"><label>Clé ElevenLabs</label><input type="password" id="ttsElevenKey" placeholder="xi-…"></div>' +
      '<div class="field tts-el"><label>Modèle ElevenLabs</label><select id="ttsElevenModel">' +
      '<option value="eleven_multilingual_v2">Multilingual v2 (stable, naturel)</option><option value="eleven_v3">Eleven v3 (le plus expressif, balises [whispers]…)</option>' +
      '<option value="eleven_flash_v2_5">Flash v2.5 (rapide, économique)</option><option value="eleven_turbo_v2_5">Turbo v2.5</option></select></div>' +
      '<div class="field tts-el"><label>Stabilité / ressemblance</label><div class="row-inline"><input type="number" id="ttsStability" min="0" max="1" step="0.05" style="width:80px"><input type="number" id="ttsSimilarity" min="0" max="1" step="0.05" style="width:80px"></div></div>' +
      '<div class="field tts-oa"><label>Clé API</label><input type="password" id="ttsOpenaiKey" placeholder="sk-…"></div>' +
      '<div class="field tts-oa"><label>URL de base</label><input type="text" id="ttsOpenaiBase"></div>' +
      '<div class="field tts-oa"><label>Modèle</label><input type="text" id="ttsOpenaiModel"></div>' +
      '<div class="field"><label>Silence entre répliques (s)</label><input type="number" id="ttsGap" min="0" max="3" step="0.05" style="width:90px"></div>' +
      '</div><div class="row-inline"><button class="small-btn tts-el" id="ttsLoadVoices">Charger mes voix ElevenLabs</button><span class="hint" id="ttsVoicesInfo"></span></div></div>' +

      '<div class="card"><h3>Casting vocal</h3>' +
      '<p class="hint">Une voix par personnage, gardée pour tout le projet. Dans un dialogue, écrivez <b>NOM : réplique</b> ; une ligne sans nom utilise la voix « NARRATEUR ». ' +
      'Les consignes de jeu servent à OpenAI (instructions) ; avec Eleven v3, mettez plutôt des balises dans le texte, ex. [whispers], [sighs], [angry].</p>' +
      '<div id="ttsCast"></div><div class="row-inline" style="margin-top:8px"><button class="small-btn" id="ttsAddRole">+ Personnage</button></div></div>' +

      '<div class="card"><h3>Dialogues par plan</h3>' +
      '<div class="row-inline" style="margin-bottom:6px"><button class="primary-btn" id="ttsGenMissing">Générer les voix manquantes</button>' +
      '<button class="small-btn" id="ttsGenAll">Tout régénérer</button><button class="small-btn" id="ttsExport">Exporter les voix (.zip)</button>' +
      '<button class="small-btn" id="ttsSrt">Exporter les dialogues (.srt)</button></div>' +
      '<p class="hint">Décalage = quand la voix démarre dans le plan. Son du clip = volume du son d\'origine pendant la voix (0,35 = atténué).</p>' +
      '<div id="ttsShots"></div></div>');
    this.view = view;
    var $ = function (id) { return view.querySelector("#" + id); };

    // ---------- Réglages ----------
    function fillCfg() {
      $("ttsProvider").value = cfg.provider; $("ttsElevenKey").value = cfg.elevenKey; $("ttsElevenModel").value = cfg.elevenModel;
      $("ttsStability").value = cfg.stability; $("ttsSimilarity").value = cfg.similarity;
      $("ttsOpenaiKey").value = cfg.openaiKey; $("ttsOpenaiBase").value = cfg.openaiBase; $("ttsOpenaiModel").value = cfg.openaiModel; $("ttsGap").value = cfg.gap;
      var el = cfg.provider === "elevenlabs";
      view.querySelectorAll(".tts-el").forEach(function (n) { n.style.display = el ? "" : "none"; });
      view.querySelectorAll(".tts-oa").forEach(function (n) { n.style.display = el ? "none" : ""; });
      $("ttsVoicesInfo").textContent = cfg.voices.length ? cfg.voices.length + " voix disponibles" : "";
    }
    view.querySelector(".card").addEventListener("change", function () {
      var prev = cfg.provider;
      cfg.provider = $("ttsProvider").value; cfg.elevenKey = $("ttsElevenKey").value.trim(); cfg.elevenModel = $("ttsElevenModel").value;
      cfg.stability = App.clamp($("ttsStability").value, 0, 1); cfg.similarity = App.clamp($("ttsSimilarity").value, 0, 1);
      cfg.openaiKey = $("ttsOpenaiKey").value.trim(); cfg.openaiBase = $("ttsOpenaiBase").value.trim() || "https://api.openai.com/v1";
      cfg.openaiModel = $("ttsOpenaiModel").value.trim() || "gpt-4o-mini-tts"; cfg.gap = App.clamp($("ttsGap").value, 0, 3);
      cfg.save(); fillCfg(); if (prev !== cfg.provider) renderCast();
    });
    $("ttsLoadVoices").addEventListener("click", function () {
      if (!cfg.elevenKey) return core.toast("Ajoutez d'abord votre clé ElevenLabs.", "err");
      fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": cfg.elevenKey } }).then(function (r) {
        if (!r.ok) throw new Error(r.status === 401 ? "clé refusée" : "erreur " + r.status); return r.json();
      }).then(function (j) {
        cfg.voices = (j.voices || []).map(function (v) { return { id: v.voice_id, name: v.name + (v.labels && v.labels.gender ? " · " + v.labels.gender : "") }; });
        cfg.save(); fillCfg(); renderCast(); core.toast(cfg.voices.length + " voix chargées.", "ok");
      }).catch(function (e) { core.toast("Voix ElevenLabs : " + e.message, "err"); });
    });

    // ---------- Casting (stocké dans le projet) ----------
    function cast() {
      var p = core.getProject();
      if (!p.voiceCast || !p.voiceCast.length) p.voiceCast = [{ id: App.uid(), name: "NARRATEUR", voice: "", style: "" }];
      return p.voiceCast;
    }
    this.cast = cast;
    function voiceOptions(sel) {
      if (cfg.provider !== "elevenlabs") return OPENAI_VOICES.map(function (v) { return '<option value="' + v + '"' + (v === sel ? " selected" : "") + '>' + v + '</option>'; }).join("");
      var list = cfg.voices.slice();
      if (sel && !list.some(function (v) { return v.id === sel; })) list.unshift({ id: sel, name: sel });
      return '<option value="">— choisir —</option>' + list.map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === sel ? " selected" : "") + '>' + esc(v.name) + '</option>'; }).join("");
    }
    function renderCast() {
      $("ttsCast").innerHTML = cast().map(function (r) {
        var voiceField = cfg.provider === "elevenlabs" && !cfg.voices.length
          ? '<input type="text" data-c="voice" value="' + esc(r.voice) + '" placeholder="ID de voix ElevenLabs" style="width:210px">'
          : '<select data-c="voice">' + voiceOptions(r.voice) + '</select>';
        return '<div class="ext-row" data-role="' + r.id + '"><input type="text" data-c="name" value="' + esc(r.name) + '" placeholder="NOM" style="width:150px;text-transform:uppercase">' +
          voiceField + '<input type="text" class="grow" data-c="style" value="' + esc(r.style) + '" placeholder="Consigne de jeu (ex. voix grave, lasse, murmurée)">' +
          '<button class="small-btn" data-c="test">Tester</button><button class="small-btn" data-c="rm" aria-label="Retirer">✕</button></div>';
      }).join("");
    }
    $("ttsCast").addEventListener("change", function (e) {
      var row = e.target.closest("[data-role]"), f = e.target.getAttribute("data-c"); if (!row || !f) return;
      var r = cast().find(function (x) { return x.id === row.getAttribute("data-role"); }); if (!r) return;
      r[f] = f === "name" ? e.target.value.trim().toUpperCase() : e.target.value.trim(); core.saveProject();
    });
    $("ttsCast").addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]"), row = e.target.closest("[data-role]"); if (!b || !row || b.tagName !== "BUTTON") return;
      var list = cast(), i = list.findIndex(function (x) { return x.id === row.getAttribute("data-role"); }); if (i < 0) return;
      if (b.getAttribute("data-c") === "rm") { if (list.length > 1) { list.splice(i, 1); core.saveProject(); renderCast(); } return; }
      b.disabled = true;
      self.speak("Bonjour, voici un essai de ma voix pour la série.", list[i]).then(function (blob) {
        var a = new Audio(URL.createObjectURL(blob)); a.play().catch(function () { });
      }).catch(function (err) { core.toast("Test de voix : " + err.message, "err"); }).finally(function () { b.disabled = false; });
    });
    $("ttsAddRole").addEventListener("click", function () { cast().push({ id: App.uid(), name: "PERSONNAGE", voice: "", style: "" }); core.saveProject(); renderCast(); });

    // ---------- Dialogues par plan ----------
    function shotLen(s) {
      var t = core.getSelectedTake(s);
      if (t && t.kind === "image") return null;
      return Number(s.duration) || null;
    }
    function renderShots() {
      var shots = core.getShots();
      if (!shots.length) { $("ttsShots").innerHTML = '<p class="hint">Aucun plan pour l\'instant.</p>'; return; }
      $("ttsShots").innerHTML = shots.map(function (s, i) {
        var v = s.voice || {}, has = !!v.key, busy = self.busy[s.id];
        var tag = busy ? '<span class="ext-tag">' + esc(busy) + '</span>' : has ? '<span class="ext-tag ok">voix attachée' + (v.dur ? " · " + v.dur.toFixed(1) + " s" : "") + '</span>' : '<span class="ext-tag">sans voix</span>';
        var len = shotLen(s), warn = has && v.dur && len && v.dur + (Number(v.offset) || 0) > len + 0.05 ? '<span class="ext-tag err" title="La voix sera coupée à la fin du plan">dépasse le plan (' + len + ' s)</span>' : "";
        return '<div class="ext-row" data-vshot="' + s.id + '">' +
          '<div style="flex:0 0 100%;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>#' + (i + 1) + '</b><span class="hint" style="margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.prompt || "(sans description)") + '</span>' + tag + warn + '</div>' +
          '<textarea class="grow" data-v="text" rows="2" placeholder="LÉA : Tu savais, depuis le début ?&#10;Voix-off sans nom = NARRATEUR">' + esc(v.text != null ? v.text : (s.voiceDraft || "")) + '</textarea>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
          '<label class="hint" style="margin:0">Décalage <input type="number" data-v="offset" min="0" step="0.1" value="' + (v.offset || 0) + '" style="width:70px"> s</label>' +
          '<label class="hint" style="margin:0">Volume <input type="number" data-v="volume" min="0" max="2" step="0.1" value="' + (v.volume == null ? 1 : v.volume) + '" style="width:70px"></label>' +
          '<label class="hint" style="margin:0">Son du clip <input type="number" data-v="duck" min="0" max="1" step="0.05" value="' + (v.duck == null ? 0.35 : v.duck) + '" style="width:70px"></label></div>' +
          '<div style="flex:0 0 100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
          '<button class="small-btn" data-va="gen"' + (busy ? " disabled" : "") + '>Générer</button>' +
          '<button class="small-btn" data-va="rec">' + (self.recording && self.recording.shotId === s.id ? "■ Arrêter" : "🎙 Enregistrer") + '</button>' +
          '<button class="small-btn" data-va="file">Importer…</button>' +
          (has ? '<button class="small-btn" data-va="play">▶ Écouter</button><button class="small-btn" data-va="dl">Télécharger</button><button class="small-btn" data-va="rm">Retirer</button>' : "") +
          '</div></div>';
      }).join("");
    }
    this.renderShots = renderShots;
    function shotOf(el) { var row = el.closest("[data-vshot]"); return row ? core.getShot(row.getAttribute("data-vshot")) : null; }
    $("ttsShots").addEventListener("change", function (e) {
      var f = e.target.getAttribute("data-v"), s = shotOf(e.target); if (!f || !s) return;
      if (f === "text") {
        if (s.voice) s.voice.text = e.target.value; else s.voiceDraft = e.target.value;
        core.saveProject(); return;
      }
      if (!s.voice) { core.toast("Générez, enregistrez ou importez d'abord une voix pour ce plan.", "err"); renderShots(); return; }
      s.voice[f] = f === "offset" ? Math.max(0, Number(e.target.value) || 0) : App.clamp(e.target.value, 0, f === "volume" ? 2 : 1);
      core.saveProject(); renderShots();
    });
    $("ttsShots").addEventListener("click", function (e) {
      var b = e.target.closest("[data-va]"), s = b && shotOf(b); if (!s) return;
      var act = b.getAttribute("data-va"), text = b.closest("[data-vshot]").querySelector('[data-v="text"]').value;
      if (act === "gen") return self.generateFor(s.id, text).catch(function () { });
      if (act === "rec") return self.toggleRecord(s.id, text);
      if (act === "file") {
        var inp = document.createElement("input"); inp.type = "file"; inp.accept = "audio/*";
        inp.onchange = function () { if (inp.files[0]) self.attach(s.id, inp.files[0], text, "import"); };
        inp.click(); return;
      }
      if (act === "play") return core.getShotVoiceBlob(s.id).then(function (bl) { if (bl) new Audio(URL.createObjectURL(bl)).play().catch(function () { }); });
      if (act === "dl") return core.getShotVoiceBlob(s.id).then(function (bl) { if (bl) core.download(bl, "voix_plan-" + (core.getShots().indexOf(s) + 1) + "." + App.audioExt(bl)); });
      if (act === "rm") { var t = s.voice.text; core.clearShotVoice(s.id); s.voiceDraft = t; core.saveProject(); renderShots(); }
    });
    $("ttsGenMissing").addEventListener("click", function () { self.generateMany(false); });
    $("ttsGenAll").addEventListener("click", function () { if (window.confirm("Régénérer toutes les voix du projet ?")) self.generateMany(true); });
    $("ttsExport").addEventListener("click", function () { self.exportZip(); });
    $("ttsSrt").addEventListener("click", function () { self.exportSrt(); });

    // Bouton sur chaque carte de plan → ouvre l'onglet sur ce plan
    core.ui.addShotAction("🎙 Voix", function (shot) {
      App.showView("view_voix");
      setTimeout(function () {
        var row = view.querySelector('[data-vshot="' + shot.id + '"]');
        if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); var ta = row.querySelector("textarea"); if (ta) ta.focus(); }
      }, 60);
    });

    function refresh() { fillCfg(); renderCast(); renderShots(); }
    core.on("view:change", function (v) { if (v === "view_voix") refresh(); });
    core.on("project:change", function () { if (view.classList.contains("active")) refresh(); });
    core.on("shot:done", function () { if (view.classList.contains("active")) renderShots(); });
    refresh();
  },

  // ---------------- Synthèse ----------------
  // Découpe « NOM : réplique » en segments { role, text }
  parse: function (text) {
    var cast = this.cast(), segs = [], cur = null;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var l = line.trim(); if (!l) return;
      var m = l.match(/^([A-ZÀ-ÖØ-Þa-zà-öø-ÿ0-9' .\-]{1,30})\s*:\s*(.+)$/);
      var role = null;
      if (m) role = cast.find(function (r) { return r.name.toUpperCase() === m[1].trim().toUpperCase(); });
      if (m && role) { cur = { role: role, text: m[2].trim() }; segs.push(cur); }
      else if (m && !role && /^[A-ZÀ-ÖØ-Þ0-9' .\-]+$/.test(m[1].trim())) { cur = { role: cast[0], text: m[2].trim(), unknown: m[1].trim() }; segs.push(cur); }
      else if (cur && !m) cur.text += " " + l;
      else { cur = { role: cast[0], text: l }; segs.push(cur); }
    });
    return segs;
  },

  speak: function (text, role) {
    var cfg = this.cfg;
    if (!role.voice && cfg.provider === "elevenlabs") return Promise.reject(new Error("aucune voix choisie pour « " + role.name + " »"));
    if (cfg.provider === "elevenlabs") {
      if (!cfg.elevenKey) return Promise.reject(new Error("clé ElevenLabs manquante"));
      var body = { text: text, model_id: cfg.elevenModel, voice_settings: { stability: Number(cfg.stability), similarity_boost: Number(cfg.similarity) } };
      if (cfg.elevenLang && cfg.elevenModel !== "eleven_multilingual_v2") body.language_code = cfg.elevenLang;
      return fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(role.voice) + "?output_format=mp3_44100_128", {
        method: "POST", headers: { "xi-api-key": cfg.elevenKey, "Content-Type": "application/json", "Accept": "audio/mpeg" }, body: JSON.stringify(body)
      }).then(this._audioOrError);
    }
    if (!cfg.openaiKey) return Promise.reject(new Error("clé API manquante"));
    var b = { model: cfg.openaiModel, voice: role.voice || "alloy", input: text, response_format: "mp3" };
    if (role.style && /gpt-4o/.test(cfg.openaiModel)) b.instructions = role.style;
    return fetch(cfg.openaiBase.replace(/\/+$/, "") + "/audio/speech", {
      method: "POST", headers: { "Authorization": "Bearer " + cfg.openaiKey, "Content-Type": "application/json" }, body: JSON.stringify(b)
    }).then(this._audioOrError);
  },
  _audioOrError: function (r) {
    if (r.ok) return r.blob().then(function (b) { return b.type ? b : new Blob([b], { type: "audio/mpeg" }); });
    return r.text().then(function (t) {
      var msg = t; try { var j = JSON.parse(t); msg = (j.detail && (j.detail.message || j.detail)) || (j.error && (j.error.message || j.error)) || t; } catch (e) { }
      throw new Error((r.status === 401 ? "clé refusée" : r.status === 429 ? "trop de requêtes / quota atteint" : "erreur " + r.status) + (msg ? " — " + String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 160) : ""));
    });
  },

  // Plusieurs répliques → un seul fichier WAV (avec un court silence entre elles)
  concat: function (blobs, gap) {
    var self = this;
    if (blobs.length === 1) return Promise.resolve(blobs[0]);
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
    return Promise.all(blobs.map(function (b) { return b.arrayBuffer().then(function (ab) { return ctx.decodeAudioData(ab); }); })).then(function (bufs) {
      var rate = 44100, gapN = Math.round(gap * rate), total = 0;
      bufs.forEach(function (b, i) { total += Math.ceil(b.duration * rate) + (i ? gapN : 0); });
      var off = new OfflineAudioContext(1, Math.max(1, total), rate), t = 0;
      bufs.forEach(function (b, i) { if (i) t += gap; var src = off.createBufferSource(); src.buffer = b; src.connect(off.destination); src.start(t); t += b.duration; });
      return off.startRendering();
    }).then(function (buf) { ctx.close(); return self.toWav(buf); });
  },
  toWav: function (buf) {
    var data = buf.getChannelData(0), n = data.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) { var x = Math.max(-1, Math.min(1, data[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([ab], { type: "audio/wav" });
  },
  duration: function (blob) {
    return new Promise(function (resolve) {
      var a = new Audio(), u = URL.createObjectURL(blob); a.preload = "metadata";
      a.onloadedmetadata = function () { var d = a.duration; URL.revokeObjectURL(u); resolve(isFinite(d) ? d : null); };
      a.onerror = function () { URL.revokeObjectURL(u); resolve(null); }; a.src = u;
    });
  },

  attach: function (shotId, blob, text, source) {
    var self = this, core = this.core;
    return this.duration(blob).then(function (d) {
      return core.setShotVoice(shotId, blob, { text: text, source: source, dur: d });
    }).then(function (v) { self.renderShots(); return v; });
  },

  generateFor: function (shotId, text) {
    var self = this, core = this.core, segs = this.parse(text);
    if (!segs.length) { core.toast("Écrivez d'abord la réplique ou la voix-off de ce plan.", "err"); return Promise.reject(new Error("vide")); }
    var unknown = segs.filter(function (s) { return s.unknown; }).map(function (s) { return s.unknown; });
    if (unknown.length) core.toast("Personnage(s) absent(s) du casting, voix du narrateur utilisée : " + unknown.join(", "));
    this.busy[shotId] = "génération…"; this.renderShots();
    var out = [], chain = Promise.resolve();
    segs.forEach(function (s) { chain = chain.then(function () { return self.speak(s.text, s.role).then(function (b) { out.push(b); }); }); });
    return chain.then(function () { return self.concat(out, Number(self.cfg.gap) || 0); })
      .then(function (blob) { return self.attach(shotId, blob, text, self.cfg.provider); })
      .catch(function (e) { core.toast("Voix du plan : " + e.message, "err"); throw e; })
      .finally(function () { delete self.busy[shotId]; self.renderShots(); });
  },

  generateMany: function (all) {
    var self = this, core = this.core;
    var todo = core.getShots().filter(function (s) {
      var t = s.voice ? s.voice.text : s.voiceDraft; return t && t.trim() && (all || !s.voice || !s.voice.key || s.voice.source === "stale");
    });
    if (!todo.length) { core.toast("Aucun dialogue à générer (écrivez-les dans la liste)."); return; }
    todo.forEach(function (s) { self.busy[s.id] = "en attente"; }); this.renderShots();
    var ok = 0, chain = Promise.resolve();
    todo.forEach(function (s) {
      chain = chain.then(function () { return self.generateFor(s.id, s.voice ? s.voice.text : s.voiceDraft).then(function () { ok++; }, function () { }); });
    });
    chain.then(function () { core.toast(ok + " / " + todo.length + " voix générée(s).", ok === todo.length ? "ok" : "err"); });
  },

  toggleRecord: function (shotId, text) {
    var self = this, core = this.core;
    if (this.recording) {
      var r = this.recording; this.recording = null; r.rec.stop(); return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) return core.toast("Enregistrement micro indisponible dans ce navigateur.", "err");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], rec = new MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        self.attach(shotId, new Blob(chunks, { type: rec.mimeType || "audio/webm" }), text, "micro").then(function () { core.toast("Voix enregistrée.", "ok"); });
      };
      self.recording = { shotId: shotId, rec: rec }; rec.start(); self.renderShots();
      core.toast("Enregistrement… cliquez « ■ Arrêter » pour finir.");
    }).catch(function (e) { core.toast("Micro refusé : " + e.message, "err"); });
  },

  exportZip: function () {
    var core = this.core, App = window.AgnesApp;
    if (typeof JSZip === "undefined") return core.toast("Module ZIP indisponible.", "err");
    var zip = new JSZip(), n = 0, chain = Promise.resolve(), script = [];
    core.getShots().forEach(function (s, i) {
      if (!s.voice || !s.voice.key) return;
      chain = chain.then(function () { return core.getShotVoiceBlob(s.id).then(function (b) {
        if (!b) return; n++;
        var name = String(i + 1).padStart(2, "0") + "_" + App.slugify(s.prompt) + "." + App.audioExt(b);
        zip.file(name, b); script.push(name + "  (décalage " + (s.voice.offset || 0) + " s)\n" + (s.voice.text || "") + "\n");
      }); });
    });
    chain.then(function () {
      if (!n) throw new Error("aucune voix attachée");
      zip.file("dialogues.txt", script.join("\n"));
      return zip.generateAsync({ type: "blob" });
    }).then(function (blob) { core.download(blob, App.slugify(core.getProject().name) + "_voix.zip"); core.toast(n + " voix exportée(s).", "ok"); })
      .catch(function (e) { core.toast("Export des voix : " + e.message, "err"); });
  },

  // Sous-titres des dialogues, calés sur le montage (à importer dans CapCut / TikTok si vous en voulez à la publication)
  exportSrt: function () {
    var core = this.core, App = window.AgnesApp, self = this;
    function ts(x) { var ms = Math.max(0, Math.round(x * 1000)), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(ms % 1000).padStart(3, "0"); }
    core.getMontageTimeline().then(function (tl) {
      if (!tl.marks.length) return core.toast("Aucun plan terminé dans le montage.", "err");
      var n = 0, out = [];
      tl.marks.forEach(function (mk) {
        var v = mk.it.shot.voice; if (!v || !v.key || !v.text) return;
        var segs = self.parse(v.text), total = segs.reduce(function (a, s) { return a + s.text.length; }, 0) || 1;
        var off = Number(v.offset) || 0, span = Math.max(0.3, Math.min(v.dur || mk.len, mk.len - off)), at = mk.t + off;
        segs.forEach(function (s) {
          var d = span * s.text.length / total, txt = s.text.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim(); if (!txt) { at += d; return; }
          out.push(++n + "\n" + ts(at) + " --> " + ts(at + d) + "\n" + txt + "\n"); at += d;
        });
      });
      if (!n) return core.toast("Aucun dialogue avec voix à exporter.", "err");
      core.download(new Blob([out.join("\n")], { type: "text/plain;charset=utf-8" }), App.slugify(core.getProject().name) + "_dialogues.srt");
    });
  }
});
