// Generates SFX, dispatcher voice lines and music via ElevenLabs.
// The key is read from ELEVENLABS_API_KEY and never written anywhere.
// Usage: ELEVENLABS_API_KEY=... npx vite-node scripts/gen-audio.ts -- [sfx|vo|music|all]
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { allVoiceLines } from '../src/data/humor';
import { SFX_PROMPTS, MUSIC_PROMPTS, VOICE } from './audioPrompts';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('ELEVENLABS_API_KEY not set');
const what = process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'all';
const OUT = 'public/assets/audio';
const provPath = `${OUT}/generated-provenance.json`;
const prov: Record<string, unknown> = existsSync(provPath) ? JSON.parse(readFileSync(provPath, 'utf8')) : {};

async function post(url: string, body: unknown): Promise<Buffer> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const t = await r.text();
    console.warn(`  ${r.status} ${t.slice(0, 300)}`);
    if (r.status === 429 || r.status >= 500) await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)));
    else throw new Error(`${r.status}`);
  }
  throw new Error('retries exhausted');
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const q = items.slice();
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (q.length) {
        const it = q.shift()!;
        try {
          await fn(it);
        } catch (e) {
          console.warn('FAILED', e);
        }
      }
    }),
  );
}

if (what === 'sfx' || what === 'all') {
  mkdirSync(`${OUT}/sfx`, { recursive: true });
  await pool(SFX_PROMPTS, 3, async (s) => {
    const f = `${OUT}/sfx/${s.id}.mp3`;
    if (existsSync(f)) return;
    const buf = await post('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      text: s.prompt,
      duration_seconds: s.dur,
      prompt_influence: s.influence ?? 0.55,
    });
    writeFileSync(f, buf);
    prov[`sfx/${s.id}.mp3`] = { source: 'ElevenLabs sound-generation', prompt: s.prompt, created: new Date().toISOString() };
    console.log('sfx', s.id, buf.length);
  });
}
if (what === 'vo' || what === 'all') {
  mkdirSync(`${OUT}/vo`, { recursive: true });
  await pool(allVoiceLines(), 3, async (l) => {
    const f = `${OUT}/vo/${l.id}.mp3`;
    if (existsSync(f)) return;
    const buf = await post(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}?output_format=mp3_44100_128`, {
      text: l.text,
      model_id: VOICE.model,
      voice_settings: VOICE.settings,
    });
    writeFileSync(f, buf);
    prov[`vo/${l.id}.mp3`] = { source: `ElevenLabs TTS (${VOICE.name})`, text: l.text, created: new Date().toISOString() };
    console.log('vo', l.id, buf.length);
  });
}
if (what === 'music' || what === 'all') {
  mkdirSync(`${OUT}/music`, { recursive: true });
  for (const m of MUSIC_PROMPTS) {
    const f = `${OUT}/music/${m.id}.mp3`;
    if (existsSync(f)) continue;
    try {
      const buf = await post('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
        prompt: m.prompt,
        music_length_ms: m.ms,
      });
      writeFileSync(f, buf);
      prov[`music/${m.id}.mp3`] = { source: 'ElevenLabs music', prompt: m.prompt, created: new Date().toISOString() };
      console.log('music', m.id, buf.length);
    } catch (e) {
      console.warn('music failed', m.id, e);
    }
  }
}
writeFileSync(provPath, JSON.stringify(prov, null, 2));
console.log('done');
