"use client";

export function getPersistentId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem("imposter_persistent_id");
  if (!id) {
    id = "pid_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("imposter_persistent_id", id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("imposter_player_name") || "";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("imposter_player_name", name);
}
