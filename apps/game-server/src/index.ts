import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { SpiritualRoom } from "./rooms/SpiritualRoom.js";

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "*")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "religion-game-server" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  gracefullyShutdown: true,
});

gameServer.define("spiritual-space", SpiritualRoom).filterBy(["space"]);

httpServer.on("upgrade", (request, socket) => {
  const origin = request.headers.origin;
  if (allowedOrigins.includes("*") || (origin && allowedOrigins.includes(origin))) return;
  socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
  socket.destroy();
});

await gameServer.listen(port, host);
console.log(`RELIGION game server listening on ${host}:${port}`);