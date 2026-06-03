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
  token: string;
  user: CampusAuthUser;
};

export const AUTH_STORAGE_KEY = "campusNexusAuth";
export const AUTH_COOKIE_NAME = "campusNexusToken";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

export function saveAuthSession(session: CampusAuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(session.token)}; path=/; max-age=2592000; SameSite=Lax`;
}

export function readAuthSession(): CampusAuthSession | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as Partial<CampusAuthSession>;
    if (!parsed.token || !parsed.user) {
      return null;
    }
    return parsed as CampusAuthSession;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

export function isAdminUser(user: CampusAuthUser | null | undefined) {
  return user?.username === "admin" && user.mail === "admin@cn.nhce";
}
