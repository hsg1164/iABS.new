/* الرسم المتحرك الأصلي من abs-sixty-wall (2)، مستقل عن بيانات الجدار. */
(function () {
  'use strict';
  var TR = [
    '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M12 3l2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8z" fill="currentColor" opacity=".9"/>',
    '<circle cx="12" cy="9" r="5.500" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="1.800"/><path d="M9 14l-2 7 5-2.500 5 2.500-2-7" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linejoin="round"/><path d="m12 6.500 1.100 2.300 2.500.4-1.800 1.700.4 2.500L12 12.200 9.800 13.400l.4-2.500-1.800-1.700 2.500-.4z" fill="currentColor"/>',
    '<rect x="3" y="9" width="18" height="12" rx="2.5" fill="currentColor" opacity=".22" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v12M3 13h18" stroke="currentColor" stroke-width="1.8"/><path d="M12 9c-1-4-5.5-4.5-5.5-1.8 0 1.6 2 1.8 5.5 1.8zM12 9c1-4 5.5-4.5 5.5-1.8 0 1.6-2 1.8-5.5 1.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
  ];

  function ringA(el) {
    var s = '', i, r1 = 116, r2 = 142;
    for (i = 0; i < 60; i++) {
      var a = (-90 + i * 6) * Math.PI / 180;
      var x1 = 150 + Math.cos(a) * r1, y1 = 150 + Math.sin(a) * r1;
      var x2 = 150 + Math.cos(a) * r2, y2 = 150 + Math.sin(a) * r2;
      var last = i === 59, milestone = [32, 43, 54].indexOf(i) > -1;
      s += '<line class="sg" style="--i:' + i + ';transform-origin:' + x1.toFixed(1) + 'px ' + y1.toFixed(1) + 'px" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + (last ? '#ff2f3a' : milestone ? '#ffd36a' : 'url(#rgd)') + '" stroke-width="' + (last ? 7 : 5) + '" stroke-linecap="round"' + (last ? ' filter="url(#rgl)"' : '') + '/>';
    }
    var marks = '';
    [[33, 0], [44, 1], [55, 2], [60, 3]].forEach(function (m) {
      var a = (-90 + (m[0] - 1) * 6 + 3) * Math.PI / 180;
      var x = 150 + Math.cos(a) * 172, y = 150 + Math.sin(a) * 172;
      marks += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"><circle r="19" fill="#0c0606" stroke="' + (m[0] === 60 ? '#ff2f3a' : '#ffd36a') + '" stroke-width="2.400"/><g transform="translate(-10 -10) scale(.84)" color="' + (m[0] === 60 ? '#ff4b53' : '#ffd36a') + '">' + (TR[m[1]] || TR[1]) + '</g></g>';
    });
    el.innerHTML = '<svg viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="rgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ffb0b4"/></linearGradient><filter id="rgl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="rga"><stop offset="0" stop-color="#ff2f3a" stop-opacity=".35"/><stop offset="1" stop-color="#ff2f3a" stop-opacity="0"/></radialGradient></defs><circle cx="150" cy="150" r="140" fill="url(#rga)"/><circle cx="150" cy="150" r="100" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.500" stroke-dasharray="3 7"/>' + s + marks + '</svg><div class="ctr"><div><b>60</b><small>مكتمل</small></div></div>';
  }

  function start() {
    var art = document.getElementById('art2');
    if (!art) return;
    art.innerHTML = '<div class="ringa"></div>';
    var ring = art.querySelector('.ringa');
    ringA(ring);
    requestAnimationFrame(function () { ring.classList.add('go'); });
    var chips = [
      ['صور', 'top:8%;inset-inline-end:2%', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>'],
      ['ذكريات', 'top:44%;inset-inline-start:0%', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.5-9-9.2C1.8 7 4.2 4 7.3 4c1.9 0 3.5 1 4.7 2.8C13.2 5 14.8 4 16.7 4 19.8 4 22.2 7 21 10.8 19 15.5 12 20 12 20z"/></svg>'],
      ['فيديوهات', 'bottom:10%;inset-inline-end:6%', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>']
    ];
    chips.forEach(function (c, i) {
      var span = document.createElement('span');
      span.className = 'ch'; span.style.cssText = c[1] + ';animation-delay:' + (i * .8) + 's'; span.innerHTML = c[2] + c[0]; art.appendChild(span);
    });
    for (var i = 0; i < 7; i++) {
      var drop = document.createElement('i'); drop.className = 'drop'; drop.style.cssText = 'left:' + (34 + Math.random() * 34).toFixed(0) + '%;top:' + (14 + Math.random() * 30).toFixed(0) + '%;animation-delay:' + (Math.random() * 2.6).toFixed(1) + 's'; art.appendChild(drop);
    }
  }
  function bindBar() {
    var buttons = document.querySelectorAll('[data-bar-gal]');
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var gallery = button.getAttribute('data-bar-gal');
        buttons.forEach(function (item) { item.classList.toggle('on', item === button); });
        if (typeof window.setGallery === 'function') window.setGallery(gallery);
        var wall = document.getElementById('wall');
        if (wall) wall.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    document.querySelectorAll('[data-bar-home]').forEach(function (button) {
      button.addEventListener('click', function () { window.location.assign('/'); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { start(); bindBar(); }); else { start(); bindBar(); }
}());
