"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthSessionControl } from "@/components/auth-session-control";
import { SourceBottomNav } from "@/components/source-bottom-nav";
import { API_BASE_URL, isAdminUser, readAuthSession } from "@/lib/auth-client";

type Cell = {
  row: number;
  col: number;
};

type Puzzle = {
  id: string;
  puzzle: number[][];
  solution: number[][];
};

type XpSaveStatus = "idle" | "saving" | "saved" | "skipped" | "error";

const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;
const XP_PER_PUZZLE = 100;

const PUZZLES: Puzzle[] = [
  {
    id: "campus-1",
    puzzle: [
      [1, 0, 0, 0, 5, 0],
      [0, 5, 0, 1, 0, 3],
      [0, 0, 4, 0, 6, 0],
      [5, 0, 0, 2, 0, 4],
      [0, 4, 0, 0, 1, 0],
      [0, 0, 2, 3, 0, 5],
    ],
    solution: [
      [1, 2, 3, 4, 5, 6],
      [4, 5, 6, 1, 2, 3],
      [2, 3, 4, 5, 6, 1],
      [5, 6, 1, 2, 3, 4],
      [3, 4, 5, 6, 1, 2],
      [6, 1, 2, 3, 4, 5],
    ],
  },
  {
    id: "campus-2",
    puzzle: [
      [2, 0, 4, 0, 0, 1],
      [0, 6, 0, 2, 0, 0],
      [0, 0, 5, 0, 1, 0],
      [6, 0, 0, 3, 0, 5],
      [0, 5, 0, 0, 2, 0],
      [1, 0, 0, 4, 0, 6],
    ],
    solution: [
      [2, 3, 4, 5, 6, 1],
      [5, 6, 1, 2, 3, 4],
      [3, 4, 5, 6, 1, 2],
      [6, 1, 2, 3, 4, 5],
      [4, 5, 6, 1, 2, 3],
      [1, 2, 3, 4, 5, 6],
    ],
  },
  {
    id: "campus-3",
    puzzle: [
      [0, 1, 0, 6, 0, 5],
      [6, 0, 5, 0, 1, 0],
      [0, 2, 0, 4, 0, 0],
      [4, 0, 3, 0, 0, 6],
      [0, 6, 0, 5, 0, 1],
      [5, 0, 0, 0, 6, 0],
    ],
    solution: [
      [3, 1, 2, 6, 4, 5],
      [6, 4, 5, 3, 1, 2],
      [1, 2, 6, 4, 5, 3],
      [4, 5, 3, 1, 2, 6],
      [2, 6, 4, 5, 3, 1],
      [5, 3, 1, 2, 6, 4],
    ],
  },
];

function cloneGrid(grid: number[][]) {
  return grid.map((row) => [...row]);
}

function cellKey(row: number, col: number) {
  return `${row}-${col}`;
}

function isFixedCell(puzzle: Puzzle, row: number, col: number) {
  return puzzle.puzzle[row][col] !== 0;
}

function duplicateKeysForUnit(cells: Array<{ row: number; col: number; value: number }>) {
  const grouped = new Map<number, Array<{ row: number; col: number }>>();

  cells.forEach((cell) => {
    if (cell.value === 0) {
      return;
    }

    const group = grouped.get(cell.value) ?? [];
    group.push({ row: cell.row, col: cell.col });
    grouped.set(cell.value, group);
  });

  const duplicates = new Set<string>();
  grouped.forEach((group) => {
    if (group.length > 1) {
      group.forEach((cell) => duplicates.add(cellKey(cell.row, cell.col)));
    }
  });
  return duplicates;
}

function findDuplicateKeys(grid: number[][]) {
  const duplicates = new Set<string>();
  const addAll = (keys: Set<string>) => keys.forEach((key) => duplicates.add(key));

  for (let row = 0; row < SIZE; row += 1) {
    addAll(duplicateKeysForUnit(grid[row].map((value, col) => ({ row, col, value }))));
  }

  for (let col = 0; col < SIZE; col += 1) {
    addAll(duplicateKeysForUnit(grid.map((rowValues, row) => ({ row, col, value: rowValues[col] }))));
  }

  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_ROWS) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX_COLS) {
      const cells = [];
      for (let row = boxRow; row < boxRow + BOX_ROWS; row += 1) {
        for (let col = boxCol; col < boxCol + BOX_COLS; col += 1) {
          cells.push({ row, col, value: grid[row][col] });
        }
      }
      addAll(duplicateKeysForUnit(cells));
    }
  }

  return duplicates;
}

function gridsMatch(grid: number[][], solution: number[][]) {
  return grid.every((row, rowIndex) => row.every((value, colIndex) => value === solution[rowIndex][colIndex]));
}

function filledCount(grid: number[][]) {
  return grid.flat().filter(Boolean).length;
}

export default function SudokuPage() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = PUZZLES[puzzleIndex];
  const [grid, setGrid] = useState(() => cloneGrid(puzzle.puzzle));
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [xpSaveStatus, setXpSaveStatus] = useState<XpSaveStatus>("idle");
  const [xpSaveMessage, setXpSaveMessage] = useState("");
  const awardedPuzzleIdsRef = useRef<Set<string>>(new Set());

  const duplicateKeys = useMemo(() => findDuplicateKeys(grid), [grid]);
  const isSolved = duplicateKeys.size === 0 && gridsMatch(grid, puzzle.solution);
  const progress = Math.round((filledCount(grid) / (SIZE * SIZE)) * 100);

  function resetPuzzle(nextPuzzleIndex = puzzleIndex) {
    const nextPuzzle = PUZZLES[nextPuzzleIndex];
    setPuzzleIndex(nextPuzzleIndex);
    setGrid(cloneGrid(nextPuzzle.puzzle));
    setSelectedCell(null);
    setXpSaveStatus("idle");
    setXpSaveMessage("");
  }

  function selectCell(row: number, col: number) {
    setSelectedCell({ row, col });
  }

  function setCellValue(value: number) {
    if (!selectedCell || isFixedCell(puzzle, selectedCell.row, selectedCell.col)) {
      return;
    }

    setGrid((current) => {
      const next = cloneGrid(current);
      next[selectedCell.row][selectedCell.col] = value;
      return next;
    });
  }

  function clearCell() {
    setCellValue(0);
  }

  async function savePuzzleXp() {
    if (awardedPuzzleIdsRef.current.has(puzzle.id)) {
      setXpSaveStatus("saved");
      setXpSaveMessage("XP already saved for this puzzle.");
      return;
    }

    const session = readAuthSession();
    if (!session) {
      setXpSaveStatus("error");
      setXpSaveMessage("Puzzle solved. Sign in to save 100 XP.");
      return;
    }

    if (isAdminUser(session.user)) {
      setXpSaveStatus("skipped");
      setXpSaveMessage("Puzzle solved. Admin XP is not ranked.");
      return;
    }

    setXpSaveStatus("saving");
    setXpSaveMessage("Saving 100 XP...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/games/xp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          game: "sudoku",
          xp: XP_PER_PUZZLE,
        }),
        keepalive: true,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "XP save failed");
      }

      awardedPuzzleIdsRef.current.add(puzzle.id);
      setXpSaveStatus("saved");
      setXpSaveMessage(`100 XP saved. Total XP: ${data.totalXp ?? XP_PER_PUZZLE}`);
    } catch (error) {
      setXpSaveStatus("error");
      setXpSaveMessage(error instanceof Error ? error.message : "XP save failed");
    }
  }

  useEffect(() => {
    if (isSolved && xpSaveStatus === "idle") {
      void savePuzzleXp();
    }
  }, [isSolved, xpSaveStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!selectedCell) {
        return;
      }

      if (/^[1-6]$/.test(event.key)) {
        setCellValue(Number(event.key));
      }

      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
        clearCell();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [grid, puzzle, selectedCell]);

  return (
    <>
      <div className="min-h-screen bg-white pb-24 font-body-md text-on-surface">
        <header className="sticky top-0 z-50 border-b border-surface-container-highest bg-white/85 shadow-sm shadow-primary/5 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
            <Link href="/games" className="font-['Space_Grotesk'] text-xl font-black tracking-normal text-primary">
              Sudoku
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/games"
                className="hidden rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary sm:inline-flex"
              >
                Games
              </Link>
              <AuthSessionControl compact />
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6 md:grid-cols-[minmax(0,1fr)_320px] md:px-8">
          <section className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">6 x 6 Sudoku</p>
                <h1 className="mt-2 font-headline-lg text-4xl text-primary">Campus Sudoku</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                  Fill every row, column, and 2 x 3 box with numbers 1 to 6.
                </p>
              </div>
              <div className="rounded-2xl bg-primary-fixed px-4 py-3 text-right text-primary">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Reward</p>
                <p className="font-headline-md text-2xl">100 XP</p>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="grid w-full max-w-[520px] grid-cols-6 rounded-[24px] border-2 border-primary bg-primary p-1 shadow-[0_18px_44px_rgba(34,29,92,0.12)]">
                {grid.map((rowValues, row) =>
                  rowValues.map((value, col) => {
                    const fixed = isFixedCell(puzzle, row, col);
                    const selected = selectedCell?.row === row && selectedCell.col === col;
                    const duplicate = duplicateKeys.has(cellKey(row, col));
                    const rightBorder = (col + 1) % BOX_COLS === 0 && col !== SIZE - 1;
                    const bottomBorder = (row + 1) % BOX_ROWS === 0 && row !== SIZE - 1;

                    return (
                      <button
                        key={cellKey(row, col)}
                        className={[
                          "aspect-square min-h-12 border border-outline-variant bg-white text-center font-headline-md text-2xl transition hover:bg-primary-fixed/60 focus:outline-none",
                          fixed ? "font-bold text-primary" : "text-on-surface",
                          selected ? "z-10 bg-primary-fixed ring-2 ring-primary" : "",
                          duplicate ? "bg-secondary/12 text-secondary ring-2 ring-secondary" : "",
                          rightBorder ? "border-r-4 border-r-primary" : "",
                          bottomBorder ? "border-b-4 border-b-primary" : "",
                        ].join(" ")}
                        type="button"
                        onClick={() => selectCell(row, col)}
                      >
                        {value || ""}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-7">
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <button
                  key={value}
                  className="rounded-2xl bg-primary px-4 py-3 font-headline-md text-xl text-white transition hover:bg-primary/90 disabled:opacity-50"
                  disabled={!selectedCell || (selectedCell ? isFixedCell(puzzle, selectedCell.row, selectedCell.col) : true)}
                  type="button"
                  onClick={() => setCellValue(value)}
                >
                  {value}
                </button>
              ))}
              <button
                className="rounded-2xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-secondary hover:text-secondary disabled:opacity-50"
                disabled={!selectedCell || (selectedCell ? isFixedCell(puzzle, selectedCell.row, selectedCell.col) : true)}
                type="button"
                onClick={clearCell}
              >
                Clear
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p
                className={[
                  "text-sm font-semibold",
                  duplicateKeys.size > 0 ? "text-secondary" : isSolved ? "text-primary" : "text-on-surface-variant",
                ].join(" ")}
              >
                {duplicateKeys.size > 0
                  ? "Repeated number found in a row, column, or box."
                  : isSolved
                    ? "Puzzle complete."
                    : "No time limit. Take your time."}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
                  type="button"
                  onClick={() => resetPuzzle()}
                >
                  Reset
                </button>
                <button
                  className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
                  type="button"
                  onClick={() => resetPuzzle((puzzleIndex + 1) % PUZZLES.length)}
                >
                  New puzzle
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Progress</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-container-low">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-primary-fixed p-4 text-primary">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">Filled</p>
                  <p className="mt-1 font-headline-md text-2xl">{progress}%</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Timer</p>
                  <p className="mt-1 font-headline-md text-2xl text-primary">None</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-surface-container-highest bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">XP</p>
              <h2 className="mt-2 font-headline-md text-2xl text-primary">100 XP per complete puzzle</h2>
              {xpSaveMessage ? (
                <p
                  className={[
                    "mt-3 rounded-2xl p-3 text-sm font-semibold",
                    xpSaveStatus === "saved"
                      ? "bg-primary-fixed text-primary"
                      : xpSaveStatus === "error"
                        ? "bg-secondary/10 text-secondary"
                        : "bg-surface-container-low text-on-surface-variant",
                  ].join(" ")}
                >
                  {xpSaveMessage}
                </p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  Complete the board to save XP to your leaderboard total.
                </p>
              )}
              <Link
                href="/games/leaderboards"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
              >
                <span className="material-symbols-outlined text-base">leaderboard</span>
                Leaderboard
              </Link>
            </section>
          </aside>
        </main>
      </div>

      <SourceBottomNav active="games" variant="games" />
    </>
  );
}
