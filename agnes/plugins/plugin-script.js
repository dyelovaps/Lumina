// plugins/plugin-script.js — Import de scénario
// Colle ou importe un scénario (texte libre, format « NOM : réplique », ou format Fountain/scénario classique :
// INT./EXT., nom du personnage en majuscules, didascalies entre parenthèses) et crée d'un coup :
// les plans (actions), leurs durées, les dialogues prêts pour l'onglet Voix, le casting vocal,
// les fiches personnages de la Bible et les transitions (FONDU AU NOIR, ENCHAÎNÉ…).
AgnesPlugins.register("scenario", {
  name: "Import de scénario",
  version: "1.0",

  init: function (core) {
    var App = window.AgnesApp, esc = App.esc, self = this;
    this.core = core; this.parsed = null;
    var cfg = core.pluginSettings("scenario", { mode: "t2v", split: "para", dedicated: false, location: true, tags: true, bible: true });
    this.cfg = cfg;

    var view = core.ui.addTab("scenario", "Scénario",
      '<div class="card"><h3>Importer un scénario</h3>' +
      '<p class="hint">Formats reconnus : paragraphes libres (un plan par paragraphe), répliques « LÉA : Tu savais ? », ' +
      'ou scénario classique (INT. BUREAU – NUIT, nom en MAJUSCULES sur sa ligne puis la réplique, didascalies entre parenthèses). ' +
      'Les dialogues ne vont jamais dans le prompt vidéo : ils partent dans l\'onglet Voix.</p>' +
      '<textarea id="scText" rows="12" placeholder="INT. CABINET PRUNIER – NUIT&#10;&#10;Léa referme le dossier, le regard dur.&#10;&#10;LÉA&#10;(murmurant)&#10;Tu savais depuis le début ?&#10;&#10;Marc détourne les yeux vers la fenêtre.&#10;&#10;FONDU AU NOIR."></textarea>' +
      '<div class="row-inline" style="margin-top:8px"><label class="small-btn" style="cursor:pointer">Importer un fichier (.txt, .md, .fountain, .docx)<input type="file" id="scFile" accept=".txt,.md,.fountain,.docx,text/plain" hidden></label></div>' +
      '<div class="ext-cols" style="margin-top:10px">' +
      '<div class="field"><label>Mode des plans</label><select id="scMode"></select></div>' +
      '<div class="field"><label>Découpage des actions</label><select id="scSplit"><option value="para">Un plan par paragraphe</option><option value="line">Un plan par ligne</option><option value="sentence">Un plan par phrase</option></select></div>' +
      '</div>' +
      '<label class="hint" style="display:block"><input type="checkbox" id="scDedicated"> Un plan dédié (gros plan) pour chaque réplique</label>' +
      '<label class="hint" style="display:block"><input type="checkbox" id="scLocation"> Ajouter le lieu de la scène au début de chaque prompt</label>' +
      '<label class="hint" style="display:block"><input type="checkbox" id="scTags"> Convertir les didascalies en balises d\'émotion (Eleven v3 : [whispers], [angry]…)</label>' +
      '<label class="hint" style="display:block"><input type="checkbox" id="scBible"> Créer les fiches personnages dans la Bible (si l\'extension est active)</label>' +
      '<div class="row-inline" style="margin-top:10px"><button class="primary-btn" id="scParse">Analyser</button></div></div>' +
      '<div class="card" id="scResult" style="display:none"><h3>Aperçu</h3><div id="scSummary" class="hint"></div><div id="scRows"></div>' +
      '<div class="row-inline" style="margin-top:10px"><button class="primary-btn" id="scCreate">Créer les plans</button><label class="hint" style="margin:0"><input type="checkbox" id="scRun"> Lancer la génération tout de suite</label></div></div>');
    var $ = function (id) { return view.querySelector("#" + id); };
    $("scMode").innerHTML = App.optionsHtml([["t2v", App.MODES.t2v.label], ["t2i", App.MODES.t2i.label], ["ingr_v", App.MODES.ingr_v.label], ["ingr_i", App.MODES.ingr_i.label]], cfg.mode);
    $("scSplit").value = cfg.split; $("scDedicated").checked = cfg.dedicated; $("scLocation").checked = cfg.location; $("scTags").checked = cfg.tags; $("scBible").checked = cfg.bible;
    view.querySelector(".card").addEventListener("change", function (e) {
      if (e.target.id === "scFile") return;
      cfg.mode = $("scMode").value; cfg.split = $("scSplit").value; cfg.dedicated = $("scDedicated").checked;
      cfg.location = $("scLocation").checked; cfg.tags = $("scTags").checked; cfg.bible = $("scBible").checked; cfg.save();
      if (self.parsed) parse();
    });
    $("scFile").addEventListener("change", function () {
      var f = this.files[0]; this.value = ""; if (!f) return;
      self.readFile(f).then(function (t) { $("scText").value = t; parse(); }).catch(function (e) { core.toast("Lecture du fichier : " + e.message, "err"); });
    });
    $("scParse").addEventListener("click", parse);
    function parse() {
      var res = self.parse($("scText").value, cfg);
      self.parsed = res;
      if (!res.shots.length) { $("scResult").style.display = "none"; core.toast("Aucun plan trouvé dans ce texte.", "err"); return; }
      $("scResult").style.display = "";
      var withD = res.shots.filter(function (s) { return s.voice; }).length, total = res.shots.reduce(function (a, s) { return a + s.duration; }, 0);
      $("scSummary").innerHTML = res.shots.length + " plans · " + res.scenes + " scène(s) · " + withD + " avec dialogue · personnages : " +
        (res.characters.length ? res.characters.map(esc).join(", ") : "aucun") + " · durée estimée ≈ " + Math.round(total) + " s";
      $("scRows").innerHTML = res.shots.map(function (s, i) {
        return '<div class="ext-row"><input type="checkbox" data-sc="' + i + '" checked><b>#' + (i + 1) + '</b>' +
          (s.newScene ? '<span class="ext-tag">' + esc(s.location || "Nouvelle scène") + '</span>' : '') +
          '<span class="grow">' + esc(s.prompt) + (s.voice ? '<br><span class="hint" style="margin:0">🎙 ' + esc(s.voice).replace(/\n/g, " / ") + '</span>' : '') + '</span>' +
          '<span class="ext-tag">' + s.duration + ' s</span>' + (s.transIn ? '<span class="ext-tag">' + (s.transIn === "black" ? "fondu au noir" : "fondu enchaîné") + ' avant</span>' : '') + '</div>';
      }).join("");
    }
    $("scCreate").addEventListener("click", function () {
      if (!self.parsed) return;
      var keep = self.parsed.shots.filter(function (s, i) { var cb = view.querySelector('[data-sc="' + i + '"]'); return !cb || cb.checked; });
      var n = self.create(keep, self.parsed.characters, cfg, $("scRun").checked);
      App.showView("viewStoryboard");
      core.toast(n + " plans créés depuis le scénario" + (keep.some(function (s) { return s.voice; }) ? " — dialogues prêts dans l'onglet Voix." : "."), "ok");
    });
  },

  readFile: function (f) {
    if (/\.docx$/i.test(f.name)) {
      var load = window.mammoth ? Promise.resolve() : new Promise(function (res, rej) {
        var s = document.createElement("script"); s.src = "vendor/mammoth.browser.min.js";
        s.onload = res; s.onerror = function () { rej(new Error("lecteur .docx indisponible (connexion ?)")); }; document.head.appendChild(s);
      });
      return load.then(function () { return f.arrayBuffer(); }).then(function (ab) { return window.mammoth.extractRawText({ arrayBuffer: ab }); }).then(function (r) { return r.value; });
    }
    return f.text();
  },

  TAGS: [[/murmur|chuchot|tout bas|à voix basse/i, "[whispers]"], [/cri|hurl/i, "[shouting]"], [/col[èe]re|furieu|énerv/i, "[angry]"],
    [/ri(t|ant|re)\b|rire|amus/i, "[laughs]"], [/soupir/i, "[sighs]"], [/pleur|sanglot|larme/i, "[crying]"], [/ironi|sarcas/i, "[sarcastically]"],
    [/peur|effray|tremb/i, "[nervous]"], [/triste|brisé/i, "[sad]"], [/excit|joie|ravi/i, "[excited]"]],
  EN: [[/murmur|chuchot|voix basse/i, "whispering"], [/cri|hurl/i, "shouting"], [/col[èe]re|furieu/i, "angry"], [/pleur|sanglot|larme/i, "in tears"], [/ri(t|ant|re)\b|rire/i, "laughing"], [/soupir/i, "sighing"], [/peur|effray/i, "frightened"]],

  parse: function (text, cfg) {
    var self = this, lines = String(text || "").replace(/\r/g, "").split("\n");
    var HEADING = /^\s*(?:(INT|EXT|INT\.?\s*\/\s*EXT|I\/E)[.\s]|(?:SC[ÈE]NE|S[ÉE]QUENCE|SEQ)\b|#{1,3}\s)/i;
    var TRANS = /^\s*(?:CUT TO|FONDU(?: AU NOIR| ENCHA[ÎI]N[ÉE])?|FADE (?:OUT|IN|TO BLACK)|DISSOLVE TO|ENCHA[ÎI]N[ÉE]|NOIR\.?$)/i;
    var NARR = /^(voix[- ]off|v\.?\s?o\.?|narrat(eur|rice)|off)$/i;
    // Blocs séparés par des lignes vides
    var blocks = [], cur = [];
    lines.forEach(function (l) { if (!l.trim()) { if (cur.length) blocks.push(cur); cur = []; } else cur.push(l.replace(/\s+$/, "")); });
    if (cur.length) blocks.push(cur);

    var shots = [], chars = [], location = "", scenes = 0, pendingTrans = "", newScene = false;
    function addChar(n) { if (!NARR.test(n) && chars.indexOf(n) === -1) chars.push(n); }
    function isCue(l) {
      var t = l.trim().replace(/\s*\((V\.?O\.?|O\.?S\.?|OFF|CONT'?D|SUITE|V\.?F\.?)\)\s*$/i, "");
      return t.length >= 2 && t.length <= 32 && t === t.toUpperCase() && /[A-ZÀ-Þ]/.test(t) && !/[.!?,;]$/.test(t) && !HEADING.test(t) && !TRANS.test(t);
    }
    function cleanName(n) { n = n.trim().replace(/\s*\(([^)]*)\)\s*$/, "").trim(); return NARR.test(n) ? "" : n.toUpperCase(); }
    function estimate(voiceText) {
      if (!voiceText) return null;
      var chars = voiceText.replace(/\[[^\]]+\]/g, "").replace(/^[^:\n]{1,32}:\s*/gm, "").length;
      return Math.max(4, Math.min(15, Math.round(chars / 15 + 1.5)));
    }
    function pushShot(prompt, voice, extra) {
      var s = Object.assign({ prompt: prompt, voice: voice || "", location: location, newScene: newScene, transIn: pendingTrans }, extra || {});
      s.duration = estimate(s.voice) || 5;
      shots.push(s); newScene = false; pendingTrans = ""; return s;
    }
    function withLoc(p) { return cfg.location && location ? location + " — " + p : p; }
    function line(name, txt, paren) {
      var tag = "";
      if (paren && cfg.tags) { var m = self.TAGS.find(function (t) { return t[0].test(paren); }); if (m) tag = m[1] + " "; }
      return (name ? name + " : " : "") + tag + txt.trim();
    }
    function attachDialogue(name, txt, paren) {
      var ln = line(name, txt, paren), last = shots[shots.length - 1];
      var sameScene = last && !newScene && !pendingTrans;
      if (!cfg.dedicated && sameScene && (!last.voice || last.voiceBy === name)) {
        last.voice = last.voice ? last.voice + "\n" + ln : ln; last.voiceBy = name; last.duration = estimate(last.voice); return;
      }
      var emo = paren ? (self.EN.find(function (t) { return t[0].test(paren); }) || [])[1] : "";
      var who = name ? name.charAt(0) + name.slice(1).toLowerCase() : "";
      var p = who ? "Close-up on " + who + (emo ? ", " + emo : "") + ", speaking" : "Atmospheric shot matching the narration";
      var s = pushShot(withLoc(p), ln); s.voiceBy = name; s.dialogueShot = true;
    }

    blocks.forEach(function (b) {
      var first = b[0].trim();
      if (HEADING.test(first)) {
        scenes++; newScene = true;
        location = first.replace(/^#{1,3}\s*/, "").replace(/^(SC[ÈE]NE|S[ÉE]QUENCE|SEQ)\s*\d*\s*[:.–—-]?\s*/i, "").trim();
        b = b.slice(1); if (!b.length) return; first = b[0].trim();
      }
      if (b.length === 1 && TRANS.test(first)) { pendingTrans = /encha[îi]n|dissolve/i.test(first) ? "fade" : "black"; return; }
      // Format classique : NOM seul sur sa ligne, puis réplique
      if (b.length >= 2 && isCue(first)) {
        var name = cleanName(first); if (name) addChar(name);
        var paren = "", txt = [];
        b.slice(1).forEach(function (l) { var t = l.trim(); if (/^\(.*\)$/.test(t)) paren += " " + t; else txt.push(t); });
        if (txt.length) attachDialogue(name, txt.join(" "), paren);
        return;
      }
      // Répliques « NOM : texte » (une ou plusieurs lignes)
      var NOTNAME = /^\s*(plan|shot|sc[èe]ne|s[ée]quence|lieu|d[ée]cor|int|ext|note|style|cam[ée]ra|action)\b/i;
      var inline = !NOTNAME.test(first) && b.every(function (l) { return /^\s*[^:]{1,32}\s*:\s*\S/.test(l) || /^\s*\(.*\)\s*$/.test(l); }) &&
        b.some(function (l) { var m = l.match(/^\s*([^:]{1,32})\s*:/); return m && (isCue(m[1].replace(/\(.*\)/, "")) || NARR.test(m[1].trim()) || /^[A-ZÀ-Þ][\p{L}'’\- ]{0,30}$/u.test(m[1].trim())); });
      if (inline) {
        var par = "";
        b.forEach(function (l) {
          var t = l.trim(); if (/^\(.*\)$/.test(t)) { par = t; return; }
          var m = t.match(/^([^:(]{1,32})(\(([^)]*)\))?\s*:\s*(.+)$/); if (!m) return;
          var n = cleanName(m[1]); if (n) addChar(n);
          attachDialogue(n, m[4], (m[3] || "") + " " + par); par = "";
        });
        return;
      }
      if (b.length === 1 && TRANS.test(first)) return;
      // Action
      var paras;
      if (cfg.split === "line" || b.every(function (l) { return /^\s*([-•*]|\d+[.)])\s+/.test(l); })) paras = b.map(function (l) { return l.replace(/^\s*([-•*]|\d+[.)])\s+/, "").trim(); });
      else if (cfg.split === "sentence") paras = b.join(" ").match(/[^.!?…]+[.!?…]*/g) || [b.join(" ")];
      else paras = [b.join(" ")];
      paras.map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 1 && !TRANS.test(p); }).forEach(function (p) { pushShot(withLoc(p.replace(/^\s*(plan|shot)\s*\d*\s*[:.–—-]\s*/i, ""))); });
    });
    return { shots: shots, characters: chars, scenes: Math.max(scenes, shots.length ? 1 : 0) };
  },

  create: function (list, characters, cfg, runNow) {
    var core = this.core, App = window.AgnesApp, proj = core.getProject();
    var created = list.map(function (s) {
      var kind = App.modeKind(cfg.mode);
      var shot = core.addShot({ mode: cfg.mode, prompt: s.prompt, duration: kind === "video" ? s.duration : proj.duration || 5 });
      if (s.voice) shot.voiceDraft = s.voice;
      if (s.transIn) {
        // la transition se règle sur le plan précédent
        var sorted = App.sortedShots(proj), i = sorted.indexOf(shot);
        if (i > 0) { var prev = sorted[i - 1], m = proj.montage.items[prev.id] || (proj.montage.items[prev.id] = { on: true, dur: "", tin: "", tout: "", trans: "", tdur: 0.6 }); m.trans = s.transIn; m.tdur = 0.8; }
      }
      return shot;
    });
    // Casting vocal (utilisé par l'onglet Voix)
    if (!proj.voiceCast || !proj.voiceCast.length) proj.voiceCast = [{ id: App.uid(), name: "NARRATEUR", voice: "", style: "" }];
    characters.forEach(function (n) {
      if (!proj.voiceCast.some(function (r) { return r.name.toUpperCase() === n.toUpperCase(); })) proj.voiceCast.push({ id: App.uid(), name: n.toUpperCase(), voice: "", style: "" });
    });
    // Bible
    var bible = AgnesPlugins.isLoaded("bible") && AgnesPlugins.get("bible");
    if (cfg.bible && bible && characters.length) {
      var nb = bible.ensureEntries(characters.map(function (n) { return n.charAt(0) + n.slice(1).toLowerCase(); }), "personnage");
      if (nb) core.toast(nb + " fiche(s) personnage créée(s) dans la Bible — complétez leur ADN.");
    }
    core.saveProject(); App.render();
    if (runNow) App.enqueueMany(created, proj);
    return created.length;
  }
});
