"use client";

import { CampusIcon } from "@/components/campus-icon";


import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CampusShell } from "@/components/campus-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import type { GameXpData } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { evaluateSelection, type RoundResult } from "@/lib/mind-snap";
import { cn } from "@/lib/utils";

type Phase = "ready" | "flashing" | "selecting" | "feedback" | "finished";
type XpSaveStatus = "idle" | "saving" | "saved" | "error";

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
  const [xpSaveStatus, setXpSaveStatus] = useState<XpSaveStatus>("idle");
  const [xpSaveMessage, setXpSaveMessage] = useState("");
  const [finalXp, setFinalXp] = useState<number | null>(null);
  const hasSubmittedXpRef = useRef(false);

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
    setXpSaveStatus("idle");
    setXpSaveMessage("");
    hasSubmittedXpRef.current = false;
    setFinalXp(null);
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
    if (phase !== "selecting" || selected.size !== config.targetCount) {
      return;
    }

    const outcome = evaluateSelection(selected, targets, level);
    setScore((current) => current + outcome.result.correct);
    setResult(outcome.result);
    setNextLevel(outcome.nextLevel);
    setPhase("feedback");
  }

  function cancelGame() {
    setPhase("ready");
    setLevel(1);
    setNextLevel(1);
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setTargets(new Set());
    setSelected(new Set());
    setResult(null);
    setFinalXp(null);
    setXpSaveStatus("idle");
    setXpSaveMessage("");
    hasSubmittedXpRef.current = false;
  }

  async function saveEarnedXp(earnedXp: number) {
    if (hasSubmittedXpRef.current) {
      return;
    }

    hasSubmittedXpRef.current = true;

    if (earnedXp <= 0) {
      setXpSaveStatus("idle");
      setXpSaveMessage("No XP earned this run.");
      return;
    }

    const session = readAuthSession();
    if (!session) {
      setXpSaveStatus("error");
      setXpSaveMessage("Sign in to save XP.");
      return;
    }

    setXpSaveStatus("saving");
    setXpSaveMessage("Saving XP...");

    try {
      const response = await authFetch(`${API_BASE_URL}/api/games/xp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game: "mind-snap",
          xp: earnedXp,
        }),
        keepalive: true,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "XP save failed");
      }
      const payload = parseApiResponse<GameXpData>("/api/games/xp", data);

      setXpSaveStatus("saved");
      setXpSaveMessage(`${payload.awardedXp} XP saved. Total XP: ${payload.totalXp}`);
    } catch (error) {
      hasSubmittedXpRef.current = false;
      setXpSaveStatus("error");
      setXpSaveMessage(error instanceof Error ? error.message : "XP save failed");
    }
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
    if (phase === "selecting" && selected.size === config.targetCount) {
      submitRound();
    }
  }, [config.targetCount, phase, selected]);

  useEffect(() => {
    if (timeLeft === 0 && phase !== "ready" && phase !== "finished") {
      const finalRoundCorrect = phase === "selecting" ? evaluateSelection(selected, targets, level).result.correct : 0;
      const earnedXp = score + finalRoundCorrect;

      setScore(earnedXp);
      setFinalXp(earnedXp);
      setPhase("finished");
      void saveEarnedXp(earnedXp);
    }
  }, [level, phase, score, selected, targets, timeLeft]);

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
              : "Moving to next level"
            : "Time up";

  return (
    <>
      <CampusShell active="games"><div className="grid  gap-4   lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded border border-surface-container-highest bg-white p-3  sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-secondary-fixed-variant">Memory Grid</p>
                <h1 className="font-editorial font-medium mt-1  text-2xl  tracking-normal text-on-background sm:text-3xl">
                  Mind Snap
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded border border-secondary/25 bg-secondary-fixed px-3 py-1.5 text-xs font-bold text-on-secondary-fixed-variant">
                <CampusIcon name="timer" className=" text-base" />
                {formatTime(timeLeft)}
              </div>
            </div>

            <Progress
              aria-label="Round time remaining"
              className="mb-3 [&_[data-slot=progress-indicator]]:bg-secondary [&_[data-slot=progress-track]]:h-1.5"
              value={progress}
            />

            <div className="flex justify-center py-1">
              <div
                className="grid w-full max-w-[420px] gap-1.5 rounded border border-outline-variant bg-surface-container-low p-2.5  sm:gap-2 sm:p-3"
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
                    <Button
                      key={index}
                      aria-label={`Cell ${index + 1}`}
                      className={[
                        "h-auto aspect-square w-full rounded border p-0 text-transparent",
                        "focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                        isRevealed
                          ? "border-secondary bg-secondary "
                          : "border-primary bg-primary ",
                        phase === "selecting" ? "hover:border-primary-container hover:bg-primary-container" : "",
                        isSelected && phase === "selecting"
                          ? "border-secondary bg-secondary "
                          : "",
                        isCorrectSelection ? "border-secondary bg-secondary " : "",
                        isWrongSelection ? "border-secondary bg-secondary " : "",
                        isMissedTarget ? "border-secondary bg-secondary-fixed" : "",
                      ].join(" ")}
                      disabled={phase !== "selecting"}
                      type="button"
                      variant="ghost"
                      onClick={() => toggleCell(index)}
                    >
                      {index + 1}
                    </Button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <section className="rounded border border-surface-container-highest bg-white p-4 ">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-secondary-fixed-variant">Status</p>
              <h2 className="mt-1 font-sans text-xl font-black tracking-normal text-on-background">{statusText}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded bg-surface-container-low p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">Level</p>
                  <p className="mt-1 font-sans text-2xl font-black tracking-normal text-on-background">{level}</p>
                </div>
                <div className="rounded bg-surface-container-low p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">XP</p>
                  <p className="mt-1 font-sans text-2xl font-black tracking-normal text-on-background">{score}</p>
                </div>
              </div>
              <div className="mt-3 rounded bg-surface-container-low p-3 text-xs text-on-surface-variant">
                Grid {config.rows} x {config.cols}. Selected {selected.size}/{config.targetCount} squares.
              </div>
              {phase === "finished" && finalXp !== null ? (
                <div className="mt-3 rounded border border-secondary/20 bg-secondary-fixed p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-secondary-fixed-variant">XP earned</p>
                  <p className="mt-1 font-sans text-3xl font-black tracking-normal text-on-background">{finalXp}</p>
                </div>
              ) : null}
              {xpSaveMessage ? (
                <div
                  className={[
                    "mt-3 rounded p-3 text-xs font-semibold",
                    xpSaveStatus === "saved"
                      ? "bg-primary-fixed text-primary"
                      : xpSaveStatus === "error"
                        ? "bg-secondary-fixed text-on-secondary-fixed-variant"
                        : "bg-surface-container-low text-on-surface-variant",
                  ].join(" ")}
                >
                  {xpSaveMessage}
                </div>
              ) : null}
            </section>

            {result ? (
              <section className="rounded border border-surface-container-highest bg-white p-4 ">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-secondary-fixed-variant">Round</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-on-surface-variant">Correct squares</p>
                    <p className="font-sans text-2xl font-black tracking-normal text-on-background">
                      {result.correct}/{result.total}
                    </p>
                  </div>
                  <p className={result.solved ? "text-xs font-bold text-primary" : "text-xs font-bold text-on-secondary-fixed-variant"}>
                    {result.solved ? "Solved" : `${result.wrong} wrong`}
                  </p>
                </div>
              </section>
            ) : null}

            <section className="rounded border border-surface-container-highest bg-white p-4 ">
              <p className="text-xs leading-5 text-on-surface-variant">
                Watch the flash, then select the required number of squares. Every correct square adds one XP, and every full
                selection advances to the next level.
              </p>

              <div className="mt-4 flex flex-col gap-2">
                {phase === "ready" || phase === "finished" ? (
                  <Button
                    className="rounded bg-secondary px-4 text-xs font-black text-black  hover:bg-secondary/90"
                    type="button"
                    onClick={startGame}
                  >
                    <CampusIcon name="play_arrow" className=" text-base" />
                    {phase === "finished" ? "Play again" : "Start"}
                  </Button>
                ) : (
                  <Button
                    className="rounded bg-secondary px-4 text-xs font-black text-black  hover:bg-secondary/90"
                    type="button"
                    onClick={cancelGame}
                  >
                    <CampusIcon name="close" className=" text-base" />
                    Cancel
                  </Button>
                )}

                <Link
                  href="/games/leaderboards"
                  className={cn(buttonVariants({ variant: "outline" }), "rounded px-4 text-xs text-on-surface-variant hover:text-primary")}
                >
                  <CampusIcon name="leaderboard" className=" text-base" />
                  {phase === "finished" ? "View leaderboard" : "Leaderboard"}
                </Link>
              </div>
            </section>
          </aside>
        </div></CampusShell>
    </>
  );
}
