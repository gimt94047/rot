"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ANTHROPIC = new Set(["gm", "sonnet", "haiku"]);
const TIER = { major: "주요 인물", semi: "준주요 인물", minor: "단역" };

let S = null, MAP = null, sel = { prov: null, person: null }, evFilter = "all";
let sigs = {}, autoTimer = null;

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

/* 땅 색은 계산만 캐시하고, 그리기는 매번 화면 캔버스에 직접 한다.
   (안드로이드는 앱을 잠깐 나갔다 오면 화면 밖 캔버스의 내용을 비워 버려서, 그림을 캐시하면 지도가 사라진다) */
let landCache = null;
function landColors() {
  const { w, h, grid, order } = MAP;
  const owners = order.map((id) => S.provinces[id].owner);
  const sig = owners.join() + Object.values(S.chars).map((c) => c.color).join();
  if (landCache && landCache.sig === sig) return landCache;
  if (!landCache) { // 바다 깊이는 한 번만 계산
    const dist = new Int16Array(w * h).fill(99), q = [];
    for (let i = 0; i < w * h; i++) if (grid[i] >= 0) { dist[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (dist[j] > dist[i] + 1 && dist[i] < 5) { dist[j] = dist[i] + 1; q.push(j); }
      }
    }
    landCache = { dist };
  }
  const colors = new Array(w * h), dist = landCache.dist;
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
    colors[i] = `rgb(${r | 0},${gg | 0},${b | 0})`;
  }
  landCache = { dist, sig, colors, owners };
  return landCache;
}
function drawLand(g, f) {
  const { w, h, grid } = MAP, { colors, owners } = landColors();
  g.save();
  g.translate(f.ox, f.oy); g.scale(f.s, f.s);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    g.fillStyle = colors[y * w + x];
    g.fillRect(x * CELL, y * CELL, CELL + 0.6, CELL + 0.6); // 살짝 겹쳐 칸 사이 틈을 없앤다
  }
  const W = w * CELL, H = h * CELL;
  g.strokeStyle = "rgba(200,215,225,0.035)"; g.lineWidth = 1 / f.s;
  g.beginPath();
  for (let k = -H; k < W; k += 9) { g.moveTo(k, 0); g.lineTo(k + H, H); }
  g.stroke();
  const ownerOf = (i) => (grid[i] < 0 ? null : owners[grid[i]]);
  const reg = MAP.region, lw = 1 / Math.sqrt(view.z);
  const seg = (style, width, test) => {
    g.beginPath(); g.strokeStyle = style; g.lineWidth = width * lw; g.lineCap = "square";
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w && test(i, i + 1)) { g.moveTo((x + 1) * CELL, y * CELL); g.lineTo((x + 1) * CELL, (y + 1) * CELL); }
      if (y + 1 < h && test(i, i + w)) { g.moveTo(x * CELL, (y + 1) * CELL); g.lineTo((x + 1) * CELL, (y + 1) * CELL); }
    }
    g.stroke();
  };
  const land = (a, b) => grid[a] >= 0 && grid[b] >= 0;
  seg("rgba(30,22,14,0.22)", 0.8, (a, b) => land(a, b) && grid[a] !== grid[b] && reg[a] === reg[b] && ownerOf(a) === ownerOf(b));
  seg("rgba(30,22,14,0.6)", 1.5, (a, b) => land(a, b) && reg[a] !== reg[b] && ownerOf(a) === ownerOf(b));
  seg("rgba(24,16,10,0.92)", 2.6, (a, b) => land(a, b) && ownerOf(a) !== ownerOf(b));
  seg("rgba(12,10,8,0.95)", 3, (a, b) => (grid[a] < 0) !== (grid[b] < 0));
  g.restore();
}

/* 확대·이동 */
const view = { z: 1, px: 0, py: 0 };
function fit() {
  const c = $("#map"), wrap = $("#mapwrap");
  const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const s0 = Math.min(W / (MAP.w * CELL), H / (MAP.h * CELL)) * 0.97, s = s0 * view.z;
  const mw = MAP.w * CELL * s, mh = MAP.h * CELL * s;
  // 지도가 화면 밖으로 다 나가지 않게
  const limX = Math.max(0, (mw - W) / 2 + 40), limY = Math.max(0, (mh - H) / 2 + 40);
  view.px = clamp(view.px, -limX, limX); view.py = clamp(view.py, -limY, limY);
  return { dpr, W, H, s, ox: (W - mw) / 2 + view.px, oy: (H - mh) / 2 + view.py };
}
function zoomAt(nz, cx, cy) {
  const f = fit();
  const mx = (cx - f.ox) / f.s, my = (cy - f.oy) / f.s; // 손가락 아래의 지도 좌표
  view.z = clamp(nz, 1, 6);
  const f2 = fit();
  view.px += cx - (f2.ox + mx * f2.s); view.py += cy - (f2.oy + my * f2.s);
  $("#map").style.touchAction = view.z > 1.01 ? "none" : "pan-y";
  requestRender();
}

const TIER_STYLE = {
  metropolis: { r: 6.5, show: 0, font: 1.12, weight: 700 },
  city: { r: 5, show: 0, font: 0.98, weight: 700 },
  town: { r: 3.6, show: 1.5, font: 0.86, weight: 400 },
  village: { r: 2.4, show: 2.4, font: 0.78, weight: 400 },
};
let rafPending = false;
function requestRender() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; renderMap(); }); }
function renderMap() {
  if (!MAP || !S) return;
  const c = $("#map"), g = c.getContext("2d"), f = fit();
  g.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
  g.fillStyle = "#15212b"; g.fillRect(0, 0, f.W, f.H);
  drawLand(g, f);
  const P = (x, y) => [f.ox + (x + 0.5) * CELL * f.s, f.oy + (y + 0.5) * CELL * f.s];

  // 선택한 영지 테두리
  if (sel.prov && S.provinces[sel.prov]) {
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
  const fs = Math.max(10, Math.min(15, 13 * Math.sqrt(f.s * CELL / 8))) * Math.min(1.35, Math.sqrt(view.z));
  const boxes = [];
  const free = (b) => !boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  const label = (text, x, y, size, { weight = 400, color = "#f3ead6", alpha = 1, spacing = 0, force = false } = {}) => {
    g.font = `${weight} ${size}px "Song Myung", "Nanum Myeongjo", serif`;
    g.letterSpacing = spacing + "px";
    const tw = g.measureText(text).width, b = { x: x - tw / 2 - 2, y: y - size / 2 - 1, w: tw + 4, h: size + 2 };
    if (!force && !free(b)) { g.letterSpacing = "0px"; return false; }
    boxes.push(b);
    g.globalAlpha = alpha; g.lineWidth = 3.2; g.strokeStyle = "rgba(20,14,8,0.85)"; g.strokeText(text, x, y);
    g.fillStyle = color; g.fillText(text, x, y); g.globalAlpha = 1; g.letterSpacing = "0px";
    return true;
  };
  g.textAlign = "center"; g.textBaseline = "middle";

  // 폐허
  if (view.z >= 1.5) for (const r of S.ruins || []) {
    const [x, y] = P(r.x, r.y), k = 3;
    g.strokeStyle = "rgba(20,14,8,0.6)"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); g.stroke();
  }
  // 정착지 표시
  const setts = Object.values(S.settlements).sort((a, b) => b.pop - a.pop);
  const capitalSett = setts.find((s) => S.provinces[s.county]?.capital);
  const mk = Math.min(1.6, Math.sqrt(view.z));
  for (const s of setts) {
    const t = tierOf(s.pop).key, st = TIER_STYLE[t], [x, y] = P(s.x, s.y), r = st.r * mk;
    g.lineWidth = 1.4; g.strokeStyle = "rgba(20,14,8,0.95)";
    if (t === "village") { g.fillStyle = "#efe6cf"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else if (t === "town") { g.fillStyle = "#efe6cf"; g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeRect(x - r, y - r, r * 2, r * 2); }
    else if (t === "city") {
      g.fillStyle = "#efe6cf"; g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = "#2a2119"; g.fillRect(x - r * 0.35, y - r * 0.35, r * 0.7, r * 0.7);
    } else {
      g.fillStyle = "#d8b25c"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fillStyle = "#2a2119"; g.fill();
    }
    if (t === "city" || t === "metropolis" || view.z >= 2.4) boxes.push({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
  }
  if (capitalSett) { const [x, y] = P(capitalSett.x, capitalSett.y); drawCrown(g, x, y - 13 * mk, 10 * mk); boxes.push({ x: x - 7 * mk, y: y - 18 * mk, w: 14 * mk, h: 10 * mk }); }
  // 이름: 큰 도시 → 주 이름 → 소도시 → 마을 순으로, 겹치면 뺀다
  const nameOf = (s) => {
    const t = tierOf(s.pop).key, st = TIER_STYLE[t], [x, y] = P(s.x, s.y);
    if (view.z < st.show) return;
    label(s.name, x, y + st.r * mk + fs * st.font * 0.75, fs * st.font, { weight: st.weight });
  };
  setts.filter((s) => s.pop >= 5000).forEach(nameOf);
  for (const r of Object.values(MAP.regions)) {
    const [x, y] = P(r.cx, r.cy);
    label(r.name, x, y, fs * 1.08, { color: "#f5e7c0", alpha: view.z > 2.2 ? 0.45 : 0.72, spacing: 2 });
  }
  setts.filter((s) => s.pop < 5000).forEach(nameOf);
  // 전쟁 표시
  for (const w of S.wars) {
    const p = S.provinces[w.province]; if (!p) continue;
    const [x, y] = P(p.cx, p.cy);
    drawSeal(g, x, y, fs * 0.75);
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
function cellAtXY(cx, cy) {
  const f = fit();
  const x = Math.floor((cx - f.ox) / (CELL * f.s)), y = Math.floor((cy - f.oy) / (CELL * f.s));
  if (x < 0 || y < 0 || x >= MAP.w || y >= MAP.h) return null;
  const idx = MAP.grid[y * MAP.w + x];
  return idx < 0 ? null : MAP.order[idx];
}
const local = (ev) => { const r = $("#map").getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
function showTip(ev) {
  const [lx, ly] = local(ev), id = cellAtXY(lx, ly), tip = $("#tip");
  if (!id) { tip.hidden = true; return; }
  const p = S.provinces[id], st = settlementsIn(id);
  tip.innerHTML = `<b>${esc(p.name)}</b> <span style="color:var(--muted)">${esc(MAP.regions[p.region].name)}주</span><br>${esc(nm(p.owner))}<br>${st.length ? st.map((s) => `${esc(s.name)} ${tierOf(s.pop).name}`).join(", ") : "정착지 없음"}`;
  tip.hidden = false;
  tip.style.left = Math.min(lx + 14, $("#mapwrap").clientWidth - 200) + "px";
  tip.style.top = ly + 14 + "px";
}
function select(lx, ly) {
  const id = cellAtXY(lx, ly);
  sel.prov = id; renderMap();
  if (id) renderPcard(); else $("#pcard").hidden = true;
}
const settlementsIn = (pid) => Object.values(S.settlements).filter((s) => s.county === pid).sort((a, b) => b.pop - a.pop);

/* 손가락: 한 손가락 탭 = 선택, 끌기 = 이동(확대했을 때), 두 손가락 = 확대 */
const ptrs = new Map();
let gesture = null;
function onDown(ev) {
  ptrs.set(ev.pointerId, local(ev));
  $("#map").setPointerCapture?.(ev.pointerId);
  if (ptrs.size === 1) { const [x, y] = local(ev); gesture = { type: "tap", x0: x, y0: y, px: view.px, py: view.py }; }
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    gesture = { type: "pinch", d0: Math.hypot(a[0] - b[0], a[1] - b[1]), z0: view.z, c0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  }
}
function onPMove(ev) {
  if (ev.pointerType === "mouse" && !ptrs.size) return showTip(ev);
  if (!ptrs.has(ev.pointerId)) return;
  ptrs.set(ev.pointerId, local(ev));
  if (!gesture) return;
  if (gesture.type === "pinch" && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    zoomAt(gesture.z0 * d / gesture.d0, c[0], c[1]);
    gesture.z0 = view.z; gesture.d0 = d;
    view.px += c[0] - gesture.c0[0]; view.py += c[1] - gesture.c0[1]; gesture.c0 = c;
    requestRender();
  } else if (gesture.type === "tap" || gesture.type === "drag") {
    const [x, y] = local(ev), dx = x - gesture.x0, dy = y - gesture.y0;
    if (gesture.type === "tap" && Math.hypot(dx, dy) > 6) gesture.type = "drag";
    if (gesture.type === "drag" && view.z > 1.01) { view.px = gesture.px + dx; view.py = gesture.py + dy; $("#tip").hidden = true; requestRender(); }
  }
}
function onUp(ev) {
  const had = ptrs.has(ev.pointerId);
  ptrs.delete(ev.pointerId);
  if (had && gesture?.type === "tap" && !ptrs.size && ev.type === "pointerup") select(gesture.x0, gesture.y0);
  if (!ptrs.size) gesture = null;
  else if (gesture?.type === "pinch") gesture = { type: "none" };
}
function renderPcard() {
  const p = S.provinces[sel.prov], card = $("#pcard");
  if (!p) { card.hidden = true; return; }
  const war = S.wars.find((w) => w.province === p.id), st = settlementsIn(p.id);
  const pop = st.reduce((a, s) => a + s.pop, 0);
  card.innerHTML = `<button class="x" aria-label="닫기">×</button>
    <h3>${esc(p.name)}</h3>
    <div class="region">${esc(MAP.regions[p.region].name)}주${p.capital ? ", 왕도" : p.seat ? ", 주도" : ""}</div>
    <dl><dt>영주</dt><dd>${p.owner ? `<button class="linkish" data-person="${p.owner}">${esc(nm(p.owner))}</button>` : "공석"}</dd>
    <dt>개발도</dt><dd>${p.dev}, ${esc(p.terrain)}</dd>
    <dt>인구</dt><dd>${pop.toLocaleString()}명</dd>
    ${war ? `<dt>전쟁</dt><dd>${esc(nm(war.attacker))}의 침공 (전황 ${war.score > 0 ? "+" : ""}${war.score})</dd>` : ""}</dl>
    <ul class="setts">${st.map((s) => `<li><span>${esc(s.name)}</span><span>${tierOf(s.pop).name}</span><span>${s.pop.toLocaleString()}</span></li>`).join("") || "<li>정착지 없음</li>"}</ul>`;
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
  const byReg = {}; for (const p of Object.values(S.provinces)) (byReg[p.region] ||= []).push(p);
  const popt = Object.entries(byReg).map(([rid, ps]) => `<optgroup label="${esc(MAP.regions[rid].name)}주">${ps.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</optgroup>`).join("");
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
$("#map").addEventListener("pointerdown", onDown);
$("#map").addEventListener("pointermove", onPMove);
$("#map").addEventListener("pointerup", onUp);
$("#map").addEventListener("pointercancel", onUp);
$("#map").addEventListener("mouseleave", () => ($("#tip").hidden = true));
$("#map").addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(view.z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), x, y); }, { passive: false });
$("#zin").onclick = () => zoomAt(view.z * 1.5, $("#mapwrap").clientWidth / 2, $("#mapwrap").clientHeight / 2);
$("#zout").onclick = () => { if (view.z / 1.5 <= 1.01) { view.z = 1; view.px = view.py = 0; $("#map").style.touchAction = "pan-y"; renderMap(); } else zoomAt(view.z / 1.5, $("#mapwrap").clientWidth / 2, $("#mapwrap").clientHeight / 2); };
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  renderMap();
  if (S && (S.status.running || $("#auto").checked)) holdScreen(true);
});
$("#map").addEventListener("contextrestored", () => renderMap());
window.addEventListener("pageshow", () => renderMap());

MAP = G.map;
G.onChange = refresh;
refresh();
if (document.fonts) document.fonts.ready.then(renderMap);
if (!G.settings.keys.anthropic && !G.settings.keys.openai) setTimeout(() => toast("설정에서 API 키를 넣으면 실제 모델이 움직입니다. 지금은 모의 응답입니다."), 600);
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
