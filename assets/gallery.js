/* Lock Me - галерия: снимката се отваря на цял екран, с бутони, стрелки и плъзгане */
(function () {
  'use strict';
  var grid = document.getElementById('gallery-grid');
  if (!grid) return;
  var links = Array.prototype.slice.call(grid.querySelectorAll('a[data-gallery]'));
  if (!links.length) return;

  var L = {
    close: grid.getAttribute('data-l-close') || 'Close',
    prev: grid.getAttribute('data-l-prev') || 'Previous',
    next: grid.getAttribute('data-l-next') || 'Next'
  };
  var cur = 0, lastFocus = null, sx = null;

  function css(el, s) { el.style.cssText = s; return el; }
  function btn(label, text, pos) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.textContent = text;
    css(b, 'position:absolute;' + pos + 'width:48px;height:48px;border-radius:50%;border:0;cursor:pointer;' +
      'background:rgba(255,255,255,.14);color:#fff;font:700 28px/1 system-ui,sans-serif;display:grid;place-items:center');
    b.onmouseenter = function () { b.style.background = 'rgba(245,158,11,.85)'; };
    b.onmouseleave = function () { b.style.background = 'rgba(255,255,255,.14)'; };
    return b;
  }

  var box = css(document.createElement('div'),
    'position:fixed;inset:0;z-index:90;background:rgba(9,9,11,.94);display:none;align-items:center;justify-content:center;padding:64px 16px');
  box.id = 'lm-lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  var img = css(document.createElement('img'),
    'max-width:min(100%,1200px);max-height:calc(100vh - 128px);object-fit:contain;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)');
  img.alt = '';
  var bClose = btn(L.close, '×', 'top:12px;right:12px;');
  var bPrev = btn(L.prev, '‹', 'left:10px;top:50%;transform:translateY(-50%);');
  var bNext = btn(L.next, '›', 'right:10px;top:50%;transform:translateY(-50%);');
  box.appendChild(img); box.appendChild(bClose); box.appendChild(bPrev); box.appendChild(bNext);
  document.body.appendChild(box);

  function show(i) {
    cur = (i + links.length) % links.length;
    var a = links[cur], t = a.querySelector('img');
    img.src = a.getAttribute('href');
    img.alt = t ? t.alt : '';
    box.setAttribute('aria-label', img.alt);
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    box.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
    bClose.focus();
  }
  function close() {
    box.style.display = 'none';
    img.removeAttribute('src');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  links.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(i);
    });
  });
  bClose.addEventListener('click', close);
  bPrev.addEventListener('click', function () { show(cur - 1); });
  bNext.addEventListener('click', function () { show(cur + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (box.style.display !== 'flex') return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(cur + 1);
    else if (e.key === 'ArrowLeft') show(cur - 1);
    else if (e.key === 'Tab') {
      var f = [bClose, bPrev, bNext], k = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
    sx = null;
  });
})();
