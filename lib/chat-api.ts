import { API_BASE_URL, authFetch } from "@/lib/auth-client";
import { parseApiResponse } from "@/lib/api-response-contract";

export async function chatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`${API_BASE_URL}${path}`, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(response.status === 401
      ? "Your session has expired. Sign in again to continue chatting."
      : data?.error ?? "Chat is unavailable. Please try again.");
  }
  return parseApiResponse<T>(path, data);
}
