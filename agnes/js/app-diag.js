// js/app-diag.js — 🧪 Test de la génération vidéo (⚙ Réglages)
// Envoie des requêtes minimales calquées sur les exemples officiels d'Agnes Video 2.5 et journalise
// chaque requête (sans la clé) et chaque réponse, pour trouver le paramètre qui coince.
(function () {
  "use strict";
  var A = window.AgnesApp, byId = A.byId;
  var run = null, lines = [];

  function log(t) {
    var el = byId("diagLog"), stamp = new Date().toLocaleTimeString("fr-FR");
    lines.push("[" + stamp + "] " + t); el.style.display = "block";
    el.textContent = lines.join("\n"); el.scrollTop = el.scrollHeight;
  }
  function short(o) { var s = typeof o === "string" ? o : JSON.stringify(o); return s.length > 1500 ? s.slice(0, 1500) + "…" : s; }
  function wait(ms) {
    return new Promise(function (res, rej) {
      var t = setInterval(function () { if (run && run.stop) { clearInterval(t); rej(new Error("Test arrêté.")); } }, 250);
      setTimeout(function () { clearInterval(t); res(); }, ms);
    });
  }
  // Appel brut (pas de nouvelle tentative automatique : on veut voir la vraie réponse)
  function call(method, url, body) {
    log("→ " + method + " " + url + (body ? "\n   corps : " + short(body) : ""));
    return fetch(url, { method: method, headers: Object.assign({ "Authorization": "Bearer " + A.settings.apiKey }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var j; try { j = JSON.parse(t); } catch (e) { j = t; }
          log("← HTTP " + r.status + " : " + short(j));
          return { status: r.status, ok: r.ok, json: j };
        });
      }, function (e) { log("← échec réseau : " + (e.message || e) + " (CORS, pare-feu ou coupure)"); return { status: 0, ok: false, json: null }; });
  }
  // Création avec patience : 503 « video_queue_full » = file d'Agnes saturée, pas une erreur de paramètres
  function create(url, body, label) {
    var n = 0;
    function go() {
      return call("POST", url, body).then(function (r) {
        var code = r.json && (r.json.code || (r.json.error && r.json.error.code)) || "";
        if (r.status === 503 && /queue_full/i.test(String(code))) {
          n++;
          if (n === 1) log(label + " : la file d'attente vidéo d'Agnes est pleine. Le corps de la requête n'est pas refusé : c'est une saturation de leurs serveurs, pas un problème de paramètres.");
          if (n <= 6 && !run.stop) { log(label + " : nouvel essai dans 30 s (" + n + "/6)…"); return wait(30000).then(go); }
          r.queueFull = true;
        }
        return r;
      });
    }
    return go();
  }
  function poll(videoId, model, label) {
    var url = A.joinUrl(A.settings.baseUrl, "~/agnesapi?video_id=" + encodeURIComponent(videoId) + "&model_name=" + encodeURIComponent(model)), n = 0, last = "";
    function step() {
      if (run.stop) return Promise.reject(new Error("Test arrêté."));
      n++;
      return fetch(url, { headers: { "Authorization": "Bearer " + A.settings.apiKey } }).then(function (r) {
        return r.text().then(function (t) {
          var j; try { j = JSON.parse(t); } catch (e) { j = t; }
          var st = j && j.status ? String(j.status) : "?";
          if (!r.ok) { log(label + " suivi HTTP " + r.status + " : " + short(j)); if (n > 3) return { ok: false, json: j }; }
          else if (st !== last || n % 6 === 0) { log(label + " statut : " + st + (j.progress != null ? " · " + j.progress + " %" : "")); last = st; }
          if (st === "completed") { log(label + " ✅ TERMINÉ — vidéo : " + (j.url || (j.metadata && j.metadata.url) || "(aucune url !) " + short(j))); return { ok: true, json: j }; }
          if (st === "failed") { log(label + " ❌ ÉCHEC côté Agnes : " + short(j.error || j)); return { ok: false, json: j }; }
          if (n >= 90) { log(label + " ⏱ toujours « " + st + " » après 7 min 30 : arrêt du suivi (dernière réponse : " + short(j) + ")"); return { ok: false, json: j }; }
          return wait(5000).then(step);
        });
      }, function (e) { log(label + " suivi : échec réseau " + (e.message || e)); return wait(5000).then(step); });
    }
    return step();
  }
  // Petite image de test 1280×720 (dégradé + disque), envoyée sur imgbb
  function testImageUrl() {
    var c = document.createElement("canvas"); c.width = 1280; c.height = 720;
    var x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 1280, 720);
    g.addColorStop(0, "#1d3557"); g.addColorStop(1, "#e76f51"); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = "#f1faee"; x.beginPath(); x.arc(640, 360, 150, 0, Math.PI * 2); x.fill();
    return A.canvasToBlob(c, "image/jpeg", 0.9).then(function (b) { return A.uploadImgbb(b); });
  }

  function start() {
    if (run) return;
    if (!A.settings.apiKey) { A.toast("Ajoutez d'abord votre clé API Agnes.", "err"); return; }
    run = { stop: false }; lines = [];
    byId("diagRunBtn").disabled = true; byId("diagStopBtn").style.display = ""; byId("diagCopyBtn").disabled = true;
    var model = A.settings.videoModel, withKey = byId("diagKeyframe").checked, createUrl = A.joinUrl(A.settings.baseUrl, A.settings.videoCreatePath);
    var summary = [];
    log("Agnes Studio Pro — test vidéo · " + navigator.userAgent.replace(/^Mozilla\/5.0 /, ""));
    log("Réglages : base = " + A.settings.baseUrl + " · création = " + A.settings.videoCreatePath + " · suivi = " + A.settings.videoStatusPath +
      " · modèle vidéo = " + model + " · format = " + (A.settings.videoParamStyle || "auto") + " → " + A.videoStyle() + " · imgbb = " + (A.settings.imgbbKey ? "oui" : "NON"));
    var flash = A.isFlashVideo(model);
    var t1 = { model: model, prompt: "A red apple slowly rotating on a wooden table, soft studio light, static camera", seconds: "4", mode: "text", size: "720P", aspect_ratio: "16:9" };
    var createdAt = 0;
    log("━━ TEST 1 : texte → vidéo (mode text, exemple officiel) ━━");
    create(createUrl, t1, "Test 1").then(function (r) {
      createdAt = Date.now();
      var vid = r.json && (r.json.video_id || r.json.id);
      if (r.queueFull) { summary.push("Test 1 : file d'attente Agnes pleine (serveurs saturés, réessayez plus tard)"); return; }
      if (!r.ok || !vid) { summary.push("Test 1 : création refusée (HTTP " + r.status + ")"); return; }
      return poll(vid, model, "Test 1").then(function (p) { summary.push("Test 1 : " + (p.ok ? "OK" : "échec")); });
    }).then(function () {
      if (!withKey) return;
      log("━━ TEST 2 : image → vidéo (mode keyframe, first_frame) ━━");
      if (!A.settings.imgbbKey) { log("Pas de clé imgbb : test 2 impossible (Agnes exige une URL publique)."); summary.push("Test 2 : non fait (pas d'imgbb)"); return; }
      log("Envoi d'une image de test sur imgbb…");
      return testImageUrl().then(function (url) {
        log("Image publique : " + url);
        var pause = Math.max(0, 65000 - (Date.now() - createdAt));
        if (pause > 0) log("Pause de " + Math.round(pause / 1000) + " s (offre gratuite : 1 vidéo par minute)…");
        return wait(pause).then(function () {
          var t2 = { model: model, prompt: "The glowing disc slowly drifts to the right while the camera stays still", seconds: "4", mode: "keyframe", size: "720P", first_frame: url };
          return create(createUrl, t2, "Test 2");
        });
      }, function (e) { log("imgbb a refusé l'image : " + short(e.display || e.message || e)); summary.push("Test 2 : imgbb en échec"); return null; })
        .then(function (r) {
          if (!r) return;
          var vid = r.json && (r.json.video_id || r.json.id);
          if (r.queueFull) { summary.push("Test 2 : file d'attente Agnes pleine (serveurs saturés, réessayez plus tard)"); return; }
          if (!r.ok || !vid) { summary.push("Test 2 : création refusée (HTTP " + r.status + ")"); return; }
          return poll(vid, model, "Test 2").then(function (p) { summary.push("Test 2 : " + (p.ok ? "OK" : "échec")); });
        });
    }).catch(function (e) { log("Arrêt : " + (e.message || e)); })
      .then(function () {
        log("━━ RÉSUMÉ : " + (summary.join(" · ") || "aucun test terminé") + " ━━");
        run = null; byId("diagRunBtn").disabled = false; byId("diagStopBtn").style.display = "none"; byId("diagCopyBtn").disabled = false;
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!byId("diagRunBtn")) return;
    byId("diagRunBtn").addEventListener("click", start);
    byId("diagStopBtn").addEventListener("click", function () { if (run) { run.stop = true; log("Arrêt demandé…"); } });
    byId("diagCopyBtn").addEventListener("click", function () {
      var txt = lines.join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { A.toast("Rapport copié : collez-le dans la conversation.", "ok"); },
        function () { AgnesCore.download(new Blob([txt], { type: "text/plain" }), "test-video-agnes.txt"); });
    });
  });
})();
