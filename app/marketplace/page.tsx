import Link from "next/link";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { CampusShell } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "@/components/load-error";
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
    {result.error ? <LoadError message={result.error} /> : !result.data.items.length ?
      <EmptyState title="No listings right now" description="Check back for things your campus is ready to pass on." /> :
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">{result.data.items.map((item) => <article key={item.id || item.postId} id={item.postId || item.id} className="overflow-hidden rounded border border-border bg-white">
        <div className="flex aspect-[4/3] items-center justify-center bg-muted">{item.image ? <img alt={item.title} src={item.image} loading="lazy" className="h-full w-full object-contain" /> : <ShoppingBag size={36} aria-hidden="true" className="text-muted-foreground" />}</div>
        <div className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{item.title}</h2><span className="text-lg font-semibold text-primary">{item.price || "Ask seller"}</span></div>
          <p className="text-sm text-muted-foreground">{[item.category, item.condition, item.mode].filter(Boolean).join(" · ")}</p>
          <p className="text-sm leading-6">{item.description}</p>
          <div className="flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded bg-muted px-2 py-1 text-xs">{tag}</span>)}</div>
          <footer className="border-t pt-4"><p className="text-sm font-medium">{item.owner}</p><p className="mt-1 text-sm text-muted-foreground">{item.location}</p>
            {item.contact && <p className="mt-2 break-words text-sm">{item.contact}</p>}
            {item.sellerId && <Link href={"/" + encodeURIComponent(item.sellerId)} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">View seller <ArrowUpRight size={16} aria-hidden="true" /></Link>}
          </footer>
        </div>
      </article>)}</div>}
  </CampusShell>;
}

