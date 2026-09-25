/* ============================================================
   LMK MARKETING — lmk3d.js
   A tiny custom WebGL engine (no libraries, no third-party requests).

   Story: the extruded LMK logo floats in the hero → as you scroll it
   splits into its four pieces, which tumble along the page edges while
   purple crystals and dust fly past → at the footer the pieces fly back
   and lock into the giant LMK outline.

   Safety / performance:
   - Skipped entirely for reduced-motion, data-saver or no WebGL
     (the page then shows the static SVG logo instead).
   - Pauses when the tab is hidden or "Pause animations" is pressed.
   - Objects near the centre of the screen are dimmed so text stays readable.
   ============================================================ */

const canvas = document.getElementById('gl3d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const conn = navigator.connection || {};
const saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');

if (canvas && !reduceMotion && !saveData) init();

function init() {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return;

  /* ---------------- math ---------------- */
  const M4 = {
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
      return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
    },
    lookAt(e, c, up) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
    },
    // model = T * Rz * Ry * Rx * S  (uniform scale) — also returns the 3x3 rotation for normals
    trs(px, py, pz, rx, ry, rz, s, out, nOut) {
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
      const r00 = cz * cy, r01 = cz * sy * sx - sz * cx, r02 = cz * sy * cx + sz * sx;
      const r10 = sz * cy, r11 = sz * sy * sx + cz * cx, r12 = sz * sy * cx - cz * sx;
      const r20 = -sy, r21 = cy * sx, r22 = cy * cx;
      out[0] = r00 * s; out[1] = r10 * s; out[2] = r20 * s; out[3] = 0;
      out[4] = r01 * s; out[5] = r11 * s; out[6] = r21 * s; out[7] = 0;
      out[8] = r02 * s; out[9] = r12 * s; out[10] = r22 * s; out[11] = 0;
      out[12] = px; out[13] = py; out[14] = pz; out[15] = 1;
      nOut[0] = r00; nOut[1] = r10; nOut[2] = r20; nOut[3] = r01; nOut[4] = r11; nOut[5] = r21; nOut[6] = r02; nOut[7] = r12; nOut[8] = r22;
    }
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // deterministic random so the layout is identical on every visit
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------------- geometry ---------------- */
  // exact LMK logo polygons (viewBox 0 0 795 284)
  const PIECES = [
    [[0, 0], [41, 0], [41, 242], [233, 242], [233, 283], [0, 283]],
    [[217, 0], [217, 57], [364, 206], [476, 96], [476, 283], [517, 283], [517, 0], [365, 150]],
    [[793, 0], [739, 0], [570, 171], [570, 225]],
    [[647, 188], [739, 283], [794, 283], [674, 162]]
  ];
  const LOGO_W = 795, LOGO_H = 284, DEPTH = 0.085;   // depth relative to logo width = 1

  function area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
  function earClip(pts) {            // pts CCW, returns index triples
    const idx = pts.map((_, i) => i), tris = [];
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
    let guard = 0;
    while (idx.length > 3 && guard++ < 500) {
      for (let i = 0; i < idx.length; i++) {
        const i0 = idx[(i + idx.length - 1) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        if (cross(a, b, c) <= 0) continue;               // reflex corner
        let ear = true;
        for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; if (inside(pts[j], a, b, c)) { ear = false; break; } }
        if (!ear) continue;
        tris.push([i0, i1, i2]); idx.splice(i, 1); break;
      }
    }
    tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }
  // extrude one logo piece; geometry is centred on the piece's own centroid
  function extrudePiece(poly) {
    let pts = poly.map(([x, y]) => [(x - LOGO_W / 2) / LOGO_W, -(y - LOGO_H / 2) / LOGO_W]);
    if (area(pts) < 0) pts = pts.reverse();
    let cx = 0, cy = 0; pts.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
    pts = pts.map(p => [p[0] - cx, p[1] - cy]);
    const pos = [], nor = [], h = DEPTH / 2;
    const push = (p, n) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); };
    for (const [a, b, c] of earClip(pts)) {             // front + back caps
      push([pts[a][0], pts[a][1], h], [0, 0, 1]); push([pts[b][0], pts[b][1], h], [0, 0, 1]); push([pts[c][0], pts[c][1], h], [0, 0, 1]);
      push([pts[a][0], pts[a][1], -h], [0, 0, -1]); push([pts[c][0], pts[c][1], -h], [0, 0, -1]); push([pts[b][0], pts[b][1], -h], [0, 0, -1]);
    }
    for (let i = 0; i < pts.length; i++) {              // side walls
      const p = pts[i], q = pts[(i + 1) % pts.length];
      let nx = q[1] - p[1], ny = -(q[0] - p[0]); const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      const n = [nx, ny, 0];
      push([p[0], p[1], h], n); push([p[0], p[1], -h], n); push([q[0], q[1], -h], n);
      push([p[0], p[1], h], n); push([q[0], q[1], -h], n); push([q[0], q[1], h], n);
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), cx, cy };
  }
  // faceted crystals (flat normals)
  function faceted(verts, faces) {
    const pos = [], nor = [];
    for (const [a, b, c] of faces) {
      const A = verts[a], B = verts[b], C = verts[c];
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      for (const V of [A, B, C]) { pos.push(V[0], V[1], V[2]); nor.push(nx, ny, nz); }
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor) };
  }
  const octa = (sy) => faceted([[1, 0, 0], [-1, 0, 0], [0, sy, 0], [0, -sy, 0], [0, 0, 1], [0, 0, -1]],
    [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]);
  const tetra = () => faceted([[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]);
  const prism = () => {
    const v = [], k = 0.8;
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; v.push([Math.cos(a), k * 1.6, Math.sin(a)], [Math.cos(a), -k * 1.6, Math.sin(a)]); }
    return faceted(v, [[0, 2, 4], [1, 5, 3], [0, 1, 3], [0, 3, 2], [2, 3, 5], [2, 5, 4], [4, 5, 1], [4, 1, 0]]);
  };

  /* ---------------- shaders ---------------- */
  const VS = `
    attribute vec3 aPos; attribute vec3 aNor;
    uniform mat4 uModel, uView, uProj; uniform mat3 uNrm;
    varying vec3 vN; varying vec3 vW;
    void main(){ vec4 w = uModel * vec4(aPos,1.0); vW = w.xyz; vN = uNrm * aNor; gl_Position = uProj * uView * w; }`;
  const FS = `
    precision highp float;
    varying vec3 vN; varying vec3 vW;
    uniform vec3 uCam, uBase, uRim, uDimP; uniform float uGloss, uRefl, uAlpha, uCenterDim; uniform vec2 uRes;
    void main(){
      vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
      vec3 V = normalize(uCam - vW);
      vec3 L1 = normalize(vec3(-.45,.8,.6)), L2 = normalize(vec3(.6,-.55,.45));
      float d1 = max(dot(N,L1),0.), d2 = max(dot(N,L2),0.);
      float s1 = pow(max(dot(N,normalize(L1+V)),0.), uGloss);
      float s2 = pow(max(dot(N,normalize(L2+V)),0.), uGloss*.6);
      float fr = pow(1. - max(dot(N,V),0.), 3.);
      vec3 R = reflect(-V,N);
      vec3 env = mix(vec3(.16,.04,.36), vec3(1.,.97,1.), smoothstep(-.15,.9,R.y));
      env += vec3(.9,.75,1.) * pow(max(dot(R, normalize(vec3(-.6,.3,.75))),0.), 24.) * 1.3;
      vec3 amb = vec3(.20,.07,.38);
      vec3 col = uBase * (amb + d1*vec3(1.,.97,1.)*1.15 + d2*vec3(.55,.36,1.)*.75);
      col = mix(col, env*uBase*1.15 + env*.12, uRefl);
      col += s1*vec3(1.)*.85 + s2*vec3(.6,.45,1.)*.5;
      col += fr*uRim*1.1;
      col += fr*.3*(.5+.5*cos(6.2831*(fr+vec3(0.,.33,.67)) + R.y*2.));
      // readability: dim whatever sits behind the text column (left/centre on desktop, everywhere but the edges on phones)
      float xn = gl_FragCoord.x/uRes.x;
      float zone = uDimP.x > .5 ? xn : abs(xn - .5)*2.;
      float dim = mix(uCenterDim, 1., smoothstep(uDimP.y, uDimP.z, zone));
      col = min(col, vec3(1.2)) * dim;
      gl_FragColor = vec4(col, uAlpha * mix(.45, 1., dim));
    }`;
  const PVS = `
    attribute vec3 aPos; attribute float aSeed;
    uniform mat4 uView, uProj; uniform float uTime, uScroll, uSpan, uPx;
    varying float vA;
    void main(){
      vec3 p = aPos;
      float sp = .35 + aSeed*.65;
      p.y = mod(aPos.y + uScroll*sp + uTime*.06*sp + uSpan*.5, uSpan) - uSpan*.5;
      p.x += sin(uTime*.25 + aSeed*40.)*.15;
      vec4 v = uView * vec4(p,1.);
      gl_Position = uProj * v;
      gl_PointSize = (2. + aSeed*4.5) * uPx / max(.5, -v.z) * 13.;
      vA = (.35 + .65*(.5+.5*sin(uTime*(1.+aSeed*2.) + aSeed*90.))) * smoothstep(-14., -4., v.z);
    }`;
  const PFS = `
    precision mediump float; varying float vA;
    void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(vec3(.86,.78,1.)*a, a); }`;

  function program(vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u, aPos: gl.getAttribLocation(p, 'aPos'), aNor: gl.getAttribLocation(p, 'aNor'), aSeed: gl.getAttribLocation(p, 'aSeed') };
  }
  // "inside the screen" tunnel: glowing screen-shaped frames + rails, drawn as additive lines
  const LVS = `
    attribute vec3 aPos; uniform mat4 uView, uProj; uniform float uZ;
    void main(){ gl_Position = uProj * uView * vec4(aPos.xy, aPos.z + uZ, 1.0); }`;
  const LFS = `
    precision mediump float; uniform vec4 uCol;
    void main(){ gl_FragColor = vec4(uCol.rgb * uCol.a, uCol.a); }`;

  let prog, pprog, lprog;
  try { prog = program(VS, FS); pprog = program(PVS, PFS); lprog = program(LVS, LFS); } catch (e) { return; }   // fall back to the SVG logo

  function mesh(g) {
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.STATIC_DRAW);
    return { pb, nb, count: g.pos.length / 3 };
  }

  /* ---------------- scene ---------------- */
  const isMobile = () => window.innerWidth <= 900;
  const pieceGeo = PIECES.map(extrudePiece);
  const pieces = pieceGeo.map((g, i) => ({
    mesh: mesh(g), cx: g.cx, cy: g.cy,
    // where each piece flies to while you read (fractions of the half-screen), and how it tumbles
    ex: [[-1.02, 0.55], [1.04, -0.15], [1.0, 0.62], [-1.0, -0.62]][i],   // half off-screen: they peek in from the edges
    ez: [-1.6, -2.2, -1.2, -1.9][i],
    spin: [[0.9, 1.3, 0.4], [-1.1, 0.8, -0.6], [0.7, -1.2, 0.9], [-0.8, -0.9, -1.1]][i],
    ph: i * 1.7
  }));
  const shapeMeshes = [mesh(octa(1.0)), mesh(octa(1.9)), mesh(tetra()), mesh(prism())];
  const PAL = [[0.46, 0.27, 0.94], [0.29, 0.09, 0.59], [0.69, 0.55, 1.0], [0.85, 0.76, 1.0], [0.55, 0.36, 1.0]];
  const crystals = [];
  const NC = 18;
  for (let i = 0; i < NC; i++) {
    // "edge" crystals live in the outer margins (partly off-screen); "deep" ones sit far back and dim,
    // so nothing bright ever passes behind a line of text
    const back = rnd() < 0.4;
    const side = rnd() < 0.5 ? -1 : 1;
    crystals.push({
      m: shapeMeshes[Math.floor(rnd() * shapeMeshes.length)],
      xf: back ? (rnd() * 2 - 1) * 0.85 : side * (0.94 + rnd() * 0.14),
      yb: rnd(), z: back ? -6 - rnd() * 3 : -1.2 + rnd() * 2,
      back, s: back ? 0.12 + rnd() * 0.14 : 0.1 + rnd() * 0.16, col: PAL[Math.floor(rnd() * PAL.length)],
      ax: rnd() * 6.28, ay: rnd() * 6.28, az: rnd() * 6.28,
      sx: (rnd() - 0.5) * 0.9, sy: (rnd() - 0.5) * 1.1, sz: (rnd() - 0.5) * 0.7,
      glass: rnd() < 0.45, mobile: i % 2 === 0
    });
  }
  // dust particles
  const NP = 240, pp = new Float32Array(NP * 3), ps = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { pp[i * 3] = (rnd() * 2 - 1) * 9; pp[i * 3 + 1] = (rnd() * 2 - 1) * 8; pp[i * 3 + 2] = -1 - rnd() * 12; ps[i] = rnd(); }
  const pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pp, gl.STATIC_DRAW);
  const sBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.bufferData(gl.ARRAY_BUFFER, ps, gl.STATIC_DRAW);

  /* ---------------- state ---------------- */
  const FOV = 35 * Math.PI / 180, CAMZ = 10;
  let W = 0, H = 0, dpr = 1, upp = 0.01, proj;
  const stage = document.getElementById('heroStage');
  const footerWord = document.getElementById('footerWord');
  const hero = document.getElementById('top');
  let mx = 0, my = 0, tmx = 0, tmy = 0, scrollY = window.scrollY, lastScroll = scrollY, vel = 0, spinBoost = 0;
  let paused = false, visible = !document.hidden, t0 = performance.now(), tPaused = 0, pauseStart = 0, raf = 0, firstFrame = true;
  const model = new Float32Array(16), nrm = new Float32Array(9);

  const T_NEAR = 9.2, T_FAR = -44, T_SP = 3.4, T_N = Math.ceil((T_NEAR - T_FAR) / T_SP);
  const frameBuf = gl.createBuffer(), railBuf = gl.createBuffer();
  let frameCount = 0, railCount = 0;
  function buildTunnel(hw, hh) {
    const r = Math.min(hw, hh) * 0.13, seg = 10, pts = [];
    const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]];
    for (const [cx, cy, a0] of corners) for (let k = 0; k <= seg; k++) { const a = a0 + (k / seg) * Math.PI / 2; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0); }
    gl.bindBuffer(gl.ARRAY_BUFFER, frameBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    frameCount = pts.length / 3;
    const rails = [], ix = hw - r * 0.29, iy = hh - r * 0.29;
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) rails.push(sx * ix, sy * iy, T_FAR, sx * ix, sy * iy, T_NEAR);
    for (let k = -3; k <= 3; k++) {                   // faint floor + ceiling grid lines running into the distance
      const x = (k / 3.6) * hw;
      rails.push(x, -hh, T_FAR, x, -hh, T_NEAR, x, hh, T_FAR, x, hh, T_NEAR);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, railBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rails), gl.STATIC_DRAW);
    railCount = rails.length / 3;
  }
  // warp entrance: starts the moment the loading screen lifts
  const preloaderEl = document.getElementById('preloader');
  let warpStart = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 1.75);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    proj = M4.persp(FOV, W / H, 0.1, 60);
    upp = (2 * CAMZ * Math.tan(FOV / 2)) / H;           // world units per CSS pixel at z = 0
    buildTunnel((W / 2) * upp * 0.95, (H / 2) * upp * 0.93);
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { tmx = e.clientX / W - 0.5; tmy = e.clientY / H - 0.5; } }, { passive: true });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) loop(); });
  window.addEventListener('lmk:motion', (e) => {
    paused = e.detail.paused;
    if (paused) pauseStart = performance.now(); else { tPaused += performance.now() - pauseStart; loop(); }
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); canvas.classList.remove('ready'); document.documentElement.classList.remove('has-3d'); });

  function rectToWorld(r) {
    return { x: (r.left + r.width / 2 - W / 2) * upp, y: -(r.top + r.height / 2 - H / 2) * upp, w: r.width * upp };
  }

  function drawMesh(m, base, rim, gloss, refl, alpha, centerDim) {
    const u = prog.u;
    gl.uniformMatrix4fv(u.uModel, false, model); gl.uniformMatrix3fv(u.uNrm, false, nrm);
    gl.uniform3fv(u.uBase, base); gl.uniform3fv(u.uRim, rim);
    gl.uniform1f(u.uGloss, gloss); gl.uniform1f(u.uRefl, refl); gl.uniform1f(u.uAlpha, alpha); gl.uniform1f(u.uCenterDim, centerDim);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.vertexAttribPointer(prog.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nb); gl.vertexAttribPointer(prog.aNor, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, m.count);
  }

  const LOGO_BASE = [0.93, 0.89, 1.0], LOGO_RIM = [0.75, 0.55, 1.0];

  function frame(now) {
    const t = (now - t0 - tPaused) / 1000;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    vel = scrollY - lastScroll; lastScroll = scrollY;
    spinBoost += (clamp(vel * 0.004, -0.25, 0.25) - spinBoost) * 0.08;
    const mobile = isMobile();
    const halfW = (W / 2) * upp, halfH = (H / 2) * upp;

    const eye = [mx * 0.9, -my * 0.6, CAMZ];
    const view = M4.lookAt(eye, [0, 0, 0], [0, 1, 0]);

    // warp: when the loading screen lifts, the camera dives into the screen
    if (warpStart === null && (!preloaderEl || !preloaderEl.isConnected || preloaderEl.classList.contains('done'))) warpStart = t;
    const wk = warpStart === null ? 0 : clamp((t - warpStart) / 1.9, 0, 1);
    const warpEase = 1 - Math.pow(1 - wk, 3);
    const intro = warpStart === null ? 0 : smooth(0, 1, (t - warpStart) / 1.7);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND);

    /* ---- the screen tunnel: frames shaped like this device's screen rush past as you scroll ---- */
    gl.useProgram(lprog.p);
    gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.uniformMatrix4fv(lprog.u.uView, false, view); gl.uniformMatrix4fv(lprog.u.uProj, false, proj);
    gl.enableVertexAttribArray(lprog.aPos);
    const travel = scrollY * upp * 0.55 + t * 0.35 + warpEase * 42;
    const warpGlow = 1 + (1 - warpEase) * 2.2 * (warpStart === null ? 0 : 1);
    const base = (mobile ? 0.3 : 0.4) * warpGlow;
    const L = T_N * T_SP;
    gl.bindBuffer(gl.ARRAY_BUFFER, frameBuf); gl.vertexAttribPointer(lprog.aPos, 3, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < T_N; i++) {
      const z = T_FAR + (((i * T_SP + travel) % L) + L) % L;
      // invisible far away, brightens as it approaches, fades just before it passes the camera
      const a = base * smooth(-24, 3, z) * (1 - smooth(5.5, 9.1, z));
      if (a < 0.004) continue;
      gl.uniform4f(lprog.u.uCol, 0.78, 0.66, 1.0, a);
      gl.uniform1f(lprog.u.uZ, z); gl.drawArrays(gl.LINE_LOOP, 0, frameCount);
      gl.uniform1f(lprog.u.uZ, z + 0.02); gl.drawArrays(gl.LINE_LOOP, 0, frameCount);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, railBuf); gl.vertexAttribPointer(lprog.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(lprog.u.uZ, 0);
    gl.uniform4f(lprog.u.uCol, 0.62, 0.45, 1.0, (mobile ? 0.1 : 0.13) * warpGlow);
    gl.drawArrays(gl.LINES, 0, railCount);
    gl.disableVertexAttribArray(lprog.aPos);
    gl.depthMask(true);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(prog.p);
    gl.enableVertexAttribArray(prog.aPos); gl.enableVertexAttribArray(prog.aNor);
    gl.uniformMatrix4fv(prog.u.uView, false, view); gl.uniformMatrix4fv(prog.u.uProj, false, proj);
    gl.uniform3fv(prog.u.uCam, eye); gl.uniform2f(prog.u.uRes, canvas.width, canvas.height);
    gl.uniform3fv(prog.u.uDimP, mobile ? [0, 0.86, 1.0] : [0, 0.84, 0.97]);

    /* ---- logo: hero → exploded → footer ---- */
    let hs = null, fw = null;
    if (stage) { const r = stage.getBoundingClientRect(); if (r.width > 0) hs = rectToWorld(r); }
    if (footerWord) { const r = footerWord.getBoundingClientRect(); fw = rectToWorld(r); fw.f = clamp((H - r.top) / (r.height + H * 0.08), 0, 1); fw.w *= 795 / 803; }
    if (!hs) hs = { x: halfW * 0.45, y: 0, w: halfW * 0.8 };
    let e = 1;
    if (hero) { const hr = hero.getBoundingClientRect(); e = smooth(0.04, 0.7, -hr.top / Math.max(1, hr.height)); }
    const f = fw ? smooth(0, 1, fw.f) : 0;
    const expScale = hs.w * (mobile ? 0.4 : 0.4);
    const centerDimMid = mobile ? 0.22 : 0.26;

    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const sway = Math.sin(t * 0.6 + p.ph) * 0.04;
      // hero (assembled, gently floating + mouse tilt)
      const aS = hs.w, ax = hs.x + p.cx * aS, ay = hs.y + p.cy * aS + Math.sin(t * 0.8) * 0.06;
      const aRx = my * 0.35 + Math.sin(t * 0.5) * 0.06, aRy = mx * 0.6 + Math.sin(t * 0.35) * 0.18, aRz = 0;
      // exploded (tumbling at the screen edges)
      const drift = t * 0.12 + scrollY * 0.0009;
      const ex = p.ex[0] * halfW + Math.sin(drift + p.ph) * 0.35, ey = p.ex[1] * halfH + Math.cos(drift * 1.3 + p.ph) * 0.3;
      const spinT = t * 0.22 + scrollY * 0.0016 + spinBoost * 3;
      const eRx = p.spin[0] * spinT, eRy = p.spin[1] * spinT, eRz = p.spin[2] * spinT;
      // footer (locked into the outline)
      let fx = 0, fy = 0, fS = aS;
      if (fw) { fS = fw.w; fx = fw.x + p.cx * fS; fy = fw.y + p.cy * fS; }

      let x = lerp(ax, ex, e), y = lerp(ay, ey, e), z = lerp(0, p.ez, e) + sway - (1 - intro) * (30 + i * 4);
      let s = lerp(aS, expScale, e);
      let rx = lerp(aRx, eRx, e), ry = lerp(aRy, eRy, e) + (1 - intro) * (2.4 + i * 0.5), rz = lerp(aRz, eRz, e) + (1 - intro) * (i % 2 ? 1.2 : -1.2);
      if (f > 0) {
        x = lerp(x, fx, f); y = lerp(y, fy, f); z = lerp(z, 0, f); s = lerp(s, fS, f);
        rx = lerp(rx, mx * 0.15, f); ry = lerp(ry, mx * 0.25, f); rz = lerp(rz, 0, f);
      }
      M4.trs(x, y, z, rx, ry, rz, s, model, nrm);
      const dimLvl = lerp(1, centerDimMid, e * (1 - f));
      drawMesh(p.mesh, LOGO_BASE, LOGO_RIM, 70, 0.55, 1, dimLvl);
    }

    /* ---- crystals flying past (parallax with scroll) ---- */
    const span = halfH * 2 * 1.6;
    for (const c of crystals) {
      if (mobile && !c.mobile) continue;
      const depthK = (CAMZ - c.z) / CAMZ;                         // >1 when further back
      const speed = 1 / depthK;                                   // closer = faster
      const yy = ((c.yb * span + scrollY * upp * speed * 0.9 + t * 0.05) % span) - span / 2;
      const xx = c.xf * halfW * depthK;
      const st = t + spinBoost * 6;
      M4.trs(xx, yy, c.z, c.ax + st * c.sx, c.ay + st * c.sy, c.az + st * c.sz, c.s * (mobile ? 0.8 : 1), model, nrm);
      drawMesh(c.m, c.col, [0.85, 0.72, 1.0], c.glass ? 90 : 40, c.glass ? 0.45 : 0.15, c.back ? 0.55 : (c.glass ? 0.8 : 1), c.back ? 0.16 : 0.22);
    }
    gl.disableVertexAttribArray(prog.aNor);

    /* ---- dust ---- */
    gl.useProgram(pprog.p);
    gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.uniformMatrix4fv(pprog.u.uView, false, view); gl.uniformMatrix4fv(pprog.u.uProj, false, proj);
    gl.uniform1f(pprog.u.uTime, t); gl.uniform1f(pprog.u.uScroll, scrollY * upp * 0.6); gl.uniform1f(pprog.u.uSpan, 16.0); gl.uniform1f(pprog.u.uPx, dpr * (mobile ? 0.8 : 1));
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.enableVertexAttribArray(pprog.aPos); gl.vertexAttribPointer(pprog.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.enableVertexAttribArray(pprog.aSeed); gl.vertexAttribPointer(pprog.aSeed, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, mobile ? NP / 2 : NP);
    gl.disableVertexAttribArray(pprog.aSeed);
    gl.depthMask(true);

    if (firstFrame) { firstFrame = false; canvas.classList.add('ready'); document.documentElement.classList.add('has-3d'); }
  }

  function loop() {
    cancelAnimationFrame(raf);
    const tick = (now) => {
      if (!visible) return;
      frame(now);
      if (!paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  // while paused, still redraw on scroll so the page stays in sync (without any auto-motion)
  window.addEventListener('scroll', () => { if (paused && visible) requestAnimationFrame(() => frame(pauseStart)); }, { passive: true });
  loop();
}
