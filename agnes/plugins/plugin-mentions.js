// plugins/plugin-mentions.js — Mentions dans les prompts des cartes du Storyboard
//   @[Nom]   : personnage, lieu ou objet de la bibliothèque. Sa référence est cochée d'office sur la carte ;
//              dans le prompt envoyé, la mention devient le nom seul (les moteurs relient le nom à son image).
//   #[Skill] : skill inséré À CET ENDROIT du prompt (son action anglaise remplace la mention).
// Taper @ ou # ouvre une liste de suggestions (↑ ↓, Entrée ou Tab pour choisir, Échap pour fermer).
// Cliquer une référence (pastille) pour la cocher écrit aussi @[Nom] là où se trouvait le curseur.
AgnesPlugins.register("mentions", {
  name: "Mentions @ et #",
  version: "1.0",
  FIELDS: ["prompt", "imagePrompt"],

  init: function (core) {
    var self = this, A = window.AgnesApp;
    this.core = core; this.A = A; this.last = null; this.pop = null;
    var list = document.getElementById("shotList");
    if (!list) return;

    // Prompt final : mentions remplacées (après skills, style et Bible)
    core.addPromptFilter(function (prompt, shot, proj, kind) { return self.expand(prompt, shot, proj, kind); });
    // Références mentionnées cochées avant chaque génération
    var enqueue = A.enqueueShot;
    A.enqueueShot = function (shot, opts, proj) { self.syncRefs(shot, proj || A.getProject(), true); return enqueue.apply(A, arguments); };
    A.syncMentions = function (shot, proj) { return self.syncRefs(shot, proj || A.getProject(), false); };

    // Dernière position du curseur dans un prompt de carte
    ["keyup", "click", "select", "input", "focusin"].forEach(function (ev) {
      list.addEventListener(ev, function (e) { self.track(e.target); }, true);
    });
    list.addEventListener("input", function (e) { if (self.isField(e.target)) self.suggest(e.target); });
    list.addEventListener("change", function (e) {
      if (!self.isField(e.target)) return;
      var shot = self.shotOf(e.target);
      if (shot && self.syncRefs(shot, A.getProject(), true)) setTimeout(function () { A.touch(); A.renderShots(); }, 0);
    });
    list.addEventListener("keydown", function (e) { self.onKey(e); }, true);
    list.addEventListener("focusout", function () { setTimeout(function () { if (!self.hovering) self.close(); }, 150); });
    // Pastille de référence cochée → @[Nom] au curseur ; décochée → mentions retirées
    list.addEventListener("click", function (e) {
      var chip = e.target.closest && e.target.closest('[data-act="ingr"]'); if (!chip) return;
      var shot = self.shotOf(chip), id = chip.getAttribute("data-lib"); if (!shot) return;
      var was = (shot.ingredients || []).indexOf(id) !== -1;
      setTimeout(function () { self.afterChip(shot, id, was); }, 0);
    }, true);
    window.addEventListener("scroll", function () { self.close(); }, true);
  },

  isField: function (el) { return el && el.tagName === "TEXTAREA" && this.FIELDS.indexOf(el.getAttribute("data-f")) !== -1 && el.closest("[data-shot]"); },
  shotOf: function (el) { var c = el.closest && el.closest("[data-shot]"); return c ? this.A.findShot(c.getAttribute("data-shot")) : null; },
  track: function (el) {
    if (!this.isField(el)) return;
    this.last = { shotId: el.closest("[data-shot]").getAttribute("data-shot"), field: el.getAttribute("data-f"), pos: el.selectionEnd };
  },

  // ---- Correspondances ----
  key: function (s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  },
  libItems: function (proj) { return proj.library.filter(function (l) { return l.kind !== "source"; }); },
  findLib: function (proj, name) {
    var k = this.key(name);
    return this.libItems(proj).find(function (l) { return this.key(l.name) === k; }, this) || null;
  },
  findSkill: function (title) {
    var k = this.key(title);
    return this.A.db.skills.find(function (s) { return this.key(s.title) === k; }, this) || null;
  },
  // @[Nom avec espaces] ou @Nom ; #[Titre du skill] ou #Titre
  MENTION: /([@#])(?:\[([^\]\n]+)\]|([\p{L}\p{N}_-]+))/gu,
  mentions: function (text) {
    var out = [], m, re = new RegExp(this.MENTION.source, "gu");
    while ((m = re.exec(String(text || "")))) out.push({ type: m[1], name: (m[2] || m[3]).trim(), raw: m[0] });
    return out;
  },

  expand: function (prompt, shot, proj, kind) {
    var self = this, actions = [];
    var out = String(prompt).replace(new RegExp(this.MENTION.source, "gu"), function (raw, type, br, bare) {
      var name = (br || bare).trim();
      if (type === "@") { var it = self.findLib(proj, name); return it ? it.name : (br ? name : raw); }
      var sk = self.findSkill(name);
      if (!sk) return br ? name : raw;
      if (!(sk.target === "both" || sk.target === kind)) return "";
      actions.push(sk.action); return sk.action;
    });
    // Skill à la fois mentionné et coché sur la carte : son action n'apparaît qu'une fois (à l'endroit de la mention)
    actions.forEach(function (a) {
      var first = out.indexOf(a), again = out.indexOf(a, first + a.length);
      if (again !== -1) out = out.slice(0, again).replace(/[\s,]*$/, "") + out.slice(again + a.length);
    });
    return out.replace(/ ,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
  },

  // Coche les références mentionnées ; renvoie true si la carte a changé
  syncRefs: function (shot, proj, warn) {
    if (!shot || !proj) return false;
    var self = this, A = this.A, max = A.settings.maxRefs || 5, list = (shot.ingredients || []).slice(), changed = false, over = [];
    this.FIELDS.forEach(function (f) {
      self.mentions(shot[f]).forEach(function (m) {
        if (m.type !== "@") return;
        var it = self.findLib(proj, m.name); if (!it || list.indexOf(it.id) !== -1) return;
        if (list.length >= max) { over.push(it.name); return; }
        list.push(it.id); changed = true;
      });
    });
    if (changed) shot.ingredients = list;
    if (over.length && warn) this.core.toast("Références non jointes (maximum " + max + " par plan) : " + over.join(", ") + ". Réglable dans ⚙ → Options avancées.", "err");
    return changed;
  },

  afterChip: function (shot, id, was) {
    var A = this.A, proj = A.getProject(), item = proj.library.find(function (l) { return l.id === id; });
    if (!item) return;
    var now = (shot.ingredients || []).indexOf(id) !== -1;
    if (now && !was) {
      var two = A.isTwoStep(shot) || shot.mode === "t2v";
      var at = this.last && this.last.shotId === shot.id ? this.last : { field: two && !String(shot.prompt || "").trim() ? "imagePrompt" : "prompt", pos: null };
      var text = String(shot[at.field] || ""), pos = at.pos == null || at.pos > text.length ? text.length : at.pos;
      if (this.mentions(text).some(function (m) { return m.type === "@" && this.key(m.name) === this.key(item.name); }, this)) return;
      var before = text.slice(0, pos), after = text.slice(pos);
      var ins = (before && !/\s$/.test(before) ? " " : "") + "@[" + item.name + "]" + (/^\s/.test(after) ? "" : " ");
      shot[at.field] = before + ins + after;
      this.last = { shotId: shot.id, field: at.field, pos: (before + ins).length };
    } else if (!now && was) {
      var self = this, k = this.key(item.name);
      this.FIELDS.forEach(function (f) {
        if (!shot[f]) return;
        shot[f] = String(shot[f]).replace(new RegExp(self.MENTION.source, "gu"), function (raw, type, br, bare) {
          return type === "@" && self.key(br || bare) === k ? "" : raw;
        }).replace(/[ \t]{2,}/g, " ").replace(/ +([,.])/g, "$1").trim();
      });
    } else return;
    A.touch(); A.renderShots();
    // Position retenue AVANT focus() : le suivi du curseur (focusin) la remettrait à 0
    var back = this.last && this.last.shotId === shot.id ? { field: this.last.field, pos: this.last.pos } : null;
    var el = back && document.querySelector('[data-shot="' + shot.id + '"] textarea[data-f="' + back.field + '"]');
    if (el) { el.focus(); try { el.setSelectionRange(back.pos, back.pos); } catch (e) { } this.last = { shotId: shot.id, field: back.field, pos: back.pos }; }
  },

  // ---- Liste de suggestions ----
  suggest: function (ta) {
    var before = ta.value.slice(0, ta.selectionEnd);
    // Recherche jusqu'à 30 caractères, espaces compris (« #de face ») ; la liste se ferme quand plus rien ne correspond
    var m = before.match(/(^|[\s(,.;:«"'])([@#])(\[[^\]\n]*|[^\n@#\[\]]{0,30})$/u);
    if (!m) return this.close();
    var type = m[2], q = this.key(m[3].replace(/^\[/, "")), A = this.A, proj = A.getProject(), shot = this.shotOf(ta);
    var kind = shot ? A.modeKind(ta.getAttribute("data-f") === "imagePrompt" ? "t2i" : shot.mode) : "both";
    var items = type === "@"
      ? this.libItems(proj).map(function (l) { return { label: l.name, sub: l.kind, thumb: l.thumb, insert: l.name }; })
      : A.db.skills.filter(function (s) { return s.target === "both" || s.target === kind; })
        .map(function (s) { return { label: s.title, sub: (s.categories || [])[0] || "", insert: s.title }; });
    var self = this;
    items = items.filter(function (x) { return !q || self.key(x.label).indexOf(q) !== -1; }).slice(0, 8);
    if (!items.length) return this.close();
    this.state = { ta: ta, type: type, start: before.length - m[2].length - m[3].length, items: items, i: 0 };
    this.render();
  },
  render: function () {
    var self = this, st = this.state, A = this.A;
    if (!this.pop) {
      this.pop = document.createElement("div");
      this.pop.setAttribute("role", "listbox");
      this.pop.style.cssText = "position:fixed;z-index:9999;min-width:220px;max-width:340px;background:var(--bg-1,#0c0d0f);border:1px solid var(--edge,#333);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);padding:4px;font:13px var(--sans,sans-serif);color:var(--text,#eee)";
      this.pop.addEventListener("mouseenter", function () { self.hovering = true; });
      this.pop.addEventListener("mouseleave", function () { self.hovering = false; });
      this.pop.addEventListener("mousedown", function (e) {
        var row = e.target.closest("[data-i]"); if (!row) return;
        e.preventDefault(); self.state.i = +row.getAttribute("data-i"); self.choose();
      });
      document.body.appendChild(this.pop);
    }
    this.pop.innerHTML = '<div style="padding:4px 8px;color:var(--text-dim,#999);font-size:11px">' + (st.type === "@" ? "Personnage, lieu, objet (@)" : "Skill à insérer ici (#)") + '</div>' +
      st.items.map(function (x, i) {
        return '<div data-i="' + i + '" role="option" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;cursor:pointer;' + (i === st.i ? "background:var(--glass-strong,#222);" : "") + '">' +
          (x.thumb ? '<img src="' + x.thumb + '" alt="" style="width:26px;height:26px;object-fit:cover;border-radius:6px">' : '<span style="width:26px;text-align:center">' + st.type + '</span>') +
          '<span style="flex:1">' + A.esc(x.label) + '</span><span style="color:var(--text-dim,#999);font-size:11px">' + A.esc(x.sub || "") + '</span></div>';
      }).join("");
    var c = this.caret(st.ta), h = this.pop.offsetHeight, top = c.y + 6 + h > window.innerHeight ? c.y - c.h - h - 4 : c.y + 6;
    this.pop.style.left = Math.max(8, Math.min(c.x, window.innerWidth - this.pop.offsetWidth - 8)) + "px";
    this.pop.style.top = Math.max(8, top) + "px";
    this.pop.style.display = "block";
  },
  // Position à l'écran du curseur d'une zone de texte (copie invisible de la zone)
  caret: function (ta) {
    var cs = getComputedStyle(ta), m = document.createElement("div"), r = ta.getBoundingClientRect();
    ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "padding", "border", "boxSizing", "whiteSpace", "wordWrap", "width"].forEach(function (p) { m.style[p] = cs[p]; });
    m.style.cssText += ";position:fixed;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;left:" + r.left + "px;top:" + r.top + "px";
    m.textContent = ta.value.slice(0, ta.selectionEnd);
    var s = document.createElement("span"); s.textContent = "​"; m.appendChild(s);
    document.body.appendChild(m);
    var sr = s.getBoundingClientRect(), lh = parseFloat(cs.lineHeight) || 18;
    m.remove();
    return { x: sr.left, y: Math.min(sr.top - ta.scrollTop + lh, r.bottom), h: lh };
  },
  onKey: function (e) {
    if (!this.pop || this.pop.style.display === "none" || !this.state || e.target !== this.state.ta) return;
    var st = this.state;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); st.i = (st.i + (e.key === "ArrowDown" ? 1 : st.items.length - 1)) % st.items.length; this.render(); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); this.choose(); }
    else if (e.key === "Escape") { e.preventDefault(); this.close(); }
  },
  choose: function () {
    var st = this.state, ta = st.ta, x = st.items[st.i]; if (!x) return;
    var end = ta.selectionEnd, after = ta.value.slice(end).replace(/^[^\s\]]*\]?/, "");
    var ins = st.type + "[" + x.insert + "]" + (/^\s/.test(after) ? "" : " ");
    ta.value = ta.value.slice(0, st.start) + ins + after;
    var pos = st.start + ins.length;
    ta.setSelectionRange(pos, pos);
    this.close();
    ta.dispatchEvent(new Event("input", { bubbles: true }));   // enregistré par la carte
    var shot = this.shotOf(ta), A = this.A;
    if (st.type === "@" && shot && this.syncRefs(shot, A.getProject(), true)) { A.touch(); A.renderShots(); }
  },
  close: function () { if (this.pop) this.pop.style.display = "none"; this.state = null; }
});
