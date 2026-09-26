// plugins/plugin-ffmpeg.js — Kit de montage FFmpeg
// Ajoute dans l'onglet Assemblage un bouton qui exporte un .zip : les clips du montage + montage.bat (Windows)
// + montage.sh (Mac/Linux). Double-cliquez montage.bat : FFmpeg recadre, uniformise et assemble le film en MP4
// haute qualité, avec les mêmes transitions (cut, fondu enchaîné, fondu au noir) que dans l'app.
AgnesPlugins.register("ffmpeg-assembler", {
  name: "Kit de montage FFmpeg",
  version: "2.2",

  init: function (core) {
    var self = this;
    core.ui.addToolbarButton("montage", "Exporter le kit FFmpeg (.zip)", function () { self.exportKit(core); });
  },

  videoDuration: function (blob) {
    return new Promise(function (resolve) {
      var v = document.createElement("video"), u = URL.createObjectURL(blob);
      v.preload = "metadata";
      v.onloadedmetadata = function () { var d = v.duration; URL.revokeObjectURL(u); resolve(isFinite(d) ? d : 5); };
      v.onerror = function () { URL.revokeObjectURL(u); resolve(5); };
      v.src = u;
    });
  },

  exportKit: function (core) {
    var self = this, App = window.AgnesApp;
    if (typeof JSZip === "undefined") { core.toast("Module ZIP indisponible — rechargez la page.", "err"); return; }
    var proj = core.getProject(), o = Object.assign({ aspect: proj.aspect, res: "1080p", fps: 30, fit: "cover", audio: true }, proj.montage.opts || {});
    var plan = core.getMontagePlan().filter(function (it) { return it.on; });
    if (!plan.length) { core.toast("Aucun plan à exporter.", "err"); return; }
    var size = App.computeSize(o.aspect, o.res), W = size.w, H = size.h, FPS = o.fps || 30;
    var grade = App.gradeActive(proj), skipGrade = new Set(grade && grade.skip || []), gradeF = "";
    var scaleF = o.fit === "contain"
      ? "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease:flags=lanczos,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2:black"
      : "scale=" + W + ":" + H + ":force_original_aspect_ratio=increase:flags=lanczos,crop=" + W + ":" + H;
    // tpad : prolonge la dernière image pour que chaque clip ait exactement sa durée (sinon un fondu xfade qui
    // dépasse la fin réelle du clip interrompt le film)
    // Agrandissement : Lanczos + netteté (unsharp) selon le réglage « Agrandissement » de l'Assemblage
    var upF = o.up === "off" ? "" : ",unsharp=5:5:" + (o.up === "tresnet" ? "0.9" : "0.5") + ":5:5:0";
    function vfFor(c) { return scaleF + upF + (c.graded && gradeF ? "," + gradeF : "") + ",setsar=1,fps=" + FPS + (c.kind === "video" ? ",tpad=stop_mode=clone:stop_duration=5" : "") + ",format=yuv420p"; }
    var enc = "-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 -b:a 192k";
    var zip = new JSZip(), clips = [], chain = Promise.resolve();
    core.toast("Préparation du kit FFmpeg…");
    // Étalonnage (extension Étalonnage) et LUT .cube éventuelle
    if (grade) chain = chain.then(function () {
      return (grade.lutKey ? core.store.get(grade.lutKey) : Promise.resolve(null)).then(function (lut) {
        if (lut) zip.file("luts/grade.cube", lut);
        gradeF = App.gradeFfmpeg(grade, lut ? "luts/grade.cube" : "");
      });
    });
    // Musiques / ambiances / bruitages (extension Musique)
    var beds = [];
    (proj.audioBeds || []).forEach(function (b, k) {
      if (!b.key || b.mute) return;
      chain = chain.then(function () { return core.store.get(b.key).then(function (bl) {
        if (!bl) return;
        var f = "musique/" + String(k + 1).padStart(2, "0") + "." + App.audioExt(bl); zip.file(f, bl);
        beds.push({ b: b, file: f });
      }); });
    });

    plan.forEach(function (it, k) {
      chain = chain.then(function () {
        return core.getTakeBlob(it.take.id).then(function (b) {
          if (!b && it.take.remoteUrl) return fetch(it.take.remoteUrl).then(function (r) { return r.ok ? r.blob() : null; }).catch(function () { return null; });
          return b;
        }).then(function (blob) {
          if (!blob) return;
          var num = String(k + 1).padStart(2, "0"), ext = it.kind === "video" ? "mp4" : "png";
          zip.file("clips/" + num + "." + ext, blob);
          var c = { num: num, file: "clips/" + num + "." + ext, kind: it.kind, trans: it.trans, tdur: it.tdur, shotId: it.shot.id, graded: !!grade && !skipGrade.has(it.shot.id) };
          var voiceP = !it.voice ? Promise.resolve() : core.store.get(it.voice.key).then(function (vb) {
            if (!vb) return;
            var vfile = "voix/" + num + "." + App.audioExt(vb); zip.file(vfile, vb);
            c.voice = { dur: Number(it.voice.dur) || 0, file: vfile, delay: Math.round(Math.max(0, Number(it.voice.offset) || 0) * 1000), vol: it.voice.volume == null ? 1 : Number(it.voice.volume), duck: it.voice.duck == null ? 0.35 : Number(it.voice.duck) };
          });
          return voiceP.then(function () {
            if (it.kind === "image") { c.len = it.still; clips.push(c); return; }
            return self.videoDuration(blob).then(function (d) {
              c.tin = Math.min(it.tin || 0, Math.max(0, d - 0.2));
              c.len = Math.max(0.2, (it.tout == null ? d : Math.min(d, it.tout)) - c.tin);
              clips.push(c);
            });
          });
        });
      });
    });

    chain.then(function () {
      if (!clips.length) throw new Error("aucun clip disponible localement");
      var norm = [];
      clips.forEach(function (c) { c.len = Math.max(1 / FPS, Math.round(c.len * FPS) / FPS); });
      clips.forEach(function (c) {
        var final = "work/" + c.num + ".mp4", out = c.voice ? "work/" + c.num + "_src.mp4" : final, len = c.len.toFixed(3);
        if (c.kind === "image") {
          norm.push('ffmpeg -y -loop 1 -i "' + c.file + '" -f lavfi -i anullsrc=r=48000:cl=stereo -t ' + len + ' -vf "' + vfFor(c) + '" ' + enc + ' -map 0:v -map 1:a "' + out + '"');
        } else {
          var cut = "-ss " + c.tin.toFixed(3) + ' -i "' + c.file + '"';
          var silent = "ffmpeg -y " + cut + ' -f lavfi -i anullsrc=r=48000:cl=stereo -t ' + len + ' -vf "' + vfFor(c) + '" ' + enc + ' -map 0:v:0 -map 1:a "' + out + '"';
          if (o.audio) norm.push("ffmpeg -y " + cut + " -t " + len + ' -vf "' + vfFor(c) + '" ' + enc + ' -af apad -map 0:v:0 -map 0:a:0 "' + out + '" || ' + silent);
          else norm.push(silent);
        }
        if (c.voice) {
          // Voix-off / dialogue : décalée, son du clip atténué (ducking), durée = celle du clip
          var fc = "[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=" + c.voice.delay + "|" + c.voice.delay + ",volume=" + c.voice.vol.toFixed(2) + "[vo];" +
            "[0:a]volume=" + c.voice.duck.toFixed(2) + "[bg];[bg][vo]amix=inputs=2:duration=first:normalize=0[a]";
          norm.push('ffmpeg -y -i "' + out + '" -i "' + c.voice.file + '" -filter_complex "' + fc + '" -map 0:v -map "[a]" -c:v copy -c:a aac -ar 48000 -ac 2 -b:a 192k "' + final + '"');
        }
      });

      var allCut = clips.every(function (c, i) { return i === clips.length - 1 || c.trans === "cut"; });
      var finalCmd, filter = "";
      if (allCut) {
        zip.file("liste.txt", clips.map(function (c) { return "file 'work/" + c.num + ".mp4'"; }).join("\n"));
        finalCmd = 'ffmpeg -y -f concat -safe 0 -i liste.txt -c copy -movflags +faststart "film_final.mp4"';
      } else {
        // Chaîne xfade (image) + acrossfade (son). Un « cut » devient un fondu de deux images (invisible ; une seule image fait échouer xfade).
        var inputs = clips.map(function (c) { return '-i "work/' + c.num + '.mp4"'; }).join(" ");
        var acc = clips[0].len, vPrev = "[0:v]", aPrev = "[0:a]", parts = [];
        for (var i = 1; i < clips.length; i++) {
          var prev = clips[i - 1], cur = clips[i];
          var type = prev.trans === "fade" ? "fade" : prev.trans === "black" ? "fadeblack" : "fade";
          var d = prev.trans === "cut" ? 2 / FPS : Math.min(prev.tdur || 0.6, prev.len / 2, cur.len / 2);
          var off = Math.max(0, acc - d), vOut = i === clips.length - 1 ? "[v]" : "[v" + i + "]", aOut = i === clips.length - 1 ? "[a]" : "[a" + i + "]";
          parts.push(vPrev + "[" + i + ":v]xfade=transition=" + type + ":duration=" + d.toFixed(3) + ":offset=" + off.toFixed(3) + vOut);
          parts.push(aPrev + "[" + i + ":a]acrossfade=d=" + d.toFixed(3) + aOut);
          vPrev = vOut; aPrev = aOut; acc = acc + cur.len - d;
        }
        filter = parts.join(";\n");
        zip.file("filtre.txt", filter);
        finalCmd = "ffmpeg -y " + inputs + ' -filter_complex_script filtre.txt -map "[v]" -map "[a]" ' + enc + ' -movflags +faststart "film_final.mp4"';
      }

      // Position de chaque clip dans le film (mêmes chevauchements que ci-dessus)
      var starts = [0];
      for (var j = 1; j < clips.length; j++) {
        var pj = clips[j - 1], dj = allCut ? 0 : (pj.trans === "cut" ? 2 / FPS : Math.min(pj.tdur || 0.6, pj.len / 2, clips[j].len / 2));
        starts[j] = starts[j - 1] + pj.len - dj;
      }
      var filmLen = starts[clips.length - 1] + clips[clips.length - 1].len, mixCmd = null;
      if (beds.length) {
        // Fenêtres où une voix parle → atténuation des musiques/ambiances
        var voiceWin = [];
        clips.forEach(function (c, i) {
          if (!c.voice) return;
          var a = starts[i] + c.voice.delay / 1000, b = Math.min(starts[i] + c.len, a + (c.voice.dur || c.len));
          if (b > a) voiceWin.push([a, b]);
        });
        var bparts = [], labels = ["[0:a]"], binputs = [];
        beds.forEach(function (bd, k) {
          var b = bd.b, fromI = clips.findIndex(function (c) { return c.shotId === b.from; }), toI = clips.findIndex(function (c) { return c.shotId === b.to; });
          var st = (fromI >= 0 ? starts[fromI] : 0) + Math.max(0, Number(b.delay) || 0), en = toI >= 0 ? starts[toI] + clips[toI].len : filmLen;
          if (en <= st) en = filmLen;
          var L = en - st, fi = Math.min(Number(b.fadeIn) || 0, L / 2), fo = Math.min(Number(b.fadeOut) || 0, L / 2);
          var duck = b.duck == null ? 0.4 : Number(b.duck), vol = b.volume == null ? 0.6 : Number(b.volume);
          binputs.push((b.loop ? "-stream_loop -1 " : "") + '-i "' + bd.file + '"');
          var f = "[" + (k + 1) + ":a]atrim=start=" + (Math.max(0, Number(b.offset) || 0)).toFixed(3) + ":duration=" + L.toFixed(3) + ",asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo";
          if (fi > 0) f += ",afade=t=in:st=0:d=" + fi.toFixed(3);
          if (fo > 0) f += ",afade=t=out:st=" + (L - fo).toFixed(3) + ":d=" + fo.toFixed(3);
          f += ",volume=" + vol.toFixed(2);
          var w = voiceWin.map(function (x) { return [x[0] - st, x[1] - st]; }).filter(function (x) { return x[1] > 0 && x[0] < L; });
          if (duck < 1 && w.length) f += ",volume='if(" + w.map(function (x) { return "between(t," + Math.max(0, x[0]).toFixed(2) + "," + x[1].toFixed(2) + ")"; }).join("+") + "," + duck.toFixed(2) + ",1)':eval=frame";
          var ms = Math.round(st * 1000); f += ",adelay=" + ms + "|" + ms + "[b" + k + "]";
          bparts.push(f); labels.push("[b" + k + "]");
        });
        bparts.push(labels.join("") + "amix=inputs=" + labels.length + ":duration=first:normalize=0[a]");
        zip.file("musique_filtre.txt", bparts.join(";\n"));
        finalCmd = finalCmd.replace('"film_final.mp4"', '"work/film_sans_musique.mp4"');
        mixCmd = 'ffmpeg -y -i "work/film_sans_musique.mp4" ' + binputs.join(" ") + ' -filter_complex_script musique_filtre.txt -map 0:v -map "[a]" -c:v copy -c:a aac -ar 48000 -ac 2 -b:a 192k -movflags +faststart "film_final.mp4"';
      }
      var tail = [finalCmd].concat(mixCmd ? [mixCmd] : []);
      // Sous-titres AutoCaption : incrustés en dernier (fichier sous-titres.ass), aux positions réelles des plans du kit
      var capPlugin = window.AgnesPlugins && AgnesPlugins.get("captions"), capAss = null;
      if (capPlugin && capPlugin.kitAss) {
        capAss = capPlugin.kitAss(W, H, clips.map(function (c, i) { return { t: starts[i], len: c.len, shot: proj.shots.find(function (s) { return s.id === c.shotId; }) || {} }; }));
        if (capAss) {
          zip.file("sous-titres.ass", capAss);
          var lastI = tail.length - 1;
          tail[lastI] = tail[lastI].replace('"film_final.mp4"', '"work/film_sans_sous_titres.mp4"');
          tail.push('ffmpeg -y -i "work/film_sans_sous_titres.mp4" -vf "ass=sous-titres.ass" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a copy -movflags +faststart "film_final.mp4"');
        }
      }

      var bat = ["@echo off", "chcp 65001 >nul", 'cd /d "%~dp0"', "where ffmpeg >nul 2>nul || (echo FFmpeg est introuvable. Installez-le : https://www.gyan.dev/ffmpeg/builds/ puis relancez. & pause & exit /b 1)",
        "if not exist work mkdir work", "echo Preparation des clips..."].concat(norm, ["echo Assemblage du film..."], tail, ["echo.", "echo Termine : film_final.mp4", "pause"]).join("\r\n");
      var sh = ["#!/usr/bin/env bash", "set -e", 'cd "$(dirname "$0")"', "command -v ffmpeg >/dev/null || { echo 'FFmpeg est introuvable (brew install ffmpeg / apt install ffmpeg)'; exit 1; }",
        "mkdir -p work", "echo 'Préparation des clips…'"].concat(norm, ["echo 'Assemblage du film…'"], tail, ["echo 'Terminé : film_final.mp4'"]).join("\n");
      zip.file("montage.bat", bat);
      zip.file("montage.sh", sh, { unixPermissions: "755" });
      zip.file("LISEZMOI.txt", [
        "Kit de montage — " + proj.name, "",
        "1. Installez FFmpeg (Windows : https://www.gyan.dev/ffmpeg/builds/ , ajoutez le dossier bin au PATH).",
        "2. Décompressez ce dossier, puis double-cliquez sur montage.bat (Windows) ou lancez ./montage.sh (Mac/Linux).",
        "3. Le film final est film_final.mp4, en " + W + "x" + H + " à " + FPS + " i/s.", "",
        "Réglages repris de l'onglet Assemblage : format, cadrage, transitions, découpes début/fin, durée des images fixes.",
        o.audio ? "Son : le son de chaque clip est gardé ; un clip sans son reçoit un silence." : "Son : désactivé (silence).",
        grade ? "Étalonnage : repris de l'extension Étalonnage" + (grade.lutKey ? " (avec la LUT luts/grade.cube)" : "") + "." : "",
        beds.length ? "Musiques / ambiances : " + beds.length + " piste(s) du dossier musique/, mixées à la fin (fondus, boucle, atténuation sous les voix)." : "",
        capAss ? "Sous-titres : sous-titres.ass (AutoCaption) est incrusté à la fin. Si la police choisie manque sur ce PC, une police voisine est utilisée ; le fichier s'ouvre aussi dans CapCut ou Premiere." : "",
        clips.some(function (c) { return c.voice; }) ? "Voix : les voix-off/dialogues du dossier voix/ sont mixées sur leur plan (décalage, volume et atténuation du son du clip repris de l'extension Voix)." : ""
      ].join("\r\n"));
      return zip.generateAsync({ type: "blob", platform: "UNIX" });
    }).then(function (blob) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = window.AgnesApp.slugify(proj.name) + "_kit-ffmpeg.zip"; document.body.appendChild(a); a.click(); a.remove();
      core.toast("Kit FFmpeg exporté.", "ok");
    }).catch(function (e) { core.toast("Export du kit impossible : " + (e.message || e), "err"); });
  }
});
