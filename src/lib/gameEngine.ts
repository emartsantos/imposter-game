import { v4 as uuidv4 } from "uuid";
import { categories, WordCategory } from "./words";

export type GameStatus = "lobby" | "clue" | "voting" | "results" | "finished";
export type PlayerRole = "civilian" | "imposter";

export interface Player {
  id: string;
  name: string;
  socketId: string;
  strikes: number;
  isAlive: boolean;
  isHost: boolean;
  role: PlayerRole;
  hasGivenClue: boolean;
  clue: string;
  voteTarget: string | null;
  disconnected: boolean;
  disconnectedAt: number | null;
  persistentId: string;
}

export interface RoundState {
  roundNumber: number;
  secretWord: string;
  category: string;
  imposterIds: string[];
  imposterHint: string;
  clues: Record<string, string>;
  votes: Record<string, string>;
  turnOrder: string[];
  currentTurnIndex: number;
  turnStartTime: number;
  turnTimeLimit: number;
  status: "active" | "voting" | "ended";
}

export interface RoomState {
  id: string;
  code: string;
  isPublic: boolean;
  maxPlayers: number;
  status: GameStatus;
  players: Map<string, Player>;
  currentRound: RoundState | null;
  roundHistory: RoundState[];
  hostId: string;
  strikesToEliminate: number;
  turnTimeLimit: number;
  imposterCount: number;
  selectedCategories: string[];
  showHints: boolean;
  createdAt: number;
}

const TURN_TIME_LIMIT = 20;
const STRIKES_TO_ELIMINATE = 3;
const MAX_PLAYERS = 20;
const MIN_PLAYERS = 3;

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateImposterCount(playerCount: number): number {
  if (playerCount <= 4) return 1;
  if (playerCount <= 7) return 1;
  if (playerCount <= 10) return 2;
  if (playerCount <= 14) return 3;
  if (playerCount <= 17) return 4;
  return 5;
}

function countSyllables(word: string): number {
  const vowels = "aeiouAEIOU";
  let count = 0;
  let prevVowel = false;
  for (const ch of word) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  return Math.max(count, 1);
}

function generateImposterHint(word: string, _category: string): string {
  const firstLetter = word.charAt(0).toUpperCase();
  const letterCount = word.length;
  const syllableCount = countSyllables(word);
  return `${firstLetter} | ${letterCount} letters | ${syllableCount} syllable${syllableCount > 1 ? "s" : ""}`;
}

export class GameManager {
  private rooms: Map<string, RoomState> = new Map();
  private codeToId: Map<string, string> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private persistentToPlayer: Map<string, { roomId: string; playerId: string }> = new Map();
  private usedWords: Map<string, Set<string>> = new Map();
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();

  createRoom(isPublic: boolean = false): RoomState {
    let code = generateRoomCode();
    while (this.codeToId.has(code)) {
      code = generateRoomCode();
    }

    const id = uuidv4();
    const room: RoomState = {
      id,
      code,
      isPublic,
      maxPlayers: MAX_PLAYERS,
      status: "lobby",
      players: new Map(),
      currentRound: null,
      roundHistory: [],
      hostId: "",
      strikesToEliminate: STRIKES_TO_ELIMINATE,
      turnTimeLimit: TURN_TIME_LIMIT,
      imposterCount: 1,
      selectedCategories: [],
      showHints: true,
      createdAt: Date.now(),
    };

    this.rooms.set(id, room);
    this.codeToId.set(code, id);
    return room;
  }

  joinRoom(
    roomCode: string,
    playerName: string,
    socketId: string,
    persistentId?: string
  ): { room: RoomState; player: Player; error?: string } | { room: null; player: null; error: string } {
    const roomId = this.codeToId.get(roomCode);
    if (!roomId) return { room: null, player: null, error: "Room not found." };

    const room = this.rooms.get(roomId);
    if (!room) return { room: null, player: null, error: "Room not found." };

    if (room.status !== "lobby") {
      const existingPlayer = this.findPlayerByPersistentId(room, persistentId || "");
      if (existingPlayer) {
        existingPlayer.socketId = socketId;
        existingPlayer.disconnected = false;
        existingPlayer.disconnectedAt = null;
        this.socketToRoom.set(socketId, roomId);
        return { room, player: existingPlayer };
      }
      return { room: null, player: null, error: "Game already in progress." };
    }

    const existingBySocket = this.getPlayerBySocket(socketId);
    if (existingBySocket) {
      return { room, player: existingBySocket };
    }

    if (room.players.size >= room.maxPlayers) {
      return { room: null, player: null, error: "Room is full." };
    }

    const nameExists = Array.from(room.players.values()).some(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (nameExists) {
      return { room: null, player: null, error: "Name is already taken." };
    }

    const playerId = persistentId && this.persistentToPlayer.has(persistentId)
      ? this.persistentToPlayer.get(persistentId)!.playerId
      : uuidv4();

    const player: Player = {
      id: playerId,
      name: playerName,
      socketId,
      strikes: 0,
      isAlive: true,
      isHost: room.players.size === 0,
      role: "civilian",
      hasGivenClue: false,
      clue: "",
      voteTarget: null,
      disconnected: false,
      disconnectedAt: null,
      persistentId: persistentId || playerId,
    };

    if (room.players.size === 0) {
      room.hostId = player.id;
    }

    room.players.set(playerId, player);
    this.socketToRoom.set(socketId, roomId);

    if (persistentId) {
      this.persistentToPlayer.set(persistentId, { roomId, playerId });
    }

    return { room, player };
  }

  private findPlayerByPersistentId(room: RoomState, persistentId: string): Player | null {
    for (const player of room.players.values()) {
      if (player.persistentId === persistentId) return player;
    }
    return null;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByCode(code: string): RoomState | undefined {
    const roomId = this.codeToId.get(code);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getRoomBySocket(socketId: string): RoomState | undefined {
    const roomId = this.socketToRoom.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;
    for (const player of room.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return undefined;
  }

  startGame(roomId: string, options?: {
    imposterCount?: number;
    turnTimeLimit?: number;
    strikesToEliminate?: number;
    selectedCategories?: string[];
    showHints?: boolean;
  }): { round: RoundState; error?: string } | { round: null; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { round: null, error: "Room not found." };

    const alivePlayers = Array.from(room.players.values()).filter((p) => p.isAlive);
    if (alivePlayers.length < MIN_PLAYERS) {
      return { round: null, error: `Need at least ${MIN_PLAYERS} players to start.` };
    }

    if (options) {
      if (options.imposterCount !== undefined) room.imposterCount = options.imposterCount;
      if (options.turnTimeLimit !== undefined) room.turnTimeLimit = options.turnTimeLimit;
      if (options.strikesToEliminate !== undefined) room.strikesToEliminate = options.strikesToEliminate;
      if (options.selectedCategories !== undefined) room.selectedCategories = options.selectedCategories;
      if (options.showHints !== undefined) room.showHints = options.showHints;
    }

    const imposterCount = Math.min(room.imposterCount, calculateImposterCount(alivePlayers.length));
    const usedWords = this.usedWords.get(roomId) || new Set<string>();

    const availableCategories = room.selectedCategories.length > 0
      ? categories.filter((c) => room.selectedCategories.includes(c.id))
      : categories;

    let secretWord = "";
    let selectedCategory: WordCategory | null = null;
    let attempts = 0;

    while (attempts < 100) {
      selectedCategory = pickRandom(availableCategories);
      const word = pickRandom(selectedCategory.words);
      if (!usedWords.has(word)) {
        secretWord = word;
        break;
      }
      attempts++;
    }

    if (!secretWord) {
      usedWords.clear();
      selectedCategory = pickRandom(availableCategories);
      secretWord = pickRandom(selectedCategory!.words);
    }

    usedWords.add(secretWord);
    this.usedWords.set(roomId, usedWords);

    const playerIds = shuffleArray(alivePlayers.map((p) => p.id));
    const imposterIds = playerIds.slice(0, imposterCount);

    const round: RoundState = {
      roundNumber: room.roundHistory.length + 1,
      secretWord,
      category: selectedCategory!.tagalog,
      imposterIds,
      imposterHint: generateImposterHint(secretWord, selectedCategory!.tagalog),
      clues: {},
      votes: {},
      turnOrder: playerIds,
      currentTurnIndex: 0,
      turnStartTime: Date.now(),
      turnTimeLimit: room.turnTimeLimit,
      status: "active",
    };

    for (const player of alivePlayers) {
      player.role = imposterIds.includes(player.id) ? "imposter" : "civilian";
      player.hasGivenClue = false;
      player.clue = "";
      player.voteTarget = null;
    }

    room.currentRound = round;
    room.status = "clue";

    return { round };
  }

  private startTurnTimer(roomId: string) {
    this.clearTurnTimer(roomId);

    const roomData = this.rooms.get(roomId);
    const timeLimit = roomData?.currentRound?.turnTimeLimit || TURN_TIME_LIMIT;

    const timer = setTimeout(() => {
      const room = this.rooms.get(roomId);
      if (!room || !room.currentRound || room.status !== "clue") return;
      this.skipCurrentTurn(roomId);
    }, timeLimit * 1000);

    this.turnTimers.set(roomId, timer);
  }

  private clearTurnTimer(roomId: string) {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }

  skipCurrentTurn(roomId: string): { skipped: boolean; nextTurn: boolean; roundEnded: boolean } {
    const room = this.rooms.get(roomId);
    if (!room || !room.currentRound) return { skipped: false, nextTurn: false, roundEnded: false };

    const round = room.currentRound;
    const currentPlayerId = round.turnOrder[round.currentTurnIndex];
    const currentPlayer = room.players.get(currentPlayerId);

    if (currentPlayer && !currentPlayer.hasGivenClue) {
      currentPlayer.hasGivenClue = true;
      currentPlayer.clue = "[Skipped]";
      round.clues[currentPlayerId] = "[Skipped]";
    }

    this.clearTurnTimer(roomId);

    return this.advanceToNextTurn(roomId);
  }

  submitClue(roomId: string, playerId: string, clue: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room || !room.currentRound) return { success: false, error: "No active game." };

    if (typeof clue !== "string") return { success: false, error: "Invalid clue." };

    const round = room.currentRound;
    if (round.status !== "active") return { success: false, error: "Not your turn yet." };

    const currentPlayerId = round.turnOrder[round.currentTurnIndex];
    if (currentPlayerId !== playerId) return { success: false, error: "It's not your turn." };

    const player = room.players.get(playerId);
    if (!player) return { success: false, error: "Player not found." };

    const trimmedClue = clue.trim();
    if (!trimmedClue) return { success: false, error: "Clue cannot be empty." };
    if (trimmedClue.length > 100) return { success: false, error: "Clue too long (max 100 characters)." };

    if (player.role === "imposter") {
      const lowerClue = trimmedClue.toLowerCase();
      const lowerWord = round.secretWord.toLowerCase();
      if (lowerClue === lowerWord) {
        room.status = "finished";
        return { success: true };
      }
    }

    player.hasGivenClue = true;
    player.clue = trimmedClue;
    round.clues[playerId] = trimmedClue;

    const result = this.advanceToNextTurn(roomId);

    return { success: true };
  }

  private advanceToNextTurn(roomId: string): { skipped: boolean; nextTurn: boolean; roundEnded: boolean } {
    const room = this.rooms.get(roomId);
    if (!room || !room.currentRound) return { skipped: false, nextTurn: false, roundEnded: false };

    const round = room.currentRound;
    const alivePlayers = Array.from(room.players.values()).filter((p) => p.isAlive);
    const allGivenClue = alivePlayers.every((p) => p.hasGivenClue);

    if (allGivenClue) {
      round.status = "voting";
      room.status = "voting";
      return { skipped: false, nextTurn: false, roundEnded: false };
    }

    let nextIndex = round.currentTurnIndex + 1;
    let attempts = 0;

    while (attempts < round.turnOrder.length) {
      const nextPlayerId = round.turnOrder[nextIndex % round.turnOrder.length];
      const nextPlayer = room.players.get(nextPlayerId);
      if (nextPlayer && nextPlayer.isAlive && !nextPlayer.hasGivenClue) {
        break;
      }
      nextIndex++;
      attempts++;
    }

    round.currentTurnIndex = nextIndex % round.turnOrder.length;
    round.turnStartTime = Date.now();

    return { skipped: false, nextTurn: true, roundEnded: false };
  }

  submitVote(roomId: string, voterId: string, targetId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room || !room.currentRound) return { success: false, error: "No active game." };

    if (typeof targetId !== "string") return { success: false, error: "Invalid vote target." };

    const round = room.currentRound;
    if (round.status !== "voting") return { success: false, error: "Not time to vote yet." };

    const voter = room.players.get(voterId);
    if (!voter || !voter.isAlive) return { success: false, error: "You cannot vote." };

    if (round.votes[voterId]) return { success: false, error: "You already voted." };

    const targetPlayer = room.players.get(targetId);
    if (!targetPlayer || !targetPlayer.isAlive) return { success: false, error: "Invalid vote target." };

    round.votes[voterId] = targetId;

    const alivePlayers = Array.from(room.players.values()).filter((p) => p.isAlive);
    const allVoted = alivePlayers.every((p) => round.votes[p.id]);

    if (allVoted) {
      this.tallyVotes(roomId);
    }

    return { success: true };
  }

  private tallyVotes(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || !room.currentRound) return;

    const round = room.currentRound;
    const voteCounts: Record<string, number> = {};

    for (const targetId of Object.values(round.votes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    const totalVotes = Object.values(round.votes).length;
    const majorityThreshold = Math.floor(totalVotes / 2) + 1;

    let maxVotes = 0;
    let eliminatedId: string | null = null;

    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = targetId;
      }
    }

    const hasMajority = eliminatedId !== null && maxVotes >= majorityThreshold;

    if (hasMajority && eliminatedId) {
      const eliminatedPlayer = room.players.get(eliminatedId);
      if (eliminatedPlayer) {
        eliminatedPlayer.strikes++;

        if (eliminatedPlayer.strikes >= room.strikesToEliminate) {
          eliminatedPlayer.isAlive = false;
        }
      }
    }

    round.status = "ended";

    const aliveImposters = Array.from(room.players.values()).filter(
      (p) => p.isAlive && p.role === "imposter"
    );
    const aliveCivilians = Array.from(room.players.values()).filter(
      (p) => p.isAlive && p.role === "civilian"
    );

    if (aliveImposters.length === 0) {
      room.status = "finished";
      room.roundHistory.push({ ...round });
      return;
    }

    if (aliveCivilians.length <= aliveImposters.length) {
      room.status = "finished";
      room.roundHistory.push({ ...round });
      return;
    }

    if (!hasMajority) {
      room.status = "finished";
      room.roundHistory.push({ ...round });
      return;
    }

    room.status = "results";
    room.roundHistory.push({ ...round });
  }

  nextRound(roomId: string): { round: RoundState; error?: string } | { round: null; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { round: null, error: "Room not found." };

    if (room.status !== "results") return { round: null, error: "Round not over yet." };

    const alivePlayers = Array.from(room.players.values()).filter((p) => p.isAlive);
    if (alivePlayers.length < MIN_PLAYERS) {
      room.status = "finished";
      return { round: null, error: "Not enough players to continue." };
    }

    return this.startGame(roomId);
  }

  handleDisconnect(socketId: string): { room: RoomState; player: Player } | null {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const player = this.getPlayerBySocket(socketId);
    if (!player) return null;

    player.disconnected = true;
    player.disconnectedAt = Date.now();
    this.socketToRoom.delete(socketId);

    if (player.isHost) {
      const alivePlayers = Array.from(room.players.values()).filter(
        (p) => p.isAlive && !p.disconnected
      );
      if (alivePlayers.length > 0) {
        alivePlayers[0].isHost = true;
        room.hostId = alivePlayers[0].id;
      }
    }

    return { room, player };
  }

  removeFromRoom(socketId: string): void {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = this.getPlayerBySocket(socketId);
    if (!player) return;

    this.socketToRoom.delete(socketId);

    if (room.status === "lobby") {
      room.players.delete(player.id);

      if (room.players.size === 0) {
        this.deleteRoom(roomId);
        return;
      }

      if (player.isHost) {
        const firstPlayer = Array.from(room.players.values())[0];
        firstPlayer.isHost = true;
        room.hostId = firstPlayer.id;
      }
    } else {
      player.disconnected = true;
      player.disconnectedAt = Date.now();
    }
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const player of room.players.values()) {
      this.socketToRoom.delete(player.socketId);
    }

    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }

    this.rooms.delete(roomId);
    this.codeToId.delete(room.code);
    this.usedWords.delete(roomId);
  }

  cleanupDisconnected(): void {
    const now = Date.now();
    const DISCONNECT_TIMEOUT = 60000;

    for (const room of this.rooms.values()) {
      if (room.status === "lobby") continue;

      for (const player of room.players.values()) {
        if (player.disconnected && player.disconnectedAt) {
          if (now - player.disconnectedAt > DISCONNECT_TIMEOUT) {
            player.isAlive = false;
          }
        }
      }
    }
  }

  getPublicRooms(): Array<{ code: string; playerCount: number; status: string }> {
    const publicRooms: Array<{ code: string; playerCount: number; status: string }> = [];

    for (const room of this.rooms.values()) {
      if (room.isPublic && room.status === "lobby") {
        publicRooms.push({
          code: room.code,
          playerCount: room.players.size,
          status: room.status,
        });
      }
    }

    return publicRooms;
  }

  getSerializableRoom(room: RoomState): any {
    return {
      id: room.id,
      code: room.code,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      status: room.status,
      hostId: room.hostId,
      strikesToEliminate: room.strikesToEliminate,
      turnTimeLimit: room.turnTimeLimit,
      imposterCount: room.imposterCount,
      selectedCategories: room.selectedCategories,
      showHints: room.showHints,
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        strikes: p.strikes,
        isAlive: p.isAlive,
        isHost: p.isHost,
        role: p.role,
        hasGivenClue: p.hasGivenClue,
        disconnected: p.disconnected,
      })),
      currentRound: room.currentRound
        ? {
            roundNumber: room.currentRound.roundNumber,
            secretWord: room.status === "results" || room.status === "finished" || room.currentRound.status === "ended"
              ? room.currentRound.secretWord : undefined,
            category: room.currentRound.category,
            imposterIds: room.currentRound.imposterIds,
            clues: room.currentRound.clues,
            votes: room.currentRound.votes,
            turnOrder: room.currentRound.turnOrder,
            currentTurnIndex: room.currentRound.currentTurnIndex,
            turnStartTime: room.currentRound.turnStartTime,
            turnTimeLimit: room.currentRound.turnTimeLimit,
            status: room.currentRound.status,
          }
        : null,
      roundCount: room.roundHistory.length,
    };
  }

  getPlayerView(room: RoomState, playerId: string): any {
    const base = this.getSerializableRoom(room);
    const player = room.players.get(playerId);

    if (!player) return base;

    base.playerRole = player.role;
    base.isYourTurn = room.currentRound
      ? room.currentRound.turnOrder[room.currentRound.currentTurnIndex] === playerId
      : false;

    if (room.currentRound) {
      if (player.role === "imposter") {
        base.secretWord = null;
        base.imposterWord = room.currentRound.secretWord;
        base.imposterHint = room.showHints ? room.currentRound.imposterHint : null;
      } else {
        base.secretWord = room.currentRound.secretWord;
        base.imposterWord = null;
        base.imposterHint = null;
      }

      base.votesForYou = Object.values(room.currentRound.votes).filter(
        (v) => v === playerId
      ).length;
    }

    base.playerId = playerId;
    base.isHost = player.isHost;

    return base;
  }
}

export const gameManager = new GameManager();
