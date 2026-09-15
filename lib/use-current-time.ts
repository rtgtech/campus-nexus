"use client";

import { useSyncExternalStore } from "react";

let currentTime = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function refresh() {
  clearTimeout(timer);
  currentTime = Date.now();
  listeners.forEach((listener) => listener());
  // One clock for every post, aligned to seconds rather than component mounts.
  if (!document.hidden && listeners.size) timer = setTimeout(refresh, 1000 - Date.now() % 1000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    }
  };
}

export function useCurrentTime() {
  return useSyncExternalStore(subscribe, () => currentTime, () => 0);
}
