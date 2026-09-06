// shared.js
// Shared between sender.html and receiver.html.
// The Bus class is the ONLY thing that needs to change when we move from
// local BroadcastChannel testing to the real Chromecast Sender/Receiver SDK.
// Everything else (game state, message shapes) stays the same.

const CHANNEL_NAME = 'stadt-land-fluss-v1';

const DEFAULT_EXCLUDED_LETTERS = ['Q', 'X', 'Y'];

const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

class Bus {
  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.handlers = {};
    this.channel.onmessage = (ev) => {
      const { type, payload } = ev.data || {};
      (this.handlers[type] || []).forEach((cb) => cb(payload));
    };
  }
  on(type, cb) {
    (this.handlers[type] = this.handlers[type] || []).push(cb);
  }
  send(type, payload) {
    this.channel.postMessage({ type, payload });
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function pickLetter(usedLetters, excludedLetters) {
  const excluded = new Set(excludedLetters || []);
  const used = new Set(usedLetters || []);
  let pool = ALL_LETTERS.filter((l) => !excluded.has(l) && !used.has(l));
  if (pool.length === 0) {
    // exhausted the pool: reset and allow repeats again
    pool = ALL_LETTERS.filter((l) => !excluded.has(l));
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

const STORAGE_KEY = 'slf-gamesets-v1';

function loadGameSets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load game sets', e);
  }
  // seed with a default classic set on first run
  const seed = [
    {
      id: uid(),
      name: 'Klassisch',
      timerSeconds: 60,
      excludedLetters: DEFAULT_EXCLUDED_LETTERS,
      categories: ['Stadt', 'Land', 'Fluss', 'Name', 'Tier', 'Beruf', 'Pflanze', 'Ding'],
    },
  ];
  saveGameSets(seed);
  return seed;
}

function saveGameSets(sets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

// ---------------------------------------------------------------------
// SoundEngine: everything synthesized with Web Audio, no audio files.
// Runs entirely on whatever device renders receiver.html (the TV, once
// this is a real Cast receiver / laptop+HDMI output).
// ---------------------------------------------------------------------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called after a user gesture the first time (browser autoplay
  // rules). Real Cast receivers don't need this, but a plain browser tab does.
  ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.musicGain) this.musicGain.gain.value = muted ? 0 : 0.18;
    if (this.sfxGain) this.sfxGain.gain.value = muted ? 0 : 0.5;
  }

  _tone(freq, startTime, duration, gainNode, type = 'sine', peak = 0.6) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(peak, startTime + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(env);
    env.connect(gainNode);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  startMusic() {
    this.ensureContext();
    if (this.musicTimer) return; // already running
    // gentle 8-step arpeggio loop, ~100 BPM
    const notes = [261.6, 329.6, 392.0, 329.6, 293.7, 349.2, 392.0, 440.0]; // C E G E D F G A
    const stepDur = 0.3;
    this.musicStep = 0;

    const scheduleAhead = () => {
      const now = this.ctx.currentTime;
      // schedule ~1.5s ahead
      while (this._nextNoteTime === undefined || this._nextNoteTime < now + 1.5) {
        if (this._nextNoteTime === undefined || this._nextNoteTime < now) {
          this._nextNoteTime = now + 0.05;
        }
        const freq = notes[this.musicStep % notes.length];
        this._tone(freq, this._nextNoteTime, stepDur * 0.9, this.musicGain, 'sine', 0.5);
        this._nextNoteTime += stepDur;
        this.musicStep += 1;
      }
    };
    scheduleAhead();
    this.musicTimer = setInterval(scheduleAhead, 200);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
      this._nextNoteTime = undefined;
    }
  }

  playTick(urgencyFraction) {
    // urgencyFraction: 0 (10s left) -> 1 (0s left)
    this.ensureContext();
    const freq = 700 + urgencyFraction * 500;
    this._tone(freq, this.ctx.currentTime, 0.09, this.sfxGain, 'square', 0.35);
  }

  playBuzzer() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    this._tone(220, now, 0.35, this.sfxGain, 'sawtooth', 0.7);
    this._tone(165, now + 0.3, 0.5, this.sfxGain, 'sawtooth', 0.7);
  }
}
