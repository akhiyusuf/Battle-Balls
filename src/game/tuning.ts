/**
 * All gameplay tuning in one place. Keeping the feel knobs together (instead
 * of scattered as magic numbers across the engine) is what makes the sim
 * quick to re-balance.
 */

/** Ball physics. */
export const BALL = {
  /** Bouncy: balls ricochet off each other and the walls energetically. */
  restitution: 0.6,
  density: 0.0012,
};

/** Weapon physics (sensor — detects hits, never shoves). */
export const WEAPON = {
  density: 0.0004,
};

/**
 * Movement model. Fighters keep CONSTANT cruise speed (their heading comes
 * from physics bounces, so they ricochet around the arena) plus a gentle
 * homing bias toward the enemy that only kicks in once they drift apart —
 * so they brawl-and-bounce when close and regroup when far, instead of
 * gluing together or drifting off like a DVD logo.
 */
export const MOVE = {
  /** Below this gap (px) homing is off — pure bouncing while they brawl. */
  homeNear: 20,
  /** By this gap homing is at full strength — reel them back together. */
  homeFar: 220,
  /** Max heading turn from homing (rad/s) at full strength. */
  homeTurn: 9,
  /** A touch of wobble so groups don't collapse to one point. */
  wobble: 0.25,
};

/** Combat. */
export const COMBAT = {
  /** Seconds a weapon can't re-hit the same target. */
  hitCooldown: 0.55,
  /** Seconds between contact-damage ticks (rammers). */
  bodyCooldown: 0.4,
  /** Seconds between weapon-clash sparks for a pair. */
  clashCooldown: 0.25,
  /** Knockback impulse (px/s) = base + dmg*perDmg, capped. */
  knockBase: 55,
  knockPerDmg: 6,
  knockCap: 300,
  /** Damage ramps up after this many seconds so fights always end. */
  suddenDeathAfter: 38,
  suddenDeathOver: 30,
};

/** Screen-shake ceiling. */
export const SHAKE_CAP = 26;
