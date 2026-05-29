"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

function readForm(form: HTMLFormElement, name: string) {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readPhoto(form: HTMLFormElement) {
  const file = new FormData(form).get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return Promise.resolve("");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CreatePostOverlay() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const caption = readForm(form, "caption");
    const hashtags = readForm(form, "hashtags");
    const taggedPeople = readForm(form, "taggedPeople");
    setStatus("saving");

    try {
      const image = await readPhoto(form);
      const response = await fetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: "Aarav Rao",
          meta: "Just now - Campus Nexus",
          title: caption ? caption.slice(0, 72) : "New photo from campus",
          body: taggedPeople ? `${caption || "Shared a new campus photo."} Tagged: ${taggedPeople}` : caption,
          image,
          tag: hashtags || "#campusnexus",
          taggedPeople,
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
              Share a campus moment.
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
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Photo</span>
            <input
              name="photo"
              accept="image/*"
              className="w-full rounded-2xl border border-dashed border-outline-variant/80 bg-surface-container-low px-4 py-5 text-sm text-on-surface outline-none file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-on-primary"
              type="file"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Caption</span>
            <textarea
              name="caption"
              className="min-h-36 w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              placeholder="Write a caption..."
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Hashtags</span>
            <input
              name="hashtags"
              className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              placeholder="#campus #fest"
              type="text"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">Tag people</span>
            <input
              name="taggedPeople"
              className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              placeholder="@ananya @rohit"
              type="text"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
            <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
              {status === "saving"
                ? "Publishing to the demo backend..."
                : status === "success"
                ? "Post created."
                : status === "error"
                ? "Backend is not reachable. Start Flask and try again."
                : "Photo posts are saved to the in-memory Flask demo backend."}
            </p>
            <button
              disabled={status === "saving"}
              className="rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] transition hover:scale-[1.02] disabled:opacity-60"
              type="submit"
            >
              Publish Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
