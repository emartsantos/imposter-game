import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setupSocketHandlers } from "./src/lib/socketHandler";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    allowUpgrades: true,
    transports: ["polling", "websocket"],
  });

  setupSocketHandlers(io);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Mode: ${dev ? "development" : "production"}`);
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
