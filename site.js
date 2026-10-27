/* Lock Me - общ скрипт за всички страници: тема, език, меню, бисквитки, проследяване на кликове */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var PHONE = '+359877558851';

  function q(s, c) { return (c || doc).querySelector(s); }
  function qa(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function sGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* блокирано хранилище */ } }
  var base = root.getAttribute('data-base') || '';

  /* ---------- Език (BG / EN) ---------- */
  var I = window.I18N || { bg: {}, en: {} };
  var lang = sGet('site-lang') === 'en' ? 'en' : 'bg';
  var titleEl = q('title');
  var titleBg = titleEl ? titleEl.textContent : '';

  function t(key) {
    return (I[lang] && I[lang][key]) || (I.bg && I.bg[key]) || key;
  }
  window.t = t;
  window.getLang = function () { return lang; };

  // Сменя само текстовия възел, за да не изтрие икони (svg) в същия елемент
  function setText(el, val) {
    if (!el.children.length) { el.textContent = val; return; }
    var done = false;
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        if (!done) { n.nodeValue = ' ' + val + ' '; done = true; } else { n.nodeValue = ''; }
      }
    });
  }

  function applyLang() {
    root.lang = lang;
    qa('[data-translate]').forEach(function (el) {
      var v = I[lang] && I[lang][el.getAttribute('data-translate')];
      if (v != null) setText(el, v);
    });
    qa('[data-translate-html]').forEach(function (el) {
      var v = I[lang] && I[lang][el.getAttribute('data-translate-html')];
      if (v != null) el.innerHTML = v;
    });
    qa('[data-translate-placeholder]').forEach(function (el) {
      var v = I[lang] && I[lang][el.getAttribute('data-translate-placeholder')];
      if (v != null) el.setAttribute('placeholder', v);
    });
    qa('[data-translate-aria]').forEach(function (el) {
      var v = I[lang] && I[lang][el.getAttribute('data-translate-aria')];
      if (v != null) el.setAttribute('aria-label', v);
    });
    if (titleEl) {
      var en = titleEl.getAttribute('data-en');
      titleEl.textContent = (lang === 'en' && en) ? en : titleBg;
    }
    var lb = q('#lang-btn');
    if (lb) lb.textContent = lang === 'bg' ? 'BG / EN' : 'EN / BG';
    doc.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  }

  function toggleLang() {
    lang = lang === 'bg' ? 'en' : 'bg';
    sSet('site-lang', lang);
    applyLang();
  }
  window.toggleLang = toggleLang;

  /* ---------- Тема ---------- */
  function toggleTheme() {
    var dark = root.classList.toggle('dark');
    sSet('color-theme', dark ? 'dark' : 'light');
    var m = q('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#09090b' : '#fafafa');
  }
  window.toggleTheme = toggleTheme;

  /* ---------- Съобщение (toast) ---------- */
  function toast(msg) {
    var el = q('#lm-toast');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'lm-toast';
      el.setAttribute('role', 'status');
      el.className = 'fixed left-1/2 -translate-x-1/2 bottom-28 lg:bottom-8 z-[70] bg-zinc-900 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-xl';
      doc.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }
  window.lmToast = toast;

  function copyPhone(e) {
    if (e) e.preventDefault();
    function ok() { toast(t('toast_copied')); }
    function fallback() {
      try {
        var ta = doc.createElement('textarea');
        ta.value = PHONE; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        doc.body.appendChild(ta); ta.select();
        var res = doc.execCommand('copy');
        doc.body.removeChild(ta);
        if (res) ok(); else toast(PHONE);
      } catch (err) { toast(PHONE); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(PHONE).then(ok, fallback);
    } else { fallback(); }
  }

  /* ---------- Мобилно меню ---------- */
  function initMenu() {
    var btn = q('#mobile-menu-btn'), menu = q('#mobile-menu');
    if (!btn || !menu) return;
    function setMenu(open) {
      menu.classList.toggle('hidden', !open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      var u = q('use', btn);
      if (u) u.setAttribute('href', open ? '#fa-solid-xmark' : '#fa-solid-bars');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(menu.classList.contains('hidden'));
    });
    doc.addEventListener('click', function (e) {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) setMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.classList.contains('hidden')) { setMenu(false); btn.focus(); }
    });
  }

  /* ---------- Бутон "Нагоре" ---------- */
  function initBackToTop() {
    var b = q('#backToTop');
    if (!b) return;
    function upd() {
      var show = (window.pageYOffset || root.scrollTop) > 300;
      b.classList.toggle('hidden', !show);
      b.classList.toggle('flex', show);
    }
    window.addEventListener('scroll', upd, { passive: true });
    b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    upd();
  }

  /* ---------- Съгласие за бисквитки (Google Consent Mode v2) ---------- */
  function consentUpdate(granted) {
    var v = granted ? 'granted' : 'denied';
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { ad_storage: v, analytics_storage: v, ad_user_data: v, ad_personalization: v });
    }
    sSet('lm-consent', v);
  }
  function hideBanner() { var b = q('#cookie-banner'); if (b && b.parentNode) b.parentNode.removeChild(b); }
  function showBanner() {
    if (q('#cookie-banner')) return;
    var b = doc.createElement('div');
    b.id = 'cookie-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Cookies');
    b.className = 'fixed left-3 right-3 bottom-24 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-md z-[60] bg-white dark:bg-zinc-900 border border-amber-500/50 rounded-2xl shadow-2xl p-4 text-sm text-zinc-700 dark:text-zinc-300';
    b.innerHTML =
      '<p><span data-translate="cookie_text"></span> <a href="' + base + 'privacy.html" class="underline text-amber-600 dark:text-amber-400 font-semibold" data-translate="cookie_link"></a></p>' +
      '<div class="grid grid-cols-2 gap-2 mt-3">' +
      '<button type="button" data-consent="denied" class="py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 font-bold text-xs hover:border-amber-500 transition" data-translate="cookie_deny"></button>' +
      '<button type="button" data-consent="granted" class="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition" data-translate="cookie_accept"></button>' +
      '</div>';
    doc.body.appendChild(b);
    applyLang();
  }
  function initConsent() {
    if (!sGet('lm-consent')) showBanner();
    doc.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('[data-consent]');
      if (c) { consentUpdate(c.getAttribute('data-consent') === 'granted'); hideBanner(); return; }
      var s = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (s) { e.preventDefault(); showBanner(); }
    });
  }

  /* ---------- Проследяване на кликове (за GTM) ---------- */
  function initTracking() {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href') || '', m = null;
      if (h.indexOf('tel:') === 0) m = 'phone';
      else if (h.indexOf('viber:') === 0) m = 'viber';
      else if (h.indexOf('wa.me') > -1) m = 'whatsapp';
      else if (h.indexOf('maps.app.goo.gl') > -1) m = 'maps';
      if (m) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'contact_click', contact_method: m, link_url: h, page_path: location.pathname });
      }
    });
  }

  function init() {
    var lb = q('#lang-btn'); if (lb) lb.addEventListener('click', toggleLang);
    var tb = q('#theme-btn'); if (tb) tb.addEventListener('click', toggleTheme);
    qa('[data-copy-phone]').forEach(function (b) { b.addEventListener('click', copyPhone); });
    initMenu();
    initBackToTop();
    initTracking();
    initConsent();
    applyLang();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
