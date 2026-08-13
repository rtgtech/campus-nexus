"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

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

export function CreatePostOverlay({ returnHref = "/" }: { returnHref?: string }) {
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
      const mediaUrl = await readMedia(selectedFile);
      const response = await authFetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      router.push(returnHref);
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) router.replace(returnHref);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-hidden rounded-[10px] border-secondary/20 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)] backdrop-blur-xl md:p-6">
        <DialogHeader className="pr-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Create Post</p>
            <DialogTitle className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-on-background">
              {step === "media" ? "Choose your media." : "Write your post."}
            </DialogTitle>
            <DialogDescription className="sr-only">Create a campus post</DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0">
        <form className="mt-2 space-y-5 pr-3" onSubmit={handleSubmit}>
          {step === "media" ? (
            <div
              className={[
                "flex h-[420px] max-h-[calc(100dvh-14rem)] flex-col items-center justify-center overflow-hidden rounded-[10px] border border-dashed p-4 text-center transition md:h-[500px]",
                isDragging
                  ? "border-secondary bg-secondary/5"
                  : "border-outline-variant/80 bg-surface-container-low",
              ].join(" ")}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Input
                ref={inputRef}
                accept="image/*,video/*"
                className="sr-only"
                type="file"
                onChange={handleFileChange}
              />

              {previewUrl ? (
                <div className="flex min-h-0 w-full max-w-md flex-1 flex-col justify-center">
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[10px] bg-black">
                    {mediaKind(selectedFile) === "video" ? (
                      <video className="max-h-full max-w-full object-contain" controls src={previewUrl} />
                    ) : (
                      <img alt="" className="max-h-full max-w-full object-contain" src={previewUrl} />
                    )}
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-on-surface">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="material-symbols-outlined rounded-full bg-primary-fixed p-5 text-4xl text-primary">
                    add_photo_alternate
                  </span>
                  <p className="mt-5 text-lg font-bold text-on-background">Drag media here</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">Images and videos are supported.</p>
                </div>
              )}

              <Button
                className="mt-6 rounded-full px-5"
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-base">add</span>
                Add media
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="flex h-48 items-center justify-center overflow-hidden rounded-[10px] bg-black md:h-60">
                {mediaKind(selectedFile) === "video" ? (
                  <video className="max-h-full max-w-full object-contain" controls src={previewUrl} />
                ) : (
                  <img alt="" className="max-h-full max-w-full object-contain" src={previewUrl} />
                )}
              </div>

              <Field>
                <FieldLabel htmlFor="post-body">Post body</FieldLabel>
                <Textarea
                  id="post-body"
                  className="min-h-[300px] resize-none rounded-2xl bg-surface-container-low px-4 py-3 text-sm leading-6 md:min-h-[420px]"
                  maxLength={2000}
                  placeholder="Write something..."
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setStatus("idle");
                  }}
                />
              </Field>
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
                <Button
                  className="rounded-full px-5"
                  disabled={status === "saving"}
                  type="button"
                  variant="outline"
                  onClick={() => setStep("media")}
                >
                  Back
                </Button>
              ) : null}

              {step === "media" ? (
                <Button
                  disabled={!selectedFile}
                  className="rounded-full bg-secondary px-5 text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] hover:bg-secondary/90"
                  type="button"
                  onClick={() => setStep("content")}
                >
                  Next
                </Button>
              ) : (
                <Button
                  disabled={status === "saving" || !content.trim()}
                  className="rounded-full bg-secondary px-5 text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] hover:bg-secondary/90"
                  type="submit"
                >
                  Post
                </Button>
              )}
            </div>
          </div>
        </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
