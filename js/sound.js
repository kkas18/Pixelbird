/* Pixelfugl – chiptune: musikk og lydeffekter laget i Web Audio, uten opptak.
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   LYD + MUSIKK
   Som en gammel spillmaskin: to pulsbølger (melodi og akkorder), en trekant (bass) og støy (trommer).
   All musikk og alle lydeffekter er skrevet for Pixelfugl. To sløyfer: en rolig i menyen (G-dur, 100 BPM)
   og en raskere under spillet (D-dur, 144 BPM, del A og B). Lydeffektene er korte pulsbølger med
   tonehøyde som glir eller går i trinn. En begrenser til slutt hindrer klipping.
   ============================================================ */
const Sound = (() => {
  let ac = null, master, sfxGain, musGain, musFilter, noiseBuf, waves = {};
  let sfxMuted = store.get('pf.muted') === '1';
  let musMuted = store.get('pf.music') === '1';
  const MUS_VOL = 0.42;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // pulsbølge med valgt pulsbredde (12,5 %, 25 % og 50 %), fra Fourier-rekka til et rektangel
  function pulseWave(duty) {
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) re[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * duty);
    return ac.createPeriodicWave(re, im);
  }
  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = -9; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = 0.002; limiter.release.value = 0.15;
      master = ac.createGain(); master.gain.value = 0.9; master.connect(limiter).connect(ac.destination);
      sfxGain = ac.createGain(); sfxGain.gain.value = sfxMuted ? 0 : 1; sfxGain.connect(master);
      musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 9000; musFilter.Q.value = 0.4;
      musGain = ac.createGain(); musGain.gain.value = musMuted ? 0 : MUS_VOL;
      musFilter.connect(musGain).connect(master);
      waves = { p12: pulseWave(0.125), p25: pulseWave(0.25), p50: pulseWave(0.5) };
      // støy som på en lydbrikke: hver verdi holdes noen få samples, så den blir litt grov
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); let v = 0;
      for (let i = 0; i < d.length; i++) { if (i % 3 === 0) v = Math.random() * 2 - 1; d[i] = v; }
    }
    if (ac.state === 'suspended') ac.resume();
  }

  /* ---------- Stemmer ---------- */
  // en tone: wave = 'p12' | 'p25' | 'p50' | 'tri'; slide = tonehøyde ved slutten; steps = antall trinn i glidet
  function voice(dest, freq, t0, dur, wave, vol, { slide = 0, steps = 0, vib = 0, release = 0.02 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (wave === 'tri') o.type = 'triangle'; else o.setPeriodicWave(waves[wave] || waves.p50);
    o.frequency.setValueAtTime(freq, t0);
    if (slide && steps) for (let i = 1; i <= steps; i++) o.frequency.setValueAtTime(freq * Math.pow(slide / freq, i / steps), t0 + dur * i / (steps + 1));
    else if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    if (vib) {   // vibrato på lange toner
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = freq * vib;
      l.connect(lg).connect(o.frequency); l.start(t0 + 0.12); l.stop(t0 + dur + release + 0.05);
    }
    g.gain.setValueAtTime(vol, t0); g.gain.setValueAtTime(vol, t0 + Math.max(0, dur - release));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dest, t0, dur, vol, { hp = 0, lp = 0, decay = true } = {}) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const g = ac.createGain(); let node = s;
    if (hp) { const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    g.gain.setValueAtTime(vol, t0);
    if (decay) g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); else g.gain.setValueAtTime(0, t0 + dur);
    node.connect(g).connect(dest); s.start(t0, Math.random() * 0.8); s.stop(t0 + dur + 0.02);
  }
  const kick = (dest, t, v = 0.5) => voice(dest, 160, t, 0.09, 'tri', v, { slide: 45 });
  const snare = (dest, t, v = 0.14) => noise(dest, t, 0.11, v, { hp: 1200 });
  const hat = (dest, t, v = 0.05) => noise(dest, t, 0.03, v, { hp: 7000 });

  /* ---------- Musikk ----------
   Noter som MIDI-tall i åttendedeler (8 per takt): 0 = pause, -1 = hold forrige tone. */
  const _ = -1;
  const SONGS = {
    // menyen: rolig og varm, G-dur
    menu: {
      bpm: 100,
      chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57], [55, 59, 62], [52, 55, 59], [45, 48, 52], [50, 54, 57]],
      roots: [43, 40, 48, 50, 43, 40, 45, 38],
      lead: [
        79, _, _, 83, 86, _, 83, _,   76, _, 79, _, 71, _, _, 0,
        72, _, 76, 79, 84, _, 83, _,   81, _, _, _, 0, 0, 78, 79,
        81, _, 79, _, 83, _, 86, _,   88, _, 86, 83, 79, _, 76, _,
        81, _, 79, 76, 72, _, 74, 76,  78, _, _, _, 74, _, 0, 0
      ],
      drums: false
    },
    // spillet: raskt og lyst, D-dur, del A to ganger og så del B
    play: {
      bpm: 144,
      parts: {
        A: {
          chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64], [62, 66, 69], [59, 62, 66], [52, 55, 59], [57, 61, 64]],
          roots: [50, 47, 43, 45, 50, 47, 40, 45],
          lead: [
            74, _, 78, 81, 86, _, 81, 78,   83, _, 81, 78, 74, _, 0, 71,
            79, _, 83, 79, 76, 78, 79, 81,  76, _, _, 73, 76, _, 0, 0,
            74, _, 78, 81, 86, _, 85, 86,   88, 86, 83, _, 81, _, 78, 81,
            79, 78, 76, _, 73, 76, 81, 79,  78, _, 76, _, 74, _, 0, 0
          ]
        },
        B: {
          chords: [[55, 59, 62], [57, 61, 64], [54, 57, 61], [59, 62, 66], [55, 59, 62], [57, 61, 64], [62, 66, 69], [62, 66, 69]],
          roots: [43, 45, 42, 47, 43, 45, 50, 50],
          lead: [
            83, _, 0, 83, 81, 79, 81, 83,   85, _, 81, _, 76, _, 0, 81,
            81, _, 0, 81, 78, 76, 78, 81,   83, _, 78, _, 74, _, 0, 0,
            79, 81, 83, 86, 83, _, 79, _,   81, 83, 85, 88, 85, _, 81, _,
            86, _, 81, 78, 81, 86, 90, _,   86, _, _, _, 0, 0, 0, 0
          ]
        }
      },
      form: ['A', 'A', 'B'],
      drums: true
    }
  };
  const Music = (() => {
    let timer = null, playing = false, mode = 'menu', want = 'menu', step = 0, nextTime = 0, bar = null, formPos = 0, slow = false, restUntil = 0;
    const stepDur = () => 60 / SONGS[mode === 'play' ? 'play' : 'menu'].bpm / 2 * (slow ? 1.45 : 1);
    function barData(i) {
      if (mode === 'play') {
        const song = SONGS.play, name = song.form[formPos], part = song.parts[name], b = i % 8;
        return { name, b, chord: part.chords[b], root: part.roots[b], lead: part.lead.slice(b * 8, b * 8 + 8), drums: true };
      }
      const song = SONGS.menu, b = i % 8;
      return { name: 'M', b, chord: song.chords[b], root: song.roots[b], lead: song.lead.slice(b * 8, b * 8 + 8), drums: false };
    }
    // hvor lenge en tone varer: til neste tone eller pause (hold = -1 forlenger)
    function holdLen(lead, i) { let n = 1; while (i + n < 8 && lead[i + n] === _) n++; return n; }
    function schedule(t) {
      const sub = step % 8, sd = stepDur();
      if (sub === 0) {
        if (want !== mode) { mode = want; formPos = 0; step = 0; }
        const barNo = Math.floor(step / 8);
        if (mode === 'play' && barNo > 0 && barNo % 8 === 0) formPos = (formPos + 1) % SONGS.play.form.length;
        bar = barData(barNo);
      }
      if (mode === 'rest' || t < restUntil) return;
      const play = mode === 'play', ln = bar.lead[sub];
      // melodi: pulsbølge 25 %, med vibrato på lange toner
      if (ln > 0) { const len = holdLen(bar.lead, sub); voice(musFilter, midi(ln), t, sd * len * 0.92, 'p25', play ? 0.11 : 0.085, { vib: len >= 3 ? 0.012 : 0 }); }
      // akkorder: rask brutt akkord på 12,5 % (spill) eller rolige halvnoter (meny)
      if (play) { const n = bar.chord[(sub + (bar.name === 'B' ? 1 : 0)) % 3] + 12; voice(musFilter, midi(n), t, sd * 0.45, 'p12', 0.035); }
      else if (sub === 0 || sub === 4) for (const n of bar.chord) voice(musFilter, midi(n), t, sd * 3.6, 'p50', 0.018, { release: sd });
      // bass på trekant: oktavsprett i spillet, grunntone og kvint i menyen
      if (play) { const pat = [0, 0, 12, 0, 0, 7, 12, 0], n = bar.root + pat[sub]; voice(musFilter, midi(n), t, sd * 0.8, 'tri', 0.3); }
      else if (sub === 0 || sub === 4) voice(musFilter, midi(bar.root + (sub === 4 ? 7 : 0) + 12), t, sd * 3.5, 'tri', 0.26);
      // trommer i spillet
      if (bar.drums) {
        if (sub === 0 || sub === 4 || (bar.name === 'B' && sub === 7)) kick(musFilter, t);
        if (sub === 2 || sub === 6) snare(musFilter, t);
        if (sub % 2 === 1) hat(musFilter, t);
      }
    }
    function tick() {
      while (nextTime < ac.currentTime + 0.12) { schedule(nextTime); nextTime += stepDur(); step++; }
    }
    return {
      start() {
        if (playing || !ac) return; playing = true; step = 0; formPos = 0; mode = want; nextTime = ac.currentTime + 0.06;
        timer = setInterval(tick, 25);
      },
      stop() { playing = false; clearInterval(timer); timer = null; },
      // nytt stykke fra neste takt; i spill skiftes det med en gang (trykket skal høres i musikken)
      setMode(m) {
        want = m; restUntil = 0;
        if (playing && m === 'play' && mode !== 'play') { mode = 'play'; step = 0; formPos = 0; nextTime = Math.max(nextTime, ac.currentTime + 0.02); }
      },
      // pause i musikken (game over-jingelen), så kommer menysløyfa
      rest(sec) { if (ac) { restUntil = ac.currentTime + sec; want = 'menu'; } },
      slowmo(on) { slow = on; if (ac) musFilter.frequency.setTargetAtTime(on ? 1400 : 9000, ac.currentTime, 0.2); },
      get mode() { return mode; },
      get playing() { return playing; },
      SONGS   // for testene
    };
  })();

  /* ---------- Lydeffekter ---------- */
  const now = () => ac.currentTime;
  // introen: lyd uten trykk er bare lov i den installerte appen; i nettleseren er introen stille
  const installed = () => typeof matchMedia === 'function' && ['standalone', 'fullscreen', 'minimal-ui'].some(m => matchMedia(`(display-mode: ${m})`).matches);
  const live = () => ac && ac.state === 'running';
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];   // poengtonen stiger i en pentaton skala
  let chompT = -9, chompN = 0;
  return {
    unlock() { ensure(); if (!Music.playing) Music.start(); },
    // i bakgrunnen: stopp lydklokka helt (sekvenseren står da stille)
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    music: Music,
    introBlip(i) {   // ett blipp per bokstav i logoen, stigende
      if (!ac && installed()) ensure();
      if (!live()) return;
      voice(sfxGain, midi(72 + PENTA[i % PENTA.length]), now(), 0.07, 'p25', 0.1);
    },
    introDone() {   // menyen er klar: tre raske toner opp
      if (!live()) return; const t = now();
      [79, 83, 86].forEach((n, i) => voice(sfxGain, midi(n), t + i * 0.06, i === 2 ? 0.18 : 0.06, 'p50', 0.08));
    },
    flap() {   // kort «bwipp» som glir opp
      if (!ac) return;
      voice(sfxGain, 330, now(), 0.07, 'p25', 0.1, { slide: 640 });
    },
    // en prikk: et lite pip; prikkene på rad stiger en tone hver
    chomp() {
      if (!ac) return; const t = now();
      chompN = t - chompT < 0.45 ? chompN + 1 : 0; chompT = t;
      voice(sfxGain, midi(84 + PENTA[Math.min(chompN, 4)]), t, 0.045, 'p12', 0.09);
    },
    row() {   // hele prikkraden: rask arpeggio opp
      if (!ac) return; const t = now() + 0.05;
      [88, 91, 96, 100].forEach((n, i) => voice(sfxGain, midi(n), t + i * 0.035, 0.05, 'p25', 0.07));
    },
    point(combo = 0) {   // forbi en vegg: to toner, den andre stiger med poengene på rad
      if (!ac) return; const t = now(), n = 76 + PENTA[combo % 8];
      voice(sfxGain, midi(n), t, 0.05, 'p50', 0.08);
      voice(sfxGain, midi(n + 7), t + 0.055, 0.09, 'p50', 0.07);
    },
    place() {   // nytt sted på veien hjem: tre toner som et lite signal
      if (!ac) return; const t = now();
      [[74, 0], [78, 0.09], [81, 0.18], [86, 0.27]].forEach(([n, dt], i) => voice(sfxGain, midi(n), t + dt, i === 3 ? 0.2 : 0.08, 'p25', 0.08, { vib: i === 3 ? 0.01 : 0 }));
    },
    fanfare() {   // hvert 10. poeng
      if (!ac) return; const t = now();
      [72, 76, 79, 84, 88].forEach((n, i) => voice(sfxGain, midi(n), t + i * 0.06, i === 4 ? 0.25 : 0.06, 'p50', 0.08, { vib: i === 4 ? 0.012 : 0 }));
    },
    cheer() {   // ny rekord eller hjemme: en liten seiersmelodi
      if (!ac) return; const t = now();
      [[79, 0, 0.1], [83, 0.1, 0.1], [86, 0.2, 0.1], [91, 0.3, 0.2], [88, 0.52, 0.1], [91, 0.62, 0.38]].forEach(([n, dt, d]) => {
        voice(sfxGain, midi(n), t + dt, d, 'p25', 0.09, { vib: d > 0.3 ? 0.012 : 0 });
        voice(sfxGain, midi(n - 12), t + dt, d, 'tri', 0.2);
      });
    },
    power() {   // ny ting: rask stige opp i trinn
      if (!ac) return;
      voice(sfxGain, 300, now(), 0.28, 'p50', 0.08, { slide: 1500, steps: 10 });
    },
    shieldPop() {   // skjoldet tar treffet
      if (!ac) return; const t = now();
      noise(sfxGain, t, 0.12, 0.2, { hp: 2000 });
      voice(sfxGain, 1200, t, 0.16, 'p12', 0.09, { slide: 300, steps: 6 });
    },
    nearMiss() {   // tett forbi: et lyst, kort sus
      if (!ac) return; const t = now();
      noise(sfxGain, t, 0.12, 0.06, { hp: 5000 });
      voice(sfxGain, midi(96), t + 0.03, 0.05, 'p12', 0.05);
    },
    hit() {   // smell i veggen
      if (!ac) return; const t = now();
      noise(sfxGain, t, 0.18, 0.32, { lp: 2400 });
      voice(sfxGain, 220, t, 0.14, 'p50', 0.12, { slide: 55 });
    },
    die() {   // fuglen faller: fire toner ned
      if (!ac) return; const t = now() + 0.12;
      [79, 76, 72, 67].forEach((n, i) => voice(sfxGain, midi(n), t + i * 0.09, 0.08, 'p25', 0.08));
    },
    thud() {   // i bakken
      if (!ac) return; const t = now();
      voice(sfxGain, 130, t, 0.12, 'tri', 0.4, { slide: 40 }); noise(sfxGain, t, 0.08, 0.12, { lp: 700 });
    },
    sting() {   // game over: kort melodi i moll, så tar menymusikken over etter en pause
      if (!ac) return; const t = now() + 0.25;
      Music.rest(2.6);
      [[72, 0, 0.14], [71, 0.16, 0.14], [69, 0.32, 0.14], [68, 0.5, 0.3], [69, 0.85, 0.6]].forEach(([n, dt, d]) => {
        voice(sfxGain, midi(n), t + dt, d, 'p25', 0.08, { vib: d > 0.4 ? 0.015 : 0 });
        voice(sfxGain, midi(n - 24), t + dt, d, 'tri', 0.22);
      });
    },
    swoosh() { if (ac) noise(sfxGain, now(), 0.16, 0.06, { hp: 2500 }); },
    tick() { if (ac) voice(sfxGain, 1320, now(), 0.025, 'p50', 0.05); },   // knappetrykk
    count() { if (ac) voice(sfxGain, 1760, now(), 0.02, 'p12', 0.035); },   // poengtelling på game over
    pop() {   // fyrverkeri
      if (!ac) return; const t = now();
      noise(sfxGain, t, 0.2, 0.14, { hp: 1500 });
      voice(sfxGain, midi(90 + ((Math.random() * 8) | 0)), t, 0.06, 'p12', 0.05);
    },
    toggleSfx() { sfxMuted = !sfxMuted; store.set('pf.muted', sfxMuted ? '1' : '0'); if (sfxGain) sfxGain.gain.setTargetAtTime(sfxMuted ? 0 : 1, ac.currentTime, 0.02); },
    toggleMusic() {
      musMuted = !musMuted; store.set('pf.music', musMuted ? '1' : '0');
      if (musGain) musGain.gain.setTargetAtTime(musMuted ? 0 : MUS_VOL, ac.currentTime, 0.05);
    },
    get sfxMuted() { return sfxMuted; }, get musMuted() { return musMuted; }
  };
})();
