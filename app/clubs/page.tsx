import { CampusShell } from "@/components/campus-shell";
import { ClubCatalog } from "@/components/club-catalog";
import { LoadError } from "@/components/load-error";
import { getCampusDataResult } from "@/lib/campus-api";
import { fallbackClubs, type ClubsData } from "@/lib/app-data";

export default async function ClubsPage() {
  const result = await getCampusDataResult<ClubsData>("/api/clubs", fallbackClubs);
  return <CampusShell active="clubs" headerSearchProps={{ placeholder: "Search people and clubs", types: ["user", "club"] }}>
    {result.error ? <LoadError message={result.error} /> : <ClubCatalog clubs={result.data.clubCards} />}
  </CampusShell>;
}
