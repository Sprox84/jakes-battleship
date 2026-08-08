(function () {
  'use strict';

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion() ? 10 : ms));
  let audio;

  function layer(stage) {
    let el = stage.querySelector('.combatFxLayer');
    if (!el) {
      el = document.createElement('div');
      el.className = 'combatFxLayer';
      stage.appendChild(el);
    }
    return el;
  }

  function geometry(stage, cell) {
    const sr = stage.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    return {
      x: cr.left - sr.left + cr.width / 2,
      y: cr.top - sr.top + cr.height / 2,
      size: Math.max(cr.width, cr.height),
      width: sr.width,
      height: sr.height
    };
  }

  function target(stage, cell) {
    const g = geometry(stage, cell);
    const el = document.createElement('span');
    el.className = 'fxTarget';
    el.style.left = `${g.x - g.size * .42}px`;
    el.style.top = `${g.y - g.size * .42}px`;
    el.style.width = `${g.size * .84}px`;
    el.style.height = `${g.size * .84}px`;
    layer(stage).appendChild(el);
    return el;
  }

  function shell(stage, cell, enemy) {
    const g = geometry(stage, cell);
    const startX = enemy ? g.width * .12 : g.width * .5;
    const startY = enemy ? -g.size : g.height + g.size;
    const dx = g.x - startX;
    const dy = g.y - startY;
    const el = document.createElement('span');
    el.className = 'fxShell';
    el.style.setProperty('--start-x', `${startX}px`);
    el.style.setProperty('--start-y', `${startY}px`);
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.style.setProperty('--angle', `${Math.atan2(dy, dx) * 180 / Math.PI + 90}deg`);
    layer(stage).appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function impact(stage, cell, hit, sunk = false) {
    const g = geometry(stage, cell);
    if (window.NavalFX) {
      window.NavalFX.impact(stage, cell, { hit, sunk });
      if (hit) {
        stage.classList.remove('fxShake');
        void stage.offsetWidth;
        stage.classList.add('fxShake');
        setTimeout(() => stage.classList.remove('fxShake'), 420);
      }
      return;
    }
    const el = document.createElement('span');
    el.className = `fxImpact ${hit ? 'hit' : 'miss'}`;
    el.style.setProperty('--x', `${g.x}px`);
    el.style.setProperty('--y', `${g.y}px`);
    el.style.setProperty('--size', `${g.size * (hit ? 1.65 : 1.25)}px`);
    layer(stage).appendChild(el);
    if (hit) {
      stage.classList.remove('fxShake');
      void stage.offsetWidth;
      stage.classList.add('fxShake');
      setTimeout(() => stage.classList.remove('fxShake'), 420);
    }
    setTimeout(() => el.remove(), 1100);
  }

  function sound(kind, enabled) {
    if (!enabled) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const frequencies = { launch: [110, 48], hit: [82, 36], miss: [260, 95], sunk: [70, 28] };
      const [start, end] = frequencies[kind] || frequencies.hit;
      oscillator.type = kind === 'miss' ? 'sine' : 'sawtooth';
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(end, now + (kind === 'sunk' ? .8 : .3));
      gain.gain.setValueAtTime(kind === 'launch' ? .075 : .1, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + (kind === 'sunk' ? .9 : .38));
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === 'sunk' ? .9 : .4));

      if (kind === 'hit' || kind === 'miss') {
        const length = Math.floor(audio.sampleRate * .36);
        const buffer = audio.createBuffer(1, length, audio.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, kind === 'hit' ? 2 : 1.2);
        const noise = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const noiseGain = audio.createGain();
        noise.buffer = buffer;
        filter.type = kind === 'hit' ? 'lowpass' : 'bandpass';
        filter.frequency.value = kind === 'hit' ? 520 : 1250;
        noiseGain.gain.value = kind === 'hit' ? .16 : .1;
        noise.connect(filter).connect(noiseGain).connect(audio.destination);
        noise.start(now);
      }
    } catch (_) {}
  }

  async function fire({ stage, cell, shipLayer, sound: soundEnabled, enemy = false, resolve }) {
    const lock = target(stage, cell);
    sound('launch', soundEnabled);
    await wait(280);
    shell(stage, cell, enemy);
    await wait(285);
    lock.remove();
    const result = resolve();
    if (result.cancelled) return result;
    impact(stage, cell, result.hit, result.sunk);
    sound(result.hit ? 'hit' : 'miss', soundEnabled);
    if (result.sunk && result.ship) {
      await wait(100);
      const vessel = shipLayer.querySelector(`[data-id="${result.ship.id}"]`);
      vessel?.classList.add('sinkingNow');
      sound('sunk', soundEnabled);
      await wait(1400);
    } else {
      await wait(result.hit ? 650 : 780);
    }
    return result;
  }

  window.CombatFX = { fire };
})();
