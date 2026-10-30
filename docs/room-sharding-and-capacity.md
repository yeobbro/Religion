# RELIGION room sharding and capacity policy

## Initial capacity

| Space | Per-room limit | Sharding |
|---|---:|---|
| Chapel | 32 visitors | Create another chapel instance when full |
| Garden | 40 visitors | Create another garden instance when full |

The current chapel scene has eight pew benches (two sides by four rows). The initial
policy models four seats per pew: 8 x 4 = 32 seats. If the 3D layout changes, update
`SPACE_CAPACITY.chapel.pews` and `seatsPerPew` with the visible seat meshes.

## Admission flow

1. Resolve the requested space (chapel or garden).
2. Find the least-populated room that is not full.
3. For the chapel, atomically reserve one free seat before admitting the visitor.
4. If no room has capacity, create a new room shard, up to the configured shard limit.
5. If the shard limit is reached, show a calm "all rooms are currently full" message
   and let the visitor retry; never silently exceed capacity.
6. Release the seat on disconnect and use a short reservation TTL for interrupted joins.

## Privacy and prayer

- A seat in use is reserved and cannot be assigned to another visitor.
- A visitor who starts prayer/meditation keeps their seat until they leave or end the
  session; nearby movement is blocked by the protected personal-space radius.
- Do not forcibly move seated/praying visitors to make room.
- The room server is authoritative for seat reservations, movement collision, prayer
  state, and room occupancy.

## Concurrency requirements

The allocation helper in `apps/web/lib/room-capacity.ts` is a deterministic policy
helper, not a concurrency-safe reservation service. The Colyseus room must serialize
seat reservations (or use a database transaction/unique constraint) so simultaneous
connections cannot reserve the same final seat or exceed the room limit.

## Scaling notes

A room shard is an independent live instance, not a separate database. All shards
share the same application deployment and persistent services. Add more server
processes/instances as traffic grows; use a shared presence/seat store if rooms can
be allocated across multiple processes.
