"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CampusHeader } from "@/components/campus-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      const signupEmail = readForm(form, "email");

      const payload =
        mode === "signup"
          ? {
              name: readForm(form, "name"),
              username: readForm(form, "username"),
              email: signupEmail,
              dateOfBirth: readForm(form, "dateOfBirth"),
              department: readForm(form, "department"),
              yearOfStudy: Number(readForm(form, "yearOfStudy")),
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
    <>
      <CampusHeader />
      <main className="min-h-[calc(100vh-4rem)] bg-background px-4 text-on-background md:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col">
        <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.72fr)]">
          <div className="relative py-10 rounded-[10px] bg-primary text-white shadow-[0_24px_80px_rgba(34,29,92,0.22)] lg:block">
            <div className="relative flex p-8 flex-col justify-between">
              

              <div className="">
                <h1 className="font-['Space_Grotesk'] text-5xl font-bold leading-tight tracking-tight">
                  Your campus circle starts here.
                </h1>
                <p className="mt-4 text-base leading-7 text-white/82">
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
                  <div key={label} className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                    <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="mx-auto w-full rounded-[10px] border-outline-variant/60 bg-white/90 py-0 shadow-[0_18px_48px_rgba(27,27,35,0.08)] backdrop-blur-xl">
            <CardContent className="p-5 md:p-6">
            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value as AuthMode);
                setStatus("idle");
                setMessage("");
              }}
            >
              <TabsList className="grid h-12 w-full grid-cols-2 rounded-full bg-surface-container-low">
                <TabsTrigger className="rounded-full" value="login">Login</TabsTrigger>
                <TabsTrigger className="rounded-full" value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>

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
                  <Field>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      required
                      className="h-11 rounded-2xl bg-surface-container-low px-4"
                      id="name"
                      name="name"
                      type="text"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="username">Username</FieldLabel>
                    <Input
                      required
                      autoComplete="username"
                      className="h-11 rounded-2xl bg-surface-container-low px-4"
                      id="username"
                      name="username"
                      type="text"
                    />
                  </Field>
                </>
              ) : null}

              <Field>
                <FieldLabel htmlFor="auth-identity">
                  {mode === "login" ? "Email or username" : "Email"}
                </FieldLabel>
                <Input
                  required
                  autoComplete={mode === "login" ? "username" : "email"}
                  className="h-11 rounded-2xl bg-surface-container-low px-4"
                  id="auth-identity"
                  name={mode === "login" ? "login" : "email"}
                  type={mode === "login" ? "text" : "email"}
                />
                {mode === "signup" ? <FieldDescription>Use an approved institutional email.</FieldDescription> : null}
              </Field>

              {mode === "signup" ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="dateOfBirth">Date of birth</FieldLabel>
                    <Input
                      required
                      className="h-11 rounded-2xl bg-surface-container-low px-4"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="yearOfStudy">Year</FieldLabel>
                    <NativeSelect
                      required
                      className="w-full [&_select]:h-11 [&_select]:rounded-2xl [&_select]:bg-surface-container-low"
                      id="yearOfStudy"
                      name="yearOfStudy"
                      defaultValue=""
                    >
                      <NativeSelectOption value="" disabled>
                        Select year
                      </NativeSelectOption>
                      {[1, 2, 3, 4].map((year) => (
                        <NativeSelectOption key={year} value={year}>
                          Year {year}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
              ) : null}

              {mode === "signup" ? (
                <Field>
                  <FieldLabel htmlFor="department">Department</FieldLabel>
                  <NativeSelect
                    required
                    className="w-full [&_select]:h-11 [&_select]:rounded-2xl [&_select]:bg-surface-container-low"
                    id="department"
                    name="department"
                    defaultValue=""
                  >
                    <NativeSelectOption value="" disabled>
                      Select department
                    </NativeSelectOption>
                    {["CS", "Mech", "ECE", "Electrical"].map((department) => (
                      <NativeSelectOption key={department} value={department}>
                        {department}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="h-11 rounded-2xl bg-surface-container-low px-4"
                  id="password"
                  minLength={6}
                  name="password"
                  placeholder="Minimum 6 characters"
                  type="password"
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
                <p
                  aria-live="polite"
                  className={status === "error" ? "text-sm font-semibold text-secondary" : "text-sm text-on-surface-variant"}
                >
                  {status === "saving" ? "Signing you in..." : message}
                </p>
                <Button
                  disabled={status === "saving"}
                  className="h-11 rounded-full bg-secondary px-5 text-white shadow-[0_14px_34px_rgba(236,32,36,0.18)] hover:bg-secondary/90"
                  type="submit"
                >
                  {mode === "login" ? "Login" : "Create Account"}
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        </section>
        </div>
      </main>
    </>
  );
}
