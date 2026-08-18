import { AdminDashboard } from "@/components/admin-dashboard";
import { CreateClubOverlay } from "@/components/create-club-overlay";
import { API_BASE_URL, getCampusData } from "@/lib/campus-api";
import {
  fallbackClubs,
  fallbackCampusEventsData,
  fallbackSignalBarData,
  type CampusEventsData,
  type ClubDetailData,
  type ClubsData,
  type SignalBarData,
} from "@/lib/app-data";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getClubDetail(slug: string): Promise<ClubDetailData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ClubDetailData;
  } catch {
    return null;
  }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getSearchValue(resolvedSearchParams.mode);
  const requestedTab = getSearchValue(resolvedSearchParams.tab);
  const initialTab = requestedTab === "clubs" || requestedTab === "events" || requestedTab === "signals" ? requestedTab : "profiles";
  const requestedSlug = getSearchValue(resolvedSearchParams.club);
  const [clubsData, signalBarData, eventsData] = await Promise.all([
    getCampusData<ClubsData>("/api/clubs", fallbackClubs),
    getCampusData<SignalBarData>("/api/signal-bar", fallbackSignalBarData),
    getCampusData<CampusEventsData>("/api/events", fallbackCampusEventsData),
  ]);
  const selectedSlug = requestedSlug ?? clubsData.clubCards[0]?.slug ?? "";
  const selectedClub = selectedSlug ? await getClubDetail(selectedSlug) : null;

  return (
    <>
      {mode === "createclub" ? <CreateClubOverlay returnHref="/admin?tab=clubs" /> : null}
      <AdminDashboard
        clubsData={clubsData}
        initialEvents={eventsData.items}
        initialTab={initialTab}
        initialSignalItems={signalBarData.items}
        selectedClub={selectedClub}
        selectedSlug={selectedSlug}
      />
    </>
  );
}
