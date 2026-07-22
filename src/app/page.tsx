"use client";

import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { getPersistentId, getPlayerName, setPlayerName } from "@/lib/identity";
import { useRouter } from "next/navigation";

type Mode = null | "online" | "local";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedName = getPlayerName();
    if (savedName) setName(savedName);
  }, []);

  const clearError = useCallback(() => {
    if (error) setError("");
  }, [error]);

  const handleCreateRoom = () => {
    if (!name.trim()) {
      setError("Ilagay mo muna pangalan mo.");
      return;
    }
    setIsCreating(true);
    setError("");
    setPlayerName(name.trim());

    const socket = getSocket();
    socket.emit("create-room", { isPublic });

    socket.once("room-created", (data) => {
      router.push(`/game/${data.room.code}`);
    });

    socket.once("error", (data) => {
      setError(data.message);
      setIsCreating(false);
    });
  };

  const handleJoinRoom = () => {
    if (!name.trim()) {
      setError("Ilagay mo muna pangalan mo.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Ilagay ang room code.");
      return;
    }
    setIsJoining(true);
    setError("");
    setPlayerName(name.trim());

    const socket = getSocket();
    socket.emit("join-room", {
      code: roomCode.toUpperCase().trim(),
      name: name.trim(),
      persistentId: getPersistentId(),
    });

    socket.once("room-joined", (data) => {
      router.push(`/game/${data.room.code}?pid=${data.playerId}`);
    });

    socket.once("error", (data) => {
      setError(data.message);
      setIsJoining(false);
    });
  };

  if (mode === "local") {
    router.push("/local");
    return null;
  }

  if (!mode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 safe-top safe-bottom">
        <div className="w-full max-w-sm animate-fade-in-up text-center">
          {/* Logo */}
          <div className="mb-10">
            <div className="inline-block mb-5">
              <div className="w-18 h-18 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-imposter-red flex items-center justify-center shadow-glow animate-float">
                <svg className="w-9 h-9 sm:w-10 sm:h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
              <span className="text-gradient-red">IMPOSTOR</span>
            </h1>
            <p className="text-gray-400 text-sm">
              Bluffing Party Game
            </p>
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <button
              onClick={() => setMode("online")}
              className="group w-full p-4 glass-card hover:bg-white/90 transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-imposter-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-800">Online Multiplayer</h2>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Laruin sa iba&apos;t ibang device
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-gray-500 transition-all group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => setMode("local")}
              className="group w-full p-4 glass-card hover:bg-white/90 transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.98] text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-imposter-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-800">Pass the Phone</h2>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Isang device lang, mag-usap
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-gray-500 transition-all group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-10">
            <p className="text-gray-300 text-xs">
              Walang download &middot; Walang signup &middot; Laro agad!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 safe-top safe-bottom">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => { setMode(null); setError(""); }}
            className="btn-icon text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              <span className="text-gradient-red">ONLINE</span>
            </h1>
            <p className="text-gray-400 text-xs">Multiplayer Mode</p>
          </div>
        </div>

        {/* Name Input */}
        <div className="card mb-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          <label className="flex items-center gap-2 text-gray-400 text-[11px] font-medium mb-2.5 uppercase tracking-wider">
            Pangalan mo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError(); }}
            placeholder="Ilagay ang pangalan mo..."
            className="input-field text-center text-base font-semibold"
            maxLength={20}
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="btn-primary w-full"
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gumagawa ng Room...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Gumawa ng Room
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-0.5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-gray-300 text-[11px] font-medium uppercase tracking-wider">o</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Join Room */}
          <div className="card">
            <label className="block text-gray-400 text-[11px] font-medium mb-2 uppercase tracking-wider">
              Sumali gamit ang Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); clearError(); }}
              placeholder="XXXXXX"
              className="input-field text-center text-xl font-mono font-bold tracking-[0.4em]"
              maxLength={6}
            />
            <button
              onClick={handleJoinRoom}
              disabled={isJoining || !roomCode.trim()}
              className="btn-secondary w-full mt-3"
            >
              {isJoining ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sinasali...
                </span>
              ) : (
                "Sumali sa Room"
              )}
            </button>
          </div>

          {/* Public Room Toggle */}
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="w-full glass-card p-3.5 flex items-center justify-between group hover:bg-white/90 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-imposter-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <span className="text-gray-700 text-sm font-medium block">Public Room</span>
                {isPublic && <span className="text-gray-400 text-[11px]">Makikita sa room browser</span>}
              </div>
            </div>
            <div className={`toggle ${isPublic ? "on" : "off"}`} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-center text-sm animate-slide-up">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-300 text-[11px]">
            Hanggang 20 players per room &middot; Libre maglaro
          </p>
        </div>
      </div>
    </div>
  );
}