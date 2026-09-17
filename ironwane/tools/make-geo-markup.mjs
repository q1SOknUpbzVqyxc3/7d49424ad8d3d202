import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Разметка секции «География»: полоса карты и лента кейсов.

   Все факты кладутся в разметку, а не в скрипт. Три причины, и каждая
   существенная: без JS лента кейсов остаётся семью живыми ссылками (сегодня
   кейсов в этой секции нет вовсе); переводить нечего, потому что всё поднято
   из <локаль>/results/ той же локали; и ни одно утверждение не рождается в
   коде — оно цитируется со страницы, где его можно проверить.

   Кодовые имена кейсов — это и есть «обобщённые названия офферов», о которых
   просил владелец: настоящая работа под кодовым именем, без имени клиента.
   Придумывать недостающие 65 нельзя, поэтому карта раскладывает семь с той
   точностью, какую выдерживают сами кейсы:
     data-cc  — страны, которые кейс называет САМ. Только на них показываются
                его цифры.
     пусто    — кейс назвал только регион; тогда ни одной цифры, только имя,
                вертикаль и собственная география кейса дословно. */

/* Запуск:  node tools/make-geo-markup.mjs [локали через пробел]
   По умолчанию все пять. */
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = process.argv.slice(2).length ? process.argv.slice(2) : ["ru", "en", "es", "cs", "uk"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* Значения поднимаются из готового HTML, где они уже экранированы: в
   английской локали регион кейса записан как «Türkiye &amp; MENA». Экранировать
   это второй раз значит положить в атрибут «&amp;amp;»; браузер прочитает
   «Türkiye &amp; MENA», а название карточки региона даст «Türkiye & MENA» —
   сверка не сойдётся, и карта молча выключится на всей английской версии.
   Поэтому сущности расшифровываются ровно один раз, на входе. */
const ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
const deent = (s) => String(s)
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCodePoint(parseInt(d, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ENT[n]);

const strip = (s) => deent(String(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/* Страны, которые кейс называет собственным текстом. Заполняется вручную по
   прочитанным страницам — это факт о тексте, а не догадка о работе:
     FISHING TIME — «Рынок лайв-рыбалки в Малайзии»
     HARBOR       — «Подписочный e-commerce в DACH» → Германия, Австрия, Швейцария
     CHICKEN TRAIN— «Быстрая игра на Кот-д'Ивуар» — страны нет среди 73 рынков
     ATLAS        — «по Турции и Персидскому заливу»: Израиль не назван
   Остальные кейсы своих стран не называют вовсе. */
const NAMED = {
  "FISHING TIME": ["MY"],
  "HARBOR": ["DE", "AT", "CH"],
};

/* Всё, что карта говорит словами, собрано здесь по локалям.

   Подписи панели уезжают в data-t-* на саму полосу, а не остаются в main.js:
   строка обязана лежать в разметке той локали, к которой относится, иначе её
   не находит ни переводчик, ни тот, кто правит текст на странице. Скрипт
   держит русские значения только как запасной вариант — если атрибут потеряли,
   страница остаётся рабочей, но говорит по-русски, и это видно сразу.

   t.region — формат с %s: кавычки вокруг названия региона в пяти языках
   разные, и выбирать их обязан переводчик, а не склейка строк в коде.

   notes — две оговорки, которые обязаны стоять в коде, а не держаться в
   голове. Без них семь одинаковых плит региона ATLAS читаются как семь побед,
   а кейс CHICKEN TRAIN — как работа по стране, которой среди 73 нет. */
const UI = {
  /* markets — формы через «|»: одна, две или три. Английскому и испанскому
     хватает пары, славянским нужна третья, и правило у чешского не то же, что
     у русского. plural выбирает правило; счёт панели берёт нужную форму. */
  ru: {
    total: "Рынков",
    frameCore: "Европа и СНГ",
    frameWorld: "Весь мир",
    zoomIn: "Приблизить",
    zoomOut: "Отдалить",
    source: "Контуры — Natural Earth, общественное достояние. Границы показаны так, как их рисует источник, и не выражают позицию компании.",
    t: {
      core: "Основной рынок",
      ext: "Расширенное покрытие",
      named: "Рынок кейса",
      region: "Регион кейса: «%s»",
      none: "Опубликованных кейсов по этому региону нет",
      markets: "рынок|рынка|рынков",
      plural: "ru",
      close: "Закрыть",
    },
    notes: {
      "CHICKEN TRAIN": "Кот-д'Ивуар в список 73 рынков не входит",
      "ATLAS": "5 из 7 рынков региона валидированы; два закрыли за шесть недель",
    },
  },
  en: {
    total: "Markets",
    frameCore: "Europe & CIS",
    frameWorld: "World",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    source: "Outlines — Natural Earth, public domain. Boundaries follow the source; we take no position on them.",
    t: {
      core: "Core market",
      ext: "Extended coverage",
      named: "Case names this market",
      region: "Case listed under %s",
      none: "No published case studies for this region",
      markets: "market|markets",
      plural: "en",
      close: "Close",
    },
    notes: {
      "CHICKEN TRAIN": "Cote d'Ivoire is not among the 73 markets",
      "ATLAS": "5 of the region's 7 markets were validated; two were shut down within six weeks",
    },
  },
  es: {
    total: "Mercados",
    frameCore: "Europa y CEI",
    frameWorld: "El mundo",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    source: "Contornos de Natural Earth, dominio público. Las fronteras se muestran tal como las traza esa fuente y no expresan la posición de la compañía.",
    t: {
      core: "Mercado principal",
      ext: "Cobertura ampliada",
      named: "Mercado del caso",
      region: "Región del caso: «%s»",
      none: "No hay casos publicados para esta región",
      markets: "mercado|mercados",
      plural: "en",
      close: "Cerrar",
    },
    notes: {
      "CHICKEN TRAIN": "Costa de Marfil no está en la lista de los 73 mercados",
      "ATLAS": "5 de 7 mercados de la región validados; dos mercados se cerraron en seis semanas",
    },
  },
  cs: {
    total: "Trhů",
    frameCore: "Evropa a SNS",
    frameWorld: "Celý svět",
    zoomIn: "Přiblížit",
    zoomOut: "Oddálit",
    source: "Obrysy — Natural Earth, volné dílo. Hranice jsou zobrazeny tak, jak je kreslí zdroj, a nevyjadřují stanovisko společnosti.",
    t: {
      core: "Hlavní trh",
      ext: "Rozšířené pokrytí",
      named: "Trh případové studie",
      region: "Region případové studie: „%s“",
      none: "Pro tento region nejsou publikovány žádné případové studie",
      markets: "trh|trhy|trhů",
      plural: "cs",
      close: "Zavřít",
    },
    notes: {
      "CHICKEN TRAIN": "Pobřeží slonoviny není v seznamu 73 trhů",
      "ATLAS": "Ověřeno 5 ze 7 trhů v regionu; dva se zavřely do šesti týdnů",
    },
  },
  uk: {
    total: "Ринків",
    frameCore: "Європа та СНД",
    frameWorld: "Весь світ",
    zoomIn: "Наблизити",
    zoomOut: "Віддалити",
    source: "Контури — Natural Earth, суспільне надбання. Кордони показано так, як їх малює джерело; це не позиція компанії.",
    t: {
      core: "Основний ринок",
      ext: "Розширене покриття",
      named: "Ринок кейсу",
      region: "Регіон кейсу: «%s»",
      none: "Опублікованих кейсів у цьому регіоні немає",
      markets: "ринок|ринки|ринків",
      plural: "ru",
      close: "Закрити",
    },
    notes: {
      "CHICKEN TRAIN": "Кот-д'Івуар до списку 73 ринків не входить",
      "ATLAS": "5 із 7 ринків регіону валідовано; два ринки закрили за шість тижнів",
    },
  },
};

function caseData(loc) {
  const idx = fs.readFileSync(`${W}/${loc}/results/index.html`, "utf8");
  const cards = [...idx.matchAll(/<a class="card case"[\s\S]*?<\/a>/g)].map((m) => m[0]);
  const out = [];
  for (const c of cards) {
    const href = (c.match(/href="([^"]*)"/) || [])[1];
    const code = deent((c.match(/case__code">([^<]*)/) || [])[1] || "");
    const tag = deent((c.match(/case__tag">([^<]*)/) || [])[1] || "");
    const summary = strip((c.match(/case__summary">([\s\S]*?)<\/p>/) || [])[1] || "");
    const slug = href.replace(/.*results\//, "").replace(/\/$/, "");
    const page = fs.readFileSync(`${W}/${loc}/results/${slug}/index.html`, "utf8");

    /* Картотека кейса: регион берём дословно, связывать по видимой подписи
       регион можно только в пределах одной локали. */
    const rows = Object.fromEntries(
      /* Класс значения бывает не один: строки с числами несут
         «info-row__val num». Регэксп требовал закрывающую кавычку сразу после
         info-row__val и потому не видел ни одной такой строки — а период
         размечен именно так во всех 35 кейсах всех пяти локалей. Поле периода
         не печаталось никогда и нигде, и заметить это было нельзя: панель
         просто не рисовала строку, которой нет. */
      [...page.matchAll(/info-row__key">([^<]*)<\/span><span class="info-row__val[^"]*">([^<]*)/g)].map((m) => [deent(m[1]), deent(m[2])])
    );
    const region = rows["Регион"] || rows["Region"] || rows["Región"] || rows["Регіон"] || "";

    /* Цифры — только из шапки самой страницы кейса, первые четыре. Брать их
       из PRODUCT.md нельзя: там показатели FISHING TIME и CHICKEN TRAIN
       приписаны ATLAS, и карта напечатала бы чужие числа под кодовым именем. */
    const head = page.slice(0, page.indexOf("case-body") > 0 ? page.indexOf("case-body") : 40000);
    /* Между значением и подписью у части кейсов стоит стрелка направления —
       регэксп обязан её пропускать, иначе цифры половины кейсов теряются
       молча и панель выглядит пустой там, где данные есть. */
    const figs = [...head.matchAll(/metric__value">([\s\S]*?)<\/span>[\s\S]*?<span class="metric__label">([^<]*)</g)]
      .slice(0, 4).map((m) => strip(m[1]) + " · " + m[2].trim());

    /* Украинского ключа здесь не было: строка периода на uk называется
       «Період», и панель теряла его молча — поле просто не рисовалось. */
    const period = rows["Период"] || rows["Period"] || rows["Periodo"] || rows["Období"] || rows["Період"] || "";

    out.push({
      code, tag, href: href.replace(/^\.\.\/\.\.\//, "../"), region, summary, period,
      cc: (NAMED[code] || []).join(","),
      figs: figs.join("|"),
      note: ((UI[loc] || {}).notes || {})[code] || "",
    });
  }
  return out;
}

function strip_(h) {
  return h
    /* Подпись об источнике снимается ПЕРВОЙ: она стоит между полосой и лентой
       кейсов, и правило ниже, написанное до неё, иначе перестало бы совпадать —
       разметка копилась бы при каждом запуске вместо того, чтобы обновляться. */
    .replace(/<p class="geo-map__source">[\s\S]*?<\/p>/g, "")
    .replace(/<div class="geo-map"[\s\S]*?<\/div>\s*<ul class="geo-cases"[\s\S]*?<\/ul>/g, "")
    .replace(/<div class="geo-map"[\s\S]*?data-geo-map><\/canvas><\/div>/g, "")
    .replace(/<ul class="geo-cases"[\s\S]*?<\/ul>/g, "")
    .replace(/ data-geo-region="\d+"/g, "")
    /* Штамп версии допускается: его ставит tools/stamp-assets.mjs после этого
       скрипта, и без «?v=…» в шаблоне подключение world.js перестало бы
       сниматься — а значит и обновляться. */
    .replace(/<script src="\.\.\/assets\/js\/world\.js(?:\?v=[0-9a-f]+)?"[^>]*><\/script>/g, "");
}

let done = 0;
for (const loc of LOCALES) {
  const f = `${W}/${loc}/index.html`;
  const orig = fs.readFileSync(f, "utf8");
  let h = strip_(orig);

  const u = UI[loc];
  if (!u) { console.error(`${loc}: подписей для этой локали в UI нет — страница не тронута`); continue; }
  if (!/%s/.test(u.t.region)) { console.error(`${loc}: в t.region нет %s, подставлять некуда`); continue; }

  const cases = caseData(loc);
  if (cases.length !== 7) { console.error(`${loc}: кейсов ${cases.length}, ждали 7`); continue; }

  /* Подписи панели уезжают атрибутами на саму полосу: строка живёт в разметке
     своей локали, а не в общем скрипте на пять языков. */
  const tAttrs = Object.keys(u.t).map((k) => ` data-t-${k}="${esc(u.t[k])}"`).join("");

  const strip2 =
    `<div class="geo-map" data-geo-strip${tAttrs}>` +
    `<canvas data-geo-map></canvas>` +
    `<p class="geo-map__total"><strong class="num">73</strong><span>${esc(u.total)}</span></p>` +
    `<div class="geo-map__frames">` +
    /* aria-pressed, а не только класс: какой кадр выбран, иначе сообщалось
       одним цветом рамки — то есть не сообщалось тому, кто страницу слушает. */
    `<div class="geo-map__frames-row">` +
    `<button class="geo-map__frame is-on" type="button" aria-pressed="true" data-frame="core">${esc(u.frameCore)}</button>` +
    `<button class="geo-map__frame" type="button" aria-pressed="false" data-frame="world">${esc(u.frameWorld)}</button>` +
    `</div>` +
    /* Приближение. В кадре «Весь мир» мир заполняет полосу ровно, и без
       него там нечего листать; колесо отдано странице. */
    `<div class="geo-map__zoom">` +
    `<button class="geo-map__z" type="button" data-zoom="in" aria-label="${esc(u.zoomIn)}">+</button>` +
    `<button class="geo-map__z" type="button" data-zoom="out" aria-label="${esc(u.zoomOut)}">−</button>` +
    `</div></div></div>`;

  const chips =
    `<ul class="geo-cases" data-geo-cases>` +
    cases.map((c) =>
      `<li><a class="geo-case" href="${esc(c.href)}"` +
      ` data-code="${esc(c.code)}" data-tag="${esc(c.tag)}" data-regions="${esc(c.region)}"` +
      ` data-cc="${esc(c.cc)}" data-figs="${esc(c.figs)}" data-note="${esc(c.note)}" data-period="${esc(c.period)}"` +
      ` data-summary="${esc(c.summary)}">` +
      `<span class="geo-case__code mono">${esc(c.code)}</span>` +
      `<span class="geo-case__tag">${esc(c.tag)}</span></a></li>`
    ).join("") +
    `</ul>`;

  /* Источник контуров подписью под картой. Natural Earth рисует спорные
     границы по-своему, а сайт продаёт по обе стороны этих споров: назвать
     источник и не присваивать себе его позицию — то же самое, что сайт делает
     с цифрами, только в графике. */
  const source = `<p class="geo-map__source">${esc(u.source)}</p>`;

  /* Полоса, подпись и лента встают между шапкой раздела и существующей сеткой. */
  const anchor = '<div class="geo__layout">';
  const at = h.indexOf(anchor);
  if (at < 0) { console.error(`${loc}: не найден .geo__layout`); continue; }
  h = h.slice(0, at) + strip2 + source + chips + h.slice(at);

  /* Ключ региона на карточки: связывать по видимой подписи нельзя, она разная
     в пяти локалях. */
  /* Атрибут приписывается ПОСЛЕ закрывающей кавычки класса. Первый заход
     обрезал последний символ совпадения и дописывал атрибут внутрь значения
     class — карточки оставались на месте, а ключа региона не существовало. */
  let k = 0;
  h = h.replace(/(<div class="geo-region(?: geo-region--\w+)?")/g, (m) => m + ` data-geo-region="${k++}"`);

  /* Файл данных карты подключается рядом с land.js — ПОСЛЕ закрывающего
     тега, а не внутрь открывающего. */
  if (!/assets\/js\/world\.js/.test(h)) {
    const land = h.indexOf('<script src="../assets/js/land.js');
    if (land >= 0) {
      const end = h.indexOf("</script>", land) + "</script>".length;
      h = h.slice(0, end) + '<script src="../assets/js/world.js" defer></script>' + h.slice(end);
    }
  }

  fs.writeFileSync(f, h);
  done++;
  console.log(`${loc}: полоса + ${cases.length} кейсов + ${k} карточек размечено`);
  for (const c of cases) console.log(`   ${c.code.padEnd(14)} ${c.region.padEnd(38)} страны: ${c.cc || "—"}  цифр: ${c.figs ? c.figs.split("|").length : 0}${c.note ? "  оговорка: да" : ""}`);
}
console.log(`\nстраниц изменено: ${done}`);
