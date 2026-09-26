// js/app-api.js — appels API : image (T2I, I2I, ingrédients), vidéo (T2V, I2V, frames, ingrédients)
(function () {
  "use strict";
  var A = window.AgnesApp;
  var DONE = ["completed", "succeeded", "success", "done", "finished"];
  var FAILED = ["failed", "error", "cancelled", "canceled", "rejected"];
  var STATUS_FR = { queued: "en file côté serveur", pending: "en file côté serveur", in_progress: "rendu en cours", processing: "rendu en cours", running: "rendu en cours", completed: "terminé" };

  function explain(status, msg) {
    if (status === 401 || status === 403) return "Clé API refusée (" + status + ") — vérifiez la clé dans les réglages (⚙).";
    if (status === 400) return "Requête refusée (400) : " + msg + " — un paramètre n'est peut-être pas accepté par ce modèle (voir la réponse brute).";
    if (status === 404) return "Adresse introuvable (404) : " + msg + " — vérifiez les chemins dans les options avancées.";
    if (status === 429) return "Trop de requêtes (429) — baissez les générations simultanées dans la liste d'attente.";
    return msg;
  }

  // fetch JSON avec en-têtes, nouvelle tentative sur 429 / 5xx / coupure réseau
  A.apiFetch = function (url, opts, signal) {
    opts = opts || {}; var tries = 0;
    function attempt() {
      var headers = Object.assign({ "Authorization": "Bearer " + A.settings.apiKey }, opts.body ? { "Content-Type": "application/json" } : {});
      return fetch(url, { method: opts.method || "GET", headers: headers, body: opts.body, signal: signal }).then(function (res) {
        return res.text().then(function (text) {
          var json; try { json = JSON.parse(text); } catch (e) { json = { raw: text.slice(0, 3000) }; }
          if (res.ok) return json;
          // File d'attente Agnes saturée (503 « video_queue_full ») : ce n'est pas une erreur de la requête, on patiente
          var busyCode = String(A.findFirst(json, ["code"]) || ""), busyMsg = String(A.findFirst(json, ["message"]) || "");
          if (res.status === 503 && (/queue_full|busy|overload/i.test(busyCode) || /queue is full|busy|overloaded/i.test(busyMsg))) {
            var waited = opts._waited || 0, limit = opts.queueWaitMax || 20 * 60000;
            if (waited < limit) {
              var pause = Math.min(90000, 30000 + tries * 15000); tries++; opts._waited = waited + pause;
              if (opts.onWait) opts.onWait("File d'attente Agnes pleine : nouvel essai dans " + Math.round(pause / 1000) + " s (attente " + Math.round((waited + pause) / 60000 * 10) / 10 + " / " + Math.round(limit / 60000) + " min)");
              return A.sleep(pause, signal).then(attempt);
            }
            throw { display: "File d'attente vidéo d'Agnes pleine depuis " + Math.round(waited / 60000) + " min (503 « video_queue_full »). Les serveurs d'Agnes sont saturés : ce n'est pas un problème de réglage. Relancez plus tard (Relancer, ou Relancer les échecs dans la Liste d'attente).", json: json, status: res.status, queueFull: true };
          }
          if (res.status === 429 && tries < 5) { tries++; return A.sleep(15000 * tries, signal).then(attempt); }
          if (res.status >= 500 && tries < 4) { tries++; return A.sleep(4000 * tries, signal).then(attempt); }
          var msg = A.findFirst(json, ["message", "error", "detail"]) || ("Statut HTTP " + res.status);
          throw { display: explain(res.status, msg), json: json, status: res.status };
        });
      }, function (err) {
        if (err && err.name === "AbortError") throw { display: "Annulé.", cancelled: true };
        if (tries < 2) { tries++; return A.sleep(3000, signal).then(attempt); }
        throw { display: "API injoignable ou requête bloquée par le navigateur (CORS) : " + (err && err.message ? err.message : err) };
      });
    }
    return attempt();
  };

  // ---- Prompt final : description + actions des skills + style du projet ----
  A.buildPrompt = function (shot, proj) {
    proj = proj || A.getProject();
    var kind = A.modeKind(shot.mode), parts = [shot.prompt || ""];
    (shot.skills || []).forEach(function (id) {
      var s = A.db.skills.find(function (x) { return x.id === id; });
      if (s && s.action && (s.target === "both" || s.target === kind)) parts.push(s.action);
    });
    if (proj.styleGuide) parts.push(proj.styleGuide);
    // Verrou d'identité : limite les changements de visage/tenue et les coupes à l'intérieur d'un même rendu
    if (shot.lock !== false) {
      var hasRefs = (A.usesRefs(shot.mode, shot) && (shot.ingredients || []).length) || shot.sourceRef || shot.startRef;
      if (shot.mode === "i2v") {
        // Ne rien inventer : on anime uniquement ce qui est déjà dans l'image
        parts.push("animate only what is already visible in the source image: keep the exact same framing, background, lighting, characters, clothing and objects; do not add any new person, object or text; do not reveal anything outside the frame");
        var mo = shot.motion || "subtle";
        if (mo === "subtle") parts.push("subtle natural movement only (breathing, blinking, small head and hand gestures), the characters stay in place, static camera");
        else if (mo === "moderate") parts.push("natural moderate movement, slow and steady camera");
        if (shot.i2v === "anchor") parts.push("the video starts and ends on the exact composition of the source image, with only small natural movements in between");
        if (shot.i2v === "refs" && (shot.ingredients || []).length) parts.push("use the first image as the exact starting scene; the other images only show the exact appearance of the characters and places, never show them as separate scenes");
      }
      if (hasRefs) parts.push("keep the exact identity of the characters and places shown in the reference images: same face, same hairstyle, same skin tone, same body shape and same clothing");
      if (kind === "video") parts.push("one single continuous shot with no cuts and no scene change, the same people from the first to the last frame, consistent faces with no morphing");
    }
    var out = parts.map(function (t) { return String(t).trim(); }).filter(Boolean).join(", ");
    (AgnesCore._promptFilters || []).forEach(function (f) {
      try { var r = f(out, shot, proj, kind); if (typeof r === "string") out = r; } catch (e) { console.warn("[Filtre de prompt]", e); }
    });
    return out;
  };
  function resolveSeed(shot, proj) {
    var s = shot.seed || proj.seed;
    return s === "" || s == null ? null : (isNaN(s) ? s : Number(s));
  }
  function applyCommon(body, shot, proj) {
    var seed = resolveSeed(shot, proj);
    if (seed !== null) body.seed = seed;
    var neg = shot.negative || proj.negative;
    // Image → Vidéo / images clés : négatif anti-invention ajouté quand le verrou est actif
    if ((shot.mode === "i2v" || shot.mode === "frames") && shot.lock !== false) {
      var guard = "new characters, extra people, face change, identity change, morphing, scene cut, camera cut, different clothes, new objects, text, subtitles, watermark";
      neg = neg ? neg + ", " + guard : guard;
    }
    if (neg && A.settings.sendNegative) body.negative_prompt = neg;
  }
  A.numFrames = function (seconds, fps) {
    var n = Math.round(seconds * fps), k = Math.round((n - 1) / 8);
    return Math.min(441, Math.max(9, 8 * k + 1));
  };

  // ---- Références (bibliothèque ou « dernière image du plan précédent ») → URL pour l'API ----
  function libItem(proj, id) { return proj.library.find(function (l) { return l.id === id; }); }
  A.previousShot = function (shot, proj) {
    var arr = A.sortedShots(proj), i = arr.findIndex(function (s) { return s.id === shot.id; });
    return i > 0 ? arr[i - 1] : null;
  };
  function prevFrameUrl(shot, proj) {
    var prev = A.previousShot(shot, proj);
    if (!prev) return Promise.reject({ display: "Ce plan est le premier : il n'y a pas de plan précédent à enchaîner." });
    var take = A.selectedTake(prev);
    if (!take) return Promise.reject({ display: "Le plan précédent n'a pas encore de rendu — générez-le d'abord." });
    if (take.kind === "image") {
      if (take.remoteUrl) return Promise.resolve(take.remoteUrl);
      return A.getTakeBlob(take.id).then(function (b) { if (!b) throw { display: "Rendu du plan précédent introuvable." }; return A.blobToApiUrl(b); });
    }
    if (take.lastFrameUrl) return Promise.resolve(take.lastFrameUrl);
    return A.getTakeBlobOrFetch(take).then(function (blob) {
      if (!blob) throw { display: "Impossible de lire la vidéo du plan précédent pour en extraire la dernière image." };
      var u = URL.createObjectURL(blob);
      return A.videoFrame(u, "last").then(function (fb) { URL.revokeObjectURL(u); return A.blobToApiUrl(fb); });
    }).then(function (url) { if (/^https?:/i.test(url)) take.lastFrameUrl = url; return url; });
  }
  function keyImageUrl(shot, proj) {
    var take = A.keyTake(shot);
    if (!take) return Promise.reject({ display: "Générez d'abord l'image de départ de ce plan." });
    if (take.apiUrl) return Promise.resolve(take.apiUrl);
    // Sans clé imgbb, l'adresse fournie par Agnes (publique) vaut mieux qu'une image intégrée
    if (!A.settings.imgbbKey && /^https?:/i.test(take.remoteUrl || "")) return Promise.resolve(take.remoteUrl);
    return A.getTakeBlob(take.id).then(function (b) {
      if (!b) { if (take.remoteUrl) return take.remoteUrl; throw { display: "Image de départ introuvable — regénérez-la." }; }
      return A.blobToApiUrl(b).then(function (url) { if (/^https?:/i.test(url)) { take.apiUrl = url; A.touch(proj); } return url; });
    });
  }
  function refUrl(refId, shot, proj, label) {
    if (!refId) return Promise.reject({ display: "Choisissez " + label + " pour ce mode." });
    if (refId === A.PREV_REF) return prevFrameUrl(shot, proj);
    if (refId === A.KEY_REF) return keyImageUrl(shot, proj);
    var item = libItem(proj, refId);
    if (!item) return Promise.reject({ display: "Référence introuvable dans la bibliothèque (" + label + ")." });
    return A.libItemToApiUrl(item, proj);
  }
  A.resolveRefs = function (shot, proj) {
    var m = shot.mode, out = {};
    var ingr = function () {
      var ids = A.usesRefs(m, shot) ? (shot.ingredients || []).slice(0, A.settings.maxRefs || 5) : [];
      return Promise.all(ids.map(function (id) { return refUrl(id, shot, proj, "une référence"); }));
    };
    if (m === "i2i") return Promise.all([refUrl(shot.sourceRef, shot, proj, "une image source"), ingr()]).then(function (r) { out.source = r[0]; out.ingredients = r[1]; return out; });
    if (m === "i2v") return Promise.all([refUrl(shot.sourceRef, shot, proj, "une image source"), ingr()]).then(function (r) { out.source = r[0]; out.ingredients = r[1]; return out; });
    if (m === "frames") return Promise.all([refUrl(shot.startRef, shot, proj, "une image de début"), refUrl(shot.endRef, shot, proj, "une image de fin")])
      .then(function (r) { out.start = r[0]; out.end = r[1]; return out; });
    if (m === "ingr_i" || m === "ingr_v") {
      if (!(shot.ingredients || []).length) return Promise.reject({ display: "Sélectionnez au moins une référence de la bibliothèque." });
      return ingr().then(function (r) { out.ingredients = r; return out; });
    }
    if (m === "t2i" || m === "t2v") return ingr().then(function (r) { out.ingredients = r; return out; });
    return Promise.resolve(out);
  };
  A.shotDependsOnPrevious = function (shot) {
    return [shot.sourceRef, shot.startRef, shot.endRef].concat(shot.ingredients || []).indexOf(A.PREV_REF) !== -1;
  };

  // =========================================================
  // IMAGE
  // =========================================================
  function storeImageTake(item) {
    var take = { id: A.uid(), kind: "image", createdAt: Date.now(), remoteUrl: item.url && /^https?:/i.test(item.url) ? item.url : "" };
    var blobP = item.b64 ? Promise.resolve(A.dataUrlToBlob("data:image/png;base64," + item.b64))
      : /^data:/i.test(item.url || "") ? Promise.resolve(A.dataUrlToBlob(item.url))
        : fetch(item.url).then(function (r) { return r.ok ? r.blob() : null; }).catch(function () { return null; });
    return blobP.then(function (blob) {
      take.local = !!blob;
      return (blob ? AgnesStore.putBlob("take:" + take.id, blob) : Promise.resolve())
        .then(function () { return A.makeThumb(blob || take.remoteUrl, 320).catch(function () { return null; }); })
        .then(function (thumb) { take.thumb = thumb; return take; });
    });
  }

  // Paliers d'image Agnes (1K / 2K / 4K) et ratios acceptés
  var IMAGE_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16", "2:3", "3:2", "21:9"];
  var VIDEO25_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
  function imageTier(res) { var r = parseInt(res, 10) || 1080; return r >= 2160 ? "4K" : r >= 1080 ? "2K" : "1K"; }
  function nearestRatio(aspect, list) {
    if (list.indexOf(aspect) !== -1) return aspect;
    var p = String(aspect || "16:9").split(":"), r = (+p[0] || 16) / (+p[1] || 9), best = list[0], d = 1e9;
    list.forEach(function (x) { var q = x.split(":"), v = Math.abs(Math.log(q[0] / q[1] / r)); if (v < d) { d = v; best = x; } });
    return best;
  }
  A.nearestRatio = nearestRatio; A.VIDEO25_RATIOS = VIDEO25_RATIOS;

  A.generateImage = function (job, shot, proj) {
    var wanted = A.clamp(shot.outputs || 1, 1, 4), found = [], requests = 0;
    var url = A.joinUrl(A.settings.baseUrl, A.settings.imagePath);
    job.info = "Préparation des références…"; A.emitJob(job);

    return A.resolveRefs(shot, proj).then(function (refs) {
      var images = (refs.source ? [refs.source] : []).concat(refs.ingredients || []);
      function once(n) {
        requests++;
        var body = { model: A.settings.imageModel, prompt: A.buildPrompt(shot, proj), size: imageTier(shot.resolution), ratio: nearestRatio(shot.aspect, IMAGE_RATIOS), n: n,
          extra_body: { response_format: "url" } };
        applyCommon(body, shot, proj);
        if (images.length) {
          if (A.settings.refsInExtraBody) body.extra_body.image = images;
          else body.image = images;
          if (A.settings.img2imgTag && shot.mode === "i2i") body.tags = ["img2img"];
          if (shot.mode === "i2i" && shot.strength !== "" && shot.strength != null) body.strength = Number(shot.strength);
        }
        job.info = "Génération de l'image" + (wanted > 1 ? "s (" + found.length + "/" + wanted + ")" : "") + "…"; A.emitJob(job);
        return A.apiFetch(url, { method: "POST", body: JSON.stringify(body) }, job.signal).then(function (json) {
          shot.lastRaw = json;
          var b64 = A.collectByKey(json, "b64_json").map(function (b) { return { b64: b }; });
          var urls = A.collectByKey(json, "url").filter(function (u) { return /^(https?:|data:image)/i.test(u); }).map(function (u) { return { url: u }; });
          found = found.concat(b64, urls);
          if (!found.length) throw { display: "Réponse reçue mais aucune image trouvée.", json: json };
          // Si l'API ignore « n », on complète par des requêtes supplémentaires
          if (found.length < wanted && requests < wanted) return once(wanted - found.length);
        });
      }
      return once(wanted);
    }).then(function () {
      job.info = "Enregistrement des prises…"; A.emitJob(job);
      return Promise.all(found.slice(0, wanted).map(storeImageTake));
    });
  };

  // =========================================================
  // VIDÉO
  // =========================================================
  // Agnes Video 2.5 / 2.5 Flash : mode text | keyframe | reference, durée 4–12 s en texte, taille par palier + aspect_ratio
  function refNames(shot, proj) {
    var ids = (shot.ingredients || []).slice(0, A.settings.maxRefs || 5);
    return ids.map(function (id) { var l = proj.library.find(function (x) { return x.id === id; }); return l ? l.name : ""; });
  }
  function video25Body(shot, proj, refs) {
    var model = A.settings.videoModel, flash = A.isFlashVideo(model), range = A.videoSecondsRange();
    var body = { model: model, prompt: A.buildPrompt(shot, proj), seconds: String(Math.round(A.clamp(shot.duration || 5, range[0], range[1]))),
      aspect_ratio: nearestRatio(shot.aspect, VIDEO25_RATIOS) };
    var r = parseInt(shot.resolution, 10) || 720;
    body.size = flash ? "720P" : (r >= 1440 ? "2K" : r >= 1080 ? "1080P" : "720P");
    var seed = shot.seed || proj.seed;
    if (seed !== "" && seed != null && !isNaN(seed)) body.seed = Number(seed);
    var maxImg = flash ? 5 : 8, ingr = (refs.ingredients || []).slice(0, maxImg), names = refNames(shot, proj);
    function legend(offset) {
      return ingr.map(function (u, i) { return "<Picture " + (i + 1 + offset) + ">" + (names[i] ? " = " + names[i] : ""); }).join(", ") +
        " : use these only as references for the exact appearance of the characters, places and objects, never show them as separate shots";
    }
    if (shot.mode === "frames") { body.mode = "keyframe"; body.first_frame = refs.start; body.last_frame = refs.end; delete body.aspect_ratio; }
    else if (shot.mode === "i2v" && shot.i2v === "refs" && ingr.length) {
      body.mode = "reference"; body.images = [refs.source].concat(ingr).slice(0, maxImg);
      body.prompt += ". <Picture 1> is the exact starting scene; " + legend(1);
    } else if (shot.mode === "i2v") {
      body.mode = "keyframe"; body.first_frame = refs.source; delete body.aspect_ratio;
      if (shot.i2v === "anchor") body.last_frame = refs.source;
    } else if (ingr.length) { body.mode = "reference"; body.images = ingr; body.prompt += ". " + legend(0); }
    else body.mode = "text";
    return body;
  }
  function videoBody(shot, proj, refs) {
    if (A.videoStyle() === "agnes25") return video25Body(shot, proj, refs);
    var size = A.computeSize(shot.aspect, shot.resolution), fps = A.clamp(proj.fps || 24, 1, 60);
    var dur = A.clamp(shot.duration || 5, 1, 60), body;
    if (A.settings.videoParamStyle === "generic") {
      body = { model: A.settings.videoModel, prompt: A.buildPrompt(shot, proj), size: size.w + "x" + size.h, duration: dur, aspect_ratio: shot.aspect, resolution: shot.resolution };
    } else {
      body = { model: A.settings.videoModel, prompt: A.buildPrompt(shot, proj), width: size.w, height: size.h, num_frames: A.numFrames(dur, fps), frame_rate: fps };
    }
    applyCommon(body, shot, proj);
    var extra = null;
    if (shot.mode === "i2v") {
      if (shot.i2v === "anchor") extra = { image: [refs.source, refs.source], mode: "keyframes" };
      else if (shot.i2v === "refs" && refs.ingredients && refs.ingredients.length) extra = { image: [refs.source].concat(refs.ingredients) };
      else body.image = refs.source;
    }
    if (shot.mode === "frames") extra = { image: [refs.start, refs.end], mode: "keyframes" };
    if ((shot.mode === "ingr_v" || shot.mode === "t2v") && refs.ingredients && refs.ingredients.length) extra = { image: refs.ingredients };
    if (extra) { if (A.settings.refsInExtraBody) body.extra_body = extra; else Object.assign(body, extra); }
    return body;
  }
  function findVideoUrl(json, status) {
    var keys = ["remixed_from_video_id", "video_url", "output_url", "content_url", "download_url", "file_url", "url"];
    for (var i = 0; i < keys.length; i++) {
      var list = A.collectByKey(json, keys[i]).filter(function (u) { return /^https?:\/\//i.test(u); });
      if (!list.length) continue;
      if ((keys[i] === "url" || keys[i] === "remixed_from_video_id") && DONE.indexOf(status) === -1 && !/\.(mp4|webm|mov)(\?|$)/i.test(list[0])) continue;
      return list[0];
    }
    return null;
  }
  function finalizeVideo(url, blob) {
    var take = { id: A.uid(), kind: "video", createdAt: Date.now(), remoteUrl: url || "" };
    var blobP = blob ? Promise.resolve(blob) : fetch(url).then(function (r) { return r.ok ? r.blob() : null; }).catch(function () { return null; });
    return blobP.then(function (b) {
      take.local = !!b;
      return (b ? AgnesStore.putBlob("take:" + take.id, b) : Promise.resolve()).then(function () {
        var src = b ? URL.createObjectURL(b) : url;
        return A.videoFrame(src, "first", 320).then(A.makeThumb).catch(function () { return null; })
          .then(function (th) { if (b) URL.revokeObjectURL(src); take.thumb = th; return take; });
      });
    });
  }
  function pollTask(job, shot, task, idx, total, proj) {
    var legacy = !task.videoId, MAX = 240, lastStatus = "";
    function statusUrl(useLegacy) {
      var tmpl = useLegacy ? A.settings.videoLegacyPath : A.settings.videoStatusPath;
      var id = useLegacy ? (task.taskId || task.videoId) : (task.videoId || task.taskId);
      // Les tâches créées avant la v3.9 n'ont pas de modèle mémorisé : c'étaient des tâches v2.0
      var tm = task.model || "agnes-video-v2.0";
      var url = tmpl.replace("{id}", encodeURIComponent(id)).replace("{model}", encodeURIComponent(tm));
      // Série 2.5 : model_name est obligatoire pour suivre les modes keyframe et reference
      if (!useLegacy && tmpl.indexOf("{model}") === -1 && /2\.5/.test(tm) && /agnesapi/.test(url) && !/model_name=/.test(url))
        url += (url.indexOf("?") === -1 ? "?" : "&") + "model_name=" + encodeURIComponent(tm);
      return A.joinUrl(A.settings.baseUrl, url);
    }
    function attempt(k) {
      if (job.cancelled) return Promise.reject({ display: "Annulé.", cancelled: true });
      return A.apiFetch(statusUrl(legacy), {}, job.signal).catch(function (err) {
        if (!legacy && task.taskId && (err.status === 404 || err.status === 400)) { legacy = true; return A.apiFetch(statusUrl(true), {}, job.signal); }
        throw err;
      }).then(function (json) {
        shot.lastRaw = json;
        var status = String(A.findFirst(json, ["status", "state"]) || "").toLowerCase();
        lastStatus = status; task.lastStatus = status; task.lastCheck = Date.now();
        var prog = json.progress != null ? json.progress : (json.data && json.data.progress != null ? json.data.progress : null);
        job.info = (total > 1 ? "Sortie " + (idx + 1) + "/" + total + " — " : "") + (STATUS_FR[status] || status || "en attente") + (prog != null ? " · " + prog + " %" : "");
        job.progress = prog; A.emitJob(job);
        var url = findVideoUrl(json, status);
        if (url) return finalizeVideo(url);
        if (DONE.indexOf(status) !== -1) {
          // Terminé mais sans URL : tentative sur /videos/{id}/content
          var contentUrl = A.joinUrl(A.settings.baseUrl, "/videos/" + encodeURIComponent(task.taskId || task.videoId) + "/content");
          return fetch(contentUrl, { headers: { "Authorization": "Bearer " + A.settings.apiKey }, signal: job.signal })
            .then(function (r) { if (!r.ok) throw { display: "Vidéo terminée mais aucun lien de téléchargement dans la réponse.", json: json }; return r.blob(); })
            .then(function (b) { return finalizeVideo("", b); });
        }
        if (FAILED.indexOf(status) !== -1) {
          var why = A.findFirst(json, ["message", "reason", "error"]);
          shot.remoteTasks = (shot.remoteTasks || []).filter(function (t) { return t !== task && t.videoId !== task.videoId; });
          throw { display: "La génération vidéo a échoué côté serveur" + (why ? " : " + why : "."), json: json };
        }
        if (k >= MAX) throw { display: "Délai dépassé (20 min) : Agnes n'a pas encore rendu la vidéo (dernier statut : « " + (STATUS_FR[lastStatus] || lastStatus || "aucun") + " »). " +
          "La tâche continue peut-être chez Agnes : « ⟳ Reprendre le suivi » vérifie à nouveau sans relancer la génération.", json: json, timeout: true };
        return A.sleep(5000, job.signal).then(function () { return attempt(k + 1); });
      });
    }
    return attempt(0).then(function (take) {
      shot.remoteTasks = (shot.remoteTasks || []).filter(function (t) { return t !== task && t.videoId !== task.videoId; });
      A.touch(proj);
      return take;
    });
  }

  A.generateVideo = function (job, shot, proj) {
    var total = A.clamp(shot.outputs || 1, 1, 4);
    var tasksP;
    if (job.resume && shot.remoteTasks && shot.remoteTasks.length) {
      tasksP = Promise.resolve(shot.remoteTasks.slice());
    } else {
      job.info = "Préparation des références…"; A.emitJob(job);
      tasksP = A.resolveRefs(shot, proj).then(function (refs) {
        var imgs = [refs.source, refs.start, refs.end].concat(refs.ingredients || []).filter(Boolean);
        if (imgs.some(function (u) { return /^data:/i.test(u); })) throw {
          display: "Agnes a besoin d'une adresse publique (URL) pour les images d'une vidéo, sinon la tâche reste bloquée « en file » jusqu'au délai dépassé. " +
            "Ajoutez une clé imgbb gratuite dans ⚙ Réglages (api.imgbb.com), puis relancez.", needImgbb: true };
        var createUrl = A.joinUrl(A.settings.baseUrl, A.settings.videoCreatePath), tasks = [];
        shot.remoteTasks = [];
        function createOne(i) {
          if (i >= total) return tasks;
          job.info = "Création de la tâche vidéo" + (total > 1 ? " " + (i + 1) + "/" + total : "") + "…"; A.emitJob(job);
          var body = videoBody(shot, proj, refs);
          if (i > 0 && body.seed != null && typeof body.seed === "number") body.seed = body.seed + i; // variantes différentes
          shot.lastRequest = { url: createUrl, body: body };
          var createOpts = { method: "POST", body: JSON.stringify(body), onWait: function (msg) { job.info = msg; A.emitJob(job); } };
          return A.apiFetch(createUrl, createOpts, job.signal).then(function (json) {
            shot.lastRaw = json;
            var t = { videoId: A.findFirst(json, ["video_id"]), taskId: A.findFirst(json, ["task_id", "id"]), model: body.model };
            var immediate = findVideoUrl(json, String(A.findFirst(json, ["status"]) || "").toLowerCase());
            if (immediate) t.immediateUrl = immediate;
            else if (!t.videoId && !t.taskId) throw { display: "Tâche créée mais aucun identifiant dans la réponse.", json: json };
            tasks.push(t); shot.remoteTasks.push(t); A.touch(proj);
            return createOne(i + 1);
          });
        }
        return createOne(0);
      });
    }
    return tasksP.then(function (tasks) {
      return Promise.allSettled(tasks.map(function (t, i) {
        return t.immediateUrl ? finalizeVideo(t.immediateUrl) : pollTask(job, shot, t, i, tasks.length, proj);
      }));
    }).then(function (results) {
      var takes = results.filter(function (r) { return r.status === "fulfilled"; }).map(function (r) { return r.value; });
      if (!takes.length) throw results[0].reason;
      if (takes.length < results.length) job.warning = (results.length - takes.length) + " sortie(s) en échec.";
      shot.remoteTasks = [];
      return takes;
    });
  };

  // =========================================================
  // EXÉCUTION D'UNE TÂCHE DE LA FILE
  // =========================================================
  A.runShotJob = function (job) {
    var proj = A.getProjectById(job.projectId), shot = A.findShot(job.shotId, job.projectId);
    if (!proj || !shot) return Promise.reject({ display: "Ce plan a été supprimé." });
    if (!A.settings.apiKey && A.needsAgnesKey(shot, job.stage)) return Promise.reject({ display: "Ajoutez votre clé API dans les réglages (⚙)." });
    shot.status = "running"; shot.errorMsg = ""; A.touch(proj); A.renderShots();
    var work = A.isTwoStep(shot) ? runTwoStep(job, shot, proj)
      : (A.modeKind(shot.mode) === "image" ? A.generateImage(job, shot, proj) : A.generateVideo(job, shot, proj)).then(function (takes) { return addTakes(shot, takes, proj); });
    return work.then(function (takes) {
      if (takes) AgnesCore.emit("shot:done", { shot: shot, takes: takes, project: proj });
      return takes;
    }).catch(function (err) {
      shot.status = err && err.cancelled ? (A.keyTake(shot) && !(shot.takes || []).length ? "review" : ((shot.takes || []).length ? "done" : "idle")) : "error";
      shot.errorMsg = err && err.cancelled ? "" : (err && err.display ? err.display : (err && err.message ? err.message : String(err)));
      if (err && err.json) shot.lastRaw = err.json;
      AgnesCore.emit("shot:error", { shot: shot, error: shot.errorMsg });
      throw err;
    }).finally(function () { A.touch(proj); A.renderShots(); });

    function addTakes(s, takes) {
      s.takes = (s.takes || []).concat(takes);
      s.selectedTakeId = takes[0].id; s.status = "done";
      s.errorMsg = job.warning || "";
      if (s.toLibrary) {
        var meta = s.toLibrary; s.toLibrary = null;
        A.getTakeBlobOrFetch(takes[0]).then(function (b) {
          if (b) A.addLibraryItem(b, { name: meta.name, kind: meta.kind || "personnage", publicUrl: takes[0].remoteUrl || "" }, proj)
            .then(function () { A.toast("« " + meta.name + " » ajouté à la bibliothèque.", "ok"); });
        });
      }
      return takes;
    }
  };

  // Texte → Vidéo avec prompt image : étape « image » (Texte → Image + références), puis étape « vidéo » (Image → Vidéo)
  // job.stage force une étape ; sinon : image si le plan n'en a pas encore, vidéo sinon.
  function runTwoStep(job, shot, proj) {
    var stage = job.stage || (job.resume ? (shot.twoStage || "video") : (A.keyTake(shot) ? "video" : "image"));
    function imageStep() {
      shot.twoStage = "image"; job.info = "Image de départ…"; A.emitJob(job);
      return A.generateImage(job, A.stageView(shot, "image"), proj).then(function (takes) {
        shot.keyTakes = (shot.keyTakes || []).concat(takes); shot.keyTakeId = takes[0].id;
        A.touch(proj); A.renderShots();
      });
    }
    function videoStep() {
      shot.twoStage = "video"; shot.status = "running"; A.renderShots();
      return A.generateVideo(job, A.stageView(shot, "video"), proj).then(function (takes) {
        shot.takes = (shot.takes || []).concat(takes); shot.selectedTakeId = takes[0].id;
        shot.status = "done"; shot.errorMsg = job.warning || ""; return takes;
      });
    }
    if (stage === "video") return videoStep();
    return imageStep().then(function () {
      if (shot.autoAnimate) return videoStep();
      shot.status = (shot.takes || []).length ? "done" : "review";
      job.warning = "Image prête — à valider";
      A.toast("Image de départ prête : choisissez la bonne variante, puis « Animer ».", "ok");
      return null;
    });
  }
})();
