'use client';

import { useEffect, useState } from "react";
import { Client, type Room } from "colyseus.js";

type Space = "chapel" | "garden";
type Visitor = {
  id: string;
  displayName: string;
  x: number;
  z: number;
  yaw: number;
  praying: boolean;
  seatNumber?: number;
};
type RoomSnapshot = {
  roomId: string;
  occupancy: number;
  capacity: number;
  visitors: Visitor[];
};
type RoomStatus = "offline" | "connecting" | "connected" | "error";

export function useReligionRoom(space: Space, baptismalName: string, enabled = true) {
  const [status, setStatus] = useState<RoomStatus>("offline");
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [seatNumber, setSeatNumber] = useState<number | undefined>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
    if (!enabled || !endpoint) {
      setStatus("offline");
      setSnapshot(null);
      return;
    }

    let active = true;
    let room: Room | undefined;
    setStatus("connecting");
    setMessage("");

    const connect = async () => {
      try {
        const client = new Client(endpoint);
        room = await client.joinOrCreate("spiritual-space", {
          space,
          displayName: baptismalName.trim().slice(0, 18) || "순례자",
        });
        if (!active) {
          await room.leave();
          return;
        }

        setStatus("connected");
        room.onMessage("room:joined", (payload: { seatNumber?: number }) => {
          if (active) setSeatNumber(payload.seatNumber);
        });
        room.onMessage("visitors:update", (payload: RoomSnapshot) => {
          if (active) setSnapshot(payload);
        });
        room.onMessage("prayer:rejected", (payload: { reason?: string }) => {
          if (active) setMessage(payload.reason ?? "현재 위치에서는 기도를 시작할 수 없습니다.");
        });
        room.onMessage("prayer:accepted", () => {
          if (active) setMessage("기도 상태가 적용되었습니다.");
        });
        room.onLeave(() => {
          if (active) {
            setStatus("offline");
            setSnapshot(null);
          }
        });
      } catch {
        if (active) {
          setStatus("error");
          setMessage("실시간 공간 서버에 연결할 수 없습니다.");
        }
      }
    };

    void connect();
    return () => {
      active = false;
      if (room) void room.leave();
    };
  }, [space, baptismalName, enabled]);

  return {
    status,
    occupancy: snapshot?.occupancy ?? 0,
    capacity: snapshot?.capacity ?? (space === "chapel" ? 32 : 40),
    roomId: snapshot?.roomId,
    visitors: snapshot?.visitors ?? [],
    seatNumber,
    message,
  };
}
