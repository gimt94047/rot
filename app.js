"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ANTHROPIC = new Set(["gm", "sonnet", "haiku"]);
const TIER = { major: "주요 인물", semi: "준주요 인물", minor: "단역" };

let S = null, MAP = null, sel = { prov: null, person: null }, evFilter = "all";
let sigs = {}, autoTimer = null, base = null, baseSig = "";

const G = new Game();
let wakeLock = null;
async function holdScreen(on) {
  try {
    if (on && !wakeLock && "wakeLock" in navigator) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* 지원 안 하면 무시 */ }
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3200);
}
const nm = (id) => (S && S.chars[id] ? S.chars[id].name : id || "공석");
const pname = (id) => (S && S.provinces[id] ? S.provinces[id].name : id);
const owned = (cid) => Object.values(S.provinces).filter((p) => p.owner === cid);

/* ---------------- 상태 ---------------- */
function refresh() {
  S = G.view();
  renderTop();
  renderMap();
  const sig = (k, v) => { if (sigs[k] === v) return false; sigs[k] = v; return true; };
  const evSig = S.events.length + ":" + (S.events.at(-1)?.id || "") + ":" + S.turn;
  if (sig("chron", S.chronicle.length + ":" + S.turn)) renderChron();
  if (sig("events", evSig + evFilter)) renderEvents();
  if (sig("people", evSig + JSON.stringify(sel.person) + Object.values(S.chars).map((c) => c.tier + c.model + c.alive).join())) renderPeople();
  if (sig("god", Object.keys(S.chars).length + ":" + Object.values(S.chars).filter((c) => c.alive).length)) renderGod();
  if (sel.prov) renderPcard();
  schedule();
}
function schedule() {
  holdScreen(S.status.running || $("#auto").checked);
  if ($("#auto").checked && !S.status.running && !S.status.error && !autoTimer) {
    const over = ["anthropic", "openai"].some((p) => S.usage[p].usd >= S.budget[p]);
    if (over) { $("#auto").checked = false; toast("이번 달 예산을 다 썼습니다. 자동 진행을 멈춥니다."); return; }
    autoTimer = setTimeout(async () => { autoTimer = null; if ($("#auto").checked) await nextTurn(); }, 1800);
  }
  if (S.status.error && $("#auto").checked) $("#auto").checked = false;
}
async function nextTurn() {
  if (G.state.status.running) return toast("이미 계절이 흐르고 있습니다.");
  await G.runTurn();
}

/* ---------------- 상단 ---------------- */
function renderTop() {
  $("#date").textContent = S.date;
  const k = S.chars[S.king];
  $("#reign").innerHTML = `<span>현재 왕 ${esc(k ? k.name : "공위")}</span><span>전쟁 ${S.wars.length}건</span><span>동맹 ${S.alliances.length}개</span><span>판관 ${esc(S.gm_label)}</span>`;
  const ph = $("#phase");
  ph.className = "phase" + (S.status.running ? " run" : S.status.error ? " err" : "");
  ph.textContent = S.status.running ? S.status.phase : S.status.error ? "오류: " + S.status.error : "";
  $("#btnTurn").disabled = S.status.running;
  $("#btnTurn").textContent = S.status.running ? "진행 중" : "다음 계절";
  const row = (p, label) => {
    const u = S.usage[p], b = S.budget[p], pct = Math.min(100, (u.usd / b) * 100);
    return `<div class="row"><span>${label}</span><span class="meter"><i style="width:${pct}%"></i></span>
      <span>${S.mock[p] ? '<span class="mock">모의 응답</span>' : "$" + u.usd.toFixed(2) + " / $" + b}</span></div>`;
  };
  $("#spend").innerHTML = row("anthropic", "Claude") + row("openai", "GPT");
}

/* ---------------- 지도 ---------------- */
const CELL = 8;
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hash(x, y) { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) & 255) / 255; }

function buildBase() {
  const { w, h, grid, order } = MAP;
  const owners = order.map((id) => S.provinces[id].owner);
  const sig = owners.join() + Object.values(S.chars).map((c) => c.color).join();
  if (sig === baseSig && base) return;
  baseSig = sig;
  const cv = base || document.createElement("canvas");
  cv.width = w * CELL; cv.height = h * CELL;
  const g = cv.getContext("2d");
  // 바다와 얕은 물
  const dist = new Int16Array(w * h).fill(99);
  const q = [];
  for (let i = 0; i < w * h; i++) if (grid[i] >= 0) { dist[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx; if (dist[j] > dist[i] + 1 && dist[i] < 5) { dist[j] = dist[i] + 1; q.push(j); }
    }
  }
  const ownerOf = (i) => (grid[i] < 0 ? null : owners[grid[i]]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = grid[i], n = hash(x, y);
    let r, gg, b;
    if (p < 0) {
      const d = dist[i], lift = d < 5 ? (5 - d) * 5 : 0;
      r = 21 + lift * 0.6 + n * 3; gg = 33 + lift + n * 3; b = 43 + lift * 1.1 + n * 4;
    } else {
      const o = owners[p], c = o && S.chars[o] ? hexRgb(S.chars[o].color) : [96, 90, 80];
      const land = [176, 160, 122], mix = 0.38, sh = 0.9 + n * 0.14;
      r = (c[0] * (1 - mix) + land[0] * mix) * sh; gg = (c[1] * (1 - mix) + land[1] * mix) * sh; b = (c[2] * (1 - mix) + land[2] * mix) * sh;
    }
    g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
    g.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
  // 바다 빗금
  g.save(); g.strokeStyle = "rgba(200,215,225,0.035)"; g.lineWidth = 1;
  for (let k = -cv.height; k < cv.width; k += 9) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + cv.height, cv.height); g.stroke(); }
  g.restore();
  // 경계선
  const seg = (style, width, test) => {
    g.beginPath(); g.strokeStyle = style; g.lineWidth = width; g.lineCap = "square";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w && test(i, i + 1)) { g.moveTo((x + 1) * CELL, y * CELL); g.lineTo((x + 1) * CELL, (y + 1) * CELL); }
      if (y + 1 < h && test(i, i + w)) { g.moveTo(x * CELL, (y + 1) * CELL); g.lineTo((x + 1) * CELL, (y + 1) * CELL); }
    }
    g.stroke();
  };
  seg("rgba(30,22,14,0.35)", 1, (a, b) => grid[a] >= 0 && grid[b] >= 0 && grid[a] !== grid[b] && ownerOf(a) === ownerOf(b));
  seg("rgba(24,16,10,0.9)", 2.4, (a, b) => grid[a] >= 0 && grid[b] >= 0 && ownerOf(a) !== ownerOf(b));
  seg("rgba(12,10,8,0.95)", 3, (a, b) => (grid[a] < 0) !== (grid[b] < 0));
  base = cv;
}

function fit() {
  const c = $("#map"), wrap = $("#mapwrap");
  const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
  if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const s = Math.min(W / (MAP.w * CELL), H / (MAP.h * CELL)) * 0.97;
  return { dpr, W, H, s, ox: (W - MAP.w * CELL * s) / 2, oy: (H - MAP.h * CELL * s) / 2 };
}

function renderMap() {
  if (!MAP || !S) return;
  buildBase();
  const c = $("#map"), g = c.getContext("2d"), f = fit();
  g.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
  g.fillStyle = "#15212b"; g.fillRect(0, 0, f.W, f.H);
  g.imageSmoothingEnabled = true;
  g.drawImage(base, f.ox, f.oy, MAP.w * CELL * f.s, MAP.h * CELL * f.s);
  const P = (x, y) => [f.ox + (x + 0.5) * CELL * f.s, f.oy + (y + 0.5) * CELL * f.s];

  // 선택한 영지 테두리
  if (sel.prov) {
    const idx = S.provinces[sel.prov].idx, { w, h, grid } = MAP, k = CELL * f.s;
    g.beginPath(); g.strokeStyle = "#e9c46a"; g.lineWidth = 2.5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (grid[y * w + x] !== idx) continue;
      const X = f.ox + x * k, Y = f.oy + y * k;
      if (x + 1 >= w || grid[y * w + x + 1] !== idx) { g.moveTo(X + k, Y); g.lineTo(X + k, Y + k); }
      if (x - 1 < 0 || grid[y * w + x - 1] !== idx) { g.moveTo(X, Y); g.lineTo(X, Y + k); }
      if (y + 1 >= h || grid[(y + 1) * w + x] !== idx) { g.moveTo(X, Y + k); g.lineTo(X + k, Y + k); }
      if (y - 1 < 0 || grid[(y - 1) * w + x] !== idx) { g.moveTo(X, Y); g.lineTo(X + k, Y); }
    }
    g.stroke();
  }
  // 이름
  const fs = Math.max(11, Math.min(17, 15 * f.s * CELL / 8));
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const p of Object.values(S.provinces)) {
    const [x, y] = P(p.cx, p.cy);
    if (p.capital) drawCrown(g, x, y - fs * 1.15, fs * 0.8);
    g.font = `${p.capital ? fs + 2 : fs}px "Song Myung", serif`;
    g.lineWidth = 3.5; g.strokeStyle = "rgba(20,14,8,0.85)"; g.strokeText(p.name, x, y);
    g.fillStyle = "#f3ead6"; g.fillText(p.name, x, y);
  }
  // 전쟁 표시
  for (const w of S.wars) {
    const p = S.provinces[w.province]; const [x, y] = P(p.cx, p.cy), r = fs * 0.7;
    g.font = `${p.capital ? fs + 2 : fs}px "Song Myung", serif`;
    drawSeal(g, x + g.measureText(p.name).width / 2 + r + 4, y, r);
  }
  renderLegend();
}
function drawCrown(g, x, y, s) {
  g.save(); g.fillStyle = "#d8b25c"; g.strokeStyle = "rgba(20,14,8,0.9)"; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x - s * 0.6, y + s * 0.35); g.lineTo(x - s * 0.6, y - s * 0.25); g.lineTo(x - s * 0.3, y + s * 0.05);
  g.lineTo(x, y - s * 0.4); g.lineTo(x + s * 0.3, y + s * 0.05); g.lineTo(x + s * 0.6, y - s * 0.25); g.lineTo(x + s * 0.6, y + s * 0.35);
  g.closePath(); g.stroke(); g.fill(); g.restore();
}
function drawSeal(g, x, y, r) {
  g.save();
  g.fillStyle = "#9b2a2a"; g.strokeStyle = "rgba(20,10,8,0.9)"; g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = "#f2e2c4"; g.lineWidth = Math.max(1.5, r * 0.18);
  g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.5); g.lineTo(x + r * 0.5, y + r * 0.5);
  g.moveTo(x + r * 0.5, y - r * 0.5); g.lineTo(x - r * 0.5, y + r * 0.5); g.stroke();
  g.restore();
}
function renderLegend() {
  const owners = [...new Set(Object.values(S.provinces).map((p) => p.owner).filter(Boolean))];
  const html = owners.map((o) => `<span><i style="background:${S.chars[o].color}"></i>${esc(S.chars[o].name)}</span>`).join("");
  if ($("#legend").innerHTML !== html) $("#legend").innerHTML = html;
}
function cellAt(ev) {
  const f = fit(), r = $("#map").getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left - f.ox) / (CELL * f.s)), y = Math.floor((ev.clientY - r.top - f.oy) / (CELL * f.s));
  if (x < 0 || y < 0 || x >= MAP.w || y >= MAP.h) return null;
  const idx = MAP.grid[y * MAP.w + x];
  return idx < 0 ? null : MAP.order[idx];
}
function onMove(ev) {
  if (!S) return;
  const id = cellAt(ev), tip = $("#tip");
  if (!id) { tip.hidden = true; return; }
  const p = S.provinces[id], r = $("#mapwrap").getBoundingClientRect();
  tip.innerHTML = `<b>${esc(p.name)}</b><br>${esc(nm(p.owner))}<br>개발도 ${p.dev}, ${esc(p.terrain)}`;
  tip.hidden = false;
  tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 180) + "px";
  tip.style.top = ev.clientY - r.top + 14 + "px";
}
function onClick(ev) {
  const id = cellAt(ev);
  sel.prov = id; renderMap();
  if (id) renderPcard(); else $("#pcard").hidden = true;
}
function renderPcard() {
  const p = S.provinces[sel.prov], card = $("#pcard");
  const war = S.wars.find((w) => w.province === p.id);
  card.innerHTML = `<button class="x" aria-label="닫기">×</button>
    <h3>${esc(p.name)}</h3>
    <dl><dt>영주</dt><dd>${p.owner ? `<button class="linkish" data-person="${p.owner}">${esc(nm(p.owner))}</button>` : "공석"}</dd>
    <dt>개발도</dt><dd>${p.dev}</dd><dt>지형</dt><dd>${esc(p.terrain)}${p.capital ? ", 왕도" : ""}</dd>
    <dt>이웃</dt><dd>${p.adj.map(pname).map(esc).join(", ")}</dd>
    ${war ? `<dt>전쟁</dt><dd>${esc(nm(war.attacker))}의 침공 (전황 ${war.score > 0 ? "+" : ""}${war.score})</dd>` : ""}</dl>`;
  card.hidden = false;
  $(".x", card).onclick = () => { sel.prov = null; card.hidden = true; renderMap(); };
  $$("[data-person]", card).forEach((b) => (b.onclick = () => openPerson(b.dataset.person)));
}

/* ---------------- 연대기 ---------------- */
function renderChron() {
  const el = $("#pane-chron");
  if (!S.chronicle.length) {
    el.innerHTML = `<p class="empty">아직 기록된 계절이 없습니다. 위의 ‘다음 계절’을 누르면 인물들이 움직이고, 판관이 첫 연대기를 씁니다.</p>`;
    return;
  }
  el.innerHTML = `<div class="chron">${S.chronicle.slice().reverse().map((c) =>
    `<article><h4>${esc(c.date)}</h4><p>${esc(c.text)}</p></article>`).join("")}</div>`;
}

/* ---------------- 사건 ---------------- */
function renderEvents() {
  const list = S.events.filter((e) => {
    if (evFilter === "public") return e.public;
    if (evFilter === "secret") return !e.public;
    if (evFilter === "war") return ["war", "battle", "army", "death", "crown"].includes(e.kind);
    return true;
  }).slice(-250).reverse();
  $("#evlist").innerHTML = list.map((e) => `<li class="k-${e.kind}">
    <div class="meta"><span>${esc(e.date)}</span><span class="seal ${e.public ? "pub" : "secret"}">${e.public ? "공개" : "비밀"}</span></div>
    <div class="t">${esc(e.title)}</div><div class="b">${esc(e.text)}</div>
    ${!e.public && e.known_by.length ? `<div class="kb">아는 사람: ${e.known_by.map(nm).map(esc).join(", ")}</div>` : ""}
  </li>`).join("") || `<li class="empty">해당하는 사건이 없습니다.</li>`;
}

/* ---------------- 인물 ---------------- */
function badge(c) { return `<span class="badge ${ANTHROPIC.has(c.model) ? "anthropic" : "openai"}">${esc(c.model_label)}${c.mock ? " (모의)" : ""}</span>`; }
function openPerson(id) { sel.person = id; switchTab("people"); renderPeople(); }
function renderPeople() {
  const el = $("#pane-people");
  if (sel.person && S.chars[sel.person]) return renderDetail(el, S.chars[sel.person]);
  const groups = { major: [], semi: [], minor: [], dead: [] };
  for (const c of Object.values(S.chars)) (c.alive ? groups[c.tier] : groups.dead).push(c);
  const row = (c) => `<button class="person ${c.alive ? "" : "dead"}" data-id="${c.id}">
      <i class="shield" style="background:${c.color}"></i>
      <span><span class="nm">${esc(c.name)}</span><br><span class="ti">${esc(c.title)}${c.id === S.king ? " (재위)" : ""}</span></span>
      ${badge(c)}</button>`;
  el.innerHTML = Object.entries(groups).filter(([, v]) => v.length).map(([k, v]) =>
    `<h4 class="tier">${k === "dead" ? "세상을 떠난 이들" : TIER[k]}</h4>${v.sort((a, b) => b.prestige - a.prestige).map(row).join("")}`).join("");
  $$(".person", el).forEach((b) => (b.onclick = () => openPerson(b.dataset.id)));
}
function renderDetail(el, c) {
  const last = c.thoughts.at(-1);
  const ops = Object.entries(c.opinions).filter(([k]) => S.chars[k] && S.chars[k].alive).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `<div class="detail">
    <button class="back">목록으로</button>
    <h3>${esc(c.name)}</h3>
    <div class="sub">${esc(c.title)}, ${esc(c.house)}, ${c.age}세 ${badge(c)}</div>
    ${c.alive ? "" : `<p>${esc(c.death?.date)}에 세상을 떠남. ${esc(c.death?.cause)}</p>`}
    <div class="mind"><div class="lbl">속마음${last ? ` (${esc(last.date)}${last.mood ? ", " + esc(last.mood) : ""})` : ""}</div>
      <p>${last ? esc(last.text) : "아직 아무 생각도 드러나지 않았다."}</p></div>
    <div class="stats"><div><b>${c.gold}</b><span>금화</span></div><div><b>${c.prestige}</b><span>위신</span></div>
      <div><b>${c.levy}</b><span>병력${c.army_raised ? " (소집)" : ""}</span></div><div><b>${c.provinces.length}</b><span>영지</span></div></div>
    <div class="traits">${c.traits.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
    <h5>영지</h5><p>${c.provinces.map(pname).map(esc).join(", ") || "없음"}${c.liege ? `. 주군 ${esc(nm(c.liege))}` : ""}${c.heir ? `. 후계자 ${esc(nm(c.heir))}` : ""}</p>
    <h5>목표</h5><p>${esc(c.goals)}</p>
    <h5>인물상</h5><p>${esc(c.persona)}</p>
    <h5>비밀</h5><ul>${c.secrets.map((s) => `<li>${esc(s)}</li>`).join("") || "<li>없음</li>"}</ul>
    <h5>남들에 대한 감정</h5><div class="ops">${ops.map(([k, v]) => `<div class="op"><span>${esc(nm(k))}</span>
      <span class="bar2"><i style="left:${v < 0 ? 50 + v / 2 : 50}%;width:${Math.abs(v) / 2}%;background:${v < 0 ? "#b0503f" : "#7c9a5e"}"></i></span>
      <span class="v">${v > 0 ? "+" : ""}${v}</span></div>`).join("") || '<span class="empty">특별한 감정 없음</span>'}</div>
    <h5>그가 아는 것</h5><ul>${c.knowledge.slice(-12).reverse().map((k) => `<li>${esc(k.text)}</li>`).join("") || "<li>없음</li>"}</ul>
    <h5>지난 생각들</h5><ul>${c.thoughts.slice(0, -1).reverse().map((t) => `<li>${esc(t.date)}: ${esc(t.text)}</li>`).join("") || "<li>없음</li>"}</ul>
    ${c.alive ? `<h5>신의 손길</h5><div class="quick">
      <button class="ghost" data-q="whisper">계시 내리기</button>
      <button class="ghost" data-q="bless">금화 300 내리기</button>
      <button class="ghost danger" data-q="smite">벼락</button></div>` : ""}
  </div>`;
  $(".back", el).onclick = () => { sel.person = null; renderPeople(); };
  $$("[data-q]", el).forEach((b) => (b.onclick = () => quickGod(b.dataset.q, c)));
}
async function quickGod(kind, c) {
  let body = { kind, target: c.id };
  if (kind === "whisper") { const t = prompt(`${c.name}에게 들려줄 목소리`); if (!t) return; body.text = t; }
  if (kind === "bless") body.gold = 300;
  if (kind === "smite") { if (!confirm(`${c.name}에게 벼락을 내립니까? 되돌릴 수 없습니다.`)) return; body.text = "하늘의 벼락"; }
  toast(G.god(body));
}

/* ---------------- 신의 권능 ---------------- */
function renderGod() {
  const el = $("#pane-god");
  const alive = Object.values(S.chars).filter((c) => c.alive).sort((a, b) => b.prestige - a.prestige);
  const copt = alive.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const popt = Object.values(S.provinces).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  const keep = {}; $$("select, textarea, input", el).forEach((x) => (keep[x.id] = x.value));
  el.innerHTML = `<div class="god">
    <section><h4>섭리</h4><p class="hint">세상에 일어날 일을 정합니다. 다음 계절 판관이 이 일을 실제로 일으키고 결과를 정합니다.</p>
      <textarea id="g-decree" placeholder="예: 북부 늪지에서 역병이 시작된다"></textarea>
      <div class="acts"><button class="ghost" data-g="decree">섭리 내리기</button></div></section>
    <section><h4>계시</h4><p class="hint">한 인물의 꿈에 목소리를 들려줍니다. 그 인물만 알고, 믿을지는 그 사람 몫입니다.</p>
      <select id="g-wt">${copt}</select><textarea id="g-whisper" placeholder="예: 네 형제의 잔을 조심하라"></textarea>
      <div class="acts"><button class="ghost" data-g="whisper">계시 내리기</button></div></section>
    <section><h4>새 인물</h4><p class="hint">Terra가 이 설명대로 인물을 만들어 다음 계절 끝에 등장시킵니다.</p>
      <textarea id="g-spawn" placeholder="예: 루트비히의 사생아를 자처하는 젊은 용병"></textarea>
      <div class="acts"><button class="ghost" data-g="spawn">인물 보내기</button></div></section>
    <section><h4>영지 하사</h4><div class="row2"><select id="g-gp">${popt}</select><select id="g-gt">${copt}</select></div>
      <div class="acts"><button class="ghost" data-g="give">영지 넘기기</button></div></section>
    <section><h4>축복과 벼락</h4><div class="row2"><select id="g-bt">${copt}</select><input id="g-bg" type="number" value="300" step="50"></div>
      <div class="acts"><button class="ghost" data-g="bless">금화 내리기</button><button class="ghost danger" data-g="smite">벼락 내리기</button></div></section>
    <section><h4>배역 바꾸기</h4><p class="hint">인물의 등급과 그를 연기하는 모델을 바꿉니다.</p>
      <div class="row2"><select id="g-rt">${copt}</select><select id="g-rtier"><option value="major">주요 인물</option><option value="semi">준주요 인물</option><option value="minor">단역</option></select></div>
      <select id="g-rm"><option value="sol">GPT-6.1 Sol</option><option value="sonnet">Sonnet 5.5</option><option value="luna">GPT-6 Luna</option><option value="haiku">Haiku 5.5</option><option value="terra">GPT-6.1 Terra</option></select>
      <div class="acts"><button class="ghost" data-g="promote">배역 바꾸기</button></div></section>
    <section><h4>세계</h4><p class="hint">새 세계는 지금 세계를 지우고 처음부터 시작합니다. 지출 기록은 남습니다. 지우기 전에 설정에서 내보내 둘 수 있습니다.</p>
      <div class="acts"><button class="ghost danger" id="g-reset">새 세계 시작</button><button class="ghost" id="g-ureset">지출 기록 초기화</button></div></section>
  </div>`;
  for (const [k, v] of Object.entries(keep)) { const x = document.getElementById(k); if (x && v && [...(x.options || [{ value: v }])].some((o) => o.value === v)) x.value = v; }
  $$("[data-g]", el).forEach((b) => (b.onclick = () => god(b.dataset.g)));
  $("#g-reset").onclick = async () => {
    if (!confirm("지금 세계를 지우고 새로 시작합니까?")) return;
    if (G.state.status.running) return toast("진행 중에는 새 세계를 만들 수 없습니다.");
    sigs = {}; sel = { prov: null, person: null }; $("#pcard").hidden = true; G.reset(); toast("새 세계가 열렸습니다.");
  };
  $("#g-ureset").onclick = () => { if (confirm("지출 기록을 0으로 돌립니까? 새 달이 되면 자동으로 초기화됩니다.")) G.resetUsage(); };
}
async function god(kind) {
  const v = (id) => document.getElementById(id).value;
  const body = { kind };
  if (kind === "decree") { body.text = v("g-decree").trim(); if (!body.text) return toast("섭리 내용을 적어 주세요."); }
  if (kind === "whisper") { body.target = v("g-wt"); body.text = v("g-whisper").trim(); if (!body.text) return toast("들려줄 말을 적어 주세요."); }
  if (kind === "spawn") { body.text = v("g-spawn").trim(); if (!body.text) return toast("어떤 인물인지 적어 주세요."); }
  if (kind === "give") { body.province = v("g-gp"); body.target = v("g-gt"); }
  if (kind === "bless") { body.target = v("g-bt"); body.gold = +v("g-bg") || 0; }
  if (kind === "smite") { body.target = v("g-bt"); if (!confirm(`${nm(body.target)}에게 벼락을 내립니까?`)) return; body.text = "하늘의 벼락"; }
  if (kind === "promote") { body.target = v("g-rt"); body.tier = v("g-rtier"); body.model = v("g-rm"); }
  toast(G.god(body));
  ["g-decree", "g-whisper", "g-spawn"].forEach((id) => { if (kind !== "give") document.getElementById(id).value = ""; });
  sigs.people = ""; refresh();
}

/* ---------------- 탭, 시작 ---------------- */
function switchTab(t) {
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  $$(".pane").forEach((p) => (p.hidden = p.id !== "pane-" + t));
}
$$(".tabs button").forEach((b) => (b.onclick = () => { if (b.dataset.tab === "people" && sel.person && $("#pane-people").hidden === false) { sel.person = null; renderPeople(); } switchTab(b.dataset.tab); }));
$$("#evfilters button").forEach((b) => (b.onclick = () => {
  evFilter = b.dataset.f; $$("#evfilters button").forEach((x) => x.classList.toggle("on", x === b)); renderEvents();
}));
$("#btnTurn").onclick = nextTurn;
$("#auto").onchange = () => { if (!$("#auto").checked) { clearTimeout(autoTimer); autoTimer = null; } else schedule(); };
$("#map").addEventListener("mousemove", onMove);
$("#map").addEventListener("mouseleave", () => ($("#tip").hidden = true));
$("#map").addEventListener("click", onClick);
window.addEventListener("resize", () => renderMap());

/* ---------------- 설정 ---------------- */
const ROLE = { gm: "판관", sol: "주요 (Sol)", sonnet: "주요 (Sonnet)", luna: "준주요 (Luna)", haiku: "준주요 (Haiku)", terra: "단역·생성" };
function openSettings() {
  const st = G.settings;
  $("#k-anthropic").value = st.keys.anthropic; $("#k-openai").value = st.keys.openai;
  $("#b-anthropic").value = st.budget.anthropic; $("#b-openai").value = st.budget.openai;
  $("#mrows").innerHTML = Object.entries(st.models).map(([k, m]) => `<div class="mrow"><span>${ROLE[k] || k}</span>
    <input type="text" data-model="${k}" value="${esc(m.model)}" spellcheck="false" autocapitalize="off">
    ${m.provider === "openai" ? `<select data-reason="${k}">${["none", "low", "medium", "high"].map((r) => `<option ${m.reasoning === r ? "selected" : ""}>${r}</option>`).join("")}</select>` : "<span></span>"}</div>`).join("");
  $("#settings").showModal();
}
$("#sform").addEventListener("submit", () => {
  const st = G.settings;
  st.keys.anthropic = $("#k-anthropic").value.trim(); st.keys.openai = $("#k-openai").value.trim();
  st.budget.anthropic = +$("#b-anthropic").value || 100; st.budget.openai = +$("#b-openai").value || 100;
  $$("[data-model]").forEach((i) => {
    const k = i.dataset.model, v = i.value.trim();
    if (v && v !== st.models[k].model) {
      // 새 모델 ID면 기존 단가를 그대로 빌려 쓴다 (정확한 값은 직접 고칠 것)
      if (!st.pricing[v]) st.pricing[v] = st.pricing[st.models[k].model] || { in: 0, out: 0 };
      st.models[k].model = v;
    }
  });
  $$("[data-reason]").forEach((s) => (st.models[s.dataset.reason].reasoning = s.value));
  saveSettings(st); sigs = {}; refresh();
  toast(st.keys.anthropic || st.keys.openai ? "저장했습니다. 다음 계절부터 실제 모델이 움직입니다." : "저장했습니다. 키가 없어 모의 응답으로 돌아갑니다.");
});
$("#s-cancel").onclick = () => $("#settings").close();
$("#btnSettings").onclick = openSettings;
$("#s-export").onclick = () => {
  const blob = new Blob([G.exportJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `rotwald-${G.date().replace(/\s/g, "-")}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$("#s-import").onclick = () => $("#s-file").click();
$("#s-file").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { G.importJSON(await f.text()); sigs = {}; sel = { prov: null, person: null }; $("#settings").close(); toast("세계를 불러왔습니다."); }
  catch (err) { toast("불러오지 못했습니다: " + err.message); }
  e.target.value = "";
};
document.addEventListener("visibilitychange", () => { if (!document.hidden && S && (S.status.running || $("#auto").checked)) holdScreen(true); });

MAP = G.map;
G.onChange = refresh;
refresh();
if (document.fonts) document.fonts.ready.then(renderMap);
if (!G.settings.keys.anthropic && !G.settings.keys.openai) setTimeout(() => toast("설정에서 API 키를 넣으면 실제 모델이 움직입니다. 지금은 모의 응답입니다."), 600);
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
