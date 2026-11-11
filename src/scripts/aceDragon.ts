// Easter egg: type "ace" anywhere on the page and a huge skeleton dragon flies
// in, lands in view of whatever section is on screen, turns side-on and fires
// one long lightning beam straight ahead, then takes off and flies away.
// Loaded on demand from BaseLayout, so normal visitors never download it.

let active = false;

// ---------------------------------------------------------------------------
// Dragon
// ---------------------------------------------------------------------------
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

  const lightBg = document.documentElement.getAttribute('data-theme') === 'light';
  const add: GlobalCompositeOperation = lightBg ? 'source-over' : 'lighter';

  // bone palette: ivory bones with dark outlines, dark sockets, faint electric membrane
  const BONE = '#ddd6c6', BONE_SH = '#8c8474', LINE = '#0b0b12', SOCKET = '#000000';
  const MEMB = 'rgba(18,10,28,0.55)', EYE = '255,45,30';
  const GLOW = '90,200,255';

  type V = number[];
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const bez = (a: V, b: V, c: V, d: V, u: number) => {
    const v = 1 - u;
    return [
      v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0],
      v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1],
    ];
  };

  // ---------- size and landing spot ----------
  const SS = Math.max(1.1, Math.min(2.2, Math.min(H / 430, W / 760)));   // standing scale
  const FS = SS * 0.8;                                                     // flying scale
  const face = 1;
  const SX = Math.max(190 * SS, W * 0.3), SY = H - 26;
  const T = [SX + SS * 118, SY - SS * 150];
  // flight is simulated in "model" units and drawn scaled by FS
  const Wm = W / FS, Hm = H / FS;
  const Tm = [T[0] / FS, T[1] / FS];
  const P0 = [-260, Hm * 0.25], P1 = [Wm * 0.2, -Hm * 0.05], P2 = [Tm[0] - 300, Tm[1] + 150];

  const N = 58, SP = 14, LEG = 34;
  const pts = Array.from({ length: N }, (_, i) => ({ x: P0[0] - i * SP, y: P0[1] }));
  const fw = (i: number) =>
    i < 4 ? 9 : i < 12 ? 9 + (i - 4) * 1.6 : i < 26 ? 22 : 22 * Math.pow(1 - (i - 26) / (N - 26), 1.1) + 1.5;
  const ang = (i: number) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.max(i, 1)];
    return Math.atan2(a.y - b.y, a.x - b.x);
  };
  const legs = [8, 24].flatMap(k => [1, -1].map(s => ({ k, s, fx: pts[k].x, fy: pts[k].y, step: false })));

  const sparks: { x: number; y: number; vx: number; vy: number; s: number; life: number; d: number }[] = [];
  const ripples: { x: number; y: number; r: number; life: number }[] = [];
  const mist: { x: number; y: number; r: number; life: number }[] = [];

  let t = 0, u = 0, phase: 'in' | 'land' | 'stand' | 'off' | 'out' = 'in';
  let land = 0, side = 0, rt = 0, heading = 0, pw = 0, pf = 0, shake = 0;
  let wasFiring = false, beamLen = 0, flash = 0;

  // ---------- side view pose ----------
  function pose() {
    const br = Math.sin(t * 2) * 2;
    const sw = Math.sin(t * 1.4) * 14;
    const Hx = 118 - 30 * pw + 24 * pf, Hy = -150 - 26 * pw + 14 * pf + Math.sin(t * 1.7) * 2;
    const ha = 0.15 - 0.7 * pw - 0.17 * pf;
    const jo = 0.08 + 0.16 * pw + 0.86 * pf;
    const tail: V[] = [], body: V[] = [], neck: V[] = [];
    for (let k = 0; k <= 16; k++) tail.push(bez([-250, -18 + sw], [-185, -6 + sw * 0.5], [-120, -96], [-62, -92 + br * 0.5], k / 16));
    for (let k = 0; k <= 10; k++) body.push(bez([-62, -92 + br * 0.5], [-22, -110 + br], [18, -110 + br], [50, -98], k / 10));
    for (let k = 0; k <= 10; k++) neck.push(bez([50, -98], [82, -106], [Hx - 34, Hy + 26], [Hx, Hy], k / 10));
    return { br, Hx, Hy, ha, jo, tail, body, neck };
  }

  function mouthWorld() {
    const P = pose();
    // midpoint between the upper teeth and the open lower jaw, i.e. inside the mouth
    const ux = 44, uy = 7;
    const jx = -6 + Math.cos(P.jo) * 50 - Math.sin(P.jo) * 2, jy = 6 + Math.sin(P.jo) * 50 + Math.cos(P.jo) * 2;
    const hx = (ux + jx) / 2, hy = (uy + jy) / 2;
    const lx = P.Hx + Math.cos(P.ha) * hx - Math.sin(P.ha) * hy;
    const ly = P.Hy + Math.sin(P.ha) * hx + Math.cos(P.ha) * hy;
    const am = Math.min(P.ha, 0) - 0.03;
    return { x: SX + face * SS * lx, y: SY + SS * ly, a: face > 0 ? am : Math.PI - am };
  }

  // standing spine in model units, head first, resampled to n points (for the landing morph)
  function sideSpine(n: number): V[] {
    const P = pose();
    const poly = [...P.tail, ...P.body.slice(1), ...P.neck.slice(1)].reverse()
      .map(p => [(SX + face * SS * p[0]) / FS, (SY + SS * p[1]) / FS]);
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const total = cum[cum.length - 1], out: V[] = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const d = total * k / (n - 1);
      while (j < poly.length - 2 && cum[j + 1] < d) j++;
      const f = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
      out.push([poly[j][0] + (poly[j + 1][0] - poly[j][0]) * f, poly[j][1] + (poly[j + 1][1] - poly[j][1]) * f]);
    }
    return out;
  }

  // ---------- update ----------
  function update() {
    t += 0.016;
    const h = pts[0];

    if (side > 0.3 && Math.random() < 0.5) {
      mist.push({ x: SX + (Math.random() - 0.55) * 420 * SS, y: SY - Math.random() * 140 * SS, r: (25 + Math.random() * 40) * SS, life: 1 });
    }
    for (let i = mist.length - 1; i >= 0; i--) {
      const mp = mist[i];
      mp.y -= 0.35; mp.x += Math.sin(t + i) * 0.3; mp.r += 0.25; mp.life -= 0.009;
      if (mp.life <= 0) mist.splice(i, 1);
    }

    if (phase === 'in') {
      u = Math.min(1, u + 1 / 180);
      const uu = 1 - (1 - u) * (1 - u);
      const [x, y] = bez(P0, P1, P2, Tm, uu);
      heading = Math.atan2(y - h.y, x - h.x);
      h.x = x; h.y = y;
      if (u >= 1) phase = 'land';
    } else if (phase === 'land') {
      land = Math.min(1, land + 0.018);
      if (land >= 1) { phase = 'stand'; rt = 0.6; shake = 1; }
    } else if (phase === 'stand') {
      rt += 0.016;
      if (rt >= 5.3) phase = 'off';
    } else if (phase === 'off') {
      land = Math.max(0, land - 0.025);
      if (land <= 0) phase = 'out';
    } else {
      let diff = -0.55 - heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      heading += diff * 0.03;
      const sway = Math.sin(t * 2.4) * 0.3;
      h.x += Math.cos(heading + sway) * 6;
      h.y += Math.sin(heading + sway) * 6;
    }

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
    side = Math.max(0, Math.min(1, (land - 0.6) / 0.4));


    // one long roar: rear back, then a sustained lightning beam
    const r = phase === 'stand' ? rt : 0;
    if (r >= 1 && r < 1.6) { pw = ease((r - 1) / 0.6); pf = 0; }
    else if (r >= 1.6 && r < 4.6) { pw = 1 - ease((r - 1.6) / 0.25); pf = Math.min(1, (r - 1.6) / 0.12); }
    else if (r >= 4.6 && r < 5.3) { pw = 0; pf = 1 - ease((r - 4.6) / 0.7); }
    else { pw *= 0.9; pf *= 0.9; }
    shake = Math.max(shake * 0.9, pf > 0.5 ? pf : 0);

    const fireOn = r >= 1.6 && r < 4.6;
    if (fireOn && !wasFiring) {
     
      flash = 1;
      const m = mouthWorld();
      for (let k = 0; k < 5; k++) ripples.push({ x: m.x, y: m.y, r: 12 + k * 22, life: 1 });
    }
    wasFiring = fireOn;
    beamLen = fireOn ? Math.min(1, beamLen + 0.12) : Math.max(0, beamLen - 0.08);
    flash = Math.max(0, flash - 0.06);
    if (fireOn && Math.random() < 0.08) flash = Math.max(flash, 0.5);

    if (beamLen > 0) {
      const m = mouthWorld();
      for (let n = 0; n < 10; n++) {
        const a = m.a + (Math.random() - 0.5) * 0.35, v = 8 + Math.random() * 12;
        sparks.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 1 + Math.random() * 2.5, life: 1, d: 0.025 + Math.random() * 0.02 });
      }
    }

    // sparks jumping off the body, with the odd crackle sound
    const ei = 2 + Math.floor(Math.random() * (N - 10));
    const sx0 = pts[ei].x * FS, sy0 = pts[ei].y * FS;
    if (side < 0.5 && sx0 > -50 && sx0 < W + 50 && sy0 > -50 && sy0 < H + 50 && Math.random() < 0.6) {
      const a = Math.random() * TAU;
      sparks.push({ x: sx0, y: sy0, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 - 0.5, s: 0.8 + Math.random() * 1.6, life: 1, d: 0.04 });
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const e = sparks[i];
      e.x += e.vx; e.y += e.vy;
      e.vx *= 0.95; e.vy = e.vy * 0.95 + 0.04;
      e.life -= e.d;
      if (e.life <= 0) sparks.splice(i, 1);
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 2.4; rp.life -= 0.016;
      if (rp.life <= 0) ripples.splice(i, 1);
    }
  }

  // ---------- lightning helpers ----------
  function boltPath(x1: number, y1: number, x2: number, y2: number, disp: number): V[] {
    let p: V[] = [[x1, y1], [x2, y2]];
    for (let k = 0; k < 6; k++) {
      const out: V[] = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, ay] = p[i], [bx, by] = p[i + 1];
        const dx = bx - ax, dy = by - ay, m = Math.hypot(dx, dy) || 1;
        const off = (Math.random() - 0.5) * disp;
        out.push([(ax + bx) / 2 - dy / m * off, (ay + by) / 2 + dx / m * off], p[i + 1]);
      }
      p = out; disp *= 0.55;
    }
    return p;
  }

  function drawBolt(p: V[], w: number, a = 1) {
    ctx.save();
    ctx.globalCompositeOperation = add;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = () => { ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); };
    ctx.shadowColor = `rgba(${GLOW},1)`; ctx.shadowBlur = 18;
    line(); ctx.strokeStyle = `rgba(${GLOW},${(0.45 * a).toFixed(3)})`; ctx.lineWidth = w * 3.5; ctx.stroke();
    ctx.shadowBlur = 0;
    line(); ctx.strokeStyle = lightBg ? `rgba(40,140,255,${a.toFixed(3)})` : `rgba(235,250,255,${a.toFixed(3)})`; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }

  // ---------- bone drawing helpers ----------
  // every bone is drawn as a dark outline with a bone-white core and a faint electric glow
  function bone(p: V[], w: number, glow = true) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = () => { ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); };
    if (glow) { ctx.save(); ctx.shadowColor = `rgba(${GLOW},0.7)`; ctx.shadowBlur = 10; }
    line(); ctx.strokeStyle = LINE; ctx.lineWidth = w + 2.4; ctx.stroke();
    if (glow) ctx.restore();
    line(); ctx.strokeStyle = BONE; ctx.lineWidth = w; ctx.stroke();
    if (w > 3) { line(); ctx.strokeStyle = BONE_SH; ctx.lineWidth = w * 0.35; ctx.stroke(); }
  }
  function joint(x: number, y: number, r: number) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = BONE; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.2; ctx.stroke();
  }
  function fillBone(path: () => void) {
    ctx.save(); ctx.shadowColor = `rgba(${GLOW},0.6)`; ctx.shadowBlur = 12;
    path(); ctx.fillStyle = BONE; ctx.fill();
    ctx.restore();
    path(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.3; ctx.stroke();
  }
  function claws(x: number, y: number, a: number, len: number) {
    for (const o of [-0.5, 0, 0.5]) {
      bone([[x, y], [x + Math.cos(a + o) * len * 0.6, y + Math.sin(a + o) * len * 0.6], [x + Math.cos(a + o * 1.5) * len, y + Math.sin(a + o * 1.5) * len]], 1.6, false);
    }
  }

  // little arcs of electricity crawling over the bones
  function bodyArcs(poly: V[], count: number, reach: number, w: number) {
    for (let k = 0; k < count; k++) {
      const i = Math.floor(Math.random() * (poly.length - 4));
      const a = poly[i], b = poly[Math.min(i + 2 + Math.floor(Math.random() * 3), poly.length - 1)];
      const ox = (Math.random() - 0.5) * reach, oy = (Math.random() - 0.5) * reach;
      drawBolt(boltPath(a[0] + ox, a[1] + oy, b[0] - ox, b[1] - oy, reach), w, 0.7);
    }
  }

  function spadeTip() {
    fillBone(() => {
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.bezierCurveTo(-8, 12, -18, 6, -14, -4); ctx.bezierCurveTo(-11, -11, -3, -10, -1, -5);
      ctx.lineTo(-3, -12); ctx.lineTo(3, -12); ctx.lineTo(1, -5);
      ctx.bezierCurveTo(3, -10, 11, -11, 14, -4); ctx.bezierCurveTo(18, 6, 8, 12, 0, 22);
    });
  }

  // ---------- flying skeleton (seen from above, model units) ----------
  const vw = (i: number) => 11 * Math.pow(1 - i / N, 0.8) + 2.5;

  function drawWing(i: number, s: number) {
    const p = pts[i], a = ang(i);
    const flap = Math.sin(t * 3 + (s > 0 ? 0 : 0.3)) * (1 - land);
    const wa = a + s * (1.35 + flap * 0.45 + land * 1.05);
    const el = 85 - land * 25;
    const ex = p.x + Math.cos(wa) * el, ey = p.y + Math.sin(wa) * el;
    const back = a + Math.PI - s * (0.35 - land * 0.2);
    const tips: V[] = [130, 112, 90, 66].map((l, k) => {
      const f = (k + 1) / 4.5;
      const vx = Math.cos(wa) * (1 - f) + Math.cos(back) * f, vy = Math.sin(wa) * (1 - f) + Math.sin(back) * f;
      const m = Math.hypot(vx, vy) || 1, ll = l * (1 - land * 0.45);
      return [ex + vx / m * ll, ey + vy / m * ll];
    });
    const root = pts[i + 13];
    // faint, tattered membrane between the finger bones
    ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey);
    tips.forEach((q, k) => {
      const prev = k === 0 ? [ex, ey] : tips[k - 1];
      ctx.quadraticCurveTo((prev[0] + q[0]) / 2 - Math.cos(a) * 18, (prev[1] + q[1]) / 2 - Math.sin(a) * 18, q[0], q[1]);
    });
    ctx.quadraticCurveTo((tips[3][0] + root.x) / 2 - Math.cos(a) * 10, (tips[3][1] + root.y) / 2 - Math.sin(a) * 10, root.x, root.y);
    ctx.closePath();
    ctx.fillStyle = MEMB; ctx.fill();
    // arm and finger bones
    bone([[p.x, p.y], [ex, ey]], 5);
    tips.forEach(q => bone([[ex, ey], q], 2.4));
    joint(ex, ey, 4.5);
    tips.forEach(q => joint(q[0], q[1], 1.8));
    bone([[ex, ey], [ex + Math.cos(wa + s * 0.5) * 13, ey + Math.sin(wa + s * 0.5) * 13]], 2, false);
  }

  function drawLeg(L: typeof legs[number]) {
    const b = pts[L.k], dx = L.fx - b.x, dy = L.fy - b.y;
    const d = Math.min(Math.hypot(dx, dy), LEG * 2 - 0.5), th = Math.atan2(dy, dx);
    const k = th - L.s * Math.acos(d / (2 * LEG));
    const kx = b.x + Math.cos(k) * LEG, ky = b.y + Math.sin(k) * LEG;
    const fx = b.x + Math.cos(th) * d, fy = b.y + Math.sin(th) * d;
    bone([[b.x, b.y], [kx, ky]], 5);
    bone([[kx, ky], [fx, fy]], 4);
    joint(kx, ky, 4);
    claws(fx, fy, ang(L.k), 12);
  }

  function drawSkullTop() {
    const h = pts[0];
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(ang(1));
    for (const s of [-1, 1]) {
      bone([[-8, s * 10], [-26, s * 24], [-52, s * 27]], 3.5);
      bone([[-12, s * 6], [-26, s * 12], [-40, s * 10]], 2.2);
    }
    fillBone(() => {
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.bezierCurveTo(-18, -18, 6, -18, 16, -11);
      ctx.quadraticCurveTo(40, -8, 56, -3); ctx.quadraticCurveTo(60, 0, 56, 3);
      ctx.quadraticCurveTo(40, 8, 16, 11);
      ctx.bezierCurveTo(6, 18, -18, 18, -18, 0);
    });
    // ridge, nostrils and eye sockets
    ctx.strokeStyle = BONE_SH; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(48, 0); ctx.stroke();
    ctx.fillStyle = SOCKET;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(50, s * 3, 2.6, 1.3, 0, 0, TAU); ctx.fill(); }
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(6, s * 8, 7, 4.5, s * 0.25, 0, TAU); ctx.fill(); }
    ctx.shadowColor = `rgba(${EYE},1)`; ctx.shadowBlur = 20;
    ctx.fillStyle = `rgba(${EYE},1)`;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(7, s * 8, 2.6, 1.6, s * 0.25, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  function drawFlying(topA: number, partA: number) {
    ctx.save();
    ctx.scale(FS, FS);
    const poly = pts.map(p => [p.x, p.y]);

    ctx.globalAlpha = partA;
    legs.forEach(drawLeg);
    drawWing(9, 1); drawWing(9, -1);

    // ribcage
    for (let i = 5; i <= 26; i++) {
      const p = pts[i], a = ang(i), len = 10 + 34 * Math.sin(Math.PI * (i - 5) / 21);
      for (const s of [-1, 1]) {
        const n = a + s * Math.PI / 2;
        bone([
          [p.x, p.y],
          [p.x + Math.cos(n) * len * 0.75 + Math.cos(a) * 3, p.y + Math.sin(n) * len * 0.75 + Math.sin(a) * 3],
          [p.x + Math.cos(n) * len - Math.cos(a) * len * 0.45, p.y + Math.sin(n) * len - Math.sin(a) * len * 0.45],
        ], 2, false);
      }
    }

    ctx.globalAlpha = topA;
    // spine and vertebrae
    bone(poly.slice(1), 3);
    for (let i = 1; i < N; i++) {
      const p = pts[i], a = ang(i), w = vw(i) * 0.5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      fillBone(() => {
        ctx.beginPath();
        ctx.moveTo(w + 3, 0); ctx.lineTo(0, -w); ctx.lineTo(-w - 2, 0); ctx.lineTo(0, w); ctx.closePath();
      });
      ctx.restore();
    }

    const tl = pts[N - 1];
    ctx.save();
    ctx.translate(tl.x, tl.y); ctx.rotate(ang(N - 1) - Math.PI / 2); ctx.scale(1.3, 1.3);
    spadeTip();
    ctx.restore();

    drawSkullTop();
    if (topA > 0.3 && Math.random() < 0.5) bodyArcs(poly, 1, 24, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- standing skeleton (side view, model units inside the SS transform) ----------
  function legSide() {
    const st = Math.sin(t * 2);
    // hind leg: pelvis -> knee -> ankle -> toes
    const hp: V[] = [[-62, -86], [-30, -52 + st], [-60, -20], [-44, -3]];
    bone([hp[0], hp[1]], 7); bone([hp[1], hp[2]], 5.5); bone([hp[2], hp[3]], 4);
    joint(hp[1][0], hp[1][1], 5); joint(hp[2][0], hp[2][1], 4);
    claws(-44, -3, 0.15, 13);
    // front leg: shoulder -> elbow -> wrist -> toes
    const fp: V[] = [[44, -84], [34, -50 + st], [52, -16], [66, -3]];
    bone([fp[0], fp[1]], 6); bone([fp[1], fp[2]], 4.5); bone([fp[2], fp[3]], 3.5);
    joint(fp[1][0], fp[1][1], 4.5); joint(fp[2][0], fp[2][1], 3.5);
    claws(66, -3, 0.15, 12);
  }

  function wingSide(r: number, br: number) {
    const L = (a: V, b: V) => [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r + br];
    const S = [36, -104], E = L([18, -152], [6, -208]), Wr = L([-72, -164], [-70, -266]);
    const tips = [L([-152, -118], [-204, -222]), L([-130, -100], [-178, -150]), L([-100, -96], [-128, -112])];
    const root = [-50, -104 + br];
    ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(Wr[0], Wr[1]);
    tips.forEach((p, k) => {
      const prev = k ? tips[k - 1] : Wr;
      ctx.quadraticCurveTo((prev[0] + p[0]) / 2 + 12, (prev[1] + p[1]) / 2 + 14, p[0], p[1]);
    });
    ctx.quadraticCurveTo((tips[2][0] + root[0]) / 2, (tips[2][1] + root[1]) / 2 + 10, root[0], root[1]);
    ctx.closePath();
    ctx.fillStyle = MEMB; ctx.fill();
    bone([S, E], 6); bone([E, Wr], 4.5);
    tips.forEach(p => bone([Wr, p], 2.4));
    joint(E[0], E[1], 5); joint(Wr[0], Wr[1], 4);
    tips.forEach(p => joint(p[0], p[1], 1.8));
    bone([Wr, [Wr[0] + 10, Wr[1] - 13]], 2, false);
  }

  function headSide(P: ReturnType<typeof pose>) {
    ctx.save(); ctx.translate(P.Hx, P.Hy); ctx.rotate(P.ha);
    // horns
    bone([[-6, -14], [-34, -34], [-70, -30], [-86, -12]], 5.5);
    bone([[2, -18], [-12, -46], [-30, -66], [-26, -78]], 4);
    bone([[-10, -8], [-32, -14], [-52, -2]], 3);
    bone([[10, -20], [6, -36], [-2, -46]], 2.6);
    bone([[-12, 8], [-26, 18], [-40, 20]], 2.4);

    // inside of the mouth glows while the beam charges
    if (P.jo > 0.15) {
      ctx.save();
      ctx.shadowColor = `rgba(${GLOW},1)`; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(60, 4);
      ctx.lineTo(-4 + Math.cos(P.jo) * 62, 6 + Math.sin(P.jo) * 62); ctx.closePath();
      ctx.fillStyle = `rgba(210,245,255,${(0.35 + 0.6 * pf).toFixed(3)})`; ctx.fill();
      ctx.restore();
    }

    // lower jaw (hinged)
    ctx.save(); ctx.translate(-6, 6); ctx.rotate(P.jo);
    fillBone(() => {
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(30, -2, 60, 0); ctx.lineTo(62, 4); ctx.quadraticCurveTo(30, 11, 4, 12); ctx.closePath();
    });
    ctx.fillStyle = BONE; ctx.strokeStyle = LINE; ctx.lineWidth = 0.8;
    for (let x = 16; x <= 52; x += 7) { ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x + 2, x === 23 || x === 44 ? -18 : -9); ctx.lineTo(x + 4, -1); ctx.fill(); ctx.stroke(); }
    ctx.restore();

    // skull and upper jaw
    fillBone(() => {
      ctx.beginPath();
      ctx.moveTo(-18, 4);
      ctx.bezierCurveTo(-20, -14, -4, -24, 14, -20);
      ctx.quadraticCurveTo(40, -12, 66, -4); ctx.quadraticCurveTo(72, 0, 66, 5);
      ctx.quadraticCurveTo(36, 8, 18, 8);
      ctx.bezierCurveTo(4, 14, -14, 14, -18, 4);
    });
    // cheekbone, brow and teeth
    ctx.strokeStyle = BONE_SH; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-10, 2); ctx.quadraticCurveTo(10, -2, 30, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(14, -20, 26, -13); ctx.stroke();
    ctx.fillStyle = BONE; ctx.strokeStyle = LINE; ctx.lineWidth = 0.8;
    for (let x = 24; x <= 58; x += 7) { ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x + 2, x === 31 || x === 52 ? 22 : 14); ctx.lineTo(x + 4, 6); ctx.fill(); ctx.stroke(); }
    // nasal opening and eye socket with a glowing pupil
    ctx.fillStyle = SOCKET;
    ctx.beginPath(); ctx.ellipse(60, -2, 4, 2, -0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -8, 8.5, 6, -0.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6, -4, 4, 5, 0, 0, TAU); ctx.fill();
    ctx.shadowColor = `rgba(${EYE},1)`; ctx.shadowBlur = 28;
    ctx.fillStyle = `rgba(${EYE},1)`;
    ctx.beginPath(); ctx.ellipse(12, -8, 4, 2.8, -0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,1)';
    ctx.beginPath(); ctx.ellipse(13, -8, 1.4, 1.1, -0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${EYE},0.75)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(4, -9); ctx.lineTo(-22 - Math.sin(t * 9) * 4, -13); ctx.stroke();
    ctx.restore();
  }

  function drawSide() {
    const P = pose();
    const jx = shake ? (Math.random() - 0.5) * 8 * shake : 0, jy = shake ? (Math.random() - 0.5) * 8 * shake : 0;
    const raise = Math.max(pw, pf);
    ctx.save();
    ctx.globalAlpha = side;
    ctx.translate(SX + jx, SY + jy); ctx.scale(face * SS, SS);

    ctx.beginPath(); ctx.ellipse(-30, 2, 200, 9, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();

    // far wing and legs, dimmed behind the body
    ctx.save(); ctx.translate(18, -10); ctx.globalAlpha = side * 0.45;
    wingSide(raise, P.br); legSide();
    ctx.restore();

    const all = [...P.tail, ...P.body.slice(1), ...P.neck.slice(1)];
    const n = all.length;

    // ribs hanging from the back, joined by the sternum
    const ribEnds: V[] = [];
    P.body.forEach((p, k) => {
      if (k < 1 || k > 9) return;
      const Lr = 26 + 34 * Math.sin(Math.PI * k / 10) + P.br;
      bone([[p[0], p[1]], [p[0] - 10, p[1] + Lr * 0.55], [p[0] + 8, p[1] + Lr]], 2.4, false);
      ribEnds.push([p[0] + 8, p[1] + Lr]);
    });
    bone(ribEnds, 2.6, false);

    // pelvis and shoulder blade
    fillBone(() => { ctx.beginPath(); ctx.ellipse(-62, -86, 20, 10, -0.35, 0, TAU); });
    ctx.fillStyle = SOCKET; ctx.beginPath(); ctx.ellipse(-64, -86, 6, 4, -0.35, 0, TAU); ctx.fill();
    fillBone(() => { ctx.beginPath(); ctx.ellipse(44, -88, 8, 17, 0.4, 0, TAU); });

    legSide();

    // spine with vertebrae and spinous processes
    bone(all, 3);
    all.forEach((p, i) => {
      const q = i / n;
      const r = q < 0.4 ? 2 + q * 10 : q < 0.75 ? 6 : 6 - (q - 0.75) * 8;
      const a2 = all[Math.min(i + 1, n - 1)], o = all[Math.max(i - 1, 0)];
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.atan2(a2[1] - o[1], a2[0] - o[0]));
      fillBone(() => {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(-r * 1.6, -r - r * 3.4); ctx.lineTo(r * 0.5, -r * 0.5);
        ctx.lineTo(r + 1, 0); ctx.lineTo(r * 0.5, r * 0.6); ctx.lineTo(-r * 0.8, r * 0.6); ctx.lineTo(-r - 1, 0);
        ctx.closePath();
      });
      ctx.restore();
    });

    const t0 = P.tail[0], t1 = P.tail[1];
    ctx.save(); ctx.translate(t0[0], t0[1]); ctx.rotate(Math.atan2(t0[1] - t1[1], t0[0] - t1[0]) - Math.PI / 2);
    spadeTip();
    ctx.restore();

    wingSide(raise, P.br);
    headSide(P);

    // electricity crackling over the bones, more while it fires
    bodyArcs(all, pf > 0.3 ? 4 : 1, 28, 1.1);
    ctx.restore();
  }

  // the lightning beam
  function drawBeam() {
    if (beamLen <= 0) return;
    const m = mouthWorld();
    const L = (W * 1.15) * ease(beamLen);
    const ex = m.x + Math.cos(m.a) * L, ey = m.y + Math.sin(m.a) * L;
    const w = 4 + 6 * SS * beamLen;

    // wide plasma glow around the beam
    ctx.save();
    ctx.globalCompositeOperation = add;
    const g = ctx.createLinearGradient(m.x, m.y, ex, ey);
    g.addColorStop(0, `rgba(${GLOW},${(0.35 * beamLen).toFixed(3)})`);
    g.addColorStop(1, `rgba(${GLOW},0)`);
    ctx.strokeStyle = g; ctx.lineCap = 'round';
    ctx.lineWidth = w * 6; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.restore();

    // twin main bolts plus forks that jump off them
    for (let k = 0; k < 2; k++) {
      const main = boltPath(m.x, m.y, ex, ey, 70 * SS);
      drawBolt(main, k ? w * 0.5 : w, beamLen);
      for (let b = 0; b < 3; b++) {
        const p = main[Math.floor(main.length * (0.2 + Math.random() * 0.7))];
        const ba = m.a + (Math.random() - 0.5) * 1.4, bl = 60 + Math.random() * 180 * SS;
        drawBolt(boltPath(p[0], p[1], p[0] + Math.cos(ba) * bl, p[1] + Math.sin(ba) * bl, 40), w * 0.35, beamLen * 0.9);
      }
    }

    // white-hot glow at the mouth
    ctx.save();
    ctx.globalCompositeOperation = add;
    const rg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 130 * SS);
    rg.addColorStop(0, `rgba(${lightBg ? '60,150,255' : '230,250,255'},${(0.7 * beamLen).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(m.x, m.y, 130 * SS, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const dark = Math.max(side, beamLen) * 0.62;
    if (dark > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.15, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, `rgba(0,0,0,${(dark * 0.5).toFixed(3)})`);
      vg.addColorStop(1, `rgba(0,0,0,${dark.toFixed(3)})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    for (const mp of mist) {
      const mg = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, mp.r);
      mg.addColorStop(0, `rgba(6,4,12,${(0.4 * mp.life).toFixed(3)})`);
      mg.addColorStop(1, 'rgba(6,4,12,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mp.x, mp.y, mp.r, 0, TAU); ctx.fill();
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(${lightBg ? '40,120,255' : '170,225,255'},${(flash * 0.12).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    for (const rp of ripples) {
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.55, 0, 0, TAU);
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${GLOW},${(rp.life * 0.6).toFixed(3)})`; ctx.stroke();
    }

    const m = ease(Math.min(1, land / 0.6));
    let saved: V[] | null = null;
    if (m > 0) {
      const target = sideSpine(N);
      saved = pts.map(p => [p.x, p.y]);
      pts.forEach((p, i) => { p.x += (target[i][0] - p.x) * m; p.y += (target[i][1] - p.y) * m; });
    }
    if (side < 1) drawFlying(1 - side, (1 - side) * (1 - m));
    if (saved) pts.forEach((p, i) => { p.x = saved![i][0]; p.y = saved![i][1]; });

    if (side > 0) drawSide();
    drawBeam();

    ctx.save();
    ctx.globalCompositeOperation = add;
    ctx.shadowColor = `rgba(${GLOW},1)`; ctx.shadowBlur = 8;
    for (const e of sparks) {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, TAU);
      ctx.fillStyle = `rgba(${lightBg ? '40,140,255' : '210,245,255'},${(0.9 * e.life).toFixed(3)})`; ctx.fill();
    }
    ctx.restore();
  }

  const gone = () => pts.every(p => p.x * FS > W + 200 || p.y * FS < -200 || p.x * FS < -200);

  function frame() {
    update(); draw();
    if (phase === 'out' && gone() && sparks.length === 0) {
      canvas.remove();
     
      active = false;
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
