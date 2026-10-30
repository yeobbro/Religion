# Avatar spatial rules

RELIGION must preserve personal space. Avatar overlap is not an acceptable visual state,
and a person in prayer/meditation must not be crowded by passers-by.

## Rules

- Each avatar has a ground-plane collision radius.
- Movement is resolved against other avatars before the new position is broadcast.
- Moving avatars do not push stationary avatars; the moving avatar is projected to the
  nearest legal position and may need to route around the obstruction.
- A praying avatar is stationary and creates a protected zone larger than its body radius.
  The default additional clearance is 1.25 world units; tune it after playtesting.
- If a prayer zone is occupied when prayer begins, the server must reject the transition
  or ask the player to move to a clear location. Never teleport nearby users.
- The server is authoritative. Client-side prediction may smooth movement, but clients
  must reconcile to the server's accepted position.
- For crowded spaces, use a navigation/steering layer to find a nearby open path rather
  than repeatedly pushing directly into a blocked position.
- Provide a respectful interaction distance; do not auto-trigger greetings or interactions
  merely because collision boundaries touch.

## Implementation

`apps/web/lib/avatar-collision.ts` contains deterministic, renderer-independent helpers.
The same functions/rules should be used by the Colyseus room simulation. Do not treat
client-only collision as security or authoritative multiplayer validation.
