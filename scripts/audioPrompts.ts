export const VOICE = {
  id: 'pqHfZKP75CvOlQylNhV4',
  name: 'Bill',
  model: 'eleven_multilingual_v2',
  settings: { stability: 0.62, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
};

export const SFX_PROMPTS: { id: string; prompt: string; dur: number; influence?: number }[] = [
  { id: 'box-thump-1', prompt: 'empty cardboard box dropped onto a metal rack, single short hollow thump, close mic', dur: 0.5 },
  { id: 'box-thump-2', prompt: 'heavy cardboard carton landing on metal cargo rack, dull thud with slight rattle', dur: 0.6 },
  { id: 'box-thump-3', prompt: 'cardboard box bumping against another cardboard box, soft papery knock', dur: 0.5 },
  { id: 'box-tumble', prompt: 'several cardboard boxes tumbling onto asphalt road, papery bounces and scrapes', dur: 1.5 },
  { id: 'box-scrape', prompt: 'cardboard box sliding across rough asphalt, short scrape', dur: 0.8 },
  { id: 'strap-creak', prompt: 'nylon ratchet strap straining under tension, stretchy creak, subtle', dur: 1.0 },
  { id: 'strap-snap', prompt: 'nylon cargo strap snapping loose with a springy twang and buckle rattle', dur: 0.8 },
  { id: 'splash-big', prompt: 'small car plunging into a backyard swimming pool, big splash then bubbling', dur: 2.5 },
  { id: 'splash-small', prompt: 'cardboard box plopping into a swimming pool, small splash', dur: 1.0 },
  { id: 'squeak-1', prompt: 'rubber squeaky toy squeezed once, short high squeak', dur: 0.5, influence: 0.7 },
  { id: 'squeak-2', prompt: 'inflatable pool flamingo squeaking as it is squished, comedic rubbery squeak', dur: 0.6, influence: 0.7 },
  { id: 'squeak-3', prompt: 'double squeak from a rubber toy, surprised sounding', dur: 0.6, influence: 0.7 },
  { id: 'land-hard', prompt: 'small three-wheel vehicle landing hard after a jump, suspension thud and spring clunk on asphalt', dur: 1.0 },
  { id: 'land-soft', prompt: 'small vehicle suspension compressing smoothly after a small bump, soft thunk', dur: 0.6 },
  { id: 'tire-chirp', prompt: 'short tire chirp on dry asphalt from hard braking', dur: 0.6 },
  { id: 'crash', prompt: 'small plastic-bodied vehicle tipping over onto pavement, comedic clatter and crunch, not violent', dur: 1.5 },
  { id: 'pickup', prompt: 'quick cartoon whoosh with a soft pop, item being grabbed', dur: 0.6 },
  { id: 'bell', prompt: 'hotel front desk service bell, single ding', dur: 1.2 },
  { id: 'stamp', prompt: 'rubber stamp thumped firmly onto paper on a wooden desk', dur: 0.5 },
  { id: 'receipt', prompt: 'thermal receipt printer printing a short receipt', dur: 1.6 },
  { id: 'register', prompt: 'small cash register cha-ching', dur: 1.0 },
  { id: 'gull', prompt: 'single seagull call near a beach', dur: 1.2 },
  { id: 'sad-horn', prompt: 'short sad tuba, two descending notes, comedic disappointment', dur: 1.5 },
  { id: 'cheer', prompt: 'small group of people at a motel pool party cheering and whooping briefly', dur: 2.0 },
  { id: 'radio-on', prompt: 'walkie talkie push to talk click with a short burst of static', dur: 0.5 },
  { id: 'radio-off', prompt: 'walkie talkie release click, short squelch tail', dur: 0.5 },
  { id: 'waves', prompt: 'gentle ocean waves on a sandy beach, calm, seamless loop', dur: 8.0 },
  { id: 'boardwalk', prompt: 'tires rolling over wooden boardwalk planks, rhythmic clunks, continuous', dur: 3.0 },
  { id: 'sprinkler', prompt: 'suburban lawn sprinkler ticking, birds chirping, quiet afternoon', dur: 6.0 },
  { id: 'trampoline', prompt: 'trampoline springs boing', dur: 0.8 },
  { id: 'wind-whoosh', prompt: 'short rush of wind passing by, airborne whoosh', dur: 1.0 },
  { id: 'honk', prompt: 'small vehicle horn, two short friendly toots', dur: 0.8 },
  { id: 'drum-hit', prompt: 'single punchy rimshot ba-dum-tss drum sting', dur: 1.0, influence: 0.7 },
  { id: 'crowd-aww', prompt: 'small crowd going aww in sympathy, brief', dur: 1.5 },
];

export const MUSIC_PROMPTS = [
  {
    id: 'run-loop',
    prompt:
      'Upbeat instrumental surf rock garage groove for a comedic arcade driving game, twangy reverb guitar, punchy drums, walking bass, playful organ stabs, sunny coastal vibe, 128 bpm, loopable, no vocals',
    ms: 90000,
  },
  {
    id: 'garage-loop',
    prompt:
      'Relaxed lo-fi funk loop for a workshop loading dock menu screen, muted guitar, electric piano, light brushed drums, warm and a little cheeky, 92 bpm, loopable, no vocals',
    ms: 60000,
  },
  {
    id: 'results-sting',
    prompt: 'Short triumphant but slightly goofy brass fanfare sting for a delivery completed screen, ends cleanly, no vocals',
    ms: 5000,
  },
  {
    id: 'fail-sting',
    prompt: 'Short comedic failure sting, deflating slide whistle into a single muted trombone note, no vocals',
    ms: 4000,
  },
];
