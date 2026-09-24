import type { InputState } from '../sim/types';
import { wrapAngle, clamp } from '../sim/physics';
import type { Run } from './run';

export interface BotPlan {
  /** Target forward speed by x: [x, speed] breakpoints (step function). */
  speeds: [number, number][];
  /** Stop target x (centre of the bay). */
  stopX: number;
}

/**
 * Gameplay-control driver used for headless tuning and the attract loop.
 * It only produces throttle/brake/pitch, exactly like a player.
 */
export function botInput(run: Run, plan: BotPlan): InputState {
  const v = run.vehicle;
  const p = v.position;
  const a = wrapAngle(v.angle);
  const w = v.chassis.angvel();
  const speed = v.forwardSpeed;

  let target = plan.speeds[0][1];
  for (const [x, s] of plan.speeds) if (p.x >= x) target = s;
  // Brake for the bay.
  const toStop = plan.stopX - p.x;
  if (toStop < 40) target = Math.min(target, Math.max(0, Math.sqrt(Math.max(0, toStop) * 2 * 4.5)));
  if (toStop < 0.5) target = 0;

  let throttle = 0;
  let brake = 0;
  const err = target - speed;
  if (err > 0.4) throttle = clamp(err / 3, 0.3, 1);
  else if (err < -1.2) brake = clamp(-err / 4, 0.2, 1);
  if (target === 0 && speed > 0.2) brake = 1;
  if (target === 0 && speed < 0.3) brake = 0.3;

  let pitch = 0;
  if (v.airborne) {
    // Aim roughly level, slightly nose-down on descent.
    const vy = v.chassis.linvel().y;
    const want = clamp(Math.atan2(vy, Math.max(4, v.chassis.linvel().x)) * 0.6, -0.5, 0.35);
    pitch = clamp((want - a) * 2.2 - w * 0.55, -1, 1);
  } else if (a > 0.35 && throttle > 0) {
    throttle *= 0.4; // don't loop out on a wheelie
    pitch = -0.6;
  }
  return { throttle, brake, pitch };
}
