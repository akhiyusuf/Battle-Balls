/** Canvas is TikTok/Shorts portrait resolution. */
export const VIEW_W = 1080;
export const VIEW_H = 1920;

/** The square arena, centered like Ball Thing's layout. */
export const ARENA_SIZE = 830;
export const ARENA_X = (VIEW_W - ARENA_SIZE) / 2;
export const ARENA_Y = 430;

export const WATERMARK = "@ballthingsim replica";

/** Fixed physics timestep. */
export const STEP = 1 / 120;

/**
 * Matter.js expresses velocity in px per 1/60s tick, NOT px per second.
 * Multiply any px/s speed by VEL before handing it to Matter, and multiply
 * Matter velocities by 60 to read them back as px/s. Without this the whole
 * sim runs an order of magnitude faster than intended.
 */
export const VEL = 1 / 60;

/** Per attacker+weapon hit cooldown on a target (s). */
export const HIT_COOLDOWN = 0.85;

/** Ult meter capacity. */
export const METER_MAX = 100;
