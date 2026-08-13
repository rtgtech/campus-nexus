"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-full bg-secondary text-white hover:bg-secondary/90" />}>
        <span className="material-symbols-outlined text-lg">add</span>
        Create
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="font-headline-md text-2xl text-on-background">Create club content</DialogTitle>
          <DialogDescription className="sr-only">Publish a post or announcement to this club</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
            <ToggleGroup
              aria-label="Content type"
              className="mt-5 bg-surface-container p-1"
              value={[String(type)]}
              onValueChange={(values) => {
                const nextType = Number(values[0]) as 1 | 3;
                if (nextType !== 1 && nextType !== 3) return;
                setType(nextType);
                setFiles([]);
                setStatus("idle");
              }}
            >
              {([[1, "Post", permissions.canPost], [3, "Announcement", permissions.canCreateAnnouncement]] as const)
                .filter(([, , allowed]) => allowed)
                .map(([value, label]) => (
                <ToggleGroupItem
                  key={value}
                  value={String(value)}
                  className="px-4"
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Field className="mt-5">
              <FieldLabel htmlFor="club-post-media">{type === 3 ? "Poster" : "Photos and videos"}</FieldLabel>
              <Input
                key={type}
                id="club-post-media"
                type="file"
                required={type === 3}
                multiple={type === 1}
                accept={type === 3 ? "image/*" : "image/*,video/mp4"}
                onChange={selectFiles}
                className="h-11 bg-surface-container-low"
              />
            </Field>

            {files.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}`} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface-variant">
                    <span className="material-symbols-outlined text-base">{file.type.startsWith("video/") ? "videocam" : "image"}</span>
                    <span className="max-w-52 truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}>
                      <span className="material-symbols-outlined text-base">close</span>
                    </Button>
                  </span>
                ))}
              </div>
            ) : null}

            <Field className="mt-5">
              <FieldLabel htmlFor="club-post-content">Content</FieldLabel>
              <Textarea
                autoFocus
                required
                id="club-post-content"
                maxLength={2000}
                value={content}
                onChange={(event) => { setContent(event.target.value); setStatus("idle"); }}
                className="min-h-44 resize-y bg-surface-container-low"
                placeholder={type === 3 ? "Write an announcement..." : "Share a club update..."}
              />
            </Field>

            {message ? <p className="mt-3 text-sm font-semibold text-secondary">{message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)} variant="ghost">Cancel</Button>
              <Button disabled={status === "saving" || !content.trim() || (type === 3 && files.length !== 1)} type="submit" className="bg-secondary text-white hover:bg-secondary/90">
                {status === "saving" ? "Publishing..." : "Publish"}
              </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
