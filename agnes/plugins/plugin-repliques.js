// plugins/plugin-repliques.js — Calculateur de répliques en caractères (30/09/2026)
// Onglet « Répliques » : collez une ou plusieurs répliques (une par ligne, « NOM : texte » accepté) ; pour chacune :
// caractères avec et sans espaces, mots, phrases, durée estimée, et ce qu'il faut ajouter ou retirer pour tenir le réglage
// choisi (Anthony TikTok 10 s, Série, Court métrage, Voix-off… modifiables, et les vôtres). API pour les autres extensions
// (le Chef de l'Atelier s'en sert) : AgnesPlugins.get("repliques").mesurer(texte, idReglage). Extension indépendante.
AgnesPlugins.register("repliques", {
  name: "Calculateur de répliques",
  version: "1.0",
  KEY: "repliques:reglages",
  TEXT_KEY: "repliques:texte",

  // Réglages d'origine. cps = caractères par seconde (espaces compris) ; min/max en caractères (0 = pas de limite) ;
  // clip = durée de la vidéo en s (0 = pas de vidéo imposée) ; fin = secondes gardées après la parole (carton de fin) ;
  // virgules = la voix enchaîne d'une traite (points internes → virgules, comme les répliques Grok d'Anthony).
  DEFAULTS: [
    { id: "anthony", nom: "Anthony — TikTok 10 s (Grok)", min: 150, max: 180, cps: 22.5, pause: 0.15, tour: 0.4, phrase: 75, clip: 10, fin: 2, virgules: true,
      note: "Vitesse de l'agent Marketing (3,7 mots/s × 6,1 caractères par mot) : à calibrer avec une vraie vidéo Grok (bouton Calibrer)." },
    { id: "serie", nom: "Série — dialogue", min: 0, max: 140, cps: 15, pause: 0.3, tour: 0.4, phrase: 90, clip: 0, fin: 0, virgules: false,
      note: "Réplique jouée, avec respiration : une réplique longue se découpe en deux plans." },
    { id: "court", nom: "Court métrage — dialogue", min: 0, max: 200, cps: 14, pause: 0.4, tour: 0.5, phrase: 100, clip: 0, fin: 0, virgules: false,
      note: "Jeu plus posé que la série ; au-delà de 200 caractères, pensez à un contrechamp." },
    { id: "voixoff", nom: "Voix-off", min: 0, max: 0, cps: 16, pause: 0.35, tour: 0.4, phrase: 110, clip: 0, fin: 0, virgules: false,
      note: "Narration : seule la durée compte, réglez « Durée de la vidéo » si la voix doit tenir dans un plan." }
  ],

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    this.reglages = this.DEFAULTS.map(function (r) { return Object.assign({}, r); });
    this.current = "anthony"; this.text = "";
    this.view = core.ui.addTab("repliques", "Répliques", '<div class="card"><div id="rpBody"></div></div>');
    Promise.all([core.store.getKV(this.KEY), core.store.getKV(this.TEXT_KEY)]).then(function (res) {
      var saved = res[0];
      if (saved && saved.list) {
        saved.list.forEach(function (r) { var i = self.reglages.findIndex(function (x) { return x.id === r.id; }); if (i === -1) self.reglages.push(r); else self.reglages[i] = r; });
        if (saved.current && self.get(saved.current)) self.current = saved.current;
      }
      if (typeof res[1] === "string") self.text = res[1];
      self.render(); self.decorateCards();
    }, function () { self.render(); });
    // 30/09 — compteur automatique dans les cartes du Storyboard (répliques entre guillemets du prompt)
    core.on("shots:render", function () { self.decorateCards(); });
    document.addEventListener("input", function (e) {
      var ta = e.target && e.target.closest && e.target.closest('.shot-card textarea[data-f="prompt"]');
      if (ta) self.decorateCard(ta.closest(".shot-card"), ta.value);
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-rpc]"); if (b) self.cardAction(b);
    });
    document.addEventListener("change", function (e) {
      var sel = e.target.closest && e.target.closest("[data-rpc-reglage]"); if (!sel) return;
      var pr = self.core.getProject(); pr.repliques = sel.value; self.core.saveProject(); self.decorateCards();
    });
  },

  get: function (id) { return this.reglages.find(function (r) { return r.id === id; }) || null; },
  save: function () { this.core.store.setKV(this.KEY, { current: this.current, list: this.reglages }); },

  // ---------- mesure (utilisable sans l'onglet) ----------
  voix: function (t, virgules) {
    var s = String(t || "").replace(/[«»"“”]/g, "").replace(/\s*[:;—–]\s*/g, ", ").replace(/…/g, ",").replace(/\s+/g, " ").trim();
    if (virgules) s = s.replace(/\.\s+(\S)(\S?)/g, function (_, a, b) { return ", " + (b && b === b.toUpperCase() && /[A-ZÀ-Þ]/.test(b) ? a : a.toLowerCase()) + b; });
    return s.replace(/\s+([,.?!])/g, "$1").replace(/,+/g, ",");
  },
  phrases: function (t) { return (String(t).match(/[^.?!…]+[.?!…]*/g) || []).map(function (x) { return x.trim(); }).filter(Boolean); },
  mots: function (t) { return (String(t).match(/[\wÀ-ÖØ-öø-ÿŒœÆæ'’-]+/g) || []).length; },
  // Une réplique par ligne ; « NOM : texte » → le nom n'est ni dit ni compté
  lignes: function (texte) {
    return String(texte || "").replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var m = /^([A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ'’. -]{0,28}?)\s*(?:\(([^)]{1,30})\))?\s*[:—–]\s+(.+)$/.exec(l);
      return m && m[1].split(/\s+/).length <= 3 ? { nom: m[1].trim(), texte: m[3] } : { nom: "", texte: l };
    });
  },
  mesurer: function (texte, id) {
    var self = this, r = this.get(id || this.current) || this.reglages[0];
    var out = this.lignes(texte).map(function (x) {
      var dit = self.voix(x.texte, r.virgules), ph = self.phrases(self.voix(x.texte, false));
      var car = dit.length, sans = dit.replace(/\s/g, "").length, duree = r.cps ? car / r.cps + r.pause * Math.max(0, ph.length - 1) : 0;
      var alertes = [], statut = "ok";
      if (r.min && car < r.min) { statut = "court"; alertes.push("trop court : ajoutez " + (r.min - car) + " caractères"); }
      if (r.max && car > r.max) { statut = "long"; alertes.push("trop long : retirez " + (car - r.max) + " caractères"); }
      if (r.clip && duree > r.clip - (r.fin || 0)) { statut = "long"; alertes.push("la parole dure " + duree.toFixed(1) + " s : il faut finir avant " + (r.clip - (r.fin || 0)) + " s"); }
      if (!r.virgules) ph.forEach(function (p) { if (r.phrase && p.length > r.phrase) alertes.push("phrase longue (" + p.length + " car. > " + r.phrase + ") : « " + p.slice(0, 40) + "… »"); });
      if (/[«»"“”:;]/.test(x.texte)) alertes.push("guillemets ou deux-points retirés pour la voix");
      return { nom: x.nom, texte: x.texte, dit: dit, caracteres: car, sans_espaces: sans, mots: self.mots(dit), phrases: ph.length,
        duree_s: Math.round(duree * 10) / 10, statut: statut, alertes: alertes };
    });
    var tot = out.reduce(function (s, x) { return s + x.duree_s; }, 0);
    return { reglage: r.nom, id: r.id, min: r.min, max: r.max, repliques: out, duree_totale_s: Math.round(tot * 10) / 10 };
  },
  // Texte court pour le Chef de l'Atelier (et pour copier)
  resume: function (texte, id) {
    var m = this.mesurer(texte, id);
    if (!m.repliques.length) return "Aucune réplique à mesurer.";
    return "Réglage « " + m.reglage + " »" + (m.min || m.max ? " : " + (m.min || 0) + " à " + (m.max || "∞") + " caractères, espaces compris" : "") + ".\n" +
      m.repliques.map(function (x, i) {
        return (i + 1) + ". " + (x.nom ? x.nom + " — " : "") + x.caracteres + " car. (" + x.sans_espaces + " sans espaces), " + x.mots + " mots, " + x.duree_s + " s — " +
          (x.statut === "ok" ? "OK" : x.statut === "court" ? "TROP COURT" : "TROP LONG") + (x.alertes.length ? " · " + x.alertes.join(" · ") : "");
      }).join("\n") + (m.repliques.length > 1 ? "\nDurée totale : " + m.duree_totale_s + " s" : "");
  },

  // ---------- compteur dans les cartes (30/09) ----------
  // Répliques = textes entre « … », “ … ” ou " … " du prompt de la carte, avec leur interlocuteur quand on le trouve :
  // un nom de la Bibliothèque cité juste avant la réplique, ou « Léa says / Marc répond… ».
  QUOTES: /«\s*([^»]*?)\s*»|“([^”]*)”|"([^"]*)"/g,
  VERBES: "says|said|asks|asked|replies|replied|answers|whispers|shouts|adds|continues|tells|dit|répond|demande|murmure|crie|ajoute|reprend|lance",
  extraire: function (prompt, shot) {
    var out = [], re = new RegExp(this.QUOTES.source, "g"), m, last = 0, txt = String(prompt || "");
    var p = this.core && this.core.getProject && this.core.getProject(), lib = (p && p.library) || [], refs = (shot && shot.ingredients) || [];
    var byName = {};
    lib.forEach(function (l) { var n = String(l.name || "").trim(); if (n.length >= 2 && (!byName[n] || refs.indexOf(l.id) !== -1)) byName[n] = l; });
    var noms = Object.keys(byName).sort(function (a, b) { return b.length - a.length; });
    var verbe = new RegExp("([A-ZÀ-Þ][\\wÀ-ÖØ-öø-ÿ'’-]+)\\s+(?:" + this.VERBES + ")\\b[^«“\"]*$");
    while ((m = re.exec(txt))) {
      var t = (m[1] || m[2] || m[3] || "").trim(), avant = txt.slice(last, m.index), low = avant.toLowerCase(), nom = "", best = -1;
      if (window.AgnesDialogue && AgnesDialogue.estReplique && !AgnesDialogue.estReplique(txt, m.index, m[0].charAt(0))) continue;   // 01/10 — texte écrit ou bruitage
      last = m.index + m[0].length;
      if (!t) continue;
      noms.forEach(function (n) { var k = low.lastIndexOf(n.toLowerCase()); if (k > best) { best = k; nom = n; } });
      if (!nom) { var v = verbe.exec(avant); if (v && !/^(He|She|They|Il|Elle|Then|Puis)$/.test(v[1])) nom = v[1]; }
      var item = nom && byName[nom];
      out.push({ texte: t, nom: nom, ref: item ? { id: item.id, thumb: item.thumb || "", cochee: refs.indexOf(item.id) !== -1 } : null });
    }
    return out;
  },
  // Étiquette d'une réplique : la pastille du personnage (comme les références de la carte), sinon le nom, sinon « Réplique n »
  labelHtml: function (x, i) {
    var esc = this.A.esc;
    if (x.ref) {
      return '<span class="chip' + (x.ref.cochee ? " on" : "") + '" style="pointer-events:none;margin:0 6px 0 0' + (x.ref.cochee ? "" : ";opacity:.55") + '">' +
        (x.ref.thumb ? '<img src="' + x.ref.thumb + '" alt="">' : '') + esc(x.nom) + '</span>' +
        (x.ref.cochee ? '' : '<span class="hint" style="margin:0">référence pas cochée sur cette carte</span>');
    }
    if (x.nom) return '<b>' + esc(x.nom) + '</b>';
    return '<b>Réplique ' + (i + 1) + '</b> <span class="hint" style="margin:0">qui parle ? cochez sa référence ou écrivez son nom juste avant la réplique</span>';
  },
  // Mesure d'une carte : chaque réplique (maximum, phrases) + l'échange entier (minimum, durée face au clip)
  // clip = durée de la carte (s) : sert quand le réglage n'impose pas de durée de vidéo (série, court métrage)
  // valides = { texte normalisé : "marketing" | "vous" } : répliques validées en amont, qui ne sont plus signalées pour leur
  // nombre de caractères (seule la durée face au clip reste contrôlée). « Phrase longue » n'est qu'un conseil (30/09).
  norm: function (t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ""); },
  mesurerCarte: function (items, id, clip, valides) {
    var self = this, r0 = this.get(id) || this.reglages[0], r = r0.clip || !clip ? r0 : Object.assign({}, r0, { clip: +clip, fin: r0.fin || 0 }), tour = r.tour != null ? r.tour : 0.4, alertes = [];
    valides = valides || {};
    var lignes = items.map(function (it, i) {
      var x = self.mesurer(it.texte, r.id).repliques[0] || { caracteres: 0, duree_s: 0, alertes: [], dit: "" };
      var qui = it.nom || (items.length > 1 ? "réplique " + (i + 1) : "réplique");
      var mine = [], conseils = [], valide = valides[self.norm(it.texte)] || "";
      if (!valide && r.max && x.caracteres > r.max) mine.push("trop longue : retirez " + (x.caracteres - r.max) + " caractères");
      if (!valide && items.length === 1 && r.min && x.caracteres < r.min) mine.push("trop courte : ajoutez " + (r.min - x.caracteres) + " caractères");
      // points devenus virgules (voix d'une traite) : la « phrase » affichée n'est pas celle qui est dite → pas de conseil
      if (!r.virgules) x.alertes.filter(function (a) { return /^phrase longue/.test(a); }).forEach(function (a) { conseils.push(a); });
      mine.forEach(function (a) { alertes.push(qui.charAt(0).toUpperCase() + qui.slice(1) + " : " + a); });
      return { nom: it.nom, ref: it.ref || null, qui: qui, texte: it.texte, dit: x.dit, caracteres: x.caracteres, duree_s: x.duree_s,
        statut: mine.length ? (/courte/.test(mine[0]) ? "court" : "long") : "ok", alertes: mine, conseils: conseils, valide: valide };
    });
    var car = lignes.reduce(function (a, x) { return a + x.caracteres; }, 0);
    var duree = Math.round((lignes.reduce(function (a, x) { return a + x.duree_s; }, 0) + tour * Math.max(0, lignes.length - 1)) * 10) / 10;
    var statut = lignes.some(function (x) { return x.statut === "long"; }) ? "long" : lignes.some(function (x) { return x.statut === "court"; }) ? "court" : "ok";
    if (lignes.length > 1 && r.min && car < r.min && !lignes.every(function (x) { return x.valide; })) { statut = statut === "ok" ? "court" : statut; alertes.push("Échange trop court : " + car + " caractères au total (minimum " + r.min + ")"); }
    if (r.clip && duree > r.clip - (r.fin || 0)) { statut = "long"; alertes.push((lignes.length > 1 ? "L'échange" : "La parole") + " dure " + duree + " s : il faut finir avant " + (r.clip - (r.fin || 0)) + " s" +
      (lignes.some(function (x) { return x.valide; }) ? " (estimation : calibrez la vitesse si la vidéo réelle tient)" : "")); }
    return { reglage: r, lignes: lignes, caracteres: car, duree_s: duree, statut: statut, alertes: alertes };
  },
  valides: function (shot) {
    var out = {}, self = this, p = this.core.getProject();
    // documents « Marketing — date » de l'Atelier (données du projet, lues sans passer par l'extension) + Notes de la carte
    var docs = ((p && p.atelier && p.atelier.docs) || []).map(function (d) { return d.content || ""; }).join("\n");
    String(docs + "\n" + ((shot && shot.notes) || "")).replace(/Réplique \(voix, mot pour mot\)\s*:\s*«\s*([^»]+?)\s*»/g, function (_, t) { out[self.norm(t)] = "marketing"; return _; });
    ((shot && shot.repliquesValidees) || []).forEach(function (t) { out[t] = "vous"; });
    return out;
  },
  // Réglage du projet : celui choisi, sinon celui du style du projet (extension Styles de prompt), sinon Anthony pour un
  // projet nommé Marketing et Série pour tous les autres (01/10 : avant, Anthony partout bloquait les répliques de série)
  reglageProjet: function () {
    var p = this.core.getProject(); if (p && this.get(p.repliques)) return p.repliques;
    var P = window.AgnesPlugins, S = P && P.isLoaded && P.isLoaded("styles") ? P.get("styles").courant(p) : null;
    if (S && this.get(S.repliques)) return S.repliques;
    return p && /marketing/i.test(p.name || "") ? "anthony" : "serie";
  },
  decorateCards: function () {
    var self = this, A = this.A;
    document.querySelectorAll("#shotList .shot-card[data-shot]").forEach(function (card) {
      var s = A.findShot(card.getAttribute("data-shot")); if (s) self.decorateCard(card, s.prompt, s);
    });
  },
  summaryOf: function (c) {
    var r = c.reglage;
    if (c.statut !== "ok") return "⚠ " + c.alertes[0] + (c.alertes.length > 1 ? " (+" + (c.alertes.length - 1) + ")" : "");
    if (c.lignes.length === 1) return "💬 " + c.caracteres + " car. · " + c.duree_s + " s";
    return "💬 " + c.lignes.map(function (x) { return (x.nom || x.qui) + " " + x.caracteres; }).join(" · ") + " → " + c.caracteres + " car. · " + c.duree_s + " s";
  },
  decorateCard: function (card, prompt, shot) {
    if (!card) return;
    var self = this, esc = this.A.esc, ta = card.querySelector('textarea[data-f="prompt"]'); if (!ta) return;
    shot = shot || this.A.findShot(card.getAttribute("data-shot"));
    var box = card.querySelector(".rp-auto"), items = this.extraire(prompt, shot);
    if (!items.length) { if (box) box.remove(); return; }
    var wasOpen = box && box.open, editing = box && box.contains(document.activeElement);
    if (editing) return;   // on ne redessine pas pendant qu'on corrige
    var clip = shot && this.A.modeKind && this.A.modeKind(shot.mode) !== "image" ? +shot.duration || 0 : 0;
    var id = this.reglageProjet(), r = this.get(id), c = this.mesurerCarte(items, id, clip, this.valides(shot));
    if (!box) { box = document.createElement("details"); box.className = "rp-auto"; ta.parentNode.insertBefore(box, ta.nextSibling); }
    box.setAttribute("data-clip", clip);
    var dim = "var(--text-dim, #8b949e)";
    box.innerHTML = '<summary data-rpc-summary style="cursor:pointer;list-style:none;font-size:12px;color:' + (c.statut === "ok" ? dim : "#f85149") + ';margin:2px 0 4px">' + esc(this.summaryOf(c)) + '</summary>' +
      '<div style="font-size:12px;margin:0 0 8px">' +
      '<label class="inline" style="font-size:12px">Réglage du projet <select data-rpc-reglage style="width:auto;font-size:12px">' +
      this.reglages.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === id ? " selected" : "") + '>' + esc(x.nom) + '</option>'; }).join("") + '</select></label>' +
      c.lignes.map(function (x, i) {
        return '<div style="margin-top:6px"><div data-rpc-nom="' + i + '" data-nom="' + esc(x.nom) + '" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:2px">' + self.labelHtml(x, i) +
          (x.valide ? '<span style="color:#3fb950;font-size:12px">✓ validée ' + (x.valide === "marketing" ? "par l'agent Marketing" : "par vous") + '</span>' : '') + '</div>' +
          '<textarea data-rpc-text="' + i + '" rows="2" style="font-size:12px">' + esc(x.texte) + '</textarea>' +
          '<div data-rpc-count="' + i + '" style="color:' + (x.statut === "ok" ? dim : "#f85149") + '">' + esc(self.countLine(x, r)) + '</div>' +
          '<div class="row-inline" style="margin-top:4px"><button type="button" class="small-btn" data-rpc="apply" data-i="' + i + '">✔ Corriger ici</button>' +
          '<button type="button" class="small-btn" data-rpc="chef" data-i="' + i + '">🎬 Demander au Chef</button>' +
          (x.valide === "vous" ? '<button type="button" class="small-btn" data-rpc="unkeep" data-i="' + i + '" title="Les alertes de caractères reviennent">↩ Ne plus garder</button>'
            : !x.valide ? '<button type="button" class="small-btn" data-rpc="keep" data-i="' + i + '" title="Vous validez cette réplique : plus d\'alerte de caractères tant que le texte ne change pas">👍 Garder telle quelle</button>' : '') + '</div></div>';
      }).join("") +
      (c.lignes.length > 1 ? '<div data-rpc-total style="margin-top:6px;color:' + (c.statut === "ok" ? dim : "#f85149") + '">' + esc(this.totalLine(c)) + '</div>' : '') + '</div>';
    box.open = c.statut !== "ok" ? true : !!wasOpen;
    Array.prototype.forEach.call(box.querySelectorAll("[data-rpc-text]"), function (t) {
      t.addEventListener("input", function () { self.liveCard(box, id); });
    });
  },
  // Pendant une correction : recalcul de chaque réplique ET de l'échange entier, sans redessiner
  liveCard: function (box, id) {
    var self = this, r = this.get(id), clip = +box.getAttribute("data-clip") || 0, items = Array.prototype.map.call(box.querySelectorAll("[data-rpc-text]"), function (t) {
      var n = box.querySelector('[data-rpc-nom="' + t.getAttribute("data-rpc-text") + '"]');
      return { texte: t.value, nom: n ? n.getAttribute("data-nom") : "" };
    });
    var card = box.closest(".shot-card"), shot = card && this.A.findShot(card.getAttribute("data-shot"));
    var c = this.mesurerCarte(items, id, clip, this.valides(shot)), green = "#3fb950", red = "#f85149";
    c.lignes.forEach(function (x, i) { var el = box.querySelector('[data-rpc-count="' + i + '"]'); if (el) { el.textContent = self.countLine(x, r); el.style.color = x.statut === "ok" ? green : red; } });
    var tot = box.querySelector("[data-rpc-total]"); if (tot) { tot.textContent = this.totalLine(c); tot.style.color = c.statut === "ok" ? green : red; }
    var sum = box.querySelector("[data-rpc-summary]"); if (sum) { sum.textContent = this.summaryOf(c); sum.style.color = c.statut === "ok" ? green : red; }
  },
  countLine: function (x, r) {
    return x.caracteres + " caractères" + (r.max ? " (max " + r.max + ")" : "") + " · " + x.duree_s + " s" + (x.statut === "ok" ? " · ✓" : " · " + x.alertes[0]) +
      ((x.conseils || []).length ? " · conseil : " + x.conseils[0] : "");
  },
  totalLine: function (c) {
    var r = c.reglage;
    return "Échange : " + c.caracteres + " caractères" + (r.min ? " (min " + r.min + ")" : "") + " · " + c.duree_s + " s" + (r.clip ? " (finir avant " + (r.clip - (r.fin || 0)) + " s)" : "") +
      (c.statut === "ok" ? " · ✓" : "");
  },
  cardAction: function (b) {
    var card = b.closest(".shot-card"), A = this.A, s = card && A.findShot(card.getAttribute("data-shot")); if (!s) return;
    var i = +b.getAttribute("data-i") || 0, ta = card.querySelector('[data-rpc-text="' + i + '"]'), texte = ta ? ta.value : "";
    var num = A.sortedShots(this.core.getProject()).indexOf(s) + 1, r = this.get(this.reglageProjet());
    if (b.getAttribute("data-rpc") === "keep" || b.getAttribute("data-rpc") === "unkeep") {
      var key = this.norm(texte), list = (s.repliquesValidees || []).filter(function (t) { return t !== key; });
      if (b.getAttribute("data-rpc") === "keep") list.push(key);
      s.repliquesValidees = list; this.core.saveProject(); this.decorateCard(card, s.prompt, s);
      this.core.toast(b.getAttribute("data-rpc") === "keep" ? "Réplique gardée telle quelle : plus d'alerte de caractères tant qu'elle ne change pas." : "Alertes de caractères rétablies.", "ok");
      return;
    }
    if (b.getAttribute("data-rpc") === "apply") {
      var n = -1, clean = texte.replace(/[«»"“”]/g, "").trim(); if (!clean) return;
      s.prompt = String(s.prompt || "").replace(new RegExp(this.QUOTES.source, "g"), function (all) {
        n++; if (n !== i) return all;
        return all.charAt(0) === "«" ? "« " + clean + " »" : all.charAt(0) === "“" ? "“" + clean + "”" : '"' + clean + '"';
      });
      this.core.saveProject(); A.renderShots(); this.core.toast("Réplique de la carte #" + num + " corrigée (" + clean.length + " caractères).", "ok");
      return;
    }
    var at = window.AgnesPlugins && AgnesPlugins.get("atelier");
    if (!at || !at.ask) { this.core.toast("Activez l'extension « Atelier IA » (⚙) pour demander au Chef, ou corrigez ici.", "err"); return; }
    var c = this.mesurerCarte(this.extraire(s.prompt, s), r.id, A.modeKind(s.mode) !== "image" ? +s.duration || 0 : 0), x = c.lignes[i] || { qui: "réplique", caracteres: "?" };
    var echange = c.lignes.length > 1 ? " Elle fait partie d'un échange de " + c.lignes.length + " répliques (" + c.lignes.map(function (y) { return (y.nom || y.qui) + " : « " + y.texte + " »"; }).join(" / ") +
      ") qui dure " + c.duree_s + " s au total" + (r.clip ? " (il faut finir avant " + (r.clip - (r.fin || 0)) + " s)" : "") + " : garde l'échange cohérent." : "";
    at.ask("Sur la carte #" + num + ", la réplique n°" + (i + 1) + (x.nom ? " de " + x.nom : "") + " fait " + x.caracteres + " caractères avec le réglage « " + r.nom + " » (" +
      (r.min ? "minimum " + r.min + (c.lignes.length > 1 ? " pour tout l'échange" : "") + ", " : "") + "maximum " + (r.max || "∞") + " par réplique, espaces compris) : « " + texte + " »." + echange +
      " Propose une version qui tient ces limites sans changer le sens, le ton ni la personne qui parle, vérifie-la avec mesurer_replique (réglage " + r.id +
      ") puis appelle directement set_replique (carte " + num + ", index " + (i + 1) + ") : la demande d'autorisation me montrera le texte, ne me demande pas de confirmation par écrit.");
  },

  // ---------- onglet ----------
  render: function () {
    var self = this, esc = this.A.esc, r = this.get(this.current) || this.reglages[0], body = document.getElementById("rpBody");
    if (!body) return;
    var num = function (k, label, step, hint) {
      return '<div class="field"><label title="' + esc(hint || "") + '">' + label + '</label><input type="number" min="0" step="' + (step || 1) + '" data-rk="' + k + '" value="' + esc(r[k]) + '"></div>';
    };
    body.innerHTML =
      '<h2 style="margin-top:0">Calculateur de répliques</h2>' +
      '<p class="hint">Une réplique par ligne. « NOM : réplique » est accepté (le nom n\'est pas compté). Le compte se fait sur ce que la voix dira vraiment, espaces compris.</p>' +
      '<div class="row-inline"><select id="rpPreset">' + this.reglages.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === r.id ? " selected" : "") + '>' + esc(x.nom) + '</option>'; }).join("") + '</select>' +
      '<button class="small-btn" data-rp="new">+ Nouveau réglage</button><button class="small-btn" data-rp="copy">📋 Copier le résultat</button></div>' +
      '<details class="more-opts"><summary>Réglage « ' + esc(r.nom) + ' » (modifiable)</summary>' +
      '<div class="field"><label>Nom</label><input type="text" data-rk="nom" value="' + esc(r.nom) + '"></div><div class="grid3">' +
      num("min", "Caractères minimum", 1, "0 = pas de minimum") + num("max", "Caractères maximum", 1, "0 = pas de maximum") +
      num("cps", "Caractères par seconde", 0.5, "vitesse de la voix, espaces compris") + num("pause", "Pause entre phrases (s)", 0.05) + num("tour", "Pause entre interlocuteurs (s)", 0.05, "quand un autre personnage répond") +
      num("phrase", "Caractères max par phrase", 1, "0 = pas de limite") + num("clip", "Durée de la vidéo (s)", 1, "0 = pas de vidéo imposée") +
      num("fin", "Secondes gardées après la parole", 0.5, "carton de fin, silence…") + '</div>' +
      '<label class="inline"><input type="checkbox" data-rk="virgules"' + (r.virgules ? " checked" : "") + '> La voix enchaîne d\'une traite (points internes → virgules)</label>' +
      '<div class="field"><label>Note</label><input type="text" data-rk="note" value="' + esc(r.note || "") + '"></div>' +
      '<div class="refs-block" style="margin:8px 0"><b>Calibrer la vitesse</b><p class="hint" style="margin:2px 0 6px">Mettez en 1re ligne une réplique déjà générée, mesurez dans la vidéo le temps entre le premier et le dernier mot, puis :</p>' +
      '<div class="row-inline"><label class="inline">Durée réelle de la 1re réplique <input type="number" class="mini" min="0.5" step="0.1" id="rpReal"> s</label><button class="small-btn" data-rp="calib">Calibrer</button></div></div>' +
      '<div class="row-inline"><button class="primary-btn" data-rp="save">Enregistrer le réglage</button>' +
      (this.DEFAULTS.some(function (d) { return d.id === r.id; }) ? '<button class="small-btn" data-rp="reset">Valeurs d\'origine</button>' : '<button class="small-btn" data-rp="del">Retirer ce réglage</button>') + '</div></details>' +
      (r.note ? '<p class="hint">' + esc(r.note) + '</p>' : '') +
      '<textarea id="rpText" rows="8" placeholder="Ton accroche reste trop vague ? Alors le spectateur ne se sentira pas concerné…&#10;LÉA : Tu l\'as vu partir ?">' + esc(this.text) + '</textarea>' +
      '<div id="rpOut"></div>';
    this.renderOut();
    var ta = document.getElementById("rpText");
    ta.addEventListener("input", function () { self.text = ta.value; self.renderOut(); clearTimeout(self._t); self._t = setTimeout(function () { self.core.store.setKV(self.TEXT_KEY, self.text); }, 500); });
    document.getElementById("rpPreset").addEventListener("change", function () { self.current = this.value; self.save(); self.render(); });
    Array.prototype.forEach.call(body.querySelectorAll("[data-rk]"), function (el) {
      el.addEventListener("input", function () {
        var k = el.getAttribute("data-rk");
        r[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? (parseFloat(el.value) || 0) : el.value;
        self.renderOut();
      });
    });
    Array.prototype.forEach.call(body.querySelectorAll("[data-rp]"), function (b) {
      b.addEventListener("click", function () { self.action(b.getAttribute("data-rp"), b); });
    });
  },
  renderOut: function () {
    var esc = this.A.esc, el = document.getElementById("rpOut"); if (!el) return;
    var m = this.mesurer(this.text), r = this.get(this.current);
    if (!m.repliques.length) { el.innerHTML = '<p class="hint">Collez une réplique pour la mesurer.</p>'; return; }
    var color = { ok: "#3fb950", court: "#d29922", long: "#f85149" }, label = { ok: "✅ Bon", court: "⬆ Trop court", long: "⬇ Trop long" };
    // une fiche par réplique (lisible aussi sur un écran étroit)
    el.innerHTML = m.repliques.map(function (x, i) {
      var bar = r.max ? Math.min(100, Math.round(x.caracteres / r.max * 100)) : 0;
      var chip = function (v, t) { return '<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.07);font-size:12px">' + v + ' ' + t + '</span>'; };
      return '<div style="margin-top:10px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.1);border-left:4px solid ' + color[x.statut] + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + (i + 1) + (x.nom ? ' · ' + esc(x.nom) : '') + '</b>' +
        '<span style="color:' + color[x.statut] + ';font-weight:600">' + label[x.statut] + '</span></div>' +
        '<div style="margin:6px 0">' + esc(x.dit) + '</div>' +
        '<div>' + chip('<b>' + x.caracteres + '</b>', 'caractères' + (r.min || r.max ? ' (' + (r.min || 0) + '–' + (r.max || '∞') + ')' : '')) + chip(x.sans_espaces, 'sans espaces') +
        chip(x.mots, 'mots') + chip(x.duree_s, 's') + chip(x.phrases, 'phrase' + (x.phrases > 1 ? 's' : '')) + '</div>' +
        (bar ? '<div style="height:4px;background:rgba(255,255,255,.08);border-radius:2px;margin-top:6px"><div style="height:4px;width:' + bar + '%;background:' + color[x.statut] + ';border-radius:2px"></div></div>' : '') +
        (x.alertes.length ? '<div class="hint" style="margin:6px 0 0">' + x.alertes.map(esc).join('<br>') + '</div>' : '') + '</div>';
    }).join("") + (m.repliques.length > 1 ? '<p class="hint">Durée totale : ' + m.duree_totale_s + ' s</p>' : '');
  },
  action: function (a, btn) {
    var self = this, r = this.get(this.current);
    if (a === "save") { this.save(); this.render(); this.core.toast("Réglage enregistré : " + r.nom, "ok"); }
    if (a === "reset") { var d = this.DEFAULTS.find(function (x) { return x.id === r.id; }); Object.assign(r, d); this.save(); this.render(); }
    if (a === "del" && window.confirm("Retirer le réglage « " + r.nom + " » ?")) { this.reglages = this.reglages.filter(function (x) { return x !== r; }); this.current = "anthony"; this.save(); this.render(); }
    if (a === "new") {
      var n = Object.assign({}, r, { id: "perso-" + Date.now().toString(36), nom: r.nom + " (copie)", note: "" });
      this.reglages.push(n); this.current = n.id; this.save(); this.render();
    }
    if (a === "calib") {
      var reel = parseFloat((document.getElementById("rpReal") || {}).value), first = this.mesurer(this.text).repliques[0];
      if (!first || !(reel > 0)) { this.core.toast("Mettez une réplique en 1re ligne et sa durée réelle en secondes.", "err"); return; }
      var parole = reel - r.pause * Math.max(0, first.phrases - 1);
      if (parole <= 0) { this.core.toast("Durée trop courte pour cette réplique.", "err"); return; }
      r.cps = Math.round(first.caracteres / parole * 10) / 10;
      r.note = "Calibré le " + new Date().toLocaleDateString("fr-FR") + " : " + first.caracteres + " caractères dits en " + reel + " s → " + r.cps + " car./s.";
      this.save(); this.render(); this.core.toast("Vitesse calibrée : " + r.cps + " caractères par seconde.", "ok");
    }
    if (a === "copy") {
      var t = this.resume(this.text);
      var done = function () { var o = btn.textContent; btn.textContent = "✓ Copié"; setTimeout(function () { btn.textContent = o; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { window.prompt("Copiez :", t); });
      else window.prompt("Copiez :", t);
    }
  }
});
