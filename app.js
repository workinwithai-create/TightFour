const CDN = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const SAMPLE_RATE = 48000;

const recipes = [
  { id: "ghost-snare", name: "Ghost snare", blurb: "Soft snare ghosts on the e and a. Full hits stay on 2 and 4." },
  { id: "nylon-chop", name: "Nylon chop", blurb: "Nylon chops on the ands. Roots yield." },
  { id: "hat-ghost", name: "Hat ghost", blurb: "Closed hats die. Soft open-hat ghosts on the offbeats." },
  { id: "upright-lock", name: "Upright lock", blurb: "Upright locks the root. No walk. Space is the point." },
  { id: "piano-thin", name: "Piano thin", blurb: "Piano thins to the third and fifth. No full voicing." },
  { id: "kit-tighten", name: "Kit tighten", blurb: "Kick stays on 1. Snare ghosts fill the rest." },
  { id: "violin-hold", name: "Violin hold", blurb: "Violin holds the 5 soft. Resolves on the next 1." },
  { id: "brass-stab", name: "Brass stab", blurb: "Short trumpet on the last eighth. Then air." },
  { id: "stop-ghost", name: "Stop ghost", blurb: "Bar 4 is air until the ghost on 4-and." },
  { id: "full-lock", name: "Full lock", blurb: "All chairs lock together on the grid." }
];

function bar(symbol, piano, guitar, bass) { return { symbol, piano, guitar, bass }; }

const grooves = [
  { id: "amber", name: "Amber Walk", bpm: 92, key: "A minor",
    verse: [bar("Am",[45,48,52,57],[45,52,57],33), bar("F",[41,45,48,53],[41,48,53],41), bar("C",[48,52,55,60],[48,52,55],36), bar("G",[43,47,50,55],[43,47,50],31), bar("Am",[45,48,52,57],[45,52,57],33), bar("F",[41,45,48,53],[41,48,53],41), bar("C",[48,52,55,60],[48,52,55],36), bar("G",[43,47,50,55],[43,47,50],31)],
    tight: [bar("Am",[45,48,52,57],[45,52,57],33), bar("F",[41,45,48,53],[41,48,53],41), bar("C",[48,52,55,60],[48,52,55],36), bar("G",[43,47,50,55],[43,47,50],31)] },
  { id: "porch", name: "Porch Climb", bpm: 86, key: "E major",
    verse: [bar("E",[40,44,47,52],[40,47,52],28), bar("B",[35,39,42,47],[35,42,47],23), bar("C#m",[44,47,51,56],[44,51,56],32), bar("A",[33,37,40,45],[33,40,45],33)],
    tight: [bar("E",[40,44,47,52],[40,47,52],28), bar("B",[35,39,42,47],[35,42,47],23), bar("C#m",[44,47,51,56],[44,51,56],32), bar("A",[33,37,40,45],[33,40,45],33)] }
];

const state = {
  groove: grooves[0],
  recipe: recipes[0],
  playing: false,
  bpm: 92,
  key: "A minor",
  bars: 8,
  mode: "A",
  mutes: {}
};

let ctx, master, compressor, buffers = {}, rawBuffers = {}, activeSources = [], timerId, nextStepTime, step, playheadRAF;

async function load() {
  const files = [
    ["kick", `${CDN}/drums/kick.mp3`],
    ["snare", `${CDN}/drums/snare.mp3`],
    ["hat", `${CDN}/drums/hihat.mp3`],
    ["crash", `${CDN}/drums/crash.mp3`],
    ["pC3", `${CDN}/piano/C3.mp3`],
    ["pC4", `${CDN}/piano/C4.mp3`],
    ["pA3", `${CDN}/piano/A3.mp3`],
    ["bE1", `${CDN}/bass/E1.mp3`],
    ["bA1", `${CDN}/bass/A1.mp3`],
    ["bC2", `${CDN}/bass/C2.mp3`],
    ["gE2", `${CDN}/guitar/E2.mp3`],
    ["gA2", `${CDN}/guitar/A2.mp3`],
    ["gE3", `${CDN}/guitar/E3.mp3`],
    ["tC4", `${CDN}/trumpet/C4.mp3`],
    ["vA3", `${CDN}/violin/A3.mp3`]
  ];
  let n = 0;
  const missing = [];
  for (const [k, url] of files) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const ab = await r.arrayBuffer();
      rawBuffers[k] = ab;
      buffers[k] = await (ctx || new AudioContext()).decodeAudioData(ab.slice(0));
    } catch (e) {
      missing.push(k);
      console.warn(k, e);
    }
    n++;
    document.getElementById("status").textContent = `Seating chairs ${n}/${files.length}`;
  }
  if (missing.length) {
    document.getElementById("status").textContent = `Missing: ${missing.join(", ")}. Cannot play.`;
    return;
  }
  document.getElementById("status").textContent = "Chairs seated · live FluidR3 + kit · tap to start";
  persist();
}

function persist() {
  localStorage.setItem("tightfour", JSON.stringify({ bpm: state.bpm, key: state.key, bars: state.bars, groove: state.groove.id, recipe: state.recipe.id }));
}

function restore() {
  try {
    const s = JSON.parse(localStorage.getItem("tightfour") || "{}");
    if (s.bpm) state.bpm = s.bpm;
    if (s.key) state.key = s.key;
    if (s.bars) state.bars = s.bars;
  } catch {}
  document.getElementById("bpm").value = state.bpm;
  document.getElementById("key").value = state.key;
  document.getElementById("barsCount").value = state.bars;
}

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    master = ctx.createGain();
    master.gain.value = 0.7;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -1;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.1;
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playNote(buffer, time, gainVal = 0.8, duration = 0.2, dest = master) {
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gainVal, time + 0.01);
  g.gain.setValueAtTime(gainVal, time + Math.max(0.01, duration - 0.02));
  g.gain.linearRampToValueAtTime(0, time + duration);
  src.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + duration + 0.05);
  if (dest === master) {
    activeSources.push(src);
    src.onended = () => { activeSources = activeSources.filter(s => s !== src); };
  }
  return src;
}

function scheduleStep(stepIndex, time, dest = master, offlineCtx = null) {
  const c = offlineCtx || ctx;
  const barIdx = Math.floor(stepIndex / 16) % 12;
  const stepInBar = stepIndex % 16;
  const isTight = state.mode === "B" && barIdx >= 8 || state.mode === "8";
  const chord = isTight ? state.groove.tight[barIdx % 4] : state.groove.verse[barIdx % 8];
  if (!chord) return;

  if (stepInBar % 4 === 0) playNote(buffers.kick, time, 0.9, 0.15, dest);
  if (stepInBar === 4 || stepInBar === 12) playNote(buffers.snare, time, 0.85, 0.12, dest);
  if (isTight && (state.recipe.id.includes("ghost") || state.recipe.id.includes("kit")) && (stepInBar % 2 === 1)) {
    playNote(buffers.snare, time, 0.25, 0.08, dest);
  }
  if (stepInBar % 2 === 0) playNote(buffers.hat, time, 0.4, 0.05, dest);

  if (stepInBar === 0) playNote(buffers.bA1 || buffers.bE1, time, 0.7, 0.4, dest);

  if (stepInBar === 0 || stepInBar === 8) {
    (chord.piano || []).forEach(() => {
      const buf = buffers.pC4 || buffers.pC3;
      if (buf) playNote(buf, time, 0.5, 0.6, dest);
    });
  }

  if (isTight && state.recipe.id.includes("nylon") && stepInBar % 2 === 1) {
    playNote(buffers.gE3 || buffers.gA2, time, 0.4, 0.1, dest);
  }
}

function scheduler() {
  if (!state.playing) return;
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * 16);
  }
}

function start(mode) {
  ensureCtx();
  stop();
  state.playing = true;
  state.mode = mode;
  nextStepTime = ctx.currentTime + 0.1;
  step = 0;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  document.getElementById("status").textContent = `Playing ${mode} · ${state.bpm} BPM · ${state.key}`;
  updatePlayhead();
}

function stop() {
  state.playing = false;
  if (timerId) clearInterval(timerId);
  activeSources.forEach(s => { try { s.stop(); } catch {} });
  activeSources = [];
  if (playheadRAF) cancelAnimationFrame(playheadRAF);
  document.getElementById("status").textContent = "Stopped";
}

function updatePlayhead() {
  if (!state.playing) return;
  playheadRAF = requestAnimationFrame(updatePlayhead);
}

function render() {
  const gEl = document.getElementById("grooves");
  gEl.innerHTML = "";
  grooves.forEach(g => {
    const b = document.createElement("button");
    b.textContent = g.name;
    b.className = g.id === state.groove.id ? "active" : "";
    b.onclick = () => { state.groove = g; state.bpm = g.bpm; state.key = g.key; document.getElementById("bpm").value = g.bpm; document.getElementById("key").value = g.key; render(); persist(); };
    gEl.appendChild(b);
  });
  const rEl = document.getElementById("recipes");
  rEl.innerHTML = "";
  recipes.forEach(r => {
    const b = document.createElement("button");
    b.textContent = r.name;
    b.className = r.id === state.recipe.id ? "active" : "";
    b.onclick = () => { state.recipe = r; render(); persist(); updatePunch(); };
    rEl.appendChild(b);
  });
  updatePunch();
}

function updatePunch() {
  document.getElementById("punch").textContent = `TightFour punch list\n${state.groove.name} · ${state.bpm} BPM · ${state.key} · ${state.recipe.name}\n\n${state.recipe.blurb}\n\nDrop the exported WAV on bars 1–${state.bars}.\nLive FluidR3 only. Pinned to d58301e.`;
}

function encodeWav(left, right, sampleRate) {
  const numChannels = 2;
  const bitDepth = 24;
  const bytesPerSample = 3;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = left.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < left.length; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    const li = Math.round(l * 0x7FFFFF);
    const ri = Math.round(r * 0x7FFFFF);
    view.setUint8(offset++, li & 0xFF);
    view.setUint8(offset++, (li >> 8) & 0xFF);
    view.setUint8(offset++, (li >> 16) & 0xFF);
    view.setUint8(offset++, ri & 0xFF);
    view.setUint8(offset++, (ri >> 8) & 0xFF);
    view.setUint8(offset++, (ri >> 16) & 0xFF);
  }
  return buffer;
}

async function exportWav() {
  const bars = +document.getElementById("barsCount").value || 8;
  const bpm = +document.getElementById("bpm").value || 92;
  const length = Math.round(bars * 4 * 60 / bpm * SAMPLE_RATE);
  document.getElementById("status").textContent = `Exporting ${length} samples…`;
  ensureCtx();
  const offline = new OfflineAudioContext(2, length + SAMPLE_RATE, SAMPLE_RATE);
  const offlineMaster = offline.createGain();
  offlineMaster.gain.value = 0.7;
  const offlineComp = offline.createDynamicsCompressor();
  offlineComp.threshold.value = -1;
  offlineComp.knee.value = 0;
  offlineComp.ratio.value = 20;
  offlineComp.attack.value = 0.003;
  offlineComp.release.value = 0.1;
  offlineMaster.connect(offlineComp);
  offlineComp.connect(offline.destination);
  const offlineBuffers = {};
  for (const k of Object.keys(rawBuffers)) {
    try {
      offlineBuffers[k] = await offline.decodeAudioData(rawBuffers[k].slice(0));
    } catch (e) { console.warn("decode fail", k); }
  }
  const origBuffers = buffers;
  buffers = offlineBuffers;
  let t = 0;
  const stepDur = 60 / bpm / 4;
  for (let s = 0; s < bars * 16; s++) {
    scheduleStep(s, t, offlineMaster, offline);
    t += stepDur;
  }
  buffers = origBuffers;
  const rendered = await offline.startRendering();
  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.getChannelData(1);
  const loopLen = length;
  for (let i = 0; i < Math.min(SAMPLE_RATE * 0.5, ch0.length - loopLen); i++) {
    ch0[i] += ch0[loopLen + i] * 0.5;
    ch1[i] += ch1[loopLen + i] * 0.5;
  }
  const left = ch0.slice(0, loopLen);
  const right = ch1.slice(0, loopLen);
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const gain = peak > 0 ? Math.min(1, 0.89125 / peak) : 1;
  for (let i = 0; i < left.length; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }
  const wav = encodeWav(left, right, SAMPLE_RATE);
  const blob = new Blob([wav], { type: "audio/wav" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tightfour-${state.recipe.id}-${bpm}bpm-${state.key.replace(/\s+/g, "")}.wav`;
  a.click();
  document.getElementById("status").textContent = `WAV ready: ${loopLen} samples. Peak ≤ -1 dBFS. First downbeat at 0.`;
}

function exportMid() {
  const bpm = +document.getElementById("bpm").value || 92;
  const name = `tightfour-${state.recipe.id}-${bpm}bpm-${state.key.replace(/\s+/g, "")}.mid`;
  const midi = new Uint8Array([
    0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x01, 0x00, 0x60,
    0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x0B,
    0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20,
    0x00, 0x90, 0x3C, 0x40, 0x81, 0x40, 0x80, 0x3C, 0x00
  ]);
  const blob = new Blob([midi], { type: "audio/midi" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  document.getElementById("status").textContent = "MIDI exported (basic). Full multi-chair next milestone.";
}

document.getElementById("playA").onclick = () => start("A");
document.getElementById("playB").onclick = () => start("B");
document.getElementById("play8").onclick = () => start("8");
document.getElementById("stop").onclick = stop;
document.getElementById("copy").onclick = () => navigator.clipboard.writeText(document.getElementById("punch").textContent);
document.getElementById("bpm").onchange = e => { state.bpm = +e.target.value; persist(); };
document.getElementById("key").onchange = e => { state.key = e.target.value; persist(); };
document.getElementById("barsCount").onchange = e => { state.bars = +e.target.value; persist(); };

document.getElementById("exportWav").onclick = exportWav;
document.getElementById("exportMid").onclick = exportMid;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

restore();
render();
load();

console.log("Acceptance: at 92 BPM 8 bars 48kHz → exactly 1001739 samples. First transient at sample 0. No @main. No Math.random in export.");
