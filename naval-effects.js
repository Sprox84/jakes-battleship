(function () {
  'use strict';

  const states = new WeakMap();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const random = (min, max) => min + Math.random() * (max - min);

  function stateFor(stage) {
    let state = states.get(stage);
    if (state) return state;

    const canvas = document.createElement('canvas');
    canvas.className = 'navalFxCanvas';
    stage.appendChild(canvas);
    state = {
      stage,
      canvas,
      ctx: canvas.getContext('2d'),
      width: 0,
      height: 0,
      dpr: 1,
      particles: [],
      ripples: [],
      flashes: [],
      emitters: [],
      frame: 0,
      last: performance.now()
    };
    states.set(stage, state);
    resize(state);
    return state;
  }

  function resize(state) {
    const rect = state.stage.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (state.width === width && state.height === height && state.dpr === dpr) return;
    state.width = width;
    state.height = height;
    state.dpr = dpr;
    state.canvas.width = Math.round(width * dpr);
    state.canvas.height = Math.round(height * dpr);
    state.canvas.style.width = `${width}px`;
    state.canvas.style.height = `${height}px`;
  }

  function point(stage, cell) {
    const sr = stage.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    return {
      x: cr.left - sr.left + cr.width / 2,
      y: cr.top - sr.top + cr.height / 2,
      size: Math.max(cr.width, cr.height)
    };
  }

  function particle(type, x, y, size, overrides = {}) {
    const presets = {
      smoke: { life: random(1100, 2100), vx: random(-.18, .28), vy: random(-.75, -.3), drag: .992, gravity: -.002 },
      fire: { life: random(280, 680), vx: random(-.24, .24), vy: random(-.5, -.16), drag: .985, gravity: -.004 },
      spark: { life: random(260, 620), vx: random(-2.8, 2.8), vy: random(-3.1, .4), drag: .976, gravity: .075 },
      debris: { life: random(700, 1350), vx: random(-1.6, 1.6), vy: random(-2.3, -.2), drag: .986, gravity: .065 },
      water: { life: random(520, 980), vx: random(-1.5, 1.5), vy: random(-3.7, -1.1), drag: .982, gravity: .105 }
    };
    return {
      type,
      x,
      y,
      size,
      age: 0,
      rotation: random(0, Math.PI * 2),
      spin: random(-.12, .12),
      ...presets[type],
      ...overrides
    };
  }

  function smoke(state, x, y, size, heavy = false) {
    const edgeDrift = y < state.height * .22 ? .24 : -.42;
    state.particles.push(particle('smoke', x + random(-size * .18, size * .18), y + random(-size * .08, size * .08), random(size * .2, size * (heavy ? .52 : .4)), {
      life: random(heavy ? 1700 : 1100, heavy ? 3000 : 2200),
      vy: random(edgeDrift - (heavy ? .22 : .14), edgeDrift + .16),
      vx: random(.08, heavy ? .58 : .42)
    }));
  }

  function flame(state, x, y, size) {
    state.particles.push(particle('fire', x + random(-size * .16, size * .16), y + random(-size * .1, size * .1), random(size * .1, size * .26)));
  }

  function start(state) {
    if (state.frame) return;
    state.last = performance.now();
    state.frame = requestAnimationFrame(time => tick(state, time));
  }

  function impact(stage, cell, { hit, sunk = false } = {}) {
    const state = stateFor(stage);
    resize(state);
    const p = point(stage, cell);
    const countScale = reduced() ? .22 : 1;
    const now = performance.now();

    state.flashes.push({ x: p.x, y: p.y, size: p.size * (hit ? 1.25 : .8), age: 0, life: hit ? 360 : 240, hit });
    state.ripples.push({ x: p.x, y: p.y, size: p.size * .2, age: 0, life: hit ? 1150 : 1450, power: hit ? .8 : 1.15 });
    state.ripples.push({ x: p.x, y: p.y, size: p.size * .1, age: -180, life: hit ? 1000 : 1300, power: .65 });

    if (hit) {
      for (let i = 0; i < Math.ceil(16 * countScale); i++) flame(state, p.x, p.y, p.size);
      for (let i = 0; i < Math.ceil(12 * countScale); i++) smoke(state, p.x, p.y, p.size, sunk);
      for (let i = 0; i < Math.ceil(22 * countScale); i++) state.particles.push(particle('spark', p.x, p.y, random(1, 2.4)));
      for (let i = 0; i < Math.ceil(11 * countScale); i++) state.particles.push(particle('debris', p.x, p.y, random(1.2, 3.2)));
      state.emitters.push({
        x: p.x,
        y: p.y,
        size: p.size,
        end: now + (sunk ? 11500 : 5200),
        nextSmoke: now + 120,
        nextFire: now + 80,
        heavy: sunk
      });
    } else {
      for (let i = 0; i < Math.ceil(34 * countScale); i++) {
        const angle = random(-Math.PI * .88, -.12);
        const speed = random(1.2, 4.4);
        state.particles.push(particle('water', p.x, p.y, random(1.5, 4), {
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed
        }));
      }
    }
    start(state);
  }

  function updateEmitters(state, now) {
    state.emitters = state.emitters.filter(emitter => {
      if (now >= emitter.end) return false;
      if (now >= emitter.nextSmoke) {
        smoke(state, emitter.x, emitter.y, emitter.size, emitter.heavy);
        if (emitter.heavy && Math.random() > .45) smoke(state, emitter.x, emitter.y, emitter.size, true);
        emitter.nextSmoke = now + random(emitter.heavy ? 75 : 120, emitter.heavy ? 145 : 220);
      }
      if (now >= emitter.nextFire) {
        flame(state, emitter.x, emitter.y, emitter.size * (emitter.heavy ? 1.1 : .82));
        emitter.nextFire = now + random(90, 190);
      }
      return true;
    });
  }

  function drawFlash(ctx, flash) {
    const t = Math.max(0, flash.age / flash.life);
    const radius = flash.size * (.18 + t * 1.15);
    const gradient = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
    if (flash.hit) {
      gradient.addColorStop(0, `rgba(255,250,214,${1 - t})`);
      gradient.addColorStop(.18, `rgba(255,194,69,${.95 * (1 - t)})`);
      gradient.addColorStop(.48, `rgba(235,69,28,${.72 * (1 - t)})`);
    } else {
      gradient.addColorStop(0, `rgba(239,252,255,${.72 * (1 - t)})`);
      gradient.addColorStop(.42, `rgba(149,216,237,${.36 * (1 - t)})`);
    }
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRipple(ctx, ripple) {
    if (ripple.age < 0) return;
    const t = ripple.age / ripple.life;
    const radius = ripple.size + ripple.size * 3.8 * t;
    ctx.strokeStyle = `rgba(221,246,246,${(1 - t) * .7 * ripple.power})`;
    ctx.lineWidth = Math.max(.5, 2.2 * (1 - t));
    ctx.beginPath();
    ctx.ellipse(ripple.x, ripple.y, radius, radius * .45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawParticle(ctx, p) {
    const t = p.age / p.life;
    const alpha = Math.max(0, 1 - t);
    if (p.type === 'smoke') {
      const radius = p.size * (.7 + t * 1.7);
      const gradient = ctx.createRadialGradient(p.x - radius * .18, p.y - radius * .2, radius * .08, p.x, p.y, radius);
      gradient.addColorStop(0, `rgba(39,39,35,${alpha * .94})`);
      gradient.addColorStop(.48, `rgba(18,20,19,${alpha * .84})`);
      gradient.addColorStop(1, 'rgba(5,7,7,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p.type === 'fire') {
      const radius = p.size * (1 - t * .42);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, `rgba(255,247,177,${alpha})`);
      gradient.addColorStop(.24, `rgba(255,174,48,${alpha * .95})`);
      gradient.addColorStop(.62, `rgba(221,52,19,${alpha * .72})`);
      gradient.addColorStop(1, 'rgba(74,14,8,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    if (p.type === 'spark') {
      ctx.strokeStyle = `rgba(255,${Math.round(143 + 80 * (1 - t))},52,${alpha})`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(-p.vx * 2.8, -p.vy * 2.8);
      ctx.lineTo(0, 0);
      ctx.stroke();
    } else if (p.type === 'water') {
      ctx.strokeStyle = `rgba(231,250,255,${alpha * .88})`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 2.6);
      ctx.lineTo(0, p.size * 1.2);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(43,31,23,${alpha})`;
      ctx.fillRect(-p.size, -p.size * .35, p.size * 2, p.size * .7);
    }
    ctx.restore();
  }

  function tick(state, now) {
    resize(state);
    const dt = Math.min(2.5, Math.max(.35, (now - state.last) / 16.667));
    state.last = now;
    updateEmitters(state, now);

    const ctx = state.ctx;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);

    ctx.globalCompositeOperation = 'source-over';
    state.ripples.forEach(ripple => {
      ripple.age += dt * 16.667;
      drawRipple(ctx, ripple);
    });
    state.ripples = state.ripples.filter(ripple => ripple.age < ripple.life);

    ctx.globalCompositeOperation = 'lighter';
    state.flashes.forEach(flash => {
      flash.age += dt * 16.667;
      drawFlash(ctx, flash);
    });
    state.flashes = state.flashes.filter(flash => flash.age < flash.life);

    state.particles.forEach(p => {
      p.age += dt * 16.667;
      p.vx *= Math.pow(p.drag, dt);
      p.vy = p.vy * Math.pow(p.drag, dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    });

    ctx.globalCompositeOperation = 'source-over';
    state.particles.filter(p => p.type === 'smoke' || p.type === 'debris' || p.type === 'water').forEach(p => drawParticle(ctx, p));
    ctx.globalCompositeOperation = 'lighter';
    state.particles.filter(p => p.type === 'fire' || p.type === 'spark').forEach(p => drawParticle(ctx, p));
    state.particles = state.particles.filter(p => p.age < p.life);
    ctx.globalCompositeOperation = 'source-over';

    if (state.particles.length || state.ripples.length || state.flashes.length || state.emitters.length) {
      state.frame = requestAnimationFrame(time => tick(state, time));
    } else {
      state.frame = 0;
      ctx.clearRect(0, 0, state.width, state.height);
    }
  }

  window.NavalFX = { impact };
})();
