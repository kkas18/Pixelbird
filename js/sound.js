/* Pixelfugl – Lyd og musikk (Web Audio, alt syntetisert).
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   LYD + MUSIKK (Web Audio, alt syntetisert)
   Koselig lydbilde: spilledåse, myk pad og rund bass i F-dur (88 BPM),
   myke lydeffekter, og naturlyder (fuglekvitter/vind om dagen,
   sirisser/ugle om kvelden). Felles etterklang og en begrenser
   (kompressor) på slutten hindrer klipping når mange lyder overlapper.
   ============================================================ */
const Sound = (() => {
  let ac = null, master, sfxGain, musGain, musFilter, ambGain, reverb, musSend, sfxSend, noiseBuf;
  let sfxMuted = store.get('pf.muted') === '1';
  let musMuted = store.get('pf.music') === '1';
  let night = false;
  const MUS_VOL = 0.5, AMB_VOL = 0.55;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // syntetisk romklang: stereo støy som dør ut eksponentielt (~2 s), litt mørkere mot slutten
  function makeReverb() {
    const len = Math.floor(ac.sampleRate * 2.2), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.9 - t * 0.6); d[i] = lp * Math.pow(1 - t, 3.2); }
    }
    const c = ac.createConvolver(); c.buffer = buf; return c;
  }
  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
      master = ac.createGain(); master.gain.value = 1; master.connect(limiter).connect(ac.destination);
      reverb = makeReverb(); const wet = ac.createGain(); wet.gain.value = 0.5; reverb.connect(wet).connect(master);
      sfxGain = ac.createGain(); sfxGain.gain.value = sfxMuted ? 0 : 1; sfxGain.connect(master);
      sfxSend = ac.createGain(); sfxSend.gain.value = 0.18; sfxGain.connect(sfxSend).connect(reverb);
      musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 2400; musFilter.Q.value = 0.5;
      musGain = ac.createGain(); musGain.gain.value = musMuted ? 0 : MUS_VOL;
      musGain.connect(musFilter).connect(master);
      musSend = ac.createGain(); musSend.gain.value = 0.35; musFilter.connect(musSend).connect(reverb);
      ambGain = ac.createGain(); ambGain.gain.value = musMuted ? 0 : AMB_VOL; ambGain.connect(master);
      const as = ac.createGain(); as.gain.value = 0.3; ambGain.connect(as).connect(reverb);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      Ambience.start();
    }
    if (ac.state === 'suspended') ac.resume();
  }

  /* ---------- Instrumenter ---------- */
  // enkel stemme med attack/decay-kurve (eksponentiell, ingen klikk)
  function tone(dest, freq, t0, dur, type, vol, { attack = 0.005, slide = 0, lp = 0, pan = 0 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // spilledåse/kalimba: grunntone + svakere overtoner som dør raskere ut
  function musicBox(dest, freq, t0, vol, dur = 1.5, pan = 0) {
    tone(dest, freq, t0, dur, 'sine', vol, { attack: 0.004, pan });
    tone(dest, freq * 2.003, t0, dur * 0.45, 'sine', vol * 0.28, { attack: 0.003, pan });
    tone(dest, freq * 4.21, t0, dur * 0.14, 'sine', vol * 0.1, { attack: 0.002, pan });
  }
  // myk pad: to svakt forstemte triangelbølger per tone, langsom inn/ut
  function pad(dest, notes, t0, dur, vol) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.3;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.7); g.gain.setValueAtTime(vol, t0 + dur - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.4);
    f.connect(g).connect(dest);
    for (const n of notes) for (const det of [-5, 5]) {
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n); o.detune.value = det;
      o.connect(f); o.start(t0); o.stop(t0 + dur + 0.5);
    }
  }
  function noise(dest, t0, dur, vol, { hp = 0, lp = 0, bp = 0, q = 1, sweep = 0, pan = 0 } = {}) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 1;
    const g = ac.createGain(); let node = s;
    const filt = (type, f) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, t0); b.Q.value = q; node.connect(b); node = b; return b; };
    if (hp) filt('highpass', hp);
    if (lp) filt('lowpass', lp);
    if (bp) { const b = filt('bandpass', bp); if (sweep) b.frequency.exponentialRampToValueAtTime(sweep, t0 + dur); }
    if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g).connect(dest);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  }

  /* ---------- Musikk: 8 takter i F-dur, 88 BPM, svak swing ---------- */
  const Music = (() => {
    const BPM = 88, STEPS = 64, eighth = 60 / BPM / 2, SWING = 0.16;
    // Fmaj7 – Dm7 – B♭maj7 – Csus4 | Fmaj7 – Am7 – B♭add9 – C7
    const CHORDS = [[53, 57, 60, 64], [50, 57, 60, 65], [46, 53, 57, 62], [48, 53, 55, 60], [53, 57, 60, 64], [45, 52, 55, 60], [46, 53, 57, 60], [48, 52, 55, 58]];
    const ROOTS = [41, 38, 46, 48, 41, 45, 46, 48];
    // melodi for spilledåse (0 = pause), to fraser à 4 takter
    const LEAD = [
      81, 0, 84, 0, 81, 79, 77, 0,   74, 0, 77, 0, 81, 0, 79, 0,   77, 0, 74, 0, 77, 79, 81, 0,   79, 0, 0, 0, 72, 0, 0, 0,
      81, 0, 84, 0, 86, 0, 84, 81,   84, 0, 81, 0, 79, 0, 76, 0,   77, 0, 74, 77, 81, 0, 79, 77,  79, 0, 0, 0, 0, 0, 0, 0
    ];
    let step = 0, nextTime = 0, timer = null, playing = false, mode = 'menu';

    function schedule(i, t) {
      const bar = (i >> 3) % 8, sub = i & 7, play = mode === 'play';
      if (sub & 1) t += eighth * SWING;   // lett swing på åttendedelene
      if (sub === 0) pad(musGain, CHORDS[bar], t, eighth * 8, night ? 0.05 : 0.04);
      // melodi: full i spill, bare på slagene i menyen; en oktav lavere og roligere om kvelden
      const ln = LEAD[i % STEPS];
      if (ln && (play || sub % 2 === 0)) musicBox(musGain, midi(ln - (night ? 12 : 0)), t, play ? 0.13 : 0.1, night ? 2 : 1.5, (sub % 4 - 1.5) * 0.12);
      if (play) {
        if (sub === 0 || sub === 4) tone(musGain, midi(ROOTS[bar]), t, eighth * 3.2, 'triangle', 0.22, { attack: 0.01, lp: 520 });
        if (sub === 3 || sub === 7) musicBox(musGain, midi(CHORDS[bar][(bar + sub) % 4] + 24), t, 0.035, 0.9, sub === 3 ? -0.4 : 0.4);   // kalimba-glimt
        if (!night) {
          noise(musGain, t, 0.05, sub & 1 ? 0.035 : 0.055, { hp: 5500, pan: 0.25 });   // myk shaker
          if (sub === 0 || sub === 4) tone(musGain, 110, t, 0.2, 'sine', 0.22, { slide: 52 });   // rolig «hjerteslag»
        }
      }
    }
    function tick() {
      while (nextTime < ac.currentTime + 0.2) { schedule(step, nextTime); step++; nextTime += eighth; }
      Ambience.tick();
    }
    return {
      start() { if (playing || !ac) return; playing = true; step = 0; nextTime = ac.currentTime + 0.08; timer = setInterval(tick, 40); },
      stop() { playing = false; clearInterval(timer); timer = null; },
      setMode(m) {
        mode = m; if (!ac) return;
        musFilter.frequency.cancelScheduledValues(ac.currentTime);
        musFilter.frequency.setTargetAtTime(m === 'play' ? 7000 : 2400, ac.currentTime, 0.35);
      },
      slowmo(on) { if (ac) musFilter.frequency.setTargetAtTime(on ? 700 : (mode === 'play' ? 7000 : 2400), ac.currentTime, 0.25); },
      get playing() { return playing; }
    };
  })();

  /* ---------- Naturlyder ---------- */
  const Ambience = (() => {
    let windGain = null, nextBird = 0, nextCricket = 0, nextOwl = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function bird(t) {   // en liten kvitrefrase: 2–4 raske glidetoner, tilfeldig plassert i stereo
      const pan = rnd(-0.7, 0.7), n = 2 + ((Math.random() * 3) | 0), base = rnd(2600, 3600);
      for (let k = 0; k < n; k++) {
        const t0 = t + k * rnd(0.09, 0.14), f = base * rnd(0.9, 1.25);
        tone(ambGain, f, t0, rnd(0.06, 0.1), 'sine', 0.05, { attack: 0.01, slide: f * rnd(1.15, 1.5), pan });
      }
    }
    function cricket(t) {   // sirisser: korte pulser rundt 4,4 kHz
      const pan = rnd(-0.8, 0.8), f = rnd(4200, 4700);
      for (let k = 0; k < 4; k++) tone(ambGain, f, t + k * 0.04, 0.025, 'sine', 0.018, { attack: 0.004, pan });
    }
    function owl(t) {   // «hoo … hoo-hoo»
      const pan = rnd(-0.5, 0.5);
      [[0, 0.4], [0.62, 0.22], [0.9, 0.38]].forEach(([dt, d]) => tone(ambGain, 392, t + dt, d, 'sine', 0.06, { attack: 0.06, slide: 360, lp: 900, pan }));
    }
    return {
      start() {   // svak vind: støy gjennom båndpass, langsomt pulserende
        const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
        windGain = ac.createGain(); windGain.gain.value = 0.05;
        const lfo = ac.createOscillator(), depth = ac.createGain(); lfo.frequency.value = 0.09; depth.gain.value = 0.035;
        lfo.connect(depth).connect(windGain.gain); lfo.start();
        s.connect(f).connect(windGain).connect(ambGain); s.start();
        const t = ac.currentTime; nextBird = t + 1.5; nextCricket = t + 1; nextOwl = t + rnd(8, 14);
        this.setNight(night);
      },
      setNight(on) { if (windGain) windGain.gain.setTargetAtTime(on ? 0.03 : 0.05, ac.currentTime, 1); },
      tick() {
        const t = ac.currentTime + 0.1;
        if (!night && t > nextBird) { bird(t); nextBird = t + rnd(3, 8); }
        if (night && t > nextCricket) { cricket(t); nextCricket = t + rnd(0.8, 2.2); }
        if (night && t > nextOwl) { owl(t); nextOwl = t + rnd(18, 32); }
      }
    };
  })();

  /* ---------- Lydeffekter ---------- */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];   // pentaton (F-dur): poengtonen stiger for hvert poeng på rad
  const now = () => ac.currentTime;
  return {
    unlock() { ensure(); if (!Music.playing) Music.start(); },
    // i bakgrunnen: stopp lydklokka helt (sekvenseren står da stille, ac.currentTime fryses)
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    setNight(on) { night = on; if (ac) Ambience.setNight(on); },
    music: Music,
    flap() {   // mykt «fwip»: båndpass-støy som glir oppover + et lite pust
      if (!ac) return; const t = now();
      noise(sfxGain, t, 0.11, 0.22, { bp: 700, sweep: 2600, q: 1.2 });
      tone(sfxGain, 260, t, 0.09, 'sine', 0.08, { slide: 380 });
    },
    point(combo = 0) {   // bjelle/xylofon som stiger i skala
      if (!ac) return; const t = now(), n = 77 + SCALE[combo % SCALE.length];
      musicBox(sfxGain, midi(n), t, 0.2, 0.9);
      tone(sfxGain, midi(n) * 2.76, t, 0.12, 'sine', 0.035);
    },
    fanfare() {   // liten spilledåse-arpeggio (hvert 10. poeng og ny rekord)
      if (!ac) return; const t = now();
      [77, 81, 84, 89].forEach((n, i) => musicBox(sfxGain, midi(n), t + i * 0.09, 0.15, 1.2, (i - 1.5) * 0.2));
    },
    power() { if (!ac) return; const t = now(); [84, 88, 91, 96].forEach((n, i) => musicBox(sfxGain, midi(n), t + i * 0.06, 0.13, 0.8)); },
    shieldPop() {   // såpeboblen sier «plopp»
      if (!ac) return; const t = now();
      tone(sfxGain, 520, t, 0.12, 'sine', 0.3, { slide: 1250 });
      noise(sfxGain, t, 0.04, 0.12, { bp: 3000, q: 2 });
    },
    hit() {   // tegneserie-«bonk»: hult tre-dunk + en liten fjær-«boing»
      if (!ac) return; const t = now();
      tone(sfxGain, 420, t, 0.16, 'triangle', 0.32, { slide: 190, lp: 1600 });
      noise(sfxGain, t, 0.06, 0.18, { bp: 900, q: 3 });
      const o = ac.createOscillator(), g = ac.createGain(), v = ac.createOscillator(), vd = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(330, t + 0.05); o.frequency.exponentialRampToValueAtTime(210, t + 0.45);
      v.frequency.value = 22; vd.gain.setValueAtTime(40, t + 0.05); vd.gain.exponentialRampToValueAtTime(2, t + 0.45);
      v.connect(vd).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.exponentialRampToValueAtTime(0.14, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.47);
      o.connect(g).connect(sfxGain); o.start(t + 0.05); v.start(t + 0.05); o.stop(t + 0.5); v.stop(t + 0.5);
    },
    die() { if (!ac) return; const t = now() + 0.18; musicBox(sfxGain, midi(81), t, 0.12, 0.6); musicBox(sfxGain, midi(77), t + 0.16, 0.12, 0.9); },   // «å-nei»
    thud() { if (!ac) return; const t = now(); tone(sfxGain, 150, t, 0.16, 'sine', 0.3, { slide: 70 }); noise(sfxGain, t, 0.09, 0.14, { lp: 600 }); },   // mykt «plopp»
    sting() {   // liten «å nei»-melodi i dur som ender med et sukk
      if (!ac) return; const t = now() + 0.25;
      [[84, 0], [81, 0.2], [77, 0.4], [79, 0.75], [77, 1.0]].forEach(([n, dt]) => musicBox(musGain, midi(n), t + dt, 0.12, 1.4));
    },
    swoosh() { if (!ac) return; noise(sfxGain, now(), 0.22, 0.07, { bp: 600, sweep: 1800, q: 0.7 }); },
    tick() { if (!ac) return; const t = now(); noise(sfxGain, t, 0.025, 0.12, { bp: 2400, q: 4 }); tone(sfxGain, 1250, t, 0.04, 'sine', 0.04); },   // mykt treklikk
    count() { if (!ac) return; tone(sfxGain, 1500, now(), 0.035, 'sine', 0.03); },   // poengtelling på game over
    toggleSfx() { sfxMuted = !sfxMuted; store.set('pf.muted', sfxMuted ? '1' : '0'); if (sfxGain) sfxGain.gain.setTargetAtTime(sfxMuted ? 0 : 1, ac.currentTime, 0.02); },
    toggleMusic() {
      musMuted = !musMuted; store.set('pf.music', musMuted ? '1' : '0');
      if (musGain) { musGain.gain.setTargetAtTime(musMuted ? 0 : MUS_VOL, ac.currentTime, 0.1); ambGain.gain.setTargetAtTime(musMuted ? 0 : AMB_VOL, ac.currentTime, 0.1); }
    },
    get sfxMuted() { return sfxMuted; }, get musMuted() { return musMuted; }
  };
})();
