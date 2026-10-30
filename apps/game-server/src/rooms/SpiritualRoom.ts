import { Room, type Client } from "@colyseus/core";

type Space = "chapel" | "garden";
type Position = { x: number; z: number };
type Visitor = {
  id: string;
  displayName: string;
  x: number;
  z: number;
  yaw: number;
  praying: boolean;
  seatNumber?: number;
  radius: number;
};

const CAPACITY: Record<Space, number> = { chapel: 32, garden: 40 };
const PRAYER_CLEARANCE = 1.25;
const MOVE_SPEED_LIMIT = 4.5;
const WORLD_BOUNDS: Record<Space, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  chapel: { minX: -7.2, maxX: 7.2, minZ: -14, maxZ: 8 },
  garden: { minX: -8, maxX: 8, minZ: -12, maxZ: 9 },
};

function chapelSeatPosition(seatNumber: number): Position {
  const pewIndex = Math.floor((seatNumber - 1) / 4);
  const seatIndex = (seatNumber - 1) % 4;
  const side = pewIndex < 4 ? -1 : 1;
  const row = pewIndex % 4;
  return {
    x: side * 4.1 + (seatIndex - 1.5) * 0.66,
    z: [-5, -1.5, 2, 5.5][row],
  };
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class SpiritualRoom extends Room {
  private space: Space = "chapel";
  private visitors = new Map<string, Visitor>();
  private usedSeats = new Set<number>();

  onCreate(options: { space?: Space }) {
    this.space = options.space === "garden" ? "garden" : "chapel";
    this.maxClients = CAPACITY[this.space];
    this.setMetadata({ space: this.space, capacity: this.maxClients });

    this.onMessage("move", (client, message: { x?: number; z?: number; yaw?: number }) => {
      this.moveVisitor(client, message);
    });
    this.onMessage("prayer:set", (client, message: { praying?: boolean }) => {
      this.setPrayerState(client, Boolean(message?.praying));
    });
    this.onMessage("greeting", (client, message: { targetId?: string }) => {
      this.sendGreeting(client, message?.targetId);
    });
    this.onMessage("visitors:request", client => {
      client.send("visitors:update", this.snapshot());
    });
    this.setSimulationInterval(() => this.broadcast("visitors:update", this.snapshot()), 250);
  }

  onJoin(client: Client, options: { displayName?: string }) {
    if (this.visitors.size >= this.maxClients) {
      client.leave(4001, "ROOM_FULL");
      return;
    }

    const seatNumber = this.space === "chapel" ? this.reserveSeat() : undefined;
    if (this.space === "chapel" && seatNumber === undefined) {
      client.leave(4001, "NO_SEATS_AVAILABLE");
      return;
    }

    const spawn = seatNumber ? chapelSeatPosition(seatNumber) : this.gardenSpawn();
    const visitor: Visitor = {
      id: client.sessionId,
      displayName: this.sanitizeName(options?.displayName),
      x: spawn.x,
      z: spawn.z,
      yaw: 0,
      praying: false,
      ...(seatNumber === undefined ? {} : { seatNumber }),
      radius: 0.42,
    };
    this.visitors.set(client.sessionId, visitor);
    client.send("room:joined", {
      roomId: this.roomId,
      space: this.space,
      capacity: this.maxClients,
      occupancy: this.visitors.size,
      seatNumber,
      visitor,
    });
    this.broadcast("visitors:update", this.snapshot());
  }

  onLeave(client: Client) {
    const visitor = this.visitors.get(client.sessionId);
    if (visitor?.seatNumber) this.usedSeats.delete(visitor.seatNumber);
    this.visitors.delete(client.sessionId);
    this.broadcast("visitors:update", this.snapshot());
  }

  private reserveSeat(): number | undefined {
    for (let seat = 1; seat <= CAPACITY.chapel; seat += 1) {
      if (!this.usedSeats.has(seat)) {
        this.usedSeats.add(seat);
        return seat;
      }
    }
    return undefined;
  }

  private gardenSpawn(): Position {
    const index = this.visitors.size;
    const angle = index * 2.399963;
    const radius = 2.5 + (index % 4) * 0.55;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  }

  private sanitizeName(value?: string): string {
    const clean = (value ?? "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 18);
    return clean || `순례자-${String(this.clients.length).padStart(2, "0")}`;
  }

  private moveVisitor(client: Client, message: { x?: number; z?: number; yaw?: number }) {
    const visitor = this.visitors.get(client.sessionId);
    if (!visitor || visitor.praying) return;
    if (!Number.isFinite(message?.x) || !Number.isFinite(message?.z)) return;

    const bounds = WORLD_BOUNDS[this.space];
    const requested = {
      x: clamp(message.x as number, bounds.minX, bounds.maxX),
      z: clamp(message.z as number, bounds.minZ, bounds.maxZ),
    };
    const step = distance(visitor, requested);
    if (step > MOVE_SPEED_LIMIT * 0.5) return;

    let resolved = requested;
    for (let pass = 0; pass < 4; pass += 1) {
      for (const other of this.visitors.values()) {
        if (other.id === visitor.id) continue;
        const minDistance = visitor.radius + other.radius + (other.praying ? PRAYER_CLEARANCE : 0);
        const gap = distance(resolved, other);
        if (gap >= minDistance) continue;
        const dx = resolved.x - other.x;
        const dz = resolved.z - other.z;
        const length = Math.hypot(dx, dz) || 1;
        resolved = {
          x: other.x + (dx / length) * minDistance,
          z: other.z + (dz / length) * minDistance,
        };
      }
    }

    visitor.x = clamp(resolved.x, bounds.minX, bounds.maxX);
    visitor.z = clamp(resolved.z, bounds.minZ, bounds.maxZ);
    if (Number.isFinite(message.yaw)) visitor.yaw = message.yaw as number;
    this.broadcast("visitors:update", this.snapshot());
  }

  private setPrayerState(client: Client, praying: boolean) {
    const visitor = this.visitors.get(client.sessionId);
    if (!visitor) return;
    if (praying) {
      const blocked = [...this.visitors.values()].some(other =>
        other.id !== visitor.id &&
        distance(visitor, other) < visitor.radius + other.radius + PRAYER_CLEARANCE
      );
      if (blocked) {
        client.send("prayer:rejected", {
          reason: "주변에 다른 방문자가 있어요. 조금 떨어진 조용한 자리에서 기도해 주세요.",
        });
        return;
      }
    }
    visitor.praying = praying;
    client.send("prayer:accepted", { praying });
    this.broadcast("visitors:update", this.snapshot());
  }

  private sendGreeting(client: Client, targetId?: string) {
    if (!targetId || targetId === client.sessionId) return;
    const sender = this.visitors.get(client.sessionId);
    const target = this.visitors.get(targetId);
    if (!sender || !target || sender.praying || target.praying) return;
    if (distance(sender, target) > 2.2) {
      client.send("greeting:rejected", { reason: "조금 더 가까이 다가가야 인사를 전할 수 있어요." });
      return;
    }
    this.clients.find(item => item.sessionId === targetId)?.send("greeting:received", {
      from: sender.displayName,
      message: "평화가 함께하기를 바랍니다.",
    });
  }

  private snapshot() {
    return {
      roomId: this.roomId,
      space: this.space,
      occupancy: this.visitors.size,
      capacity: this.maxClients,
      visitors: [...this.visitors.values()].map(visitor => ({ ...visitor })),
    };
  }
}