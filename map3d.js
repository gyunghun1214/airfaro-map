// AIRFARO MAP 3D 캠퍼스 (map3d.js) · three.js r147 (vendor/three.min.js, vendor/OrbitControls.js)
// campus-data.js 의 실제 건물 · 길 · 풀밭 윤곽과 땅 높낮이(미터, x = 동쪽, z = 남쪽)로 캠퍼스를 3D로 세워요.
// 땅 그림(풀밭 · 주차장 등)은 캔버스에 그려 지형에 덮고, 길은 도형으로 따로 올려 가까이 봐도 또렷해요.
// 건물은 윤곽을 올려 세우고 테두리 선 · 옥상 난간 · 창문 무늬를 그려요. 빠른 컴퓨터에서는 화면을 더 촘촘하게(최대 2배) 그려요.
// 센서 지점마다 바닥 원과 기둥을 세워 웹 판단 상태 색으로 칠하고, 흡연 의심 · 판단 보류 · 공기 변화이면 이어진 건물도 같은 색으로 물들여요.
// 학생 캐릭터(꾸밈용 가상 인물)는 캠퍼스 안 길을 걸어 다니다, 흡연 의심 센서 둘레에 처음 들어가면 "아 담배 냄새!" 하고 코를 막고 피해 가요.
// 실제 사람의 위치나 냄새를 잰 것이 아니에요.
(function (root) {
  'use strict';
  const T = root.THREE;

  const PALETTE = {
    day: { sky: 0xe7ecee, fog: 0xe7ecee, skirt: '#8a7f70', skirtDark: '#6f665a',
           ground: '#b4b8b3', urban: '#aeb0aa', campus: '#bfc3bc', grass: '#82a95f', wood: '#5b8945', pitch: '#6aa64c', pitchLine: '#e4efdf', pitchAlt: '#5c9842', pitchOut: '#578c43', pitchMark: '#f4f8f2',
           parking: '#a6a9a6', plaza: '#d8d2c3', water: '#7fb7cf', road: '#4d5256', curb: '#dcd9d0', line: '#f2f1ea', path: '#e4dfd2', pathEdge: '#c2bba9', steps: '#cfc8b7',
           wall: 0xeef0ec, wallBg: 0xcfd2cd, roof: 0x86a48f, roofAlt: 0xb3bab2, roofBg: 0xa9ada7, box: 0xe3e6e3, tradWall: 0xffffff, tradRoof: 0xffffff,
           tree: 0x3f7a30, treeAlt: 0x5a9442, trunk: 0x6b5a45, hemiSky: 0xffffff, hemiGround: 0x7d8278, hemi: 0.58, sun: 0.72,
           edge: 0x56626c, edgeOp: 0.3,
           window: 'rgba(110,140,162,0.55)', windowLit: null,
           glassTop: 'rgba(172,198,216,0.85)', glassBot: 'rgba(94,126,150,0.85)', frame: 'rgba(64,76,88,0.32)', mullion: 'rgba(255,255,255,0.6)', litTop: null, litBot: null },
    night: { sky: 0x0d1921, fog: 0x0d1921, skirt: '#38332d', skirtDark: '#29251f',
             ground: '#2a343b', urban: '#262f35', campus: '#303c43', grass: '#2b4f35', wood: '#22412c', pitch: '#2e5a37', pitchLine: '#6a8a72', pitchAlt: '#2a5232', pitchOut: '#274b2f', pitchMark: '#93b49c',
             parking: '#323b41', plaza: '#454b4b', water: '#24485b', road: '#161b1f', curb: '#4d585e', line: '#8a949a', path: '#4a5255', pathEdge: '#394045', steps: '#525a5c',
             wall: 0x75858f, wallBg: 0x48535a, roof: 0x4b665f, roofAlt: 0x5a6867, roofBg: 0x3b454b, box: 0x75828a, tradWall: 0x8f9aa2, tradRoof: 0x7f8a93,
             tree: 0x2d5636, treeAlt: 0x3a6540, trunk: 0x3a3229, hemiSky: 0xb3c5d6, hemiGround: 0x1d252a, hemi: 0.78, sun: 0.42,
             edge: 0x070d11, edgeOp: 0.5,
             window: 'rgba(38,52,62,0.9)', windowLit: 'rgba(255,212,140,0.9)',
             glassTop: 'rgba(46,62,74,0.95)', glassBot: 'rgba(30,42,52,0.95)', frame: 'rgba(0,0,0,0.35)', mullion: 'rgba(84,98,108,0.7)',
             litTop: 'rgba(255,228,170,0.95)', litBot: 'rgba(240,184,104,0.95)' },
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
  // 점 p 에서 선분 ab 까지: 거리 d 와 가장 가까운 자리 t (0~1)
  function segInfo(p, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
    let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
    return { d: Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz), t };
  }
  // 두 선분 사이 가장 가까운 거리 (서로 가로지르면 0)
  function segSeg(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    return Math.min(segInfo(a, c, d).d, segInfo(b, c, d).d, segInfo(c, a, b).d, segInfo(d, a, b).d);
  }
  function distToRing(pt, pts) {
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) best = Math.min(best, segInfo(pt, pts[j], pts[i]).d);
    return best;
  }
  const bbox = (pts) => pts.reduce((m, q) => [Math.min(m[0], q[0]), Math.min(m[1], q[1]), Math.max(m[2], q[0]), Math.max(m[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
  const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- 학생이 걷는 길 (campus.roads → 마디 · 이음)
  // 캠퍼스 안(경계 + near m)의 보행로 · 계단 · 광장 · 캠퍼스 안 찻길만 써요. 큰 바깥 도로(primary · secondary)는 빼요.
  // 다른 길 끝이 이 길 가운데에 닿으면(T자) 그 자리에서 나누고, 건물 속을 지나는 조각은 빼요. 가장 큰 덩어리 하나만 남겨요.
  const WALK_KINDS = { footway: 1, path: 1, steps: 1, pedestrian: 1, service: 1, residential: 1, cycleway: 1, living_street: 1 };
  function buildWalkGraph(campus, o) {
    o = o || {};
    const near = o.near ?? 10, snap = o.snap ?? 1.2;
    const camp = ringPts(campus.campus);
    const blds = (campus.buildings || []).map((b) => ringPts(b.outer)).filter((r) => r.length >= 3).map((r) => ({ r, bb: bbox(r) }));
    const inBld = (p) => blds.some((b) => p[0] > b.bb[0] && p[0] < b.bb[2] && p[1] > b.bb[1] && p[1] < b.bb[3] && inside(p, b.r));
    const clearSeg = (a, b) => {   // 이 조각에서 가장 가까운 건물 벽까지 (9m 넘으면 9)
      const x0 = Math.min(a[0], b[0]) - 9, x1 = Math.max(a[0], b[0]) + 9, z0 = Math.min(a[1], b[1]) - 9, z1 = Math.max(a[1], b[1]) + 9;
      let best = 9;
      for (const B of blds) {
        if (B.bb[2] < x0 || B.bb[0] > x1 || B.bb[3] < z0 || B.bb[1] > z1) continue;
        for (let i = 0, j = B.r.length - 1; i < B.r.length; j = i++) best = Math.min(best, segSeg(a, b, B.r[j], B.r[i]));
      }
      return best;
    };
    const onCampus = (p) => camp.length < 3 || inside(p, camp) || distToRing(p, camp) <= near;
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    let segs = [];
    for (const r of campus.roads || []) {
      if (!WALK_KINDS[r.k]) continue;
      const p = ringPts(r.pts);
      for (let i = 0; i + 1 < p.length; i++) segs.push({ a: p[i], b: p[i + 1], w: r.w });
    }
    const ends = []; for (const s of segs) ends.push(s.a, s.b);
    const split = [];
    for (const s of segs) {
      const cuts = [];
      for (const e of ends) { const q = segInfo(e, s.a, s.b); if (q.d < snap && q.t > 0.02 && q.t < 0.98) cuts.push(q.t); }
      cuts.sort((x, y) => x - y);
      let prev = s.a, pt = 0;
      for (const t of cuts) { if (t - pt < 0.01) continue; const q = lerp(s.a, s.b, t); split.push({ a: prev, b: q, w: s.w }); prev = q; pt = t; }
      split.push({ a: prev, b: s.b, w: s.w });
    }
    const nodes = [], grid = new Map(), edges = [];
    const nodeOf = (p) => {
      const gx = Math.round(p[0] / snap), gz = Math.round(p[1] / snap);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get((gx + dx) + ',' + (gz + dz));
        if (list) for (const i of list) if (Math.hypot(nodes[i].x - p[0], nodes[i].z - p[1]) < snap) return i;
      }
      const i = nodes.length; nodes.push({ x: p[0], z: p[1], adj: [] });
      const k = gx + ',' + gz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
      return i;
    };
    for (const s of split) {
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), n = Math.max(1, Math.ceil(L / 1.5));
      // 벽에 닿거나 가로지르는 조각, 건물 속에 통째로 든 조각(가로지르지 않으니 가운데 한 점만 보면 돼요), 캠퍼스 밖 조각은 빼요
      const clear = clearSeg(s.a, s.b);
      let ok = clear >= 0.05 && !inBld(lerp(s.a, s.b, 0.5));
      for (let i = 0; i <= n && ok; i++) if (!onCampus(lerp(s.a, s.b, i / n))) ok = false;
      if (!ok) continue;
      const a = nodeOf(s.a), b = nodeOf(s.b);
      if (a === b || nodes[a].adj.some((ei) => edges[ei].a === b || edges[ei].b === b)) continue;
      const ei = edges.length;
      edges.push({ a, b, L: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z), w: s.w,
                   lane: Math.max(0, Math.min(0.85, s.w * 0.32, clear - 0.55)) });   // 옆으로 비켜 걸을 수 있는 폭 (건물 벽에서 0.55m 띄워요)
      nodes[a].adj.push(ei); nodes[b].adj.push(ei);
    }
    // 가장 큰 덩어리 (길이 합)
    const comp = new Int32Array(nodes.length).fill(-1); let best = -1, bestLen = -1;
    for (let i = 0, c = 0; i < nodes.length; i++) {
      if (comp[i] >= 0 || !nodes[i].adj.length) continue;
      let len = 0; const st = [i]; comp[i] = c;
      while (st.length) { const u = st.pop(); for (const ei of nodes[u].adj) { const e = edges[ei], v = e.a === u ? e.b : e.a; len += e.L / 2; if (comp[v] < 0) { comp[v] = c; st.push(v); } } }
      if (len > bestLen) { bestLen = len; best = c; }
      c++;
    }
    const map = new Map(), outN = [], outE = [];
    nodes.forEach((n, i) => { if (comp[i] === best && best >= 0) { map.set(i, outN.length); outN.push({ x: n.x, z: n.z, adj: [] }); } });
    for (const e of edges) {
      if (!map.has(e.a)) continue;
      const a = map.get(e.a), b = map.get(e.b), ei = outE.length;
      outE.push({ a, b, L: e.L, w: e.w, lane: e.lane }); outN[a].adj.push(ei); outN[b].adj.push(ei);
    }
    return { nodes: outN, edges: outE, length: outE.reduce((s, e) => s + e.L, 0) };
  }

  // ---------------------------------------------------------------- 학생들의 움직임 (그리기와 떼어 낸 순수 계산: Node 에서도 시험해요)
  // 무작위 목적지를 골라 가장 짧은 길로 걷고, 도착하면 잠깐 멈춰 휴대폰을 보거나 둘러봐요. 걷다 스친 둘은 가끔 멈춰 이야기해요.
  // zones = 흡연 의심 센서 둘레 [{id, x, z, r}]. 처음 들어간 학생은 "아 담배 냄새!" 하고 1.7초 코를 막은 뒤 그 둘레에서 먼 곳으로 빨리 걸어가요.
  // 한 번 맡은 구역은 기억해서(그 구역이 없어질 때까지) 목적지로 고르지 않고, 길을 고를 때도 돌아가요.
  const SKIN = [0xf3d2b3, 0xeac09a, 0xdba77f, 0xc98e66, 0xa8714c, 0x7d5236];
  const HAIR = [0x1c1a19, 0x1c1a19, 0x2e231c, 0x4a3426, 0x6b4a2f, 0x9c7346, 0xc8a46e, 0x7b3b2a];
  const SHIRT = [0x2f4a7a, 0xf1f1ec, 0x8c949c, 0x79c3b2, 0xe2b43f, 0xc94b40, 0x6aa3d8, 0xe79fb4, 0x2c2c2e, 0x4e8a5a, 0xf08a4b, 0x9b7fd1];
  const PANTS = [0x3b5878, 0x2a2a2c, 0xcbb894, 0x6c7177, 0x46566b, 0x8a6f5a];
  const BAG = [0x33475b, 0x8e44ad, 0xc0582b, 0x22313f, 0x1f8a76, 0x7c8a8c, 0xb83b5e];
  const SMELL_TEXT = '아 담배 냄새!';
  const TALK = ['안녕!', '점심 뭐 먹지?', '과제 했어?', '수업 늦겠다!', '오늘 날씨 좋다', '도서관 갈래?', '시험 언제야?'];
  function makeCrowd(G, o) {
    o = o || {};
    const rand = rng(o.seed || 1), pick = (a) => a[Math.floor(rand() * a.length)];
    const nodes = G.nodes, edges = G.edges, NN = nodes.length;
    const N = NN >= 2 ? Math.max(0, Math.floor(o.count ?? 40)) : 0;
    const MAX_SMELL = 4, MAX_TALK = 2, REACT_S = 1.7, SMELL_S = 2.8;
    const npcs = [];
    let zones = [], zoneSig = '', zoneEdges = new Map(), time = 0, spawned = false, chatClock = 0;
    const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
    const edgeBetween = (u, v) => { for (const ei of nodes[u].adj) { const e = edges[ei]; if ((e.a === u && e.b === v) || (e.b === u && e.a === v)) return e; } return null; };
    function nearestNode(x, z, maxD) {
      let best = -1, bd = maxD ?? Infinity;
      for (let i = 0; i < NN; i++) { const d = dist(x, z, nodes[i].x, nodes[i].z); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    function setZones(list) {
      const sig = list.map((q) => q.id + ':' + q.x + ':' + q.z + ':' + q.r).join('|');
      if (sig === zoneSig) return;
      zoneSig = sig; zones = list.map((q) => ({ id: q.id, x: q.x, z: q.z, r: q.r }));
      zoneEdges = new Map(zones.map((q) => {
        const s = new Set();
        edges.forEach((e, i) => { if (segInfo([q.x, q.z], [nodes[e.a].x, nodes[e.a].z], [nodes[e.b].x, nodes[e.b].z]).d < q.r + 6) s.add(i); });
        return [q.id, s];
      }));
      const live = new Set(zones.map((q) => q.id));
      for (const n of npcs) for (const id of [...n.mem.keys()]) if (!live.has(id)) n.mem.delete(id);   // 없어진 구역은 잊어요
    }
    // 가장 짧은 길 (마디 수가 작아 단순한 다익스트라로 충분해요). 기억한 구역 둘레 길은 30배 길게 쳐서 돌아가요
    function route(from, to, mem) {
      let pen = null;
      if (mem && mem.size) { pen = new Set(); for (const id of mem.keys()) { const s = zoneEdges.get(id); if (s) for (const i of s) pen.add(i); } }
      const D = new Float64Array(NN).fill(Infinity), prev = new Int32Array(NN).fill(-1), done = new Uint8Array(NN);
      D[from] = 0;
      for (;;) {
        let u = -1, best = Infinity;
        for (let i = 0; i < NN; i++) if (!done[i] && D[i] < best) { best = D[i]; u = i; }
        if (u < 0 || u === to) break;
        done[u] = 1;
        for (const ei of nodes[u].adj) {
          const e = edges[ei], v = e.a === u ? e.b : e.a, c = best + e.L * (pen && pen.has(ei) ? 30 : 1);
          if (c < D[v]) { D[v] = c; prev[v] = u; }
        }
      }
      if (!isFinite(D[to])) return null;
      const out = []; for (let v = to; v >= 0; v = prev[v]) out.push(v);
      out.reverse();
      return out[0] === from ? out : null;
    }
    const remembered = (n, x, z, pad) => zones.some((q) => n.mem.has(q.id) && dist(x, z, q.x, q.z) < q.r + pad);
    function pickDest(n, from, flee) {
      const f = nodes[from];
      if (flee) {   // 맡은 구역에서 25m 넘게 떨어지고, 너무 멀지 않은 곳
        let best = -1, score = -Infinity;
        for (let k = 0; k < 48; k++) {
          const i = Math.floor(rand() * NN), nd = nodes[i]; if (i === from) continue;
          let zd = 120; for (const q of zones) if (n.mem.has(q.id)) zd = Math.min(zd, dist(nd.x, nd.z, q.x, q.z) - q.r);
          if (zd < 25) continue;
          const sc = Math.min(zd, 90) - dist(f.x, f.z, nd.x, nd.z) * 0.2;
          if (sc > score) { score = sc; best = i; }
        }
        if (best >= 0) return best;
      }
      const hs = o.hotspots ? o.hotspots() : [];
      for (let k = 0; k < 30; k++) {
        let i;
        if (hs.length && rand() < 0.28) {   // 센서 둘레(25~75m)도 자주 지나가요
          const h = pick(hs), near = [];
          for (let j = 0; j < NN; j++) { const d = dist(nodes[j].x, nodes[j].z, h.x, h.z); if (d > 25 && d < 75) near.push(j); }
          if (!near.length) continue;
          i = pick(near);
        } else i = Math.floor(rand() * NN);
        const nd = nodes[i], d = dist(f.x, f.z, nd.x, nd.z);
        if (i === from || d < 30 || d > 450 || remembered(n, nd.x, nd.z, 20)) continue;
        return i;
      }
      return (from + 1 + Math.floor(rand() * (NN - 1))) % NN;
    }
    function nearestZone(n) { let b = null, bd = Infinity; for (const q of zones) { const d = dist(n.x, n.z, q.x, q.z) - q.r; if (d < bd) { bd = d; b = q; } } return b; }
    function plan(n, flee) {
      let start = n.node, lead = null;
      if (n.path && n.seg < n.path.length - 1) {   // 길 가운데에 서 있으면: 가까운 쪽(피할 때는 구역 반대쪽) 끝 마디에서 출발
        const a0 = n.path[n.seg], b = n.path[n.seg + 1];
        const a = a0.n >= 0 ? a0 : { x: nodes[n.node].x, z: nodes[n.node].z, n: n.node };
        if (b.n >= 0) {
          const q = flee ? nearestZone(n) : null;
          const toB = q ? dist(b.x, b.z, q.x, q.z) >= dist(a.x, a.z, q.x, q.z) : dist(n.x, n.z, b.x, b.z) <= dist(n.x, n.z, a.x, a.z);
          const end = toB ? b : a;
          start = end.n; lead = { x: end.x, z: end.z, n: end.n, lane: b.lane };
        }
      }
      const dest = pickDest(n, start, flee);
      const r = route(start, dest, n.mem);
      if (!r || r.length < 2) { n.mode = 'idle'; n.t = 1 + rand() * 2; n.path = null; n.fast = false; return; }
      const pts = [{ x: n.x, z: n.z, n: lead ? -1 : start, lane: 0 }];
      if (lead && dist(n.x, n.z, lead.x, lead.z) > 0.01) pts.push(lead); else if (lead) pts[0].n = lead.n;
      for (let k = 1; k < r.length; k++) { const e = edgeBetween(r[k - 1], r[k]); pts.push({ x: nodes[r[k]].x, z: nodes[r[k]].z, n: r[k], lane: e ? e.lane : 0 }); }
      n.path = pts; n.seg = 0; n.d = 0; n.mode = 'walk'; n.fast = !!flee; n.dest = dest;
      if (pts[0].n >= 0) n.node = pts[0].n;
    }
    // 길을 따라 m 미터 걸어요. 끝에 닿으면 true
    function advance(n, m) {
      const P = n.path;
      while (m > 0 && n.seg < P.length - 1) {
        const a = P[n.seg], b = P[n.seg + 1], L = dist(a.x, a.z, b.x, b.z), left = L - n.d;
        if (m < left) { n.d += m; m = 0; } else { m -= left; n.seg++; n.d = 0; if (b.n >= 0) n.node = b.n; }
      }
      if (n.seg >= P.length - 1) { const e = P[P.length - 1]; n.x = e.x; n.z = e.z; return true; }
      const a = P[n.seg], b = P[n.seg + 1], L = dist(a.x, a.z, b.x, b.z) || 1, t = n.d / L;
      n.x = a.x + (b.x - a.x) * t; n.z = a.z + (b.z - a.z) * t;
      n.dirx = (b.x - a.x) / L; n.dirz = (b.z - a.z) / L; n.laneMax = b.lane;
      return false;
    }
    function makeLook() {
      return { skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT), pants: pick(PANTS), bag: rand() < 0.7 ? pick(BAG) : 0, long: rand() < 0.38 };
    }
    function spawn() {
      spawned = true;
      const hs = o.hotspots ? o.hotspots() : [];
      for (let i = 0; i < N; i++) {
        let node = Math.floor(rand() * NN);
        if (hs.length && i % 4 === 0) {   // 네 명에 한 명은 센서 둘레(30~80m)에서 시작해요
          const h = hs[(i / 4 | 0) % hs.length], near = [];
          for (let j = 0; j < NN; j++) { const d = dist(nodes[j].x, nodes[j].z, h.x, h.z); if (d > 30 && d < 80) near.push(j); }
          if (near.length) node = pick(near);
        }
        const nd = nodes[node];
        npcs.push({ id: i, x: nd.x, z: nd.z, rx: nd.x, rz: nd.z, ox: 0, oz: 0, h: rand() * Math.PI * 2, node, path: null, seg: 0, d: 0,
                    dirx: 0, dirz: 1, laneMax: 0, lane: rand() * 2 - 1, mode: 'idle', t: rand() * 2.5, pose: rand() < 0.5 ? 'phone' : 'look',
                    speed: 1.15 + rand() * 0.45, fast: false, phase: rand() * 6.28, say: null, mem: new Map(), talkCool: rand() * 20,
                    reacts: 0, face: 0, partner: null, dest: -1, memS: 100 + rand() * 60, look: makeLook() });
      }
    }
    function chats(cnt) {
      for (let i = 0; i < npcs.length; i++) {
        const a = npcs[i]; if (a.mode !== 'walk' || a.talkCool > time) continue;
        for (let j = i + 1; j < npcs.length; j++) {
          const b = npcs[j]; if (b.mode !== 'walk' || b.talkCool > time) continue;
          if (Math.abs(a.rx - b.rx) > 2.2 || Math.abs(a.rz - b.rz) > 2.2 || dist(a.rx, a.rz, b.rx, b.rz) > 2.2) continue;
          a.talkCool = b.talkCool = time + 30 + rand() * 30;
          if (rand() > 0.35) break;
          const t = 3 + rand() * 3;
          a.mode = b.mode = 'chat'; a.t = b.t = t; a.partner = b; b.partner = a;
          if (cnt.talk < MAX_TALK) { const s = rand() < 0.5 ? a : b; s.say = { text: pick(TALK), kind: 'talk', until: time + Math.min(t, 3.2) }; cnt.talk++; }
          break;
        }
      }
    }
    // dt 초만큼 움직여요. vis = 화면에서 키운 배율 (멀리서 보면 학생을 크게 그려요 → 걸음도 그만큼 크게 · 조금 빠르게)
    function step(dt, vis) {
      if (!N || !(dt > 0)) return;
      if (!spawned) spawn();
      vis = Math.max(1, vis || 1);
      time += dt;
      const cnt = { smell: 0, talk: 0 };
      for (const n of npcs) if (n.say) { if (time > n.say.until) n.say = null; else cnt[n.say.kind]++; }
      for (const n of npcs) {
        if (n.mode !== 'react') for (const q of zones) {   // 냄새: 처음 들어간 흡연 의심 구역이면 반응해요
          const seen = n.mem.get(q.id);
          if (seen !== undefined) { if (time - seen < n.memS) continue; n.mem.delete(q.id); }
          if (dist(n.x, n.z, q.x, q.z) > q.r) continue;
          n.mem.set(q.id, time);
          if (n.partner) { n.partner.partner = null; n.partner = null; }
          n.mode = 'react'; n.t = REACT_S; n.fast = false;
          n.face = Math.atan2(n.x - q.x, n.z - q.z);   // 구역 반대쪽으로 돌아서요
          if (cnt.smell < MAX_SMELL) { n.say = { text: SMELL_TEXT, kind: 'smell', until: time + SMELL_S }; cnt.smell++; }
          n.reacts++;
          break;
        }
        if (n.mode === 'walk') {
          const m = n.speed * (n.fast ? 1.5 : 1) * (1 + 0.3 * (vis - 1)) * dt;
          const end = advance(n, m);
          n.phase += m / (0.62 * vis) * Math.PI;
          if (end) { n.mode = 'idle'; n.t = 2 + rand() * 6; n.pose = rand() < 0.5 ? 'phone' : 'look'; n.fast = false; n.path = null; }
        } else if (n.mode === 'idle' || n.mode === 'chat') {
          n.t -= dt;
          if (n.t <= 0) {
            const resume = n.mode === 'chat' && n.path && n.seg < n.path.length - 1;
            if (n.partner && n.partner.partner === n) n.partner.partner = null;
            n.partner = null;
            if (resume) n.mode = 'walk'; else plan(n, false);
          }
        } else if (n.mode === 'react') {
          n.t -= dt;
          if (n.t <= 0) plan(n, true);
        }
        let want = n.h;
        if (n.mode === 'walk') want = Math.atan2(n.dirx, n.dirz);
        else if (n.mode === 'react') want = n.face;
        else if (n.mode === 'chat' && n.partner) want = Math.atan2(n.partner.rx - n.rx, n.partner.rz - n.rz);
        n.h += angDiff(want, n.h) * Math.min(1, dt * 7);
        if (n.mode === 'walk') {   // 길 가운데만 걷지 않게 옆으로 조금 비켜 걸어요 (길 폭 · 건물 벽까지 거리 안에서)
          const off = n.lane * n.laneMax, k = Math.min(1, dt * 2.5);
          n.ox += (-n.dirz * off - n.ox) * k; n.oz += (n.dirx * off - n.oz) * k;
          const mag = Math.hypot(n.ox, n.oz);
          if (mag > n.laneMax) { const f = n.laneMax / mag; n.ox *= f; n.oz *= f; }
        }
        n.rx = n.x + n.ox; n.rz = n.z + n.oz;
      }
      chatClock += dt;
      if (chatClock >= 0.5) { chatClock = 0; chats(cnt); }
    }
    return {
      get npcs() { if (!spawned && N) spawn(); return npcs; },
      get count() { return N; },
      get time() { return time; },
      get zones() { return zones; },
      setZones, step, nearestNode, route,
      // 시험용: i 번 학생을 마디 node 에 세워요 (아무 것도 기억하지 않은 채 오래 서 있게)
      place(i, node, still) {
        if (!spawned) spawn();
        const n = npcs[i], nd = nodes[node]; if (!n || !nd) return false;
        Object.assign(n, { x: nd.x, z: nd.z, rx: nd.x, rz: nd.z, ox: 0, oz: 0, node, path: null, seg: 0, d: 0, mode: 'idle', t: still ?? 30, say: null, fast: false, partner: null });
        n.mem.clear();
        return true;
      },
    };
  }

  // ---------------------------------------------------------------- 지도 만들기
  function create(container, campus, opts) {
    opts = opts || {};
    if (!T || !T.WebGLRenderer || !T.OrbitControls) throw new Error('3D 지도를 그리는 three.js를 불러오지 못했어요');
    const okGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
    if (!okGL) throw new Error('이 기기나 브라우저에서는 3D 그래픽 기능인 WebGL을 쓸 수 없어요');

    const wrap = document.createElement('div'); wrap.className = 'm3-wrap'; container.appendChild(wrap);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.preserve });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    // 그림자는 거의 움직이지 않아요(해 · 건물 · 나무는 그대로, 센서 머리만 살짝 출렁): 그림자 지도는 0.1초에 한 번만 새로 그려요 (핀을 옮기면 바로)
    renderer.shadowMap.autoUpdate = false;
    let shadowAt = -1e9;
    wrap.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', (campus.name || '캠퍼스') + ' 3D 지도');
    const overlay = document.createElement('div'); overlay.className = 'm3-labels'; wrap.appendChild(overlay);

    // ---- 그림 품질: 휴대폰(좁은 화면)이나 그래픽 칩 없이 그리는 컴퓨터(소프트웨어 WebGL)는 가볍게, 나머지는 촘촘하게
    const SMALL = (root.innerWidth || 1000) <= 700;
    const gpu = (() => {
      try {
        const gl = renderer.getContext(); let r = String(gl.getParameter(gl.RENDERER) || '');
        if (!r || /webkit webgl/i.test(r)) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || r); }
        return r;
      } catch (e) { return ''; }
    })();
    const SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
    const QUALITY = opts.quality === 'high' || opts.quality === 'low' ? opts.quality : (SMALL || SOFT ? 'low' : 'high');
    const HI = QUALITY === 'high';
    // 화면 촘촘함: 처음에는 기기 그대로(최대 2배), 빠르게 그려지면 0.25씩 올리고(최대 2배) 느려지면 내려요
    const DPR = root.devicePixelRatio || 1;
    let prNow = Math.min(2, DPR);
    const PR_MAX = Math.min(2, Math.max(HI ? 1.5 : 1, DPR));
    renderer.setPixelRatio(prNow);
    const ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);

    const R = campus.rect, W = R.x1 - R.x0, D = R.z1 - R.z0, CX = (R.x0 + R.x1) / 2, CZ = (R.z0 + R.z1) / 2;
    const span = Math.max(W, D);
    const TR = campus.terrain;
    // 땅 높이: 10m 간격 고도를 부드러운 곡선(Catmull-Rom)으로 이어요 → 비탈이 10m 마다 꺾이지 않아요
    function hRaw(x, z) {
      if (!TR) return 0;
      const gx = (x - TR.x0) / TR.step, gz = (z - TR.z0) / TR.step;
      const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
      const g = (a, b) => TR.h[Math.max(0, Math.min(TR.nz - 1, b)) * TR.nx + Math.max(0, Math.min(TR.nx - 1, a))];
      const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
      const row = (b) => cr(g(i - 1, b), g(i, b), g(i + 1, b), g(i + 2, b), fx);
      return cr(row(j - 1), row(j), row(j + 1), row(j + 2), fz);
    }
    // ---- 평평하게 고른 땅: 축구장(대운동장)과 전통 건물 터
    //   고도 자료(10m 간격)는 둘레의 비탈을 운동장 안까지 끌고 들어와, 실제로는 평평한 운동장이 26~54m 로 오르내렸어요.
    //   안쪽(+margin)은 안쪽 평균 높이 하나로 두고, 그 바깥 band m 동안 원래 땅으로 부드럽게 이어요 (둘레가 둑처럼 보여요)
    const FLATS = [];
    function addFlat(kind, name, ring, margin, band, step) {
      const bb = bbox(ring); let sum = 0, n = 0;
      for (let x = bb[0] + step / 2; x < bb[2]; x += step) for (let z = bb[1] + step / 2; z < bb[3]; z += step) if (inside([x, z], ring)) { sum += hRaw(x, z); n++; }
      const m = margin + band;
      const f = { kind, name, ring, margin, band, level: n ? sum / n : hRaw(...centroid(ring)), bb: [bb[0] - m, bb[1] - m, bb[2] + m, bb[3] + m] };
      FLATS.push(f);
      return f;
    }
    function hAt(x, z) {
      let h = hRaw(x, z);
      for (const f of FLATS) {
        if (x < f.bb[0] || x > f.bb[2] || z < f.bb[1] || z > f.bb[3]) continue;
        const d = inside([x, z], f.ring) ? 0 : distToRing([x, z], f.ring);
        if (d >= f.margin + f.band) continue;
        const t = d <= f.margin ? 0 : (d - f.margin) / f.band;
        h += (f.level - h) * (1 - t * t * (3 - 2 * t));
      }
      return h;
    }
    // 가장 작은 넓이로 감싸는 돌린 직사각형: 가운데(cx, cz), 긴 쪽 방향 th(-90°~90°), 반 길이 L ≥ 반 폭 W
    function obb(ring) {
      let best = null;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) continue;
        const th = Math.atan2(b[1] - a[1], b[0] - a[0]), ux = Math.cos(th), uz = Math.sin(th);
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (const [x, z] of ring) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        const A = (u1 - u0) * (v1 - v0);
        if (!best || A < best.A - 1e-6) best = { A, th, u0, u1, v0, v1 };
      }
      let { th } = best; const { u0, u1, v0, v1 } = best;
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, cx = uc * Math.cos(th) - vc * Math.sin(th), cz = uc * Math.sin(th) + vc * Math.cos(th);
      let L = (u1 - u0) / 2, W = (v1 - v0) / 2;
      if (W > L) { [L, W] = [W, L]; th += Math.PI / 2; }
      while (th > Math.PI / 2) th -= Math.PI;
      while (th <= -Math.PI / 2) th += Math.PI;
      return { cx, cz, th, L, W };
    }
    // 축구장 크기: 정식 105 × 68m 가 들어가면 그대로, 작으면 줄여요 (k = 줄인 비율)
    function soccerDims(box) { const PL = Math.min(52.5, box.L - 4.5), PW = Math.min(34, box.W - 3); return { PL, PW, k: Math.max(0.4, Math.min(1, PL / 52.5, PW / 34)) }; }
    const soccerFields = (campus.areas || []).filter((a) => a.k === 'pitch' && a.sport === 'soccer').map((a) => ({ a, ring: ringPts(a.outer) })).filter((q) => q.ring.length >= 3);
    for (const q of soccerFields) { q.box = obb(q.ring); q.flat = addFlat('pitch', q.a.name || '', q.ring, 4, 22, 2); }
    const tradSites = (campus.buildings || []).filter((b) => b.trad).map((b) => ({ b, ring: ringPts(b.outer) })).filter((q) => q.ring.length >= 3);
    for (const q of tradSites) { q.box = obb(q.ring); q.flat = addFlat(q.b.trad, q.b.name || '', q.ring, 3, 10, 1); }
    const SKIRT = -10;   // 모형 받침 바닥 높이

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, 3, span * 10);
    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.42; controls.minPolarAngle = 0;
    controls.minDistance = 30; controls.maxDistance = span * 2.2;   // 30m 까지 가까이: 걷는 학생도 보여요
    controls.screenSpacePanning = false;
    // 지도처럼 움직여요: 왼쪽 끌기 = 옮기기, 오른쪽 끌기 · Ctrl/Shift + 끌기 = 돌리기, 휠 = 확대 · 축소
    //   손가락: 한 손가락 = 옮기기, 두 손가락 = 벌려 확대 · 비틀어 돌리기
    controls.mouseButtons = { LEFT: T.MOUSE.PAN, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.ROTATE };
    controls.touches = { ONE: T.TOUCH.PAN, TWO: T.TOUCH.DOLLY_ROTATE };
    const homeT = opts.homeTarget || [0, 0];
    const HOME = { theta: opts.homeTheta ?? 1.32, phi: opts.homePhi ?? 0.92, dist: opts.homeDist ?? span * 1.02 };
    let lastTX = 0, lastTZ = 0;   // 끌어 옮기기 전 기준점 자리 (아래 'change' 참고)
    // 손을 뗀 뒤에도 남아 있는 회전 관성을 먼저 없애고 옮겨요 (안 그러면 기본 보기를 눌러도 조금 더 돌아가요)
    function stopCoasting() { const d = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = d; }
    function setView(theta, phi, dist, tx, tz) {
      stopCoasting();
      controls.target.set(tx, hAt(tx, tz), tz); lastTX = tx; lastTZ = tz;
      const t = controls.target;
      camera.position.set(t.x + dist * Math.sin(phi) * Math.sin(theta), t.y + dist * Math.cos(phi), t.z + dist * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(t); controls.update();
    }
    setView(HOME.theta, HOME.phi, HOME.dist, homeT[0], homeT[1]);
    let userMoved = false;   // 사람이 지도를 움직이기 전까지는 화면 크기가 바뀌면 기본 보기를 다시 맞춰요
    // 끌어 옮기면(손을 뗀 뒤 미끄러지는 동안도) 기준점이 언덕을 따라 오르내려요. 땅과의 높이 차는 그대로 둬요
    //   (지붕 위 센서로 간 뒤에 옮겨도 화면이 튀지 않아요). 돌리기 · 확대는 기준점이 그대로라 높이도 그대로예요.
    //   느린 기기에서 오래 미끄러져도 같아요 (시간이 아니라 옮긴 거리로 계산해요)
    controls.addEventListener('start', () => { userMoved = true; });
    // 화면 밖으로 너무 멀리 끌고 가지 않게
    controls.addEventListener('change', () => {
      const t = controls.target, cx = Math.max(R.x0, Math.min(R.x1, t.x)), cz = Math.max(R.z0, Math.min(R.z1, t.z));
      const moved = Math.abs(cx - lastTX) > 1e-4 || Math.abs(cz - lastTZ) > 1e-4;
      const dy = moved ? hAt(cx, cz) - hAt(lastTX, lastTZ) : 0;
      if (cx !== t.x || cz !== t.z || dy) { const dx = cx - t.x, dz = cz - t.z; t.x = cx; t.z = cz; t.y += dy; camera.position.x += dx; camera.position.y += dy; camera.position.z += dz; }
      lastTX = t.x; lastTZ = t.z;
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

    // ---- 땅 (지형 + 캔버스 그림). 촘촘한 격자(2.5m · 휴대폰 5m)로 세우고, 길 · 학생은 이 면(hMesh)에 딱 붙여요
    const TEX = Math.min(renderer.capabilities.maxTextureSize || 2048, (root.innerWidth || 1000) > 700 ? 4096 : 2048);
    const groundCanvas = document.createElement('canvas'); groundCanvas.width = TEX; groundCanvas.height = Math.round(TEX * D / W);
    const groundTex = new T.CanvasTexture(groundCanvas);
    groundTex.anisotropy = ANISO;
    const GS = HI ? 2.5 : 5;
    const gnx = Math.round(W / GS), gnz = Math.round(D / GS), gcw = W / gnx, gch = D / gnz;
    const GH = new Float32Array((gnx + 1) * (gnz + 1));
    for (let j = 0; j <= gnz; j++) for (let i = 0; i <= gnx; i++) GH[j * (gnx + 1) + i] = hAt(R.x0 + i * gcw, R.z0 + j * gch);
    // 그려진 땅 면 그대로의 높이 (격자 한 칸을 대각선으로 나눈 삼각형 두 개)
    function hMesh(x, z) {
      const fx = (x - R.x0) / gcw, fz = (z - R.z0) / gch;
      const i = Math.max(0, Math.min(gnx - 1, Math.floor(fx))), j = Math.max(0, Math.min(gnz - 1, Math.floor(fz)));
      const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j));
      const k = j * (gnx + 1) + i, ha = GH[k], hd = GH[k + 1], hb = GH[k + gnx + 1], hc = GH[k + gnx + 2];
      return u + v <= 1 ? ha + (hd - ha) * u + (hb - ha) * v : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
    }
    const gGeo = (() => {
      const n = (gnx + 1) * (gnz + 1), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
      for (let j = 0; j <= gnz; j++) for (let i = 0; i <= gnx; i++) {
        const k = j * (gnx + 1) + i;
        pos[k * 3] = R.x0 + i * gcw; pos[k * 3 + 1] = GH[k]; pos[k * 3 + 2] = R.z0 + j * gch;
        uv[k * 2] = i / gnx; uv[k * 2 + 1] = 1 - j / gnz;
      }
      for (let j = 0; j < gnz; j++) for (let i = 0; i < gnx; i++) { const a = j * (gnx + 1) + i, b = a + gnx + 1, c = b + 1, d = a + 1; idx.push(a, b, d, b, c, d); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    const ground = new T.Mesh(gGeo, new T.MeshLambertMaterial({ map: groundTex }));
    ground.receiveShadow = true; ground.userData.kind = 'ground'; scene.add(ground);
    // 받침 옆면 (모형처럼 잘린 단면): 땅 격자 가장자리와 같은 점을 써서 틈이 없어요
    const skirtMat = new T.MeshLambertMaterial({ color: 0x8a7f70 });
    const skirt = new T.Mesh(skirtGeometry(), skirtMat); scene.add(skirt);
    const baseGeo = new T.PlaneGeometry(W, D); baseGeo.rotateX(Math.PI / 2); baseGeo.translate(CX, SKIRT, CZ);
    const baseMesh = new T.Mesh(baseGeo, skirtMat); scene.add(baseMesh);
    function skirtGeometry() {
      const pos = [], idx = [];
      const gh = (i, j) => GH[j * (gnx + 1) + i];
      const edge = (list) => {
        for (let k = 0; k + 1 < list.length; k++) {
          const [x0, y0, z0] = list[k], [x1, y1, z1] = list[k + 1], o = pos.length / 3;
          pos.push(x0, y0, z0, x1, y1, z1, x1, SKIRT, z1, x0, SKIRT, z0);
          idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
        }
      };
      const S = [], E = [], N = [], Wd = [];
      for (let i = 0; i <= gnx; i++) S.push([R.x0 + i * gcw, gh(i, gnz), R.z1]);   // 남쪽 (서 → 동)
      for (let j = gnz; j >= 0; j--) E.push([R.x1, gh(gnx, j), R.z0 + j * gch]);   // 동쪽 (남 → 북)
      for (let i = gnx; i >= 0; i--) N.push([R.x0 + i * gcw, gh(i, 0), R.z0]);   // 북쪽 (동 → 서)
      for (let j = 0; j <= gnz; j++) Wd.push([R.x0, gh(0, j), R.z0 + j * gch]);   // 서쪽 (북 → 남)
      edge(S); edge(E); edge(N); edge(Wd);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    }

    const VEC_ROADS = opts.vectorRoads !== false;
    // 축구장 그림: 잔디 줄무늬 + 흰 선 (터치라인 · 하프라인 · 센터서클 · 벌칙 구역 · 골 구역 · 벌칙 점 · 반원 · 모서리).
    //   선은 실제(12cm)보다 굵게(45cm) 그려야 멀리서도 보여요
    function paintSoccer(c, sf, p, X, Z, sx, sz) {
      const { cx, cz, th } = sf.box, { PL, PW, k } = soccerDims(sf.box);
      c.save();
      c.beginPath(); sf.ring.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.closePath();
      c.fillStyle = p.pitchOut; c.fill(); c.clip();
      c.translate(X(cx), Z(cz)); c.scale(sx, sz); c.rotate(th);   // 여기부터 단위는 m: 가로 = 긴 쪽, 세로 = 짧은 쪽
      const N = 14, sw = 2 * PL / N;
      for (let i = 0; i < N; i++) { c.fillStyle = i % 2 ? p.pitchAlt : p.pitch; c.fillRect(-PL + i * sw, -PW, sw + 0.02, 2 * PW); }
      c.strokeStyle = p.pitchMark; c.fillStyle = p.pitchMark; c.lineWidth = 0.45;
      const arc = (x, y, r, a0, a1) => { c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); };
      const dot = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
      c.strokeRect(-PL, -PW, 2 * PL, 2 * PW);
      c.beginPath(); c.moveTo(0, -PW); c.lineTo(0, PW); c.stroke();
      arc(0, 0, 9.15 * k, 0, Math.PI * 2); dot(0, 0, 0.5);
      const ang = Math.acos((16.5 - 11) / 9.15);
      for (const sgn of [-1, 1]) {
        const gx = sgn * PL, inward = -sgn;
        for (const [dep, half] of [[16.5, 20.16], [5.5, 9.16]]) c.strokeRect(inward > 0 ? gx : gx - dep * k, -half * k, dep * k, 2 * half * k);
        const ps = gx + inward * 11 * k; dot(ps, 0, 0.45);
        if (inward > 0) arc(ps, 0, 9.15 * k, -ang, ang); else arc(ps, 0, 9.15 * k, Math.PI - ang, Math.PI + ang);
        for (const sv of [-1, 1]) { const a0 = inward > 0 ? (sv > 0 ? -Math.PI / 2 : 0) : (sv > 0 ? Math.PI : Math.PI / 2); arc(gx, sv * PW, 1.2 * k, a0, a0 + Math.PI / 2); }
      }
      c.restore();
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
        const sf = a.k === 'pitch' ? soccerFields.find((q) => q.a === a) : null;
        if (sf) paintSoccer(c, sf, p, X, Z, sx, sz);
        else if (a.k === 'pitch') { c.strokeStyle = p.pitchLine; c.lineWidth = 0.5 * sx; c.stroke(); }
        if (a.k === 'parking') { c.save(); poly(a.outer, a.holes); c.clip('evenodd'); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.15 * sx; for (let x = 0; x < groundCanvas.width; x += 2.6 * sx) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, groundCanvas.height); c.stroke(); } c.restore(); }
      }
      if (!VEC_ROADS) {   // 길을 도형으로 그리지 않을 때만 캔버스에 그려요
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
      }
      // 캠퍼스 경계 (점선)
      if (campus.campus) { poly(campus.campus); c.setLineDash([1.2 * sx, 1.6 * sx]); c.strokeStyle = 'rgba(17,106,134,0.55)'; c.lineWidth = 0.9 * sx; c.stroke(); c.setLineDash([]); }
      groundTex.needsUpdate = true;
    }

    // ---- 길 (도형): 캔버스와 같은 순서로 쌓아요 (작은 길 테두리 → 작은 길 → 계단 줄 → 큰 길 연석 → 큰 길 → 가운데 점선)
    //      땅 면(hMesh)에 붙이고 조금씩 띄워, 확대해도 번지지 않고 또렷해요. 그림자도 받아요.
    const roadLayer = (() => {
      if (!VEC_ROADS) return { meshes: [], colorize() {}, verts: 0 };
      const NL = 6, LIFT = [0.04, 0.06, 0.08, 0.1, 0.12, 0.14];
      const L = Array.from({ length: NL }, () => ({ pos: [], nor: [], cls: [], idx: [] }));
      const clampX = (x) => Math.max(R.x0, Math.min(R.x1, x)), clampZ = (z) => Math.max(R.z0, Math.min(R.z1, z));
      function vert(k, x, z, c) {
        x = clampX(x); z = clampZ(z);
        const l = L[k], gx = hAt(x - 1, z) - hAt(x + 1, z), gz = hAt(x, z - 1) - hAt(x, z + 1), inv = 1 / Math.hypot(gx, 2, gz);
        l.pos.push(x, hMesh(x, z) + LIFT[k], z); l.nor.push(gx * inv, 2 * inv, gz * inv); l.cls.push(c);
        return l.cls.length - 1;
      }
      function clip(ax, az, bx, bz) {   // 지도 네모 안 부분만 (Liang–Barsky)
        let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
        for (const [p, q] of [[-dx, ax - R.x0], [dx, R.x1 - ax], [-dz, az - R.z0], [dz, R.z1 - az]]) {
          if (p === 0) { if (q < 0) return null; continue; }
          const r = q / p;
          if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
        }
        return [ax + dx * t0, az + dz * t0, ax + dx * t1, az + dz * t1];
      }
      function band(k, ax, az, bx, bz, hw, c) {   // 선분을 폭 2·hw 띠로 (GS 마다 나눠 땅을 따라요)
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < 0.01) return;
        const nx = -dz / len * hw, nz = dx / len * hw, n = Math.max(1, Math.ceil(len / GS));
        let prev = -1;
        for (let i = 0; i <= n; i++) {
          const x = ax + dx * i / n, z = az + dz * i / n;
          const a = vert(k, x + nx, z + nz, c); vert(k, x - nx, z - nz, c);
          if (prev >= 0) L[k].idx.push(prev, a, prev + 1, prev + 1, a, a + 1);
          prev = a;
        }
      }
      function disc(k, x, z, r, c) {   // 꺾이는 곳 · 끝을 둥글게
        if (x < R.x0 || x > R.x1 || z < R.z0 || z > R.z1) return;
        const SEG = r > 2.5 ? 14 : 10, o = vert(k, x, z, c);
        for (let s = 0; s < SEG; s++) { const a = s / SEG * Math.PI * 2; vert(k, x + Math.cos(a) * r, z + Math.sin(a) * r, c); }
        for (let s = 0; s < SEG; s++) L[k].idx.push(o, o + 1 + (s + 1) % SEG, o + 1 + s);
      }
      function stroke(k, pts, hw, c) {
        for (let i = 0; i + 1 < pts.length; i++) { const s = clip(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); if (s) band(k, s[0], s[1], s[2], s[3], hw, c); }
        for (const [x, z] of pts) disc(k, x, z, hw, c);
      }
      function dashes(k, pts, on, off, hw, c) {   // 점선: on m 칠하고 off m 비우기 (꺾여도 이어서)
        let start = 0, acc = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
          if (len < 0.01) continue;
          const ux = (bx - ax) / len, uz = (bz - az) / len;
          while (start < acc + len) {
            const s0 = Math.max(start, acc) - acc, s1 = Math.min(start + on, acc + len) - acc;
            if (s1 > s0 + 0.01) { const g = clip(ax + ux * s0, az + uz * s0, ax + ux * s1, az + uz * s1); if (g) band(k, g[0], g[1], g[2], g[3], hw, c); }
            if (start + on > acc + len) break;
            start += on + off;
          }
          acc += len;
        }
      }
      const roads = (campus.roads || []).map((r) => ({ ...r, p: ringPts(r.pts) }));
      const small = roads.filter((r) => r.w < 4.5), big = roads.filter((r) => r.w >= 4.5);
      for (const r of small) stroke(0, r.p, (r.w + 0.6) / 2, 'pathEdge');
      for (const r of small) stroke(1, r.p, r.w / 2, r.k === 'steps' ? 'steps' : 'path');
      for (const r of small.filter((q) => q.k === 'steps')) dashes(2, r.p, 0.35, 0.45, r.w * 0.4, 'pathEdge');
      for (const r of big) stroke(3, r.p, (r.w + 1.4) / 2, 'curb');
      for (const r of big) stroke(4, r.p, r.w / 2, r.k === 'pedestrian' ? 'plaza' : 'road');
      for (const r of big.filter((q) => q.w >= 6.5 && q.k !== 'pedestrian')) dashes(5, r.p, 3, 3.5, 0.15, 'line');
      const meshes = L.map((l, k) => {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(l.pos, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(l.nor, 3));
        g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(l.cls.length * 3), 3));
        g.setIndex(l.idx);
        const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 - k * 2 }));
        m.receiveShadow = true; m.renderOrder = 2 + k; m.userData = { kind: 'road', cls: l.cls };
        scene.add(m);
        return m;
      });
      function colorize(p) {
        const cache = {};
        for (const m of meshes) {
          const a = m.geometry.attributes.color, cls = m.userData.cls;
          for (let i = 0; i < cls.length; i++) { const c = cache[cls[i]] || (cache[cls[i]] = new T.Color(p[cls[i]])); a.setXYZ(i, c.r, c.g, c.b); }
          a.needsUpdate = true;
        }
      }
      return { meshes, colorize, verts: L.reduce((s, l) => s + l.cls.length, 0) };
    })();

    // ---- 건물
    const WT = HI ? 256 : 128;   // 창문 그림 한 칸(가로 3.2m × 한 층 3.6m)의 화소
    function windowTexture(p, lit) {
      const S = WT, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      const x0 = Math.round(S * 0.17), x1 = Math.round(S * 0.83), y0 = Math.round(S * 0.25), y1 = Math.round(S * 0.71);
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, lit ? p.litTop : p.glassTop); gr.addColorStop(1, lit ? p.litBot : p.glassBot);
      g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.fillStyle = p.mullion; g.fillRect(Math.round(S / 2 - S / 96), y0, Math.max(1, Math.round(S / 48)), y1 - y0);   // 가운데 창살
      g.strokeStyle = p.frame; g.lineWidth = Math.max(1, S / 64); g.strokeRect(x0, y0, x1 - x0, y1 - y0);   // 창틀
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x0 - Math.round(S * 0.02), y1 + Math.round(S * 0.012), (x1 - x0) + Math.round(S * 0.04), Math.max(1, Math.round(S * 0.025)));   // 창턱 그림자
      g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, S - Math.round(S * 0.07), S, Math.round(S * 0.07));   // 층 띠
      const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 3.2, 1 / 3.6);
      t.anisotropy = ANISO;
      return t;
    }
    // 옥상 난간: 지붕 둘레에 얇은 벽(바깥 · 안 두 면). 창문 그림에서 벽색만 있는 줄(v = 3.24 → 0.9)을 써서 벽과 같은 색이에요
    const PH = 0.9;
    function parapetGeometry(rings, y0, h) {
      const pos = [], nor = [], uv = [], idx = [], V = 3.24;
      for (const r of rings) {
        let u = 0;
        for (let i = 0; i < r.length; i++) {
          const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
          if (L < 0.05) continue;
          const nx = dz / L, nz = -dx / L;
          for (const s of [1, -1]) {
            const o = pos.length / 3;
            pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y0 + h, b[1], a[0], y0 + h, a[1]);
            for (let k = 0; k < 4; k++) nor.push(nx * s, 0, nz * s);
            uv.push(u, V, u + L, V, u + L, V, u, V);
            if (s > 0) idx.push(o, o + 2, o + 1, o, o + 3, o + 2); else idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
          }
          u += L;
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      return g;
    }
    let texDay = null, texLit = null;
    const buildings = [];
    const roofBoxes = [];
    const edgePos = [];
    // 고른 땅 가까이 있는 건물은 벽 아래를 새 땅보다 깊이 내려요 (땅을 낮춘 쪽에서 건물이 뜨지 않게). 멀면 Infinity
    function groundLow(outer) {
      const bb = bbox(outer);
      if (!FLATS.some((f) => bb[2] >= f.bb[0] && bb[0] <= f.bb[2] && bb[3] >= f.bb[1] && bb[1] <= f.bb[3])) return Infinity;
      let lo = Infinity;
      for (let i = 0; i < outer.length; i++) { const a = outer[i], b = outer[(i + 1) % outer.length]; lo = Math.min(lo, hAt(a[0], a[1]), hAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); }
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const x = bb[0] + (bb[2] - bb[0]) * i / 4, z = bb[1] + (bb[3] - bb[1]) * j / 4; if (inside([x, z], outer)) lo = Math.min(lo, hAt(x, z)); }
      return lo;
    }

    // ---- 전통 건물 (정각원 · 동국대종각): 돌 기단 + 붉은 기둥 + 단청 띠 + 팔작지붕
    //   OSM 윤곽은 위에서 본 지붕(처마 끝)이라 기둥은 처마 안쪽(over m)에 세워요.
    //   처마 끝은 모서리로 갈수록 들리고(lift) 바깥으로 휘어요(flare). 지붕 면은 처마 쪽이 완만하고 위로 갈수록 가팔라요(오목)
    //   땅은 위 FLATS 에서 건물 터만큼 평평하게 골라 두었어요
    const TRAD_DIM = {
      hall: { over: [0.25, 1.6, 3], plat: 0.9, platOut: 1.4, col: 4.6, band: 1.1, colR: 0.32, bay: 4.4, eave: 5.3, lift: 1.0, flare: 0.7, ridge: 11.2, a: 0.52, thk: 0.38, gableOver: 0.45, ridgeW: 0.6, walls: true },
      pavilion: { over: [0.34, 0.9, 1.6], plat: 0.6, platOut: 0.6, col: 2.9, band: 0.55, colR: 0.2, bay: 2.6, eave: 3.0, lift: 0.5, flare: 0.35, ridge: 5.8, a: 0.52, thk: 0.24, gableOver: 0.25, ridgeW: 0.36, walls: false },
    };
    const tradMats = [];   // 낮 · 밤 색을 바꿀 재질
    function tradMat(day, night, extra) { const m = new T.MeshLambertMaterial(Object.assign({ color: day }, extra || {})); tradMats.push({ mat: m, day, night }); return m; }
    function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = ANISO; return t; }
    let TRAD_TEX = null;
    function tradTextures() {
      if (TRAD_TEX) return TRAD_TEX;
      // 기와: 처마 방향으로 0.32m 마다 골이 진 줄
      const tile = canvasTex(32, 8, (g, w, h) => {
        for (let x = 0; x < w; x++) { const v = Math.round(86 + 26 * (0.5 + 0.5 * Math.cos((x / w) * Math.PI * 2))); g.fillStyle = `rgb(${v},${v + 5},${v + 10})`; g.fillRect(x, 0, 1, h); }
      });
      // 문살 한 칸 (가로 = 기둥 사이 한 칸, 세로 = 기둥 높이): 문틀 · 창호지 · 띠살 · 두 짝 문
      const lattice = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = '#7b3a2a'; g.fillRect(0, 0, w, h);
        const x0 = 10, x1 = w - 10, y0 = 14, y1 = h - 22;
        g.fillStyle = '#efe5c9'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.strokeStyle = '#8a5a3a'; g.lineWidth = 1;
        for (let x = x0 + 4; x < x1; x += 6) { g.beginPath(); g.moveTo(x + 0.5, y0); g.lineTo(x + 0.5, y1); g.stroke(); }
        for (const f of [0.22, 0.5, 0.78]) for (const dy of [-3, 0, 3]) { const y = Math.round(y0 + (y1 - y0) * f) + dy + 0.5; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
        g.fillStyle = '#5e2a1e'; g.fillRect(w / 2 - 1, y0, 2, y1 - y0);
      });
      // 단청 띠 (2.2m 한 마디): 녹색 바탕 · 붉은 띠 · 꽃 무늬 · 파란 마름모
      const dancheong = canvasTex(256, 64, (g, w, h) => {
        g.fillStyle = '#3d7d69'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#a5392b'; g.fillRect(0, h - 10, w, 10);
        g.fillStyle = '#284f45'; g.fillRect(0, 0, w, 6);
        for (const cx of [w * 0.25, w * 0.75]) {
          g.fillStyle = '#f1ead6'; g.beginPath(); g.arc(cx, h * 0.45, 13, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#d9822b'; g.beginPath(); g.arc(cx, h * 0.45, 7, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#3a5f9a';
        for (const cx of [0, w * 0.5, w]) { g.beginPath(); g.moveTo(cx, h * 0.2); g.lineTo(cx + 9, h * 0.45); g.lineTo(cx, h * 0.7); g.lineTo(cx - 9, h * 0.45); g.closePath(); g.fill(); }
      });
      TRAD_TEX = { tile, lattice, dancheong };
      return TRAD_TEX;
    }
    // 상자 면 무늬를 칸 수만큼 되풀이: 면 순서 +x, -x, +y, -y, +z, -z (±x 면은 z 방향 nz 칸, ±z 면은 x 방향 nx 칸)
    function scaleBoxUV(g, nz, nx) { const uv = g.attributes.uv; for (let f = 0; f < 6; f++) { const k = f < 2 ? nz : f >= 4 ? nx : 1; for (let v = 0; v < 4; v++) uv.setX(f * 4 + v, uv.getX(f * 4 + v) * k); } uv.needsUpdate = true; }
    const hProf = (x) => 0.35 * x + 0.65 * x * x;   // 지붕 단면: 처마(0) → 용마루(1)
    const unitBox = new T.BoxGeometry(1, 1, 1);
    function addTraditional(bd, outer, q) {
      const d = TRAD_DIM[bd.trad] || TRAD_DIM.hall, tex = tradTextures();
      const { cx, cz, th, L, W } = q.box, lv = q.flat.level;
      const over = Math.max(d.over[1], Math.min(d.over[2], d.over[0] * W));
      const Lc = L - over, Wc = W - over, plat = lv + d.plat;
      const ye0 = plat + d.eave, yr = plat + d.ridge, a = Math.min(W * d.a, L - 0.4), Li = L - a, Wi = W - a;
      const Ya = hProf(a / W), ym = ye0 + (yr - ye0) * Ya;
      const yTop = (dist) => ye0 + (yr - ye0) * hProf(Math.max(0, Math.min(W, dist)) / W);   // 처마 끝에서 dist m 안쪽의 지붕 높이 (긴 쪽 가운데)
      const grp = new T.Group(); grp.position.set(cx, 0, cz); grp.rotation.y = -th;
      const ct = Math.cos(th), st = Math.sin(th), toW = (x, y, z) => [cx + x * ct - z * st, y, cz + x * st + z * ct];
      const m4 = new T.Matrix4(), q4 = new T.Quaternion(), v3 = new T.Vector3(), s3 = new T.Vector3(), zAxis = new T.Vector3(0, 0, 1);

      // -- 지붕: 처마 고리(네 면) + 위 맞배(두 면) + 합각(양 끝 세모 벽) + 마루
      const C = [[-L, -W], [L, -W], [L, W], [-L, W]], I = [[-Li, -Wi], [Li, -Wi], [Li, Wi], [-Li, Wi]], NRM = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const NS = HI ? 16 : 10, NT = HI ? 7 : 5, NG = HI ? 7 : 5, e = d.gableOver;
      const topP = [], topUV = [], topI = [], undP = [], undI = [], rimP = [], rimI = [], gabP = [], gabI = [];
      const hip = [[], [], [], []], eaveLine = [];
      const outerAt = (k, s) => {
        const A = C[k], B = C[(k + 1) % 4], n = NRM[k], len = Math.hypot(B[0] - A[0], B[1] - A[1]), tx = (B[0] - A[0]) / len, tz = (B[1] - A[1]) / len, w = 2 * s - 1;
        return [A[0] + (B[0] - A[0]) * s + d.flare * w * (n[0] * w + tx), ye0 + d.lift * w * w, A[1] + (B[1] - A[1]) * s + d.flare * w * (n[1] * w + tz)];
      };
      for (let k = 0; k < 4; k++) {
        const A = I[k], B = I[(k + 1) % 4], len = Math.hypot(C[(k + 1) % 4][0] - C[k][0], C[(k + 1) % 4][1] - C[k][1]);
        const o = topP.length / 3, ou = undP.length / 3;
        for (let i = 0; i <= NS; i++) {
          const s = i / NS, O = outerAt(k, s), ix = A[0] + (B[0] - A[0]) * s, iz = A[1] + (B[1] - A[1]) * s;
          for (let j = 0; j <= NT; j++) {
            const t = j / NT, x = O[0] + (ix - O[0]) * t, z = O[2] + (iz - O[2]) * t, y = O[1] + (ym - O[1]) * hProf(t * a / W) / Ya;
            topP.push(x, y, z); topUV.push(s * len / 0.32, t); undP.push(x, y - d.thk, z);
            if (i === NS) hip[(k + 1) % 4].push([x, y, z]);
          }
          eaveLine.push(O);
          const r = rimP.length / 3; rimP.push(O[0], O[1], O[2], O[0], O[1] - d.thk, O[2]);
          if (i > 0) rimI.push(r - 2, r, r + 1, r - 2, r + 1, r - 1);
        }
        for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
          const p0 = o + i * (NT + 1) + j, p1 = p0 + NT + 1, p2 = p1 + 1, p3 = p0 + 1;
          topI.push(p0, p2, p1, p0, p3, p2);
          const u0 = ou + i * (NT + 1) + j, u1 = u0 + NT + 1, u2 = u1 + 1, u3 = u0 + 1;
          undI.push(u0, u1, u2, u0, u2, u3);
        }
      }
      for (const sg of [-1, 1]) {   // 위 맞배 두 면 (앞 -z · 뒤 +z): 처마 고리 안쪽 끝(ym)에서 용마루(yr)까지, 양 끝은 합각 벽보다 e m 더 나와요
        const o = topP.length / 3;
        for (let i = 0; i <= 1; i++) {
          const x = (i ? 1 : -1) * (Li + e);
          for (let j = 0; j <= NG; j++) { const w = j / NG; topP.push(x, yTop(a + w * Wi), sg * Wi * (1 - w)); topUV.push((x + Li + e) / 0.32, w); }
        }
        for (let j = 0; j < NG; j++) { const p0 = o + j, p1 = o + NG + 1 + j, p2 = p1 + 1, p3 = p0 + 1; if (sg < 0) topI.push(p0, p2, p1, p0, p3, p2); else topI.push(p0, p1, p2, p0, p2, p3); }
      }
      for (const sx of [-1, 1]) {   // 합각 (양 끝 세모 벽)
        const o = gabP.length / 3, x = sx * Li;
        for (let j = 0; j <= NG; j++) { const w = j / NG, y = yTop(a + w * Wi); gabP.push(x, y, -Wi * (1 - w), x, y, Wi * (1 - w)); }
        for (let j = 0; j < NG; j++) { const l0 = o + 2 * j, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3; if (sx > 0) gabI.push(l0, r1, r0, l0, l1, r1); else gabI.push(l0, r0, r1, l0, r1, l1); }
      }
      const mk = (pos, idx, uv) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
      const roofMat = new T.MeshLambertMaterial({ color: 0xffffff, map: tex.tile, side: T.DoubleSide });
      const roof = new T.Mesh(mk(topP, topI, topUV), roofMat); roof.castShadow = true; roof.receiveShadow = true;
      const under = new T.Mesh(mk(undP, undI), tradMat(0x5b7a66, 0x2b3a33, { side: T.DoubleSide }));   // 처마 밑 (서까래 단청 빛)
      const rim = new T.Mesh(mk(rimP, rimI), tradMat(0x43484d, 0x202427, { side: T.DoubleSide }));      // 처마 끝 막새 띠
      const gable = new T.Mesh(mk(gabP, gabI), tradMat(0x8b4633, 0x46261d, { side: T.DoubleSide })); gable.castShadow = true;
      // 마루: 용마루 · 추녀마루(모서리) · 내림마루(맞배 끝), 용마루 양 끝 장식
      const seg = [];
      const chain = (pts, w) => { for (let i = 0; i + 1 < pts.length; i++) seg.push([pts[i], pts[i + 1], w]); };
      chain([[-(Li + e), yr + d.ridgeW * 0.35, 0], [Li + e, yr + d.ridgeW * 0.35, 0]], d.ridgeW);
      for (let k = 0; k < 4; k++) chain(hip[k].map(([x, y, z]) => [x, y + d.ridgeW * 0.22, z]), d.ridgeW * 0.6);
      for (const sx of [-1, 1]) for (const sg of [-1, 1]) { const pts = []; for (let j = 0; j <= NG; j++) { const w = j / NG; pts.push([sx * (Li + e), yTop(a + w * Wi) + d.ridgeW * 0.2, sg * Wi * (1 - w)]); } chain(pts, d.ridgeW * 0.5); }
      const ridges = new T.InstancedMesh(unitBox, tradMat(0x3c4146, 0x1d2125), seg.length + 2);
      seg.forEach(([p, r, w], i) => {
        v3.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]); const len = v3.length(); v3.normalize();
        q4.setFromUnitVectors(zAxis, v3); m4.compose(s3.set((p[0] + r[0]) / 2, (p[1] + r[1]) / 2, (p[2] + r[2]) / 2), q4, new T.Vector3(w, w * 0.8, len + w * 0.3)); ridges.setMatrixAt(i, m4);
      });
      [-1, 1].forEach((sx, i) => { q4.identity(); m4.compose(s3.set(sx * (Li + e), yr + d.ridgeW * 0.9, 0), q4, new T.Vector3(d.ridgeW * 0.9, d.ridgeW * 1.8, d.ridgeW * 1.1)); ridges.setMatrixAt(seg.length + i, m4); });
      ridges.castShadow = true;
      grp.add(roof, under, rim, gable, ridges);

      // -- 기단 (돌, 땅속 1.5m 까지)
      const pb = new T.Mesh(new T.BoxGeometry(2 * (Lc + d.platOut), d.plat + 1.5, 2 * (Wc + d.platOut)), tradMat(0xc4bdb0, 0x4c4842));
      pb.position.set(0, lv - 1.5 + (d.plat + 1.5) / 2, 0); pb.castShadow = true; pb.receiveShadow = true; grp.add(pb);
      // -- 기둥 (둘레, 칸 너비 약 bay m)
      const colMat = tradMat(0x8f3b2b, 0x4a2a22);
      const nu = Math.max(1, Math.round(2 * Lc / d.bay)), nv = Math.max(1, Math.round(2 * Wc / d.bay)), colPts = [];
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) if (i === 0 || i === nu || j === 0 || j === nv) colPts.push([-Lc + 2 * Lc * i / nu, -Wc + 2 * Wc * j / nv]);
      const colGeo = new T.CylinderGeometry(d.colR * 0.88, d.colR, d.col, 10); colGeo.translate(0, d.col / 2, 0);
      const cols = new T.InstancedMesh(colGeo, colMat, colPts.length);
      colPts.forEach(([x, z], i) => { q4.identity(); m4.compose(s3.set(x, plat, z), q4, v3.set(1, 1, 1)); cols.setMatrixAt(i, m4); });
      cols.castShadow = true; cols.receiveShadow = true; grp.add(cols);
      // -- 단청 띠 (기둥 위 공포 자리): 처마 밑면 안쪽에 닿게 높이를 맞춰요 (틈이 안 보이게)
      const yb = yTop(over - 0.25), bandBot = plat + d.col, bandTop = Math.min(yb - 0.06, Math.max(yb - d.thk + 0.05, plat + d.col + d.band));
      const bandMat = tradMat(0xffffff, 0x8f9aa2, { map: tex.dancheong });
      const bandGeo = new T.BoxGeometry(2 * (Lc + 0.25), bandTop - bandBot, 2 * (Wc + 0.25)); scaleBoxUV(bandGeo, (2 * (Wc + 0.25)) / 2.2, (2 * (Lc + 0.25)) / 2.2);
      const band = new T.Mesh(bandGeo, bandMat); band.position.set(0, (bandTop + bandBot) / 2, 0); band.castShadow = true; band.receiveShadow = true; grp.add(band);
      let wallMat = bandMat, body = band;
      if (d.walls) {   // 법당: 기둥 사이를 문살 벽으로
        wallMat = new T.MeshLambertMaterial({ color: 0xffffff, map: tex.lattice });
        const wg = new T.BoxGeometry(2 * (Lc - 0.08), d.col, 2 * (Wc - 0.08)); scaleBoxUV(wg, nv, nu);
        const wm = new T.Mesh(wg, wallMat); wm.position.set(0, plat + d.col / 2, 0); wm.castShadow = true; wm.receiveShadow = true; grp.add(wm); body = wm;
      } else {         // 종각: 벽 없이, 가운데 들보에 청동 종
        const beam = new T.Mesh(new T.BoxGeometry(2 * Lc, 0.22, 0.22), colMat); beam.position.set(0, bandBot - 0.12, 0); grp.add(beam);
        const bh = Math.min(1.6, d.col * 0.5), br = bh * 0.38;
        const prof = [[0, 0], [br * 0.98, 0], [br, bh * 0.06], [br * 0.9, bh * 0.25], [br * 0.78, bh * 0.6], [br * 0.72, bh * 0.88], [br * 0.45, bh], [0, bh]].map(([x, y]) => new T.Vector2(x, y));
        const bell = new T.Mesh(new T.LatheGeometry(prof, 16), tradMat(0x7d6844, 0x3f3423)); bell.position.set(0, bandBot - 0.24 - bh, 0); bell.castShadow = true; grp.add(bell);
      }
      scene.add(grp);
      for (let i = 0; i + 1 < eaveLine.length; i++) edgePos.push(...toW(...eaveLine[i]), ...toW(...eaveLine[i + 1]));
      const c = centroid(outer), A = Math.abs(area(outer));
      buildings.push({ id: bd.id, name: bd.name || '', bg: false, outer, c, A, top: yr + d.ridgeW, mesh: roof, wall: wallMat, roof: roofMat, alt: false, lit: false, trad: bd.trad, occ: [roof, body, pb], group: grp });
    }
    for (const bd of campus.buildings || []) {
      const outer = ringPts(bd.outer); if (outer.length < 3) continue;
      const tq = bd.trad ? tradSites.find((q) => q.b === bd) : null;
      if (tq) { addTraditional(bd, outer, tq); continue; }
      const holes = (bd.holes || []).map(ringPts).filter((h) => h.length >= 3);
      const g0 = bd.g0 ?? hAt(...centroid(outer)), g1 = bd.g1 ?? g0;
      const base = Math.min(g0, groundLow(outer)) - 1.5, top = (g0 + g1) / 2 + bd.h;
      const shape = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, -z)));
      for (const h of holes) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, -z))));
      const geo = new T.ExtrudeGeometry(shape, { depth: top - base, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2); geo.translate(0, base, 0);
      const alt = hash(bd.id) % 3 === 0;
      // 면을 아주 조금 뒤로 밀어 테두리 선이 깜빡이지 않게 해요
      const wall = new T.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const roof = new T.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const mesh = new T.Mesh(geo, [roof, wall]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { kind: 'building', id: bd.id };
      scene.add(mesh);
      const rings = [outer].concat(holes);
      const par = new T.Mesh(parapetGeometry(rings, top, PH), wall);
      par.castShadow = true; par.receiveShadow = true; par.userData = mesh.userData;
      scene.add(par);
      const eg = new T.EdgesGeometry(geo, 35), ea = eg.attributes.position.array;
      for (let i = 0; i < ea.length; i++) edgePos.push(ea[i]);
      eg.dispose();
      for (const r of rings) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; edgePos.push(a[0], top + PH, a[1], b[0], top + PH, b[1]); }
      const c = centroid(outer), A = Math.abs(area(outer));
      buildings.push({ id: bd.id, name: bd.name || '', bg: !!bd.bg, outer, c, A, top, mesh, wall, roof, alt, lit: hash(bd.id + 'L') % 3 !== 0 });
      if (!bd.bg) {
        const r = rng(hash(bd.id)), n = Math.min(7, Math.floor(A / 320));
        const bb = bbox(outer);
        for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
          const px = bb[0] + r() * (bb[2] - bb[0]), pz = bb[1] + r() * (bb[3] - bb[1]);
          if (!inside([px, pz], outer) || distToRing([px, pz], outer) < 3.5 || holes.some((h) => inside([px, pz], h))) continue;
          roofBoxes.push([px, top, pz, 2.2 + r() * 2.6, 1.1 + r() * 1.3, 2.2 + r() * 2.6]); k++;
        }
      }
    }
    const edgeGeo = new T.BufferGeometry(); edgeGeo.setAttribute('position', new T.Float32BufferAttribute(edgePos, 3));
    const edgeMat = new T.LineBasicMaterial({ color: 0x56626c, transparent: true, opacity: 0.3, depthWrite: false });
    const edgeLines = new T.LineSegments(edgeGeo, edgeMat); edgeLines.renderOrder = 8; scene.add(edgeLines);
    const boxGeo = new T.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
    const boxMat = new T.MeshLambertMaterial({ color: 0xe9ece9 });
    const boxes = new T.InstancedMesh(boxGeo, boxMat, Math.max(1, roofBoxes.length));
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), P = new T.Vector3();
    roofBoxes.forEach((b, i) => { M.compose(P.set(b[0], b[1], b[2]), Q, S.set(b[3], b[4], b[5])); boxes.setMatrixAt(i, M); });
    boxes.count = roofBoxes.length; boxes.castShadow = true; scene.add(boxes);

    // ---- 나무: 빠른 컴퓨터는 둥근 덩어리 세 개를 붙인 나뭇잎(위가 조금 밝게), 휴대폰은 덩어리 하나
    function crownGeometry(hi) {
      const parts = hi ? [[0, 0, 0, 1, 0.92], [0.5, 0.2, 0.18, 0.68, 1.02], [-0.38, 0.4, -0.2, 0.64, 1.1]] : [[0, 0, 0, 1, 1]];
      const pos = [], nor = [], col = [], idx = [];
      for (const [cx, cy, cz, r, shade] of parts) {
        const g = new T.SphereGeometry(1, 7, 5), p = g.attributes.position, nn = g.attributes.normal, o = pos.length / 3;
        for (let i = 0; i < p.count; i++) {
          const nx = nn.getX(i), ny = nn.getY(i), nz = nn.getZ(i);
          const j = hi ? 1 + 0.07 * Math.sin(nx * 7.1 + ny * 5.3 + nz * 6.7 + cx * 3) : 1;   // 울퉁불퉁 (같은 방향이면 같은 값이라 이음매가 없어요)
          pos.push(cx + nx * r * j, cy + ny * r * j, cz + nz * r * j); nor.push(nx, ny, nz);
          const sh = shade * (0.9 + 0.12 * (ny * 0.5 + 0.5)); col.push(sh, sh, sh);
        }
        const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + o);
        g.dispose();
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
      return geo;
    }
    const treePts = ringPts(campus.trees || []);
    const crownGeo = crownGeometry(HI);
    const trunkGeo = new T.CylinderGeometry(0.2, 0.28, 1, 6); trunkGeo.translate(0, 0.5, 0);
    const crowns = new T.InstancedMesh(crownGeo, new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), Math.max(1, treePts.length));
    const trunks = new T.InstancedMesh(trunkGeo, new T.MeshLambertMaterial({ color: 0x6b5a45 }), Math.max(1, treePts.length));
    const treeAlt = [];
    { const r = rng(7); treePts.forEach(([x, z], i) => {
      const y = hAt(x, z), s = 2.3 + r() * 1.7, h = 2.2 + r() * 1.6; treeAlt.push(r() < 0.45);
      M.compose(P.set(x, y + h + s * 0.75, z), Q.setFromAxisAngle(S.set(0, 1, 0), r() * 6.28), S.set(s, s * 1.1, s)); crowns.setMatrixAt(i, M);
      Q.identity(); M.compose(P.set(x, y - 0.3, z), Q, S.set(1, h + 0.8, 1)); trunks.setMatrixAt(i, M);
    }); }
    crowns.count = trunks.count = treePts.length; crowns.castShadow = true; trunks.castShadow = true;
    crowns.receiveShadow = true;
    scene.add(crowns, trunks);

    // ---- 축구 골대 (흰 기둥 + 흐린 그물), 운동장 고른 높이에 세워요. 기둥은 실제(12cm)보다 조금 굵게
    const goalMat = tradMat(0xffffff, 0x9aa5ad), netMat = tradMat(0xffffff, 0x8d989f, { transparent: true, opacity: 0.32, side: T.DoubleSide, depthWrite: false });
    let goalCount = 0;
    for (const sf of soccerFields) {
      const { PL, k } = soccerDims(sf.box), y0 = sf.flat.level, Wg = 3.66 * k, Hg = 2.44 * k, Dg = 1.9 * k, PT = 0.22;
      for (const sgn of [-1, 1]) {
        const g = new T.Group();   // 이 안에서 +x = 운동장 바깥쪽(골대 뒤), z = 골라인 방향
        const bar = (w, h, dd, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, dd), goalMat); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
        bar(PT, Hg, PT, 0, Hg / 2, -Wg); bar(PT, Hg, PT, 0, Hg / 2, Wg); bar(PT, PT, 2 * Wg + PT, 0, Hg, 0);
        bar(PT * 0.7, PT * 0.7, 2 * Wg, Dg, 0.08, 0);
        const net = (w, h, x, y, z, rx, ry) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), netMat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); g.add(m); };
        net(2 * Wg, Hg, Dg, Hg / 2, 0, 0, Math.PI / 2);
        net(Dg, 2 * Wg, Dg / 2, Hg, 0, -Math.PI / 2, 0);
        net(Dg, Hg, Dg / 2, Hg / 2, -Wg, 0, 0); net(Dg, Hg, Dg / 2, Hg / 2, Wg, 0, 0);
        g.position.set(sf.box.cx + Math.cos(sf.box.th) * sgn * PL, y0, sf.box.cz + Math.sin(sf.box.th) * sgn * PL);
        g.rotation.y = -sf.box.th + (sgn > 0 ? 0 : Math.PI);
        scene.add(g); goalCount++;
      }
    }

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
      shadowAt = -1e9;
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

    // ---- 학생 캐릭터 (꾸밈용 가상 인물): 몸 부분마다 InstancedMesh 하나 (다리 · 몸 · 팔 · 머리 · 눈 · 머리카락 · 가방 · 발밑 그림자)
    const walk = buildWalkGraph(campus);
    const STU_N = Math.max(0, Math.floor(opts.studentCount ?? (SMALL ? 24 : 56)));
    const crowd = walk.nodes.length >= 2 && STU_N ? makeCrowd(walk, { count: STU_N, seed: opts.studentSeed || 20261107,
      hotspots: () => [...sensors.values()].filter((s) => s.placed).map((s) => ({ x: s.site.x, z: s.site.z })) }) : null;
    const stuGroup = new T.Group(); scene.add(stuGroup);
    const parts = [];
    let blob = null;
    const ZERO = new T.Matrix4().makeScale(0, 0, 0);
    if (crowd) {
      const stuMat = new T.MeshLambertMaterial({ color: 0xffffff });
      const box = (w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
      const torsoGeo = new T.CylinderGeometry(0.2, 0.24, 0.58, 10); torsoGeo.translate(0, 1.0, 0);
      const headGeo2 = new T.SphereGeometry(0.27, 12, 9); headGeo2.translate(0, 0.26, 0);
      const hairGeo = new T.SphereGeometry(0.292, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.56); hairGeo.rotateX(-0.3); hairGeo.translate(0, 0.275, -0.015);
      const eyeGeo = (() => {   // 눈 두 개 (가까이 볼 때만 보여요)
        const a = new T.SphereGeometry(0.034, 6, 4), b = a.clone(); a.translate(0.088, 0.29, 0.245); b.translate(-0.088, 0.29, 0.245);
        const pos = [...a.attributes.position.array, ...b.attributes.position.array], nor = [...a.attributes.normal.array, ...b.attributes.normal.array];
        const off = a.attributes.position.count, idx = [...a.index.array, ...[...b.index.array].map((i) => i + off)];
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
        a.dispose(); b.dispose(); return g;
      })();
      const DEF = [
        ['legL', box(0.15, 0.72, 0.17, 0, -0.36, 0), 'pants', [0.1, 0.74, 0]],
        ['legR', box(0.15, 0.72, 0.17, 0, -0.36, 0), 'pants', [-0.1, 0.74, 0]],
        ['torso', torsoGeo, 'shirt', null],
        ['armL', box(0.11, 0.52, 0.12, 0, -0.25, 0), 'shirt', [0.285, 1.24, 0]],
        ['armR', box(0.11, 0.52, 0.12, 0, -0.25, 0), 'shirt', [-0.285, 1.24, 0]],
        ['head', headGeo2, 'skin', [0, 1.3, 0]],
        ['eyes', eyeGeo, 'eye', [0, 1.3, 0]],
        ['hair', hairGeo, 'hair', [0, 1.3, 0]],
        ['hairBack', box(0.46, 0.36, 0.12, 0, 0.13, -0.2), 'hair', [0, 1.3, 0]],
        ['bag', box(0.3, 0.36, 0.15, 0, 1.03, -0.215), 'bag', null],
      ];
      for (const [name, geo, role, pivot] of DEF) {
        const m = new T.InstancedMesh(geo, stuMat, STU_N); m.receiveShadow = true; m.userData.kind = 'student';
        stuGroup.add(m);
        parts.push({ name, mesh: m, role, pivot: pivot ? new T.Vector3(pivot[0], pivot[1], pivot[2]) : null });
      }
      const bc = document.createElement('canvas'); bc.width = bc.height = 64;
      const bctx = bc.getContext('2d'), grd = bctx.createRadialGradient(32, 32, 2, 32, 32, 31);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); bctx.fillStyle = grd; bctx.fillRect(0, 0, 64, 64);
      const blobGeo = new T.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
      blob = new T.InstancedMesh(blobGeo, new T.MeshBasicMaterial({ map: new T.CanvasTexture(bc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -16 }), STU_N);
      blob.renderOrder = 12; stuGroup.add(blob);
    }
    let studentsOn = !!crowd && opts.students !== false;
    stuGroup.visible = studentsOn;
    let colored = false;
    function colorStudents(list) {
      const c = new T.Color();
      for (const part of parts) {
        list.forEach((n, i) => {
          const L = n.look, v = part.role === 'eye' ? 0x2a2522 : part.role === 'bag' ? (L.bag || 0x333333) : L[part.role];
          part.mesh.setColorAt(i, c.setHex(v));
        });
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
    // 멀리서 볼수록 학생을 크게 그려요 (가까이 보면 1.15배, 245m 넘게 멀리서 보면 3배까지) → 캠퍼스 전체를 볼 때도 걷는 모습이 보여요
    const visScale = () => Math.max(1.15, Math.min(3, 0.55 + camera.position.distanceTo(controls.target) / 100));
    // 흡연 의심(SMOKE)인 센서 둘레만 냄새 구역이에요. 판단 보류(수증기일 수 있음) · 공기 변화에는 반응하지 않아요
    const smokeZones = () => { const z = []; for (const s of sensors.values()) if (s.state === 'SMOKE' && s.placed) z.push({ id: s.site.id, x: s.site.x, z: s.site.z, r: s.R + 10 }); return z; };
    function poseOf(n, t) {
      const p = { legL: 0, legR: 0, armLx: 0, armLz: 0.06, armRx: 0, armRz: -0.06, head: 0, bob: 0, lean: 0 };
      if (n.mode === 'walk') {
        const A = n.fast ? 0.62 : 0.45, s = Math.sin(n.phase);
        p.legL = A * s; p.legR = -A * s; p.armLx = -0.8 * A * s; p.armRx = 0.8 * A * s; p.bob = Math.abs(Math.cos(n.phase)) * 0.035;
        if (n.fast && n.say && n.say.kind === 'smell') { p.armRx = -2.45; p.armRz = -0.5; }   // 달아나면서도 코를 막아요
      } else if (n.mode === 'react') {   // 코 막기: 오른손을 얼굴 앞으로, 몸을 조금 뒤로
        p.armRx = -2.45; p.armRz = -0.5; p.armLx = -0.35; p.armLz = 0.25; p.head = -0.12; p.lean = -0.1; p.bob = Math.abs(Math.sin(t * 9)) * 0.02;
      } else if (n.mode === 'chat') {
        p.armLx = -0.35 + 0.25 * Math.sin(t * 3 + n.id); p.head = 0.08 * Math.sin(t * 2.3 + n.id);
      } else if (n.pose === 'phone') {   // 휴대폰 보기
        p.armRx = -1.25; p.armRz = -0.3; p.armLx = -0.9; p.armLz = 0.32; p.head = 0.32;
      } else p.head = 0.05 * Math.sin(t * 0.7 + n.id);
      return p;
    }
    const Mroot = new T.Matrix4(), Mloc = new T.Matrix4(), Mout = new T.Matrix4(), E1 = new T.Euler(), E2 = new T.Euler();
    const FOOT = 0.14, UP = new T.Vector3(0, 1, 0);
    const Q1 = new T.Quaternion(), Q2 = new T.Quaternion(), V1 = new T.Vector3(), V2 = new T.Vector3(), ONE = new T.Vector3(1, 1, 1);
    function drawStudents(vis, t) {
      const list = crowd.npcs;
      if (!colored && list.length) { colorStudents(list); colored = true; }
      for (let i = 0; i < list.length; i++) {
        const n = list[i], p = poseOf(n, t), y = hMesh(n.rx, n.rz);
        Q1.setFromEuler(E1.set(p.lean, n.h, 0, 'YXZ'));
        Mroot.compose(V1.set(n.rx, y + FOOT + p.bob * vis, n.rz), Q1, V2.set(vis, vis, vis));
        for (const part of parts) {
          let ax = 0, az = 0, hide = false;
          switch (part.name) {
            case 'legL': ax = p.legL; break;
            case 'legR': ax = p.legR; break;
            case 'armL': ax = p.armLx; az = p.armLz; break;
            case 'armR': ax = p.armRx; az = p.armRz; break;
            case 'head': case 'hair': case 'eyes': ax = p.head; break;
            case 'hairBack': ax = p.head; hide = !n.look.long; break;
            case 'bag': hide = !n.look.bag; break;
            default: break;
          }
          if (hide) { part.mesh.setMatrixAt(i, ZERO); continue; }
          if (part.pivot) { Q2.setFromEuler(E2.set(ax, 0, az, 'ZYX')); Mloc.compose(part.pivot, Q2, ONE); Mout.multiplyMatrices(Mroot, Mloc); part.mesh.setMatrixAt(i, Mout); }
          else part.mesh.setMatrixAt(i, Mroot);
        }
        const gx = hAt(n.rx - 1, n.rz) - hAt(n.rx + 1, n.rz), gz = hAt(n.rx, n.rz - 1) - hAt(n.rx, n.rz + 1);
        Q2.setFromUnitVectors(UP, V2.set(gx, 2, gz).normalize());
        Mout.compose(V1.set(n.rx, y + 0.18, n.rz), Q2, V2.set(0.95 * vis, 1, 0.95 * vis)); blob.setMatrixAt(i, Mout);
      }
      for (const part of parts) part.mesh.instanceMatrix.needsUpdate = true;
      blob.instanceMatrix.needsUpdate = true;
    }
    // 말풍선 (이름표 층 위). 냄새 반응은 늘, 잡담은 가까이 볼 때만 보여요
    const bubbles = new Map();
    const bv = new T.Vector3();
    // 건물 뒤에 가린 학생인지 (0.25초마다 한 번씩 봐요): 잡담 말풍선은 숨기고, 냄새 반응은 흐리게 보여요
    const occRay = new T.Raycaster(), occDir = new T.Vector3(), headP = new T.Vector3();
    const bldObjs = buildings.flatMap((b) => b.occ || [b.mesh]);
    function behindBuilding(x, y, z) {
      headP.set(x, y, z); occDir.subVectors(headP, camera.position);
      const L = occDir.length(); if (L < 1) return false;
      occRay.set(camera.position, occDir.divideScalar(L)); occRay.far = L - 0.8;
      return occRay.intersectObjects(bldObjs, false).length > 0;
    }
    function placeBubbles(vis) {
      const near = camera.position.distanceTo(controls.target) < 360, now = performance.now();
      for (const n of crowd.npcs) {
        let b = bubbles.get(n.id);
        const want = studentsOn && n.say && (n.say.kind === 'smell' || near);
        if (!want) { if (b && b.el.style.display !== 'none') b.el.style.display = 'none'; continue; }
        if (!b) { const el = document.createElement('div'); el.className = 'm3-say'; el.setAttribute('aria-hidden', 'true'); overlay.appendChild(el); b = { el, text: '' }; bubbles.set(n.id, b); }
        if (b.text !== n.say.text) { b.text = n.say.text; b.el.textContent = n.say.text; b.el.classList.toggle('smell', n.say.kind === 'smell'); }
        const gy = hMesh(n.rx, n.rz) + FOOT;
        bv.set(n.rx, gy + 2.0 * vis + 0.6, n.rz).project(camera);
        if (!(bv.z < 1 && bv.x > -1.1 && bv.x < 1.1 && bv.y > -1.1 && bv.y < 1.1)) { b.el.style.display = 'none'; continue; }
        if (!b.chk || now - b.chk > 250) { b.chk = now; b.behind = behindBuilding(n.rx, gy + 1.55 * vis, n.rz); }
        if (b.behind && n.say.kind !== 'smell') { b.el.style.display = 'none'; continue; }
        b.el.classList.toggle('behind', !!b.behind);
        b.el.style.display = '';
        b.el.style.transform = `translate(${((bv.x + 1) / 2 * VW).toFixed(1)}px, ${((1 - bv.y) / 2 * VH).toFixed(1)}px) translate(-50%, -100%)`;
      }
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
      // (x, z) 땅 위를 dist m 떨어져서 봐요. theta = 돌린 각, phi = 기운 각 (0 = 바로 위). 사진 찍기 · 시험용
      viewAt(x, z, dist, theta, phi) { userMoved = true; setView(theta ?? HOME.theta, Math.max(0.0001, Math.min(controls.maxPolarAngle, phi ?? HOME.phi)), Math.max(controls.minDistance, Math.min(controls.maxDistance, dist ?? 200)), x, z); },
      focus(id) {
        const s = sensors.get(id); if (!s) return;
        userMoved = true; stopCoasting();
        const off = new T.Vector3().subVectors(camera.position, controls.target);
        off.setLength(Math.min(off.length(), 320));
        controls.target.set(s.site.x, s.baseY, s.site.z); lastTX = s.site.x; lastTZ = s.site.z;
        camera.position.copy(controls.target).add(off); controls.update();
      },
      setAutoRotate(on) { controls.autoRotate = !!on; controls.autoRotateSpeed = 0.5; if (on) userMoved = true; },
      home: () => ({ ...lastHome }),
      setTheme(night) { applyPalette(night ? PALETTE.night : PALETTE.day); },
      zoneOf(id) { const s = sensors.get(id); return s && s.zone ? { id: s.zone.id, name: s.zone.name } : null; },
      buildingList: () => buildings.filter((b) => !b.bg).map((b) => ({ id: b.id, name: b.name, x: b.c[0], z: b.c[1] })),
      heightAt: hAt,
      groundAt: hMesh,
      tints: () => buildings.filter((b) => b.tint).map((b) => ({ id: b.id, name: b.name, tint: b.tint, wall: '#' + b.wall.color.getHexString(), roof: '#' + b.roof.color.getHexString() })),
      stats: () => ({ buildings: buildings.length, trees: treePts.length, roads: (campus.roads || []).length, areas: (campus.areas || []).length, tex: TEX, shadow: SM,
                      quality: QUALITY, gpuSoft: SOFT, pixelRatio: prNow, pixelRatioMax: PR_MAX, groundStep: GS, roadVerts: roadLayer.verts, edgeSegs: edgePos.length / 6, windowTex: WT,
                      students: crowd ? crowd.count : 0, traditional: buildings.filter((b) => b.trad).map((b) => b.name + ':' + b.trad), goals: goalCount,
                      flats: FLATS.map((f) => ({ kind: f.kind, name: f.name, level: +f.level.toFixed(2) })) }),
      // 학생 캐릭터 켜고 끄기 · 상태
      setStudents(on) {
        studentsOn = !!on && !!crowd; stuGroup.visible = studentsOn;
        if (!studentsOn) for (const b of bubbles.values()) b.el.style.display = 'none';
      },
      studentsOn: () => studentsOn,
      students: () => ({
        on: studentsOn, count: crowd ? crowd.count : 0, nodes: walk.nodes.length, edges: walk.edges.length, length_m: Math.round(walk.length),
        zones: crowd ? crowd.zones.map((q) => q.id) : [], time: crowd ? +crowd.time.toFixed(1) : 0,
        list: crowd ? crowd.npcs.map((n) => ({ x: +n.rx.toFixed(2), z: +n.rz.toFixed(2), mode: n.mode, fast: n.fast, say: n.say ? n.say.text : null, reacts: n.reacts })) : [],
        bubbles: [...bubbles.values()].filter((b) => b.el.style.display !== 'none').map((b) => b.el.textContent),
      }),
      walkGraph: () => walk,
      // 시험용 손잡이
      _test: {
        // i 번 학생을 센서 id 에서 maxD m 안의 가장 가까운 길 마디에 세워요
        near(i, id, maxD) { const s = sensors.get(id); if (!crowd || !s) return false; const k = crowd.nearestNode(s.site.x, s.site.z, maxD ?? 20); return k >= 0 && crowd.place(i, k, 30); },
        // 화면 그리기를 기다리지 않고 sec 초만큼 움직여요
        run(sec) { if (!crowd) return; crowd.setZones(smokeZones()); for (let k = 0; k < Math.round(sec / 0.1); k++) crowd.step(0.1, visScale()); },
      },
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
        const wallC = new T.Color(b.trad ? pal.tradWall : b.bg ? pal.wallBg : pal.wall), roofC = new T.Color(b.trad ? pal.tradRoof : b.bg ? pal.roofBg : (b.alt ? pal.roofAlt : pal.roof));
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
      roadLayer.colorize(p);
      if (texDay) texDay.dispose(); if (texLit) texLit.dispose();
      texDay = windowTexture(p, false); texLit = p.litTop ? windowTexture(p, true) : null;
      for (const b of buildings) { if (b.trad) continue; b.wall.map = (texLit && b.lit && !b.bg) ? texLit : texDay; b.wall.needsUpdate = true; }
      for (const m of tradMats) m.mat.color.set(p === PALETTE.night ? m.night : m.day);
      edgeMat.color.set(p.edge); edgeMat.opacity = p.edgeOp;
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
    // 빠르기에 맞춘 화면 촘촘함: 2~3초마다 한 장 그리는 데 걸린 평균 시간을 보고 0.25씩 올리거나 내려요 (내린 뒤 30초는 다시 올리지 않아요)
    let fAcc = 0, fN = 0, fLast = 0, fAdj = 0, holdUntil = 0;
    function adapt(now) {
      const gap = fLast ? now - fLast : 0; fLast = now;
      if (gap > 0 && gap < 250) { fAcc += gap; fN++; }
      if (fN < 60 || now - fAdj < 3000) return;
      const avg = fAcc / fN; fAcc = 0; fN = 0; fAdj = now;
      let next = prNow;
      if (avg > 28 && prNow > 1) { next = Math.max(1, prNow - 0.25); holdUntil = now + 30000; }
      else if (avg < 18.5 && prNow < PR_MAX && now > holdUntil) next = Math.min(PR_MAX, prNow + 0.25);
      if (next !== prNow) { prNow = next; renderer.setPixelRatio(prNow); renderer.setSize(VW, VH, false); }
    }
    let raf = 0, lastNow = 0; const t0 = performance.now();
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { lastNow = 0; fLast = 0; return; }
      const t = (now - t0) / 1000, dt = lastNow ? Math.min(0.25, Math.max(0, (now - lastNow) / 1000)) : 0;
      lastNow = now;
      adapt(now);
      controls.update();
      for (const s of sensors.values()) {
        if (ALERT[s.state]) {
          const k = (t * (s.state === 'SMOKE' ? 0.85 : 0.55)) % 1, sc = 0.55 + k * 0.95;
          s.ring.scale.set(sc, 1, sc); s.ring.material.opacity = 0.85 * (1 - k);
          s.head.position.y = s.baseY + 15 + 2.2 + Math.sin(t * 4) * 0.7;
        } else if (s.ring.material.opacity) { s.ring.material.opacity = 0; s.ring.scale.set(1, 1, 1); }
      }
      let vis = 1;
      if (crowd && studentsOn) { vis = visScale(); crowd.setZones(smokeZones()); crowd.step(dt, vis); drawStudents(vis, t); }
      if (now - shadowAt > 100) { renderer.shadowMap.needsUpdate = true; shadowAt = now; }
      renderer.render(scene, camera);
      placeLabels();
      if (crowd) placeBubbles(vis);
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
      if (e.button === 0) wrap.classList.add('m3-grabbing');
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
      wrap.classList.remove('m3-grabbing');
      if (endDrag()) return;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && !editing) {
        const id = sensorHit(e);
        if (id && api.onSelect) api.onSelect(id);
      }
      down = null;
    });
    renderer.domElement.addEventListener('pointercancel', () => { wrap.classList.remove('m3-grabbing'); endDrag(); });
    return api;
  }

  root.AirfaroMap3D = { create, PALETTE, buildWalkGraph, makeCrowd };
})(typeof window !== 'undefined' ? window : globalThis);
