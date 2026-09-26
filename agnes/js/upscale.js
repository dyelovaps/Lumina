// js/upscale.js — Agrandissement d'image/vidéo sur la carte graphique (WebGL)
// Passe 1 : rééchantillonnage bicubique Catmull-Rom (plus net que le lissage bilinéaire du navigateur)
// Passe 2 : netteté adaptative au contraste (principe du CAS d'AMD : renforce les détails fins sans halos)
// Ce n'est pas une IA : l'image devient plus grande et plus nette, mais aucun détail n'est inventé.
(function () {
  "use strict";
  var A = window.AgnesApp;

  var VS = "attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }";
  // Catmull-Rom 4×4 sur une zone (crop) de la texture source
  var FS_BICUBIC = [
    "precision highp float; varying vec2 uv; uniform sampler2D tex; uniform vec2 texSize; uniform vec4 crop;",
    "vec4 cubic(float x){ float x2=x*x, x3=x2*x; return vec4(-0.5*x3+x2-0.5*x, 1.5*x3-2.5*x2+1.0, -1.5*x3+2.0*x2+0.5*x, 0.5*x3-0.5*x2); }",
    "void main(){",
    "  vec2 src = (crop.xy + uv * crop.zw) * texSize - 0.5;",
    "  vec2 f = fract(src); vec2 i = floor(src);",
    "  vec4 wx = cubic(f.x), wy = cubic(f.y); vec4 c = vec4(0.0);",
    "  for (int y = -1; y <= 2; y++) { vec4 row = vec4(0.0);",
    "    for (int x = -1; x <= 2; x++) {",
    "      vec2 t = clamp((i + vec2(float(x), float(y)) + 0.5) / texSize, 0.5 / texSize, 1.0 - 0.5 / texSize);",
    "      float w = x == -1 ? wx.x : x == 0 ? wx.y : x == 1 ? wx.z : wx.w;",
    "      row += texture2D(tex, t) * w; }",
    "    c += row * (y == -1 ? wy.x : y == 0 ? wy.y : y == 1 ? wy.z : wy.w); }",
    "  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);",
    "}"].join("\n");
  // Netteté adaptative (contrast adaptive sharpening)
  var FS_CAS = [
    "precision highp float; varying vec2 uv; uniform sampler2D tex; uniform vec2 px; uniform float sharp;",
    "vec3 s(vec2 o){ return texture2D(tex, uv + o * px).rgb; }",
    "void main(){",
    "  vec3 a=s(vec2(-1.,-1.)), b=s(vec2(0.,-1.)), c=s(vec2(1.,-1.)), d=s(vec2(-1.,0.)), e=s(vec2(0.,0.)), f=s(vec2(1.,0.)), g=s(vec2(-1.,1.)), h=s(vec2(0.,1.)), i=s(vec2(1.,1.));",
    "  vec3 mn = min(min(min(d,e),min(f,b)),h); vec3 mn2 = min(mn, min(min(a,c),min(g,i))); mn += mn2;",
    "  vec3 mx = max(max(max(d,e),max(f,b)),h); vec3 mx2 = max(mx, max(max(a,c),max(g,i))); mx += mx2;",
    "  vec3 amp = sqrt(clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));",
    "  vec3 w = amp * (-1.0 / mix(8.0, 5.0, sharp));",
    "  vec3 o = (b*w + d*w + f*w + h*w + e) / (1.0 + 4.0*w);",
    "  gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);",
    "}"].join("\n");

  function Upscaler() {
    var canvas = document.createElement("canvas"), gl = null;
    try { gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false }); } catch (e) { gl = null; }
    this.canvas = canvas; this.gl = gl; this.ok = !!gl;
    if (!gl) return;
    function prog(fs) {
      var p = gl.createProgram();
      [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]].forEach(function (x) {
        var sh = gl.createShader(x[0]); gl.shaderSource(sh, x[1]); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
      });
      gl.linkProgram(p); return p;
    }
    try { this.pBic = prog(FS_BICUBIC); this.pCas = prog(FS_CAS); } catch (e) { console.warn("[Agrandissement] WebGL indisponible :", e); this.ok = false; return; }
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    function tex() {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    this.srcTex = tex(); this.midTex = tex(); this.fbo = gl.createFramebuffer(); this.mid = { w: 0, h: 0 };
  }
  // Agrandit la zone crop {x,y,w,h} (pixels de la source) vers outW × outH. Renvoie le canvas WebGL, à dessiner aussitôt.
  Upscaler.prototype.render = function (src, srcW, srcH, crop, outW, outH, sharp) {
    var gl = this.gl; outW = Math.max(1, Math.round(outW)); outH = Math.max(1, Math.round(outH));
    if (this.canvas.width !== outW) this.canvas.width = outW;
    if (this.canvas.height !== outH) this.canvas.height = outH;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (this.mid.w !== outW || this.mid.h !== outH) {
      gl.bindTexture(gl.TEXTURE_2D, this.midTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, outW, outH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.mid = { w: outW, h: outH };
    }
    function draw(p) {
      gl.useProgram(p); var loc = gl.getAttribLocation(p, "p");
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // Passe 1 → texture intermédiaire (crop exprimé en coordonnées de texture, origine en bas avec FLIP_Y)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.midTex, 0);
    gl.viewport(0, 0, outW, outH);
    gl.useProgram(this.pBic); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(gl.getUniformLocation(this.pBic, "tex"), 0);
    gl.uniform2f(gl.getUniformLocation(this.pBic, "texSize"), srcW, srcH);
    gl.uniform4f(gl.getUniformLocation(this.pBic, "crop"), crop.x / srcW, 1 - (crop.y + crop.h) / srcH, crop.w / srcW, crop.h / srcH);
    draw(this.pBic);
    // Passe 2 → écran, avec netteté
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, outW, outH);
    gl.useProgram(this.pCas); gl.bindTexture(gl.TEXTURE_2D, this.midTex);
    gl.uniform1i(gl.getUniformLocation(this.pCas, "tex"), 0);
    gl.uniform2f(gl.getUniformLocation(this.pCas, "px"), 1 / outW, 1 / outH);
    gl.uniform1f(gl.getUniformLocation(this.pCas, "sharp"), sharp == null ? 0.5 : sharp);
    draw(this.pCas);
    return this.canvas;
  };
  A.UPSCALE_MODES = [["net", "Net — bicubique + netteté adaptative (conseillé)"], ["tresnet", "Très net"], ["off", "Simple — lissage du navigateur"]];
  A.upscaleSharpness = function (mode) { return mode === "tresnet" ? 0.9 : mode === "off" ? null : 0.45; };
  var shared = null;
  A.getUpscaler = function () { if (!shared) shared = new Upscaler(); return shared.ok ? shared : null; };

  // Dessine src dans ctx (W×H) en « remplir » ou « adapter », avec agrandissement de qualité si mode ≠ off
  A.drawScaled = function (ctx, src, sw, sh, W, H, fit, zoom, mode) {
    var s = (fit === "contain" ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh)) * (zoom || 1);
    var w = sw * s, h = sh * s, dx = (W - w) / 2, dy = (H - h) / 2;
    var x0 = Math.max(0, dx), y0 = Math.max(0, dy), x1 = Math.min(W, dx + w), y1 = Math.min(H, dy + h);
    if (x1 <= x0 || y1 <= y0) return;
    var crop = { x: (x0 - dx) / s, y: (y0 - dy) / s, w: (x1 - x0) / s, h: (y1 - y0) / s };
    var sharp = A.upscaleSharpness(mode), up = sharp != null && s > 1.02 ? A.getUpscaler() : null;
    if (up) {
      try { ctx.drawImage(up.render(src, sw, sh, crop, x1 - x0, y1 - y0, sharp), x0, y0, x1 - x0, y1 - y0); return; }
      catch (e) { console.warn("[Agrandissement]", e); }
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, x0, y0, x1 - x0, y1 - y0);
  };

  // Réencode une vidéo agrandie (petit côté = targetShort px), en temps réel, avec son
  A.exportUpscaledVideo = function (blob, targetShort, mode, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { reject(new Error("Ce navigateur ne sait pas enregistrer une vidéo (Chrome ou Edge récents).")); return; }
      var url = URL.createObjectURL(blob), v = document.createElement("video");
      v.src = url; v.playsInline = true; v.preload = "auto";
      v.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Vidéo illisible.")); };
      v.onloadedmetadata = function () {
        var sw = v.videoWidth, sh = v.videoHeight, k = targetShort / Math.min(sw, sh);
        var W = Math.round(sw * k / 2) * 2, H = Math.round(sh * k / 2) * 2;
        var canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext("2d"), stream = canvas.captureStream(30), ac = null;
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          var dest = ac.createMediaStreamDestination(); ac.createMediaElementSource(v).connect(dest);
          dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); });
        } catch (e) { v.muted = true; }
        var mime = A.pickVideoMime(), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : { videoBitsPerSecond: 12e6 });
        var chunks = [], done = false;
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          URL.revokeObjectURL(url); if (ac) ac.close();
          resolve({ blob: new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }), w: W, h: H });
        };
        function frame() {
          if (done) return;
          A.drawScaled(ctx, v, sw, sh, W, H, "contain", 1, mode);
          if (onProgress && v.duration) onProgress(v.currentTime / v.duration);
          if (v.ended) { done = true; setTimeout(function () { rec.stop(); }, 120); return; }
          requestAnimationFrame(frame);
        }
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        rec.start(500);
        (ac ? ac.resume() : Promise.resolve()).then(function () { return v.play(); }).then(function () { requestAnimationFrame(frame); })
          .catch(function (e) { done = true; try { rec.stop(); } catch (x) { } reject(e); });
      };
    });
  };
})();
