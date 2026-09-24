import type { BotPlan } from '../game/bot';

// Target-speed scripts for the headless playtest driver and attract mode.
export const BOT_PLANS: Record<string, Record<string, BotPlan>> = {
  sunset: {
    safe: { speeds: [[-50, 9], [44, 7], [62, 10], [100, 9], [112, 7], [126, 5], [138, 11], [226, 7], [240, 9]], stopX: 294 },
    pool: { speeds: [[-50, 12], [44, 10], [62, 15], [92, 24], [141, 7]], stopX: 294 },
    floor: { speeds: [[-50, 30]], stopX: 294 },
    cruise: { speeds: [[-50, 14]], stopX: 294 },
    shortcut: { speeds: [[-50, 12], [44, 10], [62, 15], [92, 24], [140, 24], [196, 12], [222, 13], [240, 10]], stopX: 294 },
  },
};
