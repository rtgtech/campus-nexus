"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { SourceBottomNav } from "@/components/source-bottom-nav";

type Phase = "ready" | "flashing" | "selecting" | "feedback" | "finished";

type RoundResult = {
  correct: number;
  total: number;
  wrong: number;
  solved: boolean;
};

const GAME_SECONDS = 45;

function levelConfig(level: number) {
  const side = Math.min(3 + Math.floor((level - 1) / 3), 6);
  const cells = side * side;
  const targetCount = Math.min(2 + level, Math.max(3, Math.floor(cells * 0.56)));
  const flashMs = Math.max(850, 1650 - level * 70);

  return {
    rows: side,
    cols: side,
    cells,
    targetCount,
    flashMs,
  };
}

function createTargets(cellCount: number, targetCount: number) {
  const targets = new Set<number>();

  while (targets.size < targetCount) {
    targets.add(Math.floor(Math.random() * cellCount));
  }

  return targets;
}

function formatTime(seconds: number) {
  return `0:${seconds.toString().padStart(2, "0")}`;
}

export default function MindSnapPage() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(1);
  const [nextLevel, setNextLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [targets, setTargets] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [result, setResult] = useState<RoundResult | null>(null);

  const config = useMemo(() => levelConfig(level), [level]);
  const progress = (timeLeft / GAME_SECONDS) * 100;

  function startRound(levelToPlay: number) {
    const roundConfig = levelConfig(levelToPlay);
    setLevel(levelToPlay);
    setTargets(createTargets(roundConfig.cells, roundConfig.targetCount));
    setSelected(new Set());
    setResult(null);
    setPhase("flashing");
  }

  function startGame() {
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setNextLevel(1);
    startRound(1);
  }

  function toggleCell(index: number) {
    if (phase !== "selecting") {
      return;
    }

    setSelected((current) => {
      const next = new Set(current);

      if (next.has(index)) {
        next.delete(index);
        return next;
      }

      if (next.size < config.targetCount) {
        next.add(index);
      }

      return next;
    });
  }

  function submitRound() {
    if (phase !== "selecting") {
      return;
    }

    let correct = 0;
    selected.forEach((index) => {
      if (targets.has(index)) {
        correct += 1;
      }
    });

    const wrong = selected.size - correct;
    const solved = correct === targets.size && wrong === 0;
    const roundResult = {
      correct,
      total: targets.size,
      wrong,
      solved,
    };

    setScore((current) => current + correct);
    setResult(roundResult);
    setNextLevel(solved ? level + 1 : level);
    setPhase("feedback");
  }

  useEffect(() => {
    if (phase !== "flashing") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPhase("selecting");
    }, config.flashMs);

    return () => window.clearTimeout(timeoutId);
  }, [config.flashMs, phase]);

  useEffect(() => {
    if (phase === "ready" || phase === "finished") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [phase]);

  useEffect(() => {
    if (timeLeft === 0 && phase !== "ready" && phase !== "finished") {
      setPhase("finished");
    }
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== "feedback") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startRound(nextLevel);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [nextLevel, phase]);

  const statusText =
    phase === "ready"
      ? "Start the round"
      : phase === "flashing"
        ? "Memorize"
        : phase === "selecting"
          ? "Select the flashed squares"
          : phase === "feedback"
            ? result?.solved
              ? "Level cleared"
              : "Try this level again"
            : "Time up";

  return (
    <>
      <div className="min-h-screen bg-white pb-28 font-body-md text-on-surface">
        <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-white/80 shadow-sm shadow-primary/5 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <Link href="/games" className="font-['Space_Grotesk'] text-xl font-black tracking-normal text-primary">
              Mind Snap
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/games"
                className="hidden rounded-full border border-outline-variant/70 px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary sm:inline-flex"
              >
                Games
              </Link>
              <AuthSessionControl compact />
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-6xl gap-4 px-4 pt-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-[24px] border border-surface-container-highest bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary">Memory Grid</p>
                <h1 className="mt-1 font-['Space_Grotesk'] text-2xl font-black tracking-normal text-primary sm:text-3xl">
                  Mind Snap
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary-fixed px-3 py-1.5 text-xs font-bold text-secondary">
                <span className="material-symbols-outlined text-base">timer</span>
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <div className="h-full rounded-full bg-secondary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            <div className="flex justify-center py-1">
              <div
                className="grid w-full max-w-[420px] gap-1.5 rounded-[22px] border border-outline-variant bg-surface-container-low p-2.5 shadow-inner sm:gap-2 sm:p-3"
                style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: config.cells }, (_, index) => {
                  const isTarget = targets.has(index);
                  const isSelected = selected.has(index);
                  const isRevealed = phase === "flashing" && isTarget;
                  const showFeedback = phase === "feedback" || phase === "finished";
                  const isCorrectSelection = showFeedback && isSelected && isTarget;
                  const isWrongSelection = showFeedback && isSelected && !isTarget;
                  const isMissedTarget = showFeedback && !isSelected && isTarget;

                  return (
                    <button
                      key={index}
                      aria-label={`Cell ${index + 1}`}
                      className={[
                        "aspect-square rounded-xl border text-transparent outline-none transition duration-150",
                        "focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                        isRevealed
                          ? "border-secondary bg-secondary shadow-[0_0_16px_rgba(236,32,36,0.34)]"
                          : "border-primary bg-primary shadow-[inset_0_0_18px_rgba(255,255,255,0.08)]",
                        phase === "selecting" ? "hover:border-primary-container hover:bg-primary-container" : "",
                        isSelected && phase === "selecting"
                          ? "border-secondary bg-secondary shadow-[0_0_14px_rgba(236,32,36,0.28)]"
                          : "",
                        isCorrectSelection ? "border-secondary bg-secondary shadow-[0_0_14px_rgba(236,32,36,0.28)]" : "",
                        isWrongSelection ? "border-secondary bg-secondary shadow-[0_0_14px_rgba(236,32,36,0.28)]" : "",
                        isMissedTarget ? "border-secondary bg-secondary-fixed" : "",
                      ].join(" ")}
                      disabled={phase !== "selecting"}
                      type="button"
                      onClick={() => toggleCell(index)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <section className="rounded-[22px] border border-surface-container-highest bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">Status</p>
              <h2 className="mt-1 font-['Space_Grotesk'] text-xl font-black tracking-normal text-primary">{statusText}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">Level</p>
                  <p className="mt-1 font-['Space_Grotesk'] text-2xl font-black tracking-normal text-primary">{level}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">XP</p>
                  <p className="mt-1 font-['Space_Grotesk'] text-2xl font-black tracking-normal text-secondary">{score}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
                Grid {config.rows} x {config.cols}. Selected {selected.size}/{config.targetCount} squares.
              </div>
            </section>

            {result ? (
              <section className="rounded-[22px] border border-surface-container-highest bg-white p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">Round</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-on-surface-variant">Correct squares</p>
                    <p className="font-['Space_Grotesk'] text-2xl font-black tracking-normal text-primary">
                      {result.correct}/{result.total}
                    </p>
                  </div>
                  <p className={result.solved ? "text-xs font-bold text-primary" : "text-xs font-bold text-secondary"}>
                    {result.solved ? "Solved" : `${result.wrong} wrong`}
                  </p>
                </div>
              </section>
            ) : null}

            <section className="rounded-[22px] border border-surface-container-highest bg-white p-4 shadow-sm">
              <p className="text-xs leading-5 text-on-surface-variant">
                Watch the flash, then select exactly those squares. Every correct square adds one XP. Clear a level to make the
                next grid harder.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {phase === "ready" || phase === "finished" ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_28px_rgba(236,32,36,0.18)] transition hover:scale-[1.02]"
                    type="button"
                    onClick={startGame}
                  >
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    {phase === "finished" ? "Play again" : "Start"}
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_28px_rgba(236,32,36,0.18)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={phase !== "selecting" || selected.size !== config.targetCount}
                    type="button"
                    onClick={submitRound}
                  >
                    <span className="material-symbols-outlined text-base">done_all</span>
                    Submit
                  </button>
                )}

                <Link
                  href="/games/leaderboards"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-2.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base">leaderboard</span>
                  Leaderboard
                </Link>
              </div>
            </section>
          </aside>
        </main>
      </div>

      <SourceBottomNav active="games" variant="games" />
    </>
  );
}
