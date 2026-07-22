"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { getPersistentId, getPlayerName } from "@/lib/identity";
import { categories } from "@/lib/words";

interface Player {
  id: string;
  name: string;
  strikes: number;
  isAlive: boolean;
  isHost: boolean;
  role: string;
  hasGivenClue: boolean;
  disconnected: boolean;
}

interface RoomData {
  id: string;
  code: string;
  isPublic: boolean;
  maxPlayers: number;
  status: string;
  hostId: string;
  strikesToEliminate: number;
  turnTimeLimit: number;
  imposterCount: number;
  selectedCategories: string[];
  showHints: boolean;
  players: Player[];
  currentRound: any;
  roundCount: number;
  playerRole?: string;
  isYourTurn?: boolean;
  secretWord?: string | null;
  imposterWord?: string | null;
  imposterHint?: string | null;
  votesForYou?: number;
  playerId?: string;
  isHost?: boolean;
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.code as string;

  const [room, setRoom] = useState<RoomData | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [socket, setSocket] = useState<any>(null);
  const [error, setError] = useState("");
  const [clueInput, setClueInput] = useState("");
  const [showWord, setShowWord] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    imposterCount: 1,
    turnTimeLimit: 20,
    strikesToEliminate: 3,
    showHints: true,
    selectedCategories: [] as string[],
  });
  const [playerView, setPlayerView] = useState<any>(null);

  const currentPlayer = room?.players?.find((p: any) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const name = getPlayerName();
    if (!name) {
      router.push("/");
      return;
    }

    s.emit("join-room", {
      code: roomCode,
      name,
      persistentId: getPersistentId(),
    });

    const handleRoomJoined = (data: any) => {
      setPlayerId(data.playerId);
      setRoom(data.room);
      setPlayerView(data);
      setSettings({
        imposterCount: data.room.imposterCount || 1,
        turnTimeLimit: data.room.turnTimeLimit || 20,
        strikesToEliminate: data.room.strikesToEliminate || 3,
        showHints: data.room.showHints !== false,
        selectedCategories: data.room.selectedCategories || [],
      });
    };

    const handleRoomUpdated = (data: any) => setRoom(data);
    const handleGameStarted = (data: any) => {
      setRoom(data); setPlayerView(data); setShowWord(false);
      setClueInput(""); setSelectedVote(null); setHasVoted(false);
    };
    const handleTurnChanged = (data: any) => {
      setRoom(data); setClueInput("");
    };
    const handleYourView = (data: any) => setPlayerView(data);
    const handleVotingStarted = (data: any) => {
      setRoom(data); setPlayerView(data); setSelectedVote(null); setHasVoted(false);
    };
    const handleVoteSubmitted = (data: any) => setRoom(data.room);
    const handleRoundResults = (data: any) => { setRoom(data); setPlayerView(data); };
    const handleGameOver = (data: any) => { setRoom(data); setPlayerView(data); };
    const handleError = (data: any) => { setError(data.message); setTimeout(() => setError(""), 3000); };
    const handleLeftRoom = () => router.push("/");
    const handlePlayerDisconnected = (data: any) => setRoom(data.room);

    s.on("room-joined", handleRoomJoined);
    s.on("room-updated", handleRoomUpdated);
    s.on("game-started", handleGameStarted);
    s.on("turn-changed", handleTurnChanged);
    s.on("your-view", handleYourView);
    s.on("voting-started", handleVotingStarted);
    s.on("vote-submitted", handleVoteSubmitted);
    s.on("round-results", handleRoundResults);
    s.on("game-over", handleGameOver);
    s.on("error", handleError);
    s.on("left-room", handleLeftRoom);
    s.on("player-disconnected", handlePlayerDisconnected);

    return () => {
      s.off("room-joined", handleRoomJoined);
      s.off("room-updated", handleRoomUpdated);
      s.off("game-started", handleGameStarted);
      s.off("turn-changed", handleTurnChanged);
      s.off("your-view", handleYourView);
      s.off("voting-started", handleVotingStarted);
      s.off("vote-submitted", handleVoteSubmitted);
      s.off("round-results", handleRoundResults);
      s.off("game-over", handleGameOver);
      s.off("error", handleError);
      s.off("left-room", handleLeftRoom);
      s.off("player-disconnected", handlePlayerDisconnected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, router]);

  const handleStartGame = () => { if (socket && !startingGame) { setStartingGame(true); socket.emit("start-game"); setTimeout(() => setStartingGame(false), 2000); } };
  const handleSubmitClue = () => { if (socket && clueInput.trim()) socket.emit("submit-clue", { clue: clueInput.trim() }); };
  const handleSubmitVote = (targetId: string) => {
    if (!socket || hasVoted) return;
    setSelectedVote(targetId); socket.emit("submit-vote", { targetId }); setHasVoted(true);
  };
  const handleNextRound = () => { if (socket) socket.emit("next-round"); };
  const handleBackToLobby = () => { if (socket) socket.emit("back-to-lobby"); };
  const handleLeaveRoom = () => { if (socket) socket.emit("leave-room"); };
  const handleCopyCode = () => {
    const copy = async () => {
      try {
        if (navigator.clipboard) { await navigator.clipboard.writeText(roomCode); }
        else { const ta = document.createElement("textarea"); ta.value = roomCode; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      } catch { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };
    copy();
  };
  const handleUpdateSettings = () => { if (socket) { socket.emit("update-settings", settings); setShowSettings(false); } };
  const handleToggleCategory = (catId: string) => {
    setSettings((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(catId)
        ? prev.selectedCategories.filter((id) => id !== catId)
        : [...prev.selectedCategories, catId],
    }));
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 border-2 border-imposter-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-5 safe-top safe-bottom">
      <div className="max-w-md mx-auto">
        {room?.status === "lobby" && (
          <LobbyView room={room} playerId={playerId} isHost={isHost} copied={copied}
            showSettings={showSettings} settings={settings} categories={categories}
            onStartGame={handleStartGame} onCopyCode={handleCopyCode} onLeaveRoom={handleLeaveRoom}
            onToggleSettings={() => setShowSettings(!showSettings)} onUpdateSettings={handleUpdateSettings}
            onToggleCategory={handleToggleCategory} onSettingsChange={setSettings} />
        )}
        {room?.status === "clue" && (
          <ClueView room={room} playerView={playerView} playerId={playerId}
            clueInput={clueInput} showWord={showWord}
            onClueChange={setClueInput} onSubmitClue={handleSubmitClue}
            onToggleWord={() => setShowWord(!showWord)} />
        )}
        {room?.status === "voting" && (
          <VotingView room={room} playerId={playerId} selectedVote={selectedVote}
            hasVoted={hasVoted} onSelectVote={handleSubmitVote} />
        )}
        {room?.status === "results" && (
          <ResultsView room={room} playerId={playerId} isHost={isHost}
            onNextRound={handleNextRound} onBackToLobby={handleBackToLobby} />
        )}
        {room?.status === "finished" && (
          <FinishedView room={room} playerId={playerId} isHost={isHost}
            onBackToLobby={handleBackToLobby} />
        )}
      </div>
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-float animate-slide-up z-50 text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  );
}

function PlayerList({ players, playerId, compact }: { players: Player[]; playerId: string; compact?: boolean }) {
  return (
    <div className="space-y-1.5">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
            player.id === playerId
              ? "bg-red-50/80 border border-red-100"
              : "bg-gray-50/80"
          } ${!player.isAlive ? "opacity-40" : ""}`}
        >
          <div className={`avatar-md flex-shrink-0 ${player.isHost ? "avatar-host" : player.id === playerId ? "avatar-self" : "avatar-default"}`}>
            {player.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-sm truncate ${!player.isAlive ? "line-through text-gray-400" : "text-gray-700"}`}>
                {player.name}
              </span>
              {player.id === playerId && <span className="badge-muted text-[10px]">Ikaw</span>}
              {player.isHost && <span className="badge-gold text-[10px]">Host</span>}
            </div>
            {!compact && player.strikes > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`strike-dot ${i < player.strikes ? "active" : "inactive"}`} />
                ))}
              </div>
            )}
          </div>
          {player.disconnected && <span className="badge bg-yellow-50 text-yellow-600 border-yellow-100 text-[10px]">DC</span>}
        </div>
      ))}
    </div>
  );
}

function LobbyView({ room, playerId, isHost, copied, showSettings, settings, categories: cats,
  onStartGame, onCopyCode, onLeaveRoom, onToggleSettings, onUpdateSettings, onToggleCategory, onSettingsChange }: any) {
  const alivePlayers = room.players.filter((p: any) => p.isAlive);
  const canStart = alivePlayers.length >= 3;

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onLeaveRoom} className="btn-ghost text-sm gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Umalis
        </button>
        {isHost && (
          <button onClick={onToggleSettings} className="btn-ghost text-sm gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 113 0m-3 0a1.5 1.5 0 103 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Settings
          </button>
        )}
      </div>

      {/* Room Code Card */}
      <div className="card text-center animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wider mb-2">Room Code</p>
        <button
          onClick={onCopyCode}
          className="text-3xl sm:text-4xl font-mono font-black tracking-[0.2em] text-gradient-gold hover:opacity-80 transition-opacity cursor-pointer active:scale-95 transition-transform"
        >
          {room.code}
        </button>
        <p className="text-gray-400 text-xs mt-2">
          {copied ? (
            <span className="text-imposter-green">Na-copy na!</span>
          ) : (
            "I-tap para ma-copy"
          )}
        </p>
        <div className="divider mt-3 mb-2" />
        <p className="text-gray-300 text-[11px] font-mono break-all">
          {typeof window !== "undefined" ? window.location.origin : ""}/game/{room.code}
        </p>
        {settings.selectedCategories.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap justify-center gap-1.5">
              {settings.selectedCategories.map((catId: string) => {
                const cat = cats.find((c: any) => c.id === catId);
                return cat ? (
                  <span key={catId} className="badge-gold text-[10px]">
                    {cat.tagalog}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
        {settings.selectedCategories.length === 0 && (
          <p className="mt-2 pt-2 border-t border-gray-100 text-gray-300 text-[11px]">Lahat ng kategorya aktibo</p>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && isHost && (
        <div className="card animate-slide-up space-y-4">
          <h3 className="font-bold text-sm text-gray-700">Game Settings</h3>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-500 text-sm">Imposter Count</label>
              <span className="badge-red text-xs">{settings.imposterCount}</span>
            </div>
            <input type="range" min={1} max={6} value={settings.imposterCount}
              onChange={(e) => onSettingsChange({ ...settings, imposterCount: parseInt(e.target.value) })} className="w-full accent-imposter-red" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-500 text-sm">Turn Time</label>
              <span className="badge text-xs bg-gray-100 text-gray-500">{settings.turnTimeLimit}s</span>
            </div>
            <input type="range" min={10} max={60} value={settings.turnTimeLimit}
              onChange={(e) => onSettingsChange({ ...settings, turnTimeLimit: parseInt(e.target.value) })} className="w-full accent-imposter-red" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-500 text-sm">Strikes to Eliminate</label>
              <span className="badge text-xs bg-gray-100 text-gray-500">{settings.strikesToEliminate}</span>
            </div>
            <input type="range" min={1} max={5} value={settings.strikesToEliminate}
              onChange={(e) => onSettingsChange({ ...settings, strikesToEliminate: parseInt(e.target.value) })} className="w-full accent-imposter-red" />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-gray-500 text-sm">Show Imposter Hints</span>
            <button onClick={() => onSettingsChange({ ...settings, showHints: !settings.showHints })}
              className={`toggle ${settings.showHints ? "on" : "off"}`} />
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-2">Mga Kategorya (0 = Lahat)</p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {cats.map((cat: any) => (
                <button key={cat.id} onClick={() => onToggleCategory(cat.id)}
                  className={`category-chip text-xs ${settings.selectedCategories.includes(cat.id) ? "active" : ""}`}>
                  {cat.tagalog}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onUpdateSettings} className="btn-green w-full">Save Settings</button>
        </div>
      )}

      {/* Player List */}
      <div className="card animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-gray-700">
            Players
            <span className="text-gray-400 font-normal ml-1">{room.players.length}/{room.maxPlayers}</span>
          </h3>
          <span className="badge-muted text-[11px]">Round {room.roundCount + 1}</span>
        </div>
        <PlayerList players={room.players} playerId={playerId} />
      </div>

      {/* Start Button */}
      {isHost && (
        <button onClick={onStartGame} disabled={!canStart}
          className={`btn-primary w-full ${!canStart ? "!bg-gray-200 !text-gray-400 !shadow-none !cursor-not-allowed" : "animate-glow-pulse"}`}>
          {canStart ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Simulan ang Laro!
            </span>
          ) : (
            `Kulang pang ${3 - alivePlayers.length} player(s)`
          )}
        </button>
      )}
      {!isHost && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-gray-400 text-sm animate-pulse-fast">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Hinihintay ang host...
          </div>
        </div>
      )}
    </div>
  );
}

function ClueView({ room, playerView, playerId, clueInput, showWord,
  onClueChange, onSubmitClue, onToggleWord }: any) {
  const round = room.currentRound;
  if (!round) return null;

  const currentPlayerId = round.turnOrder[round.currentTurnIndex];
  const currentPlayer = room.players.find((p: any) => p.id === currentPlayerId);
  const isMyTurn = currentPlayerId === playerId;
  const amImposter = playerView?.playerRole === "imposter";

  const secretWord = playerView?.secretWord;
  const displayWord = secretWord;

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* Role Card */}
      <div className="card text-center">
        <div className="flex items-center justify-between mb-3">
          <span className="badge-muted text-[11px]">Round {round.roundNumber}</span>
        </div>

        {amImposter ? (
          <div className="p-4 bg-red-50/80 border border-red-100 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-imposter-red animate-pulse-fast" />
              <p className="text-imposter-red font-bold text-xs uppercase tracking-wider">Ikaw ang Imposter!</p>
            </div>
            <p className="text-gray-400 text-[11px] mb-3">Hulaan ang secret word para manalo!</p>
            {playerView?.imposterHint && (
              <div className="p-2.5 bg-white rounded-lg border border-red-100">
                <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Ang Hint Mo</p>
                <p className="text-imposter-gold font-bold text-sm">{playerView.imposterHint}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-green-50/80 border border-green-100 rounded-xl">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">Ang Secret Word ay...</p>
            {showWord ? (
              <p className="text-imposter-green font-black text-2xl sm:text-3xl tracking-wide animate-scale-in">
                {displayWord}
              </p>
            ) : (
              <button onClick={onToggleWord}
                className="text-imposter-gold font-bold text-sm hover:text-amber-600 transition-all py-2 px-5 rounded-lg bg-amber-50 hover:bg-amber-100 active:scale-95">
                I-tap para ipakita
              </button>
            )}
          </div>
        )}
      </div>

      {/* Current Turn */}
      <div className="card text-center">
        <p className="text-gray-400 text-xs mb-2">
          Kasalukuyang turno: <span className="text-gray-700 font-bold">{currentPlayer?.name || "?"}</span>
        </p>

        {isMyTurn && (
          <div className="space-y-2.5 animate-fade-in-up">
            <input type="text" value={clueInput} onChange={(e) => onClueChange(e.target.value)}
              placeholder="I-type ang clue mo..." className="input-field text-center text-base font-medium"
              maxLength={30} onKeyDown={(e) => e.key === "Enter" && onSubmitClue()} autoFocus />
            <button onClick={onSubmitClue} disabled={!clueInput.trim()}
              className="btn-green w-full">
              Tapos Na
            </button>
          </div>
        )}
        {!isMyTurn && (
          <div className="inline-flex items-center gap-2 text-gray-400 text-sm animate-pulse-fast">
            <div className="w-1.5 h-1.5 rounded-full bg-imposter-gold" />
            Hinihintay si {currentPlayer?.name}...
          </div>
        )}
      </div>

      {/* Clues List */}
      <div className="card">
        <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">Mga Clue</h3>
        <div className="space-y-1.5">
          {round.turnOrder.map((pid: string, idx: number) => {
            const p = room.players.find((pl: any) => pl.id === pid);
            const clue = round.clues[pid];
            const isActive = idx === round.currentTurnIndex;
            return (
              <div key={pid} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 ${
                isActive ? "bg-amber-50/80 border border-amber-100" : clue ? "bg-gray-50/80" : "bg-gray-50/50 opacity-40"}`}>
                <div className={`avatar-sm flex-shrink-0 ${p?.isAlive ? "avatar-default" : "bg-red-50 text-red-300"}`}>
                  {p?.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-600 truncate">{p?.name}</p>
                  <p className="text-[11px] mt-0.5">
                    {clue ? (
                      <span className="text-imposter-green font-medium">&ldquo;{clue}&rdquo;</span>
                    ) : isActive ? (
                      <span className="text-imposter-gold animate-pulse-fast">Nag-iisip...</span>
                    ) : (
                      <span className="text-gray-300">Naghihintay...</span>
                    )}
                  </p>
                </div>
                {p?.hasGivenClue && !isActive && (
                  <svg className="w-4 h-4 text-imposter-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VotingView({ room, playerId, selectedVote, hasVoted, onSelectVote }: any) {
  const round = room.currentRound;
  const alivePlayers = room.players.filter((p: any) => p.isAlive);
  const voteCount = Object.keys(round?.votes || {}).length;
  const majorityThreshold = Math.floor(alivePlayers.length / 2) + 1;

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* Header */}
      <div className="card text-center">
        <div className="inline-flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-imposter-red animate-pulse-fast" />
          <h2 className="text-lg font-black text-gradient-red">VOTING TIME!</h2>
        </div>
        <p className="text-gray-400 text-xs">Sino ang imposter?</p>
        <p className="text-imposter-gold text-[11px] font-medium mt-1">
          Kailangan ng {majorityThreshold}/{alivePlayers.length} votes para ma-eliminate
        </p>
        <div className="mt-2.5">
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 flex-1 max-w-[100px] bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-imposter-red rounded-full transition-all duration-500"
                style={{ width: `${(voteCount / alivePlayers.length) * 100}%` }}
              />
            </div>
            <span className="text-gray-400 text-[11px] font-mono">{voteCount}/{alivePlayers.length}</span>
          </div>
        </div>
      </div>

      {/* Vote Options */}
      <div className="space-y-2">
        {alivePlayers.map((player: any, index: number) => {
          const isVotedByMe = selectedVote === player.id;
          const myVoteCount = Object.values(round?.votes || {}).filter((v: any) => v === player.id).length;
          return (
            <button key={player.id} onClick={() => !hasVoted && onSelectVote(player.id)}
              disabled={hasVoted}
              style={{ animationDelay: `${index * 0.04}s` }}
              className={`w-full p-3.5 rounded-xl transition-all duration-200 text-left animate-fade-in-up ${
                isVotedByMe ? "bg-red-50 border border-red-200 shadow-sm"
                : hasVoted ? "bg-gray-50 cursor-not-allowed opacity-60"
                : "glass-card hover:bg-white/90 hover:-translate-y-0.5 active:scale-[0.98]"
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`avatar-lg flex-shrink-0 ${isVotedByMe ? "bg-imposter-red text-white" : "avatar-default"}`}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-700">{player.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: room.strikesToEliminate }, (_, i) => (
                        <div key={i} className={`strike-dot ${i < player.strikes ? "active" : "inactive"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasVoted && !isVotedByMe && <span className="text-gray-400 text-xs font-mono">{myVoteCount}</span>}
                  {isVotedByMe && (
                    <svg className="w-5 h-5 text-imposter-red" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Waiting */}
      {hasVoted && (
        <div className="text-center py-3">
          <div className="inline-flex items-center gap-2 text-gray-400 text-sm animate-pulse-fast">
            <div className="w-1.5 h-1.5 rounded-full bg-imposter-gold" />
            Hinihintay ang ibang players...
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsView({ room, playerId, isHost, onNextRound, onBackToLobby }: any) {
  const round = room.currentRound;
  const eliminatedPlayer = room.players.find(
    (p: any) => p.strikes >= room.strikesToEliminate && p.isAlive === false
  );
  const alivePlayers = room.players.filter((p: any) => p.isAlive);
  const totalVotes = Object.keys(round?.votes || {}).length;
  const majorityThreshold = Math.floor((alivePlayers.length + (eliminatedPlayer ? 1 : 0)) / 2) + 1;

  return (
    <div className="animate-fade-in-up space-y-3">
      <div className="card text-center">
        <h2 className="text-lg font-black text-gradient-gold mb-4">Round {round?.roundNumber} Results</h2>
        {round?.secretWord && (() => {
          const dw = round.secretWord;
          return (
            <div className="p-3 bg-green-50/80 border border-green-100 rounded-xl mb-3">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Ang secret word ay</p>
              <p className="text-imposter-green font-black text-xl sm:text-2xl">{dw}</p>
            </div>
          );
        })()}
        {round?.imposterIds && (
          <div className="p-3 bg-red-50/80 border border-red-100 rounded-xl mb-3">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1.5">Ang mga imposter ay</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {round.imposterIds.map((id: string) => {
                const p = room.players.find((pl: any) => pl.id === id);
                return <span key={id} className="badge-red">{p?.name || "?"}</span>;
              })}
            </div>
          </div>
        )}
        {eliminatedPlayer && (
          <div className="p-3 bg-amber-50/80 border border-amber-100 rounded-xl mb-3">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Na-eliminate ng majority</p>
            <p className="text-imposter-gold font-bold text-base">{eliminatedPlayer.name}</p>
          </div>
        )}
        <div className="divider my-3" />
        <div className="space-y-1 text-left">
          <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Mga Boto</h3>
          {Object.entries(round?.votes || {}).map(([voterId, targetId]: [string, any]) => {
            const voter = room.players.find((p: any) => p.id === voterId);
            const target = room.players.find((p: any) => p.id === targetId);
            return (
              <div key={voterId} className="flex items-center gap-2 text-sm p-2 bg-gray-50/80 rounded-lg">
                <span className="text-gray-500 text-xs">{voter?.name}</span>
                <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span className="text-imposter-red font-semibold text-xs">{target?.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">Player Status</h3>
        <PlayerList players={room.players} playerId={playerId} compact />
      </div>
      {isHost && (
        <div className="space-y-2">
          <button onClick={onNextRound} className="btn-primary w-full">Susunod na Round</button>
          <button onClick={onBackToLobby} className="btn-secondary w-full">Bumalik sa Lobby</button>
        </div>
      )}
      {!isHost && (
        <div className="text-center py-3 text-gray-400 text-sm animate-pulse-fast">
          Hinihintay ang host...
        </div>
      )}
    </div>
  );
}

function FinishedView({ room, playerId, isHost, onBackToLobby }: any) {
  const round = room.currentRound;
  const aliveImposters = room.players.filter((p: any) => p.isAlive && p.role === "imposter");
  const impostersWon = aliveImposters.length > 0;
  const sorted = [...room.players].sort((a: any, b: any) => a.strikes - b.strikes);

  return (
    <div className="animate-fade-in-up space-y-3">
      <div className="card text-center">
        <div className="mb-4">
          <div className="text-5xl mb-2">{impostersWon ? "😈" : "🎉"}</div>
          <h2 className="text-2xl sm:text-3xl font-black">
            {impostersWon ? (
              <span className="text-gradient-red">MANALO ANG IMPOSTER!</span>
            ) : (
              <span className="text-imposter-green">MANALO ANG CIVILIANS!</span>
            )}
          </h2>
        </div>
        {round?.secretWord && (() => {
          const dw = round.secretWord;
          return (
            <div className="p-3 bg-amber-50/80 border border-amber-100 rounded-xl mb-3">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">Ang secret word ay</p>
              <p className="text-imposter-gold font-black text-2xl sm:text-3xl">{dw}</p>
            </div>
          );
        })()}
        {round?.imposterIds && (
          <div className="p-3 bg-red-50/80 border border-red-100 rounded-xl mb-3">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1.5">Ang mga imposter ay</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {round.imposterIds.map((id: string) => {
                const p = room.players.find((pl: any) => pl.id === id);
                return <span key={id} className="badge-red">{p?.name || "?"}</span>;
              })}
            </div>
          </div>
        )}
        <div className="divider my-3" />
        <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 text-left">Final Standings</h3>
        <div className="space-y-1.5">
          {sorted.map((player: any, index: number) => (
            <div key={player.id}
              className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                player.id === playerId ? "bg-red-50/80 border border-red-100" : "bg-gray-50/80"
              }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-gray-300 text-xs font-mono w-4">{index + 1}</span>
                <div className={`avatar-sm ${player.role === "imposter" ? "bg-imposter-red text-white" : player.isAlive ? "avatar-default" : "bg-red-50 text-red-300"}`}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="font-semibold text-sm text-gray-700">{player.name}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {player.role === "imposter" && <span className="badge-red text-[10px] py-0">IMPOSTER</span>}
                    {!player.isAlive && <span className="badge bg-red-50/80 text-red-400 text-[10px] py-0">ELIM</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: room.strikesToEliminate }, (_, i) => (
                  <div key={i} className={`strike-dot ${i < player.strikes ? "active" : "inactive"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {isHost && <button onClick={onBackToLobby} className="btn-primary w-full">Bumalik sa Lobby</button>}
      {!isHost && (
        <div className="text-center py-3 text-gray-400 text-sm animate-pulse-fast">
          Hinihintay ang host...
        </div>
      )}
    </div>
  );
}