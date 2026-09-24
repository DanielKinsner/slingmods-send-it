// WebAudio mixer: master -> music / sfx / voice buses. Starts only after a
// user gesture; pausing suspends the context so nothing doubles on resume.

const BASE = import.meta.env.BASE_URL;
const url = (p: string) => `${BASE}assets/audio/${p}`;

export const SFX = [
  'box-thump-1', 'box-thump-2', 'box-thump-3', 'box-tumble', 'box-scrape', 'strap-creak', 'strap-snap', 'splash-big', 'splash-small',
  'squeak-1', 'squeak-2', 'squeak-3', 'land-hard', 'land-soft', 'tire-chirp', 'crash', 'pickup', 'bell', 'stamp', 'receipt', 'register',
  'gull', 'sad-horn', 'cheer', 'radio-on', 'radio-off', 'waves', 'boardwalk', 'sprinkler', 'trampoline', 'wind-whoosh', 'honk', 'drum-hit', 'crowd-aww',
] as const;
export type SfxId = (typeof SFX)[number] | 'ui-select' | 'ui-back' | 'ui-focus' | 'go' | 'reward' | 'record' | 'whoosh';

const UI_FILES: Record<string, string> = {
  'ui-select': 'select.ogg',
  'ui-back': 'back.ogg',
  'ui-focus': 'focus.ogg',
  go: 'go.ogg',
  reward: 'reward.ogg',
  record: 'record.ogg',
  whoosh: 'whoosh.ogg',
};

const ENGINE_RPMS = [1200, 2200, 4000, 6800];

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  muted: boolean;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private voice!: GainNode;
  private duck!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private engine: { src: AudioBufferSourceNode; gain: GainNode; rpm: number }[] = [];
  private engineBus!: GainNode;
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private musicEl: HTMLAudioElement | null = null;
  private musicSrc: MediaElementAudioSourceNode | null = null;
  private musicTrack = '';
  private voicePlaying: AudioBufferSourceNode | null = null;
  private vols: Volumes = { master: 0.9, music: 0.55, sfx: 0.85, voice: 0.9, muted: false };
  private lastPlay = new Map<string, number>();
  started = false;

  /** Must be called from a user gesture. */
  async start() {
    if (this.started) {
      await this.ctx?.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.duck = ctx.createGain();
    this.music = ctx.createGain();
    this.music.connect(this.duck).connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    // Voice: walkie-talkie band + a little grit.
    this.voice = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 380;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3600;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1800;
    peak.gain.value = 5;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.8);
    }
    shaper.curve = curve;
    this.voice.connect(hp).connect(peak).connect(lp).connect(shaper).connect(this.master);
    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = 0;
    this.engineBus.connect(this.sfx);
    this.started = true;
    this.applyVolumes();
    // Preload the small stuff.
    await Promise.all([
      ...SFX.map((id) => this.load(id, `sfx/${id}.mp3`)),
      ...Object.entries(UI_FILES).map(([id, f]) => this.load(id, f)),
      ...ENGINE_RPMS.map((r) => this.load(`engine-${r}`, `engine-${r}.ogg`)),
      this.load('road', 'road.ogg'),
      this.load('wind', 'wind.ogg'),
    ]);
    this.startEngine();
  }

  private load(id: string, file: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id)!);
    let p = this.loading.get(id);
    if (!p) {
      p = fetch(url(file))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => this.ctx!.decodeAudioData(b))
        .then((buf) => {
          this.buffers.set(id, buf);
          return buf;
        })
        .catch((e) => {
          console.warn('audio load failed', file, e);
          return null;
        });
      this.loading.set(id, p);
    }
    return p;
  }

  setVolumes(v: Volumes) {
    this.vols = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vols.muted ? 0 : this.vols.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.music.gain.setTargetAtTime(this.vols.music * 0.7, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vols.sfx, t, 0.05);
    this.voice.gain.setTargetAtTime(this.vols.voice * 1.25, t, 0.05);
  }

  suspend() {
    this.ctx?.suspend();
    this.musicEl?.pause();
  }
  resume() {
    this.ctx?.resume();
    if (this.musicEl && this.musicTrack) this.musicEl.play().catch(() => {});
  }

  play(id: SfxId, o: { vol?: number; rate?: number; jitter?: number; minGap?: number; pan?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const now = ctx.currentTime;
    const gap = o.minGap ?? 0.05;
    if ((this.lastPlay.get(id) ?? -1) > now - gap) return;
    this.lastPlay.set(id, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const j = o.jitter ?? 0.06;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * 2 * j);
    const g = ctx.createGain();
    g.gain.value = o.vol ?? 1;
    let node: AudioNode = g;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(this.sfx);
    src.start();
  }

  /** Dispatcher line through the radio chain; ducks music while talking. */
  async say(id: string) {
    const ctx = this.ctx;
    if (!ctx || this.vols.voice <= 0) return;
    const buf = await this.load('vo:' + id, `vo/${id}.mp3`);
    if (!buf || ctx.state !== 'running') return;
    if (this.voicePlaying) {
      try {
        this.voicePlaying.stop();
      } catch {
        /* already stopped */
      }
    }
    this.play('radio-on', { vol: 0.35, jitter: 0 });
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.voice);
    const t = ctx.currentTime + 0.12;
    src.start(t);
    this.voicePlaying = src;
    this.duck.gain.setTargetAtTime(0.45, ctx.currentTime, 0.08);
    src.onended = () => {
      if (this.voicePlaying !== src) return;
      this.voicePlaying = null;
      this.play('radio-off', { vol: 0.3, jitter: 0 });
      this.duck.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
    };
  }

  stopVoice() {
    if (this.voicePlaying) {
      try {
        this.voicePlaying.stop();
      } catch {
        /* noop */
      }
      this.voicePlaying = null;
    }
    if (this.ctx) this.duck.gain.setTargetAtTime(1, this.ctx.currentTime, 0.1);
  }

  music_(track: 'run' | 'garage' | '') {
    const file = track === 'run' ? 'music/run-loop.mp3' : track === 'garage' ? 'music/garage-loop.mp3' : '';
    if (file === this.musicTrack) return;
    this.musicTrack = file;
    if (!this.ctx) return;
    if (!this.musicEl) {
      this.musicEl = new Audio();
      this.musicEl.loop = true;
      this.musicEl.crossOrigin = 'anonymous';
      this.musicSrc = this.ctx.createMediaElementSource(this.musicEl);
      this.musicSrc.connect(this.music);
    }
    if (!file) {
      this.musicEl.pause();
      return;
    }
    this.musicEl.src = url(file);
    this.musicEl.play().catch(() => {});
  }

  async sting(kind: 'results' | 'fail') {
    const buf = await this.load('sting-' + kind, `music/${kind === 'results' ? 'results' : 'fail'}-sting.mp3`);
    const ctx = this.ctx;
    if (!buf || !ctx || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.8;
    src.connect(g).connect(this.music);
    src.start();
  }

  private startEngine() {
    const ctx = this.ctx!;
    for (const rpm of ENGINE_RPMS) {
      const buf = this.buffers.get(`engine-${rpm}`);
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.engineBus);
      src.start(ctx.currentTime + Math.random() * 0.1);
      this.engine.push({ src, gain: g, rpm });
    }
    for (const id of ['road', 'wind']) {
      const buf = this.buffers.get(id);
      if (!buf) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.sfx);
      src.start();
      this.loops.set(id, { src, gain: g });
    }
  }

  /** Telemetry-driven engine/road/wind mix. */
  drive(t: { active: boolean; speed: number; throttle: number; airborne: boolean; wheelSpeed: number; topSpeed: number; pitchFactor: number }) {
    const ctx = this.ctx;
    if (!ctx || !this.engine.length) return;
    const now = ctx.currentTime;
    const n = Math.min(1, Math.abs(t.wheelSpeed) / t.topSpeed);
    const rpm = t.active ? 1100 + 5200 * Math.pow(n, 0.85) + t.throttle * 900 + (t.airborne ? t.throttle * 800 : 0) : 900;
    this.engineBus.gain.setTargetAtTime(t.active ? 0.34 + t.throttle * 0.26 : 0.18, now, 0.08);
    for (let i = 0; i < this.engine.length; i++) {
      const e = this.engine[i];
      // Triangular crossfade between neighbouring recordings.
      const lo = i > 0 ? this.engine[i - 1].rpm : 0;
      const hi = i < this.engine.length - 1 ? this.engine[i + 1].rpm : 99999;
      let w = 0;
      if (rpm <= e.rpm) w = i === 0 ? 1 : Math.max(0, (rpm - lo) / (e.rpm - lo));
      else w = i === this.engine.length - 1 ? 1 : Math.max(0, (hi - rpm) / (hi - e.rpm));
      e.gain.gain.setTargetAtTime(w, now, 0.06);
      e.src.playbackRate.setTargetAtTime(Math.max(0.5, Math.min(2, (rpm / e.rpm) * t.pitchFactor)), now, 0.05);
    }
    const road = this.loops.get('road');
    road?.gain.gain.setTargetAtTime(t.active && !t.airborne ? Math.min(0.5, t.speed / 30) : 0, now, 0.08);
    const wind = this.loops.get('wind');
    wind?.gain.gain.setTargetAtTime(t.active ? Math.min(0.45, (t.speed / 26) * (t.airborne ? 1.3 : 0.5)) : 0, now, 0.15);
  }

  quietEngine() {
    if (!this.ctx) return;
    this.engineBus?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    for (const l of this.loops.values()) l.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
}
