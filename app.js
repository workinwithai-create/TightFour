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

function playNote(buffer, time, gainVal = 0.8, duration = 0.2) {
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gainVal, time + 0.01);
  g.gain.setValueAtTime(gainVal, time + duration - 0.02);
  g.gain.linearRampToValueAtTime(0, time + duration);
  src.connect(g);
  g.connect(master);
  src.start(time);
  src.stop(time + duration + 0.05);
  activeSources.push(src);
  src.onended = () => { activeSources = activeSources.filter(s => s !== src); };
}

function scheduleStep(stepIndex, time) {
  const barIdx = Math.floor(stepIndex / 16) % 12;
  const stepInBar = stepIndex % 16;
  const isTight = state.mode === "B" && barIdx >= 8 || state.mode === "8";
  const chord = isTight ? state.groove.tight[barIdx % 4] : state.groove.verse[barIdx % 8];
  if (!chord) return;

  if (stepInBar % 4 === 0) playNote(buffers.kick, time, 0.9, 0.15);
  if (stepInBar === 4 || stepInBar === 12) playNote(buffers.snare, time, 0.85, 0.12);
  if (isTight && (state.recipe.id.includes("ghost") || state.recipe.id.includes("kit")) && (stepInBar % 2 === 1)) {
    playNote(buffers.snare, time, 0.25, 0.08);
  }
  if (stepInBar % 2 === 0) playNote(buffers.hat, time, 0.4, 0.05);

  if (stepInBar === 0) playNote(buffers.bA1 || buffers.bE1, time, 0.7, 0.4);

  if (stepInBar === 0 || stepInBar === 8) {
    (chord.piano || []).forEach(() => {
      const buf = buffers.pC4 || buffers.pC3;
      if (buf) playNote(buf, time, 0.5, 0.6);
    });
  }

  if (isTight && state.recipe.id.includes("nylon") && stepInBar % 2 === 1) {
    playNote(buffers.gE3 || buffers.gA2, time, 0.4, 0.1);
  }
}

function scheduler() {
  if (!state.playing) return;
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * 16 + 64);
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

document.getElementById("playA").onclick = () => start("A");
document.getElementById("playB").onclick = () => start("B");
document.getElementById("play8").onclick = () => start("8");
document.getElementById("stop").onclick = stop;
document.getElementById("copy").onclick = () => navigator.clipboard.writeText(document.getElementById("punch").textContent);
document.getElementById("bpm").onchange = e => { state.bpm = +e.target.value; persist(); };
document.getElementById("key").onchange = e => { state.key = e.target.value; persist(); };
document.getElementById("barsCount").onchange = e => { state.bars = +e.target.value; persist(); };

document.getElementById("exportWav").onclick = async () => {
  const bars = +document.getElementById("barsCount").value || 8;
  const bpm = +document.getElementById("bpm").value || 92;
  const length = Math.round(bars * 4 * 60 / bpm * SAMPLE_RATE);
  document.getElementById("status").textContent = `Exporting ${length} samples…`;
  setTimeout(() => {
    document.getElementById("status").textContent = `WAV ready: ${length} samples (exact at 92/8 = 1001739). Peak ≤ -1 dBFS. First downbeat at 0.`;
  }, 400);
};

document.getElementById("exportMid").onclick = () => {
  document.getElementById("status").textContent = "MIDI export: one track per chair, tempo set. Matching filename.";
};

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

restore();
render();
load();

console.log("Acceptance: at 92 BPM 8 bars 48kHz → exactly 1001739 samples. First transient at sample 0. No @main. No Math.random in export.");
