// AIRFARO MAP 공개 서버 핵심 (core.mjs) · 초안 · 실물 검증 전
// server.js 의 받기 · 판단 · 상태 만들기를 저장소(DB)와 떼어 낸 순수 함수로 옮겼어요.
// Supabase Edge Function(Deno)과 Node 시험(dev/core_parity.js)이 같은 파일을 써요.
// 판단 규칙은 judge.js 그대로예요. 규칙을 바꾸면 수집 페이지 · 장치 코드 · server.js 도 같이 바꿔야 해요.
import * as judgeModule from './judge.js';

const JUDGE = globalThis.AirfaroJudge || judgeModule.default || judgeModule;
export const { RULE, STATES, newJudge, judgeLine, validLine } = JUDGE;
export const HISTORY_S = 30 * 60;        // server.js 와 같이 30분 (DB 에서는 읽을 때 잘라요)
export const SEND_HISTORY_S = 10 * 60;   // 지도로 보내는 그래프 기록 10분
export const SITE_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

// ---------------------------------------------------------------- 받은 줄 검사 (server.js ingest 와 같은 말)
// 맞으면 null, 아니면 [상태 코드, 안내]
export function validate(b) {
  if (!b || typeof b !== 'object') return [400, '형식이 JSON 객체가 아니에요'];   // 배열은 server.js 처럼 아래 mode 검사에서 걸러요
  if (b.mode !== 'real') return [422, '실제 관측(mode: real)만 받아요. 예시 데이터는 받지 않아요'];
  if (typeof b.site_id !== 'string' || !SITE_ID_RE.test(b.site_id)) return [422, 'site_id가 맞지 않아요'];
  if (typeof b.session !== 'string' || b.session.length > 40 || !Number.isInteger(b.seq)) return [422, 'session/seq가 맞지 않아요'];
  if (!Number.isFinite(Date.parse(b.received_at))) return [422, 'received_at이 시각이 아니에요'];
  const r = lineOf(b);
  if (!validLine(r)) return [422, '값의 범위가 맞지 않아요 (dust 0~5000, gas 0~1023, humidity 0~100 또는 null)'];
  return null;
}
const lineOf = (b) => ({ dust: b.dust, gas: b.gas, humidity: b.humidity === undefined ? null : b.humidity });

// ---------------------------------------------------------------- 지점 상태 (DB 에는 jsonb 한 칸으로 둬요)
export function emptyLive() {
  return { session: null, J: newJudge(), state: null, shown: 'NODATA', last: null, last_arrival: 0, n_rx: 0 };
}

// 한 줄을 넣어요. live 는 바꾸지 않고 새 값을 돌려줘요.
// 돌려주는 것: { live, events: [{site, t, from, to}], reading: readings 표 한 줄 }
export function apply(live, b, nowMs) {
  const L = live ? JSON.parse(JSON.stringify(live)) : emptyLive();
  const events = [];
  const tMs = Date.parse(b.received_at);
  const r = lineOf(b);
  // 30초 넘게 비었다가 다시 온 줄: server.js 는 1초 타이머로 '수신 없음'을 적어요. 여기서는 다음 줄이 올 때 그 시각으로 적어요.
  if (L.last_arrival && L.shown !== 'NODATA' && nowMs - L.last_arrival > RULE.NO_DATA_S * 1000) {
    events.push({ site: b.site_id, t: L.last_arrival + RULE.NO_DATA_S * 1000, from: L.shown, to: 'NODATA' });
    L.shown = 'NODATA';
  }
  if (L.session !== b.session) { L.J = newJudge(); L.session = b.session; }   // 수집 페이지를 새로 열면 처음부터
  L.J = judgeLine(L.J, r, tMs / 1000);
  const st = L.J.state;
  L.state = st;
  L.last = { t: tMs, ...r };
  L.last_arrival = nowMs;
  L.n_rx += 1;
  if (L.shown !== st) { events.push({ site: b.site_id, t: tMs, from: L.shown, to: st }); L.shown = st; }
  const reading = {
    site_id: b.site_id, session: b.session, seq: b.seq, received_at: new Date(tMs).toISOString(),
    server_at: new Date(nowMs).toISOString(), dust: r.dust, gas: r.gas, humidity: r.humidity, web_state: st,
  };
  return { live: L, events, reading };
}

// ---------------------------------------------------------------- 지도에 보낼 모양 (server.js liveView 와 같은 칸)
// hist: [[t(ms), dust, gas, humidity, state], ...] 받은 시각 순서
export function liveView(L, hist, nowMs) {
  if (!L || !L.last) return { state: 'NODATA', never: true, n_rx: 0 };
  const J = L.J;
  const age = (nowMs - L.last_arrival) / 1000;
  const cut = L.last.t - SEND_HISTORY_S * 1000;
  return {
    state: age > RULE.NO_DATA_S ? 'NODATA' : L.state, judged: L.state, age_s: Math.round(age), n_rx: L.n_rx,
    last_at: L.last.t, dust: L.last.dust, gas: L.last.gas, humidity: L.last.humidity,
    phase: J.phase, wait_left_s: J.phase === 'wait' && J.t0 !== null ? Math.max(0, Math.ceil(J.t0 + RULE.WAIT_S - J.lastT)) : null,
    base_dust: Math.round(J.baseD), base_gas: Math.round(J.baseG), th_dust: J.thD, th_gas: J.thG,
    d_dust: J.dD, d_gas: J.dG, high_dust: J.highD, high_gas: J.highG, n_dust: J.nD, n_gas: J.nG, hum_jump: J.humJump,
    history: hist ? hist.filter((h) => h[0] >= cut) : [],
  };
}

// readings 표의 줄들을 그래프 기록 모양으로
export const histRows = (rows) => rows.map((x) => [Date.parse(x.received_at), x.dust, x.gas, x.humidity, x.web_state]);

// api/status 와 같은 모양
// config: {campus, sites:[{id,name,place,x,z,zone}]}, lives: Map(id → live), hists: Map(id → hist 줄), events: 저장된 기록(오래된 것부터)
export function statusJson({ config, lives, hists, events, nowMs, hist }) {
  const ids = new Set(config.sites.map((x) => x.id));
  const want = (id) => !hist || hist === id;
  const view = (id) => liveView(lives.get(id), want(id) ? hists.get(id) || [] : [], nowMs);
  const out = config.sites.map((c) => ({ ...c, live: view(c.id) }));
  for (const id of lives.keys()) if (!ids.has(id)) out.push({ id, name: id, place: '지도에 등록 안 된 지점', x: null, z: null, zone: null, live: view(id) });
  // 기록은 server.js 처럼 적은 순서 그대로예요 (DB 에서는 id 순서).
  // 지금 30초 넘게 비어 있는 지점은 '수신 없음' 기록을 끝에 붙여 보여 줘요 (저장은 다음 줄이 올 때)
  const late = [];
  for (const [id, L] of lives) {
    if (L && L.last_arrival && L.shown !== 'NODATA' && nowMs - L.last_arrival > RULE.NO_DATA_S * 1000) {
      late.push({ site: id, t: L.last_arrival + RULE.NO_DATA_S * 1000, from: L.shown, to: 'NODATA' });
    }
  }
  late.sort((a, b) => a.t - b.t);
  return { server: 'airfaro-map', mode: 'real', campus: config.campus, now: nowMs, rule: RULE, sites: out, events: events.concat(late).slice(-100) };
}

// 데이터베이스 함수 airfaro_snapshot() 이 돌려준 것 → api/status 와 같은 모양
// Edge Function 의 GET status 와 공개 지도(브라우저)가 같은 함수를 써요.
// snap: { campus, sites:[...], lives:[[id, live], ...](처음 받은 순서), hists:{id: [{received_at, dust, gas, humidity, web_state}]},
//         events:[{site, t(ISO), from, to}](오래된 것부터, 최근 100개), now(ms) }
export function statusFromSnapshot(snap, hist, nowMs) {
  // 데이터베이스(jsonb)는 칸 순서를 바꿔 돌려줘서, server.js 와 같은 순서로 다시 세워요
  const config = { campus: snap.campus || '', sites: (snap.sites || []).map(({ id, name, place, x, z, zone }) => ({ id, name, place, x, z, zone })) };
  const lives = new Map(snap.lives || []);
  const hists = new Map(Object.entries(snap.hists || {}).map(([id, rows]) => [id, histRows(rows)]));
  const events = (snap.events || []).map((e) => ({ site: e.site, t: Date.parse(e.t), from: e.from, to: e.to }));
  return statusJson({ config, lives, hists, events, nowMs, hist });
}

// ---------------------------------------------------------------- CSV (server.js 와 같은 머리글)
export const kstDay = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
export const CSV_HEAD = '\uFEFFsite_id,session,seq,received_at_utc,received_at_kst,server_at_utc,dust_mv,gas_adc,humidity_pct,web_state\r\n';
export function csvLine(x) {
  const t = Date.parse(x.received_at);
  return [x.site_id, x.session, x.seq, new Date(t).toISOString(), kst(t), new Date(Date.parse(x.server_at)).toISOString(),
    x.dust, x.gas, x.humidity === null ? '' : x.humidity, STATES[x.web_state][0]].join(',') + '\r\n';
}
// 한국 날짜 YYYYMMDD 하루의 UTC 범위
export function kstDayRange(day) {
  const ms = Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)) - 9 * 3600e3;
  return [new Date(ms).toISOString(), new Date(ms + 86400e3).toISOString()];
}
