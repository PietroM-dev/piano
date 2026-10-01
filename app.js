'use strict';

// ---------- Teoria musicale ----------
// Le note sono indicizzate "diatonicamente": d = ottava * 7 + lettera (Do=0 … Si=6).
// Do centrale (C4) = 28.
const NAMES = { it: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'], en: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] };
const STEP = [0, 2, 4, 5, 7, 9, 11];
const SHARP_OK = [0, 1, 3, 4, 5]; // Do♯ Re♯ Fa♯ Sol♯ La♯
const FLAT_OK = [1, 2, 4, 5, 6];  // Re♭ Mi♭ Sol♭ La♭ Si♭
const PC_SPELL = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const BOTTOM_LINE = { treble: 30, bass: 18 }; // Mi4, Sol2
const MIDDLE_C = 28;

const dia = (letter, oct) => oct * 7 + letter;
const mod = (n, m) => ((n % m) + m) % m;
const diaToMidi = d => 12 * (Math.floor(d / 7) + 1) + STEP[mod(d, 7)];

const LEVELS = [
  { name: '1 · Primi passi', desc: 'Chiave di violino · da Do centrale a Sol', layout: 'treble', lo: dia(0, 4), hi: dia(4, 4) },
  { name: "2 · Un'ottava", desc: 'Chiave di violino · da Do centrale al Do sopra', layout: 'treble', lo: dia(0, 4), hi: dia(0, 5) },
  { name: '3 · Tutto il pentagramma', desc: 'Chiave di violino · con tagli addizionali (La3–Do6)', layout: 'treble', lo: dia(5, 3), hi: dia(0, 6) },
  { name: '4 · Chiave di basso', desc: 'Chiave di basso · da Do3 a Do centrale', layout: 'bass', lo: dia(0, 3), hi: dia(0, 4) },
  { name: '5 · Basso completo', desc: 'Chiave di basso · con tagli addizionali (Mi2–Mi4)', layout: 'bass', lo: dia(2, 2), hi: dia(2, 4) },
  { name: '6 · Doppio pentagramma', desc: 'Violino e basso insieme (Fa2–Sol5)', layout: 'grand', lo: dia(3, 2), hi: dia(4, 5) },
  { name: '7 · Alterazioni', desc: 'Doppio pentagramma con ♯ e ♭', layout: 'grand', lo: dia(3, 2), hi: dia(4, 5), acc: true },
];

// ---------- Persistenza (solo comodità, l'app funziona anche senza) ----------
const store = {
  get(k, def) { try { const v = localStorage.getItem('ln.' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('ln.' + k, JSON.stringify(v)); } catch { /* ignora */ } },
};

const settings = {
  level: store.get('level', 0),
  names: store.get('names', 'it'),
  octave: store.get('octave', true),
  sens: store.get('sens', 6),
  keyboard: store.get('keyboard', false),
};
const best = store.get('best', {});

const state = {
  target: null,
  wrong: null,
  solved: false,
  hinted: false,
  locked: false,
  shownAt: 0,
  ok: 0, err: 0, streak: 0, times: [],
};

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const svg = $('staff');
const el = {
  level: $('level'), levelDesc: $('levelDesc'), feedback: $('feedback'), heard: $('heard'),
  meter: $('meterFill'), mic: $('micBtn'), hint: $('hintBtn'), skip: $('skipBtn'),
  sOk: $('sOk'), sErr: $('sErr'), sStreak: $('sStreak'), sBest: $('sBest'), sTime: $('sTime'),
  optNames: $('optNames'), optOctave: $('optOctave'), optSens: $('optSens'), optKeyboard: $('optKeyboard'),
  kbWrap: $('keyboardWrap'), kb: $('keyboard'), reset: $('resetBtn'),
};

function noteLabel(letter, acc) {
  return NAMES[settings.names][letter] + (acc === 1 ? '♯' : acc === -1 ? '♭' : '');
}
function midiLabel(m) {
  const [letter, acc] = PC_SPELL[mod(m, 12)];
  return noteLabel(letter, acc);
}
function targetLabel(t) {
  const name = noteLabel(t.letter, t.acc);
  return t.d === MIDDLE_C && !t.acc ? `${name} centrale` : name;
}

// ---------- Disegno del pentagramma ----------
const S = 10;   // distanza tra le linee
const W = 320;
const NOTE_X = 190;

function staffLayout() {
  const L = LEVELS[settings.level];
  if (L.layout === 'grand') return { h: 210, staves: { treble: 40, bass: 130 } };
  return { h: 150, staves: { [L.layout]: 55 } };
}

function yOf(clef, top, d) {
  return top + 4 * S - (d - BOTTOM_LINE[clef]) * S / 2;
}

function ledgerLines(clef, top, d, x) {
  const bottom = BOTTOM_LINE[clef], topLine = bottom + 8;
  let out = '';
  const line = dd => {
    const y = yOf(clef, top, dd);
    out += `<line x1="${x - 13}" x2="${x + 13}" y1="${y}" y2="${y}" stroke="currentColor" stroke-width="1.3"/>`;
  };
  for (let k = bottom - 2; k >= d; k -= 2) line(k);
  for (let k = topLine + 2; k <= d; k += 2) line(k);
  return out;
}

function noteSvg(clef, top, n, x, color, opacity = 1) {
  const y = yOf(clef, top, n.d);
  let out = `<g opacity="${opacity}">` + ledgerLines(clef, top, n.d, x);
  out += `<g transform="translate(${x} ${y})" style="fill:${color}">` +
    `<ellipse rx="7.6" ry="5.1" transform="rotate(-12)"/>` +
    `<ellipse rx="2.6" ry="4.4" transform="rotate(-55)" style="fill:var(--card)"/></g>`;
  if (n.acc) {
    const glyph = n.acc === 1 ? '♯' : '♭';
    const dy = n.acc === 1 ? 7 : 4;
    out += `<text class="acc" x="${x - 26}" y="${y + dy}" font-size="21" style="fill:${color}">${glyph}</text>`;
  }
  return out + '</g>';
}

function render() {
  const { h, staves } = staffLayout();
  let s = '';
  const tops = Object.values(staves);
  const x0 = 10, x1 = W - 10;
  for (const [clef, top] of Object.entries(staves)) {
    for (let i = 0; i < 5; i++) {
      const y = top + i * S;
      s += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="currentColor" stroke-width="1"/>`;
    }
    s += clef === 'treble'
      ? `<text class="clef" x="${x0 + 4}" y="${top + 4 * S}" font-size="${4.4 * S}">𝄞</text>`
      : `<text class="clef" x="${x0 + 6}" y="${top + 3.6 * S}" font-size="${4 * S}">𝄢</text>`;
  }
  const yTop = Math.min(...tops), yBot = Math.max(...tops) + 4 * S;
  s += `<line x1="${x0}" x2="${x0}" y1="${yTop}" y2="${yBot}" stroke="currentColor" stroke-width="1.2"/>`;
  s += `<line x1="${x1}" x2="${x1}" y1="${yTop}" y2="${yBot}" stroke="currentColor" stroke-width="1.2"/>`;

  const t = state.target;
  if (t) {
    const top = staves[t.clef];
    if (state.wrong) {
      const g = { ...state.wrong };
      const gy = yOf(t.clef, top, g.d);
      if (gy > 4 && gy < h - 4) s += noteSvg(t.clef, top, g, NOTE_X + 52, 'var(--bad)', 0.6);
    }
    s += noteSvg(t.clef, top, t, NOTE_X, state.solved ? 'var(--ok)' : 'currentColor');
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
  svg.innerHTML = s;
}

// ---------- Logica del gioco ----------
function randomNote() {
  const L = LEVELS[settings.level];
  for (let tries = 0; tries < 50; tries++) {
    const d = L.lo + Math.floor(Math.random() * (L.hi - L.lo + 1));
    const letter = mod(d, 7);
    let acc = 0;
    if (L.acc && Math.random() < 0.5) {
      const opts = [];
      if (SHARP_OK.includes(letter)) opts.push(1);
      if (FLAT_OK.includes(letter)) opts.push(-1);
      acc = opts[Math.floor(Math.random() * opts.length)];
    }
    const midi = diaToMidi(d) + acc;
    // mai la stessa nota (nemmeno in un'altra ottava) due volte di fila
    if (state.target && mod(midi, 12) === mod(state.target.midi, 12)) continue;
    let clef = L.layout;
    if (clef === 'grand') clef = d < MIDDLE_C ? 'bass' : d > MIDDLE_C ? 'treble' : (Math.random() < 0.5 ? 'bass' : 'treble');
    return { d, letter, acc, midi, clef };
  }
}

function setFeedback(text, kind = '') {
  el.feedback.textContent = text;
  el.feedback.className = 'feedback ' + kind;
}

function nextNote() {
  state.target = randomNote();
  state.wrong = null;
  state.solved = false;
  state.hinted = false;
  state.locked = false;
  state.shownAt = performance.now();
  render();
  setFeedback(audio.running ? 'Suona la nota' : 'Attiva il microfono e suona la nota');
}

function updateStats() {
  el.sOk.textContent = state.ok;
  el.sErr.textContent = state.err;
  el.sStreak.textContent = state.streak;
  el.sBest.textContent = best[settings.level] || 0;
  const n = state.times.length;
  el.sTime.textContent = n ? (state.times.reduce((a, b) => a + b, 0) / n / 1000).toFixed(1) + 's' : '–';
}

function check(midi, fromKeyboard) {
  const t = state.target;
  if (!t || state.locked) return null;
  const samePc = mod(midi, 12) === mod(t.midi, 12);
  const strict = settings.octave && !fromKeyboard;

  if (samePc && (!strict || midi === t.midi)) {
    state.locked = true;
    state.solved = true;
    state.wrong = null;
    state.ok++;
    if (!state.hinted) {
      state.streak++;
      state.times.push(performance.now() - state.shownAt);
      if (state.streak > (best[settings.level] || 0)) {
        best[settings.level] = state.streak;
        store.set('best', best);
      }
    }
    audio.ignoreMidi = midi; // la nota che sta ancora suonando non deve contare per la prossima
    setFeedback(`✓ Giusto! ${targetLabel(t)}`, 'ok');
    navigator.vibrate?.(40);
    render();
    updateStats();
    setTimeout(nextNote, 750);
    return 'ok';
  }

  if (samePc) {
    setFeedback(`Nota giusta, ma ottava ${midi < t.midi ? 'troppo bassa' : 'troppo alta'}`, 'warn');
    return 'octave';
  }

  state.err++;
  state.streak = 0;
  let wm = midi;
  if (!strict) while (Math.abs(wm - t.midi) > 6) wm += wm < t.midi ? 12 : -12;
  const [letter, acc] = PC_SPELL[mod(wm, 12)];
  state.wrong = { d: dia(letter, Math.floor(wm / 12) - 1), letter, acc };
  setFeedback(`✗ Hai suonato ${midiLabel(midi)} — riprova`, 'bad');
  navigator.vibrate?.([30, 40, 30]);
  render();
  updateStats();
  return 'bad';
}

// ---------- Rilevamento dell'altezza (algoritmo YIN) ----------
let yinBuf = null;
function detectPitch(buf, sr) {
  const maxTau = Math.min(Math.floor(sr / 70), buf.length >> 1);   // fino a ~Do#2
  const minTau = Math.max(2, Math.floor(sr / 1400));               // fino a ~Fa6
  const win = buf.length - maxTau;
  if (!yinBuf || yinBuf.length < maxTau + 1) yinBuf = new Float32Array(maxTau + 1);
  const d = yinBuf;
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < win; i++) {
      const x = buf[i] - buf[i + tau];
      sum += x * x;
    }
    running += sum;
    d[tau] = running ? (sum * tau) / running : 1;
  }
  const TH = 0.15;
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < TH) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return -1;
  let better = tau;
  if (tau > 1 && tau < maxTau) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a + c - 2 * b;
    if (den) better = tau + (a - c) / (2 * den);
  }
  return sr / better;
}

// ---------- Microfono ----------
const STABLE_FRAMES = 4;   // ~65 ms a 60 fps
const SILENCE_FRAMES = 8;

const audio = {
  running: false, ctx: null, stream: null, analyser: null, buf: null, raf: 0, wakeLock: null,
  cand: null, candCount: 0, stable: null, silent: 0, ignoreMidi: null,
};

function gateThreshold() {
  // sensibilità 1..10 → soglia RMS da 0.05 a ~0.0005
  return 0.05 * Math.pow(0.6, settings.sens - 1);
}

function onStableNote(m) {
  el.heard.innerHTML = `${midiLabel(m)}<sub>${Math.floor(m / 12) - 1}</sub>`;
  if (m === audio.ignoreMidi) return;
  audio.ignoreMidi = null;
  check(m, false);
}

function onSilence() {
  audio.cand = null;
  audio.candCount = 0;
  audio.stable = null;
  audio.ignoreMidi = null;
  el.heard.textContent = '—';
}

function tick() {
  const { analyser, buf, ctx } = audio;
  analyser.getFloatTimeDomainData(buf);
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  const thr = gateThreshold();
  el.meter.style.width = Math.min(100, (rms / (thr * 6)) * 100) + '%';

  if (rms < thr) {
    if (++audio.silent === SILENCE_FRAMES) onSilence();
  } else {
    audio.silent = 0;
    const f = detectPitch(buf, ctx.sampleRate);
    if (f > 0) {
      const m = Math.round(69 + 12 * Math.log2(f / 440));
      if (m === audio.cand) audio.candCount++;
      else { audio.cand = m; audio.candCount = 1; }
      if (audio.candCount >= STABLE_FRAMES && audio.stable !== m) {
        audio.stable = m;
        onStableNote(m);
      }
    }
  }
  audio.raf = requestAnimationFrame(tick);
}

async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setFeedback('Microfono non disponibile: apri la pagina in HTTPS', 'bad');
    return;
  }
  try {
    audio.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    setFeedback('Permesso al microfono negato', 'bad');
    return;
  }
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audio.ctx.createMediaStreamSource(audio.stream);
  audio.analyser = audio.ctx.createAnalyser();
  audio.analyser.fftSize = 2048;
  audio.buf = new Float32Array(audio.analyser.fftSize);
  src.connect(audio.analyser);
  audio.running = true;
  el.mic.textContent = '🎤 In ascolto…';
  el.mic.classList.add('on');
  try { audio.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opzionale */ }
  if (!state.solved) setFeedback('Suona la nota');
  tick();
}

function stopMic() {
  cancelAnimationFrame(audio.raf);
  audio.stream?.getTracks().forEach(t => t.stop());
  audio.ctx?.close();
  audio.wakeLock?.release?.();
  Object.assign(audio, { running: false, ctx: null, stream: null, wakeLock: null });
  onSilence();
  el.meter.style.width = '0';
  el.mic.textContent = '🎤 Attiva microfono';
  el.mic.classList.remove('on');
}

// ---------- Tastiera a schermo ----------
function buildKeyboard() {
  const whites = [0, 2, 4, 5, 7, 9, 11];
  const blacks = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]]; // [semitono, posizione bianca a destra]
  let html = '';
  whites.forEach((pc, i) => { html += `<button class="key-w" data-pc="${pc}">${NAMES[settings.names][i]}</button>`; });
  blacks.forEach(([pc, pos]) => {
    html += `<button class="key-b" data-pc="${pc}" style="left:calc(${(pos / 7) * 100}% - 4.5%)" aria-label="${midiLabel(pc)}"></button>`;
  });
  el.kb.innerHTML = html;
}

el.kb.addEventListener('click', e => {
  const key = e.target.closest('[data-pc]');
  if (!key || !state.target) return;
  const pc = Number(key.dataset.pc);
  // stessa nota nell'ottava del bersaglio
  const midi = state.target.midi - mod(state.target.midi, 12) + pc;
  const res = check(midi, true);
  if (!res) return;
  const cls = res === 'ok' ? 'flash-ok' : 'flash-bad';
  key.classList.add(cls);
  setTimeout(() => key.classList.remove(cls), 300);
});

// ---------- Controlli ----------
LEVELS.forEach((L, i) => el.level.add(new Option(L.name, i)));
if (!LEVELS[settings.level]) settings.level = 0;

function applyLevel() {
  el.level.value = settings.level;
  el.levelDesc.textContent = LEVELS[settings.level].desc;
  Object.assign(state, { ok: 0, err: 0, streak: 0, times: [], target: null });
  updateStats();
  nextNote();
}

el.level.addEventListener('change', () => {
  settings.level = Number(el.level.value);
  store.set('level', settings.level);
  applyLevel();
});

el.mic.addEventListener('click', () => (audio.running ? stopMic() : startMic()));

el.hint.addEventListener('click', () => {
  if (!state.target || state.solved) return;
  state.hinted = true;
  state.streak = 0;
  updateStats();
  setFeedback(`È un ${targetLabel(state.target)}`, 'info');
});

el.skip.addEventListener('click', () => {
  if (state.locked) return;
  state.streak = 0;
  updateStats();
  const t = state.target;
  nextNote();
  if (t) setFeedback(`Era un ${targetLabel(t)}`, 'info');
});

el.optNames.value = settings.names;
el.optOctave.checked = settings.octave;
el.optSens.value = settings.sens;
el.optKeyboard.checked = settings.keyboard;
el.kbWrap.hidden = !settings.keyboard;

el.optNames.addEventListener('change', () => { settings.names = el.optNames.value; store.set('names', settings.names); buildKeyboard(); });
el.optOctave.addEventListener('change', () => { settings.octave = el.optOctave.checked; store.set('octave', settings.octave); });
el.optSens.addEventListener('input', () => { settings.sens = Number(el.optSens.value); store.set('sens', settings.sens); });
el.optKeyboard.addEventListener('change', () => {
  settings.keyboard = el.optKeyboard.checked;
  store.set('keyboard', settings.keyboard);
  el.kbWrap.hidden = !settings.keyboard;
});
el.reset.addEventListener('click', () => {
  for (const k of Object.keys(best)) delete best[k];
  store.set('best', best);
  applyLevel();
});

buildKeyboard();
applyLevel();
document.fonts?.ready.then(render);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
