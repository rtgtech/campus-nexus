import { notFound } from "next/navigation";
import { CampusShell } from "@/components/campus-shell";
import { ClubHub } from "@/components/club-hub";
import { LoadError } from "@/components/load-error";
import { getCampusDataResult } from "@/lib/campus-api";
import type { ClubDetailData } from "@/lib/app-data";

export default async function ClubDetailPage({ params }: { params: Promise<{ clubName: string }> }) {
  const { clubName } = await params;
  const result = await getCampusDataResult<ClubDetailData | null>("/api/clubs/" + encodeURIComponent(clubName), null);
  if (result.status === 404) notFound();
  return <CampusShell active="clubs" headerSearchProps={{ placeholder: "Search campus clubs", types: ["club"] }}>
    {result.error || !result.data ? <LoadError /> : <ClubHub detail={result.data} />}
  </CampusShell>;
}
