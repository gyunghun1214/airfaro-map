// AIRFARO MAP 3D 캠퍼스 (map3d.js) · three.js r147 (vendor/three.min.js, vendor/OrbitControls.js)
// campus-data.js 의 실제 건물 · 길 · 풀밭 윤곽과 땅 높낮이(미터, x = 동쪽, z = 남쪽)로 캠퍼스를 3D로 세워요.
// 땅 그림(길 · 풀밭 · 주차장)은 캔버스에 그려 지형에 덮고, 건물은 윤곽을 올려 세워요.
// 센서 지점마다 바닥 원과 기둥을 세워 웹 판단 상태 색으로 칠하고, 흡연 의심 · 판단 보류 · 공기 변화이면 이어진 건물도 같은 색으로 물들여요.
(function (root) {
  'use strict';
  const T = root.THREE;

  const PALETTE = {
    day: { sky: 0xe7ecee, fog: 0xe7ecee, skirt: '#8a7f70', skirtDark: '#6f665a',
           ground: '#b4b8b3', urban: '#aeb0aa', campus: '#bfc3bc', grass: '#82a95f', wood: '#5b8945', pitch: '#6aa64c', pitchLine: '#e4efdf',
           parking: '#a6a9a6', plaza: '#d8d2c3', water: '#7fb7cf', road: '#4d5256', curb: '#dcd9d0', line: '#f2f1ea', path: '#e4dfd2', pathEdge: '#c2bba9', steps: '#cfc8b7',
           wall: 0xeef0ec, wallBg: 0xcfd2cd, roof: 0x86a48f, roofAlt: 0xb3bab2, roofBg: 0xa9ada7, box: 0xe3e6e3,
           tree: 0x3f7a30, treeAlt: 0x5a9442, trunk: 0x6b5a45, hemiSky: 0xffffff, hemiGround: 0x7d8278, hemi: 0.58, sun: 0.72,
           window: 'rgba(110,140,162,0.55)', windowLit: null },
    night: { sky: 0x0d1921, fog: 0x0d1921, skirt: '#38332d', skirtDark: '#29251f',
             ground: '#2a343b', urban: '#262f35', campus: '#303c43', grass: '#2b4f35', wood: '#22412c', pitch: '#2e5a37', pitchLine: '#6a8a72',
             parking: '#323b41', plaza: '#454b4b', water: '#24485b', road: '#161b1f', curb: '#4d585e', line: '#8a949a', path: '#4a5255', pathEdge: '#394045', steps: '#525a5c',
             wall: 0x75858f, wallBg: 0x48535a, roof: 0x4b665f, roofAlt: 0x5a6867, roofBg: 0x3b454b, box: 0x75828a,
             tree: 0x2d5636, treeAlt: 0x3a6540, trunk: 0x3a3229, hemiSky: 0xb3c5d6, hemiGround: 0x1d252a, hemi: 0.78, sun: 0.42,
             window: 'rgba(38,52,62,0.9)', windowLit: 'rgba(255,212,140,0.9)' },
  };
  const ALERT = { SMOKE: 1, HOLD: 1, CHANGED: 1 };     // 이 상태일 때만 건물 · 바닥 색을 바꿔요
  const RANK = { SMOKE: 3, HOLD: 2, CHANGED: 1 };

  // ---------------------------------------------------------------- 작은 도구
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
  function ringPts(flat) { const p = []; for (let i = 0; i + 1 < (flat || []).length; i += 2) p.push([flat[i], flat[i + 1]]); return p; }
  function area(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return a / 2; }
  function centroid(pts) {
    let x = 0, z = 0, a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; a += f; x += (pts[j][0] + pts[i][0]) * f; z += (pts[j][1] + pts[i][1]) * f; }
    if (Math.abs(a) < 1e-6) { const n = pts.length; return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]; }
    return [x / (3 * a), z / (3 * a)];
  }
  function inside(pt, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, zi] = pts[i], [xj, zj] = pts[j];
      if (((zi > pt[1]) !== (zj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  }
  function distToRing(pt, pts) {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[j], [bx, bz] = pts[i];
      const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
      let t = L ? ((pt[0] - ax) * dx + (pt[1] - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(pt[0] - ax - t * dx, pt[1] - az - t * dz));
    }
    return best;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- 지도 만들기
  function create(container, campus, opts) {
    opts = opts || {};
    if (!T || !T.WebGLRenderer || !T.OrbitControls) throw new Error('3D 라이브러리(three.js)를 불러오지 못했어요');
    const okGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
    if (!okGL) throw new Error('이 기기나 브라우저에서는 3D(WebGL)를 쓸 수 없어요');

    const wrap = document.createElement('div'); wrap.className = 'm3-wrap'; container.appendChild(wrap);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.preserve });
    renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', (campus.name || '캠퍼스') + ' 3D 지도');
    const overlay = document.createElement('div'); overlay.className = 'm3-labels'; wrap.appendChild(overlay);

    const R = campus.rect, W = R.x1 - R.x0, D = R.z1 - R.z0, CX = (R.x0 + R.x1) / 2, CZ = (R.z0 + R.z1) / 2;
    const span = Math.max(W, D);
    const TR = campus.terrain;
    function hAt(x, z) {
      if (!TR) return 0;
      const gx = (x - TR.x0) / TR.step, gz = (z - TR.z0) / TR.step;
      const i = Math.max(0, Math.min(TR.nx - 2, Math.floor(gx))), j = Math.max(0, Math.min(TR.nz - 2, Math.floor(gz)));
      const fx = Math.max(0, Math.min(1, gx - i)), fz = Math.max(0, Math.min(1, gz - j));
      const g = (a, b) => TR.h[b * TR.nx + a];
      return g(i, j) * (1 - fx) * (1 - fz) + g(i + 1, j) * fx * (1 - fz) + g(i, j + 1) * (1 - fx) * fz + g(i + 1, j + 1) * fx * fz;
    }
    const SKIRT = -10;   // 모형 받침 바닥 높이

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, 3, span * 10);
    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.42; controls.minPolarAngle = 0;
    controls.minDistance = 60; controls.maxDistance = span * 2.2;
    controls.screenSpacePanning = false;
    const homeT = opts.homeTarget || [0, 0];
    const HOME = { theta: opts.homeTheta ?? 1.32, phi: opts.homePhi ?? 0.92, dist: opts.homeDist ?? span * 1.02 };
    // 손을 뗀 뒤에도 남아 있는 회전 관성을 먼저 없애고 옮겨요 (안 그러면 기본 보기를 눌러도 조금 더 돌아가요)
    function stopCoasting() { const d = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = d; }
    function setView(theta, phi, dist, tx, tz) {
      stopCoasting();
      controls.target.set(tx, hAt(tx, tz), tz);
      const t = controls.target;
      camera.position.set(t.x + dist * Math.sin(phi) * Math.sin(theta), t.y + dist * Math.cos(phi), t.z + dist * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(t); controls.update();
    }
    setView(HOME.theta, HOME.phi, HOME.dist, homeT[0], homeT[1]);
    let userMoved = false;   // 사람이 지도를 움직이기 전까지는 화면 크기가 바뀌면 기본 보기를 다시 맞춰요
    controls.addEventListener('start', () => { userMoved = true; });
    // 화면 밖으로 너무 멀리 끌고 가지 않게
    controls.addEventListener('change', () => {
      const t = controls.target, cx = Math.max(R.x0, Math.min(R.x1, t.x)), cz = Math.max(R.z0, Math.min(R.z1, t.z));
      if (cx !== t.x || cz !== t.z) { const dx = cx - t.x, dz = cz - t.z; t.x = cx; t.z = cz; camera.position.x += dx; camera.position.z += dz; }
    });

    const hemi = new T.HemisphereLight(0xffffff, 0x888888, 0.75); scene.add(hemi);
    const sun = new T.DirectionalLight(0xffffff, 0.8);
    sun.position.set(CX + span * 0.45, span * 0.95, CZ + span * 0.6); sun.target.position.set(CX, 0, CZ);
    sun.castShadow = true;
    const SM = Math.min(4096, renderer.capabilities.maxTextureSize || 2048) >= 4096 && (root.innerWidth || 1000) > 700 ? 4096 : 2048;
    sun.shadow.mapSize.set(SM, SM);
    const sc = sun.shadow.camera; sc.left = -span * 0.8; sc.right = span * 0.8; sc.top = span * 0.8; sc.bottom = -span * 0.8; sc.near = 10; sc.far = span * 3.5;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.6;
    scene.add(sun, sun.target);

    // ---- 땅 (지형 + 캔버스 그림)
    const TEX = Math.min(renderer.capabilities.maxTextureSize || 2048, (root.innerWidth || 1000) > 700 ? 4096 : 2048);
    const groundCanvas = document.createElement('canvas'); groundCanvas.width = TEX; groundCanvas.height = Math.round(TEX * D / W);
    const groundTex = new T.CanvasTexture(groundCanvas);
    groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    const segX = Math.round(W / 5), segZ = Math.round(D / 5);
    const gGeo = new T.PlaneGeometry(W, D, segX, segZ); gGeo.rotateX(-Math.PI / 2); gGeo.translate(CX, 0, CZ);
    { const p = gGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hAt(p.getX(i), p.getZ(i))); gGeo.computeVertexNormals(); }
    const ground = new T.Mesh(gGeo, new T.MeshLambertMaterial({ map: groundTex }));
    ground.receiveShadow = true; ground.userData.kind = 'ground'; scene.add(ground);
    // 받침 옆면 (모형처럼 잘린 단면)
    const skirtMat = new T.MeshLambertMaterial({ color: 0x8a7f70 });
    const skirt = new T.Mesh(skirtGeometry(), skirtMat); scene.add(skirt);
    const baseGeo = new T.PlaneGeometry(W, D); baseGeo.rotateX(Math.PI / 2); baseGeo.translate(CX, SKIRT, CZ);
    const baseMesh = new T.Mesh(baseGeo, skirtMat); scene.add(baseMesh);
    function skirtGeometry() {
      const pos = [], idx = [], N = 120;
      const edge = (ax, az, bx, bz) => {
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N;
          const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
          const o = pos.length / 3;
          pos.push(x0, hAt(x0, z0), z0, x1, hAt(x1, z1), z1, x1, SKIRT, z1, x0, SKIRT, z0);
          idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
        }
      };
      edge(R.x0, R.z1, R.x1, R.z1); edge(R.x1, R.z1, R.x1, R.z0); edge(R.x1, R.z0, R.x0, R.z0); edge(R.x0, R.z0, R.x0, R.z1);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    }

    function paintGround(p) {
      const c = groundCanvas.getContext('2d'), sx = groundCanvas.width / W, sz = groundCanvas.height / D;
      const X = (x) => (x - R.x0) * sx, Z = (z) => (z - R.z0) * sz;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = p.ground; c.fillRect(0, 0, groundCanvas.width, groundCanvas.height);
      const poly = (outer, holes) => {
        c.beginPath();
        for (const r of [outer].concat(holes || [])) { const q = ringPts(r); q.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.closePath(); }
      };
      const ORDER = ['urban', 'campus', 'grass', 'wood', 'parking', 'plaza', 'pitch', 'water'];
      const areas = (campus.areas || []).slice().sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k));
      for (const a of areas) {
        poly(a.outer, a.holes); c.fillStyle = p[a.k] || p.grass; c.fill('evenodd');
        if (a.k === 'pitch') { c.strokeStyle = p.pitchLine; c.lineWidth = 0.5 * sx; c.stroke(); }
        if (a.k === 'parking') { c.save(); poly(a.outer, a.holes); c.clip('evenodd'); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.15 * sx; for (let x = 0; x < groundCanvas.width; x += 2.6 * sx) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, groundCanvas.height); c.stroke(); } c.restore(); }
      }
      const line = (pts) => { c.beginPath(); ringPts(pts).forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); };
      c.lineJoin = 'round'; c.lineCap = 'round';
      const roads = campus.roads || [];
      const small = roads.filter((r) => r.w < 4.5), big = roads.filter((r) => r.w >= 4.5);
      for (const r of small) { line(r.pts); c.strokeStyle = p.pathEdge; c.lineWidth = (r.w + 0.6) * sx; c.stroke(); }
      for (const r of small) { line(r.pts); c.strokeStyle = r.k === 'steps' ? p.steps : p.path; c.lineWidth = r.w * sx; c.stroke(); }
      for (const r of small.filter((q) => q.k === 'steps')) { line(r.pts); c.setLineDash([0.35 * sx, 0.45 * sx]); c.lineCap = 'butt'; c.strokeStyle = p.pathEdge; c.lineWidth = r.w * 0.8 * sx; c.stroke(); c.setLineDash([]); c.lineCap = 'round'; }
      for (const r of big) { line(r.pts); c.strokeStyle = p.curb; c.lineWidth = (r.w + 1.4) * sx; c.stroke(); }
      for (const r of big) { line(r.pts); c.strokeStyle = r.k === 'pedestrian' ? p.plaza : p.road; c.lineWidth = r.w * sx; c.stroke(); }
      c.setLineDash([3 * sx, 3.5 * sx]); c.lineCap = 'butt';
      for (const r of big.filter((q) => q.w >= 6.5 && q.k !== 'pedestrian')) { line(r.pts); c.strokeStyle = p.line; c.lineWidth = 0.3 * sx; c.stroke(); }
      c.setLineDash([]);
      // 캠퍼스 경계 (점선)
      if (campus.campus) { poly(campus.campus); c.setLineDash([1.2 * sx, 1.6 * sx]); c.strokeStyle = 'rgba(17,106,134,0.55)'; c.lineWidth = 0.9 * sx; c.stroke(); c.setLineDash([]); }
      groundTex.needsUpdate = true;
    }

    // ---- 건물
    function windowTexture(color) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = color; g.fillRect(11, 18, 42, 26);
      g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, 59, 64, 5);
      const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 3.2, 1 / 3.6);
      t.anisotropy = groundTex.anisotropy;
      return t;
    }
    let texDay = null, texLit = null;
    const buildings = [];
    const roofBoxes = [];
    for (const bd of campus.buildings || []) {
      const outer = ringPts(bd.outer); if (outer.length < 3) continue;
      const holes = (bd.holes || []).map(ringPts).filter((h) => h.length >= 3);
      const g0 = bd.g0 ?? hAt(...centroid(outer)), g1 = bd.g1 ?? g0;
      const base = g0 - 1.5, top = (g0 + g1) / 2 + bd.h;
      const shape = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, -z)));
      for (const h of holes) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, -z))));
      const geo = new T.ExtrudeGeometry(shape, { depth: top - base, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2); geo.translate(0, base, 0);
      const alt = hash(bd.id) % 3 === 0;
      const wall = new T.MeshLambertMaterial({ color: 0xffffff });
      const roof = new T.MeshLambertMaterial({ color: 0xffffff });
      const mesh = new T.Mesh(geo, [roof, wall]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { kind: 'building', id: bd.id };
      scene.add(mesh);
      const c = centroid(outer), A = Math.abs(area(outer));
      buildings.push({ id: bd.id, name: bd.name || '', bg: !!bd.bg, outer, c, A, top, mesh, wall, roof, alt, lit: hash(bd.id + 'L') % 3 !== 0 });
      if (!bd.bg) {
        const r = rng(hash(bd.id)), n = Math.min(7, Math.floor(A / 320));
        const bb = outer.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
        for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
          const px = bb[0] + r() * (bb[2] - bb[0]), pz = bb[1] + r() * (bb[3] - bb[1]);
          if (!inside([px, pz], outer) || distToRing([px, pz], outer) < 3.5 || holes.some((h) => inside([px, pz], h))) continue;
          roofBoxes.push([px, top, pz, 2.2 + r() * 2.6, 1.1 + r() * 1.3, 2.2 + r() * 2.6]); k++;
        }
      }
    }
    const boxGeo = new T.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
    const boxMat = new T.MeshLambertMaterial({ color: 0xe9ece9 });
    const boxes = new T.InstancedMesh(boxGeo, boxMat, Math.max(1, roofBoxes.length));
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), P = new T.Vector3();
    roofBoxes.forEach((b, i) => { M.compose(P.set(b[0], b[1], b[2]), Q, S.set(b[3], b[4], b[5])); boxes.setMatrixAt(i, M); });
    boxes.count = roofBoxes.length; boxes.castShadow = true; scene.add(boxes);

    // ---- 나무
    const treePts = ringPts(campus.trees || []);
    const crownGeo = new T.IcosahedronGeometry(1, 0);
    const trunkGeo = new T.CylinderGeometry(0.2, 0.28, 1, 5); trunkGeo.translate(0, 0.5, 0);
    const crowns = new T.InstancedMesh(crownGeo, new T.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, treePts.length));
    const trunks = new T.InstancedMesh(trunkGeo, new T.MeshLambertMaterial({ color: 0x6b5a45 }), Math.max(1, treePts.length));
    const treeAlt = [];
    { const r = rng(7); treePts.forEach(([x, z], i) => {
      const y = hAt(x, z), s = 2.3 + r() * 1.7, h = 2.2 + r() * 1.6; treeAlt.push(r() < 0.45);
      M.compose(P.set(x, y + h + s * 0.75, z), Q.setFromAxisAngle(S.set(0, 1, 0), r() * 6.28), S.set(s, s * 1.1, s)); crowns.setMatrixAt(i, M);
      Q.identity(); M.compose(P.set(x, y - 0.3, z), Q, S.set(1, h + 0.8, 1)); trunks.setMatrixAt(i, M);
    }); }
    crowns.count = trunks.count = treePts.length; crowns.castShadow = true; trunks.castShadow = true;
    scene.add(crowns, trunks);

    // ---- 이름표
    const labels = [];
    for (const bd of buildings.filter((x) => x.name)) {
      const el = document.createElement('div'); el.className = 'm3-bl'; el.textContent = bd.name; overlay.appendChild(el);
      labels.push({ el, pos: new T.Vector3(bd.c[0], bd.top + 2.5, bd.c[1]), kind: 'b', pri: bd.A });
    }
    for (const L of campus.labels || []) {
      const el = document.createElement('div'); el.className = 'm3-bl m3-place'; el.textContent = L.name; overlay.appendChild(el);
      labels.push({ el, pos: new T.Vector3(L.x, hAt(L.x, L.z) + 3, L.z), kind: 'b', pri: 5000 });
    }

    // ---- 센서 지점
    const sensorGroup = new T.Group(); scene.add(sensorGroup);
    const sensors = new Map();
    const STATE_COLOR = opts.stateColors || {}, STATE_NAME = opts.stateNames || {};
    const colorFor = (s) => new T.Color(STATE_COLOR[s] || '#adb5bd');
    const poleGeo = new T.CylinderGeometry(0.5, 0.5, 1, 8); poleGeo.translate(0, 0.5, 0);
    const headGeo = new T.SphereGeometry(2.8, 20, 14);
    function nearestBuilding(x, z, maxD) {
      let best = null, bd = maxD;
      for (const b of buildings) {
        if (b.bg) continue;
        if (inside([x, z], b.outer)) return b;
        const d = distToRing([x, z], b.outer); if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    // 지형을 따라 휘는 원판 (가운데부터 고리 6개)
    function drapedDisc(x, z, rad, lift, flatY) {
      const RINGS = 6, SEG = 40, pos = [], idx = [];
      const y0 = (px, pz) => (flatY !== null ? flatY : hAt(px, pz)) + lift;
      pos.push(0, y0(x, z), 0);
      for (let r = 1; r <= RINGS; r++) for (let s = 0; s < SEG; s++) {
        const a = s / SEG * Math.PI * 2, rr = rad * r / RINGS, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        pos.push(px - x, y0(px, pz), pz - z);
      }
      for (let s = 0; s < SEG; s++) idx.push(0, 1 + (s + 1) % SEG, 1 + s);
      for (let r = 1; r < RINGS; r++) for (let s = 0; s < SEG; s++) {
        const a = 1 + (r - 1) * SEG + s, b = 1 + (r - 1) * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG;
        idx.push(a, b, d, a, d, c);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      return g;
    }
    function ringGeometry(x, z, rad, lift, flatY) {
      const SEG = 64, pos = [], idx = [], w = 0.13;
      const y0 = (px, pz) => (flatY !== null ? flatY : hAt(px, pz)) + lift;
      for (let s = 0; s <= SEG; s++) {
        const a = s / SEG * Math.PI * 2;
        for (const k of [1 - w, 1]) { const px = x + Math.cos(a) * rad * k, pz = z + Math.sin(a) * rad * k; pos.push(px - x, y0(px, pz), pz - z); }
      }
      for (let s = 0; s < SEG; s++) { const o = s * 2; idx.push(o, o + 1, o + 3, o, o + 3, o + 2); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      return g;
    }
    function makeSensor(site) {
      const g = new T.Group(); g.userData = { kind: 'sensor', id: site.id };
      const mk = (geo, mat) => { const m = new T.Mesh(geo, mat); m.userData = g.userData; g.add(m); return m; };
      const disc = mk(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      const ring = mk(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
      const selRing = mk(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0x14232e, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
      const pole = mk(poleGeo, new T.MeshLambertMaterial({ color: 0x3b4650 }));
      const head = mk(headGeo, new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 }));
      disc.renderOrder = 20; ring.renderOrder = 21; selRing.renderOrder = 22;
      pole.castShadow = true; head.castShadow = true;
      sensorGroup.add(g);
      const el = document.createElement('button'); el.type = 'button'; el.className = 'm3-sl';
      el.addEventListener('click', (e) => { e.stopPropagation(); if (!editing && api.onSelect) api.onSelect(site.id); });
      overlay.appendChild(el);
      const lab = { el, pos: new T.Vector3(), kind: 's', pri: 1e9 };
      labels.push(lab);
      const s = { site, g, disc, ring, selRing, pole, head, el, lab, state: 'NONE', zone: null, R: site.r || 16, baseY: 0 };
      sensors.set(site.id, s);
      return s;
    }
    function placeSensor(s) {
      const { x, z } = s.site;
      const zb = s.site.zone ? buildings.find((b) => b.id === s.site.zone) : null;
      s.zone = zb || nearestBuilding(x, z, 30);
      const onRoof = s.zone && inside([x, z], s.zone.outer);
      const flatY = onRoof ? s.zone.top : null;
      s.baseY = onRoof ? s.zone.top : hAt(x, z);
      s.g.position.set(x, 0, z);
      for (const [m, geo] of [[s.disc, drapedDisc(x, z, s.R, 0.7, flatY)], [s.ring, ringGeometry(x, z, s.R, 0.9, flatY)], [s.selRing, ringGeometry(x, z, s.R + 3, 1.0, flatY)]]) { m.geometry.dispose(); m.geometry = geo; }
      const H = 15;
      s.pole.position.y = s.baseY; s.pole.scale.set(1, H, 1);
      s.head.position.y = s.baseY + H + 2.2;
      s.lab.pos.set(x, s.baseY + H + 6.5, z);
    }

    let editing = false, selected = null, pal = PALETTE.day;
    const api = {
      onSelect: null, onMove: null,
      setSites(list) {
        const keep = new Set(list.filter((x) => x.x !== null && x.x !== undefined).map((x) => x.id));
        let changed = false;
        for (const [id, s] of sensors) if (!keep.has(id)) { sensorGroup.remove(s.g); s.el.remove(); labels.splice(labels.indexOf(s.lab), 1); sensors.delete(id); changed = true; }
        list.forEach((site, i) => {
          if (!keep.has(site.id)) return;
          if (site.id === dragging) return;   // 끄는 중인 핀은 화면이 새로 그려져도 제자리로 돌리지 않아요
          const s = sensors.get(site.id) || makeSensor(site);
          const moved = !s.placed || s.site.x !== site.x || s.site.z !== site.z || s.site.zone !== site.zone;
          s.site = { ...site }; s.num = site.num || i + 1;
          if (moved) { placeSensor(s); s.placed = true; changed = true; }
        });
        refreshTints(); refreshLabels();
        if (changed && !userMoved && !dragging) goHome();
      },
      setStates(map) { for (const [id, s] of sensors) s.state = map[id] || 'NODATA'; refreshTints(); refreshLabels(); },
      select(id) { selected = id; refreshLabels(); },
      setEditing(on) { editing = !!on; wrap.classList.toggle('m3-edit', editing); },
      viewHome() { userMoved = false; goHome(); },
      viewTop() { userMoved = true; setView(Math.PI / 2, 0.0001, span * 1.18, homeT[0], homeT[1]); },
      focus(id) {
        const s = sensors.get(id); if (!s) return;
        userMoved = true; stopCoasting();
        const off = new T.Vector3().subVectors(camera.position, controls.target);
        off.setLength(Math.min(off.length(), 320));
        controls.target.set(s.site.x, s.baseY, s.site.z);
        camera.position.copy(controls.target).add(off); controls.update();
      },
      setAutoRotate(on) { controls.autoRotate = !!on; controls.autoRotateSpeed = 0.5; if (on) userMoved = true; },
      home: () => ({ ...lastHome }),
      setTheme(night) { applyPalette(night ? PALETTE.night : PALETTE.day); },
      zoneOf(id) { const s = sensors.get(id); return s && s.zone ? { id: s.zone.id, name: s.zone.name } : null; },
      buildingList: () => buildings.filter((b) => !b.bg).map((b) => ({ id: b.id, name: b.name, x: b.c[0], z: b.c[1] })),
      heightAt: hAt,
      tints: () => buildings.filter((b) => b.tint).map((b) => ({ id: b.id, name: b.name, tint: b.tint, wall: '#' + b.wall.color.getHexString(), roof: '#' + b.roof.color.getHexString() })),
      stats: () => ({ buildings: buildings.length, trees: treePts.length, roads: (campus.roads || []).length, areas: (campus.areas || []).length, tex: TEX, shadow: SM }),
      renderer, camera, controls, scene,
      dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); wrap.remove(); },
    };

    function refreshTints() {
      const want = new Map();
      const night = pal === PALETTE.night;
      for (const s of sensors.values()) {
        const col = colorFor(s.state);
        s.disc.material.color.copy(col); s.ring.material.color.copy(col); s.head.material.color.copy(col);
        s.head.material.emissive.copy(ALERT[s.state] ? col : new T.Color(0)).multiplyScalar(night ? 0.65 : 0.25);
        s.disc.material.opacity = ALERT[s.state] ? 0.55 : s.state === 'CALM' ? 0.28 : 0.2;
        if (s.zone && ALERT[s.state] && (!want.has(s.zone) || RANK[s.state] > RANK[want.get(s.zone)])) want.set(s.zone, s.state);
      }
      for (const b of buildings) {
        const st = want.get(b) || null;
        const wallC = new T.Color(b.bg ? pal.wallBg : pal.wall), roofC = new T.Color(b.bg ? pal.roofBg : (b.alt ? pal.roofAlt : pal.roof));
        if (st) {
          const col = colorFor(st);
          b.wall.color.copy(wallC.lerp(col, 0.6)); b.roof.color.copy(roofC.lerp(col, 0.85));
          b.roof.emissive.copy(col).multiplyScalar(night ? 0.4 : 0.14); b.wall.emissive.copy(col).multiplyScalar(night ? 0.18 : 0.05);
        } else {
          b.wall.color.copy(wallC); b.roof.color.copy(roofC); b.roof.emissive.set(0); b.wall.emissive.set(0);
        }
        b.tint = st;
      }
    }
    function applyPalette(p) {
      pal = p;
      scene.background = new T.Color(p.sky);
      scene.fog = new T.Fog(p.fog, span * 1.7, span * 4.8);
      hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemi; sun.intensity = p.sun;
      skirtMat.color.set(p.skirt);
      paintGround(p);
      if (texDay) texDay.dispose(); if (texLit) texLit.dispose();
      texDay = windowTexture(p.window); texLit = p.windowLit ? windowTexture(p.windowLit) : null;
      for (const b of buildings) { b.wall.map = (texLit && b.lit && !b.bg) ? texLit : texDay; b.wall.needsUpdate = true; }
      boxMat.color.set(p.box);
      trunks.material.color.set(p.trunk);
      const ca = new T.Color(p.tree), cb = new T.Color(p.treeAlt);
      treeAlt.forEach((alt, i) => crowns.setColorAt(i, alt ? cb : ca));
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      refreshTints();
    }
    applyPalette(opts.night ? PALETTE.night : PALETTE.day);

    // ---- 이름표 위치 (매 프레임) · 겹치면 작은 건물 이름부터 숨겨요. 센서 이름표는 늘 보여요.
    const v = new T.Vector3();
    let VW = 1, VH = 1, compact = false;   // compact: 좁은 지도(휴대폰)에서는 고른 센서만 이름을 보여요
    function refreshLabels() {
      for (const s of sensors.values()) {
        const showName = !compact || s.site.id === selected;
        const html = `<b>${esc(s.num)}</b>${showName ? `<span>${esc(s.site.name)}</span>` : ''}<i>${esc(STATE_NAME[s.state] || '')}</i>`;
        if (s.el.innerHTML !== html) { s.el.innerHTML = html; s.lab.w = 0; s.lab.h = 0; }
        s.el.style.setProperty('--c', STATE_COLOR[s.state] || '#adb5bd');
        s.el.classList.toggle('sel', s.site.id === selected);
        s.el.classList.toggle('alert', !!ALERT[s.state]);
        s.el.setAttribute('aria-label', `${s.site.name} ${STATE_NAME[s.state] || ''}`);
        s.selRing.material.opacity = s.site.id === selected ? 0.9 : 0;
      }
    }
    function placeLabels() {
      const taken = [];
      const sorted = labels.slice().sort((a, b) => b.pri - a.pri);
      for (const L of sorted) {
        v.copy(L.pos).project(camera);
        if (!(v.z < 1 && v.x > -1.15 && v.x < 1.15 && v.y > -1.15 && v.y < 1.15)) { L.el.style.display = 'none'; continue; }
        const x = (v.x + 1) / 2 * VW, y = (1 - v.y) / 2 * VH;
        const w = L.w || (L.w = L.el.offsetWidth || 80), h = L.h || (L.h = L.el.offsetHeight || 22);
        const box = [x - w / 2 - 3, y - h - 3, x + w / 2 + 3, y + 3];
        let show = true;
        if (L.kind === 'b') show = !taken.some((q) => !(box[2] < q[0] || box[0] > q[2] || box[3] < q[1] || box[1] > q[3]));
        if (show) taken.push(box);
        L.el.style.display = show ? '' : 'none';
        L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      }
    }
    function remeasure() { for (const L of labels) { L.w = 0; L.h = 0; } }

    // ---- 크기 · 그리기
    function resize() {
      VW = Math.max(1, wrap.clientWidth); VH = Math.max(1, wrap.clientHeight);
      renderer.setSize(VW, VH, false); camera.aspect = VW / VH; camera.updateProjectionMatrix();
      const c = VW < 560; if (c !== compact) { compact = c; refreshLabels(); }
      remeasure();
      if (!userMoved && sensors.size) goHome();
    }
    // ---- 기본 보기: 센서 전부(바닥부터 이름표까지)가 화면에 들어오는 가장 가까운 거리.
    //      원래 방향(동쪽에서 서쪽을 봄)이 12% 안쪽으로 비슷하면 그 방향을, 아니면 덜 멀어지는 방향을 골라요.
    let lastHome = { theta: HOME.theta, dist: HOME.dist, tx: homeT[0], tz: homeT[1] };
    function homeFor() {
      const base = { theta: HOME.theta, dist: HOME.dist, tx: homeT[0], tz: homeT[1] };
      if (!sensors.size || VW < 50 || VH < 50) return base;
      // 이름표 폭을 하나씩 재요 (화면 밖이라 숨겨진 이름표도 잠깐 보이게 해서 재요)
      const pts = [...sensors.values()].map((s) => {
        const hid = s.el.style.display === 'none'; if (hid) s.el.style.display = '';
        const w = s.el.offsetWidth || 150; if (hid) s.el.style.display = 'none';
        return [s.site.x, s.baseY, s.site.z, w / 2 + 6];
      });
      const cam = camera.clone(), q = new T.Vector3(), tgt = new T.Vector3();
      const fits = (th, d, tx, tz) => {
        tgt.set(tx, hAt(tx, tz), tz);
        cam.position.set(tgt.x + d * Math.sin(HOME.phi) * Math.sin(th), tgt.y + d * Math.cos(HOME.phi), tgt.z + d * Math.sin(HOME.phi) * Math.cos(th));
        cam.lookAt(tgt); cam.updateMatrixWorld();
        for (const p of pts) for (const lift of [0, 22]) {
          q.set(p[0], p[1] + lift, p[2]).project(cam);
          const px = (q.x + 1) / 2 * VW, py = (1 - q.y) / 2 * VH, half = lift ? p[3] : 8;
          if (q.z >= 1 || px < half || px > VW - half || py < (lift ? 34 : 8) || py > VH - 10) return false;
        }
        return true;
      };
      const need = (th, tx, tz) => { for (let d = 300; d <= 1100; d += 10) if (fits(th, d, tx, tz)) return d; return 1100; };
      // 방향마다 기준점을 화면 앞뒤로 옮겨 보며(±150m) 가장 가까이 볼 수 있는 자리를 골라요 → 위아래 빈 곳이 줄어요
      const tryTheta = (th) => {
        let best = null;
        for (let k = -150; k <= 150; k += 25) {
          const tx = homeT[0] + Math.sin(th) * k, tz = homeT[1] + Math.cos(th) * k;   // k > 0 이면 카메라 쪽으로
          const d = need(th, tx, tz);
          if (!best || d < best.dist || (d === best.dist && Math.abs(k) < Math.abs(best.k))) best = { theta: th, dist: d, tx, tz, k };
        }
        return best;
      };
      const cands = [HOME.theta, HOME.theta - 0.32, HOME.theta - 0.72].map(tryTheta);
      const best = cands.reduce((a, b) => (b.dist < a.dist ? b : a));
      return cands[0].dist <= best.dist * 1.12 ? cands[0] : best;
    }
    function goHome() { lastHome = homeFor(); setView(lastHome.theta, HOME.phi, lastHome.dist, lastHome.tx, lastHome.tz); }
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    let raf = 0; const t0 = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = (now - t0) / 1000;
      controls.update();
      for (const s of sensors.values()) {
        if (ALERT[s.state]) {
          const k = (t * (s.state === 'SMOKE' ? 0.85 : 0.55)) % 1, sc = 0.55 + k * 0.95;
          s.ring.scale.set(sc, 1, sc); s.ring.material.opacity = 0.85 * (1 - k);
          s.head.position.y = s.baseY + 15 + 2.2 + Math.sin(t * 4) * 0.7;
        } else if (s.ring.material.opacity) { s.ring.material.opacity = 0; s.ring.scale.set(1, 1, 1); }
      }
      renderer.render(scene, camera);
      placeLabels();
    }
    raf = requestAnimationFrame(frame);

    // ---- 누르기 · 끌어 옮기기 (끌기는 '핀 위치 옮기기'를 켰을 때만)
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    let down = null, dragging = null;
    function setRay(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    }
    function sensorHit(e) { setRay(e); const hits = ray.intersectObjects(sensorGroup.children, true); return hits.length ? hits[0].object.userData.id : null; }
    renderer.domElement.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      if (!editing) return;
      const id = sensorHit(e);
      if (id) { dragging = id; controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { /* 일부 브라우저 */ } }
    });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setRay(e);
      const hit = ray.intersectObject(ground, false)[0];
      if (!hit) return;
      const s = sensors.get(dragging);
      s.site.x = Math.round(Math.max(R.x0 + 5, Math.min(R.x1 - 5, hit.point.x)) * 10) / 10;
      s.site.z = Math.round(Math.max(R.z0 + 5, Math.min(R.z1 - 5, hit.point.z)) * 10) / 10;
      s.site.zone = null; placeSensor(s);
    });
    const endDrag = () => {
      if (!dragging) return false;
      const s = sensors.get(dragging);
      s.site.zone = s.zone ? s.zone.id : null;
      if (api.onMove) api.onMove(dragging, s.site.x, s.site.z, s.site.zone, s.zone ? s.zone.name : '');
      dragging = null; controls.enabled = true; refreshTints();
      return true;
    };
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (endDrag()) return;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && !editing) {
        const id = sensorHit(e);
        if (id && api.onSelect) api.onSelect(id);
      }
      down = null;
    });
    renderer.domElement.addEventListener('pointercancel', endDrag);
    return api;
  }

  root.AirfaroMap3D = { create, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
