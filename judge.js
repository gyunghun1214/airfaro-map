// AIRFARO MAP 웹 판단 (judge.js)
// S_collector.html의 '웹 판단'(RULE · newJudge · finishLearn · judgeLine)을 그대로 옮겨,
// 지점마다 따로 계산할 수 있게 묶었어요. 규칙을 바꾸면 수집 페이지와 장치 코드도 같이 바꿔야 해요.
// 브라우저(<script src="judge.js">)와 Node(require)에서 함께 써요. 실물 검증 전이에요.
(function (root) {
  'use strict';
  const RULE = {
    WAIT_S: 240, LEARN_FROM_S: 180, DUST_MIN: 50, GAS_MIN: 40, NOISE_K: 4,
    CONFIRM_LINES: 5, PAIR_S: 90, CLEAR_LINES: 10, HUM_JUMP: 8, STUCK_LINES: 3,
    NO_DATA_S: 30, FIRST_LINE_S: 15, FOLLOW_QUIET_S: 600, FOLLOW_SLOW_S: 3600,
  };
  const STATES = {
    NONE: ['연결 전', '#adb5bd'], WAIT: ['기준 측정 전', '#868e96'], CALM: ['평상시 범위', '#2f9e44'],
    CHANGED: ['공기 변화', '#e0a800'], HOLD: ['판단 보류', '#7048e8'], SMOKE: ['흡연 의심', '#e03131'],
    FAULT: ['센서 점검', '#495057'], NODATA: ['수신 없음', '#adb5bd'],
  };
  const half = (th) => Math.floor(th / 2);

  function newJudge() {
    return { phase: 'wait', t0: null, lastT: null, learn: [], baseD: 0, baseG: 0,
             thD: RULE.DUST_MIN, thG: RULE.GAS_MIN, dD: 0, dG: 0,
             highD: false, highG: false, nD: 0, nG: 0, startD: 0, startG: 0, quietD: 0, quietG: 0,
             lowRun: 0, stuck: 0, hum: [], humJump: false, state: 'WAIT' };
  }

  function finishLearn(J, r) {
    const L = J.learn.length ? J.learn : [[r.dust, r.gas]];
    const n = L.length;
    const mD = L.reduce((a, v) => a + v[0], 0) / n, mG = L.reduce((a, v) => a + v[1], 0) / n;
    const sD = Math.sqrt(L.reduce((a, v) => a + (v[0] - mD) ** 2, 0) / n);
    const sG = Math.sqrt(L.reduce((a, v) => a + (v[1] - mG) ** 2, 0) / n);
    J.baseD = mD; J.baseG = mG;
    J.thD = Math.max(RULE.DUST_MIN, Math.round(RULE.NOISE_K * sD));
    J.thG = Math.max(RULE.GAS_MIN, Math.round(RULE.NOISE_K * sG));
  }

  // 한 줄(r = {dust, gas, humidity})과 받은 시각 t(초)를 넣으면, 바뀐 판단 상태 J를 돌려줘요.
  function judgeLine(J, r, t) {
    if (J.lastT !== null && t - J.lastT > RULE.NO_DATA_S) J = newJudge();
    if (J.t0 === null) J.t0 = t;
    const dt = J.lastT === null ? 2 : Math.min(10, Math.max(0, t - J.lastT));
    J.lastT = t;
    if (r.humidity !== null) J.hum.push([t, r.humidity]);
    while (J.hum.length && t - J.hum[0][0] > 60) J.hum.shift();
    J.humJump = r.humidity !== null && r.humidity - Math.min(...J.hum.map((h) => h[1])) >= RULE.HUM_JUMP;

    const stuck = r.dust >= 4880 || r.dust <= 10 || r.gas <= 2 || r.gas >= 1021;
    J.stuck = stuck ? J.stuck + 1 : 0;
    if (J.phase === 'fault') {
      if (stuck) return J;
      const keep = J.hum;
      J = newJudge(); J.hum = keep; J.t0 = t - RULE.LEARN_FROM_S; J.lastT = t;
    }
    if (J.phase === 'run' && J.stuck >= RULE.STUCK_LINES) { J.phase = 'fault'; J.state = 'FAULT'; return J; }

    const el = t - J.t0;
    if (J.phase === 'wait') {
      if (el < RULE.LEARN_FROM_S) { J.state = 'WAIT'; return J; }
      if (el < RULE.WAIT_S) { J.learn.push([r.dust, r.gas]); J.state = 'WAIT'; return J; }
      finishLearn(J, r);
      J.phase = 'run'; J.quietD = J.quietG = t; J.state = 'CALM';
    }

    J.dD = r.dust - Math.round(J.baseD);
    J.dG = r.gas - Math.round(J.baseG);
    if (J.dD < half(J.thD)) J.quietD = t;
    if (J.dG < half(J.thG)) J.quietG = t;
    if (!J.highD && J.dD > J.thD) { J.highD = true; J.nD = 0; J.startD = J.quietD; }
    if (J.highD && J.dD < half(J.thD)) J.highD = false;
    if (!J.highG && J.dG > J.thG) { J.highG = true; J.nG = 0; J.startG = J.quietG; }
    if (J.highG && J.dG < half(J.thG)) J.highG = false;
    J.nD = J.highD ? J.nD + 1 : 0;
    J.nG = J.highG ? J.nG + 1 : 0;
    const together = J.highD && J.highG && Math.abs(J.startD - J.startG) <= RULE.PAIR_S;
    const lasting = J.nD >= RULE.CONFIRM_LINES && J.nG >= RULE.CONFIRM_LINES;

    if (J.state === 'SMOKE' || J.state === 'HOLD') {
      if (J.dD < half(J.thD) && J.dG < half(J.thG)) J.lowRun++; else J.lowRun = 0;
      if (J.lowRun >= RULE.CLEAR_LINES) { J.lowRun = 0; J.state = 'CALM'; return J; }
      if (J.state === 'SMOKE' && together && lasting && J.humJump) J.state = 'HOLD';
      else if (J.state === 'HOLD' && together && lasting && !J.humJump) J.state = 'SMOKE';
      return J;
    }
    if (together && lasting) J.state = J.humJump ? 'HOLD' : 'SMOKE';
    else if (J.highD || J.highG) J.state = 'CHANGED';
    else {
      J.state = 'CALM';
      const k = (Math.abs(J.dD) < half(J.thD) && Math.abs(J.dG) < half(J.thG)) ? RULE.FOLLOW_QUIET_S : RULE.FOLLOW_SLOW_S;
      const a = Math.min(1, dt / k);
      J.baseD += (r.dust - J.baseD) * a;
      J.baseG += (r.gas - J.baseG) * a;
    }
    return J;
  }

  // 수집 페이지와 같은 검사: 맞지 않는 줄은 버려요.
  function validLine(d) {
    return d !== null && typeof d === 'object' &&
      Number.isInteger(d.dust) && d.dust >= 0 && d.dust <= 5000 &&
      Number.isInteger(d.gas) && d.gas >= 0 && d.gas <= 1023 &&
      (d.humidity === null || (Number.isInteger(d.humidity) && d.humidity >= 0 && d.humidity <= 100));
  }

  // 지점 하나의 판단기
  function create() {
    const s = { J: newJudge() };
    s.feed = (r, t) => { s.J = judgeLine(s.J, r, t); return s.J.state; };
    s.reset = () => { s.J = newJudge(); };
    return s;
  }

  const api = { RULE, STATES, newJudge, judgeLine, validLine, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AirfaroJudge = api;
})(typeof window !== 'undefined' ? window : globalThis);
