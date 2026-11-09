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
           wall: 0xeef0ec, wallBg: 0xcfd2cd, roof: 0x86a48f, roofAlt: 0xb3bab2, roofBg: 0xa9ada7, box: 0xe3e6e3, tradWall: 0xffffff, tradRoof: 0xffffff, stoneWall: 0xffffff,
           tree: 0x3f7a30, treeAlt: 0x5a9442, trunk: 0x6b5a45, hemiSky: 0xffffff, hemiGround: 0x7d8278, hemi: 0.58, sun: 0.72,
           edge: 0x56626c, edgeOp: 0.3,
           window: 'rgba(110,140,162,0.55)', windowLit: null,
           glassTop: 'rgba(172,198,216,0.85)', glassBot: 'rgba(94,126,150,0.85)', frame: 'rgba(64,76,88,0.32)', mullion: 'rgba(255,255,255,0.6)', litTop: null, litBot: null },
    night: { sky: 0x0d1921, fog: 0x0d1921, skirt: '#38332d', skirtDark: '#29251f',
             ground: '#2a343b', urban: '#262f35', campus: '#303c43', grass: '#2b4f35', wood: '#22412c', pitch: '#2e5a37', pitchLine: '#6a8a72', pitchAlt: '#2a5232', pitchOut: '#274b2f', pitchMark: '#93b49c',
             parking: '#323b41', plaza: '#454b4b', water: '#24485b', road: '#161b1f', curb: '#4d585e', line: '#8a949a', path: '#4a5255', pathEdge: '#394045', steps: '#525a5c',
             wall: 0x75858f, wallBg: 0x48535a, roof: 0x4b665f, roofAlt: 0x5a6867, roofBg: 0x3b454b, box: 0x75828a, tradWall: 0x8f9aa2, tradRoof: 0x7f8a93, stoneWall: 0xbcc6d0,
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
  // ---- 방문자가 꾸미는 캐릭터 (꾸밈용). 서버에는 번호만 둬요: look = [피부, 머리 색, 머리 모양, 윗옷, 바지, 가방, 모자, 모자 색, 안경], nick = [꾸밈말, 이름]
  //      칸 수(LIMITS)는 공개 서버 handler.mjs 의 AVATAR_LIMITS · schema.sql 의 검사와 같아야 해요 (dev/avatar_check.mjs 가 비교해요)
  const AVATAR = {
    skin: SKIN, hair: [0x1c1a19, 0x2e231c, 0x4a3426, 0x6b4a2f, 0x9c7346, 0xc8a46e, 0x7b3b2a], style: ['짧은 머리', '긴 머리', '묶은 머리'],
    shirt: SHIRT, pants: PANTS, bag: BAG, hat: ['모자 없음', '야구 모자', '비니'], hatColor: [0xc94b40, 0x2f4a7a, 0x2c2c2e, 0xf1f1ec, 0xe2b43f, 0x4e8a5a], glasses: ['안경 없음', '안경'],
    names: {
      skin: ['아주 밝은 피부', '밝은 피부', '중간 피부', '구릿빛 피부', '갈색 피부', '짙은 갈색 피부'],
      hair: ['검은색', '짙은 갈색', '갈색', '밝은 갈색', '황갈색', '금발', '적갈색'],
      shirt: ['남색', '흰색', '회색', '민트색', '노란색', '빨간색', '하늘색', '분홍색', '검은색', '초록색', '주황색', '보라색'],
      pants: ['청색', '검은색', '베이지색', '회색', '짙은 청색', '갈색'],
      bag: ['남색', '보라색', '주황색', '짙은 남색', '청록색', '회색', '자주색'],
      hatColor: ['빨간색', '남색', '검은색', '흰색', '노란색', '초록색'],
    },
    LIMITS: [6, 7, 3, 12, 6, 8, 3, 6, 2],   // 가방은 0 = 없음, 1~7 = 색
    adj: ['졸린', '바쁜', '신난', '배고픈', '느긋한', '용감한', '수줍은', '씩씩한', '궁금한', '반짝이는', '조용한', '엉뚱한',
          '다정한', '부지런한', '행복한', '차분한', '명랑한', '꼼꼼한', '당당한', '상냥한', '날쌘', '포근한', '똑똑한', '즐거운'],
    noun: ['코끼리', '연꽃', '다람쥐', '고양이', '강아지', '부엉이', '수달', '펭귄', '거북이', '토끼', '여우', '판다',
           '고래', '참새', '너구리', '사슴', '은행잎', '단풍잎', '별', '구름', '호랑이', '곰', '두루미', '해바라기'],
  };
  const lookOk = (L) => Array.isArray(L) && L.length === 9 && L.every((v, i) => Number.isInteger(v) && v >= 0 && v < AVATAR.LIMITS[i]);
  const nickOk = (k) => Array.isArray(k) && k.length === 2 && Number.isInteger(k[0]) && Number.isInteger(k[1]) && k[0] >= 0 && k[0] < AVATAR.adj.length && k[1] >= 0 && k[1] < AVATAR.noun.length;
  const nickName = (k) => (nickOk(k) ? AVATAR.adj[k[0]] + ' ' + AVATAR.noun[k[1]] : '');
  // 번호 → 그릴 색
  function lookColors(L) {
    if (!lookOk(L)) L = [1, 0, 0, 0, 0, 0, 0, 0, 0];
    return { skin: AVATAR.skin[L[0]], hair: AVATAR.hair[L[1]], long: L[2] === 1, pony: L[2] === 2, shirt: AVATAR.shirt[L[3]], pants: AVATAR.pants[L[4]],
             bag: L[5] ? AVATAR.bag[L[5] - 1] : 0, hat: L[6], hatColor: AVATAR.hatColor[L[7]], glasses: L[8] === 1 };
  }
  const SMELL_TEXT = '아 담배 냄새!';
  // ---- 학생들이 하는 말 (꾸밈용 가상 대화). 공기 · 연기 · 냄새 이야기는 하지 않아요.
  //      흡연 의심 구역에서 하는 "아 담배 냄새!" 하나만 예외예요 (dev/crowd_check.js 가 낱말을 검사해요)
  //   대화 한 묶음은 말하는 차례대로 적어요: [먼저 말한 학생, 받은 학생, 먼저 말한 학생]
  //   장소 말은 가장 가까운 건물이나 장소(30m 안)에 맞춰 골라요. {n} 자리에는 그 건물 이름이 들어가요
  const TALK = {
    any: [
      ['안녕!', '어, 안녕! 어디 가?', '수업 들으러 가'],
      ['오랜만이다!', '진짜 오랜만이네', '나중에 밥 한번 먹자'],
      ['과제 다 했어?', '아직 반도 못 했어', '같이 힘내자'],
      ['리포트 냈어?', '어제 겨우 냈어'],
      ['시험 언제야?', '다음 주 화요일이래', '벌써 그렇게 됐네'],
      ['팀플 회의 몇 시야?', '4시 반이야', '고마워, 이따 봐'],
      ['이번 주말에 뭐 해?', '집에서 푹 쉬려고', '부럽다'],
      ['동아리 오늘 모여?', '응, 7시에', '그럼 이따 봐'],
      ['출석 불렀어?', '아직 안 불렀어', '다행이다'],
      ['수업 늦겠다!', '뛰어가자!'],
      ['충전기 있어?', '응, 빌려줄게', '고마워!'],
      ['조별 발표 언제지?', '목요일이야', '자료는 내가 만들게'],
      ['방학 때 뭐 할 거야?', '여행 가고 싶어', '좋다, 어디로?'],
      ['어제 경기 봤어?', '응, 완전 재밌었어'],
      ['공강이야?', '응, 두 시간 비어', '카페 갈래?'],
      ['교양 뭐 들어?', '심리학 들어', '나도 그거 들을걸'],
      ['노트 좀 빌려줄 수 있어?', '응, 사진 찍어서 보내 줄게'],
      ['오늘 몇 시에 끝나?', '4시에 끝나', '끝나고 연락해'],
      ['새로 생긴 카페 가 봤어?', '아직, 같이 가 볼래?', '좋아!'],
      ['어제 몇 시에 잤어?', '3시쯤…', '오늘은 일찍 자'],
    ],
    time: {
      morning: [['1교시 있어?', '응, 9시 수업', '힘내자!'], ['아침 먹었어?', '커피만 마셨어'], ['졸려 죽겠다', '나도 밤새웠어'], ['일찍 왔네?', '버스가 빨리 왔어']],
      lunch: [['점심 뭐 먹지?', '상록원 갈래?', '좋아!'], ['학식 메뉴 봤어?', '오늘 제육볶음이래', '가자!'], ['배고프다', '밥 먹으러 가자'], ['점심 먹었어?', '아직, 같이 먹을래?']],
      afternoon: [['커피 한잔할래?', '좋지, 수업 끝나고'], ['3시 수업 어디야?', '명진관이야'], ['너무 졸리다', '아이스커피 마시자']],
      evening: [['저녁 먹고 갈래?', '좋아, 뭐 먹을까?', '충무로 쪽으로 가자'], ['오늘 수업 끝!', '수고했어!'], ['집에 가?', '응, 지하철 타러']],
      night: [['막차 몇 시지?', '11시 반쯤이야', '서둘러야겠다'], ['아직 학교야?', '과제 하느라고', '고생 많다'], ['배고프다', '편의점 갈래?']],
    },
    place: {
      library: [['책 반납하러 가?', '응, 오늘까지야'], ['도서관 자리 있을까?', '시험 기간이라 없을걸'], ['열람실 갈래?', '좋아, 조용히 하자']],
      food: [['오늘 학식 뭐야?', '김치찌개래', '맛있겠다'], ['줄 길다…', '조금만 기다리자'], ['여기 반찬 맛있어', '맞아, 자주 와']],
      cafe: [['아메리카노 마실래?', '나는 라테!'], ['자리 있어?', '창가에 하나 있어']],
      field: [['축구 한 판 할래?', '좋지!', '공 가져올게'], ['운동장 넓다!', '한 바퀴 뛸까?'], ['체육대회 연습한대', '응원하러 가자']],
      temple: [['정각원은 조용해서 좋다', '마음이 편해져'], ['종 치는 거 본 적 있어?', '행사 때 봤어'], ['단청 색이 예쁘다', '사진 찍어 줄게']],
      palj: [['코끼리상 앞에서 찍자', '좋아, 하나 둘 셋!'], ['불상이 멋있다', '팔정도 한가운데야'], ['여기서 만나자', '알았어, 5분 뒤에']],
      plaza: [['잠깐 앉았다 갈까?', '좋아, 다리 아파'], ['여기서 만나자', '알았어, 5분 뒤에']],
      eng: [['실험 보고서 썼어?', '반쯤 썼어'], ['코딩 과제 돌아가?', '오류만 나…', '같이 보자'], ['설계 과제 언제 내?', '금요일까지야'], ['실험실 가?', '응, 측정이 남았어']],
      dorm: [['기숙사 들어가?', '응, 좀 쉬려고'], ['룸메이트랑 잘 지내?', '응, 착해'], ['택배 왔대', '빨리 가 보자']],
      gym: [['운동하러 가?', '응, 농구하러'], ['체육 수업 있어?', '배드민턴 배워']],
      club: [['동아리방 가?', '응, 회의 있어'], ['축제 준비 잘 돼?', '부스 거의 다 됐어', '보러 갈게!']],
      office: [['서류 내러 왔어?', '응, 학적과에'], ['증명서 뽑았어?', '응, 금방 나오더라']],
      museum: [['박물관 가 봤어?', '응, 전시 좋더라']],
      lecture: [['강의실 몇 호야?', '3층 끝 방이야'], ['여기 엘리베이터 느려', '계단으로 가자'], ['{n}에서 수업 있어?', '응, 곧 시작해'], ['다음 수업도 여기야?', '응, 같은 건물이야']],
    },
  };
  // 혼자 서 있을 때 떠올리는 생각 (점선 말풍선)
  const THINK = {
    any: ['과제가 몇 개더라…', '오늘 뭐 먹지…', '조금만 쉬자…', '집에 가고 싶다…', '다음 수업 어디더라…', '친구는 언제 오지…', '버스 몇 분 남았지…', '내일 1교시네…', '음악 뭐 듣지…'],
    time: { morning: ['아직 졸려…', '커피 마시고 싶다…'], lunch: ['배고프다…', '학식 먹을까…'], afternoon: ['졸리다…'], evening: ['저녁 뭐 먹지…', '얼른 집에 가야지…'], night: ['막차 놓치면 안 돼…', '오늘도 늦었네…'] },
    place: { library: ['자리 있으려나…', '책 반납해야 하는데…'], field: ['한 바퀴 뛸까…', '공 차고 싶다…'], temple: ['조용하다…', '마음이 차분해지네…'], food: ['오늘 메뉴 뭐지…', '줄 길면 어쩌지…'],
             cafe: ['뭐 마시지…', '아메리카노 마실까…'], dorm: ['빨래해야지…', '방 청소해야 하는데…'], gym: ['오늘은 꼭 운동하자…', '샤워하고 가야지…'], eng: ['실험 결과가 왜 이러지…', '보고서 언제 쓰지…'],
             lecture: ['다음 강의실이 어디더라…', '출석 부르기 전에 가야지…'], museum: ['전시 바뀌었나…', '언제 한번 들어가 봐야지…'], club: ['동아리방 열려 있으려나…', '회의 몇 시였지…'],
             office: ['서류 내야 하는데…', '장학금 신청 언제까지지…'], palj: ['여기 걷기 좋다…', '오늘 하늘 맑네…'], plaza: ['여기서 만나기로 했는데…', '다들 어디 있지…'] },
  };
  const ARRIVE = { any: ['도착!', '여기 맞나?', '조금 일찍 왔네'], place: { library: ['자리 찾아보자'], food: ['줄이 별로 없네!'], cafe: ['여기 좋다'], lecture: ['강의실 찾았다'] } };
  const PASS = { hi: ['안녕!', '어, 안녕!', '나중에 봐!', '안녕~'], back: ['안녕!', '응, 안녕!', '이따 봐!'] };
  // 걸으면서 하는 전화 (한쪽 말만 보여요)
  const CALL = ['응, 지금 가는 중이야', '어디야?', '5분이면 도착해', '응, 알겠어!', '이따 다시 전화할게'];
  // 방문자가 세운 캐릭터에게 하는 인사와 캐릭터의 답
  const GREET = { npc: ['안녕하세요!', '{nick}님, 안녕하세요!', '처음 보는 얼굴이네', '여기서 뭐 해요?', '반가워요!'], reply: ['안녕하세요!', '반가워요!', '구경하고 있어요', '안녕!'] };
  // 건물 · 장소 이름으로 말할 거리를 골라요. 이름 없는 건물은 고르지 않아요
  const PLACE_KINDS = [[/사회과학|경영관/, 'lecture'], [/도서관/, 'library'], [/식당|상록원/, 'food'], [/카페/, 'cafe'], [/운동장/, 'field'], [/정각원|종각/, 'temple'], [/팔정도/, 'palj'],
    [/광장/, 'plaza'], [/공학|원흥|과학관|정보문화/, 'eng'], [/학사|기숙사/, 'dorm'], [/체육관/, 'gym'], [/학생회관/, 'club'], [/본관/, 'office'], [/박물관/, 'museum']];
  function placeKind(name) { for (const [re, k] of PLACE_KINDS) if (re.test(name)) return k; return 'lecture'; }
  function shortName(name) {
    let s = String(name || '').replace(/\(.*?\)/g, '').replace(/^동국대\s*/, '').trim();
    if (s.includes('.')) s = s.split('.').pop();
    return s === 'MediaCenter' ? '미디어센터' : s;
  }
  const timeKind = (h) => (h >= 6 && h < 11 ? 'morning' : h >= 11 && h < 14 ? 'lunch' : h >= 14 && h < 18 ? 'afternoon' : h >= 18 && h < 22 ? 'evening' : 'night');
  function makeCrowd(G, o) {
    o = o || {};
    const rand = rng(o.seed || 1), pick = (a) => a[Math.floor(rand() * a.length)];
    // 말은 따로 굴리는 주사위로 골라요. 무슨 말을 하든(시각이나 장소가 달라도) 걷는 길은 똑같아요
    const trand = rng(((o.seed || 1) * 2654435761 + 977) >>> 0), tpick = (a) => a[Math.floor(trand() * a.length)];
    const nodes = G.nodes, edges = G.edges, NN = nodes.length;
    const N = NN >= 2 ? Math.max(0, Math.floor(o.count ?? 40)) : 0;
    const MAX_SMELL = 4, MAX_AV_SMELL = 2, REACT_S = 1.7, SMELL_S = 2.8;
    const MAX_TALK = Math.max(0, Math.floor(o.maxTalk ?? 4));   // 보이는 곳(focus)에 한 번에 뜨는 잡담 · 혼잣말 말풍선 수
    const hourNow = typeof o.clock === 'function' ? o.clock : () => new Date(Date.now() + 9 * 3600e3).getUTCHours();   // 한국 시각 (시)
    const places = (o.places || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z) && p.kind);
    const npcs = [], convs = [];
    let zones = [], zoneSig = '', zoneEdges = new Map(), time = 0, spawned = false, chatClock = 0, focus = null, avs = [], npcsOn = true;
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
      for (const a of avs) for (const id of [...a.mem]) if (!live.has(id)) a.mem.delete(id);
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
                    reacts: 0, face: 0, partner: null, dest: -1, memS: 100 + rand() * 60, look: makeLook(),
                    pend: null, wave: 0, thinkCool: trand() * 12, greetCool: 0, said: 0, call: 0, callCool: trand() * 30 });
      }
    }
    // ---- 말풍선
    const inFocus = (x, z) => !focus || (Math.abs(x - focus.x) <= focus.r && Math.abs(z - focus.z) <= focus.r && dist(x, z, focus.x, focus.z) <= focus.r);
    function placeAt(x, z) { let b = null, bd = 30; for (const p of places) { const d = dist(x, z, p.x, p.z) - (p.r || 0); if (d < bd) { bd = d; b = p; } } return b; }
    // 말 고르기: 가까운 장소가 있으면 40%는 장소 이야기, 25%는 지금 시각에 맞는 이야기, 나머지는 어디서나 하는 이야기
    function pickFrom(set, x, z) {
      const pl = placeAt(x, z), r = trand(), tk = timeKind(hourNow());
      let pool = null;
      if (pl && set.place && set.place[pl.kind] && r < 0.4) pool = set.place[pl.kind];
      else if (set.time && set.time[tk] && r < 0.65) pool = set.time[tk];
      if (!pool || !pool.length) pool = set.any;
      const line = tpick(pool), fill = (s) => s.replace('{n}', pl ? pl.short || pl.name : '여기');
      return Array.isArray(line) ? line.map(fill) : fill(line);
    }
    // 말풍선 하나 띄우기. 보이는 곳에서는 잡담 · 혼잣말을 MAX_TALK 개까지만 띄우고, 냄새 반응 말풍선은 덮지 않아요
    function say(n, text, kind, dur, cnt, conv) {
      if (!npcsOn) return false;
      const cur = n.say && time <= n.say.until ? n.say : null;
      if (cur && cur.kind === 'smell') return false;
      const f = inFocus(n.rx, n.rz);
      if (f && !cur && cnt.talk >= MAX_TALK) return false;
      if (f && !cur) cnt.talk++;
      n.say = { text, kind, until: time + dur, at: time, conv: conv || null };
      n.said++;
      return true;
    }
    // 대화: 정해 둔 차례대로 한 줄씩. 다음 사람이 말하면 앞 사람 말풍선은 곧 닫혀요. 첫 줄을 못 띄우면(말풍선이 꽉 참) 끝까지 말없이 이야기해요
    function runConvs(cnt) {
      for (let i = convs.length - 1; i >= 0; i--) {
        const c = convs[i];
        if (c.k >= c.lines.length || c.a.mode !== 'chat' || c.b.mode !== 'chat' || c.a.partner !== c.b) { convs.splice(i, 1); continue; }
        while (c.k < c.lines.length && time >= c.t0 + 0.4 + c.k * c.gap) {
          const who = c.k % 2 ? c.b : c.a, other = c.k % 2 ? c.a : c.b;
          if (other.say && other.say.conv === c) other.say.until = Math.min(other.say.until, time + 0.4);
          if (!c.silent && !say(who, c.lines[c.k], 'talk', c.dur, cnt, c) && c.k === 0) c.silent = true;
          if (!c.silent) c.shown++;
          c.k++;
        }
      }
    }
    function chats(cnt) {
      if (!npcsOn) { for (const av of avs) av.watch = null; return; }   // 학생을 끈 동안에는 이야기 · 인사를 쉬어요
      for (let i = 0; i < npcs.length; i++) {
        const a = npcs[i]; if (a.mode !== 'walk' || a.talkCool > time) continue;
        for (let j = i + 1; j < npcs.length; j++) {
          const b = npcs[j]; if (b.mode !== 'walk' || b.talkCool > time) continue;
          if (Math.abs(a.rx - b.rx) > 2.2 || Math.abs(a.rz - b.rz) > 2.2 || dist(a.rx, a.rz, b.rx, b.rz) > 2.2) continue;
          a.talkCool = b.talkCool = time + 30 + rand() * 30;
          if (rand() > 0.35) {   // 멈추지 않고 지나가요. 가끔 손을 흔들며 인사해요
            if (trand() < (inFocus(a.rx, a.rz) ? 0.5 : 0.3)) {
              const [p, q] = trand() < 0.5 ? [a, b] : [b, a];
              if (say(p, tpick(PASS.hi), 'talk', 1.7, cnt)) { p.wave = time + 1.4; if (trand() < 0.6) q.pend = { text: tpick(PASS.back), at: time + 0.8, dur: 1.6, wave: 1.2 }; }
            }
            break;
          }
          const t = 6 + rand() * 2.5;
          a.mode = b.mode = 'chat'; a.t = b.t = t; a.partner = b; b.partner = a;
          const [p, q] = trand() < 0.5 ? [a, b] : [b, a];
          const lines = pickFrom(TALK, (a.x + b.x) / 2, (a.z + b.z) / 2), gap = (t - 1.2) / lines.length;
          convs.push({ a: p, b: q, lines, t0: time, gap, dur: Math.min(2.9, gap + 0.45), k: 0, silent: false, shown: 0 });
          break;
        }
      }
      // 방문자 캐릭터: 가까이 걷는 학생을 바라보고, 옆을 지나가는 학생이 가끔 인사하면 손을 흔들며 답해요
      for (const av of avs) {
        let near = null, nd = 10;
        for (const n of npcs) {
          if (Math.abs(n.rx - av.x) > nd || Math.abs(n.rz - av.z) > nd) continue;
          const d = dist(n.rx, n.rz, av.x, av.z); if (d < nd) { nd = d; near = n; }
        }
        av.watch = near ? Math.atan2(near.rx - av.x, near.rz - av.z) : null;
        if (!near || nd > 3.2 || av.greetCool > time || av.react || near.mode !== 'walk' || near.greetCool > time || (near.say && time <= near.say.until)) continue;
        near.greetCool = time + 50; av.greetCool = time + 9;
        if (trand() >= 0.55) continue;
        const pool = av.nick ? GREET.npc : GREET.npc.filter((s) => !s.includes('{nick}'));
        if (say(near, tpick(pool).replace('{nick}', av.nick), 'talk', 2.3, cnt)) {
          near.wave = time + 1.5;
          av.pend = { text: tpick(GREET.reply), at: time + 1.2, dur: 2.1 };
          av.waveFrom = time + 1.0; av.waveUntil = time + 3.3; av.greeted++;
        }
      }
    }
    // 방문자가 세운 캐릭터 (꾸밈용): 걷지 않고 서서 지나가는 학생들을 봐요. key 가 같으면 하던 동작을 이어 가요
    function setAvatars(list) {
      const old = new Map(avs.map((a) => [a.key, a]));
      avs = (list || []).filter((a) => a && a.key !== undefined && Number.isFinite(a.x) && Number.isFinite(a.z)).map((a) => Object.assign(old.get(a.key) ||
        { say: null, pend: null, waveFrom: 0, waveUntil: 0, greetCool: 0, mem: new Set(), react: false, watch: null, greeted: 0, face: 0 },
        { key: a.key, x: a.x, z: a.z, h: Number.isFinite(a.h) ? a.h : 0, nick: a.nick || '' }));
    }
    // dt 초만큼 움직여요. vis = 화면에서 키운 배율 (멀리서 보면 학생을 크게 그려요 → 걸음도 그만큼 크게 · 조금 빠르게)
    function step(dt, vis) {
      if (!(dt > 0)) return;
      if (!N && !avs.length) return;
      if (!spawned && N) spawn();
      vis = Math.max(1, vis || 1);
      time += dt;
      const cnt = { smell: 0, talk: 0, avSmell: 0 };
      for (const n of npcs) if (n.say) { if (time > n.say.until) n.say = null; else if (n.say.kind === 'smell') cnt.smell++; else if (inFocus(n.rx, n.rz)) cnt.talk++; }
      for (const a of avs) if (a.say) { if (time > a.say.until) a.say = null; else if (a.say.kind === 'smell') cnt.avSmell++; }
      for (const n of npcs) {
        if (n.mode !== 'react') for (const q of zones) {   // 냄새: 처음 들어간 흡연 의심 구역이면 반응해요
          const seen = n.mem.get(q.id);
          if (seen !== undefined) { if (time - seen < n.memS) continue; n.mem.delete(q.id); }
          if (dist(n.x, n.z, q.x, q.z) > q.r) continue;
          n.mem.set(q.id, time);
          if (n.partner) { n.partner.partner = null; n.partner = null; }
          n.mode = 'react'; n.t = REACT_S; n.fast = false; n.pend = null;
          n.face = Math.atan2(n.x - q.x, n.z - q.z);   // 구역 반대쪽으로 돌아서요
          if (n.say && n.say.kind !== 'smell' && inFocus(n.rx, n.rz)) cnt.talk--;
          if (cnt.smell < MAX_SMELL) { n.say = { text: SMELL_TEXT, kind: 'smell', until: time + SMELL_S, at: time }; cnt.smell++; }
          else if (n.say && n.say.kind !== 'smell') n.say = null;
          n.reacts++;
          break;
        }
        if (n.pend && time >= n.pend.at) { if (n.mode !== 'react' && say(n, n.pend.text, 'talk', n.pend.dur, cnt) && n.pend.wave) n.wave = time + n.pend.wave; n.pend = null; }
        if (n.mode === 'walk') {
          const m = n.speed * (n.fast ? 1.5 : 1) * (1 + 0.3 * (vis - 1)) * dt;
          const end = advance(n, m);
          n.phase += m / (0.62 * vis) * Math.PI;
          if (end) {
            n.mode = 'idle'; n.t = 2 + rand() * 6; n.pose = rand() < 0.5 ? 'phone' : 'look'; n.fast = false; n.path = null;
            if (!n.say && trand() < 0.14) say(n, pickFrom(ARRIVE, n.x, n.z), 'talk', 1.9, cnt);   // 도착하면 가끔 한마디
          } else if (!n.say && !n.fast && n.callCool <= time && inFocus(n.rx, n.rz) && trand() < dt * 0.012) {   // 걸으면서 가끔 전화해요
            n.callCool = time + 60 + trand() * 60;
            if (say(n, tpick(CALL), 'talk', 2.6, cnt)) n.call = time + 2.6;
          }
        } else if (n.mode === 'idle' || n.mode === 'chat') {
          n.t -= dt;
          // 혼자 서 있으면 가끔 생각을 떠올려요 (보이는 곳에서 더 자주)
          if (n.mode === 'idle' && !n.say && !n.pend && n.thinkCool <= time && trand() < dt * (inFocus(n.rx, n.rz) ? 0.12 : 0.015)) {
            n.thinkCool = time + 16 + trand() * 20;
            say(n, pickFrom(THINK, n.x, n.z), 'think', 2.8, cnt);
          }
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
      // 방문자 캐릭터: 흡연 의심 구역 안이면 코를 막아요 (구역마다 한 번 "아 담배 냄새!")
      for (const a of avs) {
        let zq = null;
        for (const q of zones) if (dist(a.x, a.z, q.x, q.z) <= q.r) { zq = q; break; }
        a.react = !!zq;
        if (zq && !a.mem.has(zq.id)) {
          a.mem.add(zq.id); a.pend = null; a.face = Math.atan2(a.x - zq.x, a.z - zq.z);
          if (cnt.avSmell < MAX_AV_SMELL) { a.say = { text: SMELL_TEXT, kind: 'smell', until: time + SMELL_S, at: time }; cnt.avSmell++; }
        }
        if (a.pend && time >= a.pend.at) { if (!a.react && !(a.say && a.say.kind === 'smell')) a.say = { text: a.pend.text, kind: 'talk', until: time + a.pend.dur, at: time }; a.pend = null; }
      }
      runConvs(cnt);
      chatClock += dt;
      if (chatClock >= 0.5) { chatClock = 0; chats(cnt); }
    }
    return {
      get npcs() { if (!spawned && N) spawn(); return npcs; },
      get count() { return N; },
      get time() { return time; },
      get zones() { return zones; },
      get avatars() { return avs; },
      get convs() { return convs; },
      setZones, step, nearestNode, route, setAvatars,
      // 화면에 보이는 곳 (x, z 를 가운데로 반지름 r m). 잡담 말풍선 수는 이 안에서만 세요. r 이 없으면 캠퍼스 전체
      setFocus(x, z, r) { focus = Number.isFinite(x) && Number.isFinite(z) && r > 0 ? { x, z, r } : null; },
      // 학생 캐릭터를 화면에서 끄면 말 · 인사도 멈춰요 (걷기와 냄새 반응은 그대로 이어서, 다시 켜면 자연스럽게 이어져요)
      setNpcsOn(on) { npcsOn = !!on; if (!npcsOn) { for (const n of npcs) if (n.say && n.say.kind !== 'smell') n.say = null; convs.length = 0; } },
      placeAt,
      // 시험용: i 번 학생을 마디 node 에 세워요 (아무 것도 기억하지 않은 채 오래 서 있게)
      place(i, node, still) {
        if (!spawned) spawn();
        const n = npcs[i], nd = nodes[node]; if (!n || !nd) return false;
        Object.assign(n, { x: nd.x, z: nd.z, rx: nd.x, rz: nd.z, ox: 0, oz: 0, node, path: null, seg: 0, d: 0, mode: 'idle', t: still ?? 30, say: null, pend: null, fast: false, partner: null });
        n.mem.clear();
        return true;
      },
      // 시험용: 떠 있는 말풍선을 모두 지워요
      quiet() { for (const n of npcs) { n.say = null; n.pend = null; } for (const a of avs) { a.say = null; a.pend = null; } convs.length = 0; },
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
    // 명진관 돌 벽 (기사: 회갈색 화강석으로 지은 튜더풍 고딕 석조 건물). 한 칸 = 가로 3.2m × 세로 3.6m 로 창문 그림과 같아요
    //   돌은 높이가 들쭉날쭉한 줄로 쌓고, 창은 끝이 뾰족한 좁고 긴 창 하나 (창 모양은 글에 없어 고딕 건물에 흔한 모양으로 짐작했어요)
    //   위쪽 띠(세로 3.0~3.5m)에는 창이 없어서 옥상 난간이 이 줄의 돌을 써요
    function stoneTexture(p, lit) {
      const S = WT, k = S / 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d'), r = rng(735);
      g.fillStyle = '#857b6f'; g.fillRect(0, 0, S, S);   // 줄눈
      const stone = () => { const v = r(), w = (r() - 0.5) * 10; return `rgb(${Math.round(156 + v * 30 + w)},${Math.round(146 + v * 28)},${Math.round(131 + v * 26 - w)})`; };
      // 줄 높이를 모두 더하면 S (위아래로 이어 붙여도 이음매가 없어요)
      const rows = []; let y = 0;
      while (y < S) { let hh = Math.round((18 + r() * 16) * k); if (S - (y + hh) < 16 * k) hh = S - y; rows.push([y, hh]); y += hh; }
      const mort = Math.max(1, Math.round(2 * k));
      for (const [y0, hh] of rows) {
        // 줄마다 첫 경계 o 에서 S + o 까지 돌을 놓고, 오른쪽 끝을 넘는 돌은 왼쪽에도 그려요 (가로로 이어 붙여도 맞아요)
        const o = Math.floor(r() * 40 * k), xs = [o];
        while (xs[xs.length - 1] < S + o - 30 * k) xs.push(xs[xs.length - 1] + Math.round((30 + r() * 50) * k));
        xs[xs.length - 1] = S + o;
        for (let i = 0; i + 1 < xs.length; i++) { g.fillStyle = stone(); for (const dx of [0, -S]) g.fillRect(xs[i] + dx + mort / 2, y0 + mort / 2, xs[i + 1] - xs[i] - mort, hh - mort); }
      }
      for (let i = 0; i < 900 * k * k; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,52,44,0.18)' : 'rgba(235,228,214,0.16)'; g.fillRect(Math.floor(r() * S), Math.floor(r() * S), Math.max(1, Math.round(k)), Math.max(1, Math.round(k))); }   // 화강석 알갱이
      // 창: 가로 0.9m, 아래 0.7m ~ 위 2.7m (꼭대기 0.5m 는 뾰족한 아치), 둘레에 다듬은 밝은 돌
      const px = S / 3.2, py = S / 3.6, cx = S / 2, hw = 0.45 * px, yb = S - 0.7 * py, yt = S - 2.7 * py, ys = yt + 0.5 * py;
      const arch = (pad) => {
        g.beginPath(); g.moveTo(cx - hw - pad, yb + pad); g.lineTo(cx - hw - pad, ys);
        g.quadraticCurveTo(cx - hw - pad, yt + 0.12 * py - pad, cx, yt - pad * 1.3); g.quadraticCurveTo(cx + hw + pad, yt + 0.12 * py - pad, cx + hw + pad, ys);
        g.lineTo(cx + hw + pad, yb + pad); g.closePath();
      };
      g.fillStyle = '#bcb2a1'; arch(0.09 * px); g.fill();
      const gr = g.createLinearGradient(0, yt, 0, yb);
      gr.addColorStop(0, lit ? p.litTop : p.litTop ? p.glassTop : 'rgba(104,121,133,0.92)'); gr.addColorStop(1, lit ? p.litBot : p.litTop ? p.glassBot : 'rgba(62,75,86,0.92)');
      g.fillStyle = '#2d3034'; arch(0); g.fill();
      g.fillStyle = gr; arch(0); g.fill();
      g.fillStyle = 'rgba(78,71,62,0.92)';
      g.fillRect(Math.round(cx - k), ys - 0.1 * py, Math.max(1, Math.round(2 * k)), yb - ys + 0.1 * py);   // 가운데 돌 창살
      g.fillRect(cx - hw, Math.round(yb - 0.75 * py), hw * 2, Math.max(1, Math.round(2 * k)));            // 가로 창살
      g.fillStyle = '#c8beac'; g.fillRect(cx - hw - 0.14 * px, yb + 0.09 * px, (hw + 0.14 * px) * 2, Math.max(2, Math.round(0.08 * py)));   // 창턱
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
    let texDay = null, texLit = null, stDay = null, stLit = null;
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

    // ---- 이름난 모습 (기사 · OSM 을 보고 비슷하게 만든 모형): 명진관 돌 벽과 가운데 탑 · 팔정도 불상과 코끼리상 · 옥상 정원
    const tradMats = [];   // 낮 · 밤 색을 바꿀 재질
    const landmarks = { mj: null, buddha: null, elephant: null, gardens: [] };
    const LM_M = new T.Matrix4(), LM_Q = new T.Quaternion(), LM_P = new T.Vector3(), LM_S = new T.Vector3(1, 1, 1), LM_UP = new T.Vector3(0, 1, 0);
    // 옥상 정원이 있는 건물 (기사: 중앙도서관 '하늘마루' (2021년 동대신문), 원흥관 · 상록원 (2010년 서울시 기사)). 이 건물들은 옥상 설비 상자 대신 정원을 그려요
    const ROOF_GARDEN = /^(중앙도서관|원흥관|상록원)/;
    // 명진관 (기사: 1958년 송민구 설계, 화강석 석조, 지상 5층 · 지하 1층, 가운데 4층 높이 탑 아래 아치 입구, 탑을 가운데 둔 좌우 대칭 튜더풍 고딕)
    //   OSM 윤곽에서 북쪽(팔정도 쪽) 가운데로 튀어나온 칸이 탑 자리예요. 그 바깥 두 모서리(front)에서 안쪽으로 depth m 를 한 층쯤(rise) 더 올리고
    //   꼭대기에 성가퀴(톱니 난간), 네 모서리에 조금 더 높은 돌기둥, 아래에 뾰족한 아치 문을 붙여요. 탑 꼭대기 · 문 크기는 글에 없어 짐작했어요
    const MJ = { name: '명진관', front: [[-66.3, 55.6], [-57.9, 58.7]], depth: 9.5, rise: 4.6 };
    const mjTrim = tradMat(0xa0958a, 0x51575b), mjDark = tradMat(0x2b2723, 0x15171a), mjDressed = tradMat(0xc3b9a7, 0x666b6d);
    function addMyeongjin(b, base) {
      const near = (q) => b.outer.reduce((m, p) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); return d < m.d ? { d, p } : m; }, { d: Infinity, p: null });
      const fa = near(MJ.front[0]), fb = near(MJ.front[1]);
      if (!(fa.d < 2 && fb.d < 2)) return;   // OSM 윤곽이 바뀌어 탑 자리를 못 찾으면 탑 없이 둬요
      const a = fa.p, c = fb.p, L = Math.hypot(c[0] - a[0], c[1] - a[1]), ex = (c[0] - a[0]) / L, ez = (c[1] - a[1]) / L;
      let nx = -ez, nz = ex;   // 건물 안쪽을 보는 쪽
      if ((b.c[0] - a[0]) * nx + (b.c[1] - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const o = 0.15, D = MJ.depth, top = b.top + MJ.rise;   // 탑을 0.15m 바깥으로 내어 아래 벽과 겹쳐 깜빡이지 않게
      const at = (s, t) => [a[0] + ex * s + nx * t, a[1] + ez * s + nz * t];
      const ring = [at(-o, -o), at(L + o, -o), at(L + o, D), at(-o, D)];
      const shape = new T.Shape(ring.map(([x, z]) => new T.Vector2(x, -z)));
      const geo = new T.ExtrudeGeometry(shape, { depth: top - base, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2); geo.translate(0, base, 0);
      const tower = new T.Mesh(geo, [b.roof, b.wall]); tower.castShadow = tower.receiveShadow = true; tower.userData = b.mesh.userData; scene.add(tower);
      const par = new T.Mesh(parapetGeometry([ring], top, PH), b.wall); par.castShadow = true; par.userData = b.mesh.userData; scene.add(par);
      const eg = new T.EdgesGeometry(geo, 35), ea = eg.attributes.position.array;
      for (let i = 0; i < ea.length; i++) edgePos.push(ea[i]);
      eg.dispose();
      // 성가퀴: 난간 위에 0.8m 돌을 1.5m 마다
      const mers = [];
      for (let i = 0; i < 4; i++) {
        const p0 = ring[i], p1 = ring[(i + 1) % 4], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(2, Math.round((len - 0.8) / 1.5) + 1), yaw = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]);
        for (let j = 0; j < n; j++) { const t = (0.4 + (len - 0.8) * j / (n - 1)) / len; mers.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, yaw]); }
      }
      const merM = new T.InstancedMesh(new T.BoxGeometry(0.8, 0.7, 0.42), mjTrim, mers.length);
      mers.forEach(([x, z, yaw], i) => { LM_M.compose(LM_P.set(x, top + PH + 0.35, z), LM_Q.setFromAxisAngle(LM_UP, yaw), LM_S.set(1, 1, 1)); merM.setMatrixAt(i, LM_M); });
      merM.castShadow = true; merM.userData = b.mesh.userData; scene.add(merM);
      // 네 모서리 돌기둥: 버팀벽처럼 조금 튀어나오고 성가퀴보다 1m 높아요
      const pierH = top + PH + 1.0 - base, piers = new T.InstancedMesh(new T.BoxGeometry(1.2, 1, 1.2), mjTrim, 4), yaw0 = Math.atan2(-ez, ex);
      ring.forEach(([x, z], i) => { LM_M.compose(LM_P.set(x, base + pierH / 2, z), LM_Q.setFromAxisAngle(LM_UP, yaw0), LM_S.set(1, pierH, 1)); piers.setMatrixAt(i, LM_M); });
      piers.castShadow = true; piers.userData = b.mesh.userData; scene.add(piers);
      // 아치 문: 앞면 가운데 아래에 뾰족한 아치 (폭 3m · 높이 4.8m), 둘레에 다듬은 밝은 돌
      const archShape = (w, h) => { const s = new T.Shape(), hw = w / 2; s.moveTo(-hw, 0); s.lineTo(-hw, h * 0.66); s.quadraticCurveTo(-hw, h * 0.92, 0, h); s.quadraticCurveTo(hw, h * 0.92, hw, h * 0.66); s.lineTo(hw, 0); s.closePath(); return s; };
      const [fx, fz] = at(L / 2, -o), gy = hAt(fx, fz) - 0.1, faceYaw = Math.atan2(-nx, -nz);
      for (const [w, h, mat, off] of [[3.8, 5.6, mjDressed, 0.03], [3.0, 4.8, mjDark, 0.06]]) {
        const m = new T.Mesh(new T.ShapeGeometry(archShape(w, h), 8), mat);
        m.position.set(fx - nx * off, gy, fz - nz * off); m.rotation.y = faceYaw; m.userData = b.mesh.userData; scene.add(m);
      }
      b.occ = [b.mesh, tower];
      landmarks.mj = { id: b.id, ring, top, wingTop: b.top, base, front: [a, c], door: { x: fx, z: fz, y: gy, w: 3.0, h: 4.8 }, merlons: mers.length };
    }

    // ---- 전통 건물 (정각원 · 동국대종각): 돌 기단 + 붉은 기둥 + 단청 띠 + 팔작지붕
    //   OSM 윤곽은 위에서 본 지붕(처마 끝)이라 기둥은 처마 안쪽(over m)에 세워요.
    //   처마 끝은 모서리로 갈수록 들리고(lift) 바깥으로 휘어요(flare). 지붕 면은 처마 쪽이 완만하고 위로 갈수록 가팔라요(오목)
    //   땅은 위 FLATS 에서 건물 터만큼 평평하게 골라 두었어요
    const TRAD_DIM = {
      hall: { over: [0.25, 1.6, 3], plat: 0.9, platOut: 1.4, col: 4.6, band: 1.1, colR: 0.32, bay: 4.4, eave: 5.3, lift: 1.0, flare: 0.7, ridge: 11.2, a: 0.52, thk: 0.38, gableOver: 0.45, ridgeW: 0.6, walls: true },
      pavilion: { over: [0.34, 0.9, 1.6], plat: 0.6, platOut: 0.6, col: 2.9, band: 0.55, colR: 0.2, bay: 2.6, eave: 3.0, lift: 0.5, flare: 0.35, ridge: 5.8, a: 0.52, thk: 0.24, gableOver: 0.25, ridgeW: 0.36, walls: false },
    };
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
      buildings.push({ id: bd.id, name: bd.name || '', bg: !!bd.bg, outer, c, A, top, base, mesh, wall, roof, alt, lit: hash(bd.id + 'L') % 3 !== 0, skin: bd.name === MJ.name ? 'stone' : null });
      if (bd.name === MJ.name) addMyeongjin(buildings[buildings.length - 1], base);
      if (!bd.bg && !ROOF_GARDEN.test(bd.name || '') && bd.name !== MJ.name) {
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

    // ---- 팔정도 청동 석가여래입상 (기사: 1964년 김영중 작, 팔정도 한가운데 · 명진관 앞, 연꽃 받침 위에 선 청동 불상, 오른손 시무외인 · 왼손 여원인)
    //   자리 = 팔정도 한가운데 작은 고리 길(OSM 에서 닫힌 길)의 가운데. 키 · 받침 크기 · 바라보는 쪽은 글에 없어 짐작했어요 (북쪽)
    const statueSpots = [];   // 캐릭터를 세울 수 없는 조각상 자리 { x, z, r }
    const bronze = tradMat(0x76603f, 0x3d3427), granite = tradMat(0xd2cdc1, 0x5b6166);
    function palCenter() {
      const lab = (campus.labels || []).find((l) => l.name === '팔정도'); if (!lab) return null;
      let best = null;
      for (const rd of campus.roads || []) {
        const p = ringPts(rd.pts); if (rd.k !== 'footway' || p.length < 4) continue;
        const f = p[0], l = p[p.length - 1]; if (Math.hypot(f[0] - l[0], f[1] - l[1]) > 0.2) continue;
        const ring = p.slice(0, -1), c = centroid(ring), A = Math.abs(area(ring)), d = Math.hypot(c[0] - lab.x, c[1] - lab.z);
        if (A < 400 && d < 12 && (!best || d < best.d)) best = { x: c[0], z: c[1], d, r: Math.sqrt(A / Math.PI), from: 'ring' };
      }
      return best || { x: lab.x, z: lab.z, d: 0, r: 4, from: 'label' };
    }
    function statueGroup(x, z) {
      const grp = new T.Group(), y0 = hMesh(x, z);
      grp.position.set(x, y0, z); scene.add(grp);
      const add = (geo, mat, px, py, pz, par) => { const m = new T.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; (par || grp).add(m); return m; };
      return { grp, y0, add };
    }
    // 땅을 따라 휘는 얇은 판 (둥근 터 · 물길): 점마다 땅 높이 + lift
    function groundSheet(cx, cz, y0, pts, tris, mat, lift) {
      const pos = [];
      for (const [x, z] of pts) pos.push(x, hMesh(cx + x, cz + z) - y0 + lift, z);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(tris); g.computeVertexNormals();
      const m = new T.Mesh(g, mat); m.receiveShadow = true; return m;
    }
    function addBuddha() {
      const pc = palCenter(); if (!pc) return;
      const { grp, y0, add } = statueGroup(pc.x, pc.z);
      add(new T.CylinderGeometry(2.3, 2.45, 1.2, 8), granite, 0, 0.3, 0);    // 아래 돌 단 (0.3m 는 땅속)
      add(new T.CylinderGeometry(1.5, 1.65, 0.7, 8), granite, 0, 1.25, 0);   // 위 돌 단
      add(new T.CylinderGeometry(0.95, 0.7, 0.4, 20), bronze, 0, 1.8, 0);    // 연꽃 받침: 둥근 판 + 바깥으로 벌어진 꽃잎 14장
      const petal = new T.SphereGeometry(1, 8, 6); petal.scale(0.3, 0.2, 0.52); petal.translate(0, 0, 0.42);
      for (let i = 0; i < 14; i++) { const m = add(petal, bronze, 0, 1.8, 0); m.rotation.y = i / 14 * Math.PI * 2; m.rotateX(-0.45); }
      // 선 몸 (앞 = +z): 옷자락이 발까지 내려오는 모양을 돌림체로, 앞뒤로 조금 납작하게
      const B0 = 2.0, prof = [[0, 0], [0.44, 0], [0.5, 0.18], [0.45, 0.9], [0.41, 1.45], [0.46, 2.05], [0.53, 2.5], [0.42, 2.72], [0.18, 2.83], [0.15, 2.93], [0, 2.95]].map(([r, h]) => new T.Vector2(r, h));
      const body = add(new T.LatheGeometry(prof, 18), bronze, 0, B0, 0); body.scale.set(1, 1, 0.78);
      add(new T.SphereGeometry(0.27, 14, 10), bronze, 0, B0 + 3.17, 0.02);   // 머리
      add(new T.SphereGeometry(0.13, 10, 8), bronze, 0, B0 + 3.47, 0);       // 머리 위 볼록한 육계
      const limb = (a, b, r) => { const v = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m = add(new T.CylinderGeometry(r, r, v.length(), 8), bronze, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.quaternion.setFromUnitVectors(LM_UP, v.normalize()); };
      // 오른손 (몸의 오른쪽 = -x): 팔꿈치를 굽혀 손바닥을 앞으로 든 시무외인 · 왼손: 내려서 손바닥을 앞으로 편 여원인
      limb([-0.47, B0 + 2.55, 0], [-0.5, B0 + 2.05, 0.05], 0.11); limb([-0.5, B0 + 2.05, 0.05], [-0.36, B0 + 2.45, 0.42], 0.1);
      add(new T.BoxGeometry(0.17, 0.26, 0.06), bronze, -0.36, B0 + 2.62, 0.45);
      limb([0.47, B0 + 2.55, 0], [0.52, B0 + 1.75, 0.12], 0.11); limb([0.52, B0 + 1.75, 0.12], [0.46, B0 + 1.45, 0.34], 0.1);
      add(new T.BoxGeometry(0.17, 0.26, 0.06), bronze, 0.46, B0 + 1.32, 0.38);
      grp.rotation.y = Math.PI;   // 북쪽(-z)을 봐요
      statueSpots.push({ x: pc.x, z: pc.z, r: 2.8 });
      landmarks.buddha = { x: pc.x, z: pc.z, y0, top: y0 + B0 + 3.6, from: pc.from, ringR: pc.r, d: pc.d };
    }
    // ---- 보현보살 코끼리상 (기사: 2001년 옛 분수 자리를 흙으로 메워 세움, 2019년 겨울 돌로 쌓은 작은 산과 개울을 더함, 졸업 때 학생들이 올라타요)
    //   자리 = OSM 점 '코끼리동상'. 흰 코끼리로 그렸어요. 크기 · 바라보는 쪽은 글에 없어 짐작했어요 (불상 쪽)
    function addElephant() {
      const s = (campus.statues || []).find((q) => /코끼리/.test(q.name)); if (!s) return;
      const { grp, y0, add } = statueGroup(s.x, s.z);
      const rock = tradMat(0x9a958a, 0x4c4f52), white = tradMat(0xf0ede4, 0xa3a9ad), water = tradMat(0x86bcd2, 0x2a4f62, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), soil = tradMat(0x86a463, 0x2e5136, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      // 옛 분수 자리: 둥근 풀밭 (반지름 4.2m)
      const N = 28, disc = [[0, 0]], dt = [];
      for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; disc.push([Math.cos(a) * 4.2, Math.sin(a) * 4.2]); if (i) dt.push(0, i + 1, i); }
      grp.add(groundSheet(s.x, s.z, y0, disc, dt, soil, 0.05));
      // 작은 개울: 돌 산 앞쪽을 반 바퀴 휘어 돌아요 (폭 0.7m)
      const st = [], si = [], M2 = 18;
      for (let i = 0; i <= M2; i++) { const a = -0.9 + i / M2 * 3.2; for (const rr of [2.75, 3.45]) st.push([Math.sin(a) * rr, Math.cos(a) * rr]); if (i) { const q = (i - 1) * 2; si.push(q, q + 1, q + 3, q, q + 3, q + 2); } }
      const stream = groundSheet(s.x, s.z, y0, st, si, water, 0.09); grp.add(stream);
      // 돌 산
      const rg = new T.IcosahedronGeometry(1, 0);
      for (const [x, y, z, sx, sy, sz, ry] of [[0, 0.35, 0, 2.1, 0.9, 1.7, 0.3], [1.3, 0.25, 0.8, 1.2, 0.7, 1.0, 1.1], [-1.4, 0.2, 0.6, 1.1, 0.6, 1.0, 2.0], [0.6, 0.2, -1.3, 1.2, 0.65, 0.9, 0.7], [-0.9, 0.3, -1.0, 1.0, 0.8, 0.9, 2.6]]) { const m = add(rg, rock, x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; }
      // 코끼리 (앞 = +z): 몸 · 다리 · 머리 · 귀 · 코 · 상아 · 꼬리
      const E = new T.Group(); E.position.y = 1.05; grp.add(E);
      const bodyG = new T.SphereGeometry(1, 16, 12); bodyG.scale(0.95, 0.8, 1.45);
      add(bodyG, white, 0, 1.75, 0, E);
      const legG = new T.CylinderGeometry(0.3, 0.33, 1.25, 10); legG.translate(0, 0.62, 0);
      for (const [x, z] of [[-0.52, 0.85], [0.52, 0.85], [-0.52, -0.85], [0.52, -0.85]]) add(legG, white, x, 0, z, E);
      add(new T.SphereGeometry(0.62, 14, 10), white, 0, 2.15, 1.55, E);
      const earG = new T.SphereGeometry(1, 10, 8); earG.scale(0.07, 0.55, 0.45);
      for (const sx of [-1, 1]) { const m = add(earG, white, sx * 0.6, 2.2, 1.3, E); m.rotation.y = sx * 0.35; }
      const trunk = new T.CatmullRomCurve3([new T.Vector3(0, 2.0, 2.05), new T.Vector3(0, 1.45, 2.35), new T.Vector3(0, 0.9, 2.35), new T.Vector3(0, 0.6, 2.55)]);
      add(new T.TubeGeometry(trunk, 16, 0.15, 8, false), white, 0, 0, 0, E);
      for (const sx of [-1, 1]) { const m = add(new T.ConeGeometry(0.06, 0.55, 8), white, sx * 0.25, 1.75, 2.15, E); m.rotation.x = 1.2; }
      const tail = add(new T.CylinderGeometry(0.04, 0.05, 0.8, 6), white, 0, 1.6, -1.45, E); tail.rotation.x = 0.3;
      const pb = landmarks.buddha; grp.rotation.y = pb ? Math.atan2(pb.x - s.x, pb.z - s.z) : 0;
      statueSpots.push({ x: s.x, z: s.z, r: 3.2 });
      landmarks.elephant = { x: s.x, z: s.z, y0, top: y0 + 1.05 + 2.77, osm: s.id };
    }
    addBuddha(); addElephant();
    // ---- 옥상 정원: 지붕 가장자리 1.6m 를 남기고 2m 칸마다 풀을 심은 화단 (가끔 우드칩), 가끔 작은 나무 (2010년 기사: 여러해살이풀 · 떨기나무 · 작은 나무 · 우드칩). 경고 색으로 칠할 때는 감춰서 지붕 색이 잘 보이게 해요
    const gardenMat = tradMat(0xffffff, 0x56655c, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), bushMat = tradMat(0x4c8538, 0x2b5434);
    const bushGeo = new T.SphereGeometry(1, 7, 5);
    for (const b of buildings) {
      if (b.bg || b.trad || !ROOF_GARDEN.test(b.name)) continue;
      const bb = bbox(b.outer), cell = 2, h = cell / 2 - 0.09, y = b.top + 0.08, pos = [], col = [], nor = [], idx = [], bush = [], r = rng(hash(b.id + 'G'));
      for (let x = bb[0] + cell / 2; x < bb[2]; x += cell) for (let z = bb[1] + cell / 2; z < bb[3]; z += cell) {
        if (!inside([x, z], b.outer) || distToRing([x, z], b.outer) < 1.6 + cell * 0.71) continue;
        const o = pos.length / 3, q = r(), c = q < 0.42 ? [0.48, 0.63, 0.34] : q < 0.84 ? [0.44, 0.6, 0.31] : [0.56, 0.5, 0.37];   // 풀 두 가지 + 우드칩 깐 자리
        pos.push(x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z + h);
        for (let k = 0; k < 4; k++) { nor.push(0, 1, 0); col.push(c[0], c[1], c[2]); }
        idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
        if (r() < 0.14) bush.push([x + (r() - 0.5) * 0.8, z + (r() - 0.5) * 0.8, 0.45 + r() * 0.45]);
      }
      if (!pos.length) continue;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const lawn = new T.Mesh(g, gardenMat); lawn.receiveShadow = true; lawn.userData = b.mesh.userData; scene.add(lawn);
      const bushes = new T.InstancedMesh(bushGeo, bushMat, Math.max(1, bush.length));
      bush.forEach(([x, z, s], i) => { LM_M.compose(LM_P.set(x, y + s * 0.55, z), LM_Q.identity(), LM_S.set(s, s * 0.75, s)); bushes.setMatrixAt(i, LM_M); });
      bushes.count = bush.length; bushes.castShadow = true; scene.add(bushes);
      b.garden = [lawn, bushes];
      landmarks.gardens.push({ id: b.id, name: b.name, cells: pos.length / 12, bushes: bush.length, top: b.top, y });
    }

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
    //      방문자가 세운 캐릭터도 같은 몸을 쓰고, 모자 · 안경 · 묶은 머리를 더해요
    const walk = buildWalkGraph(campus);
    const STU_N = Math.max(0, Math.floor(opts.studentCount ?? (SMALL ? 24 : 56)));
    // 말할 거리를 고를 장소: 이름 있는 건물(넓이로 잰 반지름)과 팔정도 · 대운동장 · 만해광장
    const talkPlaces = (campus.buildings || []).filter((b) => b.name && !b.bg).map((b) => {
      const pts = ringPts(b.outer); if (pts.length < 3) return null;
      const c = centroid(pts);
      return { x: c[0], z: c[1], r: Math.sqrt(Math.abs(area(pts)) / Math.PI), kind: placeKind(b.name), name: b.name, short: shortName(b.name) };
    }).filter(Boolean).concat((campus.labels || []).map((l) => ({ x: l.x, z: l.z, r: /운동장/.test(l.name) ? 45 : 18, kind: placeKind(l.name), name: l.name, short: l.name })));
    const crowd = walk.nodes.length >= 2 ? makeCrowd(walk, { count: STU_N, seed: opts.studentSeed || 20261107, maxTalk: SMALL ? 2 : 4, places: talkPlaces, clock: opts.clock,
      hotspots: () => [...sensors.values()].filter((s) => s.placed).map((s) => ({ x: s.site.x, z: s.site.z })) }) : null;
    const stuGroup = new T.Group(); scene.add(stuGroup);
    const avGroup = new T.Group(); scene.add(avGroup);
    const parts = [], avParts = [];
    let blob = null, avBlob = null;
    const ZERO = new T.Matrix4().makeScale(0, 0, 0);
    const stuMat = new T.MeshLambertMaterial({ color: 0xffffff });
    const box = (w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
    // 여러 도형을 하나로 합쳐요 (색이 같은 한 부분)
    function mergeGeo(list) {
      const pos = [], nor = [], idx = []; let off = 0;
      for (const g of list) {
        const P = g.attributes.position, Nn = g.attributes.normal;
        for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < P.count; i++) idx.push(i + off);
        off += P.count; g.dispose();
      }
      const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
      return out;
    }
    const torsoGeo = new T.CylinderGeometry(0.2, 0.24, 0.58, 10); torsoGeo.translate(0, 1.0, 0);
    const headGeo2 = new T.SphereGeometry(0.27, 12, 9); headGeo2.translate(0, 0.26, 0);
    const hairGeo = new T.SphereGeometry(0.292, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.56); hairGeo.rotateX(-0.3); hairGeo.translate(0, 0.275, -0.015);
    const eyeGeo = (() => { const a = new T.SphereGeometry(0.034, 6, 4), b = a.clone(); a.translate(0.088, 0.29, 0.245); b.translate(-0.088, 0.29, 0.245); return mergeGeo([a, b]); })();   // 눈 두 개 (가까이 볼 때만 보여요)
    const legGeo = box(0.15, 0.72, 0.17, 0, -0.36, 0), armGeo = box(0.11, 0.52, 0.12, 0, -0.25, 0);
    const hairBackGeo = box(0.46, 0.36, 0.12, 0, 0.13, -0.2), bagGeo = box(0.3, 0.36, 0.15, 0, 1.03, -0.215);
    const BODY = [
      ['legL', legGeo, 'pants', [0.1, 0.74, 0]], ['legR', legGeo, 'pants', [-0.1, 0.74, 0]], ['torso', torsoGeo, 'shirt', null],
      ['armL', armGeo, 'shirt', [0.285, 1.24, 0]], ['armR', armGeo, 'shirt', [-0.285, 1.24, 0]],
      ['head', headGeo2, 'skin', [0, 1.3, 0]], ['eyes', eyeGeo, 'eye', [0, 1.3, 0]], ['hair', hairGeo, 'hair', [0, 1.3, 0]],
      ['hairBack', hairBackGeo, 'hair', [0, 1.3, 0]], ['bag', bagGeo, 'bag', null],
    ];
    // 방문자 캐릭터만: 묶은 머리 · 야구 모자 · 비니 · 안경 (얼굴은 +z 쪽)
    const ponyGeo = (() => { const a = new T.SphereGeometry(0.075, 8, 6); a.translate(0, 0.37, -0.29); const b = box(0.12, 0.3, 0.1, 0, 0.2, -0.33); return mergeGeo([a, b]); })();
    const capGeo = (() => { const a = new T.SphereGeometry(0.302, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); a.rotateX(-0.1); a.translate(0, 0.3, -0.01); const b = box(0.3, 0.03, 0.22, 0, 0.33, 0.3); return mergeGeo([a, b]); })();
    const beanieGeo = (() => {
      const a = new T.SphereGeometry(0.306, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.55); a.translate(0, 0.28, -0.01);
      const b = new T.CylinderGeometry(0.315, 0.315, 0.085, 14, 1, true); b.translate(0, 0.25, -0.01);
      const c = new T.SphereGeometry(0.07, 8, 6); c.translate(0, 0.62, -0.02);
      return mergeGeo([a, b, c]);
    })();
    const glassGeo = mergeGeo([box(0.12, 0.08, 0.02, 0.088, 0.29, 0.272), box(0.12, 0.08, 0.02, -0.088, 0.29, 0.272), box(0.06, 0.016, 0.016, 0, 0.3, 0.276)]);
    const AV_BODY = BODY.concat([['pony', ponyGeo, 'hair', [0, 1.3, 0]], ['cap', capGeo, 'hat', [0, 1.3, 0]], ['beanie', beanieGeo, 'hat', [0, 1.3, 0]], ['glasses', glassGeo, 'glass', [0, 1.3, 0]]]);
    const blobMat = (() => {
      const bc = document.createElement('canvas'); bc.width = bc.height = 64;
      const bctx = bc.getContext('2d'), grd = bctx.createRadialGradient(32, 32, 2, 32, 32, 31);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); bctx.fillStyle = grd; bctx.fillRect(0, 0, 64, 64);
      return new T.MeshBasicMaterial({ map: new T.CanvasTexture(bc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -16 });
    })();
    const blobGeo = new T.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
    // InstancedMesh 는 첫 도형 자리(캠퍼스 가운데)로 화면 안팎을 따져서, 끄지 않으면 가운데가 화면 밖일 때 사람이 통째로 사라져요
    function bodyMeshes(def, group, n, out, kind) {
      for (const [name, geo, role, pivot] of def) {
        const m = new T.InstancedMesh(geo, stuMat, n); m.receiveShadow = true; m.frustumCulled = false; m.userData.kind = kind;
        group.add(m);
        out.push({ name, mesh: m, role, pivot: pivot ? new T.Vector3(pivot[0], pivot[1], pivot[2]) : null });
      }
      const b = new T.InstancedMesh(blobGeo, blobMat, n); b.renderOrder = 12; b.frustumCulled = false; group.add(b);
      return b;
    }
    if (crowd && STU_N) blob = bodyMeshes(BODY, stuGroup, STU_N, parts, 'student');
    const AV_MAX = 320;   // 공개 서버는 300명까지 받아요
    avBlob = bodyMeshes(AV_BODY, avGroup, AV_MAX, avParts, 'avatar');
    for (const p of avParts) p.mesh.count = 0;
    avBlob.count = 0;
    let studentsOn = !!crowd && STU_N > 0 && opts.students !== false;
    stuGroup.visible = studentsOn;
    let colored = false;
    const roleColor = (L, role) => (role === 'eye' ? 0x2a2522 : role === 'glass' ? 0x1f1f22 : role === 'bag' ? (L.bag || 0x333333) : role === 'hat' ? (L.hatColor || 0x333333) : L[role]);
    function colorBodies(ps, list) {
      const c = new T.Color();
      for (const part of ps) {
        list.forEach((n, i) => part.mesh.setColorAt(i, c.setHex(roleColor(n.look, part.role))));
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
    // 멀리서 볼수록 사람을 크게 그려요 (가까이 보면 1.15배, 245m 넘게 멀리서 보면 3배까지) → 캠퍼스 전체를 볼 때도 걷는 모습이 보여요
    const visScale = () => Math.max(1.15, Math.min(3, 0.55 + camera.position.distanceTo(controls.target) / 100));
    // 흡연 의심(SMOKE)인 센서 둘레만 냄새 구역이에요. 판단 보류(수증기일 수 있음) · 공기 변화에는 반응하지 않아요
    const smokeZones = () => { const z = []; for (const s of sensors.values()) if (s.state === 'SMOKE' && s.placed) z.push({ id: s.site.id, x: s.site.x, z: s.site.z, r: s.R + 10 }); return z; };
    const POSE0 = () => ({ legL: 0, legR: 0, armLx: 0, armLz: 0.06, armRx: 0, armRz: -0.06, head: 0, yaw: 0, bob: 0, lean: 0 });
    const NOSE = (p, t) => { p.armRx = -2.45; p.armRz = -0.5; p.armLx = -0.35; p.armLz = 0.25; p.head = -0.12; p.lean = -0.1; p.bob = Math.abs(Math.sin(t * 9)) * 0.02; };   // 코 막기
    const WAVE = (p, t) => { p.armRx = -2.75; p.armRz = -0.3 + 0.32 * Math.sin(t * 11); };   // 손 흔들기
    function poseOf(n, t) {
      const p = POSE0(), now = crowd.time;
      if (n.mode === 'walk') {
        const A = n.fast ? 0.62 : 0.45, s = Math.sin(n.phase);
        p.legL = A * s; p.legR = -A * s; p.armLx = -0.8 * A * s; p.armRx = 0.8 * A * s; p.bob = Math.abs(Math.cos(n.phase)) * 0.035;
        if (n.fast && n.say && n.say.kind === 'smell') { p.armRx = -2.45; p.armRz = -0.5; }   // 달아나면서도 코를 막아요
        else if (n.wave > now) WAVE(p, t);
        else if (n.call > now) { p.armRx = -2.55; p.armRz = -0.2; p.head = 0.05; }   // 걸으며 전화: 오른손을 귀에
      } else if (n.mode === 'react') NOSE(p, t);
      else if (n.mode === 'chat') {
        p.armLx = -0.35 + 0.25 * Math.sin(t * 3 + n.id); p.head = 0.08 * Math.sin(t * 2.3 + n.id);
        if (n.say && n.say.kind === 'talk' && now - n.say.at < 2.2) { p.armRx = -0.55 + 0.35 * Math.sin(t * 5 + n.id); p.armRz = -0.15; p.head += 0.06; }   // 말하는 쪽은 손짓을 해요
      } else if (n.say && n.say.kind === 'think') { p.armRx = -2.0; p.armRz = -0.75; p.armLx = -0.5; p.armLz = 0.2; p.head = 0.14; }   // 생각: 턱에 손
      else if (n.pose === 'phone') {   // 휴대폰 보기
        p.armRx = -1.25; p.armRz = -0.3; p.armLx = -0.9; p.armLz = 0.32; p.head = 0.32;
      } else p.head = 0.05 * Math.sin(t * 0.7 + n.id);
      return p;
    }
    const Mroot = new T.Matrix4(), Mloc = new T.Matrix4(), Mout = new T.Matrix4(), E1 = new T.Euler(), E2 = new T.Euler();
    const FOOT = 0.14, UP = new T.Vector3(0, 1, 0);
    const Q1 = new T.Quaternion(), Q2 = new T.Quaternion(), V1 = new T.Vector3(), V2 = new T.Vector3(), ONE = new T.Vector3(1, 1, 1);
    // 한 사람(i 번째)의 몸 부분 자리를 정해요
    function drawBody(ps, bl, i, x, z, h, p, vis, L) {
      const y = hMesh(x, z);
      Q1.setFromEuler(E1.set(p.lean, h, 0, 'YXZ'));
      Mroot.compose(V1.set(x, y + FOOT + p.bob * vis, z), Q1, V2.set(vis, vis, vis));
      for (const part of ps) {
        let ax = 0, az = 0, ay = 0, hide = false;
        switch (part.name) {
          case 'legL': ax = p.legL; break;
          case 'legR': ax = p.legR; break;
          case 'armL': ax = p.armLx; az = p.armLz; break;
          case 'armR': ax = p.armRx; az = p.armRz; break;
          case 'head': case 'hair': case 'eyes': ax = p.head; ay = p.yaw; break;
          case 'hairBack': ax = p.head; ay = p.yaw; hide = !L.long; break;
          case 'pony': ax = p.head; ay = p.yaw; hide = !L.pony; break;
          case 'cap': ax = p.head; ay = p.yaw; hide = L.hat !== 1; break;
          case 'beanie': ax = p.head; ay = p.yaw; hide = L.hat !== 2; break;
          case 'glasses': ax = p.head; ay = p.yaw; hide = !L.glasses; break;
          case 'bag': hide = !L.bag; break;
          default: break;
        }
        if (hide) { part.mesh.setMatrixAt(i, ZERO); continue; }
        if (part.pivot) { Q2.setFromEuler(ay ? E2.set(ax, ay, az, 'YXZ') : E2.set(ax, 0, az, 'ZYX')); Mloc.compose(part.pivot, Q2, ONE); Mout.multiplyMatrices(Mroot, Mloc); part.mesh.setMatrixAt(i, Mout); }
        else part.mesh.setMatrixAt(i, Mroot);
      }
      const gx = hAt(x - 1, z) - hAt(x + 1, z), gz = hAt(x, z - 1) - hAt(x, z + 1);
      Q2.setFromUnitVectors(UP, V2.set(gx, 2, gz).normalize());
      Mout.compose(V1.set(x, y + 0.18, z), Q2, V2.set(0.95 * vis, 1, 0.95 * vis)); bl.setMatrixAt(i, Mout);
    }
    const bodyDone = (ps, bl) => { for (const part of ps) part.mesh.instanceMatrix.needsUpdate = true; bl.instanceMatrix.needsUpdate = true; };
    function drawStudents(vis, t) {
      const list = crowd.npcs;
      if (!colored && list.length) { colorBodies(parts, list); colored = true; }
      for (let i = 0; i < list.length; i++) { const n = list[i]; drawBody(parts, blob, i, n.rx, n.rz, n.h, poseOf(n, t), vis, n.look); }
      bodyDone(parts, blob);
    }

    // ---- 방문자 캐릭터 그리기 · 세우기
    let avs = [];   // [{ key, look(번호), L(색), nick, x, z, h, mine, yaw, seed }]
    const avState = (key) => (crowd ? crowd.avatars.find((a) => a.key === key) : null);
    function setAvatarsNow(list) {
      const old = new Map(avs.map((a) => [a.key, a]));
      avs = (list || []).filter((a) => a && a.key !== undefined && Number.isFinite(a.x) && Number.isFinite(a.z)).slice(0, AV_MAX).map((a) => ({
        key: String(a.key), look: (a.look || []).slice(), L: lookColors(a.look), nick: String(a.nick || ''), x: a.x, z: a.z, h: Number.isFinite(a.h) ? a.h : 0,
        mine: !!a.mine, yaw: old.has(String(a.key)) ? old.get(String(a.key)).yaw : 0, seed: (hash(String(a.key)) % 1000) / 100 }));
      if (crowd) crowd.setAvatars(avs.map((a) => ({ key: a.key, x: a.x, z: a.z, h: a.h, nick: a.nick })));
      for (const p of avParts) p.mesh.count = avs.length;
      avBlob.count = avs.length;
      colorBodies(avParts, avs.map((a) => ({ look: a.L })));
    }
    function avPose(a, t, dt) {
      const p = POSE0(), st = avState(a.key), now = crowd ? crowd.time : 0;
      if (st && st.react) NOSE(p, t);
      else if (st && now >= st.waveFrom && now < st.waveUntil) { WAVE(p, t); p.head = 0.04; }
      else { p.armLx = 0.05 * Math.sin(t * 1.1 + a.seed); p.head = 0.04 * Math.sin(t * 0.7 + a.seed); p.bob = 0.006 * (1 + Math.sin(t * 2 + a.seed)); }   // 숨 쉬듯 살짝
      // 가까이 걷는 학생 쪽으로 고개를 돌려요 (몸 방향에서 ±1.1 라디안까지)
      const want = st && st.watch !== null && !st.react ? Math.max(-1.1, Math.min(1.1, angDiff(st.watch, a.h))) : 0;
      a.yaw += (want - a.yaw) * Math.min(1, dt * 3);
      p.yaw = a.yaw;
      return p;
    }
    function drawAvatars(vis, t, dt) {
      for (let i = 0; i < avs.length; i++) { const a = avs[i]; drawBody(avParts, avBlob, i, a.x, a.z, a.h, avPose(a, t, dt), vis, a.L); }
      if (avs.length) bodyDone(avParts, avBlob);
    }
    // 서 있을 수 있는 자리인지: 캠퍼스 네모 안 · 건물과 물 밖 · 다른 캐릭터와 1.1m 넘게. 걷는 길 가운데면 길 옆으로 비켜 세워요 (학생이 몸을 뚫고 지나가지 않게)
    const bldRings = (campus.buildings || []).map((b) => ringPts(b.outer)).filter((r) => r.length >= 3).map((r) => ({ r, bb: bbox(r) }));
    const waterRings = (campus.areas || []).filter((a) => a.k === 'water').map((a) => ringPts(a.outer)).filter((r) => r.length >= 3).map((r) => ({ r, bb: bbox(r) }));
    const ringHit = (list, x, z, pad) => list.some((q) => x > q.bb[0] - pad && x < q.bb[2] + pad && z > q.bb[1] - pad && z < q.bb[3] + pad && (inside([x, z], q.r) || (pad > 0 && distToRing([x, z], q.r) < pad)));
    function canStand(x, z, ignoreKey) {
      if (!(Number.isFinite(x) && Number.isFinite(z))) return { ok: false, why: 'out' };
      if (!(x > R.x0 + 4 && x < R.x1 - 4 && z > R.z0 + 4 && z < R.z1 - 4)) return { ok: false, why: 'out', x, z };
      if (ringHit(bldRings, x, z, 0)) return { ok: false, why: 'building', x, z };
      if (ringHit(waterRings, x, z, 0)) return { ok: false, why: 'water', x, z };
      if (statueSpots.some((s) => Math.hypot(x - s.x, z - s.z) < s.r)) return { ok: false, why: 'statue', x, z };
      let px = x, pz = z, nearE = null, nearD = 25;
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (const e of walk.edges) {
          const A = walk.nodes[e.a], B = walk.nodes[e.b], need = e.lane + 0.7;
          if (Math.min(A.x, B.x) - need > px || Math.max(A.x, B.x) + need < px || Math.min(A.z, B.z) - need > pz || Math.max(A.z, B.z) + need < pz) continue;
          const si = segInfo([px, pz], [A.x, A.z], [B.x, B.z]);
          if (si.d >= need) continue;
          const cx = A.x + (B.x - A.x) * si.t, cz = A.z + (B.z - A.z) * si.t;
          let ux = px - cx, uz = pz - cz, L = Math.hypot(ux, uz);
          if (L < 1e-3) { const ex = B.x - A.x, ez = B.z - A.z, el = Math.hypot(ex, ez) || 1; ux = -ez / el; uz = ex / el; L = 1; }   // 한가운데면 길의 왼쪽으로
          px = cx + ux / L * (need + 0.02); pz = cz + uz / L * (need + 0.02); moved = true;
        }
        if (!moved) break;
        if (pass === 3) return { ok: false, why: 'path', x, z };
      }
      if (ringHit(bldRings, px, pz, 0.45) || ringHit(waterRings, px, pz, 0.3)) return { ok: false, why: 'path', x, z };
      if (statueSpots.some((s) => Math.hypot(px - s.x, pz - s.z) < s.r + 0.3)) return { ok: false, why: 'statue', x, z };
      for (const a of avs) if (a.key !== ignoreKey && Math.hypot(a.x - px, a.z - pz) < 1.1) return { ok: false, why: 'crowded', x: px, z: pz };
      for (const e of walk.edges) {   // 가장 가까운 길을 바라보게 세워요 (지나가는 학생을 볼 수 있게)
        const A = walk.nodes[e.a], B = walk.nodes[e.b];
        if (Math.min(A.x, B.x) - nearD > px || Math.max(A.x, B.x) + nearD < px || Math.min(A.z, B.z) - nearD > pz || Math.max(A.z, B.z) + nearD < pz) continue;
        const si = segInfo([px, pz], [A.x, A.z], [B.x, B.z]);
        if (si.d < nearD) { nearD = si.d; nearE = [A.x + (B.x - A.x) * si.t, A.z + (B.z - A.z) * si.t]; }
      }
      const h = nearE ? Math.atan2(nearE[0] - px, nearE[1] - pz) : Math.atan2(camera.position.x - px, camera.position.z - pz);
      return { ok: true, x: Math.round(px * 100) / 100, z: Math.round(pz * 100) / 100, h: Math.round(h * 100) / 100, moved: Math.hypot(px - x, pz - z) > 0.01 };
    }
    // 세울 자리 고르기: 마우스를 따라 반투명 캐릭터가 움직이고, 발밑 고리가 초록(세울 수 있음) · 빨강(안 됨)으로 보여요
    const ghost = new T.Group(); ghost.visible = false; scene.add(ghost);
    const ghostMats = [];
    for (const [name, geo, role, pivot] of AV_BODY) {
      const m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
      m.userData = { name, role, pivot }; ghost.add(m); ghostMats.push(m);
    }
    const ghostRing = new T.Mesh(new T.RingGeometry(0.55, 0.85, 28), new T.MeshBasicMaterial({ color: 0x2f9e44, transparent: true, opacity: 0.9, depthTest: false }));
    ghostRing.rotation.x = -Math.PI / 2; ghostRing.renderOrder = 20; ghost.add(ghostRing);
    let placing = null;   // { look, key, cb }
    function dressGhost(look) {
      const L = lookColors(look), c = new T.Color();
      for (const m of ghostMats) {
        const { name, role, pivot } = m.userData;
        m.material.color.copy(c.setHex(roleColor(L, role)));
        m.visible = !((name === 'hairBack' && !L.long) || (name === 'pony' && !L.pony) || (name === 'cap' && L.hat !== 1) || (name === 'beanie' && L.hat !== 2) || (name === 'glasses' && !L.glasses) || (name === 'bag' && !L.bag));
        m.position.set(pivot ? pivot[0] : 0, pivot ? pivot[1] : 0, pivot ? pivot[2] : 0);
      }
    }
    function moveGhost(x, z, okk, h) {
      const vis = visScale();
      ghost.position.set(x, hMesh(x, z) + FOOT, z); ghost.rotation.y = h || 0; ghost.scale.set(vis, vis, vis);
      ghostRing.material.color.setHex(okk ? 0x2f9e44 : 0xe03131); ghostRing.position.y = 0.06 / vis;
      ghost.visible = true;
    }
    // 화면의 한 점(clientX, clientY) 아래 땅 (건물 · 나무를 지나 땅에 닿는 곳)
    function groundUnder(cx, cy) { setRay({ clientX: cx, clientY: cy }); const hit = ray.intersectObject(ground, false)[0]; return hit ? hit.point : null; }
    function placeTry(cx, cy, commit) {
      const p = groundUnder(cx, cy); if (!p) return null;
      const r = canStand(p.x, p.z, placing.key);
      moveGhost(r.ok ? r.x : p.x, r.ok ? r.z : p.z, r.ok, r.ok ? r.h : 0);
      if (commit) {
        if (r.ok) { const cb = placing.cb; stopPlacing(); cb({ ok: true, x: r.x, z: r.z, h: r.h, moved: r.moved }); }
        else if (placing.cb) placing.cb({ ok: false, why: r.why });
      }
      return r;
    }
    function stopPlacing() { placing = null; ghost.visible = false; wrap.classList.remove('m3-placing'); }

    // 말풍선 (이름표 층 위). 냄새 반응은 늘, 잡담 · 혼잣말은 600m 안에서 볼 때만 보여요 (360m 넘게 멀면 두 개까지).
    //   센서 · 건물 이름표나 다른 말풍선과 겹치면 조금 위로 올리고, 그래도 자리가 없으면 잡담은 숨겨요
    const bubbles = new Map();
    const bv = new T.Vector3();
    // 건물 뒤에 가린 사람인지 (0.25초마다 한 번씩 봐요): 잡담 말풍선은 숨기고, 냄새 반응은 흐리게 보여요
    const occRay = new T.Raycaster(), occDir = new T.Vector3(), headP = new T.Vector3();
    const bldObjs = buildings.flatMap((b) => b.occ || [b.mesh]);
    function behindBuilding(x, y, z) {
      headP.set(x, y, z); occDir.subVectors(headP, camera.position);
      const L = occDir.length(); if (L < 1) return false;
      occRay.set(camera.position, occDir.divideScalar(L)); occRay.far = L - 0.8;
      return occRay.intersectObjects(bldObjs, false).length > 0;
    }
    function bubbleFor(key) {
      let b = bubbles.get(key);
      if (!b) { const el = document.createElement('div'); el.className = 'm3-say'; el.setAttribute('aria-hidden', 'true'); el.style.display = 'none'; overlay.appendChild(el); b = { el, text: '', at: -1, w: 0, h: 0 }; bubbles.set(key, b); }
      return b;
    }
    let labelBoxes = [];   // placeLabels 가 그린 센서 · 건물 이름표 자리
    function placeBubbles(vis) {
      const camD = camera.position.distanceTo(controls.target), near = camD < 600, now = performance.now();
      const cap = camD < 360 ? Infinity : 2;
      const want = [];
      if (studentsOn && crowd) for (const n of crowd.npcs) if (n.say && (n.say.kind === 'smell' || near)) want.push({ key: 'n' + n.id, x: n.rx, z: n.rz, say: n.say });
      if (crowd) for (const a of crowd.avatars) if (a.say && (a.say.kind === 'smell' || near)) want.push({ key: 'a' + a.key, x: a.x, z: a.z, say: a.say });
      for (const w of want) { w.gy = hMesh(w.x, w.z) + FOOT; bv.set(w.x, w.gy + 2.0 * vis + 0.6, w.z); w.d = bv.distanceTo(camera.position); w.p = bv.project(camera).clone(); }
      want.sort((a, b) => (a.say.kind === 'smell' ? 0 : 1) - (b.say.kind === 'smell' ? 0 : 1) || a.d - b.d);   // 냄새 반응 먼저, 그다음 가까운 사람부터
      const taken = labelBoxes.slice(), keep = new Set();
      let talk = 0;
      for (const w of want) {
        const pr = w.p, smell = w.say.kind === 'smell';
        if (!(pr.z < 1 && pr.x > -1.1 && pr.x < 1.1 && pr.y > -1.1 && pr.y < 1.1)) continue;
        if (!smell && talk >= cap) continue;
        const b = bubbleFor(w.key);
        if (!b.chk || now - b.chk > 250 || b.at !== w.say.at) { b.chk = now; b.behind = behindBuilding(w.x, w.gy + 1.55 * vis, w.z); }
        if (b.behind && !smell) continue;
        if (b.text !== w.say.text || b.at !== w.say.at) {   // 새 말: 글자를 바꾸고 톡 튀어나오게
          b.text = w.say.text; b.at = w.say.at; b.el.textContent = w.say.text;
          b.el.className = 'm3-say' + (smell ? ' smell' : w.say.kind === 'think' ? ' think' : '');
          b.el.style.display = ''; b.w = b.el.offsetWidth; b.h = b.el.offsetHeight;
          b.el.classList.add('pop');
        }
        const x = (pr.x + 1) / 2 * VW, y = (1 - pr.y) / 2 * VH;
        let lift = 0;
        for (let k = 0; k < 4; k++) {
          const bx = [x - b.w / 2 - 2, y - lift - b.h - 8, x + b.w / 2 + 2, y - lift];
          const hit = taken.find((q) => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3]));
          if (!hit) break;
          lift = y - hit[1] + 2;
          if (lift > 46) break;
        }
        if (lift > 46 && !smell) continue;
        taken.push([x - b.w / 2 - 2, y - lift - b.h - 8, x + b.w / 2 + 2, y - lift]);
        keep.add(w.key); if (!smell) talk++;
        b.el.classList.toggle('behind', !!b.behind);
        b.el.classList.toggle('lift', lift > 6);
        b.el.style.display = '';
        b.el.style.transform = `translate(${x.toFixed(1)}px, ${(y - lift).toFixed(1)}px) translate(-50%, -100%)`;
      }
      for (const [k, b] of bubbles) if (!keep.has(k) && b.el.style.display !== 'none') b.el.style.display = 'none';
    }
    // 방문자 캐릭터 이름표: 320m 안에서 볼 때, 내 캐릭터(나)는 늘, 다른 사람 캐릭터는 가까운 20개까지
    const avLabels = new Map();
    function placeAvatarLabels(vis) {
      const camD = camera.position.distanceTo(controls.target), keep = new Set();
      if (camD < 320 && avs.length) {
        const cand = avs.map((a) => { bv.set(a.x, hMesh(a.x, a.z) + FOOT + 1.95 * vis + 0.15, a.z); return { a, d: bv.distanceTo(camera.position), p: bv.project(camera).clone() }; })
          .filter((q) => q.p.z < 1 && q.p.x > -1.05 && q.p.x < 1.05 && q.p.y > -1.05 && q.p.y < 1.05)
          .sort((p, q) => (q.a.mine ? 1 : 0) - (p.a.mine ? 1 : 0) || p.d - q.d);
        let others = 0;
        for (const q of cand) {
          if (!q.a.mine && ++others > 20) continue;
          let el = avLabels.get(q.a.key);
          if (!el) { el = document.createElement('div'); el.className = 'm3-av'; el.setAttribute('aria-hidden', 'true'); overlay.appendChild(el); avLabels.set(q.a.key, el); }
          const html = (q.a.mine ? '<b>나</b>' : '') + esc(q.a.nick || '방문자');
          if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.classList.toggle('mine', q.a.mine); el._w = el.offsetWidth; el._h = el.offsetHeight; }
          const x = (q.p.x + 1) / 2 * VW, y = (1 - q.p.y) / 2 * VH;
          el.style.display = '';
          el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
          labelBoxes.push([x - (el._w || 60) / 2 - 2, y - (el._h || 18) - 2, x + (el._w || 60) / 2 + 2, y + 2]);
          keep.add(q.a.key);
        }
      }
      for (const [k, el] of avLabels) if (!keep.has(k)) { if (el.style.display !== 'none') el.style.display = 'none'; if (!avs.some((a) => a.key === k)) { el.remove(); avLabels.delete(k); } }
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
      // (x, z) 에 선 사람을 건물 · 나무가 가리지 않는 쪽에서 봐요. theta0(사람이 바라보는 쪽, 얼굴이 보여요)부터 30° 씩 돌려 가며 찾아요
      viewClear(x, z, dist, phi, theta0) {
        const block = bldObjs.concat([crowns]);
        phi = Math.max(0.2, Math.min(controls.maxPolarAngle, phi ?? 0.95));
        const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist ?? 30));
        const th0 = Number.isFinite(theta0) ? theta0 : HOME.theta;
        const tgt = new T.Vector3(x, hMesh(x, z) + 1.2, z), cam = new T.Vector3(), dir = new T.Vector3(), rc = new T.Raycaster();
        for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) {
          const th = th0 + k * Math.PI / 6;
          for (const ph of [phi, Math.max(0.3, phi - 0.35)]) {   // 옆에서 막히면 조금 더 위에서
            cam.set(x + d * Math.sin(ph) * Math.sin(th), hAt(x, z) + d * Math.cos(ph), z + d * Math.sin(ph) * Math.cos(th));
            const L = dir.subVectors(tgt, cam).length();
            rc.set(cam, dir.divideScalar(L)); rc.far = L - 0.6;
            if (!rc.intersectObjects(block, false).length) { api.viewAt(x, z, d, th, ph); return { theta: th, phi: ph, dist: d }; }
          }
        }
        api.viewAt(x, z, d, th0, 0.25);   // 사방이 막혔으면 거의 위에서 봐요
        return null;
      },
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
        studentsOn = !!on && !!crowd && STU_N > 0; stuGroup.visible = studentsOn;
        if (crowd) crowd.setNpcsOn(studentsOn);
        if (!studentsOn) for (const [k, b] of bubbles) if (k[0] === 'n') b.el.style.display = 'none';
      },
      studentsOn: () => studentsOn,
      students: () => ({
        on: studentsOn, count: crowd ? crowd.count : 0, nodes: walk.nodes.length, edges: walk.edges.length, length_m: Math.round(walk.length),
        zones: crowd ? crowd.zones.map((q) => q.id) : [], time: crowd ? +crowd.time.toFixed(1) : 0,
        list: crowd ? crowd.npcs.map((n) => ({ x: +n.rx.toFixed(2), z: +n.rz.toFixed(2), mode: n.mode, fast: n.fast, say: n.say ? n.say.text : null, reacts: n.reacts })) : [],
        bubbles: [...bubbles.values()].filter((b) => b.el.style.display !== 'none').map((b) => b.el.textContent),
        says: crowd ? crowd.npcs.filter((n) => n.say).map((n) => ({ id: n.id, text: n.say.text, kind: n.say.kind })) : [],
        bubbleEls: [...bubbles].filter(([, b]) => b.el.style.display !== 'none').map(([k, b]) => ({ key: k, text: b.el.textContent, cls: b.el.className })),
      }),
      // 방문자 캐릭터: list = [{ key, look: [번호 9개], nick: '졸린 코끼리', x, z, h, mine }]
      setAvatars(list) { setAvatarsNow(list); },
      avatars: () => avs.map((a) => {
        const st = avState(a.key), lab = avLabels.get(a.key);
        return { key: a.key, x: a.x, z: a.z, h: a.h, mine: a.mine, nick: a.nick, look: a.look.slice(), say: st && st.say ? st.say.text : null, react: !!(st && st.react),
                 waving: !!(st && crowd && crowd.time >= st.waveFrom && crowd.time < st.waveUntil), greeted: st ? st.greeted : 0, label: !!(lab && lab.style.display !== 'none') };
      }),
      canStand: (x, z, ignoreKey) => canStand(x, z, ignoreKey),
      // 세울 자리 고르기: 땅을 누르면 cb({ ok, x, z, h }) 또는 cb({ ok: false, why }) (why: out · building · water · path · crowded · cancel)
      startPlacing(look, key, cb) { placing = { look: (look || []).slice(), key: key ?? null, cb }; dressGhost(look); wrap.classList.add('m3-placing'); hover = null; },
      cancelPlacing() { if (placing) { const cb = placing.cb; stopPlacing(); if (cb) cb({ ok: false, why: 'cancel' }); } },
      isPlacing: () => !!placing,
      // 땅 위 (x, z) 가 페이지에서 어디에 보이는지 (화면 밖이면 null)
      screenOf(x, z, lift) {
        bv.set(x, hMesh(x, z) + (lift || 0), z).project(camera);
        if (!(bv.z < 1 && Math.abs(bv.x) <= 1 && Math.abs(bv.y) <= 1)) return null;
        const r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + (bv.x + 1) / 2 * r.width, y: r.top + (1 - bv.y) / 2 * r.height };
      },
      walkGraph: () => walk,
      // 시험용 손잡이
      _test: {
        // i 번 학생을 센서 id 에서 maxD m 안의 가장 가까운 길 마디에 세워요
        near(i, id, maxD) { const s = sensors.get(id); if (!crowd || !s) return false; const k = crowd.nearestNode(s.site.x, s.site.z, maxD ?? 20); return k >= 0 && crowd.place(i, k, 30); },
        // 화면 그리기를 기다리지 않고 sec 초만큼 움직여요
        run(sec) { if (!crowd) return; crowd.setZones(smokeZones()); for (let k = 0; k < Math.round(sec / 0.1); k++) crowd.step(0.1, visScale()); },
        // 떠 있는 말풍선을 모두 지워요
        quiet() { if (crowd) crowd.quiet(); },
        crowd: () => crowd,
        landmarks: () => Object.assign({}, landmarks, { gardens: landmarks.gardens.map((g) => { const b = buildings.find((q) => q.id === g.id); return Object.assign({}, g, { visible: !!(b && b.garden && b.garden[0].visible), tint: (b && b.tint) || null }); }) }),
        skinOf: (id) => { const b = buildings.find((q) => q.id === id); return b ? { skin: b.skin || null, stone: !!b.wall.map && (b.wall.map === stDay || b.wall.map === stLit), wall: b.wall.color.getHex(), tint: b.tint || null } : null; },
        roofBoxes: () => roofBoxes.map((q) => [q[0], q[2]]),
        statueSpots: () => statueSpots.map((s) => Object.assign({}, s)),
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
        const wallC = new T.Color(b.trad ? pal.tradWall : b.bg ? pal.wallBg : b.skin === 'stone' ? pal.stoneWall : pal.wall), roofC = new T.Color(b.trad ? pal.tradRoof : b.bg ? pal.roofBg : (b.alt ? pal.roofAlt : pal.roof));
        if (st) {
          const col = colorFor(st);
          b.wall.color.copy(wallC.lerp(col, 0.6)); b.roof.color.copy(roofC.lerp(col, 0.85));
          b.roof.emissive.copy(col).multiplyScalar(night ? 0.4 : 0.14); b.wall.emissive.copy(col).multiplyScalar(night ? 0.18 : 0.05);
        } else {
          b.wall.color.copy(wallC); b.roof.color.copy(roofC); b.roof.emissive.set(0); b.wall.emissive.set(0);
        }
        b.tint = st;
        if (b.garden) for (const m of b.garden) m.visible = !st;   // 경고 색이면 옥상 정원을 감춰 지붕 색이 보이게
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
      if (stDay) stDay.dispose(); if (stLit) stLit.dispose();
      stDay = stoneTexture(p, false); stLit = p.litTop ? stoneTexture(p, true) : null;
      for (const b of buildings) { if (b.trad) continue; b.wall.map = b.skin === 'stone' ? ((stLit && b.lit) ? stLit : stDay) : (texLit && b.lit && !b.bg) ? texLit : texDay; b.wall.needsUpdate = true; }
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
      labelBoxes = taken;
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
      const vis = visScale();
      if (crowd && (studentsOn || avs.length)) {
        crowd.setZones(smokeZones());
        // 보이는 곳: 카메라가 보는 땅 둘레. 잡담 말풍선은 이 안에서 4개(휴대폰 2개)까지 띄워요
        crowd.setFocus(controls.target.x, controls.target.z, Math.max(40, Math.min(700, camera.position.distanceTo(controls.target) * 0.75)));
        crowd.step(dt, vis);
        if (studentsOn && STU_N) drawStudents(vis, t);
      }
      if (avs.length) drawAvatars(vis, t, dt);
      if (placing && hover) { placeTry(hover.x, hover.y, false); hover = null; }
      if (now - shadowAt > 100) { renderer.shadowMap.needsUpdate = true; shadowAt = now; }
      renderer.render(scene, camera);
      placeLabels();
      placeAvatarLabels(vis);
      placeBubbles(vis);
    }
    raf = requestAnimationFrame(frame);

    // ---- 누르기 · 끌어 옮기기 (끌기는 '핀 위치 옮기기'를 켰을 때만)
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    let down = null, dragging = null, hover = null;
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
      if (placing && e.pointerType !== 'touch') hover = { x: e.clientX, y: e.clientY };   // 다음 장면에서 반투명 캐릭터를 옮겨요
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
      if (placing) {   // 캐릭터 세우기: 끌지 않고 누른 곳에 세워요 (끌면 지도가 움직여요)
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) placeTry(e.clientX, e.clientY, true);
        down = null; return;
      }
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && !editing) {
        const id = sensorHit(e);
        if (id && api.onSelect) api.onSelect(id);
      }
      down = null;
    });
    renderer.domElement.addEventListener('pointercancel', () => { wrap.classList.remove('m3-grabbing'); endDrag(); });
    renderer.domElement.addEventListener('pointerleave', () => { if (placing) ghost.visible = false; });
    return api;
  }

  root.AirfaroMap3D = { create, PALETTE, buildWalkGraph, makeCrowd, placeKind, shortName, timeKind, AVATAR, lookOk, nickOk, nickName, lookColors, CHAT: { TALK, THINK, ARRIVE, PASS, CALL, GREET, SMELL_TEXT } };
})(typeof window !== 'undefined' ? window : globalThis);
