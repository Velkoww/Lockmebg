/* Lock Me - проверка на квартал. Списъкът с квартали е в coverage.html (елементи с data-district). */
(function () {
  'use strict';
  var doc = document;
  var form = doc.getElementById('coverage-form');
  var input = doc.getElementById('area-input');
  var out = doc.getElementById('coverage-result');
  if (!form || !input || !out) return;

  function t(k) { return window.t ? window.t(k) : k; }

  var LAT = [['sht', 'щ'], ['zh', 'ж'], ['ch', 'ч'], ['sh', 'ш'], ['ts', 'ц'], ['yu', 'ю'], ['ya', 'я'], ['ju', 'ю'], ['ja', 'я']];
  var SINGLE = { a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф', h: 'х', c: 'ц', y: 'ъ', w: 'в', x: 'кс', q: 'к' };
  var STOP = { жк: 1, кв: 1, квартал: 1, ул: 1, улица: 1, бул: 1, булевард: 1, гр: 1, град: 1, софия: 1, sofia: 1, бл: 1, вх: 1, ет: 1, ап: 1, номер: 1 };

  function translit(s) {
    LAT.forEach(function (p) { s = s.split(p[0]).join(p[1]); });
    return s.replace(/[a-z]/g, function (c) { return SINGLE[c] || c; });
  }
  function norm(s) {
    s = translit(String(s || '').toLowerCase()).replace(/ё/g, 'е');
    var tokens = s.replace(/[^а-я\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1 && !STOP[w]; });
    return tokens.join(' ');
  }

  var districts = Array.prototype.slice.call(doc.querySelectorAll('[data-district]')).map(function (e) {
    var keys = [norm(e.textContent)];
    (e.getAttribute('data-alias') || '').split('|').forEach(function (a) { var n = norm(a); if (n) keys.push(n); });
    return { name: e.textContent.trim(), keys: keys.filter(Boolean) };
  });
  // по-дългите имена първи (напр. "Лозенец" преди "Лозен")
  districts.sort(function (a, b) {
    return Math.max.apply(null, b.keys.map(function (k) { return k.length; })) - Math.max.apply(null, a.keys.map(function (k) { return k.length; }));
  });

  function find(q) {
    var nq = norm(q);
    if (nq.length < 3) return null;
    for (var i = 0; i < districts.length; i++) {
      for (var j = 0; j < districts[i].keys.length; j++) {
        var k = districts[i].keys[j];
        if (nq.indexOf(k) !== -1 || (nq.length >= 4 && k.indexOf(nq) === 0)) return districts[i];
      }
    }
    return null;
  }

  var last = null; // за превод при смяна на езика

  function show(kind, name, raw) {
    last = { kind: kind, name: name, raw: raw };
    out.className = 'p-4 rounded-2xl text-left text-sm font-medium border block ';
    out.textContent = '';
    var msg = doc.createElement('span');
    if (kind === 'ok') {
      out.className += 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300';
      msg.textContent = name + ' ' + t('cov_ok_post');
    } else if (kind === 'no') {
      out.className += 'bg-amber-50 dark:bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200';
      msg.textContent = t('cov_no_pre') + ' "' + raw + '" ' + t('cov_no_post');
    } else {
      out.className += 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300';
      msg.textContent = t('cov_short');
    }
    out.appendChild(msg);
  }

  function run(value) {
    var v = String(value || '').trim().slice(0, 80);
    if (norm(v).length < 3) { show('short', '', v); return; }
    var d = find(v);
    if (d) show('ok', d.name, v); else show('no', '', v);
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run(input.value); });

  Array.prototype.slice.call(doc.querySelectorAll('[data-district]')).forEach(function (b) {
    b.addEventListener('click', function () {
      input.value = b.textContent.trim();
      run(input.value);
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  doc.addEventListener('langchange', function () {
    if (last && !out.classList.contains('hidden')) show(last.kind, last.name, last.raw);
  });
})();
