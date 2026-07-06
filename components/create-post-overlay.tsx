"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { readAuthSession } from "@/lib/auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

function readMedia(file: File | null) {
  if (!file) {
    return Promise.resolve("");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mediaKind(file: File | null) {
  if (!file) {
    return null;
  }
  return file.type.startsWith("video/") ? "video" : "image";
}

export function CreatePostOverlay() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<"media" | "content">("media");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [content, setContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  function selectFile(file: File | null) {
    if (!file || !(file.type.startsWith("image/") || file.type.startsWith("video/"))) {
      return;
    }

    setSelectedFile(file);
    setStatus("idle");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || !content.trim()) {
      return;
    }

    setStatus("saving");

    try {
      const session = readAuthSession();
      const mediaUrl = await readMedia(selectedFile);
      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({
          type: 0,
          caption: content.trim(),
          mediaUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Create post failed");
      }

      setStatus("success");
      router.push("/");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[rgba(15,18,33,0.55)] px-4 py-8 backdrop-blur-sm md:px-6 md:py-12">
      <div className="w-full max-w-2xl rounded-[28px] border border-secondary/20 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)] backdrop-blur-xl md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Create Post</p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-on-background">
              {step === "media" ? "Choose your media." : "Write your post."}
            </h2>
          </div>
          <Link
            href="/"
            className="rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
          >
            Close
          </Link>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          {step === "media" ? (
            <div
              className={[
                "flex h-[420px] max-h-[calc(100dvh-14rem)] flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed p-4 text-center transition md:h-[500px]",
                isDragging
                  ? "border-secondary bg-secondary/5"
                  : "border-outline-variant/80 bg-surface-container-low",
              ].join(" ")}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                accept="image/*,video/*"
                className="sr-only"
                type="file"
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="flex min-h-0 w-full max-w-md flex-1 flex-col justify-center">
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[22px] bg-black">
                    {mediaKind(selectedFile) === "video" ? (
                      <video className="max-h-full max-w-full object-contain" controls src={previewUrl} />
                    ) : (
                      <img alt="" className="max-h-full max-w-full object-contain" src={previewUrl} />
                    )}
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-on-surface">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="flex max-w-sm flex-col items-center">
                  <span className="material-symbols-outlined rounded-full bg-primary-fixed p-5 text-4xl text-primary">
                    add_photo_alternate
                  </span>
                  <p className="mt-5 text-lg font-bold text-on-background">Drag media here</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">Images and videos are supported.</p>
                </div>
              )}

              <button
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary px-5 py-3 text-sm font-semibold text-primary transition hover:border-secondary hover:text-secondary"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add media
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="flex h-48 items-center justify-center overflow-hidden rounded-[22px] bg-black md:h-60">
                {mediaKind(selectedFile) === "video" ? (
                  <video className="max-h-full max-w-full object-contain" controls src={previewUrl} />
                ) : (
                  <img alt="" className="max-h-full max-w-full object-contain" src={previewUrl} />
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface">Post body</span>
                <textarea
                  className="min-h-[300px] w-full resize-none rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface outline-none transition focus:border-primary md:min-h-[420px]"
                  maxLength={2000}
                  placeholder="Write something..."
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setStatus("idle");
                  }}
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
            <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
              {status === "saving"
                ? "Publishing..."
                : status === "success"
                ? "Post created."
                : status === "error"
                ? "Backend is not reachable. Start the API and try again."
                : step === "media"
                ? selectedFile
                  ? "Media selected."
                  : "Select media to continue."
                : `${content.trim().length}/2000`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {step === "content" ? (
                <button
                  className="rounded-full border border-outline-variant/70 px-5 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
                  disabled={status === "saving"}
                  type="button"
                  onClick={() => setStep("media")}
                >
                  Back
                </button>
              ) : null}

              {step === "media" ? (
                <button
                  disabled={!selectedFile}
                  className="rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] transition hover:scale-[1.02] disabled:opacity-50"
                  type="button"
                  onClick={() => setStep("content")}
                >
                  Next
                </button>
              ) : (
                <button
                  disabled={status === "saving" || !content.trim()}
                  className="rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] transition hover:scale-[1.02] disabled:opacity-50"
                  type="submit"
                >
                  Post
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
