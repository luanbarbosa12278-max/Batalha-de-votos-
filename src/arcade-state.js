/* Shared preferences, local statistics and audio buses. No combat rules live here. */
(() => {
  'use strict';
  const SETTINGS_KEY = 'svf-arcade-settings-v1';
  const STATS_KEY = 'svf-arcade-stats-v1';
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = { master: .8, voices: 1, effects: .8, animations: !motionQuery.matches, particles: true };
  let storageAvailable = true;
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch { return {}; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); storageAvailable = true; }
    catch { storageAvailable = false; }
  }
  function settingsFrom(value) {
    const result = { ...defaults };
    for (const key of ['master', 'voices', 'effects']) {
      if (typeof value?.[key] === 'number' && Number.isFinite(value[key]))
        result[key] = Math.max(0, Math.min(1, value[key]));
    }
    for (const key of ['animations', 'particles'])
      if (typeof value?.[key] === 'boolean') result[key] = value[key];
    return result;
  }
  const savedStats = read(STATS_KEY);
  const stats = {};
  for (const key of ['attacksL', 'attacksB', 'debates', 'winsL', 'winsB', 'playMs']) {
    stats[key] = Number.isSafeInteger(savedStats?.[key]) && savedStats[key] >= 0 ? savedStats[key] : 0;
  }
  let settings = settingsFrom(read(SETTINGS_KEY));
  let mode = 'menu', dirty = false, lastSave = 0, lastTick = null;
  let observedWins = { l: 0, b: 0 };
  let context = null;
  const media = new Set();
  const mediaEntries = new WeakMap();
  const listeners = new Set();
  const volume = (channel, base = 1) => base * settings.master * (settings[channel] ?? 1);
  const notify = () => listeners.forEach(listener => listener());
  const reducedMotion = () => !settings.animations || motionQuery.matches;
  function applyMedia(entry) {
    const value = volume(entry.channel, entry.base);
    if (entry.gain) {
      entry.audio.volume = 1;
      entry.gain.gain.setValueAtTime(value, context.currentTime);
    } else entry.audio.volume = value;
  }
  function connectMedia(entry) {
    if (!context || entry.source) return;
    try {
      entry.source = context.createMediaElementSource(entry.audio);
      entry.gain = context.createGain();
      entry.source.connect(entry.gain);
      entry.gain.connect(context.destination);
    } catch { /* HTML media volume remains the fallback. */ }
    applyMedia(entry);
  }
  function unlockAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!context && AudioContext) {
        context = new AudioContext();
        media.forEach(connectMedia);
      }
      context?.resume().catch(() => {});
    } catch { /* Sound remains optional on browsers without Web Audio. */ }
  }
  function registerAudio(audio, channel = 'voices', base = 1) {
    let entry = mediaEntries.get(audio);
    if (!entry) {
      entry = { audio, channel, base };
      mediaEntries.set(audio, entry);
    }
    entry.channel = channel;
    entry.base = Math.max(0, Math.min(1, base));
    media.add(entry);
    connectMedia(entry);
    applyMedia(entry);
    return audio;
  }
  function releaseAudio(audio) {
    const entry = mediaEntries.get(audio);
    if (entry) {
      entry.source?.disconnect();
      entry.gain?.disconnect();
      media.delete(entry);
    }
  }
  function tone(kind = 'move') {
    unlockAudio();
    if (!context || context.state !== 'running' || !volume('effects')) return;
    const t = context.currentTime;
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(kind === 'confirm' ? 523 : 392, t);
    osc.frequency.setValueAtTime(kind === 'confirm' ? 784 : 523, t + .045);
    gain.gain.setValueAtTime(volume('effects', .035), t);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .12);
    osc.connect(gain); gain.connect(context.destination);
    osc.start(t); osc.stop(t + .13);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  function applySettings() {
    document.documentElement.classList.toggle('svf-reduced-motion', reducedMotion());
    document.documentElement.classList.toggle('svf-no-particles', !settings.particles);
    media.forEach(applyMedia);
    notify();
  }
  function flush() {
    if (dirty) { write(STATS_KEY, stats); dirty = false; }
    lastSave = performance.now();
  }
  function tick(now) {
    if (lastTick !== null && !document.hidden && (mode === 'arena' || mode === 'debate')) {
      stats.playMs = Math.min(Number.MAX_SAFE_INTEGER, stats.playMs + Math.max(0, Math.round(now - lastTick)));
      dirty = true;
    }
    lastTick = now;
    if (dirty && now - lastSave >= 5000) flush();
  }
  function increment(key, count = 1) {
    stats[key] = Math.min(Number.MAX_SAFE_INTEGER, stats[key] + count);
    dirty = true;
  }
  const api = {
    get settings() { return { ...settings }; },
    get stats() { return { ...stats, attacks: stats.attacksL + stats.attacksB }; },
    get mode() { return mode; },
    get storageAvailable() { return storageAvailable; },
    get reducedMotion() { return reducedMotion(); },
    get paused() { return mode !== 'arena'; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setSettings(value) { settings = settingsFrom({ ...settings, ...value }); write(SETTINGS_KEY, settings); applySettings(); },
    restoreSettings() { settings = { ...defaults }; write(SETTINGS_KEY, settings); applySettings(); },
    setMode(value) {
      if (!['menu', 'transition', 'arena', 'debate'].includes(value) || mode === value) return;
      tick(performance.now()); mode = value; lastTick = performance.now(); flush();
      window.dispatchEvent(new Event('streetvote:modechange')); notify();
    },
    attack(side) { if (side === 'l' || side === 'b') increment(side === 'l' ? 'attacksL' : 'attacksB'); },
    debate() { increment('debates'); flush(); },
    observeWins(wins) {
      for (const side of ['l', 'b']) {
        if (wins[side] > observedWins[side]) increment(side === 'l' ? 'winsL' : 'winsB', wins[side] - observedWins[side]);
      }
      observedWins = { ...wins };
    },
    resetWinBaseline() { observedWins = { l: 0, b: 0 }; },
    tick, flush, volume, registerAudio, releaseAudio, tone, unlockAudio,
    ready: false,
    loadError: '',
  };
  window.streetVoteArcade = api;
  motionQuery.addEventListener?.('change', applySettings);
  document.addEventListener('pointerdown', unlockAudio, { passive: true });
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('visibilitychange', () => { lastTick = null; flush(); });
  window.addEventListener('pagehide', flush);
  applySettings();
})();

