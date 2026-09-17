import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

/* Генератор карты мира для секции «География».

   Запуск:  node tools/make-world.mjs
   Пишет:   assets/js/world.js

   Исходники Natural Earth скачиваются в tools/.cache при первом запуске и в
   репозиторий не кладутся: они весят почти мегабайт, а нужны только здесь.
   Готовый файл данных — кладётся, как и land.js: сайт во время работы ничего
   не загружает. */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "tools", ".cache");
const WORK = ROOT;

const SOURCES = {
  "ne110.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
  "tiny.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_tiny_countries.geojson",
};
fs.mkdirSync(CACHE, { recursive: true });
for (const [name, url] of Object.entries(SOURCES)) {
  const p = path.join(CACHE, name);
  if (fs.existsSync(p)) continue;
  console.log("качаю " + name);
  execFileSync("curl", ["-sL", "--max-time", "180", "-o", p, url], { stdio: "inherit" });
}
const HERE = CACHE;

/* ---- рамка и проекция --------------------------------------------------- */

const LAT_TOP = 83, LAT_BOT = -56;      // выше — лёд, ниже — Антарктида
const W = 1000;

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const RT3_2 = Math.sqrt(3) / 2;

function equalEarth(lonDeg, latDeg) {
  const lam = lonDeg * Math.PI / 180;
  const phi = latDeg * Math.PI / 180;
  const th = Math.asin(Math.max(-1, Math.min(1, RT3_2 * Math.sin(phi))));
  const t2 = th * th, t3 = t2 * th, t6 = t3 * t3, t7 = t6 * th, t8 = t7 * th, t9 = t8 * th;
  const den = 3 * (9 * A4 * t8 + 7 * A3 * t6 + 3 * A2 * t2 + A1);
  return [2 * Math.sqrt(3) * lam * Math.cos(th) / den, A4 * t9 + A3 * t7 + A2 * t3 + A1 * th];
}

const X_HALF = equalEarth(180, 0)[0];
const Y_TOP = equalEarth(0, LAT_TOP)[1];
const Y_BOT = equalEarth(0, LAT_BOT)[1];
const H = Math.round(W * (Y_TOP - Y_BOT) / (2 * X_HALF));

const project = ([lon, lat]) => {
  const la = Math.max(LAT_BOT, Math.min(LAT_TOP, lat));
  const [x, y] = equalEarth(lon, la);
  return [((x + X_HALF) / (2 * X_HALF)) * W, ((Y_TOP - y) / (Y_TOP - Y_BOT)) * H];
};

/* ---- упрощение ---------------------------------------------------------- */

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, best = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* У замкнутого кольца первая и последняя точки совпадают, отрезок между ними
   вырожден, и перпендикулярное расстояние до него равно нулю для всех точек
   сразу — обычный Дуглас-Пекер оставляет две точки и страна исчезает.
   Лечится разрезом в самой дальней от начала точке. */
function dpRing(pts, tol) {
  const n = pts.length;
  const closed = n > 3 &&
    Math.abs(pts[0][0] - pts[n - 1][0]) < 1e-9 &&
    Math.abs(pts[0][1] - pts[n - 1][1]) < 1e-9;
  if (!closed) return dp(pts, tol);
  const body = pts.slice(0, -1);
  let far = 0, best = -1;
  for (let i = 1; i < body.length; i++) {
    const d = Math.hypot(body[i][0] - body[0][0], body[i][1] - body[0][1]);
    if (d > best) { best = d; far = i; }
  }
  return dp(body.slice(0, far + 1), tol).concat(dp(body.slice(far), tol).slice(1));
}

const ringArea = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(s / 2);
};
const n1 = (v) => String(Math.round(v * 10) / 10);

function ringsToPath(rings, tol, minArea) {
  const out = [];
  for (const ring of rings) {
    let p = ring.map(project);
    if (ringArea(p) < minArea) continue;
    p = dpRing(p, tol);
    if (p.length < 4) continue;
    out.push("M" + p.map(([x, y]) => n1(x) + " " + n1(y)).join("L") + "Z");
  }
  return out.join("");
}

const ringsOf = (g) =>
  g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];

/* ---- рынки и регионы из разметки ---------------------------------------- */

const html = fs.readFileSync(WORK + "/ru/index.html", "utf8");

const blockStart = html.indexOf('class="geo__regions"');
const blockEnd = html.indexOf('class="geo__note"', blockStart);
const block = html.slice(blockStart, blockEnd);
const cardAt = [...block.matchAll(/<div class="geo-region(?=["\s])/g)].map((m) => m.index);
const REGIONS = cardAt.map((i, k) => {
  const card = block.slice(i, cardAt[k + 1]);
  return {
    core: /geo-region--core/.test(card),
    name: (card.match(/class="geo-region__name">([^<]*)</) || [])[1],
    codes: [...card.matchAll(/class="geo-code" title="[^"]*">([A-Z]{2})</g)].map((m) => m[1]),
  };
});
const MARKETS = REGIONS.flatMap((r) => r.codes);
const SET = new Set(MARKETS);
const CORE = new Set(REGIONS.filter((r) => r.core).flatMap((r) => r.codes));

/* ---- геометрия ---------------------------------------------------------- */

const ne = JSON.parse(fs.readFileSync(HERE + "/ne110.geojson", "utf8"));
const tiny = JSON.parse(fs.readFileSync(HERE + "/tiny.geojson", "utf8"));

const isoOf = (p) => {
  for (const k of ["ISO_A2_EH", "ISO_A2", "ADM0_ISO"]) {
    const v = p[k];
    if (v && v !== "-99" && v.length === 2) return v;
  }
  return null;
};

const countries = {}, points = {};

for (const f of ne.features) {
  const iso = isoOf(f.properties);
  if (!iso || !SET.has(iso)) continue;

  const d = ringsToPath(ringsOf(f.geometry), 0.45, 0.6);
  if (d) countries[iso] = d;

  const rings = ringsOf(f.geometry).map((r) => r.map(project));
  if (!rings.length) continue;
  let big = rings[0], bigA = ringArea(rings[0]);
  for (const r of rings) { const a = ringArea(r); if (a > bigA) { bigA = a; big = r; } }
  const xs = big.map((p) => p[0]), ys = big.map((p) => p[1]);
  points[iso] = [
    Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10,
    Math.round((ys.reduce((s, v) => s + v, 0) / ys.length) * 10) / 10,
    Math.round(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 10) / 10,
    CORE.has(iso) ? 1 : 0,
  ];
}
for (const f of tiny.features) {
  const iso = isoOf(f.properties);
  if (!iso || !SET.has(iso) || points[iso]) continue;
  const [x, y] = project(f.geometry.coordinates);
  points[iso] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10, 0, CORE.has(iso) ? 1 : 0];
}

/* Остальная суша одним силуэтом: она фон и не нажимается. */
const restRings = [];
for (const f of ne.features) {
  const iso = isoOf(f.properties);
  if (iso && SET.has(iso)) continue;
  if ((f.properties.NAME || "") === "Antarctica") continue;
  restRings.push(...ringsOf(f.geometry));
}
const rest = ringsToPath(restRings, 1.1, 2.5);

/* ---- кадры -------------------------------------------------------------- */

const boxOf = (codes, pad) => {
  const ps = codes.map((c) => points[c]).filter(Boolean);
  const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const px = Math.max((x1 - x0) * pad, 18), py = Math.max((y1 - y0) * pad, 18);
  return [x0 - px, y0 - py, x1 + px, y1 + py].map((v) => Math.round(v * 10) / 10);
};

const frames = {
  world: [0, 0, W, H],
  core: boxOf([...CORE], 0.1),                    // Европа и СНГ — 48 рынков
};
REGIONS.forEach((r, i) => { frames["r" + i] = boxOf(r.codes, 0.35); });

/* Насколько тесно рынкам в кадре: число, из-за которого кадр по умолчанию
   не «весь мир». Считается в пикселях полосы шириной 1300. */
function crowding(box, stripW) {
  const k = stripW / (box[2] - box[0]);
  const inside = MARKETS.map((c) => points[c]).filter((p) => p && p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3]);
  let min = Infinity, tight = 0;
  for (let i = 0; i < inside.length; i++) {
    let near = Infinity;
    for (let j = 0; j < inside.length; j++) {
      if (i === j) continue;
      near = Math.min(near, Math.hypot(inside[i][0] - inside[j][0], inside[i][1] - inside[j][1]) * k);
    }
    if (near < 11) tight++;
    min = Math.min(min, near);
  }
  return { n: inside.length, min: Math.round(min * 10) / 10, tight };
}

/* ---- сетка и край мира -------------------------------------------------- */

/* Меридианы в Equal Earth — кривые, параллели — прямые линии. Считается это
   здесь, где живёт проекция: в браузере её нет и быть не должно, туда едут
   только готовые координаты. Шаг 30° по долготе и 20° по широте — сетка
   обязана читаться как намёк на глобус, а не как миллиметровка. */
const gratLines = [];
for (let lon = -180; lon <= 180; lon += 30) {
  const pts = [];
  for (let la = LAT_BOT; la < LAT_TOP; la += 3) pts.push(project([lon, la]));
  pts.push(project([lon, LAT_TOP]));
  gratLines.push("M" + pts.map(([x, y]) => n1(x) + " " + n1(y)).join("L"));
}
for (let la = Math.ceil(LAT_BOT / 20) * 20; la <= LAT_TOP; la += 20) {
  const a = project([-180, la]), b = project([180, la]);
  gratLines.push("M" + n1(a[0]) + " " + n1(a[1]) + "L" + n1(b[0]) + " " + n1(b[1]));
}
const grat = gratLines.join("");

/* Край мира. Сама проекция — не прямоугольник, а бочка: параллели прямые,
   крайние меридианы выгнуты. Океан, залитый по этому контуру, превращает
   полосу в карту; залитый по прямоугольнику холста — не превращает ни во что,
   и суша висит в пустоте. Ровно это и делало карту скудной. */
const edgePts = [];
for (let la = LAT_TOP; la > LAT_BOT; la -= 2) edgePts.push(project([-180, la]));
edgePts.push(project([-180, LAT_BOT]));
for (let la = LAT_BOT; la < LAT_TOP; la += 2) edgePts.push(project([180, la]));
edgePts.push(project([180, LAT_TOP]));
const edge = "M" + edgePts.map(([x, y]) => n1(x) + " " + n1(y)).join("L") + "Z";

/* ---- запись ------------------------------------------------------------- */

const data = { w: W, h: H, c: countries, p: points, rest, f: frames, grat, edge };
const out =
  `/* Карта мира для секции «География».\n\n` +
  `   Границы: Natural Earth 110m admin-0, общественное достояние — тот же\n` +
  `   источник, что и растровая маска суши в land.js. Подготовлено один раз\n` +
  `   инструментом tools/make-world.mjs и вшито как данные: сайт во\n` +
  `   время работы ничего не загружает.\n\n` +
  `   Проекция Equal Earth — равновеликая. Меркатор и Миллер раздували бы\n` +
  `   Скандинавию, Балтию и Канаду, то есть врали бы картинкой ровно про ядро\n` +
  `   покрытия; на сайте, который продаёт проверяемость, это недопустимо.\n` +
  `   Широта подрезана ${LAT_BOT}..${LAT_TOP}, координаты уже спроецированы\n` +
  `   в систему viewBox ${W}x${H} — в браузере не считается ничего.\n\n` +
  `   w, h  — система координат\n` +
  `   c     — контур каждого рынка, у которого он читается\n` +
  `   p     — [x, y, размер, основной] для каждого из ${Object.keys(points).length}; размер меньше 9\n` +
  `           значит, что в контур не попасть и нужна плашка\n` +
  `   rest  — остальная суша одним силуэтом, только фон, не нажимается\n` +
  `   f     — кадры: весь мир, ядро (Европа и СНГ) и по одному на регион\n` +
  `   grat  — сетка: меридианы через 30°, параллели через 20°\n` +
  `   edge  — край мира, он же форма океана: в этой проекции не прямоугольник */\n` +
  `window.IVM_WORLD = ${JSON.stringify(data)};\n`;

fs.writeFileSync(WORK + "/assets/js/world.js", out);

const noShape = MARKETS.filter((c) => !countries[c]);
const tooSmall = MARKETS.filter((c) => points[c] && points[c][2] < 9);
const gz = zlib.gzipSync(Buffer.from(out), { level: 9 }).length;

console.log(`проекция Equal Earth, сетка ${W}x${H} (соотношение ${(W / H).toFixed(3)})`);
console.log(`рынков ${MARKETS.length}, основных ${CORE.size}, регионов ${REGIONS.length}`);
console.log(`контуров ${Object.keys(countries).length}, точек ${Object.keys(points).length}`);
console.log(`только плашка: ${noShape.join(", ") || "нет"}`);
console.log(`мельче пальца (<9): ${tooSmall.length} — ${tooSmall.join(", ")}`);
console.log(`файл ${(out.length / 1024).toFixed(1)} КБ, по проводу ${(gz / 1024).toFixed(1)} КБ`);
console.log("");
for (const [name, box] of [["весь мир", frames.world], ["Европа и СНГ", frames.core]]) {
  const c = crowding(box, 1300);
  console.log(`кадр «${name}»: рынков ${c.n}, ближайшие соседи ${c.min} px, теснее 11 px — ${c.tight}`);
}
