/* Pixelfugl – Lyd og musikk (Web Audio: ekte opptak + syntese).
   Klassiske skript som deler globalt omfang; lastes i rekkefølge fra index.html. */
'use strict';

/* ============================================================
   LYD + MUSIKK
   Koselig lydbilde i F-dur (88 BPM): kalimba, myk pad og rund bass,
   myke lydeffekter og naturlyder (blåmeis og vind i bjørk om dagen,
   sirisser/ugle om kvelden). Noen få fritt lisensierte opptak
   (audio/, se audio/KILDER.md) gir et organisk preg; til de er lastet,
   eller om de ikke kan lastes, brukes den syntetiske versjonen.
   Felles etterklang og en begrenser (kompressor) på slutten hindrer
   klipping når mange lyder overlapper.
   ============================================================ */
const Sound = (() => {
  let ac = null, master, sfxGain, musGain, musFilter, ambGain, reverb, musSend, sfxSend, noiseBuf;
  let sfxMuted = store.get('pf.muted') === '1';
  let musMuted = store.get('pf.music') === '1';
  let night = false;
  const MUS_VOL = 0.5, AMB_VOL = 0.55;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];

  /* ---------- Opptak ----------
     Tidspunktene er [start, lengde] i sekunder og skrives ut av make_audio.py. Filene hentes med
     én gang siden lastes (service workeren har dem i hurtigbufferen), og dekodes når lyden låses opp. */
  const CLIPS = {
    meis: { url: 'audio/meis.mp3', marks: {
      sang1: [0.15, 1.76], sang2: [2.21, 1.58], sang3: [4.09, 1.72], sang4: [6.11, 1.28],
      sang5: [7.69, 1.29], sang6: [9.28, 1.8], sang7: [11.38, 1.49], sang8: [13.17, 1.56],
      kall1: [15.03, 0.66], kall2: [15.99, 0.62], kall3: [16.91, 0.62] } },
    vind: { url: 'audio/vind.mp3', loop: [0.2, 14.0] },
    tre: { url: 'audio/tre.mp3', marks: { knakk: [0.15, 0.288], dunk: [0.738, 0.22], knirk: [1.258, 1.75] } },
    kalimba: { url: 'audio/kalimba.mp3', f0: 1329 },   // én tone (E6, litt høy); andre toner spilles ved å endre farten
    xylofon: { url: 'audio/xylofon.mp3', marks: { glid: [0.15, 1.153] } }
  };
  const SONGS = ['sang1', 'sang2', 'sang3', 'sang4', 'sang5', 'sang6', 'sang7', 'sang8'], CALLS = ['kall1', 'kall2', 'kall3'];
  const bufs = {}, raw = {};
  for (const k in CLIPS) {
    raw[k] = typeof fetch === 'function'
      ? fetch(CLIPS[k].url).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null)
      : Promise.resolve(null);
  }
  function decodeClips() {
    for (const k in CLIPS) {
      raw[k].then(b => b && new Promise((res, rej) => ac.decodeAudioData(b, res, rej)))
        .then(buf => { if (buf) { bufs[k] = buf; if (k === 'vind') Ambience.useWindClip(buf); } })
        .catch(() => {});   // feil format eller nettverk: syntesen tar over
    }
  }
  // spill et utsnitt av et opptak; false betyr «ikke lastet», så kalleren kan bruke syntese i stedet
  function clip(name, key, { dest = sfxGain, t = ac.currentTime, vol = 1, rate = 1, pan = 0, lp = 0 } = {}) {
    const buf = bufs[name]; if (!buf) return false;
    const [off, len] = key ? CLIPS[name].marks[key] : [0, buf.duration];
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.playbackRate.value = rate;
    g.gain.value = vol; let node = s;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(g).connect(dest);
    // litt slingringsmonn i begge ender: noen dekodere forskyver mp3 med noen titalls millisekunder
    s.start(t, Math.max(0, off - 0.01), len + 0.06); return true;
  }

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
      decodeClips();
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
  // kalimba: opptaket av én tone, spilt raskere eller langsommere; tonen klinger naturlig ut,
  // og dur bestemmer bare når den dempes helt
  const KAL_VOL = 1.9;
  function kalimba(dest, freq, t0, vol, dur, pan) {
    const buf = bufs.kalimba, rate = freq / CLIPS.kalimba.f0;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.playbackRate.value = rate;
    const end = Math.min(t0 + dur * 1.8, t0 + buf.duration / rate);
    g.gain.setValueAtTime(vol * KAL_VOL, t0); g.gain.setTargetAtTime(0.0001, t0 + dur * 0.6, dur * 0.2);
    let node = s;
    if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(g).connect(dest); s.start(t0); s.stop(end + 0.02);
  }
  // spilledåse/kalimba: opptaket når det er lastet, ellers grunntone + svakere overtoner som dør raskere ut
  function musicBox(dest, freq, t0, vol, dur = 1.5, pan = 0) {
    if (bufs.kalimba) { kalimba(dest, freq, t0, vol, dur, pan); return; }
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

  /* ---------- Musikk: 32 takter i F-dur (A A' B A''), 88 BPM, svak swing ----------
     Cirka 87 s før formen gjentas, og hver ny runde varierer bass og kalimba-glimt. Når tiden
     på døgnet skifter, spilles en kort bro på to takter før neste del. */
  const Music = (() => {
    const BPM = 88, eighth = 60 / BPM / 2, SWING = 0.16;
    const F = [53, 57, 60, 64], Dm7 = [50, 57, 60, 65], Bbmaj7 = [46, 53, 57, 62], Csus4 = [48, 53, 55, 60],
      Am7 = [45, 52, 55, 60], Bbadd9 = [46, 53, 57, 60], C7 = [48, 52, 55, 58], C = [48, 52, 55, 60],
      Dm9 = [50, 53, 57, 64], Gm7 = [43, 50, 53, 58], C9sus = [48, 53, 58, 62];
    // melodi for kalimba, åtte åttendedeler per takt (0 = pause)
    const A1 = [81, 0, 84, 0, 81, 79, 77, 0, 74, 0, 77, 0, 81, 0, 79, 0, 77, 0, 74, 0, 77, 79, 81, 0, 79, 0, 0, 0, 72, 0, 0, 0];
    const SECTIONS = {
      A: { chords: [F, Dm7, Bbmaj7, Csus4, F, Am7, Bbadd9, C7], roots: [41, 38, 46, 48, 41, 45, 46, 48],
        lead: [...A1, 81, 0, 84, 0, 86, 0, 84, 81, 84, 0, 81, 0, 79, 0, 76, 0, 77, 0, 74, 77, 81, 0, 79, 77, 79, 0, 0, 0, 0, 0, 0, 0] },
      A2: { chords: [F, Dm7, Bbmaj7, Csus4, F, Am7, Bbadd9, C7], roots: [41, 38, 46, 48, 41, 45, 46, 48],
        lead: [...A1, 81, 0, 79, 0, 77, 0, 79, 81, 84, 0, 0, 81, 79, 0, 76, 0, 77, 0, 79, 0, 81, 0, 82, 0, 79, 0, 76, 0, 72, 0, 0, 0] },
      // mellomspillet: lavere, lengre toner og mer luft
      B: { chords: [Bbmaj7, C, Am7, Dm9, Gm7, Am7, Bbmaj7, C7], roots: [46, 48, 45, 50, 43, 45, 46, 48],
        lead: [74, 0, 0, 0, 77, 0, 81, 0, 79, 0, 0, 0, 76, 0, 72, 0, 76, 0, 0, 79, 81, 0, 0, 0, 77, 0, 0, 0, 74, 0, 0, 0,
          74, 0, 77, 0, 79, 0, 82, 0, 81, 0, 0, 0, 79, 0, 76, 0, 77, 0, 74, 0, 77, 0, 81, 0, 79, 0, 0, 0, 82, 0, 79, 76] },
      A3: { chords: [F, Dm7, Bbmaj7, Csus4, F, Am7, Bbadd9, C7], roots: [41, 38, 46, 48, 41, 45, 46, 48],
        lead: [81, 0, 84, 86, 84, 0, 81, 0, 74, 0, 77, 0, 81, 0, 79, 77, 77, 0, 74, 0, 77, 79, 81, 0, 79, 0, 0, 0, 77, 0, 72, 0,
          81, 0, 84, 0, 86, 0, 84, 81, 84, 0, 81, 0, 79, 0, 76, 0, 77, 0, 74, 0, 72, 0, 74, 0, 79, 0, 0, 0, 77, 0, 76, 0] }
    };
    const FORM = ['A', 'A2', 'B', 'A3'];
    // broer når tiden på døgnet skifter: fallende mot kvelden, stigende mot morgenen
    const BRIDGES = {
      down: { chords: [Bbmaj7, C9sus], roots: [46, 48], lead: [86, 0, 81, 0, 77, 0, 74, 0, 82, 0, 77, 0, 74, 0, 72, 0] },
      up: { chords: [Dm7, Csus4], roots: [38, 48], lead: [74, 0, 77, 0, 81, 0, 84, 0, 79, 0, 84, 0, 86, 0, 89, 0] }
    };
    let step = 0, nextTime = 0, timer = null, playing = false, mode = 'menu';
    let queue = [], formPos = 0, pass = 0, bar = null, bridgeWanted = null, lastBridge = null;

    function refill() {
      const name = FORM[formPos], sec = SECTIONS[name];
      for (let b = 0; b < 8; b++) queue.push({ sec: name, n: b, chord: sec.chords[b], root: sec.roots[b], lead: sec.lead.slice(b * 8, b * 8 + 8) });
      formPos = (formPos + 1) % FORM.length; if (!formPos) pass++;
    }
    function nextBar(t) {
      if (bridgeWanted) {   // resten av delen byttes ut med broen; formen fortsetter med neste del etterpå
        const br = BRIDGES[bridgeWanted]; lastBridge = bridgeWanted; bridgeWanted = null; queue = [];
        for (let b = 0; b < 2; b++) queue.push({ sec: 'bro', n: b, chord: br.chords[b], root: br.roots[b], lead: br.lead.slice(b * 8, b * 8 + 8) });
        clip('xylofon', 'glid', { dest: musGain, t, vol: 0.22, pan: -0.3 });
      }
      if (!queue.length) refill();
      return queue.shift();
    }
    function schedule(i, t) {
      const sub = i & 7, play = mode === 'play';
      if (sub === 0) bar = nextBar(t);
      if (sub & 1) t += eighth * SWING;   // lett swing på åttendedelene
      const B = bar.sec === 'B', bro = bar.sec === 'bro';
      if (sub === 0) pad(musGain, bar.chord, t, eighth * 8, (night ? 0.05 : 0.04) * (B || bro ? 1.2 : 1));
      // melodi: full i spill, bare på slagene i menyen; en oktav lavere og roligere om kvelden
      const ln = bar.lead[sub];
      if (ln && (play || sub % 2 === 0 || bro)) musicBox(musGain, midi(ln - (night ? 12 : 0)), t, play ? 0.13 : 0.1, night || B ? 2 : 1.5, (sub % 4 - 1.5) * 0.12);
      if (play) {
        // bass: halvnoter i A-delene, en liten vandring (grunntone, kvint) i B og annenhver runde
        const walk = B || pass % 2 === 1;
        if (sub === 0 || sub === 4) tone(musGain, midi(bar.root + (walk && sub === 4 ? 7 : 0)), t, eighth * 3.2, 'triangle', 0.22, { attack: 0.01, lp: 520 });
        if (walk && sub === 6 && !bro) tone(musGain, midi(bar.root + 12), t, eighth * 1.5, 'triangle', 0.12, { attack: 0.01, lp: 520 });
        const glint = pass % 2 ? (sub === 2 || sub === 6) : (sub === 3 || sub === 7);   // kalimba-glimt, forskjøvet annenhver runde
        if (glint && !B) musicBox(musGain, midi(bar.chord[(bar.n + sub) % 4] + 24), t, 0.035, 0.9, sub < 4 ? -0.4 : 0.4);
        if (!night) {
          noise(musGain, t, 0.05, sub & 1 ? 0.035 : 0.055, { hp: 5500, pan: 0.25 });   // myk shaker
          if ((sub === 0 || sub === 4) && !B) tone(musGain, 110, t, 0.2, 'sine', 0.22, { slide: 52 });   // rolig «hjerteslag»
        }
      }
    }
    function tick() {
      while (nextTime < ac.currentTime + 0.2) { schedule(step, nextTime); step++; nextTime += eighth; }
      Ambience.tick();
    }
    return {
      start() {
        if (playing || !ac) return; playing = true; step = 0; nextTime = ac.currentTime + 0.08;
        queue = []; formPos = 0; pass = 0; bridgeWanted = null; timer = setInterval(tick, 40);
      },
      stop() { playing = false; clearInterval(timer); timer = null; },
      setMode(m) {
        mode = m; if (!ac) return;
        musFilter.frequency.cancelScheduledValues(ac.currentTime);
        musFilter.frequency.setTargetAtTime(m === 'play' ? 7000 : 2400, ac.currentTime, 0.35);
      },
      slowmo(on) { if (ac) musFilter.frequency.setTargetAtTime(on ? 700 : (mode === 'play' ? 7000 : 2400), ac.currentTime, 0.25); },
      bridge(dir) { if (playing) bridgeWanted = dir; },
      get section() { return bar ? bar.sec : null; },
      get lastBridge() { return lastBridge; },
      get playing() { return playing; },
      FORM, SECTIONS, BRIDGES   // for testene
    };
  })();

  /* ---------- Naturlyder ---------- */
  const Ambience = (() => {
    let windGain = null, windSrc = null, clipGain = null, nextBird = 0, nextCricket = 0, nextOwl = 0, lastSong = '';
    const WIND = { day: 0.05, night: 0.03 }, WIND_CLIP = { day: 0.2, night: 0.12 };
    function bird(t) {
      // blåmeis fra opptaket: tilfeldig sang, plassert et sted i skogen (nær eller langt unna)
      const song = pick(SONGS.filter(s => s !== lastSong)), near = Math.random();
      if (clip('meis', song, { dest: ambGain, t, vol: 0.18 + near * 0.32, rate: rnd(0.97, 1.03), pan: rnd(-0.75, 0.75) })) { lastSong = song; return 6; }
      // reserve: en liten kvitrefrase, 2–4 raske glidetoner
      const pan = rnd(-0.7, 0.7), n = 2 + ((Math.random() * 3) | 0), base = rnd(2600, 3600);
      for (let k = 0; k < n; k++) {
        const t0 = t + k * rnd(0.09, 0.14), f = base * rnd(0.9, 1.25);
        tone(ambGain, f, t0, rnd(0.06, 0.1), 'sine', 0.05, { attack: 0.01, slide: f * rnd(1.15, 1.5), pan });
      }
      return 3;
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
      start() {   // svak vind: støy gjennom båndpass, langsomt pulserende (til opptaket er lastet)
        const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
        windGain = ac.createGain(); windGain.gain.value = 0.05;
        const lfo = ac.createOscillator(), depth = ac.createGain(); lfo.frequency.value = 0.09; depth.gain.value = 0.035;
        lfo.connect(depth).connect(windGain.gain); lfo.start();
        s.connect(f).connect(windGain).connect(ambGain); s.start(); windSrc = { s, lfo };
        const t = ac.currentTime; nextBird = t + 1.5; nextCricket = t + 1; nextOwl = t + rnd(8, 14);
        this.setNight(night);
      },
      // vind i bjørk fra opptaket: sløyfe uten søm, tones inn mens den syntetiske vinden tones ut
      useWindClip(buf) {
        const [a, len] = CLIPS.vind.loop, t = ac.currentTime;
        const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = a; s.loopEnd = a + len;
        clipGain = ac.createGain(); clipGain.gain.setValueAtTime(0.0001, t);
        clipGain.gain.exponentialRampToValueAtTime(night ? WIND_CLIP.night : WIND_CLIP.day, t + 2);
        s.connect(clipGain).connect(ambGain); s.start(t, a + Math.random() * len);
        windGain.gain.cancelScheduledValues(t); windGain.gain.setTargetAtTime(0, t, 0.6);
        const old = windSrc; setTimeout(() => { try { old.s.stop(); old.lfo.stop(); } catch (e) { /* allerede stoppet */ } }, 4000);
        windSrc = null;
      },
      setNight(on) {
        const t = ac.currentTime;
        if (clipGain) clipGain.gain.setTargetAtTime(on ? WIND_CLIP.night : WIND_CLIP.day, t, 1);
        else if (windGain) windGain.gain.setTargetAtTime(on ? WIND.night : WIND.day, t, 1);
      },
      tick() {
        const t = ac.currentTime + 0.1;
        if (!night && t > nextBird) { const gap = bird(t); nextBird = t + gap + rnd(0, 6); }
        if (night && t > nextCricket) { cricket(t); nextCricket = t + rnd(0.8, 2.2); }
        if (night && t > nextOwl) { owl(t); nextOwl = t + rnd(18, 32); }
      }
    };
  })();

  /* ---------- Lydeffekter ---------- */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];   // pentaton (F-dur): poengtonen stiger for hvert poeng på rad
  const ORDER = { night: 0, sunset: 1, day: 2 };
  let timeName = null;
  const now = () => ac.currentTime;
  return {
    unlock() { ensure(); if (!Music.playing) Music.start(); },
    // i bakgrunnen: stopp lydklokka helt (sekvenseren står da stille, ac.currentTime fryses)
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    setNight(on) { night = on; if (ac) Ambience.setNight(on); },
    // tiden på døgnet: et skifte midt i musikken får en kort bro (fallende mot kvelden, stigende mot dagen)
    setTime(name) {
      if (timeName && name !== timeName && ORDER[name] !== undefined) Music.bridge(ORDER[name] < ORDER[timeName] ? 'down' : 'up');
      timeName = name;
    },
    music: Music,
    get loaded() { return Object.keys(bufs); },
    flap() {   // mykt «fwip»: båndpass-støy som glir oppover + et lite pust
      if (!ac) return; const t = now();
      noise(sfxGain, t, 0.11, 0.22, { bp: 700, sweep: 2600, q: 1.2 });
      tone(sfxGain, 260, t, 0.09, 'sine', 0.08, { slide: 380 });
    },
    point(combo = 0) {   // kalimba som stiger i skala
      if (!ac) return; const t = now(), n = 77 + SCALE[combo % SCALE.length];
      musicBox(sfxGain, midi(n), t, 0.2, 0.9);
      if (!bufs.kalimba) tone(sfxGain, midi(n) * 2.76, t, 0.12, 'sine', 0.035);
    },
    fanfare() {   // liten kalimba-arpeggio og en dempet blåmeis i nærheten (hvert 10. poeng)
      if (!ac) return; const t = now();
      [77, 81, 84, 89].forEach((n, i) => musicBox(sfxGain, midi(n), t + i * 0.09, 0.15, 1.2, (i - 1.5) * 0.2));
      clip('meis', pick(CALLS), { t: t + 0.3, vol: 0.3, pan: -0.35 });
    },
    cheer() {   // ny rekord: leketøys-xylofonen glir opp, og meisene svarer
      if (!ac) return; const t = now();
      if (!clip('xylofon', 'glid', { t, vol: 0.5 })) { this.fanfare(); return; }
      [77, 81, 84, 89].forEach((n, i) => musicBox(sfxGain, midi(n), t + 0.5 + i * 0.09, 0.12, 1.2, (i - 1.5) * 0.2));
      clip('meis', pick(SONGS), { t: t + 0.7, vol: 0.32, pan: 0.4 });
    },
    power() { if (!ac) return; const t = now(); [84, 88, 91, 96].forEach((n, i) => musicBox(sfxGain, midi(n), t + i * 0.06, 0.13, 0.8)); },
    shieldPop() {   // såpeboblen sier «plopp»
      if (!ac) return; const t = now();
      tone(sfxGain, 520, t, 0.12, 'sine', 0.3, { slide: 1250 });
      noise(sfxGain, t, 0.04, 0.12, { bp: 3000, q: 2 });
    },
    hit() {   // treknakk mot stammen (opptak), med en myk, dyp kropp under
      if (!ac) return; const t = now();
      if (clip('tre', 'knakk', { t, vol: 0.85, rate: rnd(0.92, 1.05) })) { tone(sfxGain, 140, t, 0.14, 'sine', 0.16, { slide: 80 }); return; }
      tone(sfxGain, 420, t, 0.16, 'triangle', 0.32, { slide: 190, lp: 1600 });
      noise(sfxGain, t, 0.06, 0.18, { bp: 900, q: 3 });
    },
    die() { if (!ac) return; const t = now() + 0.18; musicBox(sfxGain, midi(81), t, 0.12, 0.6); musicBox(sfxGain, midi(77), t + 0.16, 0.12, 0.9); },   // «å-nei»
    thud() {   // mykt dunk i bakken
      if (!ac) return; const t = now();
      if (clip('tre', 'dunk', { t, vol: 0.5, rate: rnd(0.7, 0.8), lp: 900 })) { noise(sfxGain, t, 0.09, 0.08, { lp: 600 }); return; }
      tone(sfxGain, 150, t, 0.16, 'sine', 0.3, { slide: 70 }); noise(sfxGain, t, 0.09, 0.14, { lp: 600 });
    },
    creak(delay = 0) { if (ac) clip('tre', 'knirk', { t: now() + delay, vol: 0.32, rate: rnd(0.95, 1.05), lp: 3200 }); },   // treskiltet svinger i tauene
    sting() {   // liten «å nei»-melodi i dur som ender med et sukk
      if (!ac) return; const t = now() + 0.25;
      [[84, 0], [81, 0.2], [77, 0.4], [79, 0.75], [77, 1.0]].forEach(([n, dt]) => musicBox(musGain, midi(n), t + dt, 0.12, 1.4));
    },
    swoosh() { if (!ac) return; noise(sfxGain, now(), 0.22, 0.07, { bp: 600, sweep: 1800, q: 0.7 }); },
    tick() {   // knappene er vedkubber: et lite treklikk
      if (!ac) return; const t = now();
      if (clip('tre', 'knakk', { t, vol: 0.28, rate: rnd(1.8, 2.0) })) return;
      noise(sfxGain, t, 0.025, 0.12, { bp: 2400, q: 4 }); tone(sfxGain, 1250, t, 0.04, 'sine', 0.04);
    },
    count() { if (!ac) return; tone(sfxGain, 1500, now(), 0.035, 'sine', 0.03); },   // poengtelling på game over
    toggleSfx() { sfxMuted = !sfxMuted; store.set('pf.muted', sfxMuted ? '1' : '0'); if (sfxGain) sfxGain.gain.setTargetAtTime(sfxMuted ? 0 : 1, ac.currentTime, 0.02); },
    toggleMusic() {
      musMuted = !musMuted; store.set('pf.music', musMuted ? '1' : '0');
      if (musGain) { musGain.gain.setTargetAtTime(musMuted ? 0 : MUS_VOL, ac.currentTime, 0.1); ambGain.gain.setTargetAtTime(musMuted ? 0 : AMB_VOL, ac.currentTime, 0.1); }
    },
    get sfxMuted() { return sfxMuted; }, get musMuted() { return musMuted; }
  };
})();
