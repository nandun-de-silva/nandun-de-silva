// Easter egg: type "ace" anywhere on the page and a skeletal dragon flies across
// the screen once, breathes blue fire halfway, then disappears.
// Loaded on demand from BaseLayout, so normal visitors never download it.

let active = false;

export function run() {
  if (active || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  active = true;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '1000', pointerEvents: 'none' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const TAU = Math.PI * 2;

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace('#', '');
  const rgb = hex.length === 6 ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') : '10,132,255';
  const alpha = document.documentElement.getAttribute('data-theme') === 'light' ? 0.3 : 0.34;
  const col = (a = 1) => `rgba(${rgb},${Math.min(alpha * a, 1).toFixed(3)})`;

  // ---------- body ----------
  const N = 58, SP = 14, LEG = 34;
  const path = (x: number) => H * 0.55 + Math.sin((x / W) * Math.PI * 2) * H * 0.18;
  let hx = -120;
  const pts = Array.from({ length: N }, (_, i) => ({ x: hx - i * SP, y: path(hx) }));
  const width = (i: number) => 13 * Math.pow(1 - i / N, 0.8) + 2;
  const ang = (i: number) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.max(i, 1)];
    return Math.atan2(a.y - b.y, a.x - b.x);
  };
  const legs = [7, 25].flatMap(k => [1, -1].map(s => ({ k, s, fx: pts[k].x, fy: pts[k].y, step: false })));
  const embers: { x: number; y: number; vx: number; vy: number; s: number; life: number; d: number }[] = [];
  let t = 0, breath = 0, breathed = false, jaw = 0;

  function update() {
    t += 0.016;
    // the head glides along a gentle wave from left to right with a serpentine sway
    hx += 4.2;
    const h = pts[0];
    h.x = hx;
    h.y = path(hx) + Math.sin(t * 2.4) * 18;
    for (let i = 1; i < N; i++) {
      const p = pts[i - 1], q = pts[i];
      const ex = q.x - p.x, ey = q.y - p.y, e = Math.hypot(ex, ey) || 1;
      q.x = p.x + ex / e * SP; q.y = p.y + ey / e * SP;
    }
    for (const L of legs) {
      const a = ang(L.k) + L.s * 0.85;
      const ix = pts[L.k].x + Math.cos(a) * LEG * 1.55, iy = pts[L.k].y + Math.sin(a) * LEG * 1.55;
      if (!L.step && Math.hypot(ix - L.fx, iy - L.fy) > LEG * 1.15) L.step = true;
      if (L.step) {
        L.fx += (ix - L.fx) * 0.3; L.fy += (iy - L.fy) * 0.3;
        if (Math.hypot(ix - L.fx, iy - L.fy) < 2) L.step = false;
      }
    }

    // one big fire breath as it passes the middle of the screen
    if (!breathed && hx > W * 0.5) { breath = 1; breathed = true; }
    if (breath > 0) breath = Math.max(0, breath - 0.012);
    jaw += ((breath > 0 ? 0.55 : 0.1) - jaw) * 0.2;
    const a0 = ang(1);
    if (breath > 0.1) {
      for (let n = 0; n < 8; n++) {
        const spread = (Math.random() - 0.5) * 0.4, v = 5 + Math.random() * 4;
        embers.push({
          x: h.x + Math.cos(a0) * 46, y: h.y + Math.sin(a0) * 46,
          vx: Math.cos(a0 + spread) * v, vy: Math.sin(a0 + spread) * v,
          s: 1.5 + Math.random() * 3.5, life: 1, d: 0.022,
        });
      }
    }
    if (Math.random() < 0.8) {
      const i = 2 + Math.floor(Math.random() * (N - 10)), a = ang(i) + Math.PI / 2;
      const off = (Math.random() - 0.5) * width(i) * 2;
      embers.push({
        x: pts[i].x + Math.cos(a) * off, y: pts[i].y + Math.sin(a) * off,
        vx: (Math.random() - 0.5) * 0.4, vy: -0.3 - Math.random() * 0.6,
        s: 0.8 + Math.random() * 1.8, life: 1, d: 0.016,
      });
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx + Math.sin(t * 4 + e.y * 0.05) * 0.2; e.y += e.vy;
      e.vx *= 0.97; e.vy = e.vy * 0.97 - 0.02;
      e.life -= e.d; e.s *= 0.995;
      if (e.life <= 0) embers.splice(i, 1);
    }
  }

  function drawWing(i: number, s: number) {
    const p = pts[i], a = ang(i);
    const flap = Math.sin(t * 3 + (s > 0 ? 0 : 0.3));
    const wa = a + s * (1.35 + flap * 0.45);
    const ex = p.x + Math.cos(wa) * 80, ey = p.y + Math.sin(wa) * 80;
    const back = a + Math.PI - s * 0.35;
    const tips: [number, number][] = [120, 105, 85, 62].map((l, k) => {
      const f = (k + 1) / 4.5;
      const vx = Math.cos(wa) * (1 - f) + Math.cos(back) * f, vy = Math.sin(wa) * (1 - f) + Math.sin(back) * f;
      const m = Math.hypot(vx, vy) || 1;
      return [ex + vx / m * l, ey + vy / m * l];
    });
    const root = pts[i + 12];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey);
    tips.forEach(([x, y], k) => {
      const prev = k === 0 ? [ex, ey] : tips[k - 1];
      ctx.quadraticCurveTo((prev[0] + x) / 2 - Math.cos(a) * 14, (prev[1] + y) / 2 - Math.sin(a) * 14, x, y);
    });
    ctx.quadraticCurveTo((tips[3][0] + root.x) / 2 - Math.cos(a) * 10, (tips[3][1] + root.y) / 2 - Math.sin(a) * 10, root.x, root.y);
    ctx.closePath();
    ctx.fillStyle = col(0.22); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = col(1.3); ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (const [x, y] of tips) { ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.fillStyle = col(1.6);
    ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, TAU); ctx.fill();
  }

  function drawLeg(L: typeof legs[number]) {
    const b = pts[L.k], dx = L.fx - b.x, dy = L.fy - b.y;
    const d = Math.min(Math.hypot(dx, dy), LEG * 2 - 0.5), th = Math.atan2(dy, dx);
    const k = th - L.s * Math.acos(d / (2 * LEG));
    const kx = b.x + Math.cos(k) * LEG, ky = b.y + Math.sin(k) * LEG;
    const fx = b.x + Math.cos(th) * d, fy = b.y + Math.sin(th) * d;
    ctx.lineCap = 'round'; ctx.strokeStyle = col(1.2);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = col(1.6); ctx.beginPath(); ctx.arc(kx, ky, 3.5, 0, TAU); ctx.fill();
  }

  function drawSkull() {
    const h = pts[0];
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(ang(1));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = col(1.5);
    for (const s of [-1, 1]) {
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, s * 10); ctx.quadraticCurveTo(-30, s * 30, -58, s * 30); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, s * 6); ctx.quadraticCurveTo(-30, s * 12, -44, s * 8); ctx.stroke();
    }
    for (const s of [-1, 1]) {
      ctx.save(); ctx.rotate(s * jaw * 0.6);
      ctx.beginPath(); ctx.moveTo(-6, s * 6); ctx.lineTo(40, s * 5); ctx.lineTo(44, s * 2); ctx.lineTo(4, s * 2); ctx.closePath();
      ctx.fillStyle = col(0.5); ctx.fill(); ctx.strokeStyle = col(1.4); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.bezierCurveTo(-16, -16, 4, -18, 14, -11);
    ctx.lineTo(46, -5); ctx.lineTo(54, 0); ctx.lineTo(46, 5); ctx.lineTo(14, 11);
    ctx.bezierCurveTo(4, 18, -16, 16, -16, 0);
    ctx.fillStyle = col(0.55); ctx.fill(); ctx.strokeStyle = col(1.6); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = col(2);
    for (let x = 18; x <= 42; x += 6) for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(x, s * 6); ctx.lineTo(x + 2, s * 9); ctx.lineTo(x + 4, s * 6); ctx.fill();
    }
    ctx.shadowColor = `rgba(${rgb},1)`; ctx.shadowBlur = 16;
    for (const s of [-1, 1]) {
      ctx.fillStyle = col(1.2); ctx.beginPath(); ctx.ellipse(6, s * 8, 7, 4.5, s * 0.25, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(170,220,255,0.9)'; ctx.beginPath(); ctx.ellipse(7, s * 8, 2.8, 1.8, s * 0.25, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawTail() {
    const tl = pts[N - 1];
    ctx.save();
    ctx.translate(tl.x, tl.y); ctx.rotate(ang(N - 1) - Math.PI / 2); ctx.scale(1.3, 1.3);
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.bezierCurveTo(-8, 12, -18, 6, -14, -4); ctx.bezierCurveTo(-11, -11, -3, -10, -1, -5);
    ctx.lineTo(-3, -12); ctx.lineTo(3, -12); ctx.lineTo(1, -5);
    ctx.bezierCurveTo(3, -10, 11, -11, 14, -4); ctx.bezierCurveTo(18, 6, 8, 12, 0, 22);
    ctx.fillStyle = col(0.6); ctx.fill(); ctx.strokeStyle = col(1.5); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = `rgba(${rgb},0.8)`; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = 22; ctx.strokeStyle = col(0.12); ctx.stroke();
    ctx.restore();

    legs.forEach(drawLeg);
    drawWing(8, 1); drawWing(8, -1);

    ctx.beginPath(); ctx.moveTo(pts[1].x, pts[1].y);
    for (let i = 2; i < N; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = 2.5; ctx.strokeStyle = col(1.3); ctx.stroke();

    for (let i = 5; i <= 26; i++) {
      const p = pts[i], a = ang(i), len = 10 + 38 * Math.sin(Math.PI * (i - 5) / 21);
      for (const s of [-1, 1]) {
        const n = a + s * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(
          p.x + Math.cos(n) * len * 0.9 + Math.cos(a) * 6, p.y + Math.sin(n) * len * 0.9 + Math.sin(a) * 6,
          p.x + Math.cos(n) * len - Math.cos(a) * len * 0.45, p.y + Math.sin(n) * len - Math.sin(a) * len * 0.45);
        ctx.lineWidth = 1.4; ctx.strokeStyle = col(1); ctx.stroke();
      }
    }

    for (let i = 1; i < N; i++) {
      const p = pts[i], w = width(i) * 0.45;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang(i));
      ctx.beginPath(); ctx.moveTo(w + 3, 0); ctx.lineTo(0, -w); ctx.lineTo(-w - 2, 0); ctx.lineTo(0, w); ctx.closePath();
      ctx.fillStyle = col(0.7); ctx.fill(); ctx.strokeStyle = col(1.4); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    drawTail();
    drawSkull();

    ctx.save();
    ctx.shadowColor = `rgba(${rgb},1)`; ctx.shadowBlur = 10;
    for (const e of embers) {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, TAU);
      ctx.fillStyle = `rgba(150,210,255,${Math.min(alpha * 2.2 * e.life, 1).toFixed(3)})`; ctx.fill();
    }
    ctx.restore();
  }

  function frame() {
    update(); draw();
    // finished once the tail has left the screen and the fire has burned out
    if (pts[N - 1].x > W + 160 && embers.length === 0) {
      canvas.remove();
      active = false;
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
