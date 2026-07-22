import { Server as SocketIOServer } from "socket.io";
import { gameManager } from "./gameEngine";

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export function setupSocketHandlers(io: SocketIOServer) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on("create-room", (data: { isPublic?: boolean }) => {
      const room = gameManager.createRoom(data?.isPublic);
      socket.emit("room-created", {
        room: { code: room.code, id: room.id },
      });
    });

    socket.on("join-room", (data: { code: string; name: string; persistentId?: string }) => {
      const result = gameManager.joinRoom(data.code.toUpperCase(), data.name, socket.id, data.persistentId);
      if (result.error || !result.room || !result.player) {
        socket.emit("error", { message: result.error });
        return;
      }

      socket.join(result.room.id);
      const roomView = gameManager.getSerializableRoom(result.room);
      io.to(result.room.id).emit("room-updated", roomView);
      socket.emit("room-joined", {
        room: gameManager.getPlayerView(result.room, result.player.id),
        playerId: result.player.id,
      });
    });

    socket.on("update-settings", (data: {
      imposterCount?: number;
      turnTimeLimit?: number;
      strikesToEliminate?: number;
      selectedCategories?: string[];
      showHints?: boolean;
    }) => {
      const room = gameManager.getRoomBySocket(socket.id);
      const player = gameManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) return;

      if (data.imposterCount !== undefined) room.imposterCount = data.imposterCount;
      if (data.turnTimeLimit !== undefined) room.turnTimeLimit = data.turnTimeLimit;
      if (data.strikesToEliminate !== undefined) room.strikesToEliminate = data.strikesToEliminate;
      if (data.selectedCategories !== undefined) room.selectedCategories = data.selectedCategories;
      if (data.showHints !== undefined) room.showHints = data.showHints;

      io.to(room.id).emit("room-updated", gameManager.getSerializableRoom(room));
    });

    socket.on("start-game", () => {
      const room = gameManager.getRoomBySocket(socket.id);
      const player = gameManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) return;

      const result = gameManager.startGame(room.id);
      if (result.error) {
        socket.emit("error", { message: result.error });
        return;
      }

      for (const p of room.players.values()) {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.emit("game-started", gameManager.getPlayerView(room, p.id));
        }
      }
    });

    socket.on("submit-clue", (data: { clue: string }) => {
      const room = gameManager.getRoomBySocket(socket.id);
      const player = gameManager.getPlayerBySocket(socket.id);
      if (!room || !player) return;

      if (typeof data !== "object" || data === null || typeof data.clue !== "string") {
        socket.emit("error", { message: "Invalid input." });
        return;
      }

      const result = gameManager.submitClue(room.id, player.id, data.clue);
      if (result.error) {
        socket.emit("error", { message: result.error });
        return;
      }

      if (room.status === "finished") {
        for (const p of room.players.values()) {
          const playerSocket = io.sockets.sockets.get(p.socketId);
          if (playerSocket) {
            playerSocket.emit("game-over", gameManager.getPlayerView(room, p.id));
          }
        }
        return;
      }

      if (room.status === "voting") {
        for (const p of room.players.values()) {
          const playerSocket = io.sockets.sockets.get(p.socketId);
          if (playerSocket) {
            playerSocket.emit("voting-started", gameManager.getPlayerView(room, p.id));
          }
        }
        return;
      }

      io.to(room.id).emit("turn-changed", gameManager.getSerializableRoom(room));

      for (const p of room.players.values()) {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.emit("your-view", gameManager.getPlayerView(room, p.id));
        }
      }
    });

    socket.on("submit-vote", (data: { targetId: string }) => {
      const room = gameManager.getRoomBySocket(socket.id);
      const player = gameManager.getPlayerBySocket(socket.id);
      if (!room || !player) return;

      if (typeof data !== "object" || data === null || typeof data.targetId !== "string") {
        socket.emit("error", { message: "Invalid input." });
        return;
      }

      const result = gameManager.submitVote(room.id, player.id, data.targetId);
      if (result.error) {
        socket.emit("error", { message: result.error });
        return;
      }

      io.to(room.id).emit("vote-submitted", {
        room: gameManager.getSerializableRoom(room),
        votedCount: Object.keys(room.currentRound?.votes || {}).length,
        aliveCount: Array.from(room.players.values()).filter((p) => p.isAlive).length,
      });

      if (room.status === "finished") {
        for (const p of room.players.values()) {
          const playerSocket = io.sockets.sockets.get(p.socketId);
          if (playerSocket) {
            playerSocket.emit("game-over", gameManager.getPlayerView(room, p.id));
          }
        }
        return;
      }

      if (room.status === "results") {
        for (const p of room.players.values()) {
          const playerSocket = io.sockets.sockets.get(p.socketId);
          if (playerSocket) {
            playerSocket.emit("round-results", gameManager.getPlayerView(room, p.id));
          }
        }
      }
    });

    socket.on("next-round", () => {
      const room = gameManager.getRoomBySocket(socket.id);
      const player = gameManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) return;

      const result = gameManager.nextRound(room.id);
      if (result.error) {
        socket.emit("error", { message: result.error });
        return;
      }

      for (const p of room.players.values()) {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.emit("game-started", gameManager.getPlayerView(room, p.id));
        }
      }
    });

    socket.on("back-to-lobby", () => {
      const room = gameManager.getRoomBySocket(socket.id);
      const player = gameManager.getPlayerBySocket(socket.id);
      if (!room || !player || !player.isHost) return;

      room.status = "lobby";
      room.currentRound = null;
      room.roundHistory = [];

      for (const p of room.players.values()) {
        p.strikes = 0;
        p.isAlive = true;
        p.role = "civilian";
        p.hasGivenClue = false;
        p.clue = "";
        p.voteTarget = null;
      }

      io.to(room.id).emit("room-updated", gameManager.getSerializableRoom(room));
    });

    socket.on("leave-room", () => {
      const room = gameManager.getRoomBySocket(socket.id);
      if (!room) return;

      gameManager.removeFromRoom(socket.id);
      socket.leave(room.id);

      const updatedRoom = gameManager.getRoom(room.id);
      if (updatedRoom) {
        io.to(updatedRoom.id).emit("room-updated", gameManager.getSerializableRoom(updatedRoom));
      }

      socket.emit("left-room");
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      const result = gameManager.handleDisconnect(socket.id);
      if (result) {
        io.to(result.room.id).emit("player-disconnected", {
          room: gameManager.getSerializableRoom(result.room),
          playerName: result.player.name,
        });
      }
    });
  });

  if (!cleanupIntervalId) {
    cleanupIntervalId = setInterval(() => {
      gameManager.cleanupDisconnected();
    }, 30000);
  }
}
