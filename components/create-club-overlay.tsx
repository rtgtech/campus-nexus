"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { CampusAuthSession, authFetch, isAdminUser, readAuthSession } from "@/lib/auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

const departmentOptions = ["CS", "Mech", "ECE", "Electrical", "Civil", "Architecture", "Design", "Business"];

function fileToDataUrl(file: File | null) {
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

export function CreateClubOverlay({ returnHref = "/admin" }: { returnHref?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<"details" | "banner">("details");
  const [clubName, setClubName] = useState("");
  const [associatedDepartment, setAssociatedDepartment] = useState(departmentOptions[0]);
  const [relatedDepartments, setRelatedDepartments] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<CampusAuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    setSession(readAuthSession());
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(bannerFile);
    setBannerPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [bannerFile]);

  function handleRelatedDepartmentsChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextDepartment = event.target.value;
    if (nextDepartment) {
      setRelatedDepartments((current) =>
        current.includes(nextDepartment) ? current : [...current, nextDepartment],
      );
    }
    event.target.value = "";
    setStatus("idle");
  }

  function removeRelatedDepartment(department: string) {
    setRelatedDepartments((current) => current.filter((item) => item !== department));
    setStatus("idle");
  }

  function handleBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && file.type.startsWith("image/")) {
      setBannerFile(file);
      setStatus("idle");
    }
  }

  function detailStepComplete() {
    return Boolean(clubName.trim() && associatedDepartment && description.trim());
  }

  const availableRelatedDepartments = departmentOptions.filter(
    (department) => department !== associatedDepartment && !relatedDepartments.includes(department),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailStepComplete() || !bannerFile) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const activeSession = session;
      if (!activeSession || !isAdminUser(activeSession.user)) {
        throw new Error("Admin access required");
      }

      const bannerImage = await fileToDataUrl(bannerFile);
      const departmentSummary = [
        `Associated department: ${associatedDepartment}`,
        relatedDepartments.length > 0 ? `Related departments: ${relatedDepartments.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await authFetch(`${API_BASE_URL}/api/clubs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: clubName.trim(),
          name: clubName.trim(),
          description: `${description.trim()}\n\n${departmentSummary}`.trim(),
          associatedDepartment,
          relatedDepartments,
          bannerImage,
          status: "Open",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Create club failed");
      }

      setStatus("success");
      router.push(returnHref);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Create club failed");
    }
  }

  const modalFrameClass =
    "flex h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col rounded-[28px] border border-primary/20 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)] backdrop-blur-xl md:h-[720px] md:p-6";

  if (!sessionLoaded) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,18,33,0.55)] px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-[28px] border border-primary/20 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,18,33,0.28)]">
          <p className="text-sm font-semibold text-on-surface-variant">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdminUser(session?.user)) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,18,33,0.55)] px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-xl rounded-[28px] border border-primary/20 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,18,33,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Admin Only</p>
              <h1 className="mt-2 font-headline-lg text-2xl text-on-background">Club creation is restricted.</h1>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Sign in with the admin service account to create or manage clubs.
              </p>
            </div>
            <Link href={returnHref} className="rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary">
              Close
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,18,33,0.55)] px-4 py-6 backdrop-blur-sm">
      <div className={modalFrameClass}>
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Create Club</p>
            <h1 className="mt-2 font-headline-lg text-3xl text-on-background">
              {step === "details" ? "Add club details." : "Select a banner image."}
            </h1>
          </div>
          <Link href={returnHref} className="rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary">
            Close
          </Link>
        </div>

        <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-hidden">
            {step === "details" ? (
              <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-5">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Club name</span>
                  <input
                    className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    type="text"
                    value={clubName}
                    onChange={(event) => {
                      setClubName(event.target.value);
                      setStatus("idle");
                    }}
                  />
                </label>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Associated department</span>
                    <select
                      className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      value={associatedDepartment}
                      onChange={(event) => {
                        const nextDepartment = event.target.value;
                        setAssociatedDepartment(nextDepartment);
                        setRelatedDepartments((current) => current.filter((department) => department !== nextDepartment));
                        setStatus("idle");
                      }}
                    >
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Related departments</span>
                    <div className="flex min-h-11 flex-wrap gap-2 rounded-2xl border border-outline-variant/70 bg-surface-container-low p-2">
                      {relatedDepartments.length > 0 ? (
                        relatedDepartments.map((department) => (
                          <span
                            key={department}
                            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary"
                          >
                            {department}
                            <button
                              aria-label={`Remove ${department}`}
                              className="rounded-full text-on-surface-variant transition hover:text-secondary"
                              type="button"
                              onClick={() => removeRelatedDepartment(department)}
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-1.5 text-xs font-semibold text-on-surface-variant">
                          No related departments selected.
                        </span>
                      )}
                    </div>
                    <select
                      className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
                      defaultValue=""
                      disabled={availableRelatedDepartments.length === 0}
                      onChange={handleRelatedDepartmentsChange}
                    >
                      <option value="">
                        {availableRelatedDepartments.length === 0 ? "All departments selected" : "Add a department"}
                      </option>
                      {availableRelatedDepartments.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex min-h-0 flex-col space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Description</span>
                  <textarea
                    className="min-h-0 flex-1 resize-none rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface outline-none transition focus:border-primary"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setStatus("idle");
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <input
                  ref={fileInputRef}
                  accept="image/*"
                  className="sr-only"
                  type="file"
                  onChange={handleBannerChange}
                />

                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-outline-variant/80 bg-surface-container-low p-4">
                  {bannerPreviewUrl ? (
                    <img alt="" className="max-h-full max-w-full rounded-[18px] object-contain" src={bannerPreviewUrl} />
                  ) : (
                    <div className="text-center">
                      <span className="material-symbols-outlined rounded-full bg-primary-fixed p-5 text-4xl text-primary">
                        add_photo_alternate
                      </span>
                      <p className="mt-5 text-lg font-bold text-on-background">Select a banner image</p>
                    </div>
                  )}
                </div>

                <button
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary px-5 py-3 text-sm font-semibold text-primary transition hover:border-secondary hover:text-secondary"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Choose banner
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
            <p className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}>
              {status === "saving"
                ? "Creating..."
                : status === "success"
                ? "Club created."
                : status === "error"
                ? message || "Create club failed."
                : step === "details"
                ? "Complete the club details to continue."
                : bannerFile
                ? "Banner selected."
                : "Select a banner image to create the club."}
            </p>
            <div className="flex flex-wrap gap-3">
              {step === "banner" ? (
                <button
                  className="rounded-full border border-outline-variant/70 px-5 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary"
                  disabled={status === "saving"}
                  type="button"
                  onClick={() => setStep("details")}
                >
                  Back
                </button>
              ) : null}
              {step === "details" ? (
                <button
                  disabled={!detailStepComplete()}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02] disabled:opacity-50"
                  type="button"
                  onClick={() => setStep("banner")}
                >
                  Next
                </button>
              ) : (
                <button
                  disabled={status === "saving" || !bannerFile}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02] disabled:opacity-50"
                  type="submit"
                >
                  Create Club
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
