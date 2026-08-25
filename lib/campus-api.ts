import { validateApiResponse } from "@/lib/api-response-contract";

export const API_BASE_URL =
  process.env.CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

type CampusDataOptions = {
  headers?: HeadersInit;
};

export async function getCampusData<T>(path: string, fallback: T, options: CampusDataOptions = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: options.headers,
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data: unknown = await response.json();
    validateApiResponse(path, data);
    return data as T;
  } catch {
    return fallback;
  }
}
