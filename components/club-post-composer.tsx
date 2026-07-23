"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { type ClubMember } from "@/lib/app-data";

function readMedia(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ClubPostComposer({ clubSlug, members }: { clubSlug: string; members: ClubMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<1 | 3>(1);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const [permissions, setPermissions] = useState({ canPost: false, canCreateAnnouncement: false });

  useEffect(() => {
    const userId = readAuthSession()?.user.userId;
    const member = members.find((item) => item.userId === userId);
    setPermissions({ canPost: Boolean(member?.canPost), canCreateAnnouncement: Boolean(member?.canCreateAnnouncement) });
    if (member?.canPost && !member.canCreateAnnouncement) setType(1);
    if (!member?.canPost && member?.canCreateAnnouncement) setType(3);
  }, [members]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = readAuthSession();
    if (!session || !content.trim() || (type === 3 && files.length !== 1)) return;

    setStatus("saving");
    setMessage("");
    try {
      const mediaUrls = await Promise.all(files.map(readMedia));
      const response = await authFetch(`${API_BASE_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, clubSlug, caption: content.trim(), mediaUrls }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Publishing failed");

      setContent("");
      setFiles([]);
      setStatus("idle");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Publishing failed");
    }
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith("image/") || file.type === "video/mp4"
    );
    setFiles(type === 3 ? selected.filter((file) => file.type.startsWith("image/")).slice(0, 1) : selected);
    setStatus("idle");
  }

  if (!permissions.canPost && !permissions.canCreateAnnouncement) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary/90"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        Create
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="club-post-title">
          <form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2 id="club-post-title" className="font-headline-md text-2xl text-on-background">Create club content</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container" aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-5 inline-flex rounded-lg bg-surface-container p-1" aria-label="Content type">
              {([[1, "Post", permissions.canPost], [3, "Announcement", permissions.canCreateAnnouncement]] as const)
                .filter(([, , allowed]) => allowed)
                .map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setType(value); setFiles([]); setStatus("idle"); }}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${type === value ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-on-surface">{type === 3 ? "Poster" : "Photos and videos"}</span>
              <input
                key={type}
                type="file"
                required={type === 3}
                multiple={type === 1}
                accept={type === 3 ? "image/*" : "image/*,video/mp4"}
                onChange={selectFiles}
                className="mt-2 block w-full rounded-lg border border-outline-variant bg-surface-container-low text-sm file:mr-4 file:border-0 file:bg-primary file:px-4 file:py-3 file:font-semibold file:text-white"
              />
            </label>

            {files.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">{file.type.startsWith("video/") ? "videocam" : "image"}</span>
                    <span className="max-w-52 truncate">{file.name}</span>
                    <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}>
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-on-surface">Content</span>
              <textarea
                autoFocus
                required
                maxLength={2000}
                value={content}
                onChange={(event) => { setContent(event.target.value); setStatus("idle"); }}
                className="mt-2 min-h-44 w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm outline-none focus:border-primary"
                placeholder={type === 3 ? "Write an announcement..." : "Share a club update..."}
              />
            </label>

            {message ? <p className="mt-3 text-sm font-semibold text-secondary">{message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-on-surface-variant">Cancel</button>
              <button disabled={status === "saving" || !content.trim() || (type === 3 && files.length !== 1)} type="submit" className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {status === "saving" ? "Publishing..." : "Publish"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
