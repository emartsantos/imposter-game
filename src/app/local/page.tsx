"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { categories, WordCategory } from "@/lib/words";


type Phase = "setup" | "reveal" | "pass" | "discussion" | "voting-pass" | "voting" | "results" | "gameover";

interface LocalPlayer {
  id: string;
  name: string;
  role: "civilian" | "imposter";
  strikes: number;
  isAlive: boolean;
}

interface RoundData {
  secretWord: string;
  category: string;
  imposterIds: string[];
  imposterHint: string;
  votes: Record<string, string>;
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

function generateHint(word: string, _category: string): string {
  const firstLetter = word.charAt(0).toUpperCase();
  const letterCount = word.length;
  const syllableCount = countSyllables(word);
  return `${firstLetter} | ${letterCount} letters | ${syllableCount} syllable${syllableCount > 1 ? "s" : ""}`;
}

export default function LocalGamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [playerNames, setPlayerNames] = useState<string[]>(["", ""]);
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [round, setRound] = useState<RoundData | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [discussionTimer, setDiscussionTimer] = useState(120);
  const [discussionRunning, setDiscussionRunning] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showVoteResults, setShowVoteResults] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [imposterCountSetting, setImposterCountSetting] = useState(0);
  const [discussionTimeSetting, setDiscussionTimeSetting] = useState(120);
  const [strikesToEliminate, setStrikesToEliminate] = useState(3);
  const [winner, setWinner] = useState<"civilians" | "imposters" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [revealOrder, setRevealOrder] = useState<string[]>([]);
  const [discussionStarterId, setDiscussionStarterId] = useState<string | null>(null);
  const [discussionStarted, setDiscussionStarted] = useState(false);
  const [votingOrder, setVotingOrder] = useState<string[]>([]);
  const [currentVotingIndex, setCurrentVotingIndex] = useState(0);
  const [voteCardRevealed, setVoteCardRevealed] = useState(false);
  const [allVotes, setAllVotes] = useState<Record<string, string>>({});
  const [voteSelection, setVoteSelection] = useState<string | null>(null);
  const [votingResult, setVotingResult] = useState<{
    majority: boolean;
    eliminatedId: string | null;
    voteCounts: Record<string, number>;
    totalVotes: number;
  } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const addPlayerName = () => { if (playerNames.length < 20) setPlayerNames([...playerNames, ""]); };
  const removePlayerName = (index: number) => { if (playerNames.length > 3) setPlayerNames(playerNames.filter((_, i) => i !== index)); };
  const updatePlayerName = (index: number, value: string) => {
    const updated = [...playerNames]; updated[index] = value; setPlayerNames(updated);
  };
  const canStartGame = (): boolean => playerNames.filter((n) => n.trim().length > 0).length >= 3;

  const handleStartGame = () => {
    const filledNames = playerNames.filter((n) => n.trim().length > 0);
    const shuffled = shuffleArray(filledNames);
    const imposterCount = imposterCountSetting > 0
      ? Math.min(imposterCountSetting, calculateImposterCount(shuffled.length))
      : calculateImposterCount(shuffled.length);
    const ids = shuffled.map((_, i) => `p${i}`);
    const imposterIds = new Set(ids.slice(0, imposterCount));
    const newPlayers: LocalPlayer[] = shuffled.map((name, i) => ({
      id: ids[i], name: name.trim(),
      role: imposterIds.has(ids[i]) ? "imposter" : "civilian",
      strikes: 0, isAlive: true,
    }));
    setPlayers(newPlayers);
    dealRound(newPlayers);
  };

  const dealRound = (currentPlayers: LocalPlayer[]) => {
    const alivePlayers = currentPlayers.filter((p) => p.isAlive);
    const aliveIds = alivePlayers.map((p) => p.id);
    const imposterCount = imposterCountSetting > 0
      ? Math.min(imposterCountSetting, calculateImposterCount(alivePlayers.length))
      : calculateImposterCount(alivePlayers.length);
    const shuffledIds = shuffleArray(aliveIds);
    const newImposterIds = shuffledIds.slice(0, imposterCount);
    const availableCategories = selectedCategories.length > 0
      ? categories.filter((c) => selectedCategories.includes(c.id))
      : categories;

    let secretWord = "";
    let selectedCategory: WordCategory | null = null;
    let attempts = 0;
    while (attempts < 200) {
      selectedCategory = pickRandom(availableCategories);
      const word = pickRandom(selectedCategory.words);
      if (!usedWords.has(word)) { secretWord = word; break; }
      attempts++;
    }
    if (!secretWord) {
      setUsedWords(new Set());
      selectedCategory = pickRandom(availableCategories);
      secretWord = pickRandom(selectedCategory!.words);
    }
    setUsedWords((prev) => new Set([...prev, secretWord]));

    const updatedPlayers = currentPlayers.map((p) => {
      if (!p.isAlive) return p;
      return { ...p, role: newImposterIds.includes(p.id) ? "imposter" as const : "civilian" as const };
    });

    setPlayers(updatedPlayers);
    setRound({
      secretWord,
      category: selectedCategory!.tagalog,
      imposterIds: newImposterIds,
      imposterHint: generateHint(secretWord, selectedCategory!.tagalog),
      votes: {},
    });
    setRevealOrder(shuffleArray(aliveIds));
    setCurrentRevealIndex(0); setCardRevealed(false);
    setSelectedVote(null); setHasVoted(false);
    setShowVoteResults(false); setWinner(null);
    setVotingOrder([]); setCurrentVotingIndex(0); setVoteCardRevealed(false);
    setAllVotes({}); setVoteSelection(null); setVotingResult(null);
    setPhase("pass");
  };

  const handlePlayerReady = () => { setPhase("reveal"); setCardRevealed(false); };

  const handleRevealCard = () => {
    setCardRevealed(true);
  };

  const handleHideCard = () => {
    const alivePlayers = players.filter((p) => p.isAlive);
    if (currentRevealIndex < alivePlayers.length - 1) {
      setCurrentRevealIndex(currentRevealIndex + 1);
      setCardRevealed(false);
      setPhase("pass");
    } else {
      const starter = pickRandom(alivePlayers);
      setDiscussionStarterId(starter.id);
      setDiscussionStarted(false);
      setPhase("discussion");
    }
  };

  const handleStartDiscussion = () => {
    setDiscussionStarted(true);
    setDiscussionTimer(discussionTimeSetting);
    setDiscussionRunning(true);
  };

  useEffect(() => {
    if (!discussionRunning) return;
    timerRef.current = setInterval(() => {
      setDiscussionTimer((prev) => {
        if (prev <= 1) {
          setDiscussionRunning(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("voting");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [discussionRunning]);

  const handleEndDiscussion = () => {
    setDiscussionRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const alive = players.filter((p) => p.isAlive);
    setVotingOrder(shuffleArray(alive.map((p) => p.id)));
    setCurrentVotingIndex(0);
    setVoteCardRevealed(false);
    setAllVotes({});
    setVoteSelection(null);
    setVotingResult(null);
    setPhase("voting-pass");
  };

  const handleVoteReveal = () => { setVoteCardRevealed(true); };

  const handleVoteSelect = (targetId: string) => { setVoteSelection(targetId); };

  const handleVoteConfirm = () => {
    if (!voteSelection) return;
    const voterId = votingOrder[currentVotingIndex];
    const newVotes = { ...allVotes, [voterId]: voteSelection };
    setAllVotes(newVotes);
    setVoteCardRevealed(false);
    setVoteSelection(null);
    const alivePlayers = players.filter((p) => p.isAlive);
    if (currentVotingIndex < alivePlayers.length - 1) {
      setCurrentVotingIndex(currentVotingIndex + 1);
    } else {
      tallyVotes(newVotes);
    }
  };

  const tallyVotes = (votes: Record<string, string>) => {
    const voteCounts: Record<string, number> = {};
    for (const targetId of Object.values(votes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
    const totalVotes = Object.values(votes).length;
    const majorityThreshold = Math.floor(totalVotes / 2) + 1;
    let maxVotes = 0;
    let eliminatedId: string | null = null;
    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) { maxVotes = count; eliminatedId = targetId; }
    }
    const hasMajority = eliminatedId !== null && maxVotes >= majorityThreshold;
    if (hasMajority && eliminatedId) {
      const updatedPlayers = players.map((p) => {
        if (p.id === eliminatedId && p.isAlive) {
          const newStrikes = p.strikes + 1;
          return { ...p, strikes: newStrikes, isAlive: newStrikes < strikesToEliminate };
        }
        return { ...p };
      });
      setPlayers(updatedPlayers);
      setVotingResult({ majority: true, eliminatedId, voteCounts, totalVotes });
    } else {
      setVotingResult({ majority: false, eliminatedId: null, voteCounts, totalVotes });
    }
    setShowVoteResults(true);
    setPhase("voting");
  };

  const handleVoteContinue = () => {
    const impostersNow = players.filter((p) => p.isAlive && p.role === "imposter");
    const civiliansNow = players.filter((p) => p.isAlive && p.role === "civilian");
    if (!votingResult?.majority) { setWinner("imposters"); setPhase("gameover"); }
    else if (impostersNow.length === 0) { setWinner("civilians"); setPhase("gameover"); }
    else if (civiliansNow.length <= impostersNow.length) { setWinner("imposters"); setPhase("gameover"); }
    else setPhase("results");
  };

  const handleNextRound = () => { setRoundNumber((prev) => prev + 1); dealRound(players); };
  const handleBackToSetup = () => {
    setPhase("setup"); setPlayers([]); setRound(null);
    setRoundNumber(1); setUsedWords(new Set()); setWinner(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const handleToggleCategory = (catId: string) => {
    setSelectedCategories((prev) => prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]);
  };

  const alivePlayers = players.filter((p) => p.isAlive);
  const currentRevealPlayerId = revealOrder[currentRevealIndex];
  const currentRevealPlayer = alivePlayers.find((p) => p.id === currentRevealPlayerId);
  const currentVotingPlayer = alivePlayers.find((p) => p.id === votingOrder[currentVotingIndex]);

  return (
    <div className="min-h-screen p-4 sm:p-5 safe-top safe-bottom">
      <div className="max-w-lg mx-auto">
        {phase === "setup" && (
          <SetupPhase playerNames={playerNames} showSettings={showSettings}
            selectedCategories={selectedCategories} imposterCountSetting={imposterCountSetting}
            discussionTimeSetting={discussionTimeSetting} strikesToEliminate={strikesToEliminate}
            categories={categories} onAddPlayer={addPlayerName} onRemovePlayer={removePlayerName}
            onUpdateName={updatePlayerName} onToggleSettings={() => setShowSettings(!showSettings)}
            onToggleCategory={handleToggleCategory} onImposterCountChange={setImposterCountSetting}
            onDiscussionTimeChange={setDiscussionTimeSetting} onStrikesChange={setStrikesToEliminate}
            onStartGame={handleStartGame} canStart={canStartGame()} onBack={() => router.push("/")} />
        )}
        {phase === "pass" && currentRevealPlayer && (
          <PassPhase player={currentRevealPlayer} playerNumber={currentRevealIndex + 1}
            totalPlayers={alivePlayers.length} onReady={handlePlayerReady} />
        )}
        {phase === "reveal" && currentRevealPlayer && (
          <RevealPhase player={currentRevealPlayer} secretWord={round?.secretWord || ""}
            category={round?.category || ""} hint={round?.imposterHint || ""}
            revealed={cardRevealed} onReveal={handleRevealCard} onHide={handleHideCard}
            isLastPlayer={currentRevealIndex >= alivePlayers.length - 1} />
        )}
        {phase === "discussion" && (
          <DiscussionPhase timer={discussionTimer} maxTimer={discussionTimeSetting}
            onEndDiscussion={handleEndDiscussion} onStartDiscussion={handleStartDiscussion}
            started={discussionStarted}
            starterPlayer={players.find((p) => p.id === discussionStarterId)} />
        )}
        {phase === "voting-pass" && currentVotingPlayer && (
          <VotingPassPhase player={currentVotingPlayer} playerNumber={currentVotingIndex + 1}
            totalPlayers={alivePlayers.length} candidates={alivePlayers}
            revealed={voteCardRevealed} selectedVote={voteSelection}
            onReveal={handleVoteReveal} onSelectVote={handleVoteSelect}
            onConfirm={handleVoteConfirm} />
        )}
        {phase === "voting" && showVoteResults && votingResult && (
          <VoteResultsPhase players={players} votingResult={votingResult}
            allVotes={allVotes} strikesToEliminate={strikesToEliminate}
            onContinue={handleVoteContinue} />
        )}
        {phase === "results" && (
          <ResultsPhase round={round} players={players} roundNumber={roundNumber}
            strikesToEliminate={strikesToEliminate} onNextRound={handleNextRound} />
        )}
        {phase === "gameover" && (
          <GameOverPhase winner={winner} round={round} players={players}
            onPlayAgain={handleNextRound} onBackToSetup={handleBackToSetup} />
        )}
      </div>
    </div>
  );
}

function SetupPhase({ playerNames, showSettings, selectedCategories, imposterCountSetting,
  discussionTimeSetting, strikesToEliminate, categories: cats,
  onAddPlayer, onRemovePlayer, onUpdateName, onToggleSettings,
  onToggleCategory, onImposterCountChange, onDiscussionTimeChange,
  onStrikesChange, onStartGame, canStart, onBack }: any) {
  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="btn-icon text-gray-400 hover:text-gray-800">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            <span className="text-gradient-gold">PASS THE PHONE</span>
          </h1>
          <p className="text-gray-400 text-xs">One device, play together</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">Players</h3>
          <span className="badge-muted text-xs">{playerNames.filter((n: string) => n.trim()).length} named</span>
        </div>
        <div className="space-y-1.5 mb-3">
          {playerNames.map((name: string, i: number) => (
            <div key={i} className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <span className="text-gray-400 text-xs w-5 text-right font-mono">{i + 1}</span>
              <input type="text" value={name} onChange={(e) => onUpdateName(i, e.target.value)}
                placeholder={`Player ${i + 1} name`} className="input-compact flex-1" maxLength={20} />
              {playerNames.length > 3 && (
                <button onClick={() => onRemovePlayer(i)} className="btn-icon w-8 h-8 text-red-400/40 hover:text-red-400 hover:bg-red-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {playerNames.length < 20 && (
          <button onClick={onAddPlayer}
            className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-gray-500 hover:border-gray-300 transition-all text-sm">
            + Add Player
          </button>
        )}
      </div>

      <button onClick={onToggleSettings}
        className="w-full glass-card p-3.5 flex items-center justify-between hover:bg-gray-100 transition-all">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-gray-500 text-sm font-medium">
            {selectedCategories.length > 0
              ? `${selectedCategories.length} kategorya`
              : "Lahat ng kategorya"}
          </span>
        </div>
        <span className="text-imposter-gold text-sm font-medium">
          {showSettings ? "Hide" : "Settings"}
        </span>
      </button>

      {showSettings && (
        <div className="card animate-slide-up space-y-4">
          <h3 className="font-bold text-gradient-gold">Settings</h3>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-gray-500 text-sm">Imposter Count</label>
              <span className="badge-red text-xs">{imposterCountSetting === 0 ? "Auto" : imposterCountSetting}</span>
            </div>
            <input type="range" min={0} max={6} value={imposterCountSetting}
              onChange={(e) => onImposterCountChange(parseInt(e.target.value))} className="w-full accent-imposter-red" />
            <p className="text-gray-400 text-xs mt-1">0 = Auto based on player count</p>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-gray-500 text-sm">Discussion Time</label>
              <span className="badge text-xs bg-gray-100 text-gray-500">{discussionTimeSetting}s</span>
            </div>
            <input type="range" min={30} max={300} step={15} value={discussionTimeSetting}
              onChange={(e) => onDiscussionTimeChange(parseInt(e.target.value))} className="w-full accent-imposter-red" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-gray-500 text-sm">Strikes to Eliminate</label>
              <span className="badge text-xs bg-gray-100 text-gray-500">{strikesToEliminate}</span>
            </div>
            <input type="range" min={1} max={5} value={strikesToEliminate}
              onChange={(e) => onStrikesChange(parseInt(e.target.value))} className="w-full accent-imposter-red" />
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-2">Mga Kategorya (0 = Lahat)</p>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {cats.map((cat: any) => (
                <button key={cat.id} onClick={() => onToggleCategory(cat.id)}
                  className={`category-chip text-xs ${selectedCategories.includes(cat.id) ? "active" : ""}`}>
                  {cat.tagalog}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button onClick={onStartGame} disabled={!canStart}
        className={`btn-primary w-full text-base py-4 ${!canStart ? "!bg-gray-200 !text-gray-400 !shadow-none !cursor-not-allowed" : "animate-glow-pulse"}`}>
        {canStart ? `Start Game! (${playerNames.filter((n: string) => n.trim()).length} players)` : "Need at least 3 names"}
      </button>
    </div>
  );
}

function PassPhase({ player, playerNumber, totalPlayers, onReady }: any) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-imposter-gold/30 to-orange-500/20 flex items-center justify-center mb-6 animate-float">
        <svg className="w-10 h-10 text-imposter-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-600 mb-2">Pass the phone to</h2>
      <p className="text-3xl sm:text-4xl font-black text-gradient-gold mb-4">{player.name}</p>
      <p className="text-gray-400 text-sm mb-8">
        Player {playerNumber} of {totalPlayers}
      </p>
      <button onClick={onReady} className="btn-primary w-full max-w-xs text-base">I&apos;m Ready!</button>
      <div className="mt-8 flex gap-2">
        {Array.from({ length: totalPlayers }, (_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            i < playerNumber - 1 ? "bg-imposter-green"
            : i === playerNumber - 1 ? "bg-imposter-gold animate-pulse-fast" : "bg-gray-100"}`} />
        ))}
      </div>
    </div>
  );
}

function RevealPhase({ player, secretWord, category, hint, revealed, onReveal, onHide, isLastPlayer }: any) {
  const isImposter = player.role === "imposter";
  const displayWord = secretWord;

  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[70vh] text-center px-2">
      {!revealed ? (
        <>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">{player.name}&apos;s Card</p>
          <button onClick={onReveal}
            className="w-44 h-44 sm:w-52 sm:h-52 glass-strong rounded-3xl flex items-center justify-center hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 active:scale-95 animate-glow-pulse">
            <div className="text-center">
              <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-gray-500 text-sm font-bold">Tap to reveal</span>
            </div>
          </button>
          <p className="text-gray-300 text-xs mt-5">Remember: Don&apos;t show anyone!</p>
        </>
      ) : (
        <div className="animate-scale-in w-full max-w-sm">
          <div className="relative overflow-hidden rounded-3xl border-2 border-gray-200 bg-gradient-to-br from-gray-100 to-gray-50 p-6 sm:p-8">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            </div>
            <div className="relative">
              <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-2">You Are</p>
              <h2 className={`text-3xl sm:text-4xl font-black mb-5 ${isImposter ? "text-gradient-red" : "text-imposter-green"}`}
                style={!isImposter ? { backgroundImage: "linear-gradient(to right, #22c55e, #16a34a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : {}}>
                {isImposter ? "IMPOSTER!" : "CIVILIAN"}
              </h2>
              <div className="divider-glow my-4" />
              {!isImposter ? (
                <>
                  <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-1">The Secret is...</p>
                  <p className="text-gray-800 font-black text-3xl sm:text-4xl mt-2 leading-tight">{displayWord}</p>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-1">Your Hint</p>
                  <p className="text-imposter-gold font-bold text-sm mt-2">{hint}</p>
                  <p className="text-gray-400 text-xs mt-4">Pretend you know the word. Don&apos;t get caught!</p>
                </>
              )}
            </div>
          </div>
          <button onClick={onHide} className="btn-secondary w-full mt-6">
            {isLastPlayer ? "Start Discussion!" : "Hidden, Pass to Next"}
          </button>
          <p className="text-gray-300 text-xs mt-3">Cover the screen before passing</p>
        </div>
      )}
    </div>
  );
}

function DiscussionPhase({ timer, maxTimer, onEndDiscussion, onStartDiscussion, started, starterPlayer }: any) {
  if (!started) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[70vh] text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-gradient-gold mb-4">DISCUSSION TIME!</h2>
        <p className="text-gray-400 text-sm mb-8">The discussion will begin shortly.</p>
        {starterPlayer && (
          <div className="mb-8 animate-scale-in">
            <div className="avatar-lg mx-auto mb-3 avatar-default">
              {starterPlayer.name.charAt(0)}
            </div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Starts the discussion</p>
            <p className="text-gray-800 font-black text-xl">{starterPlayer.name}</p>
          </div>
        )}
        <button onClick={onStartDiscussion} className="btn-primary w-full max-w-sm">
          Start Discussion
        </button>
      </div>
    );
  }

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;
  const isLow = timer <= 30;
  const progress = timer / maxTimer;

  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h2 className="text-2xl sm:text-3xl font-black text-gradient-gold mb-8">DISCUSSION TIME!</h2>
      {starterPlayer && (
        <p className="text-gray-500 text-sm mb-4">
          <span className="text-imposter-gold font-bold">{starterPlayer.name}</span> started the discussion
        </p>
      )}
      <div className="relative w-40 h-40 sm:w-48 sm:h-48 mb-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="8" />
          <circle cx="80" cy="80" r="72" fill="none"
            stroke={isLow ? "#ef4444" : progress > 0.5 ? "#22c55e" : "#eab308"}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 72}
            strokeDashoffset={2 * Math.PI * 72 * (1 - progress)}
            className="timer-ring" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-4xl sm:text-5xl font-black tabular-nums ${isLow ? "text-imposter-red animate-countdown" : "text-gray-800"}`}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-8 max-w-xs">
        Discuss who the imposter might be. Ask questions, make accusations, defend yourself!
      </p>
      <button onClick={onEndDiscussion} className="btn-primary w-full max-w-sm">
        End Discussion &rarr; Vote Now!
      </button>
    </div>
  );
}

function VotingPassPhase({ player, playerNumber, totalPlayers, candidates, revealed, selectedVote, onReveal, onSelectVote, onConfirm }: any) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[70vh] text-center">
      {!revealed ? (
        <>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-imposter-red/30 to-orange-500/20 flex items-center justify-center mb-6 animate-float">
            <svg className="w-10 h-10 text-imposter-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-600 mb-2">Pass the phone to vote</h2>
          <p className="text-3xl sm:text-4xl font-black text-gradient-red mb-4">{player.name}</p>
          <p className="text-gray-400 text-sm mb-8">Voter {playerNumber} of {totalPlayers}</p>
          <button onClick={onReveal} className="btn-primary w-full max-w-xs text-base">Ready to Vote</button>
          <div className="mt-8 flex gap-2">
            {Array.from({ length: totalPlayers }, (_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i < playerNumber - 1 ? "bg-imposter-green"
                : i === playerNumber - 1 ? "bg-imposter-gold animate-pulse-fast" : "bg-gray-100"}`} />
            ))}
          </div>
        </>
      ) : (
        <div className="animate-scale-in w-full max-w-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-2">{player.name}</h2>
          <p className="text-gray-400 text-sm mb-6">Who is the imposter?</p>
          <div className="space-y-2 mb-6">
            {candidates.map((c: any) => (
              <button key={c.id} onClick={() => onSelectVote(c.id)}
                className={`w-full p-3 rounded-2xl transition-all duration-200 text-left ${
                  selectedVote === c.id
                    ? "bg-red-100 border-2 border-imposter-red/50"
                    : "glass-card hover:bg-gray-100"
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`avatar-md flex-shrink-0 ${selectedVote === c.id ? "bg-imposter-red text-white" : "avatar-default"}`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-sm">{c.name}</span>
                  {selectedVote === c.id && (
                    <svg className="w-5 h-5 text-imposter-red ml-auto" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
          <button onClick={onConfirm} disabled={!selectedVote}
            className={`btn-primary w-full ${!selectedVote ? "!bg-gray-200 !text-gray-400 !shadow-none !cursor-not-allowed" : ""}`}>
            Confirm Vote
          </button>
        </div>
      )}
    </div>
  );
}

function VoteResultsPhase({ players, votingResult, allVotes, strikesToEliminate, onContinue }: any) {
  const { majority, eliminatedId, voteCounts, totalVotes } = votingResult;
  const target = eliminatedId ? players.find((p: any) => p.id === eliminatedId) : null;
  const majorityThreshold = Math.floor(totalVotes / 2) + 1;
  const maxVoteCount = Math.max(...(Object.values(voteCounts) as number[]), 1);

  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="card text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-scale-in"
          style={{ background: majority ? "rgba(231, 76, 60, 0.15)" : "rgba(234, 179, 8, 0.15)" }}>
          <span className="text-4xl">{majority ? "✕" : "⚠️"}</span>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">
          {majority ? `${target?.name} Eliminated!` : "No Majority!"}
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          {majority
            ? `Got ${voteCounts[eliminatedId]}/${totalVotes} votes (needed ${majorityThreshold})`
            : `No one got ${majorityThreshold}/${totalVotes} votes`}
        </p>
        {!majority && (
          <span className="badge-red text-sm animate-scale-in">IMPOSTERS WIN!</span>
        )}
        {majority && target?.role === "imposter" && (
          <span className="badge-red text-sm animate-scale-in">They were the IMPOSTER!</span>
        )}
        {majority && target?.role === "civilian" && (
          <span className="badge-green text-sm animate-scale-in">They were a Civilian</span>
        )}
      </div>
      <div className="card">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Vote Tally</h3>
        <div className="space-y-2">
          {players.filter((p: any) => p.isAlive).map((p: any) => {
            const count = voteCounts[p.id] || 0;
            const barWidth = maxVoteCount > 0 ? (count / maxVoteCount) * 100 : 0;
            const isEliminated = p.id === eliminatedId;
            return (
              <div key={p.id} className={`p-2.5 rounded-xl ${isEliminated ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`avatar-sm ${isEliminated ? "bg-imposter-red text-white" : "avatar-default"}`}>
                      {p.name.charAt(0)}
                    </div>
                    <span className={`text-sm font-semibold ${isEliminated ? "text-imposter-red" : "text-gray-700"}`}>{p.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${count > 0 ? "text-gray-800" : "text-gray-300"}`}>{count} vote{count !== 1 ? "s" : ""}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${isEliminated ? "bg-imposter-red" : "bg-imposter-gold"}`}
                    style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Who Voted For Whom</h3>
        <div className="space-y-1.5">
          {Object.entries(allVotes).map(([voterId, targetId]: [string, any]) => {
            const voter = players.find((p: any) => p.id === voterId);
            const voted = players.find((p: any) => p.id === targetId);
            return (
              <div key={voterId} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">{voter?.name}</span>
                <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span className="text-imposter-red font-semibold">{voted?.name}</span>
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onContinue} className="btn-primary w-full">
        {majority ? "Continue" : "See Final Results"}
      </button>
    </div>
  );
}

function ResultsPhase({ round, players, roundNumber, strikesToEliminate, onNextRound }: any) {
  const alivePlayers = players.filter((p: any) => p.isAlive);
  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="card text-center">
        <h2 className="text-lg font-black text-gradient-gold mb-4">Round {roundNumber} Results</h2>
        {round && (
          <>
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">The secret word was</p>
              <p className="text-imposter-green font-black text-2xl sm:text-3xl">{round.secretWord}</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">The imposter was</p>
              <div className="flex flex-wrap justify-center gap-2">
                {round.imposterIds.map((id: string) => {
                  const p = players.find((pl: any) => pl.id === id);
                  return <span key={id} className="badge-red">{p?.name}</span>;
                })}
              </div>
            </div>
          </>
        )}
        <div className="divider my-4" />
        <div className="space-y-1.5 text-left">
          {players.map((p: any) => (
            <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-xl text-sm ${
              p.isAlive ? "bg-gray-50" : "bg-red-50 opacity-50"}`}>
              <div className="flex items-center gap-2">
                <div className={`avatar-sm ${p.isAlive ? "avatar-default" : "bg-red-100"}`}>
                  {p.name.charAt(0)}
                </div>
                <span className="font-medium text-sm">{p.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: strikesToEliminate }, (_, i) => (
                  <div key={i} className={`strike-dot ${i < p.strikes ? "active" : "inactive"}`} />
                ))}
                {!p.isAlive && <span className="badge bg-red-50 text-red-500/60 text-[10px] ml-1">ELIM</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onNextRound} className="btn-primary w-full">
        Next Round ({alivePlayers.length} remaining)
      </button>
    </div>
  );
}

function GameOverPhase({ winner, round, players, onPlayAgain, onBackToSetup }: any) {
  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="card text-center">
        <div className="mb-5">
          <div className="text-6xl mb-3">{winner === "civilians" ? "🎉" : "😈"}</div>
          <h2 className="text-3xl sm:text-4xl font-black">
            {winner === "civilians" ? (
              <span className="text-imposter-green">CIVILIANS WIN!</span>
            ) : (
              <span className="text-gradient-red">IMPOSTERS WIN!</span>
            )}
          </h2>
        </div>
        {round && (
          <>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">The secret word was</p>
              <p className="text-imposter-gold font-black text-2xl sm:text-3xl">{round.secretWord}</p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl mb-4">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">The imposter was</p>
              <div className="flex flex-wrap justify-center gap-2">
                {round.imposterIds.map((id: string) => {
                  const p = players.find((pl: any) => pl.id === id);
                  return <span key={id} className="badge-red">{p?.name}</span>;
                })}
              </div>
            </div>
          </>
        )}
        <div className="divider my-4" />
        <div className="space-y-1.5 text-left">
          {[...players].sort((a: any, b: any) => a.strikes - b.strikes).map((p: any) => (
            <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-xl text-sm ${
              p.isAlive ? "bg-gray-50" : "bg-red-50 opacity-50"}`}>
              <div className="flex items-center gap-2">
                <div className={`avatar-sm ${p.role === "imposter" ? "bg-imposter-red" : "avatar-default"}`}>
                  {p.name.charAt(0)}
                </div>
                <span className="font-medium text-sm">{p.name}</span>
                {p.role === "imposter" && <span className="badge-red text-[10px] py-0">IMPOSTER</span>}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`strike-dot ${i < p.strikes ? "active" : "inactive"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <button onClick={onPlayAgain} className="btn-primary w-full">Play Again</button>
        <button onClick={onBackToSetup} className="btn-secondary w-full">Back to Setup</button>
      </div>
    </div>
  );
}
