import { CampusHeader } from "@/components/campus-header";
import { ClubCatalog } from "@/components/club-catalog";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { getCampusData } from "@/lib/campus-api";
import { fallbackClubs, type ClubsData } from "@/lib/app-data";

export default async function ClubsPage() {
  const clubsData = await getCampusData<ClubsData>("/api/clubs", fallbackClubs);

  return (
    <div className="min-h-screen bg-[#f6f6f3] font-sans">
      <CampusHeader active="clubs" searchProps={{ placeholder: "Search campus clubs...", types: ["club"] }} />
      <CollapsibleSidebar active="clubs" />
      <ClubCatalog clubs={clubsData.clubCards} />
    </div>
  );
}
