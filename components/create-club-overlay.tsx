"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CampusAuthSession, authFetch, isAdminUser, readAuthSession } from "@/lib/auth-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

const departmentOptions = ["CS", "Mech", "ECE", "Electrical"];

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

  function closeDialog(nextOpen: boolean) {
    if (!nextOpen) router.replace(returnHref);
  }

  if (!sessionLoaded) {
    return (
      <Dialog open onOpenChange={closeDialog}>
        <DialogContent className="max-w-xl rounded-[3px] border-outline-variant bg-white p-6">
          <DialogTitle className="sr-only">Checking admin access</DialogTitle>
          <DialogDescription className="sr-only">Please wait while admin access is verified.</DialogDescription>
          <p className="text-sm font-semibold text-on-surface-variant">Checking admin access...</p>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isAdminUser(session?.user)) {
    return (
      <Dialog open onOpenChange={closeDialog}>
        <DialogContent className="max-w-xl rounded-[3px] border-outline-variant bg-white p-6">
          <DialogHeader className="pr-10">
              <p className="text-xs font-medium text-on-surface-variant">Admin only</p>
              <DialogTitle className="mt-2 text-2xl font-semibold text-on-background">Club creation is restricted.</DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-on-surface-variant">
                Sign in with the admin service account to create or manage clubs.
              </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={closeDialog}>
      <DialogContent className="flex h-[calc(100dvh-3rem)] max-w-2xl flex-col overflow-hidden rounded-[3px] border-outline-variant bg-white p-5 md:h-[720px] md:p-6">
        <DialogHeader className="shrink-0 pr-10">
          <div>
            <p className="text-xs font-medium text-on-surface-variant">Create club</p>
            <DialogTitle className="mt-2 text-3xl font-semibold tracking-tight text-on-background">
              {step === "details" ? "Add club details." : "Select a banner image."}
            </DialogTitle>
            <DialogDescription className="sr-only">Create a new campus club</DialogDescription>
          </div>
        </DialogHeader>

        <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-hidden">
            {step === "details" ? (
              <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-5">
                <Field>
                  <FieldLabel htmlFor="club-name">Club name</FieldLabel>
                  <Input
                    className="h-11 rounded-[3px] border-outline-variant bg-white px-3"
                    id="club-name"
                    type="text"
                    value={clubName}
                    onChange={(event) => {
                      setClubName(event.target.value);
                      setStatus("idle");
                    }}
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="associated-department">Associated department</FieldLabel>
                    <NativeSelect
                      className="w-full [&_select]:h-11 [&_select]:rounded-[3px] [&_select]:border-outline-variant [&_select]:bg-white"
                      id="associated-department"
                      value={associatedDepartment}
                      onChange={(event) => {
                        const nextDepartment = event.target.value;
                        setAssociatedDepartment(nextDepartment);
                        setRelatedDepartments((current) => current.filter((department) => department !== nextDepartment));
                        setStatus("idle");
                      }}
                    >
                      {departmentOptions.map((department) => (
                        <NativeSelectOption key={department} value={department}>
                          {department}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>

                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Related departments</span>
                    <div className="flex min-h-11 flex-wrap gap-2 rounded-[3px] border border-outline-variant bg-white p-2">
                      {relatedDepartments.length > 0 ? (
                        relatedDepartments.map((department) => (
                          <Badge
                            key={department}
                            className="gap-2 rounded-[3px] border border-outline-variant bg-[#f7f7f4] px-3 py-1.5 text-xs font-semibold text-on-surface"
                          >
                            {department}
                            <Button
                              aria-label={`Remove ${department}`}
                              className="size-5 rounded-[3px] text-on-surface-variant hover:text-secondary"
                              size="icon-xs"
                              type="button"
                              variant="ghost"
                              onClick={() => removeRelatedDepartment(department)}
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </Button>
                          </Badge>
                        ))
                      ) : (
                        <span className="px-2 py-1.5 text-xs font-semibold text-on-surface-variant">
                          No related departments selected.
                        </span>
                      )}
                    </div>
                    <NativeSelect
                      className="w-full [&_select]:h-11 [&_select]:rounded-[3px] [&_select]:border-outline-variant [&_select]:bg-white"
                      defaultValue=""
                      disabled={availableRelatedDepartments.length === 0}
                      onChange={handleRelatedDepartmentsChange}
                    >
                      <NativeSelectOption value="">
                        {availableRelatedDepartments.length === 0 ? "All departments selected" : "Add a department"}
                      </NativeSelectOption>
                      {availableRelatedDepartments.map((department) => (
                        <NativeSelectOption key={department} value={department}>
                          {department}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <Field className="min-h-0">
                  <FieldLabel htmlFor="club-description">Description</FieldLabel>
                  <Textarea
                    className="min-h-0 flex-1 resize-none rounded-[3px] border-outline-variant bg-white px-3 py-3 text-sm leading-6"
                    id="club-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setStatus("idle");
                    }}
                  />
                </Field>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <Input
                  ref={fileInputRef}
                  accept="image/*"
                  className="sr-only"
                  type="file"
                  onChange={handleBannerChange}
                />

                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-outline-variant bg-[#f7f7f4] p-4">
                  {bannerPreviewUrl ? (
                    <img alt="" className="max-h-full max-w-full rounded-[3px] object-contain" src={bannerPreviewUrl} />
                  ) : (
                    <div className="text-center">
                      <span className="material-symbols-outlined border border-outline-variant bg-white p-5 text-4xl text-on-surface">
                        add_photo_alternate
                      </span>
                      <p className="mt-5 text-lg font-bold text-on-background">Select a banner image</p>
                    </div>
                  )}
                </div>

                <Button
                  className="mt-4 w-full rounded-[3px] px-5"
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Choose banner
                </Button>
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
                <Button
                  className="rounded-[3px] px-5"
                  disabled={status === "saving"}
                  type="button"
                  variant="outline"
                  onClick={() => setStep("details")}
                >
                  Back
                </Button>
              ) : null}
              {step === "details" ? (
                <Button
                  disabled={!detailStepComplete()}
                  className="rounded-[3px] px-5"
                  type="button"
                  onClick={() => setStep("banner")}
                >
                  Next
                </Button>
              ) : (
                <Button
                  disabled={status === "saving" || !bannerFile}
                  className="rounded-[3px] px-5"
                  type="submit"
                >
                  Create Club
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
