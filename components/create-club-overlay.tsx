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

export function CreateClubOverlay() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("saving");

    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: readForm(form, "name") || "New Campus Club",
          category: readForm(form, "category"),
          description: readForm(form, "shortDescription") || readForm(form, "fullDescription"),
          fullDescription: readForm(form, "fullDescription"),
          campusArea: readForm(form, "campusArea"),
          meetingMode: readForm(form, "meetingMode"),
          meetingSchedule: readForm(form, "meetingSchedule"),
          contactEmail: readForm(form, "contactEmail"),
          bannerImage: readForm(form, "bannerUrl"),
          tags: readForm(form, "tags"),
          membershipType: readForm(form, "membershipType"),
          approvalMode: readForm(form, "approvalMode"),
        }),
      });

      if (!response.ok) {
        throw new Error("Create club failed");
      }

      setStatus("success");
      router.push("/clubs");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[rgba(15,18,33,0.55)] px-4 py-8 backdrop-blur-sm md:px-6 md:py-12">
      <div className="w-full max-w-5xl rounded-[28px] border border-primary/20 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)] backdrop-blur-xl md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Create Club</p>
            <h1 className="mt-2 font-headline-lg text-3xl text-on-background">
              Start a campus community.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Add the essentials students need to discover, join, and contribute to the club.
            </p>
          </div>
          <Link href="/clubs" className="rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary">
            Close
          </Link>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Club name</span>
              <input name="name" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="e.g. Campus Builders Guild" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Category</span>
              <select name="category" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                <option>Technology</option>
                <option>Culture</option>
                <option>Sports</option>
                <option>Food</option>
                <option>Wellness</option>
                <option>Volunteering</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Short description</span>
            <input name="shortDescription" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="A one-line pitch for the clubs directory" type="text" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Full description</span>
            <textarea name="fullDescription" className="min-h-32 w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="What the club does, who should join, and what members can expect." />
          </label>

          <div className="grid gap-5 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Campus or area</span>
              <input name="campusArea" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="Indiranagar, Jayanagar, Whitefield" type="text" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Meeting mode</span>
              <select name="meetingMode" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                <option>In person</option>
                <option>Online</option>
                <option>Hybrid</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Meeting schedule</span>
              <input name="meetingSchedule" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="Saturdays, 5 PM" type="text" />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Contact email</span>
              <input name="contactEmail" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="club@campus.edu" type="email" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Banner or media URL</span>
              <input name="bannerUrl" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="https://example.com/banner.jpg" type="url" />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface">Tags</span>
            <input name="tags" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" placeholder="#builders #ai #campus" type="text" />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Membership type</span>
              <select name="membershipType" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                <option>Open to all students</option>
                <option>Campus-only</option>
                <option>Invite-only</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-on-surface">Approval mode</span>
              <select name="approvalMode" className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                <option>Auto-approve members</option>
                <option>Review each request</option>
                <option>Require organizer invite</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 rounded-[24px] bg-surface-container-low p-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-on-surface">
              <input className="h-4 w-4 accent-primary" type="checkbox" />
              I accept the Campus Nexus community guidelines
            </label>
            <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-on-surface">
              <input className="h-4 w-4 accent-primary" defaultChecked type="checkbox" />
              Allow members to post in this club
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
            <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
              {status === "saving"
                ? "Creating in the demo backend..."
                : status === "success"
                ? "Club created."
                : status === "error"
                ? "Backend is not reachable. Start Flask and try again."
                : "Clubs are saved to the in-memory Flask demo backend."}
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-full border border-outline-variant/70 px-5 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary" type="button">
                Save Draft
              </button>
              <button disabled={status === "saving"} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02] disabled:opacity-60" type="submit">
                Create Club
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
