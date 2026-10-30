/**
 * Capacity policy for RELIGION virtual spaces.
 *
 * The chapel starts with 8 pews (2 sides x 4 rows), four seats per pew.
 * Change the physical seat layout and this config together.
 */
export const SPACE_CAPACITY = {
  chapel: {
    label: '성당 내부',
    pews: 8,
    seatsPerPew: 4,
    maxVisitors: 32,
    maxRooms: 50,
    roomPrefix: 'chapel',
  },
  garden: {
    label: '외부 정원',
    // The garden has no fixed seating plan; use a comfortable soft cap.
    maxVisitors: 40,
    maxRooms: 50,
    roomPrefix: 'garden',
  },
} as const;

export type SpaceKind = keyof typeof SPACE_CAPACITY;

export type RoomLoad = {
  roomId: string;
  space: SpaceKind;
  occupants: number;
  capacity: number;
  /** Number of occupied/reserved seats. */
  occupiedSeats?: number;
};

export type RoomAllocation =
  | { status: 'join'; roomId: string; seatNumber?: number; occupancy: number; capacity: number }
  | { status: 'create'; roomId: string; seatNumber?: number; occupancy: 0; capacity: number }
  | { status: 'full'; space: SpaceKind; capacity: number; roomCount: number };

function nextRoomId(space: SpaceKind, existing: readonly RoomLoad[]): string {
  const prefix = SPACE_CAPACITY[space].roomPrefix;
  const used = new Set(existing.filter(room => room.space === space).map(room => room.roomId));
  for (let index = 1; index <= SPACE_CAPACITY[space].maxRooms; index += 1) {
    const candidate = `${prefix}-${String(index).padStart(3, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return '';
}

/**
 * Select the least-populated room with capacity. If all existing rooms are full,
 * create the next shard until maxRooms is reached.
 *
 * For the chapel, seatNumber is a stable 1-based seat slot. A production room
 * server must atomically reserve the seat before admitting the connection.
 */
export function allocateRoom(
  space: SpaceKind,
  rooms: readonly RoomLoad[],
): RoomAllocation {
  const policy = SPACE_CAPACITY[space];
  const current = rooms.filter(room => room.space === space);
  const available = current
    .filter(room => room.occupants < policy.maxVisitors)
    .sort((a, b) => a.occupants - b.occupants || a.roomId.localeCompare(b.roomId))[0];

  if (available) {
    const seatNumber = space === 'chapel'
      ? findNextSeat(available.occupiedSeats ?? available.occupants, policy.maxVisitors)
      : undefined;
    return {
      status: 'join',
      roomId: available.roomId,
      ...(seatNumber === undefined ? {} : { seatNumber }),
      occupancy: available.occupants,
      capacity: policy.maxVisitors,
    };
  }

  if (current.length >= policy.maxRooms) {
    return { status: 'full', space, capacity: policy.maxVisitors, roomCount: current.length };
  }

  const roomId = nextRoomId(space, current);
  if (!roomId) return { status: 'full', space, capacity: policy.maxVisitors, roomCount: current.length };
  return {
    status: 'create',
    roomId,
    ...(space === 'chapel' ? { seatNumber: 1 } : {}),
    occupancy: 0,
    capacity: policy.maxVisitors,
  };
}

/**
 * Find a free 1-based chapel seat from a bitset-style boolean occupancy array.
 * The count-only fallback is deterministic, but a real room must pass actual
 * reserved seat slots to avoid two simultaneous joins receiving one seat.
 */
export function findNextSeat(occupiedCount: number, capacity = SPACE_CAPACITY.chapel.maxVisitors): number {
  return occupiedCount >= capacity ? -1 : Math.max(1, Math.floor(occupiedCount) + 1);
}
