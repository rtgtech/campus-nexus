import { validateApiResponse } from "@/lib/api-response-contract";

export const API_BASE_URL =
  process.env.CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

type CampusDataOptions = {
  headers?: HeadersInit;
};

export type CampusDataResult<T> = { data: T; error: string | null; status?: number };

export async function getCampusDataResult<T>(path: string, fallback: T, options: CampusDataOptions = {}): Promise<CampusDataResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: options.headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { data: fallback, error: "We couldn't load this right now. Please try again.", status: response.status };
    const data: unknown = await response.json();
    validateApiResponse(path, data);
    return { data: data as T, error: null };
  } catch {
    return { data: fallback, error: "We couldn't load this right now. Please try again." };
  }
}

export async function getCampusData<T>(path: string, fallback: T, options: CampusDataOptions = {}): Promise<T> {
  return (await getCampusDataResult(path, fallback, options)).data;
}
