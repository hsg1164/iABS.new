/* Full-screen portal shown after arriving from the 60-day section. */
(function () {
  var arriving = false;
  try {
    arriving = sessionStorage.getItem('abs60') === '1';
    sessionStorage.removeItem('abs60');
  } catch (e) {}
  if (!arriving) return;
  var style = document.createElement('style');
  style.textContent = '#abs60-arrive{position:fixed;inset:0;z-index:99999;pointer-events:none;background:radial-gradient(circle at 50% 50%,#ff4b53 0,#c0161f 35%,#2a0508 80%);clip-path:circle(160vmax at 50% 50%);will-change:clip-path;transform:translateZ(0);contain:strict;animation:abs60-arrive 1.8s cubic-bezier(.7,0,.2,1) forwards}#abs60-arrive:after{content:"60";position:absolute;inset:0;display:grid;place-items:center;font:800 min(46vw,420px)/1 Changa,Tajawal,sans-serif;font-style:italic;color:rgba(255,255,255,.12);-webkit-text-stroke:3px rgba(255,255,255,.4)}@keyframes abs60-arrive{to{clip-path:circle(0 at 50% 50%)}}';
  document.head.appendChild(style);
  var portal = document.createElement('div');
  portal.id = 'abs60-arrive';
  document.body.appendChild(portal);
  setTimeout(function () { portal.remove(); style.remove(); }, 1900);
}());
