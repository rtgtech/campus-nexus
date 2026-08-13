import { notFound } from "next/navigation";
import { CampusHeader } from "@/components/campus-header";
import { ClubHub } from "@/components/club-hub";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { API_BASE_URL } from "@/lib/campus-api";
import { fallbackClubDetail, type ClubDetailData } from "@/lib/app-data";

type ClubDetailPageProps = {
  params: Promise<{
    clubName: string;
  }>;
};

async function getClubDetail(slug: string): Promise<ClubDetailData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/clubs/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return fallbackClubDetail;
    }

    return (await response.json()) as ClubDetailData;
  } catch {
    return fallbackClubDetail;
  }
}

export default async function ClubDetailPage({ params }: ClubDetailPageProps) {
  const { clubName } = await params;
  const detail = await getClubDetail(clubName);

  if (detail === null || !detail.club.slug) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f6f6f3] font-sans">
      <CampusHeader active="clubs" searchProps={{ placeholder: "Search campus clubs...", types: ["club"] }} />
      <CollapsibleSidebar active="clubs" />
      <ClubHub detail={detail} />
    </div>
  );
}
