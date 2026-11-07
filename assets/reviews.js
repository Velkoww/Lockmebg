/* Lock Me - ревюта (Google Sheets през SheetDB) със защити срещу злоупотреба */
(function () {
  'use strict';

  /* ===== НАСТРОЙКИ ===== */
  var SHEETDB_URL = 'https://sheetdb.io/api/v1/3pzi54zvfbmyc';
  var REVIEWS_FEED_URL = '';
  /* Google Apps Script към таблицата - ако е попълнен, се ползва вместо SheetDB */
  var APPS_SCRIPT_URL = '';
  var API_URL = APPS_SCRIPT_URL || SHEETDB_URL;

  /* Ръчно добавени ревюта - показват се винаги, дори ако таблицата не отговаря */
  var MANUAL_REVIEWS = [
    { name: 'Масимо Василев', rating: 5, date: '31.10.2026',
      text: 'Много съм доволен от услугите на екипа, ателието им е на леснодостъпно място точно до метростанция „Константин Величков“. Собственикът, който почти винаги е там, е много мил и усмихнат. Няколко пъти ми се е налагало да ползвам техни услуги и никога не съм оставал разочарован. Препоръчвам!' }
  ];

  var CACHE_KEY = 'lm-reviews-cache-v2';
  var CACHE_TTL = 10 * 60 * 1000;
  var LOG_KEY = 'lm-review-log';
  var MAX_NAME = 40, MAX_TEXT = 500, MIN_TEXT = 10;
  var COOLDOWN_MS = 5 * 60 * 1000;
  var MAX_PER_DAY = 3;
  var MIN_FILL_MS = 3000;
  var SHOW_LIMIT = 60;
  var HIDDEN_VALUES = ['no', 'false', '0', 'не', 'hidden', 'pending', 'скрито'];

  var doc = document;
  var loadedAt = Date.now();
  var lastItems = null;

  function t(k) { return window.t ? window.t(k) : k; }
  function sGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function clean(s, max) {
    s = String(s == null ? '' : s)
      .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[=+\-@\s]+/, '');
    return s.slice(0, max);
  }
  function clampRating(v) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) return 5;
    return Math.min(5, Math.max(1, n));
  }
  var LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|bg|ru|cn|info|xyz|top|shop|site|online|link)\b)/i;

  function fetchWithTimeout(url, opts, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var c = new AbortController();
    var timer = setTimeout(function () { c.abort(); }, ms);
    opts = opts || {}; opts.signal = c.signal;
    return fetch(url, opts).then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }

  function parseCSV(text) {
    var rows = [], row = [], cur = '', inQ = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; } }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).filter(function (r) { return r.join('').trim(); }).map(function (r) {
      var o = {}; head.forEach(function (h, idx) { o[h] = r[idx]; }); return o;
    });
  }

  function readCache(allowStale) {
    try {
      var c = JSON.parse(sGet(CACHE_KEY) || 'null');
      if (c && Array.isArray(c.data) && (allowStale || Date.now() - c.t < CACHE_TTL)) return c.data;
    } catch (e) { /* ignore */ }
    return null;
  }
  function writeCache(data) { sSet(CACHE_KEY, JSON.stringify({ t: Date.now(), data: data })); }

  /* ?refresh в адреса (напр. reviews.html?refresh) прескача кеша - за проверка след одобрение */
  var FORCE_REFRESH = /[?&]refresh\b/.test(location.search);

  function loadRaw() {
    var cached = FORCE_REFRESH ? null : readCache(false);
    if (cached) return Promise.resolve(cached);
    var feed = !!REVIEWS_FEED_URL;
    return fetchWithTimeout(feed ? REVIEWS_FEED_URL : API_URL, { cache: 'no-store' }, 9000)
      .then(function (r) {
        if (!r.ok) {
          if (window.console) console.warn('[reviews] Сървърът за ревюта отговори с HTTP ' + r.status + (r.status === 402 || r.status === 429 ? ' - вероятно е изчерпан месечният лимит на заявки' : ''));
          throw new Error('http ' + r.status);
        }
        return feed ? r.text().then(parseCSV) : r.json();
      })
      .then(function (list) { if (!Array.isArray(list)) throw new Error('bad data'); writeCache(list); return list; })
      .catch(function (err) {
        var stale = readCache(true);
        if (stale) return stale;
        throw err;
      });
  }

  function normalize(list) {
    var feed = !!REVIEWS_FEED_URL;
    var out = [];
    list.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (!feed) {
        var apRaw = r.approved != null ? r.approved : (r.Approved != null ? r.Approved : r.APPROVED);
        var ap = String(apRaw == null ? '' : apRaw).trim().toLowerCase();
        if (HIDDEN_VALUES.indexOf(ap) !== -1) return;
      }
      var text = clean(r.text, MAX_TEXT);
      if (!text) return;
      out.push({
        name: clean(r.name, MAX_NAME),
        rating: clampRating(r.rating),
        text: text,
        date: clean(r.date, 20)
      });
    });
    return out.reverse();
  }

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var STAR = '<svg class="ic" aria-hidden="true"><use href="#fa-solid-star"></use></svg>';

  function card(r) {
    var c = el('div', 'p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between shadow-sm hover:border-amber-500/50 transition');
    var top = el('div');
    var stars = el('div', 'flex text-amber-500 mb-3 text-sm');
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', t('rev_stars') + ' ' + r.rating + '/5');
    stars.innerHTML = STAR.repeat(r.rating);
    top.appendChild(stars);
    top.appendChild(el('p', 'text-sm text-zinc-600 dark:text-zinc-400 mb-4 font-medium italic', '"' + r.text + '"'));
    var bottom = el('div', 'flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3');
    bottom.appendChild(el('span', 'font-bold text-zinc-900 dark:text-white text-sm', r.name || t('rev_anon')));
    bottom.appendChild(el('span', 'text-xs text-zinc-500 dark:text-zinc-400', r.date));
    c.appendChild(top); c.appendChild(bottom);
    return c;
  }

  function note(container, key, cls) {
    container.textContent = '';
    var p = el('p', 'col-span-full text-center text-sm py-10 ' + (cls || 'text-zinc-500'), t(key));
    p.setAttribute('data-translate', key);
    container.appendChild(p);
  }

  function render(container, limit) {
    if (!lastItems) return;
    if (!lastItems.length) { note(container, 'rev_empty'); return; }
    container.textContent = '';
    lastItems.slice(0, limit).forEach(function (r) { container.appendChild(card(r)); });
  }

  function dateKey(d) {
    var m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(d || '');
    return m ? (+m[3]) * 10000 + (+m[2]) * 100 + (+m[1]) : 0;
  }
  function merge(items) {
    var seen = {}, out = [];
    normalize(MANUAL_REVIEWS.slice().reverse()).concat(items).forEach(function (r) {
      var k = r.text.toLowerCase().replace(/[^a-zа-я0-9]/g, '').slice(0, 80);
      if (seen[k]) return; seen[k] = 1; out.push(r);
    });
    return out.map(function (r, i) { return { r: r, i: i }; })
      .sort(function (a, b) { return (dateKey(b.r.date) - dateKey(a.r.date)) || (a.i - b.i); })
      .map(function (x) { return x.r; });
  }

  function loadInto(container, limit) {
    loadRaw().then(function (list) {
      lastItems = merge(normalize(list));
      render(container, limit);
    }).catch(function () {
      lastItems = merge([]);
      if (lastItems.length) render(container, limit);
      else note(container, 'rev_error', 'text-red-500 dark:text-red-400');
    });
  }

  function readLog() {
    try { var a = JSON.parse(sGet(LOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }

  function initForm(form) {
    var btn = form.querySelector('#rev-btn');
    var msg = form.querySelector('#rev-msg');
    var btnHtml = btn.innerHTML;

    function say(key, ok) {
      msg.className = 'text-sm font-semibold mt-3 text-center block ' + (ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400');
      msg.setAttribute('data-translate', key);
      msg.textContent = t(key);
    }
    function busy(on) {
      btn.disabled = on;
      btn.innerHTML = on ? '<svg class="ic animate-spin" aria-hidden="true"><use href="#fa-solid-spinner"></use></svg><span>' + t('rev_sending') + '</span>' : btnHtml;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.elements['website'] && form.elements['website'].value) { say('rev_thanks', true); form.reset(); return; }
      if (Date.now() - loadedAt < MIN_FILL_MS) { say('rev_wait', false); return; }
      var now = Date.now();
      var log = readLog().filter(function (ts) { return now - ts < 24 * 3600 * 1000; });
      if (log.length && now - log[log.length - 1] < COOLDOWN_MS) { say('rev_cooldown', false); return; }
      if (log.length >= MAX_PER_DAY) { say('rev_limit', false); return; }
      var name = clean(form.elements['name'].value, MAX_NAME);
      var text = clean(form.elements['text'].value, MAX_TEXT);
      var rating = clampRating(form.elements['rating'].value);
      if (!name || text.length < MIN_TEXT) { say('rev_invalid', false); return; }
      if (LINK_RE.test(name) || LINK_RE.test(text)) { say('rev_nolinks', false); return; }

      busy(true);
      var body = new URLSearchParams();
      var f = APPS_SCRIPT_URL ? function (k) { return k; } : function (k) { return 'data[' + k + ']'; };
      body.append(f('name'), name);
      body.append(f('rating'), String(rating));
      body.append(f('text'), text);
      if (!APPS_SCRIPT_URL) {
        body.append(f('date'), new Date().toLocaleDateString('bg-BG'));
        body.append(f('approved'), 'no');
      }

      fetchWithTimeout(API_URL, { method: 'POST', body: body }, 15000).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function (res) {
        if (res && res.ok === false) throw new Error(res.error || 'rejected');
        log.push(Date.now());
        sSet(LOG_KEY, JSON.stringify(log));
        form.reset();
        loadedAt = Date.now();
        say('rev_thanks', true);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'review_submitted', rating: rating });
      }).catch(function () {
        say('rev_err', false);
      }).then(function () { busy(false); });
    });
  }

  function init() {
    var latest = doc.getElementById('latest-reviews');
    var all = doc.getElementById('all-reviews');
    var target = latest || all, limit = latest ? 3 : SHOW_LIMIT;
    if (target) loadInto(target, limit);
    doc.addEventListener('langchange', function () { if (target && lastItems && lastItems.length) render(target, limit); });
    var form = doc.getElementById('review-form');
    if (form) initForm(form);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
