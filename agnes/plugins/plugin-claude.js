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
//   Montage (01/10, étape 5 ; extension Montage, mêmes fonctions que ses boutons) :
//   etat_montage · modeles_montage · monter {cartes?|"tous", modele?, reglages?, resserrer?, karaoke?, appel?}
//   compiler {cartes?|"tous", transition? (cut|fondu|noir), duree_transition?, nom?, remplacer?}
//   episode {lufs? (-14|-16|-23), karaoke?, carton?, sous_texte?, nom?, remplacer?} : plans de l'Assemblage rendus par le pont
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
  montage: function () {
    var M = AgnesPlugins.isLoaded && AgnesPlugins.isLoaded("montage") ? AgnesPlugins.get("montage") : null;
    if (!M || !M.monterCartes) throw new Error("extension Montage inactive (⚙ → Extensions)");
    return M;
  },
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
  // 02/10 — extension chargée ou null
  ext: function (id) { var P = window.AgnesPlugins; return P && P.isLoaded && P.isLoaded(id) ? P.get(id) : null; },
  // 02/10 — fichier du disque via le pont : sous Production → /classement/lire (lecture seule), sinon /file (prod-fruits, sortie)
  blobDu: function (chemin) {
    var c = String(chemin || "").replace(/\\/g, "/"), i = c.toLowerCase().lastIndexOf("/production/");
    var url = i !== -1 ? this.pont() + "/classement/lire?chemin=" + encodeURIComponent(c.slice(i + 12)) : this.pont() + "/file?path=" + encodeURIComponent(c);
    return fetch(url).then(function (r) { return r.ok ? r.blob() : null; }, function () { return null; });
  },

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
      case "extensions": return A.extensionsEtat ? A.extensionsEtat() : "état des extensions indisponible (Agnes à recharger)";   // 02/10
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
        // Prompts (facultatifs) + réglages de carte : format, duree (s), variantes, tenue (standard|anchor|refs), mouvement (subtle|moderate|free),
        // intermediaire (nom d'une image de la Bibliothèque : rôle Grok « Image intermédiaire »)
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
          if (x.intermediaire !== undefined) {   // nom d'une image de la Bibliothèque (rôle Grok « Image intermédiaire »), "" = aucune
            var li = x.intermediaire ? A.getProject().library.find(function (l) { return l.name.toLowerCase() === String(x.intermediaire).toLowerCase(); }) : null;
            if (x.intermediaire && !li) throw new Error("image « " + x.intermediaire + " » introuvable dans la Bibliothèque");
            s.midRef = li ? li.id : "";
          }
          if (x.format || x.duree || x.variantes || x.tenue || x.mouvement || x.verrou !== undefined || x.intermediaire !== undefined) tuned.push(x.plan);
        });
        if (tuned.length) { A.touch(); A.renderShots(); }
        return [msg, tuned.length ? "Réglages appliqués aux cartes " + tuned.join(", ") + "." : ""].filter(Boolean).join(" ");
      }
      case "moteurs": {
        var m = AgnesPlugins.get("moteurs"); if (!m) throw new Error("extension Moteurs inactive");
        if (a.image) m.cfg.image = a.image;
        if (a.video) {
          if (m.VIDEOS.indexOf(a.video) === -1) throw new Error("moteur vidéo inconnu : " + a.video + " (agnes, grok ou flow)");
          if (a.video !== "agnes" && !m.canGrok()) throw new Error(m.shortName(a.video) + " indisponible : Agnes n'est pas ouverte depuis Lumina");
          m.cfg.video = a.video;
        }
        m.cfg.save(); m.refresh(); return { image: m.cfg.image, video: m.cfg.video };
      }
      case "styles": case "style": {
        // 01/10 — Styles de prompt : liste, style du projet ; style nom="Cartoon / satire" (ou id) le choisit pour le projet
        var P5 = window.AgnesPlugins, St = P5 && P5.isLoaded && P5.isLoaded("styles") ? P5.get("styles") : null;
        if (!St) throw new Error("extension Styles de prompt inactive (⚙ → Extensions)");
        // 02/10 — retablir=oui remet les styles d'origine ; supprimer="…" retire un style ajouté (jamais un style d'origine)
        if (a.retablir) St.retablir();
        if (a.supprimer) St.supprimer(a.supprimer);
        if (a.nom) St.choisir(a.nom);
        if (a.retablir || a.supprimer) St.render();
        var cur = St.courant(), rp5 = P5.get("repliques");
        return { projet: A.getProject().name, style: cur.nom, repliques: rp5 && rp5.reglageProjet ? rp5.reglageProjet() : cur.repliques,
          styles: St.list.map(function (x) { return { id: x.id, nom: x.nom, textes_ecrits: !!x.texteEcran, musique: !!x.musique, repliques: x.repliques, actuel: x === cur }; }) };
      }
      case "avatars": case "avatar": case "avatar_prompt": case "envoyer_avatar": case "avatar_importer": {
        // 01/10 — Studio : lecture des fiches et de leurs prompts ; envoyer_avatar = le bouton « Envoyer à l'Atelier » ; aucune génération payante
        var P6 = window.AgnesPlugins, Av = P6 && P6.isLoaded && P6.isLoaded("avatar") ? P6.get("avatar") : null;
        if (!Av) throw new Error("extension Studio inactive (⚙ → Extensions)");
        if (action === "avatars") return Av.cmdListe(a.type);
        if (action === "avatar_importer") return Av.importerMaj(String(a.script || a.contenu || ""));   // 02/10 — crée ou met à jour par nom
        var ref = a.id || a.nom; if (!ref) throw new Error("précisez id=av… ou nom=\"…\"");
        return action === "avatar" ? Av.cmdFiche(ref) : action === "avatar_prompt" ? Av.cmdPrompt(ref, a.format) : Av.cmdEnvoyer(ref);
      }
      case "generer": {
        var list = this.pick(a.plans), n = 0;
        list.forEach(function (s) { var j = a.etape ? A.enqueueStage(s, a.etape) : A.enqueueShot(s); if (j) n++; });
        if (!n && list.length) throw new Error("rien lancé (clé Agnes manquante pour ce moteur ?)");
        return n + " plan(s) mis en file" + (a.etape ? " (étape " + a.etape + ")" : "") + ".";
      }
      case "lot": return this.lot(a);
      case "document": {
        // Document pour l'Atelier IA (ex. livrable de l'agent Marketing), lisible par le Chef avec get_document
        var PD = this.atelier(), nom = String(a.nom || "").trim(), texte = String(a.script || a.contenu || "");
        if (!nom || !texte.trim()) throw new Error("nom et contenu obligatoires (agnes.py document nom=… --fichier …)");
        PD.addDoc(nom, texte, "Claude", true);
        return "Document « " + nom + " » ajouté à l'Atelier IA (" + texte.length + " caractères).";
      }
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
        return this.blobDu(a.chemin).then(function (b) {   // 02/10 : aussi les images du dossier Production
          if (!b) throw new Error("image introuvable via le pont : " + a.chemin);
          return b;
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
      // Montage (étape 5) : aucune voix-off n'est générée ici ; une carte « Carton + voix-off » sans voix-off est refusée
      case "etat_montage": return this.montage().etatCartes();
      case "modeles_montage": return this.montage().listeModeles();
      case "monter": return this.montage().monterCartes(a.cartes !== undefined ? a.cartes : a.plans,
        { modele: a.modele, reglages: a.reglages, resserrer: a.resserrer, karaoke: a.karaoke, appel: a.appel });
      case "compiler": {
        var rc = {};
        ["transition", "duree_transition", "nom", "remplacer"].forEach(function (k) { if (a[k] !== undefined) rc[k] = a[k]; });
        return this.montage().compilerFinales(a.cartes !== undefined ? a.cartes : a.plans, rc);
      }
      case "episode": {
        var re = {};
        if (a.lufs !== undefined) re.ep_lufs = Number(a.lufs);
        if (a.karaoke !== undefined) re.ep_karaoke = !!a.karaoke;
        if (a.carton !== undefined) { re.ep_carton = !!a.carton; re.ep_carton_texte = a.carton === true ? "À suivre…" : String(a.carton || ""); }
        if (a.sous_texte !== undefined) re.ep_carton_sous = String(a.sous_texte);
        if (a.nom !== undefined) re.nom = String(a.nom);
        if (a.remplacer !== undefined) re.remplacer = !!a.remplacer;
        return this.montage().compilerEpisode(re);
      }
      // ===== 02/10 — Commandes pour piloter Agnes de A à Z (elle a donné toutes les autorisations) =====
      case "bible": {   // lecture : séries, style commun, fiches (nom, type, auto, ADN, images)
        var Bb = this.ext("bible"); if (!Bb) throw new Error("extension Bible inactive (agnes.py extension cle=bible actif=oui)");
        var sb = Bb.series(), q = String(a.type || "").toLowerCase();
        if (!sb) return { projet: A.getProject().name, serie: null, fiches: [] };
        return { projet: A.getProject().name, serie: sb.name, style_commun: sb.style || "", fiches: sb.entries.filter(function (e) { return !q || e.kind === q; }).map(function (e) {
          return { nom: e.name, type: e.kind, auto: e.auto !== false, adn: e.dna || "", note_episode: (e.byProject || {})[A.getProject().id] || "", images: (e.refs || []).length, alias: e.aliases || "" }; }) };
      }
      case "bible_maj": {   // écriture directe (comme bible_upsert du Chef) : --json '{"entries":[{"name","kind","dna","auto"}],"series_style":"…"}'
        var At2 = this.ext("atelier"); if (!At2) throw new Error("Atelier IA inactif");
        if (!this.ext("bible")) throw new Error("extension Bible inactive (agnes.py extension cle=bible actif=oui)");
        return At2.bibleUpsert(a.entries || [], a.series_style);
      }
      case "bible_image": {   // image → fiche de la Bible + Bibliothèque : fiche=av… (image validée du Studio) ou chemin=… (fichier)
        var Bi = this.ext("bible"); if (!Bi || !Bi.attacherImage) throw new Error("extension Bible inactive");
        if (!a.nom) throw new Error("nom=… (fiche de la Bible) obligatoire");
        var src = a.fiche ? this.ext("avatar").imageValidee(a.fiche) : this.blobDu(a.chemin);
        return src.then(function (b) { if (!b) throw new Error("aucune image (fiche sans image validée ou fichier introuvable)"); return Bi.attacherImage(a.nom, b); })
          .then(function (e) { return "Image rattachée à « " + e.name + " » (Bible) et rangée dans la Bibliothèque."; });
      }
      case "bibliotheque": return A.getProject().library.map(function (l) { return { nom: l.name, type: l.kind, bible: !!l.bibleId }; });
      case "extension": {   // cle=bible actif=oui|non (liste des clés : agnes.py extensions)
        var etat = A.extensionsEtat ? A.extensionsEtat() : [], ex = etat.find(function (e) { return e.cle === a.cle; });
        if (!ex) throw new Error("extension « " + a.cle + " » inconnue ; clés : " + etat.map(function (e) { return e.cle; }).join(", "));
        var box = document.querySelector('#extensionsList input[data-ext="' + a.cle + '"]');
        if (!box) throw new Error("liste des extensions introuvable");
        if (box.checked !== !!a.actif) { box.checked = !!a.actif; box.dispatchEvent(new Event("change", { bubbles: true })); }
        return this.sleep(1500).then(function () { var e2 = A.extensionsEtat().find(function (e) { return e.cle === a.cle; });
          return e2.cochee && !e2.chargee ? e2 : Object.assign(e2, { note: e2.cochee ? "activée" : "désactivée (elle disparaît complètement au prochain rechargement d'Agnes)" }); });
      }
      case "projet_reglages": {   // nom, style_base, negatif, format, resolution, duree, sorties, seed
        var pr = A.getProject(), fait = [];
        if (a.nom) { pr.name = String(a.nom); fait.push("nom"); }
        if (a.style_base !== undefined) { pr.styleGuide = String(a.style_base); fait.push("style de base"); }
        if (a.negatif !== undefined) { pr.negative = String(a.negatif); fait.push("prompt négatif"); }
        if (a.format) { pr.aspect = String(a.format); fait.push("format"); }
        if (a.resolution) { pr.resolution = String(a.resolution); fait.push("résolution"); }
        if (a.duree) { pr.duration = A.clamp(a.duree, 1, 60); fait.push("durée"); }
        if (a.sorties) { pr.outputs = A.clamp(a.sorties, 1, 4); fait.push("sorties"); }
        if (a.seed !== undefined) { pr.seed = String(a.seed); fait.push("seed"); }
        A.touch(); A.render();
        return { projet: pr.name, modifie: fait, style_base: pr.styleGuide || "", negatif: pr.negative || "", format: pr.aspect, resolution: pr.resolution, duree: pr.duration, sorties: pr.outputs };
      }
      case "supprimer_projet": {   // projet=… confirmer=oui (jamais le dernier projet)
        if (!a.confirmer) throw new Error("ajoutez confirmer=oui (suppression définitive du projet et de ses rendus)");
        var qp = String(a.projet || "").toLowerCase(), pid = Object.keys(A.db.projects).find(function (k) { return k === a.projet || A.db.projects[k].name.toLowerCase() === qp; });
        if (!pid) throw new Error("projet « " + a.projet + " » introuvable");
        if (Object.keys(A.db.projects).length <= 1) throw new Error("impossible de supprimer le dernier projet");
        var nomP = A.db.projects[pid].name;
        if (A.db.currentProjectId === pid) core.openProject(Object.keys(A.db.projects).find(function (k) { return k !== pid; }));
        A.db.projects[pid].shots.forEach(function (s) { A.deleteShot(s, A.db.projects[pid]); });
        delete A.db.projects[pid]; A.saveDB(); A.render();
        return "Projet « " + nomP + " » supprimé. Projet ouvert : " + A.getProject().name;
      }
      case "supprimer_cartes": {   // cartes=2,3 confirmer=oui
        if (!a.confirmer) throw new Error("ajoutez confirmer=oui (cartes et prises supprimées)");
        var del = this.pick(a.cartes || a.plans), pj = A.getProject();
        if (!del.length) throw new Error("aucune carte");
        del.forEach(function (s) { A.deleteShot(s, pj); }); A.touch(); A.renderShots();
        return del.length + " carte(s) supprimée(s). Il en reste " + A.sortedShots().length + ".";
      }
      case "references": {   // plan=1 noms="Anthony,Bureau" (vide = aucune) : coche les références de la Bibliothèque
        var sr = this.shotByNum(a.plan); if (!sr) throw new Error("carte " + a.plan + " introuvable");
        var lib = A.getProject().library, noms = String(a.noms || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean), manq = [];
        sr.ingredients = noms.map(function (n) { var l = lib.find(function (x) { return x.name.toLowerCase() === n.toLowerCase(); }); if (!l) manq.push(n); return l && l.id; }).filter(Boolean);
        A.touch(); A.renderShots();
        if (manq.length) throw new Error("introuvable(s) dans la Bibliothèque : " + manq.join(", ") + " (les autres sont cochées)");
        return "Carte #" + a.plan + " : références " + (noms.join(", ") || "aucune") + ".";
      }
      case "notes": {   // plan=1 texte="…" (carton de fin, réplique, description…) ; ajouter=oui pour compléter
        var sn = this.shotByNum(a.plan); if (!sn) throw new Error("carte " + a.plan + " introuvable");
        sn.notes = a.ajouter && sn.notes ? sn.notes + "\n" + String(a.texte || "") : String(a.texte || ""); A.touch(); A.renderShots();
        return "Notes de la carte #" + a.plan + " : " + sn.notes;
      }
      case "prompt_final": {   // plan=1 [etape=image|video] : prompt réellement envoyé (style du projet, Bible, skills, règles)
        var sp = this.shotByNum(a.plan); if (!sp) throw new Error("carte " + a.plan + " introuvable");
        var vue = A.isTwoStep(sp) && A.stageView ? A.stageView(sp, a.etape === "image" ? "image" : "video") : sp;
        return { carte: +a.plan, etape: a.etape || (A.isTwoStep(sp) ? "video" : A.modeKind(sp.mode)), prompt: A.buildPrompt(vue, A.getProject()) };
      }
      case "chef_historique": {   // n=10 derniers messages de la discussion avec le Chef
        var stc = this.atelier().project(), nb = +a.n || 10;
        return { en_attente: this.atelier().pending ? this.atelier().describe(this.atelier().pending.call) : null,
          messages: stc.chat.slice(-nb).map(function (m) { return { role: m.role, texte: String(m.content || "").slice(0, 1500) }; }) };
      }
      case "chef_effacer": {   // efface la discussion et une demande d'autorisation restée en attente (le travail des agents est gardé)
        var Pa = this.atelier(), stx = Pa.project(); stx.chat = []; Pa.pending = null; core.saveProject(); if (Pa.renderChat) Pa.renderChat();
        return "Discussion avec le Chef effacée (demande en attente annulée).";
      }
      case "studio_generer": {   // id|nom=… [format=9:16] (PAYANT : moteur image de ⚙ → Moteurs) : un aperçu, attendu jusqu'au bout
        var Vg = this.ext("avatar"), fg = Vg && Vg.trouver(a.id || a.nom); if (!fg) throw new Error("fiche Studio introuvable");
        if (a.format) fg.priseDeVue.format = String(a.format);
        var avant = (fg.essais || []).length;
        return Promise.resolve(Vg.generer(fg)).then(function () {
          if ((fg.essais || []).length <= avant) throw new Error("aucun aperçu produit (voir le message d'Agnes : pont, moteur, quota)");
          var e = fg.essais[fg.essais.length - 1]; return { fiche: Vg.nomDe(fg), essai: e.cle, format: e.format, moteur: e.moteur, prompt: e.prompt };
        });
      }
      case "studio_valider": {   // id|nom=… [essai=clé] (défaut : le dernier essai)
        var Vv = this.ext("avatar"), fv = Vv && Vv.trouver(a.id || a.nom); if (!fv) throw new Error("fiche Studio introuvable");
        var ess = (fv.essais || []), ch = a.essai ? ess.find(function (e) { return e.cle === a.essai; }) : ess[ess.length - 1];
        if (!ch) throw new Error("aucun essai à valider");
        fv.imageValidee = ch.cle; Vv.touch(fv); Vv.render(); return "Image validée pour « " + Vv.nomDe(fv) + " » (" + ch.cle + ").";
      }
      case "studio_image": {   // id|nom=… chemin=… : image du disque ajoutée comme essai ET validée (aucune génération)
        var Vi = this.ext("avatar"), fi = Vi && Vi.trouver(a.id || a.nom); if (!fi) throw new Error("fiche Studio introuvable");
        var cleI = "avatar:img:" + fi.id + ":" + Date.now().toString(36);
        return this.blobDu(a.chemin).then(function (b) {
          if (!b) throw new Error("fichier introuvable : " + a.chemin);
          return core.store.put(cleI, b).then(function () {
            (fi.essais = fi.essais || []).push({ cle: cleI, format: (fi.priseDeVue || {}).format || "9:16", prompt: "(image importée : " + a.chemin + ")", moteur: "fichier", date: Date.now() });
            fi.imageValidee = cleI; Vi.touch(fi); Vi.render(); return "Image importée et validée pour « " + Vi.nomDe(fi) + " ».";
          });
        });
      }
      case "outil": {
        // 02/10 — Claude utilise directement les outils d'extensions du Chef (Studio, styles, classement, voix, son,
        // étalonnage, sous-titres) : python agnes.py outil nom=voix_etat [--json '{"cartes":[1]}']
        var Po = window.AgnesPlugins, At = Po && Po.isLoaded && Po.isLoaded("atelier") ? Po.get("atelier") : null;
        if (!At || !At.outilsExtensions) throw new Error("Atelier IA inactif (⚙ → Extensions)");
        if (!a.nom) throw new Error("nom=… obligatoire (studio_fiches, style_projet, voix_etat, son_pistes, etalonnage_etat, soustitres_modeles…)");
        var argsO = Object.assign({}, a); delete argsO.nom;
        return Promise.resolve(At.outilsExtensions(String(a.nom), argsO));
      }
      case "classer": {
        // 02/10 — Classement local (Production\Thématique\…) sans fenêtre, comme le bouton Classer : cartes=1,2 ou tous
        var Pc = window.AgnesPlugins, Cl = Pc && Pc.isLoaded && Pc.isLoaded("classement") ? Pc.get("classement") : null;
        if (!Cl || !Cl.classerLocal) throw new Error("extension Classement inactive (⚙ → Extensions)");
        var lst = this.pick(a.cartes || a.plans), opt = { thematique: a.thematique, nom: a.nom, episode: a.episode, date: a.date, sujet: a.sujet };
        if (!lst.length) throw new Error("aucune carte (cartes=1,2 ou cartes=tous)");
        var resu = [];
        return lst.reduce(function (pr, s) {
          return pr.then(function () { return Cl.classerLocal(s, opt); }).then(function (r) { resu.push({ carte: A.sortedShots().indexOf(s) + 1, dossier: r.dossier, fichiers: r.fichiers }); });
        }, Promise.resolve()).then(function () { return resu; });
      }
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
