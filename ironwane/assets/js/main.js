/* ==========================================================================
   Ironvane Media — interaction layer
   Classic script, no build step, no dependencies.

   Two rules this file follows:
   1. Every module is isolated. One failure must never cascade into the rest.
   2. Nothing that hides content may depend on a module succeeding. Reveal
      animations have a hard failsafe, so a broken observer can never leave
      the page blank.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  /* Set by the inline script in the head -- read it, never re-derive it here,
     so the CSS gate and this flag can never disagree. */
  var forceMotion = root.classList.contains("force-motion");

  var reduced = !forceMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.remove("no-js");

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts || false); }

  function run(name, fn) {
    try { fn(); }
    catch (e) { if (window.console && console.warn) console.warn("[ivm] " + name + " failed:", e); }
  }

  /* -------------------------------------------------------------- Analytics */
  /* One entry point, so nothing else in this file has to know which provider
     is installed -- or whether one is installed at all. With no analytics
     script on the page every call is a silent no-op, which is exactly what
     happens in local development and in any build that left `src` empty.
     Wrapped in try/catch on principle: a broken vendor script must never be
     able to take an interaction handler down with it. */
  function track(name, props) {
    try {
      if (typeof window.plausible === "function") {
        window.plausible(name, props ? { props: props } : undefined);
      } else if (window.umami && typeof window.umami.track === "function") {
        window.umami.track(name, props);
      } else if (typeof window.gtag === "function") {
        window.gtag("event", name, props || {});
      }
    } catch (e) {}
  }

  /* Contact intent that leaves the site: mail, phone, Telegram. For
     an agency these ARE the conversions, and not one of them causes a
     pageview, so without this they are simply invisible in the numbers.
     Delegated from the document, so it covers links in the footer, the header,
     the contact page and anything added later without further wiring. */
  on(doc, "click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^mailto:/i.test(href))  { track("Contact: email"); return; }
    if (/^tel:/i.test(href))     { track("Contact: phone"); return; }
    /* Host, never the full URL -- enough to tell one destination from another, and
       it keeps anything identifying out of the analytics payload. */
    if (a.host && a.host !== window.location.host) track("Outbound", { to: a.host });
  }, true);

  /* --------------------------------------------------------------- Failsafe */
  /* Content is hidden by CSS until revealed. If anything at all goes wrong —
     no IntersectionObserver, a thrown error, a blocked frame — show it. */
  function revealAll() {
    $$("[data-reveal]").forEach(function (el) { el.classList.add("is-visible"); });
    $$("[data-count]").forEach(function (el) {
      if (!el.textContent.trim()) el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
    });
  }
  window.setTimeout(revealAll, 2500);

  /* ---------------------------------------------------------------- Header */

  run("header", function () {
    var header = $(".header");
    if (!header) return;
    var last = window.pageYOffset;
    var ticking = false;

    function update() {
      var y = window.pageYOffset;
      header.classList.toggle("is-stuck", y > 12);
      if (!doc.body.classList.contains("menu-open")) {
        header.classList.toggle("is-hidden", y > last && y > 320);
      }
      last = y;
      ticking = false;
    }

    on(window, "scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  });

  /* ----------------------------------------------------------- Mobile menu */

  run("menu", function () {
    var burger = $(".burger");
    var menu = $(".menu");
    if (!burger || !menu) return;

    var lastFocus = null;

    /* Both strings come from the markup, because this file is shared by five
       locales and an English "Close menu" written here would be wrong on four
       of them. If data-label-close is absent the label simply does not change,
       which is today's behaviour rather than a broken one. */
    var labelOpen = burger.getAttribute("data-label-open") || burger.getAttribute("aria-label") || "";
    var labelClose = burger.getAttribute("data-label-close") || "";

    function setOpen(open) {
      doc.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      var label = open ? labelClose : labelOpen;
      if (label) burger.setAttribute("aria-label", label);
      if (open) {
        lastFocus = doc.activeElement;
        var first = $(".menu__link", menu);
        if (first) window.setTimeout(function () { first.focus(); }, 260);
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }

    on(burger, "click", function () { setOpen(!doc.body.classList.contains("menu-open")); });
    $$("a", menu).forEach(function (a) { on(a, "click", function () { setOpen(false); }); });

    on(doc, "keydown", function (e) {
      if (e.key === "Escape" && doc.body.classList.contains("menu-open")) setOpen(false);
    });

    /* Trap focus inside the open menu -- with the burger inside the loop. It is
       the close control, it sits before the menu in the DOM, and a trap that
       excludes it is a menu a keyboard user cannot shut. Bound to the document
       rather than to the menu for the same reason: while the burger holds focus
       the target is outside the menu subtree. */
    on(doc, "keydown", function (e) {
      /* aria-expanded, not body.menu-open: the sent dialog borrows that class
         for its scroll lock, and a trap that fired for it would fight the
         dialog's own. */
      if (e.key !== "Tab" || burger.getAttribute("aria-expanded") !== "true") return;
      var items = [burger].concat($$("a, button", menu)).filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });

    on(window, "resize", function () {
      if (window.innerWidth > 1024 && doc.body.classList.contains("menu-open")) setOpen(false);
    });
  });

  /* ------------------------------------------------------ Language switcher */

  run("lang", function () {
    // Remember the choice so the root page can route returning visitors.
    $$(".lang__item, .menu__lang, .footer__lang").forEach(function (a) {
      on(a, "click", function () {
        try { window.localStorage.setItem("ivm-lang", a.getAttribute("data-lang") || ""); } catch (err) {}
      });
    });

    var wrap = $(".lang");
    if (!wrap) return;
    var toggle = $(".lang__toggle", wrap);
    if (!toggle) return;

    function close() {
      wrap.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    on(toggle, "click", function (e) {
      e.stopPropagation();
      var open = !wrap.classList.contains("is-open");
      wrap.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    on(doc, "click", function (e) { if (!wrap.contains(e.target)) close(); });
    on(doc, "keydown", function (e) { if (e.key === "Escape") close(); });

    // Arrow-key navigation inside the open list, and close when focus leaves
    var options = $$(".lang__item", wrap);
    on(toggle, "keydown", function (e) {
      if (e.key === "ArrowDown" && options.length) {
        e.preventDefault();
        wrap.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
        options[0].focus();
      }
    });
    options.forEach(function (opt, i) {
      on(opt, "keydown", function (e) {
        var next = null;
        if (e.key === "ArrowDown") next = options[(i + 1) % options.length];
        if (e.key === "ArrowUp") next = i === 0 ? toggle : options[i - 1];
        if (next) { e.preventDefault(); next.focus(); }
      });
    });
    on(wrap, "focusout", function (e) {
      if (!wrap.contains(e.relatedTarget)) close();
    });
  });

  /* ------------------------------------------------------- Reveal on scroll */

  run("reveal", function () {
    var items = $$("[data-reveal]");
    if (!items.length) return;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });

    // Anything still hidden after two seconds gets shown anyway.
    window.setTimeout(function () {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    }, 2000);
  });

  /* ------------------------------------------------------------- Count-up */

  run("counters", function () {
    var els = $$("[data-count]");
    if (!els.length) return;

    function settle(el) { el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || ""); }

    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach(settle);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var target = parseFloat(el.getAttribute("data-count"));
        if (isNaN(target)) { settle(el); return; }
        var suffix = el.getAttribute("data-suffix") || "";
        var dur = 1300;
        var start = null;
        function tick(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) window.requestAnimationFrame(tick);
        }
        window.requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
    window.setTimeout(function () { els.forEach(settle); }, 2600);
  });

  /* ---------------------------------------------------- Capability index */

  run("capabilities", function () {
    var items = $$(".cap-item");
    if (!items.length) return;
    var panels = $$(".cap-panel__inner");

    // Hand height control to CSS grid stacking so the panel never resizes.
    panels.forEach(function (p) { p.hidden = false; });

    function activate(id) {
      items.forEach(function (b) {
        var match = b.getAttribute("data-cap") === id;
        b.classList.toggle("is-active", match);
        b.setAttribute("aria-selected", match ? "true" : "false");
        b.setAttribute("tabindex", match ? "0" : "-1");
      });
      panels.forEach(function (p) {
        p.classList.toggle("is-active", p.getAttribute("data-cap") === id);
      });
    }

    items.forEach(function (b, i) {
      on(b, "click", function () { activate(b.getAttribute("data-cap")); });
      on(b, "mouseenter", function () {
        if (window.matchMedia("(hover: hover) and (min-width: 1025px)").matches) {
          activate(b.getAttribute("data-cap"));
        }
      });
      on(b, "keydown", function (e) {
        var next = null;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = items[(i + 1) % items.length];
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = items[(i - 1 + items.length) % items.length];
        if (next) { e.preventDefault(); next.focus(); activate(next.getAttribute("data-cap")); }
      });
    });
  });

  /* ------------------------------------------------------------- The loop */

  run("loop", function () {
    var wrap = $(".loop");
    if (!wrap) return;
    var steps = $$(".loop__step", wrap);
    var bar = $(".loop__rail i", wrap);
    if (!steps.length) return;

    if (reduced) {
      steps.forEach(function (s) { s.classList.add("is-active"); });
      if (bar) bar.style.width = "100%";
      return;
    }

    var ticking = false;
    function update() {
      var rect = wrap.getBoundingClientRect();
      var vh = window.innerHeight || root.clientHeight;
      var start = vh * 0.86;
      var end = vh * 0.22;
      var p = (start - rect.top) / (start - end + rect.height * 0.42);
      p = Math.max(0, Math.min(1, p));
      if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
      var activeCount = Math.round(p * steps.length);
      steps.forEach(function (s, i) { s.classList.toggle("is-active", i < activeCount); });
      ticking = false;
    }
    on(window, "scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    on(window, "resize", update);
    update();
  });

  /* ----------------------------------------------------------- Accordions */

  run("accordions", function () {
    var triggers = $$("[data-acc]");
    if (!triggers.length) return;

    function panelOf(trigger) { return doc.getElementById(trigger.getAttribute("aria-controls")); }

    /* A panel clipped to height 0 is hidden from the eye and from nobody else:
       the answer is still read out and its links are still in the tab order --
       five "Apply" links on the careers page with every job closed. `hidden` is
       the mechanism that removes a subtree from both, and it is set only after
       the collapse has finished animating and cleared before the expand starts,
       so the height transition is untouched. The CSS cannot do this on its own:
       the trigger is not always the panel's sibling. */
    var DUR = 460;

    function collapse(trigger) {
      var panel = panelOf(trigger);
      if (!panel) return;
      panel.style.height = panel.scrollHeight + "px";
      window.requestAnimationFrame(function () { panel.style.height = "0px"; });
      trigger.setAttribute("aria-expanded", "false");
      window.setTimeout(function () {
        if (trigger.getAttribute("aria-expanded") === "false") panel.hidden = true;
      }, DUR);
    }

    function expand(trigger) {
      var panel = panelOf(trigger);
      if (!panel) return;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      /* A frame between display:none and the height change, or the browser has
         no previous value to animate from and the panel simply snaps open. */
      window.requestAnimationFrame(function () {
        if (trigger.getAttribute("aria-expanded") === "true") panel.style.height = panel.scrollHeight + "px";
      });
      window.setTimeout(function () {
        if (trigger.getAttribute("aria-expanded") === "true") panel.style.height = "auto";
      }, DUR);
    }

    /* Collapsed is the state every panel ships in, so make that state real
       before the visitor can reach it with the Tab key. */
    triggers.forEach(function (trigger) {
      var panel = panelOf(trigger);
      if (panel && trigger.getAttribute("aria-expanded") !== "true") panel.hidden = true;
    });

    triggers.forEach(function (trigger) {
      var group = trigger.getAttribute("data-acc");
      on(trigger, "click", function () {
        var open = trigger.getAttribute("aria-expanded") === "true";
        if (group === "exclusive") {
          triggers.forEach(function (t) {
            if (t !== trigger && t.getAttribute("data-acc") === "exclusive" && t.getAttribute("aria-expanded") === "true") collapse(t);
          });
        }
        if (open) collapse(trigger); else expand(trigger);
      });
    });

    on(window, "resize", function () {
      triggers.forEach(function (t) {
        if (t.getAttribute("aria-expanded") === "true") {
          var panel = panelOf(t);
          if (panel) panel.style.height = "auto";
        }
      });
    });
  });

  /* -------------------------------------------------- Reading progress */

  run("readBar", function () {
    var bar = $("[data-read-bar]");
    if (!bar) return;
    var article = $(".prose") || $(".case-body");
    if (!article) return;

    var fill = $("i", bar);
    bar.hidden = false;
    var ticking = false;

    function update() {
      var rect = article.getBoundingClientRect();
      var start = rect.top + window.pageYOffset;
      var total = article.offsetHeight - window.innerHeight * 0.4;
      var p = total > 0 ? (window.pageYOffset - start + window.innerHeight * 0.4) / total : 1;
      p = Math.max(0, Math.min(1, p));
      fill.style.transform = "scaleX(" + p.toFixed(4) + ")";
      bar.setAttribute("aria-valuenow", Math.round(p * 100));
      ticking = false;
    }

    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    /* A progressbar takes no name from its contents, so the visually-hidden
       span inside it announced nothing. Point at it instead: the string is
       already in the markup and already translated in all five locales, which
       an aria-label written here could never be. */
    var nameEl = $(".visually-hidden", bar);
    if (nameEl) {
      if (!nameEl.id) nameEl.id = "read-bar-label";
      bar.setAttribute("aria-labelledby", nameEl.id);
    } else if (bar.getAttribute("data-label")) {
      bar.setAttribute("aria-label", bar.getAttribute("data-label"));
    }

    on(window, "scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    on(window, "resize", update);
    update();
  });

  /* ------------------------------------------------------- Back to top */

  run("toTop", function () {
    var btn = $("[data-to-top]");
    if (!btn) return;
    var ticking = false;
    function update() {
      btn.classList.toggle("is-visible", window.pageYOffset > window.innerHeight * 1.2);
      ticking = false;
    }
    on(window, "scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    on(btn, "click", function () {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      var skip = $(".skip-link");
      if (skip) skip.focus();
    });
    update();
  });

  /* ------------------------------------------------------ Insights filter */

  run("hub", function () {
    var grid = $("[data-hub]");
    if (!grid) return;
    var cards = $$("[data-article]", grid);
    var filters = $$(".hub-filter");
    var search = $("#hub-search");
    var count = $("[data-hub-count]");
    var empty = $(".hub-empty");
    var activeCat = "all";

    function normalise(s) { return (s || "").toLowerCase().trim(); }

    /* Russian, Ukrainian and Czech need a third form for 2-4 -- "2 материала",
       not "2 материалов" -- and two of the nine filters return exactly 2. The
       rule itself comes from the browser's own CLDR data keyed on the page's
       lang, so this file never has to carry a table of Slavic arithmetic; the
       markup supplies the words, one data attribute per CLDR category. Where
       Intl.PluralRules is missing, or a locale has not been given the paucal
       form yet, it falls back to the one/many pair that is already there. */
    var plural = null;
    try { plural = new Intl.PluralRules(root.getAttribute("lang") || "en"); } catch (e) {}

    function labelFor(el, n) {
      var cat = "other";
      if (plural) { try { cat = plural.select(n); } catch (e) {} }
      else cat = n === 1 ? "one" : "other";
      var one = el.getAttribute("data-label-one") || "";
      var many = el.getAttribute("data-label-many") || "";
      if (cat === "one") return one;
      if (cat === "few") return el.getAttribute("data-label-few") || many;
      return many;
    }

    function apply() {
      var q = normalise(search ? search.value : "");
      var shown = 0;
      cards.forEach(function (card) {
        var matchCat = activeCat === "all" || card.getAttribute("data-category") === activeCat;
        var matchQ = !q || normalise(card.getAttribute("data-search")).indexOf(q) !== -1;
        var visible = matchCat && matchQ;
        card.hidden = !visible;
        if (visible) shown++;
      });
      if (count) {
        count.textContent = shown + " " + labelFor(count, shown);
      }
      if (empty) empty.classList.toggle("is-visible", shown === 0);
    }

    filters.forEach(function (f) {
      on(f, "click", function () {
        activeCat = f.getAttribute("data-cat");
        filters.forEach(function (x) {
          var active = x === f;
          x.classList.toggle("is-active", active);
          x.setAttribute("aria-pressed", active ? "true" : "false");
        });
        apply();
      });
    });

    if (search) {
      var t = null;
      on(search, "input", function () {
        window.clearTimeout(t);
        t = window.setTimeout(apply, 120);
      });
    }

    on($("[data-hub-clear]"), "click", function () {
      activeCat = "all";
      if (search) search.value = "";
      filters.forEach(function (x) {
        var active = x.getAttribute("data-cat") === "all";
        x.classList.toggle("is-active", active);
        x.setAttribute("aria-pressed", active ? "true" : "false");
      });
      apply();
    });

    apply();
  });

  /* --------------------------------------------------------- Article TOC */

  run("toc", function () {
    var list = $(".article-toc__list");
    if (!list) return;
    var links = $$("a", list);
    if (!links.length) return;

    // Light the first entry so the sidebar is never blank.
    links[0].classList.add("is-active");

    var heads = links
      .map(function (a) { return doc.getElementById(a.getAttribute("href").slice(1)); })
      .filter(Boolean);
    if (!heads.length) return;

    function mark(id) {
      links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + id); });
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) mark(entry.target.id); });
      }, { rootMargin: "-10% 0px -55% 0px", threshold: 0 });
      heads.forEach(function (h) { io.observe(h); });
    }

    // Scroll-position fallback: works even where the observer never fires.
    var ticking = false;
    function update() {
      var line = window.innerHeight * 0.28;
      var current = heads[0];
      heads.forEach(function (h) { if (h.getBoundingClientRect().top <= line) current = h; });
      mark(current.id);
      ticking = false;
    }
    on(window, "scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  });

  /* ------------------------------------------------------------ Copy link */

  run("copy", function () {
    $$("[data-copy]").forEach(function (btn) {
      on(btn, "click", function () {
        var label = btn.getAttribute("data-copy-done");
        var original = btn.getAttribute("data-copy-label") || btn.textContent;
        var url = window.location.href;
        function done() {
          btn.textContent = label;
          window.setTimeout(function () { btn.textContent = original; }, 2200);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () {});
        } else {
          var ta = doc.createElement("textarea");
          ta.value = url;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          doc.body.appendChild(ta);
          ta.select();
          try { doc.execCommand("copy"); done(); } catch (e) {}
          doc.body.removeChild(ta);
        }
      });
    });
  });

  /* ------------------------------------------------------- Hero dashboard */

  /* ------------------------------------------------------------ Sent dialog */
  /* Shown once a submission is away. Declared before the form module uses it;
     if the page has no dialog the call is a no-op, so pages without one are
     unaffected rather than throwing. */

  var sentEl = null;
  var sentLastFocus = null;

  function closeSent() {
    if (!sentEl) return;
    sentEl.classList.remove("is-open");
    sentEl.setAttribute("aria-hidden", "true");
    doc.body.classList.remove("dialog-open");
    if (sentLastFocus && sentLastFocus.focus) sentLastFocus.focus();
  }

  function openSent(kind) {
    sentEl = sentEl || $("[data-sent]");
    if (!sentEl) return;
    $$("[data-sent-for]", sentEl).forEach(function (el) {
      el.hidden = el.getAttribute("data-sent-for") !== kind;
    });
    sentLastFocus = doc.activeElement;
    sentEl.classList.add("is-open");
    sentEl.setAttribute("aria-hidden", "false");
    /* Its own lock, not the menu's. Borrowing body.menu-open looked like reuse
       but also matched `body.menu-open .menu { opacity:1; visibility:visible }`,
       which carries no width condition -- so every successful submission, at
       every viewport size, raised the full-screen mobile menu (z-index 300)
       over this dialog (z-index 90). */
    doc.body.classList.add("dialog-open");
    var close = $("[data-sent-close]", sentEl);
    if (close) window.setTimeout(function () { close.focus(); }, reduced ? 0 : 220);
  }

  run("sent", function () {
    var el = $("[data-sent]");
    if (!el) return;
    sentEl = el;

    on(el, "click", function (e) {
      /* Backdrop only. A click that started inside the panel must not close it. */
      if (e.target === el || (e.target.closest && e.target.closest("[data-sent-close]"))) closeSent();
    });
    on(doc, "keydown", function (e) {
      if (e.key === "Escape" && el.classList.contains("is-open")) closeSent();
    });
    /* Focus stays inside while it is open: a dialog you can tab out of leaves
       keyboard users on a page they cannot see. */
    on(el, "keydown", function (e) {
      if (e.key !== "Tab") return;
      var items = $$("a[href], button", el).filter(function (n) { return n.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });

  /* ------------------------------------------------------------- Form mode */
  /* Company or individual. One form with two field sets, because two separate
     forms drift apart at the first edit to either. */

  run("formMode", function () {
    $$("form[data-form]").forEach(function (form) {
      var wrap = $(".form__mode", form);
      if (!wrap) return;
      var buttons = $$(".mode", wrap);
      var groups = $$("[data-when]", form);
      var carrier = $('input[name="mode"]', form);
      if (!buttons.length) return;

      function apply(mode) {
        buttons.forEach(function (b) {
          var on_ = b.getAttribute("data-mode") === mode;
          b.classList.toggle("is-active", on_);
          b.setAttribute("aria-pressed", on_ ? "true" : "false");
        });
        groups.forEach(function (g) {
          var show = g.getAttribute("data-when") === mode;
          g.hidden = !show;
          $$("input, select, textarea", g).forEach(function (el) {
            /* A hidden field that is still required blocks submission forever
               and the visitor cannot see what is wrong. Disabling also keeps
               it out of the payload and out of the validator. */
            if (show) {
              if (el.getAttribute("data-required") === "1") el.required = true;
              el.disabled = false;
            } else {
              if (el.required) el.setAttribute("data-required", "1");
              el.required = false;
              el.disabled = true;
            }
          });
        });
        /* Shared fields whose wording depends on who is asking. */
        $$("[data-ph-company]", form).forEach(function (el) {
          var ph = el.getAttribute("data-ph-" + mode);
          if (ph) el.placeholder = ph;
        });
        if (carrier) carrier.value = mode;
      }

      buttons.forEach(function (b) {
        on(b, "click", function () { apply(b.getAttribute("data-mode")); });
      });
      apply(buttons[0].getAttribute("data-mode"));
    });
  });

  /* ---------------------------------------------------------------- Forms */

  run("forms", function () {
    $$("form[data-form]").forEach(function (form) {
      var scope = form.parentNode;
      var submit = $("[type=submit]", form);
      var endpoint = form.getAttribute("data-endpoint") || "";
      var mailto = form.getAttribute("data-mailto") || "";

      function wrapOf(field) { return field.closest(".field") || field.closest(".checkbox"); }

      /* The consent error sits inside <label class="checkbox">, so the moment
         it renders it also joins the checkbox's accessible name -- "I agree
         that... Please confirm this to continue". Hiding it from the tree stops
         that; the message still reaches assistive tech through the input's
         aria-describedby, which resolves referenced nodes whether they are
         hidden or not. */
      $$(".checkbox .field__error", form).forEach(function (el) {
        el.setAttribute("aria-hidden", "true");
      });

      function setError(field, isBad) {
        var wrap = wrapOf(field);
        if (wrap) wrap.classList.toggle("has-error", isBad);
        // Announce the state programmatically, not only visually
        if (isBad) field.setAttribute("aria-invalid", "true");
        else field.removeAttribute("aria-invalid");
      }

      function validate() {
        var ok = true;
        var firstBad = null;
        $$("[required]", form).forEach(function (field) {
          var bad;
          if (field.type === "checkbox") bad = !field.checked;
          else if (field.type === "email") bad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value.trim());
          else bad = !field.value.trim();
          setError(field, bad);
          if (bad) { ok = false; if (!firstBad) firstBad = field; }
        });
        if (firstBad) firstBad.focus();
        return ok;
      }

      $$("input, select, textarea", form).forEach(function (field) {
        on(field, "input", function () {
          var wrap = wrapOf(field);
          if (wrap && wrap.classList.contains("has-error")) setError(field, false);
        });
      });

      function showStatus(kind) {
        $$("[data-status]", scope).forEach(function (s) { s.classList.remove("is-visible"); });
        var target = $('[data-status="' + kind + '"]', scope);
        if (target) {
          target.classList.add("is-visible");
          target.setAttribute("tabindex", "-1");
          target.focus();
        }
        /* A line of text under a long form is easy to miss at the exact moment
           the visitor most wants to know they were heard. The status stays --
           it is the fallback and the accessible announcement -- and a dialog
           says it properly on top. Only for outcomes worth celebrating: an
           error belongs next to the form, where the fix is. */
        if (kind === "sent" || kind === "mail") openSent(kind);
      }

      on(form, "submit", function (e) {
        e.preventDefault();
        if (!validate()) return;

        /* Honeypot. The field is off-screen, aria-hidden and out of the tab
           order, so a person never sees it and never fills it; a bot that
           walks the DOM fills everything it finds. If it has a value we show
           the same success state and send nothing -- telling a bot it failed
           only teaches it to try again.

           No timing check alongside it, deliberately: for a lead form a false
           positive costs a real client, and spam that gets through only costs
           an email. The honeypot has effectively no false positives; a
           "submitted too fast" rule does, thanks to autofill. */
        var hp = form.querySelector(".hp input");
        if (hp && hp.value) { finishQuiet(); return; }

        var data = {};
        $$("input, select, textarea", form).forEach(function (f) {
          /* Disabled fields belong to the mode the visitor did not pick --
             sending them would put empty "Компания" lines into every
             individual's enquiry. */
          if (!f.name || f === hp || f.disabled) return;
          data[f.name] = f.type === "checkbox" ? (f.checked ? "yes" : "no") : f.value.trim();
        });
        /* Which page the enquiry came from. The form cannot know it, and
           without it a lead in Telegram gives no idea what was being read. */
        data.page = window.location.pathname;

        if (submit) { submit.disabled = true; submit.setAttribute("aria-busy", "true"); }

        /* Trapped submission: looks identical to success, reports nothing. */
        function finishQuiet() {
          if (submit) { submit.disabled = false; submit.removeAttribute("aria-busy"); }
          showStatus("sent");
          form.reset();
        }

        function finish(kind) {
          if (submit) { submit.disabled = false; submit.removeAttribute("aria-busy"); }
          showStatus(kind);
          /* The outcome, not just the attempt: "mail" means the visitor was
             handed off to a mail client because no endpoint is configured. */
          track("Enquiry: " + kind);
          if (kind === "sent") form.reset();
        }

        if (endpoint && window.fetch) {
          window.fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(data)
          }).then(function (r) { finish(r.ok ? "sent" : "error"); })
            .catch(function () { finish("error"); });
        } else if (mailto) {
          // No backend configured: hand the enquiry to the visitor's mail client
          // rather than pretending a message was delivered.
          var lines = [];
          $$("input, select, textarea", form).forEach(function (f) {
            if (!f.name || f.type === "checkbox" || !f.value.trim()) return;
            var label = f.id ? form.querySelector('label[for="' + f.id + '"]') : null;
            var key = label ? label.textContent.replace(/\s+/g, " ").trim() : f.name;
            lines.push(key + ": " + f.value.trim());
          });
          var subject = "Enquiry — " + (data.company || data.name || "Ironvane Media");
          window.location.href = "mailto:" + mailto +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(lines.join("\n"));
          finish("mail");
        } else {
          finish("error");
        }
      });
    });
  });

  /* ------------------------------------------------- Smooth in-page links */

  /* ---------------------------------------------------------------- Buttons */
  /* One ripple from the point that was actually clicked. The CSS does the
     animation; this only places the element and takes it away again. Delegated
     from the document, so buttons rendered into any page are covered without
     this module knowing which pages exist. */

  run("buttons", function () {
    if (reduced) return;

    on(document, "pointerdown", function (e) {
      var btn = e.target.closest ? e.target.closest(".btn--primary") : null;
      if (!btn) return;
      /* Keyboard activation reports 0,0 in some browsers; a ripple pinned to
         the corner looks like a rendering fault, so let those pass silently. */
      if (!e.clientX && !e.clientY) return;

      var r = btn.getBoundingClientRect();
      var ripple = document.createElement("span");
      ripple.className = "btn__ripple";
      ripple.style.left = (e.clientX - r.left) + "px";
      ripple.style.top = (e.clientY - r.top) + "px";
      btn.appendChild(ripple);

      var gone = false;
      function drop() {
        if (gone) return;
        gone = true;
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }
      on(ripple, "animationend", drop);
      /* animationend never fires on a hidden tab, and the node would outlive
         the click by the length of the session. */
      window.setTimeout(drop, 900);
    });
  });

  /* -------------------------------------------------------------------- Lamp */
  /* The tube light over the nav. It rests on the current page, follows the
     pointer or the keyboard while either is in the bar, and goes back when
     they leave.

     One element for the whole nav rather than one per link: the light is a
     single object that moves, which is the entire idea, and a per-link version
     can only fade one out while fading another in. */

  run("navlamp", function () {
    var nav = $("[data-nav]");
    if (!nav) return;

    var lamp = $(".nav__lamp", nav);
    var links = $$(".nav__link", nav);
    if (!lamp || !links.length) return;

    var home = null;
    for (var i = 0; i < links.length; i++) {
      if (links[i].classList.contains("is-active")) { home = links[i]; break; }
    }

    function moveTo(el) {
      if (!el) { lamp.classList.remove("is-on"); return; }
      /* Мерим относительно самой полосы, а не через offsetLeft: у вкладки
         «Телетайп» собственный позиционированный контейнер, и offsetLeft
         кнопки внутри него считается уже от него, а не от полосы -- лампа
         уезжала бы в начало меню. */
      var base = nav.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      lamp.style.width = r.width + "px";
      lamp.style.transform = "translateX(" + (r.left - base.left) + "px)";
      lamp.classList.add("is-on");
    }

    function rest() { moveTo(home); }

    /* Placed before the first paint the user is likely to notice, and again
       once the webfont has settled -- the labels change width when Manrope
       replaces the fallback, and a lamp measured against the fallback sits
       slightly wrong until something moves it. */
    rest();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rest);
    on(window, "resize", rest);

    links.forEach(function (a) {
      on(a, "pointerenter", function () { moveTo(a); });
      on(a, "focus", function () { moveTo(a); });
      on(a, "blur", rest);
    });
    on(nav, "pointerleave", rest);
  });

  /* ------------------------------------------------------------------ Globe */
  /* The 73 markets on a turning sphere. Orthographic projection on a 2D canvas:
     a lattice of latitude and longitude for the body, one pin per market, the
     far hemisphere culled by depth.

     No continents are drawn, and that is a decision rather than a shortcut.
     Coastlines would need a world map this build has no source for, and drawing
     them from memory would put a wrong shape on a page whose whole argument is
     that its figures survive checking. A graticule states the geography it
     actually knows: where the markets are, and nothing else.

     Nothing is loaded from anywhere. The pins arrive in the markup from
     content/site.json, so the page has the data even with this file absent. */

  run("globe", function () {
    var host = $("[data-globe]");
    if (!host) return;

    var canvas = $("canvas", host);
    if (!canvas) return;

    var pins;
    try { pins = JSON.parse(host.getAttribute("data-pins") || "[]"); }
    catch (e) { return; }
    if (!pins.length) return;

    var ctx = null;
    try { ctx = canvas.getContext("2d"); } catch (e) { return; }
    if (!ctx) return;

    var W = 0, H = 0, R = 0, dpr = 1;
    var spin = 0;                 // longitude offset, radians
    var drag = null;              // pointer grab state
    var raf = null;
    var TILT = -0.32;             // a fixed lean, so the north is not edge-on

    var TAU = Math.PI * 2;
    var rad = function (d) { return d * Math.PI / 180; };

    /* The land mask: real coastlines, from Natural Earth 110m, rasterised into
       a one-degree grid at tooling time and shipped as assets/js/land.js. It is
       decoded once here; without it the globe still turns and still carries
       every pin, it simply has no continents. */
    var LAND = null;
    (function () {
      var src = window.SBA_LAND;
      if (!src || !src.bits) return;
      try {
        var bin = window.atob(src.bits);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        LAND = { w: src.w, h: src.h, step: src.step, bytes: bytes };
      } catch (e) { LAND = null; }
    })();

    function isLand(latDeg, lonDeg) {
      if (!LAND) return false;
      var x = Math.floor((lonDeg + 180) / LAND.step);
      var y = Math.floor((90 - latDeg) / LAND.step);
      if (x < 0) x = 0; else if (x >= LAND.w) x = LAND.w - 1;
      if (y < 0) y = 0; else if (y >= LAND.h) y = LAND.h - 1;
      var i = y * LAND.w + x;
      return (LAND.bytes[i >> 3] >> (7 - (i & 7))) & 1;
    }

    function size() {
      var r = host.getBoundingClientRect();
      if (!r.width) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(r.width * dpr);
      H = W;                      // the host is square by CSS
      R = W * 0.42;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      return true;
    }

    /* Orthographic projection. Returns null for anything on the far side, so
       callers never have to think about depth. */
    function project(latDeg, lonDeg) {
      var la = rad(latDeg), lo = rad(lonDeg) + spin;
      var cosLa = Math.cos(la), sinLa = Math.sin(la);
      var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
      var x = cosLa * Math.sin(lo);
      var y = cosT * sinLa - sinT * cosLa * Math.cos(lo);
      var z = sinT * sinLa + cosT * cosLa * Math.cos(lo);
      if (z <= 0) return null;
      return { x: W / 2 + x * R, y: H / 2 - y * R, z: z };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      /* The sea: one flat disc a step above the page, so the sphere is an
         object with an edge rather than a cloud of dots. */
      var g = ctx.createRadialGradient(W * 0.38, H * 0.32, R * 0.1, W / 2, H / 2, R);
      g.addColorStop(0, "rgba(255, 255, 255, 0.045)");
      g.addColorStop(1, "rgba(255, 255, 255, 0.012)");
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, R, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();

      /* The body. Dots stepped evenly over the sphere -- longitude spacing
         opens up with the cosine of latitude, so the poles do not crowd -- and
         kept where the mask says there is land. Sea is left as the page ground,
         which is what makes the continents read at all on a dark surface. */
      var SPACING = 1.8;
      for (var la = -84; la <= 84; la += SPACING) {
        var cos = Math.cos(rad(la));
        var lonStep = SPACING / Math.max(cos, 0.12);
        for (var lo = -180; lo < 180; lo += lonStep) {
          if (!isLand(la, lo)) continue;
          var p = project(la, lo);
          if (!p) continue;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.05 * dpr, 0, TAU);
          ctx.fillStyle = "rgba(242, 240, 236, " + (0.12 + p.z * 0.46).toFixed(3) + ")";
          ctx.fill();
        }
      }

      /* The rim: one hairline, so the sphere has an edge to sit against. */
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, R, 0, TAU);
      ctx.strokeStyle = "rgba(242, 240, 236, 0.13)";
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();

      /* The markets. Core carries the accent, extended the quieter ink: the
         same two-step the region list under it uses. */
      for (var i = 0; i < pins.length; i++) {
        var pin = pins[i];
        var q = project(pin[0], pin[1]);
        if (!q) continue;
        var core = pin[2] === 0;
        var fade = Math.min(1, q.z * 1.6);
        var r0 = (core ? 2.1 : 1.6) * dpr;

        if (core) {
          ctx.beginPath();
          ctx.arc(q.x, q.y, r0 * 2.6, 0, TAU);
          ctx.fillStyle = "rgba(181, 123, 255, " + (0.13 * fade).toFixed(3) + ")";
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(q.x, q.y, r0, 0, TAU);
        ctx.fillStyle = core
          ? "rgba(181, 123, 255, " + (0.55 + 0.45 * fade).toFixed(3) + ")"
          : "rgba(242, 240, 236, " + (0.30 + 0.35 * fade).toFixed(3) + ")";
        ctx.fill();
      }
    }

    function frame() {
      if (!drag) spin += 0.0016;
      if (spin > TAU) spin -= TAU;
      draw();
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (raf) return;
      /* Место занял WebGL -- плоскому глобусу больше нечего рисовать. */
      if (host.classList.contains("is-gl")) { stop(); return; }
      /* A zero-width host means layout has not settled -- a hidden tab, a font
         still swapping. Bailing without a retry is how the globe ends up blank
         for someone who opened the page in a background tab and came back. */
      if (!size()) { window.requestAnimationFrame(start); return; }
      if (reduced) { draw(); return; }
      raf = window.requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) { window.cancelAnimationFrame(raf); raf = null; }
    }

    on(window, "resize", function () { if (!host.classList.contains("is-gl") && size()) draw(); });

    /* Grab and turn. Pointer capture keeps the grab alive when the cursor
       leaves the sphere mid-drag, which is where a naive version lets go. */
    if (!reduced) {
      on(canvas, "pointerdown", function (e) {
        drag = { x: e.clientX, from: spin };
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        host.classList.add("is-grabbing");
      });
      on(canvas, "pointermove", function (e) {
        if (!drag) return;
        spin = drag.from + (e.clientX - drag.x) / 140;
        draw();
      });
      var release = function () {
        drag = null;
        host.classList.remove("is-grabbing");
      };
      on(canvas, "pointerup", release);
      on(canvas, "pointercancel", release);
    }

    /* Настоящая геометрия, если карта её потянет. Проверка отложена на кадр:
       слой объявлен в конце файла, а этот модуль выполняется при разборе. */
    window.requestAnimationFrame(function () {
      if (window.IVM3D && window.IVM3D.globe && window.IVM3D.globe(host, canvas, pins)) stop();
    });

    /* Off screen is off the clock: this runs at 60fps and nobody is watching. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
      }, { threshold: 0.08 }).observe(host);
    } else {
      start();
    }

    /* A tab that was in the background when the observer first ran never got a
       useful measurement. Coming back is the moment to take one. */
    on(document, "visibilitychange", function () {
      if (!document.hidden) start();
    });
  });

  /* ------------------------------------------------------------------ Bench */
  /* The handset: a wave on its screen, the whole object turning toward the
     pointer, and a spotlight following it across the hero.

     What is deliberately NOT here: a chart. The screen used to carry a line
     drawn from Math.random(), repainted every 5.2s -- it looked like evidence
     and carried none, and the one audience this site names is trained to spot
     exactly that. A wave cannot be misread as a measurement. */

  run("bench", function () {
    var bench = $("[data-bench]");
    if (!bench) return;

    var hero = bench.closest ? bench.closest(".hero") : null;
    var device = $(".bench__device", bench);
    var valueEl = $("[data-roi-value]", bench);
    var canvas = $("[data-wave]", bench);
    var target = parseFloat(bench.getAttribute("data-roi")) || 0;

    /* ---- The ROI counter ------------------------------------------------ */

    function countUp() {
      /* The final figure is already in the HTML, so a visitor without JS -- or
         with a frame loop that never runs -- reads the number rather than 0%.
         The count only ever starts from zero when it can actually finish. */
      if (!valueEl) return;
      if (reduced) return;
      var t0 = 0;
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min((ts - t0) / 1400, 1);
        var eased = 1 - Math.pow(1 - k, 3);
        valueEl.textContent = Math.round(target * eased) + "%";
        if (k < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    /* ---- The wave ------------------------------------------------------- */
    /* Layered sine ribbons on a 2D canvas, blended additively. Two ink colours
       only -- the accent and the live green -- because the palette carries two
       signals and a third would mean nothing. Redrawn per frame while visible;
       under reduced motion it paints one still frame and stops. */

    var waveCtx = null, waveRaf = null, waveW = 0, waveH = 0, dpr = 1;

    function sizeWave() {
      if (!canvas) return false;
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      waveW = Math.round(r.width * dpr);
      waveH = Math.round(r.height * dpr);
      if (canvas.width !== waveW || canvas.height !== waveH) {
        canvas.width = waveW;
        canvas.height = waveH;
      }
      return true;
    }

    var BANDS = [
      { hue: "181, 123, 255", amp: 0.30, freq: 1.5, speed: 0.00042, phase: 0,   width: 2.0, alpha: 0.85 },
      { hue: "181, 123, 255", amp: 0.20, freq: 2.3, speed: 0.00061, phase: 1.9, width: 1.4, alpha: 0.55 },
      { hue: "95, 227, 161",  amp: 0.24, freq: 1.9, speed: 0.00035, phase: 3.4, width: 1.6, alpha: 0.62 },
      { hue: "255, 255, 255", amp: 0.13, freq: 3.1, speed: 0.00078, phase: 5.1, width: 1.0, alpha: 0.34 }
    ];

    function drawWave(t) {
      if (!waveCtx) return;
      waveCtx.clearRect(0, 0, waveW, waveH);
      waveCtx.globalCompositeOperation = "lighter";
      var mid = waveH / 2;
      for (var b = 0; b < BANDS.length; b++) {
        var s = BANDS[b];
        waveCtx.beginPath();
        for (var x = 0; x <= waveW; x += 2) {
          var u = x / waveW;
          /* Envelope: the ribbon is pinched at both ends, so it reads as one
             body of light rather than a line running off the edges. */
          var env = Math.sin(u * Math.PI);
          var y = mid + Math.sin(u * Math.PI * 2 * s.freq + t * s.speed + s.phase)
                        * s.amp * mid * env * env;
          if (x === 0) waveCtx.moveTo(x, y); else waveCtx.lineTo(x, y);
        }
        var g = waveCtx.createLinearGradient(0, 0, waveW, 0);
        g.addColorStop(0, "rgba(" + s.hue + ", 0)");
        g.addColorStop(0.5, "rgba(" + s.hue + ", " + s.alpha + ")");
        g.addColorStop(1, "rgba(" + s.hue + ", 0)");
        waveCtx.strokeStyle = g;
        waveCtx.lineWidth = s.width * dpr;
        waveCtx.lineCap = "round";
        waveCtx.stroke();
      }
      waveCtx.globalCompositeOperation = "source-over";
    }

    function startWave() {
      if (!canvas || waveRaf) return;
      if (!sizeWave()) return;
      if (!waveCtx) { try { waveCtx = canvas.getContext("2d"); } catch (e) { return; } }
      if (!waveCtx) return;
      if (reduced) { drawWave(0); return; }
      function frame(ts) { drawWave(ts); waveRaf = window.requestAnimationFrame(frame); }
      waveRaf = window.requestAnimationFrame(frame);
    }

    function stopWave() {
      if (waveRaf) { window.cancelAnimationFrame(waveRaf); waveRaf = null; }
    }

    on(window, "resize", function () { if (sizeWave() && reduced) drawWave(0); });

    /* ---- Pointer: the object turns toward the cursor -------------------- */
    /* Tracked across the whole hero, not only over the handset itself. That is
       the difference between an element that reacts when you touch it and one
       that is aware of you -- which is the reference the brief names. */

    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var wide = window.matchMedia("(min-width: 761px)").matches;

    if (hero && device && fine && wide && !reduced) {
      var orbit = $$(".orbit-card", bench).map(function (el, i) {
        return { el: el, depth: [26, 15, 34][i] || 22 };
      });

      var frame = null;
      function track(e) {
        var r = hero.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        if (frame) window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(function () {
          device.style.setProperty("--ry", (-11 + nx * 26).toFixed(2) + "deg");
          device.style.setProperty("--rx", (2.5 - ny * 16).toFixed(2) + "deg");
          orbit.forEach(function (o) {
            o.el.style.setProperty("--px", (-nx * o.depth).toFixed(1) + "px");
            o.el.style.setProperty("--py", (-ny * o.depth * 0.55).toFixed(1) + "px");
          });
          hero.style.setProperty("--spot-x", (e.clientX - r.left).toFixed(0) + "px");
          hero.style.setProperty("--spot-y", (e.clientY - r.top).toFixed(0) + "px");
        });
      }

      on(hero, "pointerenter", function () {
        bench.classList.add("is-tilting");
        hero.style.setProperty("--spot-on", "1");
      });
      on(hero, "pointermove", track);
      on(hero, "pointerleave", function () {
        bench.classList.remove("is-tilting");
        hero.style.setProperty("--spot-on", "0");
        device.style.removeProperty("--ry");
        device.style.removeProperty("--rx");
        orbit.forEach(function (o) {
          o.el.style.removeProperty("--px");
          o.el.style.removeProperty("--py");
        });
      });
    }

    /* ---- Boot ----------------------------------------------------------- */
    /* Nothing runs until the handset has been on screen once, and the wave
       stops the moment it leaves: an animation nobody is looking at is a
       battery being spent for no one. */

    var started = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (!started) { started = true; countUp(); }
            startWave();
          } else {
            stopWave();
          }
        });
      }, { threshold: 0.15 }).observe(bench);
    } else {
      started = true;
      countUp();
      startWave();
    }
  });

  run("anchors", function () {
    $$('a[href^="#"]').forEach(function (a) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      on(a, "click", function (e) {
        var target = doc.getElementById(id.slice(1));
        if (!target) return;
        e.preventDefault();
        var header = $(".header");
        var offset = (header ? header.offsetHeight : 0) + 20;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
        target.setAttribute("tabindex", "-1");
        window.setTimeout(function () { target.focus({ preventScroll: true }); }, reduced ? 0 : 520);
        if (history.replaceState) history.replaceState(null, "", id);
      });
    });
  });

  /* ---------------------------------------------------------------- Pass */
  /* The tier buttons on the subscriptions page. Clicking one selects that
     tier in the application form and moves the page to it, so a choice the
     visitor has already made is not asked for a second time.

     A button and not a link, because the destination is on this page and the
     state change is the whole point. Every other page on the site leaves at
     the first guard. */

  run("pass", function () {
    var buttons = $$("[data-tier]");
    if (!buttons.length) return;
    var select = $("#pass-tier");
    var section = $("#apply");
    if (!select || !section) return;

    var options = $$("option", select);

    buttons.forEach(function (btn) {
      on(btn, "click", function () {
        var tier = btn.getAttribute("data-tier");
        var hit = null;
        options.forEach(function (opt) {
          /* The option carries the price after the name, so match the start of
             the value rather than the whole of it -- otherwise every price
             edit silently breaks the buttons. No tier name is a prefix of
             another, so this cannot select the wrong one. */
          if (!hit && opt.value.indexOf(tier) === 0) hit = opt.value;
        });
        /* Moving the page before the field took the value would land the
           visitor on a form that still says "choose a tier" -- which reads as
           a broken button rather than a missed match. */
        if (!hit) return;
        select.value = hit;

        track("Pass: tier", { tier: tier });

        var header = $(".header");
        var offset = (header ? header.offsetHeight : 0) + 20;
        var top = section.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
        window.setTimeout(function () {
          select.focus({ preventScroll: true });
        }, reduced ? 0 : 520);
      });
    });
  });
})();

/* ==========================================================================
   Depth -- the behaviour half of CSS section 31.

   Adds nothing to the page and overrides nothing in the module above; it only
   writes --rx / --ry onto whichever card the pointer is over. The .ivm3d class
   it sets is what gates the CSS, so a visitor with JavaScript disabled gets the
   flat site rather than a half-applied one.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var forced = root.classList.contains("force-motion");
  var reduced = !forced && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("ivm3d");


  if (reduced) return;
  if (!window.matchMedia("(hover: hover)").matches) return;

  /* Охват доворота. Пять классов покрывали меньше половины поверхностей
     сайта: карточки статей, шаги кейсов, ступени тарифов, креативы и
     раскрывающиеся вопросы оставались наклейками. */
  var SEL = ".card, a.vertical, .prog, .partner, .geo-region, .article-card," +
            ".pass-card, .case-step, .pass-step, .crea, .acc, .cap-item";
  var MAX = 11;         /* градусов в каждую сторону; было 6 и почти не читалось */
  var current = null;
  var queued = false;
  var nx = 0, ny = 0;
  /* Габарит запоминается на входе и НЕ снимается заново, пока курсор ведёт
     карточку. getBoundingClientRect возвращает размер уже наклонённого
     элемента, то есть угол считался бы от последствий самого угла —
     замкнутый круг, из-за которого карточка продолжала шевелиться под
     неподвижным курсором. */
  var rect = null;

  function apply() {
    queued = false;
    if (!current) return;
    current.style.setProperty("--rx", (ny * MAX).toFixed(2) + "deg");
    current.style.setProperty("--ry", (nx * MAX).toFixed(2) + "deg");
  }

  function release(el) {
    rect = null;
    if (!el) return;
    el.classList.remove("is-tilting");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  }

  /* Один слушатель на документ вместо восьмидесяти на карточках: на этой
     странице 66 плиток партнёрок, и вешать на каждую свой обработчик — это
     66 замыканий ради эффекта, который нужен одной карточке за раз. */
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var el = e.target.closest ? e.target.closest(SEL) : null;

    if (el !== current) {
      release(current);
      current = el;
      if (current) {
        /* Меряем ПЛОСКИЙ элемент — до того, как на нём появился угол. */
        rect = current.getBoundingClientRect();
        current.classList.add("is-tilting");
      }
    }
    if (!current || !rect) return;

    var r = rect;
    /* Зажим: указатель может оказаться за пределами карточки — при захвате
       или пока она едет. Без него угол выходил за объявленные 11 градусов. */
    nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2));
    ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * -2));
    if (!queued) { queued = true; requestAnimationFrame(apply); }
  }, { passive: true });

  /* Перехват на документе получает pointerleave и от потомков карточки, а
     потомков у неё три. Курсор пересекал внутреннюю границу — наклон
     сбрасывался и тут же набирался снова. Сбрасываем только когда ушли
     с самой карточки. */
  document.addEventListener("pointerleave", function (e) {
    if (current && e.target !== current) return;
    release(current); current = null;
  }, true);

  /* Прибор в шапке уже плавает сам. Здесь только отклик на указатель — с той
     же амплитудой, что заложена в его CSS по умолчанию (2.5° / -11°). */
  var bench = document.querySelector(".bench");
  var device = bench && bench.querySelector(".bench__device");
  if (bench && device) {
    var bq = false, bx = 0, by = 0;
    bench.addEventListener("pointermove", function (e) {
      var r = bench.getBoundingClientRect();
      bx = ((e.clientX - r.left) / r.width - .5) * 2;
      by = ((e.clientY - r.top) / r.height - .5) * -2;
      bench.classList.add("is-tilting");
      if (bq) return;
      bq = true;
      requestAnimationFrame(function () {
        bq = false;
        device.style.setProperty("--rx", (2.5 + by * 8).toFixed(2) + "deg");
        device.style.setProperty("--ry", (-11 + bx * 12).toFixed(2) + "deg");
      });
    }, { passive: true });
    bench.addEventListener("pointerleave", function () {
      bench.classList.remove("is-tilting");
      device.style.removeProperty("--rx");
      device.style.removeProperty("--ry");
    });
  }
})();

/* ==========================================================================
   Deeper -- поведение к секции 32 стилей.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("ivm3d")) return;
  var forced = root.classList.contains("force-motion");
  if (!forced && matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* Глубина колоды вертикалей = число партнёрок. Берём его из самой карточки,
     а не из таблицы в коде: если на сайте поменяется счёт, объём поедет за ним
     сам. */
  Array.prototype.forEach.call(document.querySelectorAll("a.vertical"), function (el) {
    var m = (el.textContent || "").match(/(\d+)\s*партн|(\d+)\s*partner|(\d+)\s*програм/i);
    var n = m ? Number(m[1] || m[2] || m[3]) : null;
    if (!n) { var num = el.querySelector(".vertical__num, .num"); n = num ? Number((num.textContent||"").replace(/\D/g,"")) : 4; }
    el.style.setProperty("--n", Math.max(1, Math.min(12, n || 4)));
  });

  /* Волна по плиткам партнёрок: задержка от положения в сетке, а не от
     порядка в разметке -- иначе шестьдесят шесть штук въезжают одной стеной. */
  var partners = document.querySelectorAll(".partner");
  if (partners.length) {
    var cols = 1, firstTop = null;
    Array.prototype.forEach.call(partners, function (el, i) {
      var t = el.offsetTop;
      if (firstTop === null) firstTop = t;
      if (t === firstTop) cols = i + 1;
    });
    Array.prototype.forEach.call(partners, function (el, i) {
      el.style.setProperty("--w", (i % cols) + Math.floor(i / cols));
    });
  }

  /* Порядок подъёма плиток внутри карточки. */
  Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
    Array.prototype.forEach.call(card.querySelectorAll(".metric"), function (m, i) {
      m.style.setProperty("--mi", i);
    });
  });

  /* Прибор доворачивается, пока шапка уходит вверх: момент привязан к
     положению страницы, а не к таймеру, поэтому он всегда там, где читатель. */
  var bench = document.querySelector(".bench");
  if (bench) {
    var q = false;
    addEventListener("scroll", function () {
      if (q) return;
      q = true;
      requestAnimationFrame(function () {
        q = false;
        var r = bench.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, -r.top / (r.height || 1)));
        root.style.setProperty("--scroll-tilt", (p * 9).toFixed(2) + "deg");
      });
    }, { passive: true });
  }
})();

/* ==========================================================================
   33. Настоящая геометрия

   Секции 31 и 32 наклоняли плоские блоки. Здесь появляется предмет: его
   считает WebGL, написанный тут же, без библиотек — правило сайта «никакой
   зависимости, потерю которой он не переживёт», остаётся в силе.

   Предмет ровно один, и это глобус в разделе «География». Плоская проекция
   заменена настоящим шаром: плитки суши подняты над океаном, по береговой
   линии у них обрывы, 73 рынка стоят столбиками по местной нормали и уходят
   за горизонт по буферу глубины, а не по прозрачности.

   И он не крутится просто так. Наведение на карточку региона доворачивает
   шар к этому региону и гасит все рынки, кроме его собственных: на карточке
   написано «Западная Европа · 9» — на шаре горит девять, и это можно
   пересчитать пальцем. Наведение на код страны зажигает одну точку.

   Правило, по которому предмет имеет право стоять на странице — и по которому
   отсюда был убран ротор с шестью лопастями:
     1. это та самая вещь, а не метафора вещи;
     2. он стоит там, где напечатаны данные, которые он несёт;
     3. число его частей равно напечатанному числу;
     4. он поворачивается от действия читателя, а не разгоняется сам.
   Ротор выполнял только третий пункт.

   Если WebGL недоступен, глобус остаётся плоским — тем самым, что работает
   сейчас, побайтово.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var forceMotion = root.classList.contains("force-motion");
  var reduced = !forceMotion && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- Матрицы */
  /* Столбцовый порядок, как того хочет WebGL. Нужны ровно четыре штуки. */

  function mul(a, b, o) {
    o = o || new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4]     = b0 * a[0] + b1 * a[4] + b2 * a[8]  + b3 * a[12];
      o[i * 4 + 1] = b0 * a[1] + b1 * a[5] + b2 * a[9]  + b3 * a[13];
      o[i * 4 + 2] = b0 * a[2] + b1 * a[6] + b2 * a[10] + b3 * a[14];
      o[i * 4 + 3] = b0 * a[3] + b1 * a[7] + b2 * a[11] + b3 * a[15];
    }
    return o;
  }
  function persp(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }
  function rotX(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function rotY(a) {
    var c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  function trans(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  /* ------------------------------------------------------------------ Сетка */
  /* Плоские нормали по умолчанию: у плиточного рельефа грань обязана читаться
     гранью. Порядок вершин везде против часовой, если смотреть снаружи, —
     тогда нормаль сама указывает наружу и свет не выворачивается наизнанку.

     Для шаров есть отдельный путь со сглаженной нормалью: океан, собранный
     плоскими гранями, даёт гранёный край вместо круглого. */

  function Mesh() { this.v = []; }

  Mesh.prototype.tri = function (a, b, c, col) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var L = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= L; ny /= L; nz /= L;
    var V = this.v, p = [a, b, c], i;
    for (i = 0; i < 3; i++) {
      V.push(p[i][0], p[i][1], p[i][2], nx, ny, nz, col[0], col[1], col[2]);
    }
  };
  Mesh.prototype.quad = function (a, b, c, d, col) {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  };
  /* Нормаль из самой точки: сфера с центром в нуле, снаружи (s=1) или
     изнутри (s=-1). */
  Mesh.prototype.sphTri = function (a, b, c, col, s) {
    var V = this.v, p = [a, b, c], i, q, L;
    for (i = 0; i < 3; i++) {
      q = p[i];
      L = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]) || 1;
      V.push(q[0], q[1], q[2], s * q[0] / L, s * q[1] / L, s * q[2] / L, col[0], col[1], col[2]);
    }
  };
  Mesh.prototype.sphQuad = function (a, b, c, d, col, s) {
    this.sphTri(a, b, c, col, s);
    this.sphTri(a, c, d, col, s);
  };
  Mesh.prototype.upload = function (gl) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.v), gl.STATIC_DRAW);
    var n = this.v.length / 9;
    this.v = null;                 // геометрия уехала на карту, в JS её держать незачем
    return { buf: buf, n: n };
  };

  /* --------------------------------------------------------------- Шейдеры */
  /* Одна лампа, закреплённая в комнате, а не на предмете: модель
     поворачивается, свет стоит. Это и отличает предмет от картинки предмета.

     uTint — множитель яркости, которым гасятся рынки вне выбранного региона.
     Именно яркостью, а не цветом: перивинкль в этой секции уже занят и
     означает «основной рынок» — это написано в легенде прямо под шаром.
     Четвёртый смысл у того же хью заставил бы легенду врать. */

  var VS =
    "attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol;" +
    "uniform mat4 uMVP; uniform mat4 uModel;" +
    "varying vec3 vN; varying vec3 vC; varying vec3 vP;" +
    "void main(){" +
    "  vN = (uModel * vec4(aNrm, 0.0)).xyz;" +
    "  vP = (uModel * vec4(aPos, 1.0)).xyz;" +
    "  vC = aCol;" +
    "  gl_Position = uMVP * vec4(aPos, 1.0);" +
    "}";

  var FS =
    "precision mediump float;" +
    "varying vec3 vN; varying vec3 vC; varying vec3 vP;" +
    "uniform vec3 uLight; uniform vec3 uEye;" +
    "uniform float uAmb; uniform float uSpec; uniform float uRim;" +
    "uniform float uAlpha; uniform float uBack; uniform float uTint;" +
    "void main(){" +
    "  vec3 n = normalize(vN);" +
    "  vec3 l = normalize(uLight);" +
    "  vec3 e = normalize(uEye - vP);" +
    "  float d = max(dot(n, l), 0.0);" +
    /* Подсветка с обратной стороны, очень слабая: без неё неосвещённая грань
       проваливается в фон страницы и предмет теряет объём вместо того, чтобы
       его иметь. */
    "  float back = max(dot(n, -l), 0.0) * uBack;" +
    "  float fres = pow(1.0 - max(dot(n, e), 0.0), 3.0);" +
    "  vec3 h = normalize(l + e);" +
    "  float s = pow(max(dot(n, h), 0.0), 46.0) * uSpec;" +
    "  vec3 c = vC * (uAmb + d * 0.95 + back) + vec3(0.62, 0.66, 0.82) * fres * uRim + vec3(1.0) * s;" +
    "  gl_FragColor = vec4(c * uTint * uAlpha, uAlpha);" +
    "}";

  function build(gl) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    return {
      p: p,
      aPos: gl.getAttribLocation(p, "aPos"),
      aNrm: gl.getAttribLocation(p, "aNrm"),
      aCol: gl.getAttribLocation(p, "aCol"),
      uMVP: gl.getUniformLocation(p, "uMVP"),
      uModel: gl.getUniformLocation(p, "uModel"),
      uLight: gl.getUniformLocation(p, "uLight"),
      uEye: gl.getUniformLocation(p, "uEye"),
      uAmb: gl.getUniformLocation(p, "uAmb"),
      uSpec: gl.getUniformLocation(p, "uSpec"),
      uRim: gl.getUniformLocation(p, "uRim"),
      uAlpha: gl.getUniformLocation(p, "uAlpha"),
      uBack: gl.getUniformLocation(p, "uBack"),
      uTint: gl.getUniformLocation(p, "uTint")
    };
  }

  function context(canvas) {
    var opt = {
      alpha: true, antialias: true, depth: true,
      premultipliedAlpha: true, powerPreference: "low-power"
    };
    try {
      return canvas.getContext("webgl", opt) || canvas.getContext("experimental-webgl", opt);
    } catch (e) { return null; }
  }

  /* Единственная точка отрисовки. uTint выставляется ЗДЕСЬ и всегда: незаданный
     uniform в GL равен нулю, и пропуск в одном из путей красит геометрию в
     чёрный, а вовсе не «просто не гасит». */
  function draw(gl, P, m, tint) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
    var S = 36;
    gl.enableVertexAttribArray(P.aPos); gl.vertexAttribPointer(P.aPos, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(P.aNrm); gl.vertexAttribPointer(P.aNrm, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(P.aCol); gl.vertexAttribPointer(P.aCol, 3, gl.FLOAT, false, S, 24);
    gl.uniform1f(P.uTint, tint);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
  }

  /* ------------------------------------------------------------------ Цикл */
  /* Не видно — не считаем. Ровно тот же договор, что у плоского глобуса.
     repaint() нужен для сокращённого движения: там кадр рисуется один раз и
     rAF не заводится, поэтому подсветку надо перерисовывать по событию. */

  function drive(host, canvas, gl, frame) {
    var raf = null, W = 0, H = 0, dpr = 1;

    function size() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
      W = w; H = h;
      gl.viewport(0, 0, W, H);
      return true;
    }
    function once() { if (size()) frame(W / H, false); }
    function tick() { if (size()) frame(W / H, true); raf = window.requestAnimationFrame(tick); }
    function start() {
      if (raf) return;
      /* Нулевая ширина — вёрстка ещё не села: фоновая вкладка, шрифт в обмене.
         Уйти без повтора — это и есть способ показать пустое место. */
      if (!size()) { window.requestAnimationFrame(start); return; }
      if (reduced) { frame(W / H, false); return; }
      raf = window.requestAnimationFrame(tick);
    }
    function stop() { if (raf) { window.cancelAnimationFrame(raf); raf = null; } }

    window.addEventListener("resize", once, { passive: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
      }, { threshold: 0.02 }).observe(host);
    } else { start(); }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) start(); });

    return { start: start, stop: stop, repaint: once };
  }

  /* =============================================================== Геометрия

     Суша — не точки, а плитки: каждая поднята над океаном, и там, где рядом
     вода, у неё виден обрыв. Берег получает толщину, и шар перестаёт быть
     наклейкой. Рынки собираются отдельными сетками, по одной на точку: это
     74 вызова отрисовки за кадр вместо двух — для видеокарты пустяк, — и
     ровно это позволяет зажечь одну страну, а не только целый регион.
     ------------------------------------------------------------------------ */

  function sph(latDeg, lonDeg, r) {
    var la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180, c = Math.cos(la);
    return [r * c * Math.sin(lo), r * Math.sin(la), r * c * Math.cos(lo)];
  }

  var LIFT = 1.0235, BASE = 0.9995;
  var CORE = [0.482, 0.549, 1.000], EXT = [0.560, 0.552, 0.530];

  function bodyMesh() {
    var m = new Mesh(), i, j, la, lo;

    /* --- Океан: шар чуть ниже плиток, почти цвета страницы, но с краем --- */
    var OC = [0.040, 0.043, 0.056], RS = 0.997, LA = 48, LO = 96;
    for (i = 0; i < LA; i++) {
      var la0 = -90 + i * (180 / LA), la1 = la0 + 180 / LA;
      for (j = 0; j < LO; j++) {
        var lo0 = -180 + j * (360 / LO), lo1 = lo0 + 360 / LO;
        m.sphQuad(sph(la0, lo0, RS), sph(la0, lo1, RS), sph(la1, lo1, RS), sph(la1, lo0, RS), OC, 1);
      }
    }

    /* --- Суша: маска Natural Earth, уже лежащая в land.js --- */
    var LAND = null;
    try {
      var src = window.SBA_LAND;
      if (src && src.bits) {
        var bin = window.atob(src.bits);
        var by = new Uint8Array(bin.length);
        for (i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
        LAND = { w: src.w, h: src.h, step: src.step, bytes: by };
      }
    } catch (e) { LAND = null; }

    function isLand(latDeg, lonDeg) {
      if (!LAND) return false;
      if (lonDeg < -180) lonDeg += 360; else if (lonDeg >= 180) lonDeg -= 360;
      var x = Math.floor((lonDeg + 180) / LAND.step);
      var y = Math.floor((90 - latDeg) / LAND.step);
      if (y < 0 || y >= LAND.h) return false;
      if (x < 0) x = 0; else if (x >= LAND.w) x = LAND.w - 1;
      var k = y * LAND.w + x;
      return !!((LAND.bytes[k >> 3] >> (7 - (k & 7))) & 1);
    }

    var ST = 2, G = 0.20;
    var TOP = [0.560, 0.552, 0.530];     // тёплые чернила сайта под светом
    var SIDE = [0.225, 0.228, 0.246];    // обрыв холоднее верха — так он читается обрывом
    for (la = -84; la < 86; la += ST) {
      for (lo = -180; lo < 180; lo += ST) {
        if (!isLand(la + ST / 2, lo + ST / 2)) continue;
        var a0 = la + G, a1 = la + ST - G, o0 = lo + G, o1 = lo + ST - G;
        m.quad(sph(a0, o0, LIFT), sph(a0, o1, LIFT), sph(a1, o1, LIFT), sph(a1, o0, LIFT), TOP);
        /* Обрыв только там, где действительно вода: внутри материка стенок нет,
           иначе шар весит втрое и выглядит клетчатым. */
        if (!isLand(la + ST / 2, lo - ST / 2))
          m.quad(sph(a0, o0, BASE), sph(a0, o0, LIFT), sph(a1, o0, LIFT), sph(a1, o0, BASE), SIDE);
        if (!isLand(la + ST / 2, lo + ST * 1.5))
          m.quad(sph(a1, o1, BASE), sph(a1, o1, LIFT), sph(a0, o1, LIFT), sph(a0, o1, BASE), SIDE);
        if (!isLand(la - ST / 2, lo + ST / 2))
          m.quad(sph(a0, o1, BASE), sph(a0, o1, LIFT), sph(a0, o0, LIFT), sph(a0, o0, BASE), SIDE);
        if (!isLand(la + ST * 1.5, lo + ST / 2))
          m.quad(sph(a1, o0, BASE), sph(a1, o0, LIFT), sph(a1, o1, LIFT), sph(a1, o1, BASE), SIDE);
      }
    }
    return m;
  }

  /* Один рынок — один столбик, стоящий по местной нормали. Высота продолжает
     значить ровно одно: основной рынок против расширенного покрытия. Второй
     смысл на той же высоте сделал бы её нечитаемой. */
  function pinMesh(pin) {
    var m = new Mesh();
    var core = pin[2] === 0;
    var h = core ? 0.086 : 0.046;
    var w0 = core ? 0.0100 : 0.0072, w1 = w0 * 0.42;
    var col = core ? CORE : EXT;

    var bs = sph(pin[0], pin[1], LIFT - 0.006);
    var L = Math.sqrt(bs[0] * bs[0] + bs[1] * bs[1] + bs[2] * bs[2]) || 1;
    var up = [bs[0] / L, bs[1] / L, bs[2] / L];
    /* Местный восток = ось мира × нормаль; север достраивается, и тройка
       (восток, север, нормаль) оказывается правой — порядок углов ниже на это
       рассчитывает. */
    var ex = [up[2], 0, -up[0]];
    var eL = Math.sqrt(ex[0] * ex[0] + ex[2] * ex[2]) || 1;
    ex = [ex[0] / eL, 0, ex[2] / eL];
    var nr = [
      up[1] * ex[2] - up[2] * ex[1],
      up[2] * ex[0] - up[0] * ex[2],
      up[0] * ex[1] - up[1] * ex[0]
    ];

    function ring(w, t) {
      function c(se, sn) {
        return [
          bs[0] + up[0] * t + ex[0] * (se * w) + nr[0] * (sn * w),
          bs[1] + up[1] * t + ex[1] * (se * w) + nr[1] * (sn * w),
          bs[2] + up[2] * t + ex[2] * (se * w) + nr[2] * (sn * w)
        ];
      }
      return [c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)];
    }

    var B = ring(w0, 0), T = ring(w1, h), j;
    for (j = 0; j < 4; j++) {
      var j2 = (j + 1) % 4;
      m.quad(B[j], B[j2], T[j2], T[j], col);
    }
    m.quad(T[0], T[1], T[2], T[3], col);
    return m;
  }

  /* Ореол: шар побольше, показанный изнанкой и сложенный со страницей. Он
     ничего не закрывает — только очерчивает край, чтобы у предмета была
     атмосфера, а не обводка. */
  function haloMesh() {
    var m = new Mesh(), R = 1.17, C = [0.24, 0.27, 0.52], LA = 32, LO = 64, i, j;
    for (i = 0; i < LA; i++) {
      var la0 = -90 + i * (180 / LA), la1 = la0 + 180 / LA;
      for (j = 0; j < LO; j++) {
        var lo0 = -180 + j * (360 / LO), lo1 = lo0 + 360 / LO;
        m.sphQuad(sph(la0, lo1, R), sph(la0, lo0, R), sph(la1, lo0, R), sph(la1, lo1, R), C, -1);
      }
    }
    return m;
  }

  /* ========================================================= Договор с текстом

     Регион нарезается ТЕМ ЖЕ числом, которое напечатано на его карточке. Ни
     одной новой цифры, ни одного нового атрибута в разметке. Отсюда три
     проверки; если хоть одна не сошлась, связка молча не включается и шар
     остаётся прежним. Врущий прибор хуже украшения: украшение ничего не
     обещает.
     ------------------------------------------------------------------------ */

  function readContract(host, pins) {
    var layout = host.closest ? host.closest(".geo__layout") : null;
    if (!layout) return { error: "не найден .geo__layout" };

    var cards = Array.prototype.slice.call(layout.querySelectorAll(".geo-region"));
    if (!cards.length) return { error: "не найдено ни одной карточки .geo-region" };

    var at = 0, coreSum = 0, groups = [], codeEls = [], i;
    for (i = 0; i < cards.length; i++) {
      var nEl = cards[i].querySelector(".geo-region__n");
      var codes = Array.prototype.slice.call(cards[i].querySelectorAll(".geo-code"));
      var n = nEl ? parseInt(nEl.textContent, 10) : NaN;
      if (!(n > 0) || n !== codes.length) {
        return { error: "карточка " + (i + 1) + ": напечатано " + n + ", кодов " + codes.length };
      }
      if (cards[i].classList.contains("geo-region--core")) coreSum += n;
      groups.push({ card: cards[i], from: at, count: n });
      codeEls = codeEls.concat(codes);
      at += n;
    }
    if (at !== pins.length) {
      return { error: "сумма напечатанных чисел " + at + ", а точек " + pins.length };
    }

    /* Шов «основные / расширенное покрытие» обязан падать ровно туда, где
       третий флаг в пинах переключается с 0 на 1. Не падает — значит порядок
       пинов и порядок карточек разъехались, и всё остальное бессмысленно. */
    var firstExt = -1;
    for (i = 0; i < pins.length; i++) if (pins[i][2] === 1) { firstExt = i; break; }
    if (firstExt !== coreSum) {
      return { error: "шов основных рынков: по карточкам " + coreSum + ", по точкам " + firstExt };
    }

    return { layout: layout, groups: groups, codeEls: codeEls };
  }

  /* Куда довернуть шар, чтобы срез оказался посередине. Центроид — сумма
     единичных векторов среза; после rotY(a) точка с долготой lo уезжает в
     lo + a, значит к камере она выходит при a = -lo. */
  function aimAt(pins, from, count) {
    var x = 0, y = 0, z = 0, i, v;
    for (i = from; i < from + count; i++) {
      v = sph(pins[i][0], pins[i][1], 1);
      x += v[0]; y += v[1]; z += v[2];
    }
    var L = Math.sqrt(x * x + y * y + z * z) || 1;
    /* Поворот по долготе выводит центроид на меридиан камеры; наклон по
       широте поднимает его к середине диска, где точка крупнее всего и
       меньше всего искажена. Без второго рынки Скандинавии оказываются
       прижаты к верхнему краю шара, и обещание «пересчитайте» не работает
       ровно там, где рынков больше всего.

       Наклон ограничен сорока градусами: дальше вид становится взглядом на
       полюс, шар перестаёт читаться шаром, а Исландия с её 64° утащила бы
       камеру именно туда. */
    var lat = Math.asin(Math.max(-1, Math.min(1, y / L)));
    var MAXT = 0.70;
    return {
      spin: -Math.atan2(x, z),
      tilt: Math.max(-MAXT, Math.min(MAXT, lat))
    };
  }

  /* ================================================================= Сборка */

  function globe3d(host, flat, pins) {
    if (!pins || !pins.length) return false;

    var canvas = document.createElement("canvas");
    canvas.className = "geo-globe__gl";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, flat);

    var gl = context(canvas);
    if (!gl) { host.removeChild(canvas); return false; }

    var P, body, halo, pinMeshes = [], i;
    try {
      P = build(gl);
      body = bodyMesh().upload(gl);
      halo = haloMesh().upload(gl);
      for (i = 0; i < pins.length; i++) pinMeshes.push(pinMesh(pins[i]).upload(gl));
    } catch (err) { host.removeChild(canvas); return false; }

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var TILT = -0.30;                   // как шар лежит, когда ничего не выбрано
    var spin = 0, tilt = TILT, drag = null, EYE = [0, 0, 3.6];
    var tiltTo = TILT;                  // куда наклоняемся; в покое — к TILT
    var active = null;      // {from, count} — что сейчас выбрано, null — ничего
    var target = null;      // куда летим, радианы; null — прилетели
    /* Яркость рынков при выборе. Гаснут и загораются именно яркостью, не
       цветом: перивинкль в этой секции уже занят под «основной рынок».

       Обе цифры мерились на экране. 0,32 на погашенных оказалось слишком
       мягко — девятку глазом не пересчитать, а весь смысл связки в том,
       чтобы её можно было пересчитать. А ровная единица на выбранных
       теряется на светлой плитке суши, поэтому выбранные не «остаются как
       были», а выходят вперёд. Когда не выбрано ничего, оба множителя не
       применяются вовсе и шар выглядит ровно как прежде. */
    var DIM = 0.13, HI = 1.5;
    var ctl = null;

    function frame(aspect, animate) {
      if (animate) {
        if (target !== null) {
          spin += (target - spin) * 0.12;
          if (Math.abs(target - spin) < 0.002) { spin = target; target = null; }
        } else if (!active && !drag) {
          spin += 0.0016;
        }
        /* Наклон возвращается к покою сам, даже когда полёт по долготе уже
           закончился: иначе шар остаётся лежать так, как его положил
           последний регион. */
        if (Math.abs(tiltTo - tilt) > 0.0005) tilt += (tiltTo - tilt) * 0.12;
        else tilt = tiltTo;
      }

      var model = mul(rotX(tilt), rotY(spin));
      var mvp = mul(persp(0.72, aspect, 0.1, 20), mul(trans(0, 0, -EYE[2]), model));

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.uMVP, false, mvp);
      gl.uniformMatrix4fv(P.uModel, false, model);
      gl.uniform3f(P.uLight, -0.46, 0.58, 0.74);
      gl.uniform3f(P.uEye, EYE[0], EYE[1], EYE[2]);

      /* Тело шара: яркость не трогается никогда — гаснут рынки, не планета. */
      gl.depthMask(true);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(P.uAmb, 0.075);
      gl.uniform1f(P.uSpec, 0.16);
      gl.uniform1f(P.uRim, 0.12);
      gl.uniform1f(P.uBack, 0.045);
      gl.uniform1f(P.uAlpha, 1.0);
      draw(gl, P, body, 1.0);

      for (var k = 0; k < pinMeshes.length; k++) {
        if (!active) { draw(gl, P, pinMeshes[k], 1.0); continue; }
        var lit = k >= active.from && k < active.from + active.count;
        draw(gl, P, pinMeshes[k], lit ? HI : DIM);
      }

      /* Ореол складывается со страницей и глубину не пишет: он позади шара, а
         буфер глубины уже знает, где шар кончается. */
      gl.depthMask(false);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1f(P.uAmb, 0.0);
      gl.uniform1f(P.uSpec, 0.0);
      gl.uniform1f(P.uRim, 0.34);
      gl.uniform1f(P.uBack, 0.0);
      gl.uniform1f(P.uAlpha, 0.16);
      draw(gl, P, halo, 1.0);
      gl.depthMask(true);
    }

    function same(a, b) {
      if (!a || !b) return a === b;
      return a.from === b.from && a.count === b.count;
    }

    function setActive(a) {
      if (same(a, active)) return;
      active = a;
      if (a) {
        var aim = aimAt(pins, a.from, a.count);
        var t = aim.spin;
        /* spin копится монотонно и через пять минут равен десяткам радиан.
           Без приведения по модулю 2π шар честно открутит эти обороты назад. */
        t += TAU * Math.round((spin - t) / TAU);
        tiltTo = aim.tilt;
        if (reduced) { spin = t; tilt = tiltTo; target = null; } else { target = t; }
      } else {
        tiltTo = TILT;
        target = null;
        if (reduced) tilt = TILT;
      }
      if (reduced && ctl) ctl.repaint();
    }

    ctl = drive(host, canvas, gl, frame);

    /* Захват и поворот — тот же жест, что был у плоского глобуса. Рука важнее
       полёта: взялись за шар — выбор снимается. */
    if (!reduced) {
      canvas.addEventListener("pointerdown", function (e) {
        setActive(null);
        drag = { x: e.clientX, from: spin };
        target = null;
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        host.classList.add("is-grabbing");
      });
      canvas.addEventListener("pointermove", function (e) {
        if (!drag) return;
        spin = drag.from + (e.clientX - drag.x) / 150;
      });
      var release = function () { drag = null; host.classList.remove("is-grabbing"); };
      canvas.addEventListener("pointerup", release);
      canvas.addEventListener("pointercancel", release);
    }

    /* ----------------------------------------------------- Связка с текстом */

    var read = readContract(host, pins);
    var link = read && !read.error ? read : null;
    /* Только намеренное наведение. На тач-устройстве связки нет вовсе:
       полупоявление хуже отсутствия. */
    var hoverable = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);

    /* Сокращённое движение не отменяет прибор, оно отменяет полёт: при нём шар
       становится в нужное положение сразу и перерисовывается по событию.
       Убрать связку целиком значило бы забрать у человека сведения, а просили
       его не о сведениях, а о движении. */
    if (link && hoverable) {
      var timer = null;
      /* Курсор по дороге к нужной карточке пересекает три-четыре чужих.
         Без порога шар дёргается на каждую. */
      var later = function (a) {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(function () { timer = null; setActive(a); }, 120);
      };

      link.groups.forEach(function (g) {
        g.card.addEventListener("pointerenter", function () {
          later({ from: g.from, count: g.count });
        });
        g.card.addEventListener("pointerleave", function () { later(null); });
      });

      /* Страна — делегированием: кодов 73, своих слушателей им не нужно. */
      link.layout.addEventListener("pointerover", function (e) {
        var el = e.target && e.target.closest ? e.target.closest(".geo-code") : null;
        if (!el) return;
        var idx = link.codeEls.indexOf(el);
        if (idx < 0) return;
        later({ from: idx, count: 1 });
      });

      link.layout.classList.add("is-linked");
    } else if (!link && window.console && console.warn) {
      console.warn("[ivm] глобус: связка выключена — " + (read && read.error ? read.error : "причина не определена"));
    }

    host.classList.add("is-gl");
    ctl.start();
    return true;
  }

  /* ------------------------------------------------------------------ Пуск */

  window.IVM3D = {
    globe: function (host, flatCanvas, pins) {
      try { return globe3d(host, flatCanvas, pins); }
      catch (e) { if (window.console && console.warn) console.warn("[ivm] globe3d:", e); return false; }
    }
  };
})();


/* ==========================================================================
   34. Качание от прокрутки

   Поведенческая половина CSS-секции 34. Пишет на каждую сетку один угол --sy
   по её положению на экране: сетка внизу наклонена к зрителю, в середине
   стоит ровно, ушедшая вверх — отклонена от него. Элементы наследуют угол и
   поворачиваются в общей перспективе сетки, поэтому ряд проходит мимо
   камеры целиком, а не разваливается на отдельно крутящиеся карточки.

   Это единственная часть объёма, которую видно, пока человек просто листает
   и никуда не наводит курсор. Всё остальное в секциях 31-34 ждёт указателя.

   Ничего не добавляет в разметку и ничего не отменяет: одна переменная на
   контейнер. Не выполнился — сайт остаётся ровно таким, как без него.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var forced = root.classList.contains("force-motion");
  var reduced = !forced && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var SEL = ".cases, .articles, .pass-grid, .progs, .crea-grid, .verticals," +
            ".geo__regions, .loop__steps, .accordion, .tiles, .cap-list," +
            /* Полоса подвала целиком, одной плитой: там объём иначе виден
               только под курсором, а подвал листают, а не изучают. */
            ".footer__top";

  var grids = Array.prototype.slice.call(document.querySelectorAll(SEL));
  if (!grids.length) return;

  var MAX = 3.4;              // градусов в каждую сторону, мерено на экране
  var live = [];              // только те сетки, что сейчас видны
  var queued = false;

  grids.forEach(function (g) { g.setAttribute("data-swing", ""); });

  function apply() {
    queued = false;
    var h = window.innerHeight || 1;
    var mid = h / 2;
    for (var i = 0; i < live.length; i++) {
      var g = live[i];
      var r = g.getBoundingClientRect();
      /* Доля пути от середины экрана: +1 — сетка целиком внизу, -1 — ушла
         вверх. Считаем по центру сетки, а не по её верху: у длинной колоды
         карточек верх уезжает за экран задолго до того, как её перестают
         читать, и угол начинал бы жить своей жизнью. */
      var c = r.top + r.height / 2;
      var p = (c - mid) / h;
      if (p > 1) p = 1; else if (p < -1) p = -1;
      g.style.setProperty("--sy", (p * MAX).toFixed(2) + "deg");
    }
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(apply);
  }

  /* Считаем только видимое. На странице кейса таких сеток шесть, и держать их
     все на счётчике при каждом кадре прокрутки — это ровно та работа, за
     которую платят батареей и ничего не получают. */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var at = live.indexOf(e.target);
        if (e.isIntersecting) { if (at < 0) live.push(e.target); }
        else if (at >= 0) { live.splice(at, 1); e.target.style.setProperty("--sy", "0deg"); }
      });
      onScroll();
    }, { rootMargin: "10% 0px 10% 0px" });
    grids.forEach(function (g) { io.observe(g); });
  } else {
    live = grids;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();


/* ==========================================================================
   35. Вкладка «Телетайп»

   Раскрытие делает CSS — на :hover и :focus-within. Здесь только то, чего
   CSS сказать не умеет: состояние для тех, кто читает страницу не глазами,
   и выход по Escape.

   Поэтому модуль ничего не прячет и ничего не показывает. Если он не
   выполнится, список всё равно раскроется наведением, и ни одна ссылка не
   станет недостижимой — правило этого файла: ничто, скрывающее содержимое,
   не должно зависеть от успеха модуля.
   ========================================================================== */
(function () {
  "use strict";

  var more = document.querySelector("[data-nav-more]");
  if (!more) return;

  var btn = more.querySelector(".nav__more-btn");
  if (!btn) return;

  function state(open) { btn.setAttribute("aria-expanded", open ? "true" : "false"); }

  more.addEventListener("pointerenter", function () { state(true); });
  more.addEventListener("pointerleave", function () { state(false); });
  more.addEventListener("focusin", function () { state(true); });
  more.addEventListener("focusout", function (e) {
    /* focusout срабатывает и при переходе между ссылками внутри списка —
       закрываем только когда фокус ушёл из него целиком. */
    if (!more.contains(e.relatedTarget)) state(false);
  });

  /* Escape возвращает фокус на кнопку: иначе клавиатурный читатель окажется
     на закрытом списке и не поймёт, где он. */
  more.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" && e.keyCode !== 27) return;
    state(false);
    btn.focus();
    btn.blur();
  });
})();


/* ==========================================================================
   37. Карта мира в разделе «География»

   Полоса над списком регионов: 70 стран настоящими контурами, ещё три
   плашками, остальная суша силуэтом. Страна нажимается — не подсвечивается,
   а именно нажимается: у неё есть торец, она утапливается под пальцем и
   остаётся приподнятой, пока открыта её панель. Это тот же материал, что у
   карточек после секции 34, только силуэт не прямоугольный.

   Почему canvas, а не SVG: у SVG нет боковой стенки, а стопка элементов на
   каждую страну перерисовывала бы композиторный слой каждый кадр. Стенка
   здесь — это один и тот же контур, залитый со смещением вниз на 1, 2, … h
   пикселей. Для вогнутых стран вроде Норвегии, Хорватии и Чили это точный
   результат, а не приближение тенью.

   Почему не 3D-наклон: наклон уводит вдаль Европу, где лежат 48 рынков из 73,
   и ломает попадание курсором в Safari. Объём здесь ортографический — ровно
   тот, которым сделан весь остальной сайт.

   ЧЕГО В ПАНЕЛИ НЕТ И НЕ БУДЕТ. Придуманного оффера, придуманной выплаты,
   придуманной связки «страна → вертикаль» и слова «здесь» там, где кейс эту
   страну не называет. Семь кейсов раскладываются по странам с той точностью,
   какую выдерживают они сами: цифры печатаются только там, где кейс назвал
   страну своим текстом (Малайзия у FISHING TIME, Германия, Австрия и
   Швейцария у HARBOR через DACH). На остальных — кодовое имя, вертикаль и
   собственная география кейса дословно, чтобы читатель сам видел, совпадает
   ли она с нажатой страной.

   Не выполнился — секция читается ровно как раньше: список регионов с кодами
   стран уже лежит в разметке и ни от чего не зависит.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var forced = root.classList.contains("force-motion");
  var reduced = !forced && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var strip = document.querySelector("[data-geo-strip]");
  if (!strip) return;
  var canvas = strip.querySelector("[data-geo-map]");
  var D = window.IVM_WORLD;
  if (!canvas || !D || !D.c || !D.p || !D.f) return;

  var ctx = null;
  try { ctx = canvas.getContext("2d"); } catch (e) { return; }
  if (!ctx || !window.Path2D) return;

  var section = strip.closest(".geo") || document;

  /* ------------------------------------------------- договор с разметкой */
  /* Те же проверки, что у глобуса, плюс две про карту. Не сошлось — секция
     остаётся прежней и в консоль уходит причина. Прибор, который врёт, хуже
     отсутствующего прибора. */

  function readContract() {
    var cards = Array.prototype.slice.call(section.querySelectorAll("[data-geo-region]"));
    if (!cards.length) return { error: "нет карточек регионов" };

    var regions = [], byCode = {}, order = [];
    for (var i = 0; i < cards.length; i++) {
      var nEl = cards[i].querySelector(".geo-region__n");
      var nameEl = cards[i].querySelector(".geo-region__name");
      var codeEls = Array.prototype.slice.call(cards[i].querySelectorAll(".geo-code"));
      var n = nEl ? parseInt(nEl.textContent, 10) : NaN;
      if (!(n > 0) || n !== codeEls.length) {
        return { error: "карточка " + (i + 1) + ": напечатано " + n + ", кодов " + codeEls.length };
      }
      var core = cards[i].classList.contains("geo-region--core");
      var codes = codeEls.map(function (el) { return el.textContent.trim(); });
      regions.push({
        i: i, card: cards[i], core: core, codes: codes,
        name: nameEl ? nameEl.textContent.trim() : "",
        n: n, els: codeEls,
      });
      codes.forEach(function (cc, k) {
        byCode[cc] = { region: i, core: core, el: codeEls[k], name: codeEls[k].getAttribute("title") || cc };
        order.push(cc);
      });
    }

    if (!D.p || Object.keys(D.p).length !== order.length) {
      return { error: "точек в данных " + Object.keys(D.p || {}).length + ", кодов в разметке " + order.length };
    }
    for (var k2 = 0; k2 < order.length; k2++) {
      if (!D.p[order[k2]]) return { error: "в данных нет рынка " + order[k2] };
    }

    /* Кейсы. Регион кейса обязан дословно совпасть с напечатанным названием
       региона ЭТОЙ локали — иначе ошибочная атрибуция доедет до экрана. */
    var chips = Array.prototype.slice.call(section.querySelectorAll(".geo-case"));
    var cases = [];
    for (var c = 0; c < chips.length; c++) {
      var el = chips[c];
      var names = (el.getAttribute("data-regions") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      var idx = [];
      for (var m = 0; m < names.length; m++) {
        var found = -1;
        for (var r = 0; r < regions.length; r++) if (regions[r].name === names[m]) { found = r; break; }
        if (found < 0) return { error: "кейс " + el.getAttribute("data-code") + ": регион «" + names[m] + "» не совпал ни с одной карточкой" };
        idx.push(found);
      }
      cases.push({
        el: el,
        code: el.getAttribute("data-code") || "",
        tag: el.getAttribute("data-tag") || "",
        period: el.getAttribute("data-period") || "",
        href: el.getAttribute("href") || "",
        note: el.getAttribute("data-note") || "",
        summary: el.getAttribute("data-summary") || "",
        figs: (el.getAttribute("data-figs") || "").split("|").filter(Boolean),
        cc: (el.getAttribute("data-cc") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        regions: idx,
        names: names,
      });
    }

    return { regions: regions, byCode: byCode, order: order, cases: cases };
  }

  var C = readContract();
  if (C.error) {
    if (window.console && console.warn) console.warn("[ivm] карта: " + C.error);
    return;
  }

  /* С этой секунды известно, что карта будет. До неё полосы нет вовсе —
     display: none в CSS, — и это не косметика: без is-live на странице
     оставалась невидимая коробка в пятьсот пикселей высотой, а в ней две
     кнопки кадра, до которых доходила табуляция. Пустое место, по которому
     нельзя ни кликнуть, ни понять, что это, — хуже отсутствующего места. */
  strip.classList.add("is-live");

  /* ------------------------------------------------------------ геометрия */

  var paths = {};
  for (var cc in D.c) if (D.c.hasOwnProperty(cc)) paths[cc] = new Path2D(D.c[cc]);
  var restPath = D.rest ? new Path2D(D.rest) : null;

  /* Мелкие страны рисуются плашкой: их контур меньше пальца, и «нажми на
     страну» без этого не выполняется для каждой шестой. */
  var SMALL = 9;
  var isSmall = function (cc) { return !paths[cc] || (D.p[cc] && D.p[cc][2] < SMALL); };

  /* Порядок отрисовки: крупные снизу, мелкие сверху — иначе Люксембург
     утонет во Франции и в него не попасть. */
  var drawOrder = C.order.slice().sort(function (a, b) {
    return (D.p[b] ? D.p[b][2] : 0) - (D.p[a] ? D.p[a][2] : 0);
  });
  var hitOrder = drawOrder.slice().reverse();

  /* -------------------------------------------------------------- палитра */

  /* Настройки отрисовки полосы.

     Обликов было три — владелец выбрал этот 2026-09-12, остальные два и
     переключатель `?map=` убраны. Прежний плоский вид и промежуточный вариант
     без цвета лежат в истории: коммит 77df8bb, «Two looks for the map».

       ocean    — заливка океана по настоящему краю мира
       vignette — затемнение к краям полосы, в экранных координатах
       grat     — прозрачность сетки меридианов
       coast    — прозрачность береговой линии у суши вне 73 рынков
       dot      — радиус точки рынка в экранных пикселях
       glow     — свечение под основными рынками
       rest     — заливка суши вне 73 рынков
       side     — торец плиты
       st       — высота плиты и сдвиг верхней грани по состояниям, в
                  экранных пикселях: торец не должен расти вместе с кадром */
  var S = {
    ocean: "#0a0e1c",
    vignette: 0.55,
    grat: 0.075,
    coast: 0.16,
    dot: 1.8,
    glow: 20,
    rest: "rgba(242,240,236,0.055)",
    side: "#0a0e1c",
    st: { rest: [5, 0], hover: [12, -4], down: [2, 3], sel: [9, -3] },
  };
  var ST = S.st;
  var SEL = "#b57bff";

  /* Двенадцать оттенков по числу регионов — в семье сайта, те же приглушённые
     тона, что у вертикалей в CSS, а не радуга.

     Цветом кодируется РЕГИОН, потому что регион у страны настоящий: он
     напечатан на карточке рядом. Вертикалью красить нельзя — связки «страна →
     вертикаль» в проекте не существует, и раскрасить по ней значило бы
     нарисовать то, чего никто не измерял. Различие «ядро / расширенное
     покрытие» цвет при этом не отменяет: оно держится на прозрачности, и
     история секции остаётся читаемой. */
  var HUES = [
    [181, 123, 255], [ 87, 180, 234], [ 85, 207, 162], [156, 205, 107],
    [212, 171,  92], [224, 144,  95], [221, 127, 174], [165, 131, 242],
    [111, 127, 224], [ 95, 199, 194], [195, 176, 106], [207, 127, 143],
  ];
  function tint(cc, a) {
    var h = HUES[C.byCode[cc].region % HUES.length];
    return "rgba(" + h[0] + "," + h[1] + "," + h[2] + "," + a + ")";
  }
  function topOf(cc, core) { return tint(cc, core ? 0.32 : 0.11); }
  function ringOf(cc, core) { return tint(cc, core ? 0.72 : 0.26); }

  var edgePath = D.edge ? new Path2D(D.edge) : null;
  var gratPath = D.grat ? new Path2D(D.grat) : null;

  /* ----------------------------------------------------------------- кадр */

  var view = { box: D.f.core.slice(), k: 1, ox: 0, oy: 0 };
  var target = null, anim = null;
  var W = 0, H = 0, dpr = 1;

  function fit(box) {
    var bw = box[2] - box[0], bh = box[3] - box[1];
    var k = Math.min(W / dpr / bw, H / dpr / bh);
    return { k: k, ox: (W / dpr - bw * k) / 2 - box[0] * k, oy: (H / dpr - bh * k) / 2 - box[1] * k };
  }
  function applyView() {
    var f = fit(view.box);
    view.k = f.k; view.ox = f.ox; view.oy = f.oy;
  }
  function setTransform() {
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.ox, dpr * view.oy);
  }

  function goTo(box, instant) {
    var to = box.slice();
    if (instant || reduced) { view.box = to; applyView(); bake(); paint(); return; }
    var from = view.box.slice(), t0 = 0;
    if (anim) window.cancelAnimationFrame(anim);
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / 320, 1);
      var e = 1 - Math.pow(1 - p, 3);
      for (var i = 0; i < 4; i++) view.box[i] = from[i] + (to[i] - from[i]) * e;
      applyView(); bake(); paint();
      if (p < 1) anim = window.requestAnimationFrame(step); else anim = null;
    }
    anim = window.requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------ отрисовка */

  var baked = null;

  /* Плита: один и тот же контур, залитый со смещением вниз на 1..h пикселей,
     сверху верхняя грань. Смещение считается в экранных пикселях, поэтому
     делится на масштаб — иначе торец растёт вместе с приближением. */
  function slab(path, h, dy, top, ring, lw, glow) {
    var s = 1 / view.k;
    ctx.fillStyle = S.side;
    for (var i = h; i >= 1; i--) {
      ctx.save();
      ctx.translate(0, (i + dy) * s);
      ctx.fill(path);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, dy * s);
    /* Свечение кладётся тенью самой верхней грани: оно обязано повторять
       контур страны, а не быть кругом вокруг её центра. */
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = S.glow; }
    ctx.fillStyle = top;
    ctx.fill(path);
    ctx.shadowBlur = 0;
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = (lw || 1) * s; ctx.stroke(path); }
    ctx.restore();
  }

  function plaque(cc, h, dy, top, ring, lw, glow) {
    var p = D.p[cc];
    var s = 1 / view.k, side = 9 * s;
    var x = p[0] - side / 2, y = p[1] - side / 2;
    ctx.fillStyle = S.side;
    for (var i = h; i >= 1; i--) ctx.fillRect(x, y + (i + dy) * s, side, side);
    ctx.save();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = S.glow; }
    ctx.fillStyle = top;
    ctx.fillRect(x, y + dy * s, side, side);
    ctx.restore();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = (lw || 1) * s; ctx.strokeRect(x, y + dy * s, side, side); }
  }

  function drawCountry(cc, state, dim, stMix) {
    var info = C.byCode[cc];
    /* stMix — пара [высота, подъём] на полпути между покоем и наведением.
       Наведение не меняет цвет: topOf и ringOf от состояния не зависят,
       весь эффект — в высоте слоя и подъёме. Поэтому плавность делается
       интерполяцией геометрии, а не прозрачностью: страна поднимается,
       а не проявляется сквозь себя. */
    var st = stMix || ST[state] || ST.rest;
    var top = topOf(cc, info.core);
    var ring = ringOf(cc, info.core);
    var glow = (info.core && !dim) ? tint(cc, 0.75) : null;
    if (state === "sel") { ring = SEL; }
    if (dim) { top = "rgba(242,240,236,0.035)"; ring = "rgba(242,240,236,0.06)"; }
    if (isSmall(cc)) plaque(cc, st[0], st[1], top, ring, state === "sel" ? 1.5 : 1, glow);
    else slab(paths[cc], st[0], st[1], top, ring, state === "sel" ? 1.5 : 1, glow);
  }

  /* Покоящийся кадр печётся один раз на смену кадра и на resize; живыми
     каждый кадр остаются только выбранная и наведённая страна. */
  function bake() {
    if (!W || !H) return;
    if (!baked) baked = document.createElement("canvas");
    if (baked.width !== W || baked.height !== H) { baked.width = W; baked.height = H; }
    var b = baked.getContext("2d");
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, W, H);
    var real = ctx;
    ctx = b;
    setTransform();

    /* Океан заливает ВЕСЬ холст, а не контур мира.

       Заливка по контуру оставляла за ним пустоту цвета страницы, и стоило
       карту потянуть — в полосе появлялся обрыв: выгнутый край мира, а за ним
       чёрное поле. Карта не имеет права кончаться посреди собственной рамки.

       Край мира при этом никуда не делся, он просто перестал быть границей
       заливки: его по-прежнему видно там, где заканчивается сетка меридианов.
       В Equal Earth это не прямоугольник, а бочка — параллели прямые, крайние
       меридианы выгнуты, — и сетка, обрезанная по ней, читается как мягкое
       затухание, а не как стенка. */
    if (S.ocean) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = S.ocean;
      ctx.fillRect(0, 0, W, H);
      setTransform();
      if (S.grat && gratPath && edgePath) {
        ctx.save();
        ctx.clip(edgePath);
        ctx.strokeStyle = "rgba(242,240,236," + S.grat + ")";
        ctx.lineWidth = 1 / view.k;
        ctx.stroke(gratPath);
        ctx.restore();
      }
    }

    if (restPath) {
      ctx.fillStyle = S.rest;
      ctx.fill(restPath);
      /* Береговая линия у суши вне 73: без неё континенты остаются пятнами,
         и глазу не за что зацепиться. */
      if (S.coast) {
        ctx.strokeStyle = "rgba(242,240,236," + S.coast + ")";
        ctx.lineWidth = 1 / view.k;
        ctx.stroke(restPath);
      }
    }
    for (var i = 0; i < drawOrder.length; i++) {
      var cc = drawOrder[i];
      if (cc === hot || cc === picked) continue;
      drawCountry(cc, "rest", dimmed && dimmed.indexOf(cc) < 0);
    }

    /* Затемнение к краям — в экранных координатах и поверх всей суши: оно
       принадлежит полосе, а не карте, и ездить вместе с кадром не должно. */
    if (S.vignette) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var g = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.18, W / 2, H * 0.5, Math.max(W, H) * 0.7);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.6, "rgba(0,0,0," + (S.vignette * 0.28).toFixed(3) + ")");
      g.addColorStop(1, "rgba(0,0,0," + S.vignette + ")");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    ctx = real;
  }

  /* Точки рынков живут в живом слое, а не в испечённом: они дышат, и печь ради
     этого все 73 страны каждый кадр было бы расточительно. */
  var pulseT = 0;
  function dots() {
    var s = 1 / view.k;
    var breathe = reduced ? 1 : 0.5 + 0.5 * Math.sin(pulseT / 1400);
    for (var i = 0; i < C.order.length; i++) {
      var cc = C.order[i], p = D.p[cc];
      if (!p) continue;
      var core = C.byCode[cc].core;
      var faded = dimmed && dimmed.indexOf(cc) < 0;
      var r = S.dot * (core ? 0.85 + 0.15 * breathe : 0.78) * s;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      if (faded) ctx.fillStyle = "rgba(242,240,236,0.10)";
      else if (core) ctx.fillStyle = tint(cc, 0.55 + 0.35 * breathe);
      else ctx.fillStyle = "rgba(242,240,236,0.34)";
      ctx.fill();
    }
  }

  function paint() {
    if (!W || !H) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (baked) ctx.drawImage(baked, 0, 0);
    setTransform();
    if (picked && picked !== hot) drawCountry(picked, "sel", false);

    var t = hotT();
    /* Уходящая страна ЕСТЬ в запечённом кадре — bake() пропускает только
       нынешнюю hot. Поэтому её можно просто дорисовать поверх на спуске.
       Нынешней в запечённом НЕТ, и на t=0 она обязана выглядеть ровно как
       в покое, иначе на первом кадре мигнёт пустотой. */
    if (hotPrev && hotPrev !== hot && hotPrev !== picked && t < 1 && C.byCode[hotPrev]) {
      drawCountry(hotPrev, "hover", false, mixST(ST.hover, ST.rest, t));
    }
    if (hot) {
      var to = down ? "down" : "hover";
      drawCountry(hot, to, false, t < 1 ? mixST(ST.rest, ST[to], t) : null);
    }
    dots();

    /* Петля кадров у карты живёт ради дыхания точек и идёт только пока
       секция на экране. Если её нет, а переход не доигран — доводим сами. */
    if (t < 1 && !pulseRaf && !reduced) window.requestAnimationFrame(paint);
  }

  /* -------------------------------------------------------------- попадание */

  var hot = null, picked = null, down = false, dimmed = null;

  /* Подъём страны под курсором занимает время, а не случается мгновенно.
     hotPrev опускается обратно, пока hot поднимается. При reduced переход
     не проигрывается вовсе: петля кадров у карты при нём не запускается,
     и «почти неподвижно» было бы хуже неподвижного. */
  var HOT_MS = 170;
  var hotPrev = null, hotSince = -1e9;
  var nowMs = (window.performance && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  function setHot(cc) {
    if (cc === hot) return;
    hotPrev = hot;
    hotSince = nowMs();
    hot = cc;
  }

  function hotT() {
    if (reduced) return 1;
    var t = (nowMs() - hotSince) / HOT_MS;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 - Math.pow(1 - t, 3);
  }

  function mixST(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

  function at(ev) {
    var r = canvas.getBoundingClientRect();
    var x = (ev.clientX - r.left - view.ox) / view.k;
    var y = (ev.clientY - r.top - view.oy) / view.k;
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var R = (coarse ? 22 : 11) / view.k;

    /* Сначала контур, и только потом диск вокруг мелких.

       Обратный порядок стоил середины больших стран. Диск под пальцем — 22
       пикселя, и он проверялся первым: тап в центр Франции возвращал
       Люксембург, тап в центр Германии — Нидерланды или Данию. Отдать соседу
       середину страны хуже, чем промахнуться мимо мелкой: в мелкую всё равно
       попадёт диск, просто ходом позже, а большую иначе не выбрать вовсе.

       Порядок контуров — от мелких к крупным, поэтому страна, чей контур
       поймал палец, выигрывает у соседки, даже если та больше. */
    var i, cc, p;
    setTransform();
    var cx = ev.clientX - r.left, cy = ev.clientY - r.top;
    for (i = 0; i < hitOrder.length; i++) {
      cc = hitOrder[i];
      if (!paths[cc]) continue;
      if (ctx.isPointInPath(paths[cc], cx * dpr, cy * dpr)) return cc;
    }
    for (i = 0; i < C.order.length; i++) {
      cc = C.order[i]; p = D.p[cc];
      if (!isSmall(cc) || !p) continue;
      if (Math.hypot(p[0] - x, p[1] - y) <= R) return cc;
    }
    /* Ничья — ближайший центр в пределах диска. */
    var best = null, bd = R;
    for (i = 0; i < C.order.length; i++) {
      cc = C.order[i]; p = D.p[cc];
      if (!p) continue;
      var d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = cc; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- панель */

  var panel = document.createElement("div");
  panel.className = "geo-panel";
  panel.setAttribute("aria-live", "polite");
  strip.appendChild(panel);

  /* Подписи панели приходят из разметки: генератор кладёт их в data-t-* той
     локали, из чьих файлов они и подняты. Значения справа — не «перевод по
     умолчанию», а русский оригинал: без атрибута страница остаётся рабочей,
     но говорит по-русски, и это видно с первого взгляда.

     region — формат с %s, а не голая подпись: кавычки вокруг названия региона
     в пяти языках разные, и выбирать их обязан переводчик, а не склейка строк
     в коде. */
  var T = {
    core: strip.getAttribute("data-t-core") || "Основной рынок",
    ext: strip.getAttribute("data-t-ext") || "Расширенное покрытие",
    named: strip.getAttribute("data-t-named") || "Рынок кейса",
    regionFmt: strip.getAttribute("data-t-region") || "Регион кейса: «%s»",
    none: strip.getAttribute("data-t-none") || "Опубликованных кейсов по этому региону нет",
    markets: strip.getAttribute("data-t-markets") || "рынок|рынка|рынков",
    plural: strip.getAttribute("data-t-plural") || "ru",
    close: strip.getAttribute("data-t-close") || "Закрыть",
  };

  /* Счёт рынков в кнопке региона. Формы приходят через «|»: английскому и
     испанскому хватает пары, славянским нужна третья.

     Правило у чешского не то же, что у русского: 22 по-русски «рынка», а
     по-чешски «trhů» — вторая форма там держится только за числами 2, 3 и 4
     ровно. Сейчас в карточках стоят числа от 2 до 10, на которых оба правила
     совпадают, но записаны они целиком: тот, кто однажды переразобьёт регионы,
     не обязан об этом помнить.

     Прежде здесь стояла одна форма на все двенадцать карточек, и «3 рынков»
     печаталось там, где по-русски «3 рынка». */
  function marketsFor(n) {
    var f = T.markets.split("|");
    if (f.length === 1) return f[0];
    if (f.length === 2) return n === 1 ? f[0] : f[1];
    if (T.plural === "cs") return n === 1 ? f[0] : (n >= 2 && n <= 4 ? f[1] : f[2]);
    var d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return f[0];
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return f[1];
    return f[2];
  }

  /* Подводка цитируется из разметки, но её левая половина — это заголовок
     строки («Основные рынки — …»), уже напечатанный в панели выше.
     Разделитель ищется только в начале строки: в испанском это двоеточие, в
     остальных четырёх — тире. Дефис разделителем не считается, иначе
     «full-stack delivery» в английской подводке режется пополам. */
  function noteText(core) {
    var notes = section.querySelectorAll(".geo__note");
    var el = notes[core ? 0 : 1];
    if (!el) return "";
    var t = el.textContent.replace(/\s+/g, " ").trim();
    var cut = t.slice(0, 40).search(/[—–:]\s/);
    return cut > 0 ? t.slice(cut + 1).trim() : t;
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  function render(cc) {
    if (!cc) { panel.classList.remove("is-on"); panel.innerHTML = ""; return; }
    var info = C.byCode[cc];
    var reg = C.regions[info.region];

    var html = '<button class="geo-panel__close" type="button" aria-label="' + esc(T.close) + '">&times;</button>';
    html += '<p class="geo-panel__name">' + esc(info.name) + ' <span class="mono">' + esc(cc) + '</span></p>';
    html += '<p class="geo-panel__status' + (info.core ? " is-core" : "") + '">' + esc(info.core ? T.core : T.ext) + '</p>';
    html += '<p class="geo-panel__note">' + esc(noteText(info.core)) + '</p>';
    html += '<p class="geo-panel__region"><button type="button" data-region="' + reg.i + '">' +
      esc(reg.name) + ' · ' + reg.n + ' ' + esc(marketsFor(reg.n)) + '</button></p>';

    var mine = C.cases.filter(function (k) { return k.regions.indexOf(info.region) >= 0; });
    if (mine.length) {
      html += '<ul class="geo-panel__cases">';
      mine.forEach(function (k) {
        var named = k.cc.indexOf(cc) >= 0;
        html += '<li class="geo-case-row' + (named ? " is-named" : "") + '">';
        html += '<span class="geo-case-row__kind mono">' + esc(named ? T.named : T.regionFmt.replace("%s", k.names.join(", "))) + '</span>';
        html += '<a class="geo-case-row__code" href="' + esc(k.href) + '"><span class="mono">' + esc(k.code) + '</span> · ' + esc(k.tag) + '</a>';
        if (k.period) html += '<span class="geo-case-row__period mono">' + esc(k.period) + '</span>';
        /* Цифры только там, где кейс назвал эту страну сам. Перенести
           измеренную величину на страну, где её не измеряли, — это и есть
           выдуманное свидетельство. */
        if (named && k.figs.length) {
          html += '<span class="geo-case-row__figs">' + k.figs.map(function (f) { return '<b>' + esc(f) + '</b>'; }).join("") + '</span>';
        }
        if (k.note) html += '<span class="geo-case-row__note">' + esc(k.note) + '</span>';
        html += '</li>';
      });
      html += '</ul>';
    } else {
      html += '<p class="geo-panel__empty">' + esc(T.none) + '</p>';
    }

    panel.innerHTML = html;
    panel.classList.add("is-on");
  }

  /* ------------------------------------------------------------- поведение */

  function pick(cc) {
    picked = cc;
    dimmed = null;
    framed = null;
    /* Выбор страны доводит кадр до её региона — вид снова известен. */
    if (cc) panned = false;
    /* Остановка табуляции переезжает к выбранной стране: выбрали мышью на
       карте — Tab приводит туда же, а не в начало списка. */
    if (flat && cc) {
      for (var ri = 0; ri < flat.length; ri++) if (flat[ri].cc === cc) { setRove(ri, false); break; }
    }
    bake(); paint(); render(cc);
    C.order.forEach(function (c2) { if (C.byCode[c2].el) C.byCode[c2].el.classList.toggle("is-picked", c2 === cc); });
  }

  function size() {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    W = w; H = h;
    applyView();
    return true;
  }

  function redraw() { if (size()) { bake(); paint(); } }

  /* ------------------------------------------------------ рука на карте */

  /* Карту берут рукой и листают — тот же жест, что у глобуса выше по файлу, и
     та же причина: предмет, который выглядит как картой, обязан вести себя как
     карта. До этого кадр можно было только переключить кнопкой, и человек,
     потянувший мышью, не получал ничего.

     Захват указателя (setPointerCapture) — чтобы рука не срывалась, когда
     курсор уходит за край полосы. */
  var pan = null;
  var panned = false;

  /* Порог, отделяющий протяжку от нажатия, выбирается по указателю, а не один
     на всех — ровно как радиус попадания в at().

     У мыши это 4 пикселя: меньше нельзя, между прижатием и отпусканием почти
     всегда есть дрожание в один-два, и каждый клик засчитывался бы протяжкой.

     У пальца промах больше. Система считает касание нажатием в пределах
     примерно десяти пикселей, и порог в 4 съедал обычные тапы: человек
     целился в страну, слегка вёл пальцем — и вместо панели получал сдвиг
     карты. Это ровно та поломка, которую тут уже чинили однажды, только с
     другой стороны. */
  function slopFor(type) { return type === "mouse" ? 4 : 11; }

  /* За край мира не выпускаем вовсе.

     Раньше давалась треть кадра запаса — и этого хватало, чтобы утащить карту
     к стенке и смотреть на пустое поле. Показывать там нечего.

     Считать надо не по кадру, а по тому, что РЕАЛЬНО видно: fit() вписывает
     кадр в холст по меньшей стороне, и по другой оси видно больше, чем в
     кадре. Ограничение по кадру пропустило бы край мира в эту разницу.
     Если видно больше мира — центрируем на нём, деваться некуда. */
  function clamp(box) {
    var bw = box[2] - box[0], bh = box[3] - box[1];
    var cw = W / dpr, ch = H / dpr;
    if (!cw || !ch || !bw || !bh) return box;
    var k = Math.min(cw / bw, ch / bh);
    var vw = cw / k, vh = ch / k;
    var cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    cx = vw >= D.w ? D.w / 2 : Math.min(Math.max(cx, vw / 2), D.w - vw / 2);
    cy = vh >= D.h ? D.h / 2 : Math.min(Math.max(cy, vh / 2), D.h - vh / 2);
    return [cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2];
  }

  /* Потянули — значит кадр больше не тот, что на кнопке. Оставить кнопку
     нажатой значило бы соврать о том, что сейчас на экране. */
  function unframe() {
    panned = true;
    framed = null;
    Array.prototype.forEach.call(strip.querySelectorAll("[data-frame]"), function (o) {
      o.classList.remove("is-on");
      o.setAttribute("aria-pressed", "false");
    });
  }

  function endPan() {
    if (!pan) return false;
    var moved = pan.moved;
    if (pan.id !== undefined && canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(pan.id); } catch (err) {}
    }
    pan = null;
    if (moved) canvas.style.cursor = "grab";
    return moved;
  }

  /* ---------------------------------------------------------- приближение */

  /* В кадре «Весь мир» листать нечего: соотношение мира — 2,32, соотношение
     полосы — 2,319, мир заполняет её ровно, и любая протяжка упирается в
     ограничитель. Карта без приближения там просто картинка.

     Колесо для этого не годится: страница листается сквозь карту, это записано
     в CSS и менять нельзя — отнять у человека прокрутку ради приближения
     значит сломать чтение страницы ради украшения карты. Поэтому приближают
     два жеста, которые ничего не отнимают: кнопки и двойное нажатие. */
  var MAXZ = 12;

  function zoomAt(mul, sx, sy) {
    var bw = view.box[2] - view.box[0], bh = view.box[3] - view.box[1];
    var wide = D.f.world[2] - D.f.world[0];
    /* Дальше мира не отдаляем — за ним нечего показывать; ближе
       двенадцатикратного не приближаем — контуры взяты из карты масштаба
       1:110 000 000, и увеличивать дальше значит показывать не страну, а
       ошибку упрощения. */
    var nw = Math.min(Math.max(bw / mul, wide / MAXZ), wide);
    var s = nw / bw;
    if (Math.abs(s - 1) < 0.001) return;
    var nh = bh * s;

    /* Точка под курсором остаётся под курсором: приближение идёт к тому, на
       что человек смотрит, а не к середине полосы. */
    var r = canvas.getBoundingClientRect();
    var px = (sx - r.left - view.ox) / view.k;
    var py = (sy - r.top - view.oy) / view.k;
    var fx = bw ? (px - view.box[0]) / bw : 0.5;
    var fy = bh ? (py - view.box[1]) / bh : 0.5;
    var x0 = px - fx * nw, y0 = py - fy * nh;

    unframe();
    goTo(clamp([x0, y0, x0 + nw, y0 + nh]));
  }

  function zoomCentre(mul) {
    var r = canvas.getBoundingClientRect();
    zoomAt(mul, r.left + r.width / 2, r.top + r.height / 2);
  }

  canvas.addEventListener("dblclick", function (e) {
    e.preventDefault();
    zoomAt(e.altKey ? 1 / 1.9 : 1.9, e.clientX, e.clientY);
  });

  /* Двойной тап — то же самое для пальца: dblclick до карты не доходит, его
     съедает то, что палец между нажатиями успевает сдвинуться. */
  var lastTap = 0, lastTapX = 0, lastTapY = 0;
  function maybeDoubleTap(e) {
    if (e.pointerType === "mouse") return false;
    var now = Date.now();
    var near = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 40;
    var quick = now - lastTap < 320;
    lastTap = now; lastTapX = e.clientX; lastTapY = e.clientY;
    if (quick && near) { lastTap = 0; zoomAt(1.9, e.clientX, e.clientY); return true; }
    return false;
  }

  Array.prototype.forEach.call(strip.querySelectorAll("[data-zoom]"), function (b) {
    b.addEventListener("click", function () {
      zoomCentre(b.getAttribute("data-zoom") === "in" ? 1.9 : 1 / 1.9);
    });
  });


  canvas.addEventListener("pointermove", function (e) {
    if (pan) {
      /* Чужой указатель во время нашего жеста игнорируется целиком: второй
         палец (а пинч здесь разрешён намеренно) раньше переписывал точку
         отсчёта, и карта прыгала на всё расстояние между пальцами. */
      if (e.pointerId !== pan.id) return;
      /* Кнопку отпустили за окном — событие up до нас не дошло. Без этой
         проверки карта осталась бы приклеена к пустому курсору навсегда. */
      if (e.pointerType === "mouse" && !e.buttons) { endPan(); setHot(null); bake(); paint(); return; }

      var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved) {
        if (Math.hypot(dx, dy) <= pan.slop) return;
        /* На пальце вертикаль принадлежит странице — её забирает браузер по
           touch-action. Карта берёт себе только те жесты, что идут вбок;
           иначе прокрутка страницы, начатая на карте, сдвигала бы и карту. */
        if (pan.coarse && Math.abs(dx) <= Math.abs(dy)) return;
        pan.moved = true;
        down = false;
        setHot(null);
        canvas.style.cursor = "grabbing";
        unframe();
      }
      var k = pan.k;
      view.box = clamp([
        pan.box[0] - dx / k, pan.box[1] - dy / k,
        pan.box[2] - dx / k, pan.box[3] - dy / k,
      ]);
      applyView(); bake(); paint();
      return;
    }
    var cc = at(e);
    if (cc === hot) return;
    setHot(cc);
    canvas.style.cursor = cc ? "pointer" : "grab";
    bake(); paint();
  });

  canvas.addEventListener("pointerleave", function () {
    if (pan) return;
    setHot(null); down = false; bake(); paint();
  });

  /* Попадание считается на прижатии, а не берётся от предыдущего движения.
     У пальца движения нет: касание присылает pointerover, pointerenter,
     pointerdown, pointerup — и ни одного pointermove между ними. Пока hot
     заполнялся только в pointermove, на телефоне он оставался null, down не
     выставлялся, и pointerup не находил, что выбрать: карта на весь мобильный
     экран была картинкой. Мышь это скрывала, потому что всегда двигается
     прежде, чем нажать. */
  canvas.addEventListener("pointerdown", function (e) {
    /* Правая и средняя кнопки мыши карту не тянут: у них своё дело. */
    if (e.pointerType === "mouse" && e.button !== 0) return;
    /* Жест принадлежит одному указателю от начала до конца. */
    if (pan) return;
    /* Летящий кадр дальше не летит: иначе goTo продолжит менять view.box под
       рукой, и первая же протяжка отбросит карту назад, к моменту нажатия. */
    if (anim) { window.cancelAnimationFrame(anim); anim = null; }

    pan = {
      id: e.pointerId,
      x: e.clientX, y: e.clientY,
      box: view.box.slice(), k: view.k,
      moved: false,
      slop: slopFor(e.pointerType),
      coarse: e.pointerType !== "mouse",
    };
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    setHot(at(e));
    if (hot) { down = true; paint(); }
  });

  canvas.addEventListener("pointerup", function (e) {
    if (pan && e.pointerId !== pan.id) return;
    /* Двойной тап перехватывается раньше выбора страны: иначе второй тап
       открыл бы панель и тут же приблизил под ней. */
    if (pan && !pan.moved && maybeDoubleTap(e)) { endPan(); down = false; return; }
    /* Протянули — выбора не было: рука листала, а не указывала. */
    /* Выбирается то, во что целились при нажатии, а не то, над чем палец
       оказался при отрыве. Разница видна на телефоне: карта там мелкая, и
       восьми пикселей сползания хватает, чтобы отрыв пришёлся уже на соседнюю
       страну — человек метил в Германию, а открывалась Чехия. */
    if (!endPan() && down) { var cc = hot || at(e); if (cc) pick(cc); }
    down = false; paint();
  });

  /* Палец, поехавший вниз, забирает себе браузер на прокрутку страницы — он
     присылает pointercancel. Начатую протяжку в этом случае откатываем: жеста
     не было, и оставлять карту сдвинутой на полпути значило бы менять вид
     страницы в ответ на прокрутку. */
  canvas.addEventListener("pointercancel", function (e) {
    if (pan && e.pointerId !== pan.id) return;
    if (pan && pan.moved) {
      view.box = pan.box.slice();
      applyView();
    }
    endPan();
    down = false; setHot(null);
    bake(); paint();
  });

  /* Кнопки кадра. Какая из двух сейчас выбрана, до этого сообщалось только
     цветом рамки — то есть не сообщалось тому, кто слушает страницу. */
  Array.prototype.forEach.call(strip.querySelectorAll("[data-frame]"), function (b) {
    b.addEventListener("click", function () {
      /* Нажали кнопку кадра — вид снова тот, что она называет, и утянутым
         рукой он считаться перестаёт: наведение на карточки региона снова
         работает. Иначе одна протяжка глушила бы связку «список ↔ карта»
         навсегда, до перезагрузки страницы. */
      panned = false;
      framed = null;
      Array.prototype.forEach.call(strip.querySelectorAll("[data-frame]"), function (o) {
        var on = o === b;
        o.classList.toggle("is-on", on);
        o.setAttribute("aria-pressed", on ? "true" : "false");
      });
      goTo(D.f[b.getAttribute("data-frame")] || D.f.world);
    });
  });

  /* Наведение на карточку региона доводит кадр и гасит чужие рынки — тот же
     жест, что был у глобуса, чтобы связка «список ↔ предмет» не менялась. */
  var framed = null;
  function isTouch() { return !!(window.matchMedia && window.matchMedia("(hover: none)").matches); }

  C.regions.forEach(function (r) {
    r.card.addEventListener("pointerenter", function (e) {
      /* Палец не наводит, палец нажимает: для касания эта пара событий
         приходит на прижатии и на отрыве, и кадр успевал только мигнуть.

         Утянутый рукой вид наведение тоже не трогает — по той же причине, по
         какой его не трогает выбранная страна. Человек поставил карту так, как
         ему нужно; отобрать это, просто проведя мышью мимо списка, значит
         выбросить его работу без единого нажатия. */
      if (e.pointerType === "touch" || picked || panned) return;
      dimmed = r.codes;
      if (D.f["r" + r.i]) goTo(D.f["r" + r.i]);
      else { bake(); paint(); }
    });
    r.card.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch" || picked || panned) return;
      dimmed = null;
      goTo(D.f.core);
    });
    /* Тот же жест для телефона: тап по карточке доводит кадр и держит его,
       повторный тап возвращает кадр по умолчанию. */
    r.card.addEventListener("click", function (e) {
      if (!isTouch()) return;
      if (e.target.closest && e.target.closest(".geo-code, a, button")) return;
      panned = false;
      if (picked) pick(null);
      if (framed === r.i) { framed = null; dimmed = null; goTo(D.f.core); return; }
      framed = r.i;
      dimmed = r.codes;
      goTo(D.f["r" + r.i] || D.f.core);
    });
    r.els.forEach(function (el, k) {
      el.addEventListener("click", function () { pick(r.codes[k]); goTo(D.f["r" + r.i] || D.f.core); });
      el.style.cursor = "pointer";
    });
  });

  /* ------------------------------------------------------------ клавиатура */

  /* 73 кода — это 73 кнопки, и 73 остановки табуляции сделали бы список
     непроходимым: чтобы добраться отсюда до подвала, пришлось бы нажать Tab
     семьдесят два раза. Поэтому одна остановка на весь список, а внутри —
     стрелки: влево-вправо по соседям, вверх-вниз между регионами, Home и End
     на края. Так устроены панели инструментов, и это то, чего ждёт рука.

     Роль и tabindex ставит скрипт, а не разметка: пока карта не запустилась,
     код — это подпись с расшифровкой в title, и объявлять её кнопкой значило
     бы обещать нажатие, которого нет. Тот же уговор, что у размера цели под
     палец: он тоже висит на is-ready.

     Имя кнопки — «Германия, DE», а не просто «Германия»: видимая подпись
     обязана входить в доступное имя, иначе голосовое управление не найдёт
     кнопку по тому, что на ней написано. */
  var flat = [];
  C.regions.forEach(function (r) {
    r.els.forEach(function (el, k) { flat.push({ el: el, cc: r.codes[k], region: r.i }); });
  });

  var rove = 0;
  function setRove(i, focus) {
    if (i < 0 || i >= flat.length) return;
    flat[rove].el.setAttribute("tabindex", "-1");
    rove = i;
    flat[rove].el.setAttribute("tabindex", "0");
    if (focus) flat[rove].el.focus();
  }

  function firstOfRegion(ri) {
    for (var j = 0; j < flat.length; j++) if (flat[j].region === ri) return j;
    return -1;
  }

  flat.forEach(function (f, i) {
    f.el.setAttribute("role", "button");
    f.el.setAttribute("tabindex", i === 0 ? "0" : "-1");
    var name = f.el.getAttribute("title");
    if (name) f.el.setAttribute("aria-label", name + ", " + f.cc);

    /* Фокус мышью тоже двигает остановку: уйти и вернуться Tab должно туда же,
       где человек был в последний раз. */
    f.el.addEventListener("focus", function () { if (rove !== i) setRove(i, false); });

    f.el.addEventListener("keydown", function (e) {
      var k = e.key, n = -1;
      if (k === "ArrowRight") n = i + 1;
      else if (k === "ArrowLeft") n = i - 1;
      else if (k === "Home") n = 0;
      else if (k === "End") n = flat.length - 1;
      else if (k === "ArrowDown") n = firstOfRegion(f.region + 1);
      else if (k === "ArrowUp") n = firstOfRegion(f.region - 1);
      else if (k === "Enter" || k === " " || k === "Spacebar") {
        e.preventDefault();
        pick(f.cc);
        goTo(D.f["r" + f.region] || D.f.core);
        return;
      } else return;
      if (n >= 0 && n < flat.length) { e.preventDefault(); setRove(n, true); }
    });
  });

  /* Чип кейса подсвечивает свои регионы. Та же защита от касания, что у
     карточек региона: для пальца эта пара событий приходит на прижатии и на
     отрыве, и карта успевала мигнуть перед уходом по ссылке. */
  C.cases.forEach(function (k) {
    k.el.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "touch" || picked) return;
      dimmed = k.regions.reduce(function (acc, ri) { return acc.concat(C.regions[ri].codes); }, []);
      bake(); paint();
    });
    k.el.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch" || picked) return;
      dimmed = null; bake(); paint();
    });
  });

  panel.addEventListener("click", function (e) {
    var close = e.target.closest ? e.target.closest(".geo-panel__close") : null;
    if (close) { pick(null); goTo(D.f.core); return; }
    var rb = e.target.closest ? e.target.closest("[data-region]") : null;
    if (rb) goTo(D.f["r" + rb.getAttribute("data-region")] || D.f.core);
  });

  document.addEventListener("keydown", function (e) {
    if ((e.key === "Escape" || e.keyCode === 27) && picked) { pick(null); goTo(D.f.core); }
  });

  window.addEventListener("resize", redraw, { passive: true });

  /* Дыхание точек. Петля живёт только пока полоса на экране: крутить
     requestAnimationFrame, когда до карты ещё три экрана прокрутки, — это
     греть телефон впустую.

     При reduced петля не запускается вовсе. Человек, попросивший свой
     компьютер убрать движение, получает ту же карту неподвижной, а не
     «почти неподвижной». */
  var pulseRaf = null;
  function pulseStop() {
    if (pulseRaf) { window.cancelAnimationFrame(pulseRaf); pulseRaf = null; }
  }
  function pulseStart() {
    if (pulseRaf || reduced) return;
    pulseRaf = window.requestAnimationFrame(function step(ts) {
      pulseT = ts;
      paint();
      pulseRaf = window.requestAnimationFrame(step);
    });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { redraw(); pulseStart(); }
        else pulseStop();
      });
    }, { threshold: 0.02 }).observe(strip);
  } else {
    pulseStart();
  }

  /* Нулевая ширина — вёрстка ещё не села. Уйти без повтора это и есть способ
     показать пустое место. */
  (function start() {
    if (!size()) { window.requestAnimationFrame(start); return; }
    bake(); paint();
    strip.classList.add("is-ready");
  })();
})();
