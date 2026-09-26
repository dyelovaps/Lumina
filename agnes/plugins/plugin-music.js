// plugins/plugin-music.js — Musique, ambiances & bruitages
// Pistes posées sur une plage de plans (du plan A au plan B) : volume, fondus, boucle, départ dans le fichier,
// atténuation automatique quand une voix parle. Génération possible avec ElevenLabs (Eleven Music pour la
// musique, Sound Effects pour les ambiances et bruitages). Les pistes sont mixées par l'Assemblage et le kit FFmpeg.
// Le prompt vidéo reste « sans musique » : la bande-son est une couche séparée, maîtrisée ici.
AgnesPlugins.register("musique", {
  name: "Musique & ambiances",
  version: "1.0",
  TYPES: [["musique", "Musique"], ["ambiance", "Ambiance"], ["bruitage", "Bruitage"]],
  PRESETS: {
    musique: { volume: 0.5, fadeIn: 1.5, fadeOut: 2, loop: true, duck: 0.35 },
    ambiance: { volume: 0.35, fadeIn: 0.8, fadeOut: 0.8, loop: true, duck: 0.7 },
    bruitage: { volume: 0.9, fadeIn: 0, fadeOut: 0, loop: false, duck: 1 }
  },

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core;
    var cfg = core.pluginSettings("musique", { elevenKey: "", genType: "musique", genDur: 30, instrumental: true });
    this.cfg = cfg;

    var view = core.ui.addTab("son", "Son",
      '<div class="card"><h3>Ajouter une piste</h3>' +
      '<p class="hint">Une piste couvre une plage de plans. Musique et ambiance bouclent et baissent toutes seules quand une voix parle ; un bruitage se cale sur un plan précis. ' +
      'Le mix s\'entend dans l\'Assemblage et part dans le kit FFmpeg.</p>' +
      '<div class="row-inline"><label class="primary-btn" style="cursor:pointer">Importer un fichier audio<input type="file" id="muFile" accept="audio/*" multiple hidden></label>' +
      '<select id="muImportType">' + App.optionsHtml(this.TYPES, "musique") + '</select></div>' +
      '<details style="margin-top:12px"><summary>Générer avec ElevenLabs</summary>' +
      '<div class="ext-cols" style="margin-top:8px">' +
      '<div class="field"><label>Clé ElevenLabs</label><input type="password" id="muKey" placeholder="reprise de l\'onglet Voix si vide"></div>' +
      '<div class="field"><label>Type</label><select id="muGenType"><option value="musique">Musique (Eleven Music)</option><option value="ambiance">Ambiance (effets sonores)</option><option value="bruitage">Bruitage (effets sonores)</option></select></div>' +
      '<div class="field"><label>Durée (s)</label><input type="number" id="muDur" min="1" max="300" style="width:90px"></div></div>' +
      '<div class="field"><label>Description (en anglais de préférence)</label><textarea id="muPrompt" rows="2" placeholder="dark minimal synth pulse, tense legal thriller underscore, slow build, no vocals"></textarea></div>' +
      '<label class="hint" id="muInstrWrap"><input type="checkbox" id="muInstr"> Instrumental uniquement (sans voix chantée)</label>' +
      '<div class="row-inline" style="margin-top:8px"><button class="small-btn" id="muGen">Générer et ajouter</button><span class="hint" id="muGenInfo"></span></div>' +
      '<p class="hint">Effets sonores : 30 s maximum par génération (une ambiance boucle ensuite). Musique : 10 s à 5 min. Consomme vos crédits ElevenLabs.</p></details></div>' +
      '<div class="card"><h3>Pistes du projet</h3><div id="muList"></div></div>');
    var $ = function (id) { return view.querySelector("#" + id); };

    function beds() { var p = core.getProject(); return p.audioBeds || (p.audioBeds = []); }
    this.beds = beds;
    function shotOpts(sel, withNone) {
      var o = core.getShots().map(function (s, i) { return [s.id, "#" + (i + 1) + " — " + (s.prompt || "(sans description)").slice(0, 38)]; });
      if (withNone) o.unshift(["", withNone]);
      return App.optionsHtml(o, sel || "");
    }
    function render() {
      var list = beds();
      if (!list.length) { $("muList").innerHTML = '<p class="hint">Aucune piste. Importez un fichier ou générez-en une.</p>'; return; }
      $("muList").innerHTML = list.map(function (b) {
        var num = function (f, label, min, max, step, w) { return '<label class="hint" style="margin:0">' + label + ' <input type="number" data-m="' + f + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + (b[f] == null ? "" : b[f]) + '" style="width:' + (w || 66) + 'px"></label>'; };
        return '<div class="card" data-bed="' + b.id + '" style="margin-bottom:10px' + (b.mute ? ';opacity:.55' : '') + '">' +
          '<div class="row-inline"><input type="text" data-m="name" value="' + esc(b.name) + '" style="font-weight:600;width:220px"><select data-m="type">' + App.optionsHtml(self.TYPES, b.type) + '</select>' +
          '<span class="ext-tag">' + (b.dur ? b.dur.toFixed(1) + " s" : "?") + '</span>' +
          '<button class="small-btn" data-mb="play">▶</button><button class="small-btn" data-mb="mute">' + (b.mute ? "Réactiver" : "Couper") + '</button><button class="small-btn" data-mb="del">Supprimer</button></div>' +
          '<div class="row-inline" style="margin-top:8px"><label class="hint" style="margin:0">Du plan <select data-m="from">' + shotOpts(b.from, "début du film") + '</select></label>' +
          '<label class="hint" style="margin:0">au plan <select data-m="to">' + shotOpts(b.to, "fin du film") + '</select></label></div>' +
          '<div class="row-inline" style="margin-top:8px">' + num("delay", "Retard (s)", 0, 600, 0.1) + num("offset", "Départ dans le fichier (s)", 0, 3600, 0.1) +
          num("volume", "Volume", 0, 2, 0.05) + num("fadeIn", "Fondu entrée (s)", 0, 20, 0.1) + num("fadeOut", "Fondu sortie (s)", 0, 20, 0.1) +
          num("duck", "Sous les voix", 0, 1, 0.05) +
          '<label class="hint" style="margin:0"><input type="checkbox" data-m="loop"' + (b.loop ? " checked" : "") + '> Boucle</label></div></div>';
      }).join("");
    }
    this.render = render;
    function bedOf(el) { var c = el.closest("[data-bed]"); return c ? beds().find(function (b) { return b.id === c.getAttribute("data-bed"); }) : null; }
    $("muList").addEventListener("change", function (e) {
      var b = bedOf(e.target), f = e.target.getAttribute("data-m"); if (!b || !f) return;
      if (f === "loop") b.loop = e.target.checked;
      else if (["name", "type", "from", "to"].indexOf(f) !== -1) b[f] = e.target.value;
      else b[f] = Math.max(0, Number(e.target.value) || 0);
      if (f === "type") Object.assign(b, self.PRESETS[b.type]);
      core.saveProject(); if (f === "type") render();
    });
    $("muList").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-mb]"), b = btn && bedOf(btn); if (!b) return;
      var act = btn.getAttribute("data-mb");
      if (act === "play") {
        if (self.player) { self.player.pause(); var was = self.player.bedId; self.player = null; if (was === b.id) return; }
        return core.store.get(b.key).then(function (bl) { if (!bl) return core.toast("Fichier introuvable.", "err"); var a = new Audio(URL.createObjectURL(bl)); a.currentTime = b.offset || 0; a.play(); a.bedId = b.id; self.player = a; });
      }
      if (act === "mute") { b.mute = !b.mute; core.saveProject(); return render(); }
      if (act === "del") {
        if (!window.confirm("Supprimer la piste « " + b.name + " » ?")) return;
        var list = beds(); list.splice(list.indexOf(b), 1); core.saveProject();
        if (!core.getAllProjects().some(function (p) { return (p.audioBeds || []).some(function (x) { return x.key === b.key; }); })) core.store.del(b.key);
        render();
      }
    });
    $("muFile").addEventListener("change", function () {
      var files = Array.prototype.slice.call(this.files || []), type = $("muImportType").value, chain = Promise.resolve(); this.value = "";
      files.forEach(function (f) { chain = chain.then(function () { return self.addBed(f, f.name.replace(/\.[^.]+$/, ""), type); }); });
      chain.then(function () { core.toast(files.length + " piste(s) ajoutée(s).", "ok"); });
    });

    // ---------- Génération ElevenLabs ----------
    function fillGen() {
      $("muKey").value = cfg.elevenKey; $("muGenType").value = cfg.genType; $("muDur").value = cfg.genDur; $("muInstr").checked = cfg.instrumental;
      $("muInstrWrap").style.display = cfg.genType === "musique" ? "" : "none";
    }
    ["muKey", "muGenType", "muDur", "muInstr"].forEach(function (id) {
      $(id).addEventListener("change", function () {
        cfg.elevenKey = $("muKey").value.trim(); cfg.genType = $("muGenType").value; cfg.instrumental = $("muInstr").checked;
        cfg.genDur = App.clamp($("muDur").value, 1, cfg.genType === "musique" ? 300 : 30); cfg.save(); fillGen();
      });
    });
    $("muGen").addEventListener("click", function () {
      var prompt = $("muPrompt").value.trim(); if (!prompt) return core.toast("Décrivez la musique ou le son voulu.", "err");
      var btn = this; btn.disabled = true; $("muGenInfo").textContent = "Génération en cours… (jusqu'à une minute pour la musique)";
      self.generate(cfg.genType, prompt, cfg.genDur, cfg.instrumental).then(function (blob) {
        return self.addBed(blob, prompt.slice(0, 40), cfg.genType);
      }).then(function () { core.toast("Piste générée et ajoutée.", "ok"); })
        .catch(function (e) { core.toast("Génération : " + e.message, "err"); })
        .finally(function () { btn.disabled = false; $("muGenInfo").textContent = ""; });
    });

    core.on("view:change", function (v) { if (v === "view_son") { fillGen(); render(); } });
    core.on("project:change", function () { if (view.classList.contains("active")) render(); });
    fillGen();
  },

  key: function () {
    var k = this.cfg.elevenKey;
    if (!k) { try { k = JSON.parse(localStorage.getItem("agnes_plugin_tts") || "{}").elevenKey || ""; } catch (e) { } }
    return k;
  },
  generate: function (type, prompt, dur, instrumental) {
    var key = this.key();
    if (!key) return Promise.reject(new Error("clé ElevenLabs manquante (ici ou dans l'onglet Voix)"));
    var url, body;
    if (type === "musique") {
      url = "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128";
      body = { prompt: prompt, music_length_ms: Math.round(Math.max(10, Math.min(300, dur)) * 1000), force_instrumental: !!instrumental };
    } else {
      url = "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128";
      body = { text: prompt, duration_seconds: Math.max(0.5, Math.min(30, dur)), prompt_influence: 0.4 };
    }
    return fetch(url, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" }, body: JSON.stringify(body) }).then(function (r) {
      if (r.ok) return r.blob().then(function (b) { return b.type ? b : new Blob([b], { type: "audio/mpeg" }); });
      return r.text().then(function (t) {
        var m = t; try { var j = JSON.parse(t); m = (j.detail && (j.detail.message || j.detail)) || t; } catch (e) { }
        throw new Error((r.status === 401 ? "clé refusée" : r.status === 402 || r.status === 403 ? "offre ElevenLabs insuffisante pour ce type de génération" : "erreur " + r.status) + " — " + String(typeof m === "string" ? m : JSON.stringify(m)).slice(0, 160));
      });
    });
  },
  addBed: function (blob, name, type) {
    var core = this.core, App = window.AgnesApp, self = this, id = App.uid(), key = "bed:" + id;
    return core.store.put(key, blob).then(function () {
      return new Promise(function (res) {
        var a = new Audio(), u = URL.createObjectURL(blob); a.preload = "metadata";
        a.onloadedmetadata = function () { URL.revokeObjectURL(u); res(isFinite(a.duration) ? a.duration : null); };
        a.onerror = function () { URL.revokeObjectURL(u); res(null); }; a.src = u;
      });
    }).then(function (dur) {
      var shots = core.getShots(), b = Object.assign({ id: id, key: key, name: name || "Piste", type: type, dur: dur, from: "", to: "", delay: 0, offset: 0, mute: false }, self.PRESETS[type] || self.PRESETS.musique);
      if (type === "bruitage" && shots.length) { b.from = b.to = shots[0].id; }
      self.beds().push(b); core.saveProject(); self.render(); return b;
    });
  }
});
