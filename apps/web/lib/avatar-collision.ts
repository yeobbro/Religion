/**
 * Shared spatial rules for RELIGION avatars.
 *
 * Keep this module deterministic and free of browser/Three.js dependencies so
 * the same rules can run in the Colyseus authoritative simulation.
 */
export type Vec2 = { x: number; z: number };

export type AvatarPresence = {
  id: string;
  position: Vec2;
  /** Radius occupied by the avatar's body on the ground plane. */
  radius: number;
  /** A praying avatar is stationary and owns a protected personal-space zone. */
  praying?: boolean;
  /** Extra clearance around a praying avatar, in world units. */
  prayerClearance?: number;
};

export type MoveResult = {
  position: Vec2;
  blockedBy: string[];
};

const EPSILON = 1e-6;

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function stableNormal(from: Vec2, to: Vec2, selfId: string, otherId: string): Vec2 {
  const dx = from.x - to.x;
  const dz = from.z - to.z;
  const length = Math.hypot(dx, dz);
  if (length > EPSILON) return { x: dx / length, z: dz / length };

  // Stable fallback prevents NaN and avoids clients choosing different directions.
  const sign = selfId.localeCompare(otherId) <= 0 ? 1 : -1;
  return { x: sign, z: 0 };
}

/**
 * Resolve one requested ground-plane movement against nearby avatars.
 * The moving avatar never pushes another avatar. If overlap would occur,
 * its requested position is projected to the nearest legal separation.
 */
export function resolveAvatarMovement(
  self: AvatarPresence,
  requested: Vec2,
  others: readonly AvatarPresence[],
): MoveResult {
  let position = { ...requested };
  const blockedBy = new Set<string>();

  // A few deterministic passes handle crowded clusters without oscillating
  // indefinitely. Server simulation remains the final authority.
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const other of others) {
      if (other.id === self.id) continue;

      const protectedRadius = other.praying
        ? other.radius + Math.max(0, other.prayerClearance ?? 1.25)
        : other.radius;
      const minDistance = Math.max(0, self.radius) + Math.max(0, protectedRadius);
      if (distanceSquared(position, other.position) >= minDistance * minDistance) continue;

      const normal = stableNormal(position, other.position, self.id, other.id);
      position = {
        x: other.position.x + normal.x * minDistance,
        z: other.position.z + normal.z * minDistance,
      };
      blockedBy.add(other.id);
      changed = true;
    }
    if (!changed) break;
  }

  return { position, blockedBy: [...blockedBy].sort() };
}

/** True when a proposed position is clear of all avatar bodies/protected zones. */
export function isAvatarPositionClear(
  self: AvatarPresence,
  position: Vec2,
  others: readonly AvatarPresence[],
): boolean {
  return others.every((other) => {
    if (other.id === self.id) return true;
    const protectedRadius = other.praying
      ? other.radius + Math.max(0, other.prayerClearance ?? 1.25)
      : other.radius;
    const minDistance = Math.max(0, self.radius) + Math.max(0, protectedRadius);
    return distanceSquared(position, other.position) >= minDistance * minDistance;
  });
}
