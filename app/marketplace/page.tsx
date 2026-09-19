import { MarketplaceWorkspace } from "@/components/marketplace-workspace";
import { CampusShell } from "@/components/campus-shell";
import { getCampusDataResult } from "@/lib/campus-api";
import { fallbackMarketplace, type MarketplaceData } from "@/lib/app-data";

export default async function MarketplacePage() {
  const result = await getCampusDataResult<MarketplaceData>("/api/marketplace", fallbackMarketplace);
  return <CampusShell active="marketplace" headerSearchProps={{ placeholder: "Search campus listings", types: ["product"] }}>
    <header className="mb-8 border-b border-border pb-7">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Pass it on</p>
      <h1 className="font-editorial font-medium text-4xl sm:text-5xl">Good finds, close to home.</h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">Books, essentials, and secondhand discoveries from your campus community.</p>
    </header>
    <MarketplaceWorkspace initialItems={result.data.items} initialError={result.error} />
  </CampusShell>;
}

