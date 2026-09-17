import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

/* Штамп версии на файлы в /assets/.

   Запуск:  node tools/stamp-assets.mjs          # проставить
            node tools/stamp-assets.mjs --check  # только проверить, ничего не писать

   Зачем это существует. В nginx на /assets/ стоит

       add_header Cache-Control "public, max-age=31536000, immutable";

   — год кеша, и immutable означает, что браузер не станет даже переспрашивать.
   Единственный способ доставить исправленный файл до человека, который уже был
   на сайте, — сменить адрес. Ровно это и делает `?v=`.

   Почему инструмент появился только сейчас. Штампы стояли в разметке, но
   проставлялись руками, и правила не осталось: ни один обычный хеш содержимого
   не совпадал с тем, что было записано. Пока правила нет, штамп — это число, в
   которое нельзя поверить: нельзя ни проверить, ни воспроизвести, а забыть
   обновить очень легко. Теперь правило простое и записано здесь.

   А `assets/js/world.js` был подключён вообще без штампа. Он лежит в той же
   папке с годовым кешем, и любая будущая правка карты не доехала бы до
   вернувшегося посетителя целый год. Хуже того: карта сверяет данные из
   world.js с разметкой страницы и при расхождении молча выключается — то есть
   новая разметка со старыми данными дала бы пустое место вместо карты.

   Хеш — md5 от содержимого, приведённого к LF, первые 8 знаков. LF потому, что
   рабочее дерево на Windows держит CRLF, а на сервере лежит LF: без нормализации
   один и тот же файл получал бы два разных штампа в зависимости от машины. */

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/* Каждый файл в /assets/, на который ссылается разметка. Картинки не входят:
   у них имена не меняются, а содержимое меняется вместе с именем. */
const ASSETS = [
  "assets/css/main.css",
  "assets/js/main.js",
  "assets/js/land.js",
  "assets/js/world.js",
];

const stamp = (p) =>
  crypto.createHash("md5")
    .update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex")
    .slice(0, 8);

const want = {};
for (const a of ASSETS) {
  const p = `${W}/${a}`;
  if (!fs.existsSync(p)) { console.error(`нет файла ${a} — штамповать нечего`); process.exit(1); }
  want[a] = stamp(p);
}

/* Все страницы сайта. Служебные папки не трогаем: там нет разметки. */
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "tools" || e.name === "server" || e.name === "docs") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
})(W);

let changed = 0, stale = [];
const seen = Object.fromEntries(ASSETS.map((a) => [a, 0]));

for (const p of pages) {
  const raw = fs.readFileSync(p, "utf8");
  let h = raw;
  for (const a of ASSETS) {
    /* Совпадает и со штампом, и без него: файл мог быть подключён впервые
       генератором, который про штампы ничего не знает. */
    const re = new RegExp(a.replace(/[/.]/g, "\\$&") + "(\\?v=[0-9a-f]+)?", "g");
    h = h.replace(re, (m) => { seen[a]++; return `${a}?v=${want[a]}`; });
  }
  if (h !== raw) {
    changed++;
    stale.push(path.relative(W, p));
    if (!CHECK) fs.writeFileSync(p, h);
  }
}

for (const a of ASSETS) console.log(`${a.padEnd(22)} ?v=${want[a]}   ссылок: ${seen[a]}`);
console.log(`\nстраниц: ${pages.length}, со старым штампом: ${changed}`);

if (CHECK && changed) {
  console.error(`\nштампы разошлись с содержимым. Первые пять: ${stale.slice(0, 5).join(", ")}`);
  console.error("запустите  node tools/stamp-assets.mjs  перед публикацией");
  process.exit(1);
}
if (!CHECK && changed) console.log("проставлено");
