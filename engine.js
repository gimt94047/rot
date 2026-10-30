"use strict";
/* 로트발트의 왕관 — 브라우저 엔진. 서버 없이 폰에서 Claude/GPT API를 직접 부른다. */

const SEASONS = ["봄", "여름", "가을", "겨울"];
const PALETTE = ["#7d5a2c", "#4a6b8a", "#8c4a2f", "#567d46", "#6d4c7d", "#9a7b2f", "#2f6d6a",
  "#a0522d", "#556b2f", "#704214", "#3d5a80", "#8b3a62"];
const SAVE_KEY = "rotwald.world.v1";
const SETTINGS_KEY = "rotwald.settings.v1";
const P = DATA.prompts;
const clone = (o) => JSON.parse(JSON.stringify(o));
const rand = Math.random;
const randint = (a, b) => a + Math.floor(rand() * (b - a + 1));
const uniform = (a, b) => a + rand() * (b - a);
const choice = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const str = (v, n) => String(v ?? "").slice(0, n);

/* ---------------- 지도 생성 ---------------- */
function _hash(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647)) >>> 0;
  h = Math.imul((h ^ (h >>> 13)) >>> 0, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 0xffff) / 65535;
}
function _vnoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = _hash(ix, iy, seed), b = _hash(ix + 1, iy, seed), c = _hash(ix, iy + 1, seed), d = _hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
function _fbm(x, y, seed, oct = 4) {
  let v = 0, amp = 1, freq = 1, tot = 0;
  for (let o = 0; o < oct; o++) { v += amp * _vnoise(x * freq, y * freq, seed + o * 17); tot += amp; amp *= 0.5; freq *= 2; }
  return v / tot;
}
function buildMap(seed = 7) {
  const W = DATA.grid_w, H = DATA.grid_h, provs = DATA.provinces;
  const grid = new Array(W * H).fill(-1), cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x + (_fbm(x / 18, y / 18, seed) - 0.5) * 16;
    const wy = y + (_fbm(x / 18 + 40, y / 18 + 40, seed) - 0.5) * 16;
    const dx = (x - cx) / (W * 0.47), dy = (y - cy) / (H * 0.46);
    const coast = Math.sqrt(dx * dx + dy * dy) + (_fbm(x / 14, y / 14, seed + 99) - 0.5) * 0.45;
    if (coast > 0.93) continue;
    let best = -1, bd = 1e9;
    provs.forEach((p, i) => { const d = (wx - p[2]) ** 2 + (wy - p[3]) ** 2; if (d < bd) { bd = d; best = i; } });
    if (bd > 900) continue;
    grid[y * W + x] = best;
  }
  const n = provs.length, adj = provs.map(() => new Set()), sx = Array(n).fill(0), sy = Array(n).fill(0), cnt = Array(n).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = grid[y * W + x]; if (p < 0) continue;
    sx[p] += x; sy[p] += y; cnt[p]++;
    for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
      if (nx < W && ny < H) { const q = grid[ny * W + nx]; if (q >= 0 && q !== p) { adj[p].add(q); adj[q].add(p); } }
    }
  }
  const geo = {};
  provs.forEach((p, i) => {
    geo[p[0]] = { idx: i, cx: cnt[i] ? +(sx[i] / cnt[i]).toFixed(1) : p[2], cy: cnt[i] ? +(sy[i] / cnt[i]).toFixed(1) : p[3],
      adj: [...adj[i]].map((j) => provs[j][0]).sort() };
  });
  return { w: W, h: H, grid, geo, order: provs.map((p) => p[0]) };
}

/* ---------------- 설정 ---------------- */
function defaultSettings() {
  const c = DATA.config;
  return { keys: { anthropic: "", openai: "" }, models: clone(c.models), pricing: clone(c.pricing_per_million),
    budget: clone(c.monthly_budget_usd), rules: clone(c.rules) };
}
function loadSettings() {
  const d = defaultSettings();
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (s) {
      d.keys = { ...d.keys, ...s.keys };
      for (const k of Object.keys(d.models)) d.models[k] = { ...d.models[k], ...(s.models?.[k] || {}) };
      d.budget = { ...d.budget, ...s.budget }; d.rules = { ...d.rules, ...s.rules };
      d.pricing = { ...d.pricing, ...s.pricing };
    }
  } catch (e) { /* 기본값 사용 */ }
  return d;
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* 무시 */ } }

/* ---------------- LLM ---------------- */
async function postJSON(url, headers, body, timeout = 240000) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body), signal: ac.signal });
      clearTimeout(t);
      if (r.ok) return await r.json();
      const msg = (await r.text()).slice(0, 500);
      last = new Error(`HTTP ${r.status}: ${msg}`);
      if ([429, 500, 502, 503, 529].includes(r.status)) { await sleep(2000 + attempt * 4000); continue; }
      throw last;
    } catch (e) {
      clearTimeout(t);
      if (e.message?.startsWith("HTTP")) throw e;
      last = new Error(e.name === "AbortError" ? "응답 시간 초과" : "네트워크 오류: " + e.message);
      await sleep(2000 + attempt * 3000);
    }
  }
  throw last;
}
async function callAnthropic(spec, key, system, user) {
  const r = await postJSON("https://api.anthropic.com/v1/messages", {
    "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true",
  }, {
    model: spec.model, max_tokens: spec.max_tokens || 1500,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const text = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const u = r.usage || {};
  return { text, usage: { inp: u.input_tokens || 0, out: u.output_tokens || 0, cache_read: u.cache_read_input_tokens || 0, cache_write: u.cache_creation_input_tokens || 0 } };
}
async function callOpenAI(spec, key, system, user) {
  const body = { model: spec.model, instructions: system, input: user, max_output_tokens: spec.max_tokens || 2000,
    text: { format: { type: "json_object" } } };
  if (spec.reasoning) body.reasoning = { effort: spec.reasoning };
  const r = await postJSON("https://api.openai.com/v1/responses", { authorization: "Bearer " + key }, body);
  let text = "";
  for (const it of r.output || []) if (it.type === "message") for (const c of it.content || []) if (c.type === "output_text" || c.type === "text") text += c.text || "";
  const u = r.usage || {}, cached = u.input_tokens_details?.cached_tokens || 0;
  return { text, usage: { inp: Math.max(0, (u.input_tokens || 0) - cached), out: u.output_tokens || 0, cache_read: cached, cache_write: 0 } };
}
function extractJSON(text) {
  text = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try { return JSON.parse(text); } catch (e) { /* 아래에서 다시 */ }
  const s = text.indexOf("{"); if (s < 0) throw new Error("JSON 없음");
  let depth = 0, inStr = false, esc = false;
  for (let i = s; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(text.slice(s, i + 1));
  }
  throw new Error("JSON 파싱 실패");
}

/* ---------------- 모의 응답 ---------------- */
const MOCK = {
  thoughts: ["아직은 때가 아니다. 저들이 먼저 움직이게 두자.", "왕의 기침 소리가 날마다 커진다. 그 다음을 준비해야 한다.",
    "누가 내 편이고 누가 칼을 숨기고 있는지 알아야 한다.", "금화는 칼보다 오래 간다.",
    "신이시여, 이 왕국을 내전에서 지켜 주소서. 그리고 나를.", "웃는 얼굴로 편지를 쓰고, 등 뒤로는 사람을 보내자."],
  letters: ["그대의 충성을 잊지 않고 있소. 다가올 겨울에 우리가 같은 편에 서기를 바라오.", "궁정에 이상한 소문이 돈다 하오. 조심하시오.",
    "그대의 영지에 흉년이 들었다 들었소. 내가 도울 수 있을지도 모르오.", "우리 둘 다 원하는 것이 있지 않소? 조용히 만납시다."],
  speeches: ["왕국의 법과 전통을 지키는 자가 하늘의 축복을 받으리라!", "이 땅의 평화는 단결에서 온다. 분열을 꾀하는 자는 신의 적이다.",
    "나는 왕께 충성한다. 그러나 왕국의 내일도 생각해야 하지 않겠는가."],
  names: ["오타 폰 브라이텐바흐", "카를 츠보로프스키", "베아트릭스 폰 할레", "토마시 헤이두크", "울리히 슈말츠",
    "루치아 다 몬테", "빌헬름 노이만", "할리나 코발스카", "프리드리히 갈렌", "이트카 노바코바"],
  titles: ["용병대장", "교황 사절", "몰락 기사", "부유한 과부", "탁발 수사", "광산 감독관", "왕실 주치의", "방랑 시인"],
};
function mockChar(ctx) {
  const acts = [], others = ctx.others, n = randint(0, ctx.max_actions || 3), props = [...ctx.proposals];
  for (let i = 0; i < n; i++) {
    const r = rand();
    if (props.length && rand() < 0.7) acts.push({ type: "respond", proposal: props.shift(), accept: rand() < 0.55, reply: choice(["좋소.", "생각해 보았으나, 거절하오.", "그대의 뜻을 받들겠소."]) });
    else if (r < 0.32 && others.length) acts.push({ type: "letter", to: choice(others), text: choice(MOCK.letters) });
    else if (r < 0.45) acts.push({ type: "public", text: choice(MOCK.speeches) });
    else if (r < 0.58 && others.length) acts.push({ type: "propose", to: choice(others), kind: choice(["alliance", "deal", "marriage"]), terms: "서로의 영지를 침범하지 않고, 위기 때 돕는다.", gold: choice([0, 0, 50]) });
    else if (r < 0.68 && others.length) acts.push({ type: "spy", target: choice(others), goal: "그의 진짜 속내" });
    else if (r < 0.76 && others.length) acts.push({ type: "plot", target: choice(others), goal: choice(["평판을 무너뜨린다", "가신을 매수한다", "독살"]) });
    else if (r < 0.82 && Object.keys(ctx.enemy_provinces).length && rand() < 0.4) { const [pid, o] = choice(Object.entries(ctx.enemy_provinces)); acts.push({ type: "declare_war", target: o, province: pid, casus: "선조의 권리" }); }
    else if (r < 0.9 && ctx.my_provinces.length) acts.push(choice([{ type: "invest", province: choice(ctx.my_provinces) }, { type: "raise_army" }]));
    else if (others.length && ctx.gold > 200) acts.push({ type: "gift", to: choice(others), gold: 60 });
  }
  return { thought: choice(MOCK.thoughts), mood: choice(["불안", "냉정", "기대", "분노", "경계"]), actions: acts };
}
function mockGM(ctx) {
  const names = ctx.names;
  const rulings = ctx.rulings.map((r) => {
    const d = r.dice, oc = d <= 45 ? "success" : d <= 70 ? "partial" : "fail", eff = [], known = [r.actor];
    if (r.type === "spy" && oc !== "fail") eff.push({ type: "knowledge", who: [r.actor], text: `${names[r.target]}은(는) 밤마다 누군가에게 편지를 쓴다고 한다.` });
    if (r.type === "plot") {
      if (oc === "success") eff.push({ type: "prestige", who: r.target, delta: -5 });
      else if (oc === "fail") { known.push(r.target); eff.push({ type: "opinion", who: r.target, toward: r.actor, delta: -35 }); }
    }
    return { ref: r.ref, outcome: oc, public: oc === "fail" && d > 90, known_by: known, title: `${names[r.actor]}의 ${r.type === "spy" ? "첩보" : "음모"}`,
      text: `(모의 판정, 주사위 ${d}) ${names[r.actor]}의 계획은 ${oc === "success" ? "뜻대로 되었다" : oc === "partial" ? "반쯤 이루어졌다" : "어긋났다"}.`, effects: eff };
  });
  const events = ctx.god.map((g) => ({ title: "신의 섭리", text: "(모의) " + g.text, public: true, effects: [] }));
  if (rand() < 0.25) events.push({ title: "흉작", text: "(모의) 늦서리가 내려 남부의 밀이 상했다.", public: true, effects: [{ type: "dev", province: "rosental", delta: -1 }] });
  return { rulings, events, spawn: rand() < 0.15 ? [{ role: choice(MOCK.titles), reason: "모의 등장" }] : [],
    chronicle: `${ctx.date}. (모의 연대기 — 설정에서 API 키를 넣으면 판관이 실제로 씁니다.) 이번 계절 궁정에는 ${ctx.digest.length}건의 일이 기록되었고, ${ctx.rulings.length}건의 은밀한 계략이 어둠 속에서 움직였다.` };
}
function mockSpawn(ctx) {
  return { characters: ctx.reqs.map((r) => ({ name: choice(MOCK.names), title: choice(MOCK.titles), house: "없음", age: randint(22, 55),
    traits: [choice(["야심", "탐욕", "독실"]), choice(["용맹", "교활", "겁많음"])], persona: `(모의 인물) ${r.role}. 기회를 엿보며 궁정 주변을 맴돈다.`,
    goals: "한몫 잡는 것", secrets: ["과거에 이름을 바꾼 적이 있다"], gold: randint(20, 300), link_to: null, opinion_of_link: 0 })) };
}
function mockRespond(kind, ctx) {
  if (kind === "char") return mockChar(ctx);
  if (kind === "minor") return { chars: Object.fromEntries(Object.entries(ctx.chars).map(([k, c]) => [k, mockChar({ ...c, max_actions: 2 })])) };
  if (kind === "gm") return mockGM(ctx);
  if (kind === "spawn") return mockSpawn(ctx);
  return {};
}

/* ---------------- 프롬프트 ---------------- */
function charSystem(c, maxActions) {
  const secrets = (c.secrets || []).map((s) => "- " + s).join("\n") || "- (없음)";
  return `너는 중세 정치 시뮬레이션의 한 인물을 연기한다. 다른 인물들도 각자 다른 AI가 연기하고 있으며, 최고 판관(GM)이 결과를 판정한다.

${P.WORLD}

[너는 누구인가]
이름: ${c.name} (id: ${c.id})
가문: ${c.house}
인물상: ${c.persona}
목표: ${c.goals}
너만 아는 비밀:
${secrets}

[연기 규칙]
- 너는 '네가 아는 것'에 적힌 것만 안다. 다른 인물의 속마음·비밀을 아는 척하지 마라. 소문은 틀릴 수 있다.
- 중세 인물답게 생각하라. 명예, 신앙, 혈통, 체면, 두려움, 탐욕. 현대적 가치관이나 메타 발언(AI, 게임, 턴) 금지.
- 목표를 위해 움직이되 무리하지 마라. 기다리는 것도 정치다. 행동하지 않는 계절도 있다.
- 편지와 발언은 너의 말투로, 한국어로, 짧고 생생하게(각 2~4문장). 거짓말·과장·회유는 자유다.
- id는 반드시 '알려진 인물'과 '영지' 목록에 있는 것만 써라.

${P.ACTIONS}

${P.CHAR_OUTPUT.replace("{max_actions}", String(maxActions))}`;
}

/* ---------------- 게임 ---------------- */
class Game {
  constructor() {
    this.settings = loadSettings();
    this.map = buildMap(7);
    this.onChange = () => {};
    this.state = null;
    try { this.state = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { this.state = null; }
    if (!this.state || !this.state.chars) this.reset(true);
    this.state.status = { running: false, phase: "", error: "" };
    this.applyGeo();
    const month = new Date().toISOString().slice(0, 7);
    if (this.state.usage.month !== month) { // 새 달이면 지출 기록을 새로 시작
      for (const p of ["anthropic", "openai"]) Object.assign(this.state.usage[p], { usd: 0, in: 0, out: 0 });
      this.state.usage.month = month;
    }
  }
  applyGeo() {
    for (const [id, g] of Object.entries(this.map.geo)) Object.assign(this.state.provinces[id], g);
  }
  reset(first = false) {
    const usage = this.state?.usage;
    this.state = clone(DATA.initial);
    if (usage) this.state.usage = usage;
    if (!this.state.usage.month) this.state.usage.month = new Date().toISOString().slice(0, 7);
    this.applyGeo();
    this._event("서막", "늙은 왕 오토카르 4세의 기침 소리가 궁정에 울린다. 왕국은 숨을 죽이고 다음 왕을 셈한다.", { public: true, kind: "world" });
    this.save();
    if (!first) this.onChange();
  }
  save() {
    const s = this.state;
    const write = () => localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, status: { running: false, phase: "", error: "" } }));
    try { write(); return true; } catch (e) {
      s.events = s.events.slice(-250);
      for (const c of Object.values(s.chars)) { c.knowledge = c.knowledge.slice(-20); c.thoughts = c.thoughts.slice(-6); }
      try { write(); return true; } catch (e2) { return false; }
    }
  }
  /* 도우미 */
  date() { return `${this.state.year}년 ${SEASONS[this.state.season]}`; }
  dateOf(turn) { return `${1402 + Math.floor(turn / 4)}년 ${SEASONS[turn % 4]}`; }
  nid(prefix) { this.state.next_id++; return prefix + this.state.next_id; }
  C(id) { return this.state.chars[id]; }
  alive(id) { const c = this.C(id); return !!(c && c.alive); }
  name(id) { const c = this.C(id); return c ? c.name : String(id); }
  holdings(id) { return Object.values(this.state.provinces).filter((p) => p.owner === id); }
  levy(id) { return this.holdings(id).reduce((a, p) => a + p.dev * 120, 0); }
  income(id) { let inc = this.holdings(id).reduce((a, p) => a + p.dev * 12, 0); if (this.C(id)?.house === "교회") inc += 8; return inc; }
  isMock(modelKey) { return !this.settings.keys[this.settings.models[modelKey].provider]; }
  allies(id) {
    const out = [];
    for (const [a, b] of this.state.alliances) { if (a === id && this.alive(b)) out.push(b); if (b === id && this.alive(a)) out.push(a); }
    return out;
  }
  _event(title, text, { public: pub = false, known_by = [], kind = "event", actors = [], notify = true } = {}) {
    const s = this.state;
    const ev = { id: this.nid("e"), turn: s.turn, date: this.date(), kind, title, text, public: !!pub,
      known_by: (known_by || []).filter((k) => s.chars[k]), actors };
    s.events.push(ev);
    if (s.events.length > 600) s.events.splice(0, 100);
    if (!pub && notify) for (const k of ev.known_by) this._know(k, `[${title}] ${text}`, "사건");
    return ev;
  }
  _know(id, text, src) {
    const c = this.C(id); if (!c || !c.alive) return;
    c.knowledge.push({ turn: this.state.turn, text, src });
    if (c.knowledge.length > 40) c.knowledge.splice(0, c.knowledge.length - 40);
    this._wake(id);
  }
  _wake(id) { const w = this.state.wake || (this.state.wake = []); if (!w.includes(id)) w.push(id); }
  _opinion(a, b, d) { const c = this.C(a); if (c && this.state.chars[b] && a !== b) c.opinions[b] = clamp((c.opinions[b] || 0) + int(d), -100, 100); }
  phase(t) { this.state.status.phase = t; this.onChange(); }

  view() {
    const s = clone(this.state);
    for (const [id, c] of Object.entries(s.chars)) {
      c.levy = this.levy(id); c.income = this.income(id);
      c.provinces = this.holdings(id).map((p) => p.id);
      c.model_label = this.settings.models[c.model].label; c.mock = this.isMock(c.model);
    }
    s.budget = this.settings.budget; s.gm_label = this.settings.models.gm.label;
    s.mock = { anthropic: !this.settings.keys.anthropic, openai: !this.settings.keys.openai };
    s.date = this.date();
    return s;
  }

  /* 비용 */
  account(spec, u) {
    const pr = this.settings.pricing[spec.model] || {};
    const usd = (u.inp * (pr.in || 0) + u.out * (pr.out || 0) + u.cache_read * (pr.cache_read ?? pr.in ?? 0) + u.cache_write * (pr.cache_write ?? pr.in ?? 0)) / 1e6;
    const t = this.state.usage[spec.provider];
    t.usd = +(t.usd + usd).toFixed(6); t.in += u.inp + u.cache_read + u.cache_write; t.out += u.out;
  }
  async callJSON(key, system, user, mockKind, mockCtx) {
    const spec = this.settings.models[key], apiKey = this.settings.keys[spec.provider];
    if (!apiKey) { await sleep(120); return mockRespond(mockKind, mockCtx); }
    const fn = spec.provider === "anthropic" ? callAnthropic : callOpenAI;
    let err;
    for (let attempt = 0; attempt < 2; attempt++) {
      const u = attempt === 0 ? user : user + "\n\n(주의: 반드시 유효한 JSON 객체 하나만 출력하라.)";
      const { text, usage } = await fn(spec, apiKey, system, u);
      this.account(spec, usage);
      try { return extractJSON(text); } catch (e) { err = e; }
    }
    throw new Error(`${spec.label} 응답 JSON 파싱 실패: ${err.message}`);
  }

  /* 인물 컨텍스트 */
  knownPeople(me) {
    const s = this.state;
    return Object.entries(s.chars).filter(([id, c]) => c.alive && id !== me).map(([id, c]) => {
      const op = s.chars[me].opinions[id] || 0;
      return `- ${id} | ${c.name} | ${c.title} | ${c.house} | 나이 ${c.age} | 영지 ${this.holdings(id).length}곳 | 나의 호감 ${op >= 0 ? "+" : ""}${op}`;
    }).join("\n");
  }
  provinceTable() {
    return Object.values(this.state.provinces).map((p) =>
      `- ${p.id} | ${p.name} | 소유 ${p.owner ? this.name(p.owner) : "공석"}(${p.owner}) | 개발도 ${p.dev} | ${p.terrain} | 인접: ${p.adj.join(", ")}`).join("\n");
  }
  warsText() {
    const s = this.state;
    return s.wars.map((w) => `- ${w.id}: ${this.name(w.attacker)} → ${this.name(w.defender)} (목표 ${s.provinces[w.province].name}, 전황 ${w.score >= 0 ? "+" : ""}${w.score}, 명분: ${w.casus})`).join("\n") || "없음";
  }
  allianceText() { return this.state.alliances.map(([a, b]) => `- ${this.name(a)} ↔ ${this.name(b)}`).join("\n") || "없음"; }
  charUserMsg(id) {
    const s = this.state, c = this.C(id), hold = this.holdings(id);
    const props = s.proposals.filter((p) => p.to === id && p.status === "pending");
    const king = this.C(s.king);
    return `[지금] ${this.date()} (나이 ${c.age})
[너의 처지]
직함: ${c.title} / 금화 ${c.gold} / 위신 ${c.prestige} / 특성: ${c.traits.join(", ")}
영지: ${hold.map((p) => `${p.name}(${p.id}, 개발도 ${p.dev})`).join(", ") || "없음"}
징집 가능 병력: ${this.levy(id)}명, 군대 소집 상태: ${c.army_raised ? "소집됨" : "해산"}
주군: ${c.liege ? this.name(c.liege) : "없음"} / 후계자: ${c.heir ? this.name(c.heir) : "미정"}
동맹: ${this.allies(id).map((a) => this.name(a)).join(", ") || "없음"}

[왕국] 현재 왕: ${king ? king.name : "공위"} (${s.king})

[알려진 인물]
${this.knownPeople(id)}

[영지]
${this.provinceTable()}

[전쟁]
${this.warsText()}

[동맹 관계]
${this.allianceText()}

[너에게 온 제안 — 답할 수 있다]
${props.map((p) => `- ${p.id}: ${this.name(p.from)}(${p.from})의 ${p.kind} 제안 — ${p.terms}${p.gold ? ` (수락 시 금화 ${p.gold} 지급)` : ""}`).join("\n") || "없음"}

[네가 아는 것 (최근)]
${c.knowledge.slice(-16).map((k) => `- (${this.dateOf(k.turn)}, ${k.src}) ${k.text}`).join("\n") || "- 특별히 없음"}

[최근 공개된 일]
${s.events.filter((e) => e.public).slice(-12).map((e) => `- (${e.date}) ${e.title}: ${e.text}`).join("\n") || "- 없음"}

[너의 지난 생각]
${c.thoughts.slice(-3).map((t) => `- (${t.date}) ${t.text}`).join("\n") || "- 없음"}

이번 계절, 너는 무엇을 하겠는가? JSON으로만 답하라.`;
  }
  mockCtxFor(id) {
    const s = this.state, mine = this.holdings(id).map((p) => p.id), enemy = {};
    for (const p of Object.values(s.provinces)) if (p.owner && p.owner !== id && p.adj.some((a) => mine.includes(a))) enemy[p.id] = p.owner;
    return { me: id, max_actions: this.settings.rules.max_actions, others: Object.keys(s.chars).filter((k) => k !== id && s.chars[k].alive),
      my_provinces: mine, enemy_provinces: enemy, gold: this.C(id).gold,
      proposals: s.proposals.filter((p) => p.to === id && p.status === "pending").map((p) => p.id) };
  }

  /* 턴 */
  async runTurn() {
    const s = this.state;
    if (s.status.running) return false;
    s.status = { running: true, phase: "계절이 바뀐다…", error: "" };
    this.onChange();
    const snapshot = JSON.stringify(s); // 실패하면 이 계절은 없던 일로
    try {
      await this._turn();
      s.status = { running: false, phase: "", error: "" };
      if (!this.save()) s.status.error = "저장 공간이 부족합니다. 설정에서 세계를 내보낸 뒤 새로 시작하세요.";
    } catch (e) {
      console.error(e);
      const usage = s.usage;
      this.state = JSON.parse(snapshot);
      this.state.usage = usage; // 쓴 돈은 기록에 남긴다
      this.applyGeo();
      this.state.status = { running: false, phase: "", error: String(e.message || e).slice(0, 400) };
      this.save();
    }
    this.onChange();
    return true;
  }
  pickActive() {
    const s = this.state, r = this.settings.rules, woken = new Set(s.wake || []);
    const majors = [], semis = [], minors = [];
    for (const [id, c] of Object.entries(s.chars)) {
      if (!c.alive) continue;
      if (c.tier === "major") majors.push(id);
      else if (c.tier === "semi" && (woken.has(id) || rand() < r.semi_wake_chance)) semis.push(id);
      else if (c.tier === "minor" && (woken.has(id) || rand() < r.minor_wake_chance)) minors.push(id);
    }
    s.wake = [];
    return { majors, semis, minors };
  }
  async _turn() {
    const s = this.state, rules = this.settings.rules;
    const { majors, semis, minors } = this.pickActive();
    const jobs = [...majors, ...semis].map((id) => {
      const c = this.C(id);
      return { id, p: this.callJSON(c.model, charSystem(c, rules.max_actions), this.charUserMsg(id), "char", this.mockCtxFor(id)) };
    });
    let minorJob = null;
    if (minors.length) {
      const blocks = minors.map((id) => {
        const c = this.C(id);
        return `=== 인물 ${id}: ${c.name} (${c.title}) ===\n인물상: ${c.persona}\n목표: ${c.goals}\n비밀: ${c.secrets.join("; ")}\n`
          + this.charUserMsg(id).split("[알려진 인물]")[0] + "\n[네가 아는 것]\n" + c.knowledge.slice(-8).map((k) => "- " + k.text).join("\n");
      });
      const pub = s.events.filter((e) => e.public).slice(-10).map((e) => `- ${e.title}: ${e.text}`).join("\n");
      const user = `[알려진 인물]\n${this.knownPeople(minors[0])}\n\n[영지]\n${this.provinceTable()}\n\n[최근 공개된 일]\n${pub}\n\n${blocks.join("\n\n")}\n\n각 인물의 이번 계절 결정을 JSON으로.`;
      minorJob = this.callJSON("terra", P.MINOR_SYSTEM, user, "minor", { chars: Object.fromEntries(minors.map((id) => [id, this.mockCtxFor(id)])) });
    }
    this.phase("인물들이 궁리하는 중: " + [...majors, ...semis, ...minors].map((id) => this.name(id)).join(", "));

    const decisions = {}, errors = [];
    const res = await Promise.allSettled(jobs.map((j) => j.p));
    res.forEach((r, i) => { if (r.status === "fulfilled") decisions[jobs[i].id] = r.value; else errors.push(`${this.name(jobs[i].id)}: ${r.reason.message}`); });
    if (minorJob) {
      try { const out = (await minorJob).chars || {}; for (const id of minors) if (out[id] && typeof out[id] === "object") decisions[id] = out[id]; }
      catch (e) { errors.push("단역(Terra): " + e.message); }
    }
    if (errors.length && !Object.keys(decisions).length) throw new Error("모든 인물 호출 실패 — " + errors.join(" / ").slice(0, 300));

    this.phase("엔진이 편지와 군대를 옮기는 중");
    const { digest, rulings } = this.applyDecisions(decisions);
    errors.forEach((e) => digest.push(`(호출 실패: ${e})`));
    digest.push(...this.economy(), ...this.resolveWars());
    const gmUser = this.gmUserMsg(decisions, digest, rulings);
    const god = [...s.god_queue]; s.god_queue = [];

    this.phase(`${this.settings.models.gm.label} 판관이 판정하는 중`);
    const gm = await this.callJSON("gm", P.GM_SYSTEM, gmUser, "gm", {
      rulings, names: Object.fromEntries(Object.entries(s.chars).map(([k, v]) => [k, v.name])), god, date: this.date(), digest });

    this.applyGM(gm, rulings);
    this.naturalDeath();
    if ((s.turn + 1) % rules.spawn_every_turns === 0) {
      const n = Object.values(s.chars).filter((c) => c.alive && c.tier === "minor").length;
      if (n < rules.max_minor_chars) s.spawn_queue.push({ role: "왕국 정세에 얽힐 새로운 단역 인물 (아무 신분)", reason: "정기 등장" });
    }
    const spawn = [...s.spawn_queue]; s.spawn_queue = [];
    if (spawn.length) { this.phase("Terra가 새 인물을 빚는 중"); await this.spawn(spawn); }
    s.turn++; s.season = s.turn % 4; s.year = 1402 + Math.floor(s.turn / 4);
    if (s.season === 0) for (const c of Object.values(s.chars)) if (c.alive) c.age++;
  }

  applyDecisions(decisions) {
    const s = this.state, digest = [], rulings = [];
    const order = Object.keys(decisions).sort(() => rand() - 0.5);
    for (const id of order) {
      const d = decisions[id] && typeof decisions[id] === "object" ? decisions[id] : {}, c = this.C(id);
      if (!c || !c.alive) continue;
      if (d.thought) { c.thoughts.push({ turn: s.turn, date: this.date(), text: str(d.thought, 600), mood: str(d.mood, 30) }); c.thoughts = c.thoughts.slice(-12); }
      const acts = Array.isArray(d.actions) ? d.actions : [];
      const lim = c.tier === "minor" ? 2 : this.settings.rules.max_actions;
      for (const a of acts.slice(0, lim)) {
        if (a && typeof a === "object") {
          try { this.act(id, a, digest, rulings); } catch (e) { digest.push(`${c.name}의 행동 처리 오류(${a.type}): ${e.message}`); }
        }
      }
    }
    return { digest, rulings };
  }
  act(id, a, digest, rulings) {
    const s = this.state, c = this.C(id), t = a.type, to = a.to || a.target, nm = c.name;
    if (t === "letter" && this.alive(to)) {
      const text = str(a.text, 900);
      this._know(to, `${nm}의 편지: “${text}”`, "편지");
      this._event(`${nm} → ${this.name(to)} 편지`, text, { known_by: [id, to], kind: "letter", actors: [id, to], notify: false });
      digest.push(`[편지] ${nm} → ${this.name(to)}: ${text}`);
    } else if (t === "public") {
      const text = str(a.text, 700);
      this._event(`${nm}의 공개 발언`, text, { public: true, kind: "speech", actors: [id] });
      digest.push(`[공개 발언] ${nm}: ${text}`);
    } else if (t === "propose" && this.alive(to) && to !== id) {
      const kind = str(a.kind || "deal", 20), gold = Math.max(0, int(a.gold));
      const p = { id: this.nid("p"), turn: s.turn, from: id, to, kind, terms: str(a.terms, 500), gold, status: "pending" };
      s.proposals.push(p);
      this._know(to, `${nm}이(가) ${kind} 제안을 보냈다(${p.id}): ${p.terms}`, "제안");
      this._event(`${nm}의 ${kind} 제안`, `${this.name(to)}에게: ${p.terms}`, { known_by: [id, to], kind: "proposal", actors: [id, to], notify: false });
      digest.push(`[제안 ${p.id}] ${nm} → ${this.name(to)} (${kind}, 금화 ${gold}): ${p.terms}`);
    } else if (t === "respond") {
      const p = s.proposals.find((p) => p.id === a.proposal && p.to === id && p.status === "pending");
      if (!p) return;
      const reply = str(a.reply, 300);
      if (a.accept) this.accept(p, reply, digest);
      else {
        p.status = "rejected"; this._opinion(p.from, id, -10);
        this._know(p.from, `${nm}이(가) 나의 ${p.kind} 제안을 거절했다. “${reply}”`, "답신");
        this._event(`${nm}, 제안 거절`, `${this.name(p.from)}의 ${p.kind} 제안을 거절. ${reply}`, { known_by: [id, p.from], kind: "proposal", actors: [id, p.from], notify: false });
        digest.push(`[거절] ${nm}이 ${this.name(p.from)}의 ${p.kind} 제안 거절: ${reply}`);
      }
    } else if (t === "gift" && this.alive(to) && to !== id) {
      const g = clamp(int(a.gold), 0, Math.max(0, c.gold)); if (g <= 0) return;
      c.gold -= g; this.C(to).gold += g; this._opinion(to, id, Math.min(30, Math.floor(g / 20) + 3));
      this._know(to, `${nm}이(가) 금화 ${g}을 보내왔다.`, "선물");
      this._event(`${nm}의 선물`, `${this.name(to)}에게 금화 ${g}`, { known_by: [id, to], kind: "gift", actors: [id, to], notify: false });
      digest.push(`[선물] ${nm} → ${this.name(to)} 금화 ${g}`);
    } else if (t === "declare_war") {
      const prov = s.provinces[a.province];
      if (!prov || !this.alive(to) || prov.owner !== to || to === id || !this.holdings(id).length) { digest.push(`(무효한 선전포고 시도: ${nm} → ${to}/${a.province})`); return; }
      if (s.wars.some((w) => new Set([w.attacker, w.defender, id, to]).size === 2)) return;
      const w = { id: this.nid("w"), attacker: id, defender: to, province: prov.id, casus: str(a.casus || "명분 없음", 200), start: s.turn, score: 0 };
      s.wars.push(w);
      if (s.alliances.some((x) => x.includes(id) && x.includes(to))) {
        s.alliances = s.alliances.filter((x) => !(x.includes(id) && x.includes(to)));
        c.traits = [...new Set([...c.traits, "배신자"])];
      }
      this._opinion(to, id, -50);
      for (const x of Object.keys(s.chars)) if (x !== id) this._opinion(x, id, -5);
      this._event("선전포고", `${nm}이(가) ${this.name(to)}에게 전쟁을 선포했다. 목표는 ${prov.name}. 명분: ${w.casus}`, { public: true, kind: "war", actors: [id, to] });
      this._wake(to);
      digest.push(`[선전포고 ${w.id}] ${nm} → ${this.name(to)}, 목표 ${prov.name}`);
    } else if (t === "raise_army" && this.holdings(id).length && !c.army_raised) {
      c.army_raised = true;
      this._event(`${nm}, 군대 소집`, `${this.levy(id)}명의 징집병이 깃발 아래 모인다.`, { public: true, kind: "army", actors: [id] });
      digest.push(`[군대 소집] ${nm} (${this.levy(id)}명)`);
    } else if (t === "disband_army" && c.army_raised) {
      c.army_raised = false; digest.push(`[군대 해산] ${nm}`);
    } else if (t === "invest") {
      const prov = s.provinces[a.province];
      if (prov && prov.owner === id && prov.dev < 6) {
        const cost = 90 * prov.dev;
        if (c.gold >= cost) {
          c.gold -= cost; prov.dev++;
          this._event(`${prov.name} 개발`, `${nm}이(가) 금화 ${cost}을 들여 ${prov.name}을(를) 일구었다.`, { public: true, kind: "build", actors: [id] });
          digest.push(`[개발] ${nm}: ${prov.name} 개발도 ${prov.dev}`);
        }
      }
    } else if ((t === "spy" || t === "plot") && this.alive(to)) {
      const cost = t === "spy" ? 30 : 60;
      if (c.gold < cost) { digest.push(`(${nm}은 금화가 없어 ${t}을 실행하지 못했다)`); return; }
      c.gold -= cost;
      rulings.push({ ref: this.nid("r"), actor: id, type: t, target: to, goal: str(a.goal, 300),
        with_: (Array.isArray(a.with) ? a.with : []).filter((w) => this.alive(w)), dice: randint(1, 100) });
    } else if ((t === "pray" || t === "rest") && rand() < 0.15) c.prestige++;
  }
  accept(p, reply, digest) {
    const s = this.state, a = p.from, b = p.to;
    if (!this.alive(a) || !this.alive(b)) return;
    p.status = "accepted";
    if (p.gold) { const g = Math.min(p.gold, Math.max(0, this.C(a).gold)); this.C(a).gold -= g; this.C(b).gold += g; }
    const has = () => s.alliances.some((x) => x.includes(a) && x.includes(b));
    let pub = false;
    if (p.kind === "alliance" && !has()) { s.alliances.push([a, b]); pub = true; }
    else if (p.kind === "marriage") { if (!has()) s.alliances.push([a, b]); this.C(a).prestige += 10; this.C(b).prestige += 10; pub = true; }
    else if (p.kind === "vassalage") { this.C(a).liege = b; pub = true; }
    else if (p.kind === "peace") { const n = s.wars.length; s.wars = s.wars.filter((w) => !(new Set([w.attacker, w.defender, a, b]).size === 2)); pub = n !== s.wars.length; }
    this._opinion(a, b, 15); this._opinion(b, a, 10);
    this._know(a, `${this.name(b)}이(가) 나의 ${p.kind} 제안을 수락했다. “${reply}”`, "답신");
    const label = { alliance: "동맹 체결", marriage: "혼약 성사", vassalage: "봉신 서약", peace: "강화" }[p.kind] || "거래 성사";
    this._event(label, `${this.name(a)} ↔ ${this.name(b)}: ${p.terms}`, { public: pub, known_by: [a, b], kind: "proposal", actors: [a, b], notify: false });
    digest.push(`[수락 ${p.id}] ${this.name(b)}이 ${this.name(a)}의 ${p.kind} 제안 수락: ${p.terms} / 답: ${reply}`);
  }
  economy() {
    const out = [], s = this.state;
    for (const [id, c] of Object.entries(s.chars)) {
      if (!c.alive) continue;
      c.gold += this.income(id);
      if (c.army_raised) {
        c.gold -= Math.floor(this.levy(id) * 0.08);
        if (c.gold < 0) {
          c.army_raised = false; c.prestige -= 5;
          this._event(`${c.name}의 군대 와해`, "급료를 받지 못한 병사들이 흩어졌다.", { public: true, kind: "army", actors: [id] });
          out.push(`[군대 와해] ${c.name} — 급료 부족`);
        }
      }
      c.gold = Math.max(c.gold, -200);
    }
    for (const p of s.proposals) if (p.status === "pending" && s.turn - p.turn >= 3) p.status = "expired";
    s.proposals = s.proposals.slice(-60);
    return out;
  }
  power(id) {
    const c = this.C(id);
    let b = this.levy(id) * (c.army_raised ? 1.6 : 0.6);
    for (const al of this.allies(id)) b += this.levy(al) * (this.C(al).army_raised ? 0.5 : 0.2);
    return Math.max(b, 30);
  }
  resolveWars() {
    const s = this.state, out = [], keep = [];
    for (const w of s.wars) {
      const att = w.attacker, dfn = w.defender, prov = s.provinces[w.province];
      if (!this.alive(att) || !this.alive(dfn) || prov.owner !== dfn) { out.push(`[전쟁 종결 ${w.id}] 당사자 사망 또는 목표 영지 소유 변경`); continue; }
      const pa = this.power(att) * uniform(0.6, 1.4), pd = this.power(dfn) * uniform(0.6, 1.4) * 1.15;
      const win = pa > pd; w.score += win ? 1 : -1;
      const [winner, loser] = win ? [att, dfn] : [dfn, att];
      const dead = Math.floor(Math.min(pa, pd) * uniform(0.05, 0.15));
      this._event(`${prov.name} 전투`, `${this.name(winner)}의 군대가 ${this.name(loser)}의 군대를 물리쳤다. 약 ${dead}명이 쓰러졌다.`, { public: true, kind: "battle", actors: [att, dfn] });
      out.push(`[전투] ${prov.name}: 승자 ${this.name(winner)} (공격 ${pa | 0} vs 방어 ${pd | 0}), 전황 ${w.score >= 0 ? "+" : ""}${w.score}`);
      if (rand() < 0.06) { this.kill(loser, `${prov.name} 전투에서 전사`); out.push(`[전사] ${this.name(loser)}`); continue; }
      if (w.score >= 2) {
        this.transfer(prov.id, att); this.C(att).prestige += 15; this.C(dfn).prestige -= 10;
        this._event("전쟁 종결", `${this.name(att)}이(가) ${prov.name}을(를) 차지했다.`, { public: true, kind: "war", actors: [att, dfn] });
        out.push(`[전쟁 승리] ${this.name(att)}이 ${prov.name} 점령`);
      } else if (w.score <= -2) {
        const g = Math.min(150, Math.max(0, this.C(att).gold)); this.C(att).gold -= g; this.C(dfn).gold += g;
        this.C(att).prestige -= 15; this.C(dfn).prestige += 10;
        this._event("전쟁 종결", `${this.name(att)}의 침공이 실패했다. 배상금 ${g}.`, { public: true, kind: "war", actors: [att, dfn] });
        out.push(`[전쟁 패배] ${this.name(att)} 패퇴, 배상금 ${g}`);
      } else keep.push(w);
    }
    s.wars = keep;
    return out;
  }
  transfer(pid, owner) {
    const s = this.state, prov = s.provinces[pid], old = prov.owner;
    prov.owner = owner; delete prov.vacant_of;
    const nc = this.C(owner);
    if (nc && nc.tier === "minor") {
      const n = Object.values(s.chars).filter((c) => c.tier === "semi").length;
      nc.tier = "semi"; nc.model = n % 2 ? "luna" : "haiku";
      this._event("새 영주", `${nc.name}이(가) ${prov.name}의 영주가 되었다.`, { public: true, kind: "rise", actors: [owner] });
    }
    if (old && this.alive(old) && !this.holdings(old).length) this.C(old).army_raised = false;
  }
  kill(id, cause) {
    const s = this.state, c = this.C(id);
    if (!c || !c.alive) return;
    c.alive = false; c.death = { turn: s.turn, date: this.date(), cause };
    this._event(`${c.name} 사망`, `${c.title} ${c.name}이(가) 세상을 떠났다. (${cause})`, { public: true, kind: "death", actors: [id] });
    let heir = this.alive(c.heir) ? c.heir : null;
    if (!heir && !["없음", "평민", "교회"].includes(c.house)) {
      const same = Object.keys(s.chars).filter((k) => s.chars[k].alive && s.chars[k].house === c.house);
      if (same.length) heir = same.sort((a, b) => s.chars[b].prestige - s.chars[a].prestige)[0];
    }
    const holds = this.holdings(id);
    if (holds.length) {
      if (heir) {
        holds.forEach((p) => this.transfer(p.id, heir));
        this.C(heir).gold += Math.max(0, c.gold);
        this._event("상속", `${this.name(heir)}이(가) ${c.name}의 영지를 물려받았다.`, { public: true, kind: "succession", actors: [heir] });
        for (const w of s.wars) { if (w.attacker === id) w.attacker = heir; if (w.defender === id) w.defender = heir; }
      } else {
        holds.forEach((p) => { p.owner = null; p.vacant_of = id; });
        s.spawn_queue.push({ role: `${c.house}의 새 당주 — ${c.name}의 친척으로 영지를 물려받는다`, reason: "상속자 부재", heir_of: id });
      }
    }
    for (const o of Object.values(s.chars)) { if (o.heir === id) o.heir = null; if (o.liege === id) o.liege = heir; }
    s.alliances = s.alliances.filter((x) => !x.includes(id));
    if (s.king === id) {
      let nk = heir;
      if (!nk) { const landed = Object.keys(s.chars).filter((k) => s.chars[k].alive && this.holdings(k).length); if (landed.length) nk = landed.sort((a, b) => s.chars[b].prestige - s.chars[a].prestige)[0]; }
      if (nk) this.crown(nk);
    }
  }
  crown(id) {
    const s = this.state, old = s.king, nc = this.C(id);
    s.king = id;
    const female = ["공주", "부인", "수녀", "엘리자베트", "마르가레테", "아그네스"].some((x) => nc.name.includes(x) || nc.title.includes(x));
    nc.title = female ? "로트발트의 여왕" : "로트발트의 왕"; nc.liege = null; nc.prestige += 20;
    for (const [k, v] of Object.entries(s.chars)) if (v.alive && k !== id && (v.liege === old || !v.liege) && this.holdings(k).length) v.liege = id;
    if (nc.tier !== "major") { nc.tier = "major"; nc.model = ["haiku", "terra"].includes(nc.model) ? "sonnet" : "sol"; }
    this._event("대관", `${nc.name}이(가) 로트발트의 왕관을 썼다.`, { public: true, kind: "crown", actors: [id] });
    Object.keys(s.chars).forEach((k) => this._wake(k));
  }
  naturalDeath() {
    if (this.state.season !== 3) return;
    for (const [id, c] of Object.entries(this.state.chars)) {
      if (!c.alive) continue;
      let p = Math.max(0, c.age - 50) * 0.006;
      if (c.traits.some((t) => ["노쇠", "병약", "중병"].includes(t))) p += 0.08;
      if (rand() < p) this.kill(id, "병환과 노쇠");
    }
  }

  gmUserMsg(decisions, digest, rulings) {
    const s = this.state;
    const people = Object.entries(s.chars).filter(([, c]) => c.alive).map(([id, c]) =>
      `- ${id} | ${c.name} | ${c.title} | ${c.tier} | 나이 ${c.age} | 금화 ${c.gold} | 위신 ${c.prestige} | 병력 ${this.levy(id)}${c.army_raised ? "(소집)" : ""} | 영지: ${this.holdings(id).map((p) => p.name).join(", ") || "-"} | 주군 ${c.liege} | 후계 ${c.heir} | 특성 ${c.traits.join(", ")} | 비밀: ${c.secrets.join("; ")}`);
    const acts = Object.entries(decisions).filter(([, d]) => d && typeof d === "object").map(([id, d]) => {
      const al = (Array.isArray(d.actions) ? d.actions : []).filter((a) => a && typeof a === "object")
        .map((a) => `${a.type}→${a.to || a.target || ""} ${str(a.goal || a.terms || a.text, 120)}`).join("; ");
      return `- ${this.name(id)}(${id}) 속마음: ${str(d.thought, 300)} / 행동: ${al || "없음"}`;
    });
    const rul = rulings.map((r) => `- ref ${r.ref} | ${this.name(r.actor)}(${r.actor})의 ${r.type} → ${this.name(r.target)}(${r.target}) | 목적: ${r.goal} | 공모: ${r.with_.join(", ") || "없음"} | 주사위 ${r.dice}`).join("\n") || "없음";
    return `[날짜] ${this.date()}  /  현재 왕: ${this.name(s.king)} (${s.king})

[인물 현황 — 너만 보는 전체 정보]
${people.join("\n")}

[영지]
${this.provinceTable()}

[전쟁]
${this.warsText()}
[동맹]
${this.allianceText()}

[이번 계절 인물들의 속마음과 행동]
${acts.join("\n") || "없음"}

[엔진이 이미 처리한 일 — 효과 중복 적용 금지]
${digest.join("\n") || "없음"}

[판정이 필요한 것 — rulings에 하나씩 모두 답하라]
${rul}

[신의 섭리 — 반드시 이번 계절에 반영]
${s.god_queue.map((g) => "- " + g.text).join("\n") || "없음"}

[직전 연대기]
${s.chronicle.slice(-2).map((x) => `- (${x.date}) ${x.text}`).join("\n") || "없음"}

판정과 연대기를 JSON으로만 출력하라.`;
  }
  applyGM(gm, rulings) {
    const s = this.state; gm = gm && typeof gm === "object" ? gm : {};
    const byRef = Object.fromEntries(rulings.map((r) => [r.ref, r])), answered = new Set();
    for (const r of Array.isArray(gm.rulings) ? gm.rulings : []) {
      if (!r || typeof r !== "object") continue;
      const orig = byRef[r.ref]; answered.add(r.ref);
      const known = Array.isArray(r.known_by) ? [...r.known_by] : [];
      if (orig && !known.includes(orig.actor)) known.push(orig.actor);
      const outcome = { success: "성공", partial: "부분 성공", fail: "실패" }[r.outcome] || r.outcome || "";
      const title = str(r.title || (orig ? `${this.name(orig.actor)}의 ${orig.type}` : "음모"), 80);
      this._event(`${title} — ${outcome}`, str(r.text, 900), { public: !!r.public, known_by: known, kind: "plot", actors: orig ? [orig.actor, orig.target] : [] });
      this.effects(r.effects);
    }
    for (const [ref, r] of Object.entries(byRef)) if (!answered.has(ref)) this._know(r.actor, `${this.name(r.target)}을(를) 겨냥한 ${r.type}은(는) 아무 소득이 없었다.`, "보고");
    for (const e of Array.isArray(gm.events) ? gm.events : []) {
      if (!e || typeof e !== "object") continue;
      this._event(str(e.title || "사건", 80), str(e.text, 900), { public: e.public !== false, known_by: e.known_by || [], kind: "world" });
      this.effects(e.effects);
    }
    const text = String(gm.chronicle || "").trim();
    if (text) s.chronicle.push({ turn: s.turn, date: this.date(), text: text.slice(0, 2500) });
    for (const sp of (Array.isArray(gm.spawn) ? gm.spawn : []).slice(0, 2)) if (sp && sp.role) s.spawn_queue.push({ role: str(sp.role, 200), reason: str(sp.reason, 200) });
  }
  effects(list) {
    const s = this.state;
    for (const f of Array.isArray(list) ? list : []) {
      if (!f || typeof f !== "object") continue;
      const t = f.type, who = f.who;
      if (t === "kill" && this.alive(who)) this.kill(who, str(f.cause || "알 수 없는 죽음", 120));
      else if (t === "gold" && this.alive(who)) this.C(who).gold += int(f.amount);
      else if (t === "opinion" && this.alive(who)) this._opinion(who, f.toward, int(f.delta));
      else if (t === "province" && s.provinces[f.id] && this.alive(f.owner)) this.transfer(f.id, f.owner);
      else if (t === "knowledge") (Array.isArray(who) ? who : [who]).forEach((w) => this._know(w, str(f.text, 600), "첩보"));
      else if (t === "trait" && this.alive(who)) {
        const c = this.C(who);
        if (f.add) c.traits = [...new Set([...c.traits, str(f.add, 20)])].slice(-8);
        if (f.remove) c.traits = c.traits.filter((x) => x !== f.remove);
      } else if (t === "prestige" && this.alive(who)) this.C(who).prestige += int(f.delta);
      else if (t === "dev" && s.provinces[f.province]) { const p = s.provinces[f.province]; p.dev = clamp(p.dev + int(f.delta), 1, 6); }
      else if (t === "crown" && this.alive(who) && who !== s.king) this.crown(who);
      else if (t === "heir" && this.alive(who) && (f.heir == null || this.alive(f.heir))) this.C(who).heir = f.heir ?? null;
      else if (t === "liege" && this.alive(who)) this.C(who).liege = this.alive(f.liege) ? f.liege : null;
    }
  }
  async spawn(reqs) {
    const s = this.state; reqs = reqs.slice(0, 4);
    const existing = Object.entries(s.chars).filter(([, v]) => v.alive).map(([k, v]) => `- ${k} | ${v.name} | ${v.title} | ${v.house}`).join("\n");
    const user = `[날짜] ${this.date()}\n[기존 인물]\n${existing}\n\n[최근 연대기]\n${s.chronicle.slice(-2).map((x) => x.text).join("\n")}\n\n[만들 인물 — 요청 순서대로 하나씩]\n`
      + reqs.map((r, i) => `${i + 1}. ${r.role} (이유: ${r.reason || ""})`).join("\n");
    let out;
    try { out = await this.callJSON("terra", P.SPAWN_SYSTEM, user, "spawn", { reqs }); }
    catch (e) { s.spawn_queue.push(...reqs); this._event("인물 생성 실패", str(e.message, 200), { kind: "system" }); return; }
    const chars = Array.isArray(out.characters) ? out.characters : [];
    reqs.forEach((req, i) => {
      const d = chars[i]; if (!d || typeof d !== "object") return;
      const id = this.nid("c"), prev = req.heir_of ? this.C(req.heir_of) : null;
      const c = { id, name: str(d.name || "이름 없는 자", 40), title: str(d.title || "평민", 40), house: prev ? prev.house : str(d.house || "없음", 30),
        age: Math.max(18, int(d.age, 30)), tier: prev ? prev.tier : "minor", model: prev ? prev.model : "terra",
        color: prev ? prev.color : choice(PALETTE), heir: null, traits: (d.traits || []).slice(0, 4).map((x) => str(x, 20)),
        persona: str(d.persona, 600), goals: str(d.goals, 300), secrets: (d.secrets || []).slice(0, 3).map((x) => str(x, 200)),
        gold: Math.max(0, int(d.gold, 50)), prestige: prev ? 20 : 5, alive: true, army_raised: false, opinions: {}, knowledge: [], thoughts: [],
        born_turn: s.turn, liege: prev ? s.king : null };
      s.chars[id] = c;
      if (s.chars[d.link_to]) c.opinions[d.link_to] = clamp(int(d.opinion_of_link), -100, 100);
      if (prev) {
        for (const p of Object.values(s.provinces)) if (!p.owner && p.vacant_of === req.heir_of) { p.owner = id; delete p.vacant_of; }
        for (const o of Object.values(s.chars)) if (o.liege === req.heir_of) o.liege = id;
        this._event("새 당주", `${c.name}이(가) ${prev.name}의 뒤를 이어 ${c.house}의 당주가 되었다.`, { public: true, kind: "succession", actors: [id] });
      } else this._event("새 인물 등장", `${c.title} ${c.name} — ${c.persona.slice(0, 160)}`, { public: true, kind: "spawn", actors: [id] });
      this._wake(id);
    });
  }

  /* 신의 개입 */
  god(req) {
    const s = this.state, k = req.kind, t = req.target;
    const done = (msg) => { this.save(); this.onChange(); return msg; };
    if (k === "whisper" && this.alive(t)) {
      const txt = str(req.text, 600);
      this._know(t, `꿈인지 계시인지 모를 목소리가 들렸다: “${txt}”`, "계시");
      this._event(`${this.name(t)}에게 내린 계시`, txt, { known_by: [t], kind: "god", actors: [t], notify: false });
      return done("계시가 내려졌다. 그 인물은 다음 계절에 이 목소리를 떠올린다.");
    }
    if (k === "decree") {
      const txt = str(req.text, 600);
      s.god_queue.push({ text: txt });
      this._event("신의 섭리 (예정)", txt, { kind: "god" });
      return done("섭리가 정해졌다. 다음 계절 판관이 이를 세상에 실현한다.");
    }
    if (s.status.running && ["smite", "give", "bless"].includes(k)) return "계절이 흐르는 중입니다. 끝난 뒤에 다시 하세요.";
    if (k === "smite" && this.alive(t)) { this.kill(t, str(req.text || "하늘의 벼락", 100)); return done(`${this.name(t)}이(가) 쓰러졌다.`); }
    if (k === "bless" && this.alive(t)) { const g = int(req.gold, 300); this.C(t).gold += g; this._know(t, `뜻밖의 횡재로 금화 ${g}이 생겼다.`, "행운"); return done(`${this.name(t)}에게 금화 ${g}.`); }
    if (k === "give" && s.provinces[req.province] && this.alive(t)) {
      this.transfer(req.province, t);
      this._event("영지의 주인이 바뀌다", `${s.provinces[req.province].name}이(가) ${this.name(t)}의 손에 들어갔다.`, { public: true, kind: "god", actors: [t] });
      return done("영지가 넘어갔다.");
    }
    if (k === "spawn") { s.spawn_queue.push({ role: str(req.text || "새 인물", 300), reason: "신의 뜻" }); return done("다음 계절이 끝날 때 새 인물이 등장한다."); }
    if (k === "promote" && this.alive(t)) {
      const c = this.C(t); c.tier = req.tier || "semi";
      if (this.settings.models[req.model] && req.model !== "gm") c.model = req.model;
      return done(`${c.name}: ${c.tier} / ${this.settings.models[c.model].label}`);
    }
    return "아무 일도 일어나지 않았다.";
  }
  resetUsage() {
    for (const p of ["anthropic", "openai"]) Object.assign(this.state.usage[p], { usd: 0, in: 0, out: 0 });
    this.state.usage.month = new Date().toISOString().slice(0, 7);
    this.save(); this.onChange();
  }
  exportJSON() { return JSON.stringify({ ...this.state, status: { running: false, phase: "", error: "" } }); }
  importJSON(text) {
    const st = JSON.parse(text);
    if (!st.chars || !st.provinces) throw new Error("로트발트 저장 파일이 아닙니다.");
    this.state = st; this.state.status = { running: false, phase: "", error: "" };
    this.applyGeo(); this.save(); this.onChange();
  }
}
