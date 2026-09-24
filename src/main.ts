import './ui/styles.css';
import { initPhysics, DT, type R } from './sim/physics';
import type { Build, CourseSpec, InputState } from './sim/types';
import { NO_INPUT } from './sim/types';
import { Run, type GameEvent, type RunResult } from './game/run';
import { botInput } from './game/bot';
import { BOT_PLANS } from './data/botPlans';
import { COURSES, courseById } from './data/courses';
import { VEHICLES } from './data/vehicles';
import { BARKS, DISPATCH, RESULTS } from './data/humor';
import { Commentary } from './game/commentary';
import { SaveStore, applyResult, type Reward, type Settings } from './game/save';
import { GameScene, snapshot, type Snapshot } from './render/scene';
import { Input } from './core/input';
import { AudioEngine } from './audio/audio';
import { Hud } from './ui/hud';
import * as S from './ui/screens';

type Mode = 'loading' | 'title' | 'run' | 'replay' | 'paused' | 'results' | 'garage' | 'contracts' | 'settings';

const HISTORY_FRAMES = 120 * 4; // 4 s of snapshots for the incident replay
const REPLAY_SECONDS = 3.0;
const REPLAY_SPEED = 0.5;

function cloneSnap(s: Snapshot): Snapshot {
  return {
    x: s.x,
    y: s.y,
    a: s.a,
    wheels: s.wheels.map((w) => ({ ...w })),
    cargo: s.cargo.map((c) => ({ ...c })),
  };
}

const PARCEL_NAMES: Record<string, string> = {
  c1: 'Carton A',
  c2: 'Carton B',
  c3: 'Carton C',
  fr: 'The fragile one',
  hv: 'The heavy one',
  fl: 'The flamingo',
};

const BASE = import.meta.env.BASE_URL;
const LOGO_URL = `${BASE}assets/brand/slingmods-logo-main.png`;
const PARAMS = new URLSearchParams(location.search);
const DEBUG_BOT = PARAMS.get('bot');
// Developer toggle: ?inspect=slingshot|ryker|spyder shows the real model under neutral light.
const INSPECT = PARAMS.get('inspect') as Build['vehicle'] | null;
// Developer toggle for throttled preview panes: allow larger catch-up per frame.
const MAX_FRAME_DT = Math.min(1, Number(PARAMS.get('dtmax')) || 0.1);
const MAX_STEPS = Math.ceil(MAX_FRAME_DT / (1 / 120)) + 4;

const FAIL_BANNER: Record<string, [string, string]> = {
  pool: ['MARINE FREIGHT', 'The pool is not a receiving department'],
  wipeout: ['WIPEOUT', 'Helmet: working as intended'],
  inverted: ['WRONG SIDE UP', 'This side up was a request'],
  bounds: ['OFF THE MAP', 'That is not on the route'],
  stuck: ['PARKED. BADLY.', 'Press R to try again'],
};

class Game {
  mode: Mode = 'loading';
  rapier!: R;
  scene!: GameScene;
  input = new Input();
  audio = new AudioEngine();
  store: SaveStore;
  hud = new Hud();
  ui = document.getElementById('ui')!;
  layer: HTMLElement | null = null;
  touch: HTMLElement | null = null;
  run: Run | null = null;
  course: CourseSpec = COURSES[0];
  prev!: Snapshot;
  cur!: Snapshot;
  acc = 0;
  lastT = 0;
  attract = false;
  garageMode = false;
  attractTimer = 0;
  attractPlan = 0;
  dispatch = new Commentary(DISPATCH);
  resultLines = new Commentary(RESULTS, { cooldown: 0, noRepeatRuns: 3 });
  lastResult: { r: RunResult; reward: Reward } | null = null;
  resultDelay = -1;
  lastInput: InputState = NO_INPUT;
  retryTimes: number[] = [];
  runFlags = new Set<string>();
  chirpCooldown = 0;
  logo: HTMLImageElement | null = null;
  clock = 0;
  // Comedy department.
  history: Snapshot[] = [];
  replay: { frames: Snapshot[]; t: number; el: HTMLElement } | null = null;
  photos: { air?: string; bay?: string; fail?: string } = {};
  photoWant: 'air' | 'bay' | 'fail' | null = null;
  photoTimer = -1;
  bestAirPhoto = 0;
  prevVy = 0;
  tracking: { t: number; text: string }[] = [];
  photoCanvas: HTMLCanvasElement | null = null;

  constructor() {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
      storage.getItem('probe');
    } catch {
      storage = null;
    }
    this.store = new SaveStore(storage);
  }

  get save() {
    return this.store.data;
  }

  async boot() {
    const load = S.loadingScreen();
    this.show(load.root);
    try {
      load.set(0.1, 'Loading the truck…');
      const [rapier, logo] = await Promise.all([
        initPhysics(),
        new Promise<HTMLImageElement | null>((res) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = LOGO_URL;
        }),
        document.fonts?.load('800 32px "Barlow Condensed"').catch(() => null),
      ]);
      this.rapier = rapier;
      this.logo = logo;
      load.set(0.5, 'Strapping down parcels…');
      const canvas = document.getElementById('game') as HTMLCanvasElement;
      this.scene = new GameScene(canvas, logo, this.save.settings.quality);
      this.applySettings({});
      window.addEventListener('resize', () => this.scene.resize());
      this.course = courseById(this.save.lastCourse);
      if (INSPECT && INSPECT in VEHICLES) {
        this.save.build = { ...this.save.build, vehicle: INSPECT, paint: 0 };
        this.ui.style.display = 'none';
      }
      load.set(0.7, `Rolling out the ${VEHICLES[this.save.build.vehicle].name}…`);
      this.startAttract();
      await this.scene.setBuild(this.save.build); // real model; throws a diagnostic if missing
      load.set(1, 'Ready');
      this.bindInput();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.mode === 'run' && this.run?.phase !== 'finished') this.pause();
          this.audio.suspend();
        } else if (this.mode !== 'paused') this.audio.resume();
      });
      this.toTitle();
      requestAnimationFrame((t) => this.frame(t));
    } catch (e) {
      console.error(e);
      load.error(`Could not start: ${(e as Error).message}`, () => location.reload());
    }
  }

  // ---------------------------------------------------------------- screens
  api(): S.ScreenApi {
    return {
      save: this.save,
      logoUrl: LOGO_URL,
      courses: COURSES,
      startRun: (id) => this.startRun(id),
      retry: () => this.retry(),
      resume: () => this.resume(),
      toTitle: () => this.toTitle(),
      openGarage: () => this.openGarage(),
      openContracts: () => this.openContracts(),
      openSettings: (back) => this.openSettings(back),
      openControls: (back) => this.show(S.controlsScreen(this.api(), back), 'settings'),
      setBuild: (b) => this.setBuild(b),
      buy: (item, cost) => this.buy(item, cost),
      owns: (item) => this.save.owned.includes(item),
      bounceTest: () => this.bounceTest(),
      bark: (event) => {
        const pool = BARKS.filter((b) => b.event === event);
        const b = pool[Math.floor(Math.random() * pool.length)];
        if (b) this.audio.say(b.id);
      },
      applySettings: (s) => this.applySettings(s),
      sfx: (id) => this.audio.play(id, { vol: 0.5, jitter: 0 }),
      isTouch: () => this.touchWanted(),
    };
  }

  show(el: HTMLElement, mode?: Mode) {
    this.layer?.remove();
    this.layer = el;
    this.ui.appendChild(el);
    if (mode) this.mode = mode;
    // Focus the primary action for keyboard/pad users.
    requestAnimationFrame(() => {
      const f = el.querySelector<HTMLElement>('.btn.primary, button');
      if (f && this.mode !== 'run') f.focus({ preventScroll: true });
    });
  }

  clearLayer() {
    this.layer?.remove();
    this.layer = null;
  }

  toTitle() {
    this.hud.root.remove();
    this.setTouch(false);
    this.startAttract();
    this.show(S.titleScreen(this.api()), 'title');
    this.audio.music_('garage');
  }

  openContracts() {
    this.hud.root.remove();
    this.setTouch(false);
    if (!this.attract) this.startAttract();
    this.show(S.contractsScreen(this.api()), 'contracts');
    this.audio.music_('garage');
  }

  openGarage() {
    this.hud.root.remove();
    this.setTouch(false);
    this.startGarage();
    this.show(S.garageScreen(this.api(), () => this.startGarage()), 'garage');
    this.audio.music_('garage');
    this.say(BARKS.find((b) => b.id === 'b06')!.id, BARKS.find((b) => b.id === 'b06')!.text, true, 'garage');
  }

  openSettings(back: () => void) {
    const prevMode = this.mode;
    this.show(
      S.settingsScreen(this.api(), () => {
        if (prevMode === 'paused') this.pause(true);
        else back();
      }),
      'settings',
    );
    if (prevMode === 'paused') this.mode = 'paused';
  }

  // ------------------------------------------------------------------ runs
  private makeRun(course: CourseSpec, build: Build, assist: boolean) {
    this.run?.dispose();
    this.course = course;
    this.scene.setCourse(course);
    this.vehicleLoad = this.scene.setBuild(build).catch((e) => this.fatal(e as Error));
    this.scene.resetCargo();
    const run = new Run(this.rapier, course, build, { assist });
    run.learned = { ...this.save.lessons };
    this.run = run;
    this.prev = snapshot(run);
    this.cur = snapshot(run);
    this.acc = 0;
    this.history.length = 0;
    this.photos = {};
    this.photoWant = null;
    this.photoTimer = -1;
    this.bestAirPhoto = 0;
    this.tracking = [];
    this.endReplay();
    return run;
  }

  startAttract() {
    this.attract = true;
    this.garageMode = false;
    this.scene.framing = 'attract';
    const course = COURSES[0];
    this.attractPlan++;
    // The attract loop uses the player's current vehicle: no extra downloads.
    this.makeRun(course, { ...this.save.build, preset: 'sensible' }, false);
    this.attractTimer = 0;
  }

  vehicleLoad: Promise<void> = Promise.resolve();

  /** A required asset is missing: say exactly what, never substitute. */
  fatal(e: Error) {
    console.error(e);
    const el = document.createElement('div');
    el.className = 'screen menu scrim';
    el.innerHTML = `<div class="panel stack"><div class="kicker" style="color:var(--red)">Asset diagnostic</div><h2>VEHICLE NOT LOADED</h2>
      <p>${e.message.replace(/</g, '&lt;')}</p>
      <p class="muted">SEND IT uses the real SlingMods vehicle models from <b>public/assets/vehicles/</b>. Re-run <kbd>npm run import-vehicles</kbd> against a Three-Wheel Tour checkout, then reload.</p>
      <button class="btn primary" data-act="reload"><span>RELOAD</span></button></div>`;
    el.querySelector('[data-act="reload"]')!.addEventListener('click', () => location.reload());
    this.show(el, 'loading');
  }

  startGarage() {
    this.attract = false;
    this.garageMode = true;
    this.scene.framing = 'garage';
    const course = courseById('sunset');
    this.makeRun(course, this.save.build, false);
  }

  startRun(courseId?: string) {
    this.audio.start().then(() => this.applySettings({}));
    const course = courseId ? courseById(courseId) : this.save.firstRunDone ? courseById(this.save.lastCourse) : COURSES[0];
    this.save.lastCourse = course.id;
    this.store.save();
    this.attract = false;
    this.garageMode = false;
    this.scene.framing = 'run';
    this.makeRun(course, this.save.build, this.save.settings.autoBalance);
    if (this.scene.vehicleReady) this.enterRun();
    else {
      // Changing vehicle can load its model; repeating an attempt never does.
      const wait = S.loadingScreen();
      wait.set(0.6, `Rolling out the ${VEHICLES[this.save.build.vehicle].name}…`);
      this.show(wait.root, 'loading');
      const run = this.run;
      this.vehicleLoad.then(() => {
        if (this.run === run && this.mode === 'loading' && this.scene.vehicleReady) this.enterRun();
      });
    }
    this.audio.play('go', { vol: 0.5, jitter: 0 });
  }

  retry() {
    if (!this.run || this.attract || this.garageMode) return this.startRun();
    const now = performance.now() / 1000;
    this.retryTimes = this.retryTimes.filter((t) => now - t < 20);
    this.retryTimes.push(now);
    this.makeRun(this.course, this.save.build, this.save.settings.autoBalance);
    this.enterRun();
    if (this.retryTimes.length >= 4) {
      this.retryTimes = [];
      this.pendingLine = 'retry_spam';
    }
  }
  pendingLine: string | null = null;

  private enterRun() {
    this.clearLayer();
    this.mode = 'run';
    this.hud.reset();
    if (!this.hud.root.isConnected) this.ui.appendChild(this.hud.root);
    this.hud.pauseBtn.onclick = () => this.pause();
    this.setTouch(this.touchWanted());
    this.dispatch.newRun();
    this.runFlags.clear();
    this.honks = 0;
    this.recoveries.clear();
    this.idleT = this.reverseT = this.crawlT = 0;
    this.resultDelay = -1;
    this.lastResult = null;
    this.audio.stopVoice();
    this.audio.music_('run');
    this.input.releaseAll();
    const run = this.run!;
    if (!run.learned.throttle) this.hud.prompt(this.touchWanted() ? 'HOLD <b>GAS</b> TO SEND IT' : 'HOLD <kbd>W</kbd> / <kbd>↑</kbd> TO SEND IT', 6);
    else this.hud.prompt(`<span class="muted">${this.course.name.toUpperCase()}</span> · DELIVER <b>3 OF 5</b> TO ${this.course.destination.toUpperCase()}`, 3);
  }

  pause(fromSettings = false) {
    if (this.mode !== 'run' && !fromSettings) return;
    this.input.releaseAll();
    this.audio.quietEngine();
    this.show(S.pauseScreen(this.api()), 'paused');
  }

  resume() {
    if (!this.run) return;
    this.clearLayer();
    this.mode = 'run';
    this.lastT = performance.now();
    this.audio.resume();
  }

  setBuild(b: Partial<Build>) {
    Object.assign(this.save.build, b);
    this.store.save();
  }

  buy(item: string, cost: number) {
    if (this.save.credits < cost) return false;
    this.save.credits -= cost;
    this.save.owned.push(item);
    this.store.save();
    this.audio.play('register', { vol: 0.6 });
    return true;
  }

  bounceTest() {
    const r = this.run;
    if (!r || !this.garageMode) return;
    // A real hop through the same tuned simulation.
    const m = r.vehicle.chassis.mass() + 60;
    r.vehicle.chassis.applyImpulse({ x: 0, y: m * 5.2 }, true);
    this.audio.play('whoosh');
  }

  applySettings(s: Partial<Settings>) {
    Object.assign(this.save.settings, s);
    this.store.save();
    const st = this.save.settings;
    document.documentElement.style.setProperty('--ui', String(st.uiScale));
    document.body.classList.toggle('reduced', st.reducedMotion);
    this.audio.setVolumes(st);
    if (this.scene) {
      this.scene.settings = { shake: st.shake, reducedMotion: st.reducedMotion };
      this.scene.particles.reduced = st.reducedMotion;
    }
    if (this.run) this.run.vehicle.autoBalance = this.mode === 'run' ? this.run.assist : false;
    if (s.touchControls !== undefined && this.mode === 'run') this.setTouch(this.touchWanted());
  }

  touchWanted() {
    const t = this.save.settings.touchControls;
    if (t === 'on') return true;
    if (t === 'off') return false;
    return window.matchMedia?.('(pointer: coarse)').matches || this.input.lastDevice === 'touch';
  }

  setTouch(on: boolean) {
    if (on && !this.touch) {
      this.touch = S.touchControls(
        (k, down) => this.input.setTouch(k, down),
        (a) => this.input.fireAction(a),
      );
      this.ui.appendChild(this.touch);
    } else if (!on && this.touch) {
      this.touch.remove();
      this.touch = null;
    }
  }

  // ----------------------------------------------------------------- input
  bindInput() {
    // First gesture anywhere unlocks audio.
    const unlock = () => this.audio.start().then(() => this.applySettings({}));
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.input.lastDevice = 'touch';
    });

    this.input.on((a) => {
      if (a === 'retry' && (this.mode === 'run' || this.mode === 'results' || this.mode === 'paused' || this.mode === 'replay')) return this.retry();
      if (this.mode === 'replay' && (a === 'confirm' || a === 'pause' || a === 'back')) return this.finishReplay();
      if (a === 'pause') {
        if (this.mode === 'run') return this.pause();
        if (this.mode === 'paused') return this.resume();
        if (this.mode === 'garage' || this.mode === 'contracts') return this.toTitle();
        if (this.mode === 'settings') return (this.layer?.querySelector('[data-act="back"]') as HTMLElement | null)?.click();
      }
      if (a === 'horn' && this.mode === 'run') {
        this.audio.play('honk', { vol: 0.6 });
        this.honks++;
        if (this.honks === 3) this.line('honk', true);
      }
      if (this.mode === 'run' && this.run) {
        if (a === 'trick') this.run.requestTrick(this.input.trickDir());
        if (a === 'toss') this.run.requestToss();
        return;
      }
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') this.moveFocus(a === 'up' || a === 'left' ? -1 : 1);
      if (a === 'confirm') {
        const f = document.activeElement as HTMLElement | null;
        if (f && f.tagName === 'BUTTON' && this.input.lastDevice === 'pad') f.click();
      }
      if (a === 'back') (this.layer?.querySelector('[data-act="back"], [data-act="resume"]') as HTMLElement | null)?.click();
    });
  }

  moveFocus(dir: number) {
    if (!this.layer) return;
    const items = Array.from(this.layer.querySelectorAll<HTMLElement>('button, input')).filter((e) => e.offsetParent !== null);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items[(i + dir + items.length) % items.length];
    n.focus();
    this.audio.play('ui-focus', { vol: 0.3, jitter: 0 });
  }

  // ------------------------------------------------------------------ loop
  frame(t: number) {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - (this.lastT || t)) / 1000;
    this.lastT = t;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT; // no fast-forward after a stall
    this.clock += dt;
    this.input.pollPad(dt);
    const run = this.run;
    if (!run || !this.scene) return;
    if (INSPECT) {
      this.scene.inspect(Number(PARAMS.get('yaw') ?? 60) + (PARAMS.has('spin') ? this.clock * 20 : 0), Number(PARAMS.get('pitch') ?? 12), Number(PARAMS.get('dist') ?? 6.5));
      return;
    }

    const simulate = this.mode !== 'paused' && this.mode !== 'loading' && !(this.mode === 'settings' && !this.attract && !this.garageMode);
    let input: InputState = NO_INPUT;
    if (this.attract) input = botInput(run, BOT_PLANS[run.course.id]?.[this.attractPlan % 2 ? 'shortcut' : 'safe'] ?? BOT_PLANS.sunset.safe);
    else if (this.mode === 'run') {
      input = this.input.state();
      // Developer toggle: ?bot=safe|shortcut drives runs with gameplay inputs.
      if (DEBUG_BOT && BOT_PLANS[run.course.id]?.[DEBUG_BOT]) input = botInput(run, BOT_PLANS[run.course.id][DEBUG_BOT]);
    }
    this.lastInput = input;

    if (simulate) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= DT && steps < MAX_STEPS) {
        this.prev = snapshot(run, this.prev);
        run.step(input);
        this.cur = snapshot(run, this.cur);
        if (this.mode === 'run') {
          this.history.push(cloneSnap(this.cur));
          if (this.history.length > HISTORY_FRAMES) this.history.shift();
        }
        this.acc -= DT;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
      this.handleEvents(run);
    }
    if (this.mode === 'replay' && this.replay) {
      // Slow-motion incident replay from recorded snapshots.
      const rp = this.replay;
      rp.t += dt * REPLAY_SPEED;
      const f = rp.t * 120;
      const i = Math.min(rp.frames.length - 2, Math.floor(f));
      this.scene.draw(run, rp.frames[i], rp.frames[i + 1], f - i, dt * REPLAY_SPEED, { throttle: 0, brake: 0 });
      if (i >= rp.frames.length - 2) this.finishReplay();
    } else {
      const alpha = simulate ? this.acc / DT : 1;
      this.scene.draw(run, this.prev, this.cur, alpha, dt, { throttle: input.throttle, brake: input.brake });
    }
    if (this.photoTimer >= 0) {
      this.photoTimer -= dt;
      if (this.photoTimer < 0) this.photoWant = 'fail';
    }
    if (this.photoWant) {
      // Capture straight after rendering, in the same task.
      this.photos[this.photoWant] = this.capturePhoto();
      this.photoWant = null;
    }
    if (this.mode === 'run') this.hud.update(run, dt, (x, y) => this.scene.toScreen(x, y));

    // Audio telemetry.
    const v = run.vehicle;
    const drivingAudio = this.mode === 'run' || this.garageMode || (this.attract && this.mode === 'title');
    if (drivingAudio) {
      const rw = v.rear.wheel.angvel() * -v.spec.rear.radius;
      this.audio.drive({
        active: true,
        speed: v.speed,
        throttle: input.throttle,
        airborne: v.airborne,
        wheelSpeed: rw,
        topSpeed: v.spec.drive.topSpeed,
        pitchFactor: v.spec.id === 'ryker' ? 1.08 : v.spec.id === 'spyder' ? 0.92 : 1,
      });
      if (this.attract) this.audio.drive({ active: true, speed: v.speed * 0.3, throttle: input.throttle * 0.2, airborne: false, wheelSpeed: rw, topSpeed: 24, pitchFactor: 1 });
    } else this.audio.quietEngine();

    // Attract loop restarts itself.
    if (this.attract) {
      if (run.phase === 'finished' || run.phase === 'failed') {
        this.attractTimer += dt;
        if (this.attractTimer > 2.5) this.startAttract();
      }
      if (run.simTime > 60) this.startAttract();
    }

    if (this.mode === 'run' && this.resultDelay >= 0) {
      this.resultDelay -= dt;
      if (this.resultDelay < 0) {
        if (run.phase === 'failed' && this.history.length > 120 && !this.save.settings.reducedMotion) this.startReplay();
        else this.showResults();
      }
    }
  }

  // --------------------------------------------------------------- replay
  startReplay() {
    const n = Math.round(REPLAY_SECONDS * 120);
    const frames = this.history.slice(-n);
    const no = String(this.save.stats.pools * 7 + (this.save.records[this.course.id]?.attempts ?? 0) + 41).padStart(4, '0');
    const el = document.createElement('div');
    el.className = 'replay passthru';
    el.innerHTML = `<div class="rec">● REPLAY · 0.5×</div><div class="case">INCIDENT REPORT #${no}<small>For training purposes. Mostly entertainment.</small></div><div class="skip">Press any key to file the paperwork · <kbd>R</kbd> retry</div>`;
    this.hud.root.remove();
    this.setTouch(false);
    this.ui.appendChild(el);
    this.replay = { frames, t: 0, el };
    this.mode = 'replay';
    this.audio.quietEngine();
    const skip = () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', skip);
      if (this.mode === 'replay') this.finishReplay();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('pointerdown', skip);
        return;
      }
      skip();
    };
    // Let the triggering input settle before listening for a skip.
    setTimeout(() => {
      if (this.replay?.el !== el) return;
      window.addEventListener('keydown', onKey);
      window.addEventListener('pointerdown', skip);
    }, 350);
  }

  finishReplay() {
    this.endReplay();
    this.mode = 'run';
    this.showResults();
  }

  endReplay() {
    if (!this.replay) return;
    this.replay.el.remove();
    this.replay = null;
  }

  capturePhoto(): string | undefined {
    try {
      const src = this.scene.renderer.domElement;
      const w = 520;
      const h = Math.round((w * src.height) / src.width);
      const c = (this.photoCanvas ??= document.createElement('canvas'));
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(src, 0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.82);
    } catch {
      return undefined;
    }
  }

  track(text: string) {
    const run = this.run;
    if (!run || this.tracking.some((t) => t.text === text)) return;
    this.tracking.push({ t: run.time, text });
  }

  // --------------------------------------------------------------- events
  say(id: string, text: string, voice = true, _event = '') {
    if (this.mode === 'run') this.hud.dispatch(text);
    if (voice) this.audio.say(id);
  }

  line(event: string, force = false) {
    const l = this.dispatch.pick(event, this.clock, this.course.id, force);
    if (l) this.say(l.id, l.text);
  }

  handleEvents(run: Run) {
    const ev = run.events;
    if (!ev.length) {
      this.ambientChecks(run);
      return;
    }
    const live = this.mode === 'run';
    for (const e of ev) {
      if (live) this.onEvent(run, e);
      else this.onAttractEvent(run, e);
    }
    ev.length = 0;
    this.ambientChecks(run);
  }

  onAttractEvent(run: Run, e: GameEvent) {
    const P = this.scene.particles;
    if (e.type === 'landing' && e.jolt > 2) P.emit(10, { x: e.x, y: e.y - 0.5, color: '#d9c7a8', speed: 2, life: 0.8, size: 0.8, grow: 2 });
    if (e.type === 'fail' && e.reason === 'pool') P.emit(60, { x: e.x, y: e.y, color: '#e8fbff', speed: 6, life: 1.2, size: 0.5, gravity: 10, alpha: 0.8 });
    void run;
  }

  onEvent(run: Run, e: GameEvent) {
    const P = this.scene.particles;
    const A = this.audio;
    const v = run.vehicle;
    switch (e.type) {
      case 'start':
        A.play('go', { vol: 0.3, jitter: 0 });
        this.hud.clearPrompt();
        this.track(`Departed ${this.course.id === 'sunset' ? 'SlingMods warehouse' : 'dispatch'}`);
        break;
      case 'prompt':
        this.hud.prompt(this.touchWanted() ? touchify(e.text) : keyify(e.text), e.id === 'p-deliver' ? 5 : 4.5, e.id === 'p-deliver');
        break;
      case 'dispatch':
        if (this.pendingLine) {
          this.line(this.pendingLine, true);
          this.pendingLine = null;
        } else this.line(e.event, e.event === 'pool_failure' || e.event === 'inverted_failure');
        break;
      case 'landing': {
        const hard = e.jolt > 5;
        A.play(hard ? 'land-hard' : 'land-soft', { vol: Math.min(1, 0.35 + e.jolt / 10), minGap: 0.2 });
        P.emit(hard ? 18 : 8, { x: e.x, y: e.y - 0.5, color: '#d9c7a8', speed: 1.5 + e.jolt * 0.3, life: 0.9, size: 0.9, grow: 2.2, alpha: 0.5 });
        if (hard) this.scene.shake(Math.min(0.45, e.jolt * 0.035));
        if (e.jolt > 8 && !this.runFlags.has('hardland')) {
          this.runFlags.add('hardland');
          setTimeout(() => {
            if (this.run === run && run.phase === 'running') this.line('hard_landing');
          }, 600);
        }
        break;
      }
      case 'stunt-pending':
        break;
      case 'stunt-banked': {
        this.hud.stunt(e.awards, e.total);
        A.play('reward', { vol: 0.5, jitter: 0.02 });
        const zone = e.awards.find((a) => run.course.zones.some((z) => z.id === a.id && z.event));
        if (zone) {
          A.play('cheer', { vol: 0.55 });
          this.track(`${zone.label[0]}${zone.label.slice(1).toLowerCase()}. Onlookers applauded`);
        }
        if (e.flips > 0) this.track(`Performed ${e.flips > 1 ? `${e.flips} unrequested flips` : 'an unrequested flip'}`);
        const air = e.awards.find((a) => a.id === 'air');
        if (air && parseFloat(air.label.split(' ')[1]) > 1.6 && !e.awards.some((a) => a.id === 'flip')) this.line('big_air');
        if (e.awards.some((a) => a.id === 'wheelie')) this.line('wheelie');
        const combo = e.awards.find((a) => a.id === 'combo');
        if (combo) {
          A.play('drum-hit', { vol: 0.6, jitter: 0 });
          A.play('cheer', { vol: 0.5 });
          this.line(e.awards.length >= 5 ? 'big_combo' : 'combo', true);
          this.track(`Performed ${combo.label.toLowerCase()} (unrequested)`);
        }
        break;
      }
      case 'stunt-dropped':
        this.hud.stunt([{ id: 'x', label: 'STUNT LOST', points: e.total }], e.total, true);
        break;
      case 'trick-hint':
        this.hud.prompt(
          this.touchWanted()
            ? 'TAP <b>TRICK</b> IN THE AIR · HOLD GAS / BRAKE TO CHANGE IT · <b>TOSS</b> A PARCEL'
            : '<kbd>SPACE</kbd> TRICK IN THE AIR · HOLD <kbd>W</kbd> / <kbd>S</kbd> / <kbd>A</kbd> TO CHANGE IT · <kbd>E</kbd> TOSS A PARCEL',
          5,
        );
        break;
      case 'trick-start':
        A.play('wind-whoosh', { vol: 0.55, rate: e.kind === 'helicopter' ? 1.3 : 1 });
        break;
      case 'trick-done':
        this.hud.trickCall(e.label, e.points, e.chain);
        A.play('reward', { vol: 0.35, rate: 1 + e.chain * 0.08, jitter: 0 });
        break;
      case 'bail': {
        this.hud.banner('BAILED', 'Landed mid-trick. The parcels noticed.', false, 1400);
        A.play('crash', { vol: 0.6 });
        A.play('crowd-aww', { vol: 0.5 });
        this.scene.shake(0.3);
        P.emit(16, { x: e.x, y: e.y - 0.4, color: '#cdbb9c', speed: 3, life: 0.9, size: 0.9, grow: 2 });
        this.line('bail', true);
        const names: Record<string, string> = { superman: 'a headstand', barrel: 'a barrel roll', helicopter: 'a helicopter', standup: 'surfing on the seat' };
        this.track(`Attempted ${names[e.kind]}. Did not.`);
        break;
      }
      case 'launch':
        A.play('trampoline', { vol: 0.9, jitter: 0.03 });
        A.play('wind-whoosh', { vol: 0.5 });
        P.emit(24, { x: e.x, y: e.y - 0.4, color: '#f3c01c', speed: 5, life: 0.8, size: 0.35, gravity: 8 });
        this.scene.shake(0.2);
        this.line('launch');
        this.track('Launched by municipal springboard');
        break;
      case 'toss':
        A.play('pickup', { vol: 0.6, rate: 0.8 });
        break;
      case 'catch':
        this.hud.trickCall('SIGNED, SEALED, CAUGHT', e.points, 1);
        A.play('box-thump-2', { vol: 0.7 });
        A.play('reward', { vol: 0.4, jitter: 0 });
        this.line('catch');
        break;
      case 'shortcut':
        this.line('shortcut_taken');
        this.track('Rerouted via rooftop (unauthorized)');
        break;
      case 'impossible':
        this.hud.prompt('NOT ENOUGH PARCELS LEFT TO PASS · <kbd>R</kbd> RETRY or keep going for practice', 5, true);
        break;
      case 'stopping':
        this.hud.banner('BAY REACHED', 'Hold still — counting parcels', true, 1500);
        A.play('bell', { vol: 0.8, jitter: 0 });
        this.photoWant = 'bay';
        this.track('Arrived at receiving bay');
        A.play('tire-chirp', { vol: 0.3 });
        break;
      case 'finished':
        this.resultDelay = 0.4;
        A.play('stamp', { vol: 0.8, jitter: 0 });
        this.track(e.result.passed ? 'Signed for at the front desk' : 'Recipient refused: not enough parcels');
        break;
      case 'fail': {
        const [big, small] = FAIL_BANNER[e.reason] ?? ['DELIVERY INCOMPLETE', ''];
        this.hud.banner(big, small, false, 2200);
        this.hud.clearPrompt();
        if (e.reason === 'pool') {
          A.play('splash-big', { vol: 1, jitter: 0 });
          P.emit(90, { x: e.x, y: e.y, color: '#eafcff', speed: 7, life: 1.3, size: 0.55, gravity: 11, alpha: 0.85, zSpread: 3 });
          P.emit(30, { x: e.x, y: e.y, color: '#7fe3f0', speed: 4, life: 1.6, size: 0.9, gravity: 8, alpha: 0.6, zSpread: 3 });
        } else {
          A.play('crash', { vol: 0.9 });
          P.emit(24, { x: e.x, y: e.y, color: '#cdbb9c', speed: 3, life: 1, size: 1, grow: 2 });
        }
        A.play('sad-horn', { vol: 0.55, jitter: 0 });
        this.scene.shake(0.35);
        this.scene.popHelmet(run.vehicle.chassis.linvel().x);
        this.photoTimer = 0.35;
        this.resultDelay = 1.3;
        this.track(
          {
            pool: 'Entered pool. Status: marine freight',
            wipeout: 'Driver inspected the pavement, helmet first',
            inverted: 'Vehicle presented upside down (rejected)',
            stuck: 'Vehicle parked itself somewhere creative',
            bounds: 'Left the service area entirely',
          }[e.reason],
        );
        if (e.reason === 'stuck') this.line('stuck_failure', true);
        if (e.reason === 'wipeout') this.line('wipeout', true);
        break;
      }
      case 'cargo':
        this.onCargo(run, e.ev);
        break;
    }
    void v;
  }

  onCargo(run: Run, c: Extract<GameEvent, { type: 'cargo' }>['ev']) {
    const A = this.audio;
    const P = this.scene.particles;
    const pan = Math.max(-1, Math.min(1, (c.x - this.scene.camera.position.x) / 20));
    switch (c.type) {
      case 'impact': {
        const s = c.strength ?? 3;
        if (c.kind === 'flamingo') {
          A.play((['squeak-1', 'squeak-2', 'squeak-3'] as const)[Math.floor(Math.random() * 3)], { vol: Math.min(0.8, s / 8), minGap: 0.5, pan });
          if (s > 4.5 && !this.runFlags.has('flamingo-concern')) {
            this.runFlags.add('flamingo-concern');
            this.line('flamingo_hard_impact');
          }
        } else {
          const id = s > 6 ? 'box-thump-2' : Math.random() < 0.5 ? 'box-thump-1' : 'box-thump-3';
          A.play(id, { vol: Math.min(0.9, s / 9), minGap: 0.07, pan });
        }
        const fr = run.cargo.items.find((i) => i.spec.kind === 'fragile');
        if (fr && fr.condition < 0.5 && !this.runFlags.has('fragile')) {
          this.runFlags.add('fragile');
          this.line('fragile_damaged');
        }
        break;
      }
      case 'strain':
        A.play('strap-creak', { vol: 0.35, minGap: 1.2, pan });
        if (!this.runFlags.has('strain')) {
          this.runFlags.add('strain');
          this.line('restraint_strained');
        }
        break;
      case 'snap':
        A.play('strap-snap', { vol: 0.8, pan });
        P.emit(6, { x: c.x, y: c.y, color: '#f0b400', speed: 2, life: 0.5, size: 0.25 });
        this.line('restraint_broken');
        this.track('A strap resigned');
        break;
      case 'loose':
        A.play('box-scrape', { vol: 0.5, minGap: 0.3, pan });
        if (c.kind === 'flamingo') this.line('flamingo_lost');
        else this.line('cargo_became_loose');
        this.track(`${PARCEL_NAMES[c.id]} left the vehicle`);
        if (run.vehicle.position.x < run.course.start[0] + 30 && !this.runFlags.has('early')) {
          this.runFlags.add('early');
          this.line('early_loss', true);
        }
        if (run.course.id === 'pier' && c.x > 136 && c.x < 154 && c.y > 1.6 && !this.runFlags.has('awning')) {
          this.runFlags.add('awning');
          this.line('awning_hit', true);
          this.track('Parcel introduced to the awning');
        }
        if (!this.runFlags.has('recover-hint2')) {
          this.runFlags.add('recover-hint2');
          setTimeout(() => {
            if (this.mode === 'run' && this.run === run && run.cargo.counts().loose > 0) this.hud.prompt('SLOW DOWN NEAR A BOX TO PICK IT UP', 4);
          }, 1200);
        }
        break;
      case 'lost': {
        const inWater = run.course.water.some((w) => c.x > w.x0 - 1 && c.x < w.x1 + 1);
        if (inWater) {
          A.play('splash-small', { vol: 0.8, pan });
          P.emit(30, { x: c.x, y: c.y + 0.3, color: '#eafcff', speed: 4, life: 1, size: 0.4, gravity: 10, alpha: 0.8 });
        }
        if (c.kind === 'flamingo') this.line('flamingo_lost');
        this.track(`${PARCEL_NAMES[c.id]} ${inWater ? (run.course.theme === 'pier' ? 'went into the sea' : 'entered the pool') : 'lost in transit'}`);
        break;
      }
      case 'recover-start':
        A.play('pickup', { vol: 0.7, pan });
        break;
      case 'recovered':
        A.play('box-thump-1', { vol: 0.6 });
        this.line('cargo_recovered');
        this.track(`${PARCEL_NAMES[c.id]} re-boarded (local pickup)`);
        if (this.recoveries.get(c.id)) this.line('recovered_again', true);
        this.recoveries.set(c.id, (this.recoveries.get(c.id) ?? 0) + 1);
        break;
    }
  }

  ambientChecks(run: Run) {
    if (this.mode !== 'run' || run.phase !== 'running') return;
    const v = run.vehicle;
    this.noticeBehaviour(run);
    // Proof-of-delivery photo at the apex of the biggest jump.
    const vy = v.chassis.linvel().y;
    if (v.airborne && this.prevVy > 0 && vy <= 0) {
      const h = v.position.y - this.scene.groundBelow(v.position.x, v.position.y);
      if (h > 1.8 && h > this.bestAirPhoto) {
        this.bestAirPhoto = h;
        this.photoWant = 'air';
      }
    }
    this.prevVy = vy;
    // Left a recoverable parcel far behind.
    if (!this.runFlags.has('left-behind')) {
      const behind = run.cargo.items.find((i) => i.state === 'loose' && i.spec.required && v.position.x - i.pos.x > 30);
      if (behind) {
        this.runFlags.add('left-behind');
        this.line('recoverable_cargo_left_behind');
      }
    }
    // Overshooting the bay.
    const d = run.course.delivery;
    if (!this.runFlags.has('overshoot') && v.position.x > d.x1 - 2 && v.speed > 6) {
      this.runFlags.add('overshoot');
      this.line('destination_overshot', true);
    }
    // Tire chirp on hard braking.
    this.chirpCooldown -= 1 / 60;
    if (this.lastInput.brake > 0.8 && v.forwardSpeed > 9 && !v.airborne && this.chirpCooldown <= 0) {
      this.audio.play('tire-chirp', { vol: 0.45 });
      this.chirpCooldown = 1.5;
      this.scene.particles.emit(4, { x: v.position.x - 1.2, y: v.position.y - 0.5, color: '#bbbbbb', speed: 1, life: 0.6, size: 0.6, grow: 2, alpha: 0.35 });
    }
    // Dust when driving hard.
    if (this.lastInput.throttle > 0.8 && v.contacts.rear && v.speed < 12 && Math.random() < 0.25) {
      const [wx, wy] = v.toWorld(v.spec.rear.x - 0.3, v.spec.rear.y - v.spec.rear.radius + 0.1);
      this.scene.particles.emit(1, { x: wx, y: wy, color: '#d9c7a8', vx: -2, speed: 0.8, life: 0.7, size: 0.5, grow: 2, alpha: 0.35, zSpread: 0.6 });
    }
  }

  honks = 0;
  recoveries = new Map<string, number>();
  private idleT = 0;
  private reverseT = 0;
  private crawlT = 0;

  /** The dispatcher notices what you are actually doing. Once per run each. */
  noticeBehaviour(run: Run) {
    const v = run.vehicle;
    const p = v.position;
    const dt = 1 / 60;
    const d = run.course.delivery;
    const nearBay = p.x > d.x0 - 30 && p.x < d.x1 + 5;
    const once = (flag: string, event: string, cond: boolean, force = false) => {
      if (cond && !this.runFlags.has(flag)) {
        this.runFlags.add(flag);
        this.line(event, force);
      }
    };
    this.idleT = v.speed < 0.3 && run.time > 3 && !nearBay ? this.idleT + dt : 0;
    once('idle', 'idle', this.idleT > 6, true);
    this.reverseT = v.reverse && v.forwardSpeed < -1.2 ? this.reverseT + dt : 0;
    once('reverse', 'reverse', this.reverseT > 1);
    this.crawlT = v.speed > 0.3 && v.speed < 3.5 && !nearBay && !run.cargo.items.some((i) => i.pickup) ? this.crawlT + dt : 0;
    once('crawl', 'crawl', this.crawlT > 9, true);
    once('top', 'top_speed', v.forwardSpeed > v.spec.drive.topSpeed * 0.93);
    once('bayfast', 'near_bay_fast', nearBay && p.x < d.x0 - 5 && v.speed > 15);
    const c = run.cargo.counts();
    once('last', 'last_parcel', c.onboard === 1 && c.lost + c.loose >= 4, true);
    if (run.course.id === 'sunset') {
      once('rumble', 'rumble', p.x > 133 && p.x < 140);
      once('dig', 'dig_site', p.x > 110 && p.x < 120 && p.y < -0.6);
    }
  }

  showResults() {
    const run = this.run;
    if (!run || !run.result) return;
    const r = run.result;
    const reward = applyResult(this.save, r);
    this.save.firstRunDone = true;
    this.save.lessons = { ...run.learned };
    this.store.save();
    this.lastResult = { r, reward };
    this.resultLines.newRun();
    let voiced: string | null = null;
    const pick = (event: string) => {
      const l = this.resultLines.pick(event, this.clock, this.course.id, true);
      if (l) voiced = l.id;
      return l?.text ?? null;
    };
    const photo = r.passed
      ? this.photos.air
        ? { src: this.photos.air, caption: 'PROOF OF EXPRESS SHIPPING' }
        : this.photos.bay
          ? { src: this.photos.bay, caption: 'PROOF OF DELIVERY' }
          : undefined
      : this.photos.fail
        ? { src: this.photos.fail, caption: 'PROOF OF ATTEMPTED DELIVERY' }
        : undefined;
    const { root } = S.resultsScreen(this.api(), r, reward, this.course, pick, { photo, tracking: this.tracking.slice(-6) });
    this.setTouch(false);
    this.show(root, 'results');
    this.audio.sting(r.passed ? 'results' : 'fail');
    this.audio.play('receipt', { vol: 0.5, jitter: 0 });
    if (reward.newStamps.length) setTimeout(() => this.audio.play('stamp', { vol: 0.9, jitter: 0.02 }), 500);
    if (reward.credits) setTimeout(() => this.audio.play('register', { vol: 0.5 }), 900);
    if (voiced) setTimeout(() => this.audio.say(voiced!), 1300);
    this.audio.quietEngine();
  }
}

function keyify(text: string) {
  return text
    .replace(/\bW \/ ↑/g, '<kbd>W</kbd> / <kbd>↑</kbd>')
    .replace(/\bS \/ ↓/g, '<kbd>S</kbd> / <kbd>↓</kbd>')
    .replace(/\bA = /g, '<kbd>A</kbd> ')
    .replace(/\bD = /g, '<kbd>D</kbd> ');
}

function touchify(text: string) {
  return text
    .replace(/HOLD\s+W \/ ↑\s+TO SEND IT/, 'HOLD <b>GAS</b> TO SEND IT')
    .replace(/S \/ ↓\s+TO BRAKE/, '<b>BRAKE</b>')
    .replace(/A = NOSE UP\s+D = NOSE DOWN/, '<b>NOSE UP / NOSE DOWN</b> PADS');
}

const game = new Game();
game.boot();
(window as unknown as { __sendit: Game }).__sendit = game;
if (DEBUG_BOT) {
  // Developer-only: advance the real simulation synchronously with the bot's
  // gameplay inputs (for evidence capture in throttled/hidden preview panes).
  (window as unknown as { __advanceTo: (x: number, maxSec?: number) => number }).__advanceTo = (x, maxSec = 120) => {
    const run = game.run!;
    const plan = BOT_PLANS[run.course.id][DEBUG_BOT];
    for (let i = 0; i < maxSec * 120 && run.vehicle.position.x < x && run.phase !== 'finished'; i++) {
      game.prev = snapshot(run, game.prev);
      run.step(botInput(run, plan));
      game.cur = snapshot(run, game.cur);
      game.handleEvents(run);
    }
    // Let the smoothed camera settle on the frozen moment.
    for (let k = 0; k < 120; k++) game.scene.draw(run, game.prev, game.cur, 1, 1 / 60, { throttle: 1, brake: 0 });
    return run.vehicle.position.x;
  };
}
void VEHICLES;
