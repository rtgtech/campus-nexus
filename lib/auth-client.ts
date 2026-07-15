export type CampusAuthUser = {
  user_id: string;
  userId: string;
  id: string;
  mail: string;
  email: string;
  username?: string | null;
  name: string;
  DOB: string;
  dateOfBirth: string;
  year: number;
  department: string;
  yearOfStudy: number;
  acronym: string;
  initials: string;
};

export type CampusAuthSession = {
  user: CampusAuthUser;
};

export const AUTH_STORAGE_KEY = "campusNexusAuth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

export function saveAuthSession(session: CampusAuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: session.user }));
}

export function readAuthSession(): CampusAuthSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as Partial<CampusAuthSession>;
    if (!parsed.user) {
      return null;
    }
    const session = { user: parsed.user };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, credentials: "include" });
}

export function isAdminUser(user: CampusAuthUser | null | undefined) {
  return user?.username === "admin" && user.mail === "admin@cn.nhce";
}
