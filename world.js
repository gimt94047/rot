"use strict";
/* 지도(주 → 영지)와 정착지(마을·소도시·중도시·대도시) 생성. engine.js보다 먼저 불러온다. */

const TIERS = [
  { key: "village", name: "마을", min: 0 },
  { key: "town", name: "소도시", min: 1000 },
  { key: "city", name: "중도시", min: 5000 },
  { key: "metropolis", name: "대도시", min: 15000 },
];
const RUIN_BELOW = 100;
const tierOf = (pop) => { let t = TIERS[0]; for (const x of TIERS) if (pop >= x.min) t = x; return t; };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 중부 유럽풍 지명 */
const NAME_PRE = ["아이헨", "부헨", "린덴", "슈타인", "하젠", "볼펜", "로텐", "브라이텐", "알텐", "노이", "오버", "운터", "키르히", "뮐",
  "하르트", "에셴", "도른", "펠젠", "브루넨", "그륀", "바이덴", "에를렌", "타넨", "피히텐", "라인", "호엔", "니더", "클라인", "그로스", "베르",
  "쾰", "자이프", "에겐", "엔겐", "프라이", "회르", "마르크", "올", "디트", "하일"];
const NAME_SUF = ["도르프", "바흐", "하임", "하우젠", "펠트", "부르크", "탈", "브뤼크", "발트", "베르크", "하겐", "로데", "슈테트", "아우",
  "브룬", "바일러", "호펜", "킬헨", "그룬트", "에크"];
function makeNamer(rng, taken) {
  return () => {
    for (let i = 0; i < 400; i++) {
      const n = NAME_PRE[Math.floor(rng() * NAME_PRE.length)] + NAME_SUF[Math.floor(rng() * NAME_SUF.length)];
      if (!taken.has(n)) { taken.add(n); return n; }
    }
    const n = "새 마을 " + taken.size; taken.add(n); return n;
  };
}

/* 주 경계(파이썬판과 같은 지형) → 주마다 2~4개 영지로 분할 */
function buildMap(seed = 7) {
  const W = DATA.grid_w, H = DATA.grid_h, regs = DATA.provinces;
  const region = new Array(W * H).fill(-1), cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wx = x + (_fbm(x / 18, y / 18, seed) - 0.5) * 16;
    const wy = y + (_fbm(x / 18 + 40, y / 18 + 40, seed) - 0.5) * 16;
    const dx = (x - cx) / (W * 0.47), dy = (y - cy) / (H * 0.46);
    const coast = Math.sqrt(dx * dx + dy * dy) + (_fbm(x / 14, y / 14, seed + 99) - 0.5) * 0.45;
    if (coast > 0.93) continue;
    let best = -1, bd = 1e9;
    regs.forEach((p, i) => { const d = (wx - p[2]) ** 2 + (wy - p[3]) ** 2; if (d < bd) { bd = d; best = i; } });
    if (bd > 900) continue;
    region[y * W + x] = best;
  }
  const rng = mulberry32(seed * 7919 + 11);
  const cellsOf = regs.map(() => []);
  for (let i = 0; i < W * H; i++) if (region[i] >= 0) cellsOf[region[i]].push(i);

  const counties = []; // {id, name, region, seedCell, seat}
  const grid = new Array(W * H).fill(-1);
  const taken = new Set(regs.map((r) => r[1]));
  const namer = makeNamer(rng, taken);
  regs.forEach((r, ri) => {
    const cells = cellsOf[ri];
    if (!cells.length) return;
    const k = Math.max(2, Math.min(4, Math.round(cells.length / 230)));
    // 첫 씨앗은 주의 원래 중심(주도), 나머지는 서로 가장 먼 칸
    const seeds = [r[3] * W + r[2]];
    if (region[seeds[0]] !== ri) seeds[0] = cells[Math.floor(cells.length / 2)];
    while (seeds.length < k) {
      let bestC = cells[0], bestD = -1;
      for (const c of cells) {
        const x = c % W, y = (c / W) | 0;
        let md = 1e9;
        for (const s of seeds) md = Math.min(md, (x - (s % W)) ** 2 + (y - ((s / W) | 0)) ** 2);
        md *= 0.85 + rng() * 0.3;
        if (md > bestD) { bestD = md; bestC = c; }
      }
      seeds.push(bestC);
    }
    const base = counties.length;
    seeds.forEach((s, j) => counties.push({
      id: j === 0 ? r[0] : `${r[0]}_${j}`, name: j === 0 ? r[1] : namer(), region: r[0], regionIdx: ri, seedCell: s, seat: j === 0,
    }));
    for (const c of cells) {
      const x = c % W, y = (c / W) | 0;
      const wx = x + (_fbm(x / 9 + 300, y / 9, seed + 5) - 0.5) * 8, wy = y + (_fbm(x / 9, y / 9 + 300, seed + 6) - 0.5) * 8;
      let bj = 0, bd = 1e9;
      seeds.forEach((s, j) => { const d = (wx - (s % W)) ** 2 + (wy - ((s / W) | 0)) ** 2; if (d < bd) { bd = d; bj = j; } });
      grid[c] = base + bj;
    }
  });

  // 영지별 무게중심·인접, 주별 무게중심
  const n = counties.length, adj = counties.map(() => new Set());
  const sx = Array(n).fill(0), sy = Array(n).fill(0), cnt = Array(n).fill(0);
  const rx = regs.map(() => 0), ry = regs.map(() => 0), rc = regs.map(() => 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = grid[y * W + x]; if (p < 0) continue;
    sx[p] += x; sy[p] += y; cnt[p]++;
    const ri = counties[p].regionIdx; rx[ri] += x; ry[ri] += y; rc[ri]++;
    for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
      if (nx < W && ny < H) { const q = grid[ny * W + nx]; if (q >= 0 && q !== p) { adj[p].add(q); adj[q].add(p); } }
    }
  }
  const geo = {}, cellsByCounty = counties.map(() => []);
  for (let i = 0; i < W * H; i++) if (grid[i] >= 0) cellsByCounty[grid[i]].push(i);
  counties.forEach((c, i) => {
    geo[c.id] = { idx: i, cx: +(sx[i] / Math.max(1, cnt[i])).toFixed(1), cy: +(sy[i] / Math.max(1, cnt[i])).toFixed(1),
      adj: [...adj[i]].map((j) => counties[j].id).sort(), region: c.region, cells: cnt[i] };
  });
  const regions = {};
  regs.forEach((r, i) => { regions[r[0]] = { id: r[0], name: r[1], idx: i, cx: rx[i] / Math.max(1, rc[i]), cy: ry[i] / Math.max(1, rc[i]) }; });
  return { w: W, h: H, grid, region, counties, geo, regions, cellsByCounty, order: counties.map((c) => c.id) };
}

/* 시작 세계: 주의 소유자·개발도를 영지에 나눠 주고, 정착지를 심는다 */
function newWorldState(map) {
  const init = clone(DATA.initial);
  const rng = mulberry32(1402);
  const regionInfo = init.provinces; // 파이썬판의 주 정보 (소유자, 개발도, 지형)
  const W = map.w;
  const taken = new Set(map.counties.map((c) => c.name));
  const namer = makeNamer(rng, taken);
  const provinces = {}, settlements = {};
  let sid = 0;
  const addSettlement = (county, cell, name, pop) => {
    const id = "s" + (++sid);
    settlements[id] = { id, name, county, x: cell % W, y: (cell / W) | 0, pop: Math.round(pop), founded: 0, peak: Math.round(pop) };
    return id;
  };
  for (const c of map.counties) {
    const r = regionInfo[c.region];
    const dev = c.seat ? r.dev : Math.max(1, r.dev - (rng() < 0.6 ? 1 : 0));
    provinces[c.id] = { id: c.id, name: c.name, region: c.region, dev, terrain: r.terrain, owner: r.owner,
      capital: c.id === "ratstadt", seat: c.seat };
    // 주 소재지
    let pop;
    if (c.id === "ratstadt") pop = 16000 + rng() * 2000;
    else if (c.seat) pop = { 5: 9000, 4: 6000 + rng() * 3000, 3: 2500 + rng() * 4000, 2: 1000 + rng() * 900, 1: 500 + rng() * 300 }[r.dev] || 800;
    else pop = rng() < 0.2 ? 1000 + rng() * 600 : 250 + rng() * 600;
    addSettlement(c.id, c.seedCell, c.name, pop);
    // 덤으로 마을 하나 (중심에서 떨어진 칸)
    if (rng() < 0.65) {
      const cells = map.cellsByCounty[map.geo[c.id].idx];
      const sxx = c.seedCell % W, syy = (c.seedCell / W) | 0;
      const far = cells.filter((k) => ((k % W) - sxx) ** 2 + (((k / W) | 0) - syy) ** 2 > 36);
      if (far.length) addSettlement(c.id, far[Math.floor(rng() * far.length)], namer(), 150 + rng() * 450);
    }
  }
  init.provinces = provinces;
  init.settlements = settlements;
  init.ruins = [];
  init.next_sid = sid;
  init.version = 2;
  return init;
}
