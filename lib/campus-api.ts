export const API_BASE_URL =
  process.env.CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

export async function getCampusData<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}
