import { AdminDashboard } from "@/components/admin-dashboard";
import { CreateClubOverlay } from "@/components/create-club-overlay";
import { API_BASE_URL, getCampusData } from "@/lib/campus-api";
import { fallbackClubs, type ClubDetailData, type ClubsData } from "@/lib/app-data";

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
  const requestedSlug = getSearchValue(resolvedSearchParams.club);
  const clubsData = await getCampusData<ClubsData>("/api/clubs", fallbackClubs);
  const selectedSlug = requestedSlug ?? clubsData.clubCards[0]?.slug ?? "";
  const selectedClub = selectedSlug ? await getClubDetail(selectedSlug) : null;

  return (
    <>
      {mode === "createclub" ? <CreateClubOverlay returnHref="/admin" /> : null}
      <AdminDashboard clubsData={clubsData} selectedClub={selectedClub} selectedSlug={selectedSlug} />
    </>
  );
}
