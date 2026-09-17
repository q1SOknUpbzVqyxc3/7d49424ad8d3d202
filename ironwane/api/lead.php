<?php
/* ==========================================================================
   Ironvane Media — lead intake

   A port of the /api/lead route from worker.js, which ran on Cloudflare
   Workers. Same behaviour, same responses, same order of checks; only the
   platform underneath is different. Read worker.js first if you need the
   reasoning behind a decision -- the comments there explain why each check
   exists, and this file does not repeat them.

   Two things genuinely could not come across:

     - Geo. Cloudflare attached the visitor's country as CF-IPCountry. An
       ordinary server has no such header, so the "Гео" line is dropped unless
       something in front of this server supplies one. Nothing else changes.
     - Response headers. On Workers, harden() stamped the security headers on
       every response including this one. Here the web server does that for
       every response it serves, so this file sets only Cache-Control, which
       belongs to the response rather than to the site.
   ========================================================================== */

declare(strict_types=1);

const MAX_BODY  = 12000;  // bytes; a lead is a few hundred
const MAX_FIELD = 2000;   // characters kept per field

/* The order a human wants to read them in. Anything not listed still gets
   through, appended at the end -- a new form field should never silently
   vanish from the notification. */
const ORDER = [
    'mode'       => 'Тип',
    'name'       => 'Имя',
    'email'      => 'Email',
    'telegram'   => 'Telegram',
    'company'    => 'Компания',
    'country'    => 'Страна / рынок',
    'topic'      => 'Направление',
    'interest'   => 'Интерес',
    'vertical'   => 'Вертикаль',
    'tier'       => 'Тариф',
    'budget'     => 'Бюджет',
    'experience' => 'Опыт',
    'message'    => 'Сообщение',
];

/* "page" is here because it is reported below under Страница; without it the
   leftover-fields loop prints the same path a second time. */
const SKIP = ['website', 'consent', 'kind', 'page'];

main();

function main(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store');
        http_response_code(405);
        echo 'Method Not Allowed';
        return;
    }

    /* A missing setting is a deployment mistake, not a visitor's problem: say
       so in the log, stay generic in the response. */
    $token  = setting('TELEGRAM_BOT_TOKEN');
    $chatId = setting('TELEGRAM_CHAT_ID');
    if ($token === '' || $chatId === '') {
        error_log('lead: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set');
        json(['ok' => false], 500);
        return;
    }

    /* Same-origin only. These are this site's own forms; browsers send Origin
       on cross-site POSTs, so a mismatch is not our traffic. */
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $host = parse_url($origin, PHP_URL_HOST);
        $port = parse_url($origin, PHP_URL_PORT);
        if (is_string($host) && $port !== null) {
            $host .= ':' . $port;
        }
        if (!is_string($host) || $host === '' || strcasecmp($host, (string)($_SERVER['HTTP_HOST'] ?? '')) !== 0) {
            json(['ok' => false], 403);
            return;
        }
    }

    $raw = file_get_contents('php://input');
    if ($raw === false) {
        json(['ok' => false], 400);
        return;
    }
    if (strlen($raw) > MAX_BODY) {
        json(['ok' => false], 413);
        return;
    }

    $data = parseBody($raw, $_SERVER['CONTENT_TYPE'] ?? '');
    if ($data === null) {
        json(['ok' => false], 400);
        return;
    }

    /* The honeypot is checked here as well as in the page. A bot posting
       straight to this endpoint never runs the page script, so the browser-side
       check alone protects nothing. Answer 200 either way -- telling a bot it
       failed only teaches it to try again. */
    if (isset($data['website']) && is_string($data['website']) && trim($data['website']) !== '') {
        succeed();
        return;
    }

    /* Email is the only mandatory field. The newsletter form on the insights
       pages has nothing else, and requiring a name there would reject every
       subscription with a 400 the visitor cannot act on. */
    $email = str($data['email'] ?? null);
    if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $email)) {
        json(['ok' => false], 400);
        return;
    }

    $heading = str($data['kind'] ?? null) === 'subscribe' ? 'Подписка на материалы' : 'Новая заявка';

    $seen  = SKIP;
    $lines = [];
    foreach (ORDER as $key => $label) {
        $seen[] = $key;
        $v = str($data[$key] ?? null);
        if ($v !== '') {
            $lines[] = '<b>' . esc($label) . ':</b> ' . esc($v);
        }
    }
    foreach ($data as $key => $value) {
        if (in_array((string)$key, $seen, true)) {
            continue;
        }
        $v = str($value);
        if ($v !== '') {
            $lines[] = '<b>' . esc((string)$key) . ':</b> ' . esc($v);
        }
    }

    /* Where it came from, which the form itself does not know. */
    $page = str($data['page'] ?? null);
    if ($page === '') {
        $page = str($_SERVER['HTTP_REFERER'] ?? null);
    }
    /* Set only if something in front of this server supplies it. Cloudflare's
       CF-IPCountry is kept in the list so the line comes back by itself if the
       site ever sits behind a proxy again. */
    $country = str($_SERVER['HTTP_CF_IPCOUNTRY'] ?? $_SERVER['HTTP_X_COUNTRY_CODE'] ?? null);

    $meta = implode("\n", array_filter([
        $page !== ''    ? '<b>Страница:</b> ' . esc($page) : '',
        $country !== '' ? '<b>Гео:</b> ' . esc($country) : '',
    ]));

    $parts = ['<b>' . esc($heading) . '</b>', '', implode("\n", $lines)];
    if ($meta !== '') {
        $parts[] = '';
        $parts[] = $meta;
    }
    $text = trim(implode("\n", $parts));

    /* Written down BEFORE the send, and deliberately not conditional on it.
       Between 26.08 and 02.09.2026 four submissions reached this endpoint while
       the Telegram credentials were still unset: each one answered 500, each one
       was lost, and nothing anywhere held what the sender had typed. Whether
       they were people or bots is unknowable now, which is the point -- the
       failure destroyed the evidence along with the lead.

       Telegram will be unreachable again eventually. When it is, the enquiry
       survives on disk and someone can read it out by hand. */
    archive($data, $text);

    if (!sendToTelegram($token, $chatId, $text)) {
        json(['ok' => false], 502);
        return;
    }

    succeed();
}

/* Where the credentials live, in the order they are looked for.

     1. Environment. The Cloudflare deployment kept them as secrets in the
        dashboard and this is the same idea: on a VPS they are set in the
        PHP-FPM pool, so the token never sits inside the served directory.
     2. /etc/ironvane/telegram.ini -- a VPS where editing the pool config is
        inconvenient. Must not be world-readable.
     3. One level above the site directory, for shared hosting, where neither
        of the first two is available to the customer.

   All three keep the token outside anything the web server will serve. Putting
   it in a file inside the site directory would publish it the first time a
   misconfiguration stopped PHP from running. */
function setting(string $name): string
{
    $env = getenv($name);
    if (is_string($env) && $env !== '') {
        return $env;
    }

    static $file = null;
    if ($file === null) {
        $file = [];
        $root = $_SERVER['DOCUMENT_ROOT'] ?? '';
        $candidates = ['/etc/ironvane/telegram.ini'];
        if ($root !== '') {
            $candidates[] = dirname($root) . '/ironvane-telegram.ini';
        }
        foreach ($candidates as $path) {
            if (is_readable($path)) {
                $parsed = parse_ini_file($path, false, INI_SCANNER_RAW);
                if (is_array($parsed)) {
                    $file = $parsed;
                }
                break;
            }
        }
    }

    return isset($file[$name]) ? trim((string)$file[$name]) : '';
}

/* Drop the last octet of an address before writing it down: 203.0.113.47
   becomes 203.0.113.0. Enough to see that fifty submissions came from one
   network, not enough to point at a person.

   nginx already does this to the access log through a map in
   conf.d/ironvane-anonlog.conf; PHP sees the real address in REMOTE_ADDR, so
   without this the archive would quietly reintroduce exactly what that map
   exists to remove. The first version of this function did. */
function maskIp(string $ip): string
{
    if ($ip === '') {
        return '';
    }
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $p = explode('.', $ip);
        return $p[0] . '.' . $p[1] . '.' . $p[2] . '.0';
    }
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        /* Keep the routing prefix, drop the half that identifies the host. */
        $bin = inet_pton($ip);
        if ($bin !== false) {
            $masked = inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8));
            if ($masked !== false) {
                return $masked;
            }
        }
    }
    return '0.0.0.0';
}

/* One JSON line per enquiry, appended under a lock so two arriving together
   cannot interleave. Failure here is never allowed to cost the visitor their
   submission: if the file cannot be written, that is logged and the send goes
   ahead regardless. The archive is a safety net, not a gate.

   This holds personal data -- names, addresses, whatever was typed into the
   message box. It lives outside the served directory, is readable only by the
   web user, and is rotated on the same 24-month horizon the privacy policy
   already commits to for enquiries. */
function archive(array $data, string $rendered): void
{
    $path = '/var/lib/ironvane/leads.jsonl';
    $dir  = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
        error_log('lead: cannot create ' . $dir);
        return;
    }

    $record = [
        'at'         => gmdate('c'),
        'ip'         => maskIp($_SERVER['REMOTE_ADDR'] ?? ''),
        'user_agent' => str($_SERVER['HTTP_USER_AGENT'] ?? null),
        'fields'     => $data,
        'rendered'   => $rendered,
    ];

    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        error_log('lead: could not encode the archive record');
        return;
    }

    $fh = @fopen($path, 'a');
    if ($fh === false) {
        error_log('lead: cannot open ' . $path . ' for append');
        return;
    }
    if (flock($fh, LOCK_EX)) {
        fwrite($fh, $line . "\n");
        fflush($fh);
        flock($fh, LOCK_UN);
    }
    fclose($fh);
    @chmod($path, 0640);
}

function sendToTelegram(string $token, string $chatId, string $text): bool
{
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/sendMessage');
    if ($ch === false) {
        error_log('lead: curl_init failed');
        return false;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode([
            'chat_id'                  => $chatId,
            'text'                     => $text,
            'parse_mode'               => 'HTML',
            'disable_web_page_preview' => true,
        ], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 15,
    ]);

    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    /* Log the reason, never the token, and keep it out of the response. */
    if ($body === false) {
        error_log('lead: telegram unreachable: ' . $err);
        return false;
    }
    if ($status < 200 || $status >= 300) {
        error_log('lead: telegram returned ' . $status . ' ' . substr((string)$body, 0, 400));
        return false;
    }
    return true;
}

/* A no-JS submission is a navigation, not an API call: answering it with a
   JSON body leaves the visitor staring at {"ok":true} on a blank page. Send
   them back to the form they came from, flagged, so the page can say what
   happened. Anything that is not a document request still gets the JSON. */
function succeed(): void
{
    if (wantsDocument()) {
        $target = '/';
        $ref = $_SERVER['HTTP_REFERER'] ?? '';
        if ($ref !== '') {
            $path = parse_url($ref, PHP_URL_PATH);
            if (is_string($path) && $path !== '') {
                $target = $path;
            }
        }
        header('Location: ' . $target . '#sent');
        header('Cache-Control: no-store');
        http_response_code(303);
        return;
    }
    json(['ok' => true]);
}

function wantsDocument(): bool
{
    $dest = $_SERVER['HTTP_SEC_FETCH_DEST'] ?? '';
    if ($dest !== '') {
        return $dest === 'document';
    }
    return str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'text/html');
}

/* The page script posts JSON. A browser posting the form itself sends
   application/x-www-form-urlencoded, and that path has to work too -- see the
   comment above wantsDocument() in worker.js for why the forms carry a real
   method and action. */
function parseBody(string $raw, string $contentType): ?array
{
    if (str_contains($contentType, 'form-urlencoded')) {
        $fields = [];
        parse_str($raw, $fields);
        return $fields;
    }
    $data = json_decode($raw, true);
    return is_array($data) && !array_is_list($data) ? $data : null;
}

function str($v): string
{
    if ($v === null || is_array($v) || is_object($v)) {
        return '';
    }
    if (is_bool($v)) {
        $v = $v ? 'true' : 'false';
    }
    return mb_substr(trim((string)$v), 0, MAX_FIELD, 'UTF-8');
}

/* Telegram's HTML parse mode needs exactly these three escaped. */
function esc(string $s): string
{
    return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $s);
}

function json(array $body, int $status = 200): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
}
