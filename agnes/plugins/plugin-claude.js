// plugins/plugin-claude.js — « Piloté par Claude » : Agnes exécute les commandes déposées au pont local (prod-fruits)
// par Claude Code (commande agnes.py). Désactivé par défaut : ⚙ → Piloté par Claude.
// Rien n'est supprimé par une commande. Les demandes d'autorisation du Chef de l'Atelier restent des autorisations :
// Claude ne répond « oui » que si vous le lui avez demandé dans la conversation.
//
// Actions (args entre accolades) :
//   etat · projets · ouvrir_projet {projet} · creer_projet {nom} · storyboard
//   lot {script, lancer?} · plans {plans:[{plan, image_prompt?, video_prompt?}]} · generer {plans?:[n]|"tous", etape?}
//   moteurs {image?, video?} · chef {message} · autoriser {reponse:"oui"|"non"} · agent {agent, demande}
//   sortie_agent {agent} · exporter_prises {plans?, dossier?}
AgnesPlugins.register("claude", {
  name: "Piloté par Claude",
  version: "1.0",

  init: function (core) {
    var self = this;
    this.core = core; this.A = window.AgnesApp;
    this.cfg = core.pluginSettings("claude", { actif: false });
    this.busy = false;
    this.renderSettings();
    this.badge = core.ui.addToolbarButton("storyboard", "", function () { self.toggle(); });
    this.refresh();
    // Horloge dans un worker (non ralentie en arrière-plan), sinon minuteries classiques
    this.timers = {}; this.tid = 0;
    try {
      this.worker = new Worker("plugins/claude-horloge.js");
      this.worker.onmessage = function (e) { var f = self.timers[e.data.id]; delete self.timers[e.data.id]; if (f) f(); };
    } catch (e) { this.worker = null; }
    (function loop() { self.tick(); self.sleep(3000).then(loop); })();
  },

  pont: function () { var m = AgnesPlugins.get("moteurs"); return (m && m.cfg && m.cfg.pont) || "http://127.0.0.1:8177"; },
  toggle: function () { this.busy = false; this.cfg.actif = !this.cfg.actif; this.cfg.save(); this.refresh(); this.core.toast(this.cfg.actif ? "Agnes écoute les commandes de Claude (pont local)." : "Commandes de Claude désactivées.", "ok"); },
  refresh: function () {
    if (this.badge) { this.badge.textContent = "🤖 Claude : " + (this.cfg.actif ? "actif" : "off"); this.badge.title = "Agnes exécute les commandes de Claude déposées au pont local"; }
    var c = document.getElementById("clActif"); if (c) c.checked = !!this.cfg.actif;
  },
  renderSettings: function () {
    var self = this, host = document.getElementById("extensionsList"); host = host && host.closest(".card");
    if (!host || document.getElementById("clCard")) return;
    var card = document.createElement("div"); card.className = "card"; card.id = "clCard";
    card.innerHTML = '<h3>Piloté par Claude</h3><label class="inline"><input type="checkbox" id="clActif"> Exécuter les commandes de Claude déposées au pont local</label>' +
      '<p class="hint">Claude Code (conversation) peut alors lire l\'état, remplir Le lot, écrire les prompts des cartes, lancer les générations, parler au Chef de l\'Atelier et exporter les prises pour les contrôler. Aucune suppression. Le pont (<code>lancer_pont.bat</code>) doit être lancé ; adresse : celle des Moteurs.</p>';
    host.parentNode.insertBefore(card, host);
    card.querySelector("#clActif").addEventListener("change", function (e) { self.cfg.actif = e.target.checked; self.cfg.save(); self.refresh(); });
  },

  tick: function () {
    var self = this;
    if (!this.cfg.actif || this.busy || !this.A.ready) return;
    this.busy = true;
    fetch(this.pont() + "/agnes/prendre").then(function (r) { return r.json(); }).then(function (j) {
      var c = j && j.commande; if (!c) return;
      return Promise.resolve().then(function () { return self.run(c.action, c.args || {}); })
        .then(function (res) { return { ok: true, resultat: res }; }, function (e) { return { ok: false, erreur: (e && (e.display || e.message)) || String(e) }; })
        .then(function (out) {
          return fetch(self.pont() + "/agnes/fini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ id: c.id }, out)) });
        });
    }).catch(function () { }).then(function () { self.busy = false; });
  },

  // ---- Outils ----
  atelier: function () { var P = AgnesPlugins.get("atelier"); if (!P || !P.project) throw new Error("extension Atelier IA inactive (⚙ → Extensions)"); return P; },
  shotByNum: function (n) { var s = this.A.sortedShots()[(+n || 0) - 1]; if (!s) throw new Error("plan " + n + " introuvable"); return s; },
  pick: function (plans) {
    var A = this.A, all = A.sortedShots();
    if (!plans || plans === "tous") return all;
    return (Array.isArray(plans) ? plans : String(plans).split(",")).map(function (n) { return all[(+n || 0) - 1]; }).filter(Boolean);
  },
  sleep: function (ms) {
    var self = this;
    return new Promise(function (r) {
      if (!self.worker) return setTimeout(r, ms);
      // Filet de sécurité : si le worker ne répond pas (bloqué, non chargé), l'horloge classique prend le relais
      var id = ++self.tid, done = false, fin = function () { if (!done) { done = true; delete self.timers[id]; r(); } };
      self.timers[id] = fin; self.worker.postMessage({ id: id, ms: ms });
      setTimeout(function () { if (!done) { self.worker = null; fin(); } }, ms + 5000);
    });
  },
  engine: function (t) { return t ? (this.A.engineOf(t) || "importé") : null; },

  etat: function () {
    var A = this.A, self = this, p = A.getProject(), m = AgnesPlugins.get("moteurs"), P = AgnesPlugins.get("atelier");
    var plans = A.sortedShots(p).map(function (s, i) {
      var t = A.selectedTake(s), k = A.keyTake(s);
      return { n: i + 1, mode: A.MODE_LABEL(s), statut: s.status, erreur: s.errorMsg || undefined,
        image: k ? self.engine(k) : undefined, rendu: t ? t.kind + " · " + self.engine(t) + (t.local ? "" : " · en ligne seulement" + (t.remoteUrl ? " (" + String(t.remoteUrl).split("/")[2] + ")" : "")) : null, prises: (s.takes || []).length,
        prompt: String(s.imagePrompt || s.prompt || "").slice(0, 90) };
    });
    var st = P && P.project && P.project();
    return {
      projet: p.name, projets: Object.keys(A.db.projects).map(function (id) { return A.db.projects[id].name; }),
      moteurs: m ? { image: m.cfg.image, video: m.cfg.video } : null,
      file: { en_cours: A.jobs.filter(function (j) { return j.status === "running"; }).length, en_attente: A.jobs.filter(function (j) { return j.status === "waiting"; }).length },
      plans: plans,
      atelier: st ? { attente_autorisation: P.pending ? P.describe(P.pending.call) : null,
        agents_faits: P.ordered().filter(function (a) { return st.outputs[a.id] && st.outputs[a.id].text; }).map(function (a) { return a.num + ". " + a.name; }) } : null
    };
  },

  chefSince: function (P, from) {
    var st = P.project(), out = [];
    st.chat.slice(from).forEach(function (m) {
      if (m.role === "user") return;
      if (m.role === "tool") { out.push("↳ " + String(m.content).slice(0, 300)); return; }
      if (m.content) out.push((m.agent ? "[" + (P.agent(m.agent) || {}).name + "] " : "[Chef] ") + m.content);
      (m.tool_calls || []).forEach(function (c) {
        var a = c.function.arguments; if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = {}; } }
        out.push("⚙ " + P.describe({ name: c.function.name, args: a }));
      });
    });
    return { messages: out, attente_autorisation: P.pending ? P.describe(P.pending.call) : null };
  },
  waitChef: function (P) {
    var self = this, t0 = Date.now(), calm = 0;
    function loop() {
      if (Date.now() - t0 > 15 * 60000) return Promise.resolve();
      return self.sleep(1000).then(function () { calm = P.busy ? 0 : calm + 1; if (P.pending || calm >= 3) return; return loop(); });
    }
    return loop();
  },

  run: function (action, a) {
    var self = this, A = this.A, core = this.core;
    switch (action) {
      case "etat": return this.etat();
      case "projets": return Object.keys(A.db.projects).map(function (id) { var p = A.db.projects[id]; return { id: id, nom: p.name, plans: p.shots.length, actuel: id === A.db.currentProjectId }; });
      case "ouvrir_projet": {
        var q = String(a.projet || "").toLowerCase(), id = Object.keys(A.db.projects).find(function (k) { return k === a.projet || A.db.projects[k].name.toLowerCase() === q; });
        if (!id) throw new Error("projet « " + a.projet + " » introuvable");
        core.openProject(id); return "Projet ouvert : " + A.db.projects[id].name;
      }
      case "creer_projet": {
        var np = A.newProject(String(a.nom || "Nouveau projet")); A.db.projects[np.id] = np; core.openProject(np.id);
        return "Projet créé et ouvert : " + np.name;
      }
      case "storyboard": return this.atelier().storyboardText();
      case "plans": {
        // Prompts (facultatifs) + réglages de carte : format, duree (s), variantes, tenue (standard|anchor|refs), mouvement (subtle|moderate|free)
        var withText = (a.plans || []).filter(function (x) { return x.image_prompt || x.video_prompt; });
        var msg = withText.length ? this.atelier().applyPlans(withText.map(function (x) { return { plan: x.plan, image: x.image_prompt, video: x.video_prompt }; })) : "";
        var tuned = [];
        (a.plans || []).forEach(function (x) {
          var s = self.shotByNum(x.plan), two = A.isTwoStep(s) || s.mode === "t2v";
          if (x.format) s.aspect = String(x.format);
          if (x.duree) s.duration = A.clamp(x.duree, 1, 30);
          if (x.variantes) { if (two) s.keyOutputs = A.clamp(x.variantes, 1, 4); else s.outputs = A.clamp(x.variantes, 1, 4); }
          if (x.tenue) s.i2v = x.tenue;
          if (x.mouvement) s.motion = x.mouvement;
          if (x.verrou !== undefined) s.lock = !!x.verrou;
          if (x.format || x.duree || x.variantes || x.tenue || x.mouvement || x.verrou !== undefined) tuned.push(x.plan);
        });
        if (tuned.length) { A.touch(); A.renderShots(); }
        return [msg, tuned.length ? "Réglages appliqués aux cartes " + tuned.join(", ") + "." : ""].filter(Boolean).join(" ");
      }
      case "moteurs": {
        var m = AgnesPlugins.get("moteurs"); if (!m) throw new Error("extension Moteurs inactive");
        if (a.image) m.cfg.image = a.image;
        if (a.video) { if (a.video === "grok" && !m.canGrok()) throw new Error("Grok indisponible : Agnes n'est pas ouverte depuis Lumina"); m.cfg.video = a.video; }
        m.cfg.save(); m.refresh(); return { image: m.cfg.image, video: m.cfg.video };
      }
      case "generer": {
        var list = this.pick(a.plans), n = 0;
        list.forEach(function (s) { var j = a.etape ? A.enqueueStage(s, a.etape) : A.enqueueShot(s); if (j) n++; });
        if (!n && list.length) throw new Error("rien lancé (clé Agnes manquante pour ce moteur ?)");
        return n + " plan(s) mis en file" + (a.etape ? " (étape " + a.etape + ")" : "") + ".";
      }
      case "lot": return this.lot(a);
      case "chef": {
        var P = this.atelier(), st = P.project();
        if (P.pending) throw new Error("une autorisation est en attente : " + P.describe(P.pending.call) + " — commande autoriser d'abord");
        var from = st.chat.length;
        st.chat.push({ role: "user", content: String(a.message || "") }); core.saveProject(); P.renderChat(); P.managerStep(0);
        return this.waitChef(P).then(function () { return self.chefSince(P, from); });
      }
      case "autoriser": {
        var P2 = this.atelier(), st2 = P2.project();
        if (!P2.pending) throw new Error("aucune autorisation en attente");
        var from2 = st2.chat.length, what = P2.describe(P2.pending.call);
        P2.resolvePending(a.reponse === true || /^(oui|yes|o|y|true)$/i.test(String(a.reponse || "")) ? "yes" : "no");
        return this.waitChef(P2).then(function () { var r = self.chefSince(P2, from2); r.decision = what; return r; });
      }
      case "agent": {
        var P3 = this.atelier(), ag = P3.agent(a.agent) || P3.agents.find(function (x) { return x.num === String(a.agent); });
        if (!ag) throw new Error("agent « " + a.agent + " » introuvable");
        return P3.runAgent(ag.id, a.demande || "").then(function (t) { return { agent: ag.num + ". " + ag.name, sortie: t.slice(0, 20000) }; });
      }
      case "sortie_agent": {
        var P4 = this.atelier(), ag2 = P4.agent(a.agent) || P4.agents.find(function (x) { return x.num === String(a.agent); });
        if (!ag2) throw new Error("agent « " + a.agent + " » introuvable");
        return { agent: ag2.num + ". " + ag2.name, sortie: P4.outputOf(ag2.id).slice(0, 20000) };
      }
      case "importer_image": {
        // Image du disque (servie par le pont : dossier du pont ou dossier de sortie) → Bibliothèque
        var kinds = ["personnage", "decor", "objet", "style", "autre"], kd2 = kinds.indexOf(a.type) !== -1 ? a.type : "style";
        if (!a.chemin || !a.nom) throw new Error("chemin et nom obligatoires");
        var ex = A.getProject().library.find(function (l) { return l.name.toLowerCase() === String(a.nom).toLowerCase(); });
        if (ex && !a.remplacer) throw new Error("« " + a.nom + " » existe déjà dans la Bibliothèque (remplacer=true pour changer son image)");
        return fetch(this.pont() + "/file?path=" + encodeURIComponent(a.chemin)).then(function (r) {
          if (!r.ok) throw new Error("image introuvable via le pont : " + a.chemin);
          return r.blob();
        }).then(function (b) {
          if (!ex) return core.addToLibrary(b, { name: String(a.nom), kind: kd2 }).then(function (it) { return "« " + it.name + " » importé dans la Bibliothèque (" + kd2 + ")."; });
          // Même nom, même identifiant : les cartes qui la citent suivent automatiquement
          return AgnesStore.putBlob("lib:" + ex.id, b).then(function () { return A.makeThumb(b, 320); }).then(function (th) {
            ex.thumb = th; ex.publicUrl = ""; ex.kind = kd2; if (A.forgetUrl) A.forgetUrl("lib:" + ex.id); A.touch(); A.render();
            return "« " + ex.name + " » : image remplacée dans la Bibliothèque.";
          });
        });
      }
      case "choisir_prise": {
        // prise=N (numéro dans la liste des prises) ou image=N (variante de l'image de départ)
        var sc = this.shotByNum(a.plan);
        if (a.image) { var kt = (sc.keyTakes || [])[(+a.image || 0) - 1]; if (!kt) throw new Error("variante d'image " + a.image + " introuvable"); sc.keyTakeId = kt.id; }
        else { var tt = (sc.takes || [])[(+a.prise || 0) - 1]; if (!tt) throw new Error("prise " + a.prise + " introuvable (" + (sc.takes || []).length + " prise(s))"); sc.selectedTakeId = tt.id; if (sc.status !== "done") sc.status = "done"; }
        A.touch(); A.renderShots(); return "Carte " + a.plan + " : " + (a.image ? "image " + a.image : "prise " + a.prise) + " choisie.";
      }
      case "vider_file": {
        // Annule tout ce qui attend ou tourne (aucune carte ni prise supprimée)
        var act = A.jobs.filter(function (j) { return j.status === "waiting" || j.status === "running"; });
        act.forEach(function (j) { A.cancelJob(j); });
        return act.length ? act.length + " tâche(s) annulée(s) dans la file." : "File déjà vide.";
      }
      case "installer_pack": {
        // Pack de skills prêt à l'emploi (Skills → Packs) : france, spatial, styles… ; les skills déjà présents sont gardés
        var pk = (A.SKILL_PACKS || []).find(function (p) { return p.id === a.pack; });
        if (!pk) throw new Error("pack inconnu : " + a.pack + " (" + (A.SKILL_PACKS || []).map(function (p) { return p.id; }).join(", ") + ")");
        var added = 0;
        pk.skills.forEach(function (sk) { if (!A.db.skills.some(function (x) { return x.id === sk.id; })) { A.db.skills.push(JSON.parse(JSON.stringify(sk))); added++; } });
        A.saveDB(true); if (A.refreshPickers) A.refreshPickers(); A.renderShots();
        return "Pack « " + pk.title + " » : " + added + " skill(s) ajouté(s), " + (pk.skills.length - added) + " déjà présent(s).";
      }
      case "exporter_prises": return this.exporter(a);
      case "vers_bibliotheque": {
        // Image choisie d'un plan (image validée, sinon prise image) → Bibliothèque, sous un nom (planche de personnage…)
        var sv = this.shotByNum(a.plan), tk = A.keyTake(sv) || A.selectedTake(sv);
        if (!tk || tk.kind !== "image") throw new Error("le plan " + a.plan + " n'a pas d'image");
        var KINDS = ["personnage", "decor", "objet", "style", "autre"], kd = KINDS.indexOf(a.type) !== -1 ? a.type : "personnage";
        return A.getTakeBlobOrFetch(tk).then(function (b) {
          if (!b) throw new Error("fichier de l'image introuvable");
          var old = A.getProject().library.find(function (l) { return l.name.toLowerCase() === String(a.nom || "").toLowerCase(); });
          if (old && !a.remplacer) throw new Error("« " + old.name + " » existe déjà dans la Bibliothèque (remplacer=true pour changer son image)");
          if (old) {   // même nom, même identifiant : les cartes qui la citent suivent automatiquement
            return AgnesStore.putBlob("lib:" + old.id, b).then(function () { return A.makeThumb(b, 320); }).then(function (th) {
              old.thumb = th; old.publicUrl = ""; old.kind = kd; if (A.forgetUrl) A.forgetUrl("lib:" + old.id); A.touch(); A.render(); return old;
            }).then(function (it) { return "« " + it.name + " » : image remplacée dans la Bibliothèque."; });
          }
          return core.addToLibrary(b, { name: String(a.nom || "Référence"), kind: kd }).then(function (it) { return "« " + it.name + " » ajouté à la Bibliothèque (" + kd + ")."; });
        });
      }
    }
    throw new Error("action inconnue : " + action);
  },

  // Le lot : script numéroté → cartes (sans lancer les générations, sauf lancer: true)
  lot: function (a) {
    var self = this, A = this.A, P = this.atelier(), before = A.getProject().shots.length;
    P.toLot(String(a.script || ""));
    var run = document.getElementById("batchRunNow"), btn = document.getElementById("batchCreateBtn");
    if (!btn) throw new Error("onglet Le lot introuvable");
    if (run) run.checked = !!a.lancer;
    var conf = window.confirm; window.confirm = function () { return true; };
    return this.sleep(400).then(function () {
      btn.click();
      var t0 = Date.now();
      function loop() {
        return self.sleep(500).then(function () { if (!btn.disabled || Date.now() - t0 > 120000) return; return loop(); });
      }
      return loop();
    }).then(function () {
      var n = A.getProject().shots.length - before;
      A.showView("viewStoryboard");
      return n + " carte(s) créée(s) dans le Storyboard (plans " + (before + 1) + " à " + (before + n) + ")" + (a.lancer ? ", générations lancées." : ".");
    }).finally(function () { window.confirm = conf; });
  },

  // Enregistre les prises choisies (et images validées) dans prod-fruits/agnes/<projet>/ via le pont, pour contrôle
  exporter: function (a) {
    var self = this, A = this.A, p = A.getProject(), all = A.sortedShots(p), list = this.pick(a.plans), done = [], echecs = [];
    var slug = String(a.dossier || p.name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projet";
    var ext = function (b, t) { var ty = (b && b.type) || ""; return /png/.test(ty) ? "png" : /jpe?g/.test(ty) ? "jpg" : /webp/.test(ty) ? "webp" : /webm/.test(ty) ? "webm" : t.kind === "video" ? "mp4" : "png"; };
    return list.reduce(function (chain, s) {
      var n = String(all.indexOf(s) + 1).padStart(2, "0"), items = [];
      var k = A.keyTake(s), t = A.selectedTake(s);
      if (a.toutes) {   // toutes les variantes : images de départ (v1, v2…) puis prises (p1, p2…)
        (s.keyTakes || []).forEach(function (x, i) { items.push({ t: x, nom: n + "-image-v" + (i + 1) + (k && x.id === k.id ? "-choisie" : "") }); });
        (s.takes || []).forEach(function (x, i) { items.push({ t: x, nom: n + "-prise-p" + (i + 1) + (t && x.id === t.id ? "-choisie" : "") }); });
      } else {
        if (k) items.push({ t: k, nom: n + "-image" });
        if (t) items.push({ t: t, nom: n + "-" + (t.kind === "video" ? "video" : "rendu") });
      }
      return items.reduce(function (c2, it) {
        return c2.then(function () { return A.getTakeBlobOrFetch(it.t); }).then(function (b) {
          if (!b) { echecs.push(it.nom + " : fichier introuvable (local=" + !!it.t.local + ", en ligne=" + !!it.t.remoteUrl + ")"); return; }
          var path = "agnes/" + slug + "/" + it.nom + "-" + (self.engine(it.t) || "").toLowerCase() + "." + ext(b, it.t);
          return fetch(self.pont() + "/save", { method: "POST", headers: { "X-Save-Path": encodeURIComponent(path), "Content-Type": b.type || "application/octet-stream" }, body: b })
            .then(function (r) { return r.json(); }).then(function (j) { if (j.saved) done.push(j.saved); else echecs.push(it.nom + " : " + (j.error || "refusé par le pont")); });
        }).catch(function (e) { echecs.push(it.nom + " : " + ((e && e.message) || e)); });
      }, chain);
    }, Promise.resolve()).then(function () { return echecs.length ? { fichiers: done, echecs: echecs } : { fichiers: done }; });
  }
});
