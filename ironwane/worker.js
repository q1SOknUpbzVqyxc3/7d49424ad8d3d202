/* The site is static; this Worker exists for one route and one policy.
 *
 * POST /api/lead takes a form submission and posts it into a Telegram chat.
 * It is here, and not in the page, because the bot token must never reach the
 * browser: calling api.telegram.org from the page would put the token in
 * view-source, and whoever read it could take over the bot, read every lead
 * and message people as the company. The token lives only in the environment,
 * set in the Cloudflare dashboard, and appears nowhere in this repository.
 *
 * Required environment variables (Settings -> Variables and Secrets):
 *   TELEGRAM_BOT_TOKEN  from @BotFather
 *   TELEGRAM_CHAT_ID    the group the leads go to
 *
 * The Worker also runs in front of the static assets, because two things a
 * marketing site needs cannot be expressed in _headers:
 *
 *   1. http:// must become https://. _headers can set headers but cannot
 *      redirect, and the zone-level "Always Use HTTPS" switch does not exist
 *      for a workers.dev subdomain. Without this, a visitor who typed http://
 *      reached the contact form and posted their name, email and Telegram
 *      handle in cleartext, and got a 200 rather than a redirect.
 *   2. Cache-Control that depends on the status. /assets/* was pinned for a
 *      year and immutable by path alone, so a 404 for a mistyped asset name
 *      was pinned too -- a visitor had no way to clear it and no reload would
 *      revalidate it.
 *
 * That is why wrangler.jsonc now sets run_worker_first to true. The cost is
 * one Worker invocation per request instead of per /api/* request; the site is
 * small enough that this is cheap, and the assets still come from Cloudflare's
 * own storage through the ASSETS binding.
 *
 * It also moves responsibility: Cloudflare does not apply _headers to anything
 * the Worker returns, so every response header the site relies on is set here,
 * in harden(). _headers keeps the same site-wide block as a fallback for the
 * day run_worker_first is narrowed again -- if you change one, change both.
 */

const MAX_BODY = 12_000;   // bytes; a lead is a few hundred
const MAX_FIELD = 2_000;   // characters kept per field

/* Sent on every response, including the redirect and the API's JSON. */
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",

  /* A year, no includeSubDomains and no preload yet. The redirect still lets
     one cleartext request leave the browser before it is answered; HSTS is
     what stops that request being made at all on every later visit, which is
     why both are here and neither is enough alone.

     includeSubDomains is deliberately absent: this same file will serve
     ironvane-media.com, and the directive would pin every subdomain that domain
     ever gets -- including one pointed at a third-party host that does not do
     HTTPS -- for a year, with no way to undo it from here. Add it, then
     preload, once the custom domain is live and every planned subdomain is
     known to be HTTPS-only. */
  "Strict-Transport-Security": "max-age=31536000"
};

/* What the pages actually load, and nothing else.
     style-src   own stylesheet + the Google Fonts CSS
     font-src    the font files that CSS points at
     img-src     favicons plus two data: SVGs in main.css; there is not a
                 single <img> tag on the site, everything else is inline SVG
     connect-src same origin only. The only fetch the site makes is the one to
                 /api/lead, and this is the directive that stops a form's
                 contents being sent anywhere else
     script-src  'unsafe-inline' is unavoidable today: the motion switch is
                 inline in every head by design, and 160 pages carry an
                 application/ld+json block. Hashing would need a hash per page,
                 which one header cannot carry. object-src and base-uri close
                 the two injection routes 'unsafe-inline' leaves open. */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'"
].join("; ");

/* Telegram's HTML parse mode needs exactly these three escaped. */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* The order a human wants to read them in. Anything not listed still gets
   through, appended at the end -- a new form field should never silently
   vanish from the notification. */
const ORDER = [
  ["mode", "Тип"],
  ["name", "Имя"],
  ["email", "Email"],
  ["telegram", "Telegram"],
  ["company", "Компания"],
  ["country", "Страна / рынок"],
  ["topic", "Направление"],
  ["interest", "Интерес"],
  ["vertical", "Вертикаль"],
  ["tier", "Тариф"],
  ["budget", "Бюджет"],
  ["experience", "Опыт"],
  ["message", "Сообщение"]
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /* Before anything reads the request. A page served over http:// carries a
       form, and the browser would post it back over http:// too. */
    if (overPlainHttp(request, url)) {
      url.protocol = "https:";
      /* 308 rather than 301 for a POST, so the browser retries the same method
         instead of turning the enquiry into a GET -- which is exactly the
         fields-in-the-URL failure this is here to prevent. */
      const permanent = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
      return harden(new Response(null, { status: permanent, headers: { Location: url.href } }), url);
    }

    if (url.pathname === "/api/lead") {
      if (request.method !== "POST") {
        return harden(new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } }), url);
      }
      return harden(await handleLead(request, env), url);
    }

    return harden(await env.ASSETS.fetch(request), url);
  }
};

/* Cloudflare terminates TLS at the edge, so the scheme in request.url is the
   one the visitor's browser used. CF-Visitor is checked as well because a
   proxied custom domain can hand the Worker an https:// URL for a request that
   arrived over http, and this must not go quiet the day the domain changes. */
function overPlainHttp(request, url) {
  if (url.protocol === "http:") return true;
  const visitor = request.headers.get("CF-Visitor");
  if (visitor) {
    try { return JSON.parse(visitor).scheme === "http"; } catch { return false; }
  }
  return false;
}

/* Every response leaves through here. The ASSETS binding returns an immutable
   Response, hence the copy. */
function harden(res, url) {
  const out = new Response(res.body, res);
  for (const [name, value] of Object.entries(SECURITY)) out.headers.set(name, value);

  /* Only documents execute anything, and only documents can be framed. */
  if ((out.headers.get("Content-Type") || "").startsWith("text/html")) {
    out.headers.set("Content-Security-Policy", CSP);
  }

  /* The year-long immutable cache belongs to a file that was actually found.
     Attached by path alone it also pinned the 404 page served for a mistyped
     asset name, which no visitor could then clear. A miss keeps whatever the
     assets platform set for it, which revalidates. */
  if (url.pathname.startsWith("/assets/") && out.status === 200) {
    out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return out;
}

async function handleLead(request, env) {
  /* A missing variable is a deployment mistake, not a visitor's problem: say
     so in the log, stay generic in the response. */
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("lead: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set");
    return json({ ok: false }, 500);
  }

  /* Same-origin only. These are this site's own forms; browsers send Origin
     on cross-site POSTs, so a mismatch is not our traffic. */
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return json({ ok: false }, 403);
    } catch { return json({ ok: false }, 403); }
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false }, 413);

  const data = parseBody(raw, request.headers.get("Content-Type") || "");
  if (!data) return json({ ok: false }, 400);

  /* The honeypot is checked here as well as in the page. A bot posting
     straight to this endpoint never runs the page script, so the browser-side
     check alone protects nothing. Answer 200 either way -- telling a bot it
     failed only teaches it to try again. */
  if (typeof data.website === "string" && data.website.trim()) {
    return wantsDocument(request) ? backToPage(request, true) : json({ ok: true });
  }

  /* Email is the only mandatory field. The newsletter form on the insights
     pages has nothing else, and requiring a name there would reject every
     subscription with a 400 the visitor cannot act on. */
  const email = str(data.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false }, 400);

  const heading = str(data.kind) === "subscribe" ? "Подписка на материалы" : "Новая заявка";

  /* "page" is in this list because it is reported below under Страница; without
     it the leftover-fields loop prints the same path a second time. */
  const seen = new Set(["website", "consent", "kind", "page"]);
  const lines = [];
  for (const [key, label] of ORDER) {
    seen.add(key);
    const v = str(data[key]);
    if (v) lines.push(`<b>${esc(label)}:</b> ${esc(v)}`);
  }
  for (const [key, value] of Object.entries(data)) {
    if (seen.has(key)) continue;
    const v = str(value);
    if (v) lines.push(`<b>${esc(key)}:</b> ${esc(v)}`);
  }

  /* Where it came from, which the form itself does not know. */
  const page = str(data.page) || request.headers.get("Referer") || "";
  const country = request.headers.get("CF-IPCountry");
  const meta = [page && `<b>Страница:</b> ${esc(page)}`, country && `<b>Гео:</b> ${esc(country)}`]
    .filter(Boolean).join("\n");

  const text = [`<b>${esc(heading)}</b>`, "", lines.join("\n"), meta && "", meta]
    .filter(x => x !== undefined).join("\n").trim();

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!res.ok) {
    /* Log the API's reason, never the token, and keep it out of the response. */
    console.error("lead: telegram returned", res.status, (await res.text()).slice(0, 400));
    return json({ ok: false }, 502);
  }
  if (wantsDocument(request)) return backToPage(request, true);
  return json({ ok: true });
}

/* The page script posts JSON. A browser posting the form itself sends
   application/x-www-form-urlencoded, and that path has to work too: the forms
   carry method="post" action="/api/lead" so that a page whose script failed
   cannot fall back to the browser default, which is a GET that writes the
   visitor's name, email, Telegram handle and message into the address bar,
   their history and every log the request passes through. The lead arrives
   either way; only the on-page confirmation needs the script. */
/* A no-JS submission is a navigation, not an API call: answering it with a
   JSON body leaves the visitor staring at {"ok":true} on a blank page. Send
   them back to the form they came from, flagged, so the page can say what
   happened. Anything that is not a document request still gets the JSON. */
function wantsDocument(request) {
  const dest = request.headers.get("Sec-Fetch-Dest");
  if (dest) return dest === "document";
  return (request.headers.get("Accept") || "").includes("text/html");
}

function backToPage(request, ok) {
  const ref = request.headers.get("Referer");
  let target = "/";
  try { if (ref) target = new URL(ref).pathname; } catch {}
  return new Response(null, {
    status: 303,
    headers: { Location: target + (ok ? "#sent" : "#send-failed"), "Cache-Control": "no-store" }
  });
}

function parseBody(raw, contentType) {
  if (contentType.includes("form-urlencoded")) {
    const fields = {};
    for (const [key, value] of new URLSearchParams(raw)) fields[key] = value;
    return fields;
  }
  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch { return null; }
}

function str(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, MAX_FIELD);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
