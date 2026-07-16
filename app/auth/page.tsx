"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  API_BASE_URL,
  CampusAuthSession,
  authFetch,
  clearAuthSession,
  isAdminUser,
  readAuthSession,
  saveAuthSession,
} from "@/lib/auth-client";

type AuthMode = "login" | "signup";
type AuthStatus = "idle" | "saving" | "success" | "error";

function readForm(form: HTMLFormElement, name: string) {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

function usesEduEmail(value: string) {
  const domain = value.toLowerCase().split("@").at(-1) ?? "";
  return domain === "edu" || domain.endsWith(".edu");
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedSession = readAuthSession();
    if (!storedSession) {
      return;
    }
    const sessionToRestore = storedSession;
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/auth/me`);
        if (!response.ok) {
          throw new Error("Stored session expired");
        }
        if (!cancelled) {
          const data = (await response.json()) as CampusAuthSession;
          saveAuthSession(data);
          router.replace("/");
        }
      } catch {
        if (!cancelled) {
          clearAuthSession();
        }
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("saving");
    setMessage("");

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const signupMail = readForm(form, "mail");
      if (mode === "signup" && !usesEduEmail(signupMail)) {
        throw new Error("Mail must use a .edu domain.");
      }

      const payload =
        mode === "signup"
          ? {
              name: readForm(form, "name"),
              username: readForm(form, "username"),
              mail: signupMail,
              DOB: readForm(form, "dateOfBirth"),
              department: readForm(form, "department"),
              year: Number(readForm(form, "yearOfStudy")),
              password: readForm(form, "password"),
            }
          : {
              login: readForm(form, "login"),
              password: readForm(form, "password"),
            };

      const response = await authFetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Authentication failed");
      }

      saveAuthSession(data as CampusAuthSession);
      setStatus("success");
      setMessage(mode === "signup" ? "Account created." : "Signed in.");
      const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
      const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("/auth") ? nextPath : "/";
      window.setTimeout(() => window.location.assign(isAdminUser((data as CampusAuthSession).user) ? "/admin" : safeNextPath), 150);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-on-background md:px-6 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="font-['Space_Grotesk'] text-2xl font-black tracking-[-0.06em] text-primary">
            Campus Nexus
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.72fr)]">
          <div className="relative py-10 rounded-[28px] bg-primary text-white shadow-[0_24px_80px_rgba(34,29,92,0.22)] lg:block">
            <div className="relative flex p-8 flex-col justify-between">
              

              <div className="max-w-xl">
                <h1 className="font-['Space_Grotesk'] text-5xl font-bold leading-tight tracking-tight">
                  Your campus circle starts here.
                </h1>
                <p className="mt-4 max-w-lg text-base leading-7 text-white/82">
                  Sign in to post, discover clubs, follow events and activities, and keep your student profile ready.
                </p>
                <p>
                  Never miss an activity ever again
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  ["groups", "Live clubs"],
                  ["forum", "Campus chats"],
                  ["storefront", "Marketplace"],
                ].map(([icon, label]) => (
                  <div key={label} className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                    <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl rounded-[28px] border border-outline-variant/60 bg-white/90 p-5 shadow-[0_18px_48px_rgba(27,27,35,0.08)] backdrop-blur-xl md:p-6">
            <div className="flex rounded-full bg-surface-container-low p-1">
              {(["login", "signup"] as AuthMode[]).map((item) => (
                <button
                  key={item}
                  className={[
                    "flex-1 rounded-full px-4 py-3 text-sm font-semibold transition",
                    mode === item ? "bg-primary text-on-primary shadow-[0_12px_30px_rgba(34,29,92,0.18)]" : "text-on-surface-variant hover:text-primary",
                  ].join(" ")}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setStatus("idle");
                    setMessage("");
                  }}
                >
                  {item === "login" ? "Login" : "Sign up"}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">
                {mode === "login" ? "Welcome back" : "Create account"}
              </p>
              <h2 className="mt-2 font-['Space_Grotesk'] text-3xl font-bold tracking-tight text-on-background">
                {mode === "login" ? "Log in to Campus Nexus." : "Join Campus Nexus."}
              </h2>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Name</span>
                    <input
                      required
                      className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      name="name"
                      type="text"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Username</span>
                    <input
                      required
                      autoComplete="username"
                      className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      name="username"
                      type="text"
                    />
                  </label>
                </>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface">
                  {mode === "login" ? "Mail or username" : "Mail"}
                </span>
                <input
                  required
                  autoComplete={mode === "login" ? "username" : "email"}
                  className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  name={mode === "login" ? "login" : "mail"}
                  type={mode === "login" ? "text" : "email"}
                />
                {mode === "signup" ? <span className="text-xs text-on-surface-variant">Use your institutional .edu email.</span> : null}
              </label>

              {mode === "signup" ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Date of birth</span>
                    <input
                      required
                      className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      name="dateOfBirth"
                      type="date"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-on-surface">Year</span>
                    <select
                      required
                      className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                      name="yearOfStudy"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select year
                      </option>
                      {[1, 2, 3, 4].map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {mode === "signup" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Department</span>
                  <select
                    required
                    className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                    name="department"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select department
                    </option>
                    {["CS", "Mech", "ECE", "Electrical"].map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-on-surface">Password</span>
                <input
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
                  minLength={6}
                  name="password"
                  placeholder="Minimum 6 characters"
                  type="password"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
                <p
                  aria-live="polite"
                  className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}
                >
                  {status === "saving" ? "Signing you in..." : message}
                </p>
                <button
                  disabled={status === "saving"}
                  className="rounded-full bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] transition hover:scale-[1.02] disabled:opacity-60"
                  type="submit"
                >
                  {mode === "login" ? "Login" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
