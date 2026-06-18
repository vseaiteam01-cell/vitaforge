/* ============================================================
   VITAFORGE — 3D avatar via <model-viewer> (+ bone-morph)
   Риггованная GLB-модель (Higgsfield image->3D): глиняный вид,
   вращение 360° + автоповорот, прозрачный фон, М/Ж,
   морф по уровню через масштаб костей (мышцы/жир).
   ============================================================ */
(function () {
  var cur = { gender: 'm', muscle: 0, fat: 0.45 };
  var tapMode = 'open';   // 'open' = тап открывает полноэкранный зал мышц; 'select' = тап выбирает мышцу
  var URLS = { m: 'assets/adam.glb?v=3', f: 'assets/eve.glb?v=1' };
  var mv = null;
  // зоны мышц (доли габаритов от центра модели): fx,fy,fz
  var MUSCLES = [
    { id: 'chest', fx: 0, fy: 0.16, fz: 0.52 },
    { id: 'abs', fx: 0, fy: -0.03, fz: 0.52 },
    { id: 'shoulders', fx: 0.30, fy: 0.30, fz: 0.18 },
    { id: 'arms', fx: 0.46, fy: 0.04, fz: 0.16 },
    { id: 'back', fx: 0, fy: 0.16, fz: -0.52 },
    { id: 'legs', fx: 0.13, fy: -0.30, fz: 0.42 }
  ];
  function buildHotspots() {
    if (!mv) return;
    Array.prototype.slice.call(mv.querySelectorAll('.vf-hot')).forEach(function (e) { e.remove(); });
    var c = { x: 0, y: 0, z: 0 }, d = { x: 0.5, y: 1.7, z: 0.3 };
    try { if (mv.getBoundingBoxCenter) c = mv.getBoundingBoxCenter(); } catch (e) {}
    try { if (mv.getDimensions) d = mv.getDimensions(); } catch (e) {}
    MUSCLES.forEach(function (mu) {
      var b = document.createElement('button');
      b.className = 'vf-hot'; b.slot = 'hotspot-' + mu.id;
      b.setAttribute('data-position', (c.x + mu.fx * d.x) + ' ' + (c.y + mu.fy * d.y) + ' ' + (c.z + mu.fz * d.z));
      b.setAttribute('data-normal', (mu.fz >= 0 ? '0 0 1' : '0 0 -1'));
      b.setAttribute('data-visibility-attribute', 'visible');
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (window.VF && window.VF.muscleMenu) window.VF.muscleMenu(mu.id); });
      mv.appendChild(b);
    });
  }

  function getScene() {
    if (!mv) return null;
    if (mv.__scene) return mv.__scene;
    var sym = Object.getOwnPropertySymbols(mv).find(function (s) { return String(s) === 'Symbol(scene)'; });
    mv.__scene = sym ? mv[sym] : null;
    return mv.__scene;
  }
  function boneMap() {
    var sc = getScene(); if (!sc) return null;
    var map = {};
    sc.traverse(function (o) { if (o.isBone) { map[o.name] = o; if (!o.userData._base) o.userData._base = o.scale.clone(); } });
    return map;
  }
  // морф: масштаб костей по мышцам(m) и жиру(f). Голову и кисти/стопы
  // контр-масштабируем, чтобы не раздувались из-за наследования.
  function applyMorph() {
    var map = boneMap(); if (!map) return false;
    var m = Math.max(0, Math.min(1, cur.muscle)), f = Math.max(0, Math.min(1, cur.fat));
    var mm = m - 0.45;              // базовая модель ≈ стадия 3-4; низкие стадии суше
    function set(name, k) { var b = map[name]; if (!b) return; var base = b.userData._base; b.scale.set(base.x * Math.max(k, 0.5), base.y, base.z * Math.max(k, 0.5)); }
    var sf = 1 + 0.40 * f;             // талия/живот (от жира)
    var sc = 1 + 0.30 * mm + 0.12 * f; // грудь
    var arm = 1 + 0.45 * mm;           // толщина рук (стадия1 ~0.8, стадия6 ~1.25)
    var leg = 1 + 0.35 * mm + 0.10 * f; // толщина ног
    set('Spine', sf); set('Spine01', 1); set('Spine02', sc);
    ['LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'].forEach(function (n) { set(n, arm); });
    ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'].forEach(function (n) { set(n, leg); });
    set('neck', 1 / (sf * sc));                 // защита головы
    ['LeftHand', 'RightHand'].forEach(function (n) { set(n, 1 / (sf * sc * arm * arm)); }); // защита кистей
    ['LeftFoot', 'RightFoot'].forEach(function (n) { set(n, 1 / (leg * leg)); });           // защита стоп
    return true;
  }

  function recolor() {
    try {
      var mats = mv.model && mv.model.materials;
      if (mats) mats.forEach(function (mat) {
        var p = mat.pbrMetallicRoughness;
        p.setBaseColorFactor([0.55, 0.53, 0.48, 1]);
        p.setMetallicFactor(0.0);
        p.setRoughnessFactor(0.97);
      });
    } catch (e) {}
  }

  // тап по 3D-болвану -> определить мышцу по зоне тела -> подсветить точку + открыть меню
  function muscleFromHit(pos, normal) {
    var c = { x: 0, y: 0, z: 0 }, d = { x: 0.5, y: 1.7, z: 0.3 };
    try { if (mv.getBoundingBoxCenter) c = mv.getBoundingBoxCenter(); } catch (e) {}
    try { if (mv.getDimensions) d = mv.getDimensions(); } catch (e) {}
    var ny = (pos.y - (c.y - d.y / 2)) / (d.y || 1);   // 0 низ .. 1 верх
    var nx = (pos.x - c.x) / ((d.x / 2) || 1);          // -1..1
    var front = (normal ? normal.z : 1) >= 0;
    var ax = Math.abs(nx);
    if (ny > 0.90) return front ? 'delts' : 'traps';
    if (ny > 0.78) return ax > 0.5 ? 'delts' : (front ? 'chest' : 'traps');
    if (ny > 0.62) { if (ax > 0.6) return front ? 'biceps' : 'triceps'; return front ? 'chest' : 'lats'; }
    if (ny > 0.50) { if (ax > 0.7) return 'forearms'; return front ? 'abs' : 'lower_back'; }
    if (ny > 0.34) { if (ax > 0.55) return 'forearms'; return front ? 'quads' : 'glutes'; }
    if (ny > 0.16) return front ? 'quads' : 'hams';
    return 'calves';
  }
  function showHitMarker(pos, normal) {
    var el = mv.querySelector('.vf-hit');
    if (!el) { el = document.createElement('div'); el.className = 'vf-hit'; el.slot = 'hotspot-hit'; el.innerHTML = '<i></i>'; mv.appendChild(el); }
    var p = pos.x.toFixed(3) + ' ' + pos.y.toFixed(3) + ' ' + pos.z.toFixed(3);
    var n = normal ? (normal.x.toFixed(2) + ' ' + normal.y.toFixed(2) + ' ' + normal.z.toFixed(2)) : '0 0 1';
    el.setAttribute('data-position', p); el.setAttribute('data-normal', n); el.setAttribute('data-visibility-attribute', 'visible');
    try { mv.updateHotspot({ name: 'hotspot-hit', position: p, normal: n }); } catch (e) {}
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  }
  function handleTap(e) {
    if (tapMode === 'open') { if (window.VF && window.VF.openMuscleLab) window.VF.openMuscleLab(); return; }
    var hit = null; try { hit = mv.positionAndNormalFromPoint(e.clientX, e.clientY); } catch (er) {}
    if (!hit || !hit.position) return;
    var fine = muscleFromHit(hit.position, hit.normal);
    showHitMarker(hit.position, hit.normal);
    try { if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium'); } catch (e2) {}
    if (window.VF && window.VF.muscleMenuFine) window.VF.muscleMenuFine(fine);
  }

  function ensureMV() {
    if (mv) return mv;
    mv = document.createElement('model-viewer');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('auto-rotate-delay', '0');
    mv.setAttribute('rotation-per-second', '26deg');
    mv.setAttribute('disable-zoom', '');
    mv.setAttribute('disable-pan', '');
    mv.setAttribute('interaction-prompt', 'none');
    mv.setAttribute('touch-action', 'pan-y');
    mv.setAttribute('environment-image', 'neutral');
    mv.setAttribute('tone-mapping', 'neutral');
    mv.setAttribute('exposure', '0.42');
    mv.setAttribute('shadow-intensity', '0.5');
    mv.setAttribute('shadow-softness', '1');
    mv.setAttribute('camera-orbit', '180deg 90deg auto');
    mv.setAttribute('field-of-view', '30deg');
    mv.setAttribute('camera-target', 'auto auto auto');
    mv.style.width = '100%';
    mv.style.height = '100%';
    mv.style.background = 'transparent';
    mv.style.setProperty('--poster-color', 'transparent');
    mv.style.setProperty('--progress-bar-color', '#3FD3D8');
    mv.addEventListener('load', function () { mv.__scene = null; recolor(); applyMorph(); });
    var _down = null;
    mv.addEventListener('pointerdown', function (e) { _down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    mv.addEventListener('pointerup', function (e) {
      if (!_down) return; var dx = Math.abs(e.clientX - _down.x), dy = Math.abs(e.clientY - _down.y), dt = Date.now() - _down.t; _down = null;
      if (dx > 9 || dy > 9 || dt > 600) return;  // это вращение/долгий тап, не тап по мышце
      handleTap(e);
    });
    return mv;
  }

  function srcFor(g) { return URLS[g] || URLS.m; }

  function mount(container, opts) {
    if (!container) return;
    if (opts && opts.tapMode) tapMode = opts.tapMode;
    if (opts) for (var k in opts) { if (k !== 'tapMode') cur[k] = opts[k]; }
    var el = ensureMV();
    var want = srcFor(cur.gender === 'f' ? 'f' : 'm');
    if (el.getAttribute('src') !== want) { el.setAttribute('src', want); el.__scene = null; }
    if (el.parentNode !== container) container.appendChild(el);
    applyMorph();
  }
  function setParams(opts) {
    if (opts) for (var k in opts) cur[k] = opts[k];
    if (!mv) return;
    var want = srcFor(cur.gender === 'f' ? 'f' : 'm');
    if (mv.getAttribute('src') !== want) { mv.setAttribute('src', want); mv.__scene = null; }
    applyMorph();
  }

  window.VFAvatar = {
    mount: mount, setParams: setParams,
    snap: function () { try { return mv ? mv.toDataURL('image/jpeg', 0.8) : null; } catch (e) { return 'err:' + e; } },
    _info: function () { if (!mv) return 'no-mv'; return { loaded: mv.loaded, src: mv.getAttribute('src'), morph: applyMorph(), cur: cur }; },
    _setMF: function (m, f) { cur.muscle = m; cur.fat = f; return applyMorph(); },
    _hitTest: function (x, y) {
      if (!mv) return 'no-mv'; var r = mv.getBoundingClientRect();
      var px = x != null ? x : r.left + r.width / 2, py = y != null ? y : r.top + r.height * 0.42;
      var hit = null; try { hit = mv.positionAndNormalFromPoint(px, py); } catch (e) { return 'err:' + e; }
      if (!hit || !hit.position) return 'no-hit';
      showHitMarker(hit.position, hit.normal);
      return { muscle: muscleFromHit(hit.position, hit.normal), pos: [+hit.position.x.toFixed(2), +hit.position.y.toFixed(2), +hit.position.z.toFixed(2)] };
    }
  };
  (window.__vfAvatarQueue || []).forEach(function (a) { try { mount(a[0], a[1]); } catch (e) {} });
  window.__vfAvatarQueue = [];
})();
