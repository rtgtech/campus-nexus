import { SourceBottomNav } from "@/components/source-bottom-nav";
import { AuthSessionControl } from "@/components/auth-session-control";
import { EmptyState } from "@/components/empty-state";
import { HeaderSearch } from "@/components/header-search";
import { getCampusData } from "@/lib/campus-api";
import { fallbackMarketplace, type MarketplaceData } from "@/lib/app-data";
import Link from "next/link";

type MarketplacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getSearchValue(resolvedSearchParams.mode);
  const showListingForm = mode === "listitem";
  const marketplaceData = await getCampusData<MarketplaceData>("/api/marketplace", fallbackMarketplace);

  return (
    <>
      {showListingForm ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[rgba(15,18,33,0.55)] px-4 py-8 backdrop-blur-sm md:px-6 md:py-12">
          <div className="w-full max-w-5xl rounded-[28px] border border-primary/20 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)] backdrop-blur-xl md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">List Item</p>
                <h1 className="mt-2 font-headline-lg text-3xl text-on-background">
                  Add something for students to buy or exchange.
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                  Add enough detail for a quick decision. Leave price empty to show Contact on the listing.
                </p>
              </div>
              <Link
                href="/marketplace"
                className="rounded-full border border-outline-variant/70 px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary"
              >
                Close
              </Link>
            </div>

            <form className="mt-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Item name</span>
                  <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="text" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Listing type</span>
                  <select className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                    <option>Sell</option>
                    <option>Exchange</option>
                    <option>Sell or exchange</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Category</span>
                  <select className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                    <option>Books</option>
                    <option>Electronics</option>
                    <option>Stationery</option>
                    <option>Hostel</option>
                    <option>Music</option>
                    <option>Sports</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Condition</span>
                  <select className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
                    <option>New</option>
                    <option>Like new</option>
                    <option>Gently used</option>
                    <option>Used</option>
                    <option>Needs repair</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Price</span>
                  <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="text" />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Description</span>
                <textarea className="min-h-32 w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Preferred exchange</span>
                  <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="text" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Pickup location</span>
                  <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="text" />
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Contact</span>
                  <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="text" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-on-surface">Photo URL</span>
                  <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="url" />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-on-surface">Tags</span>
                <input className="w-full rounded-2xl border border-outline-variant/70 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary" type="text" />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
                <p className="text-sm text-on-surface-variant">Listings will be saved when this workflow is connected.</p>
                <div className="flex flex-wrap gap-3">
                  <button className="rounded-full border border-outline-variant/70 px-5 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary" type="button">
                    Save Draft
                  </button>
                  <button className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-[0_14px_34px_rgba(34,29,92,0.2)] transition hover:scale-[1.02]" type="button">
                    List Item
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="min-h-screen bg-background pb-24 font-body-md text-on-background">
        <header className="fixed top-0 z-50 w-full border-b border-surface-container-highest bg-white/95 shadow-sm backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
            <Link href="/" className="font-headline-lg text-2xl font-black tracking-tighter text-primary">
              Campus Nexus
            </Link>
            <HeaderSearch className="hidden w-80 md:block" placeholder="Search marketplace products..." types={["product"]} />
            <div className="flex items-center gap-3">
              <button className="material-symbols-outlined rounded-full p-2 text-primary transition hover:bg-surface-container">
                notifications
              </button>
              <AuthSessionControl compact />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-10 px-5 pt-24">
          <section className="grid gap-5 rounded-[32px] border border-surface-container-highest bg-white p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Student Marketplace</p>
              <h1 className="mt-3 font-headline-lg text-4xl text-primary md:text-5xl">Exchange, sell, or find campus essentials.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                Marketplace listings will appear here when real items are added.
              </p>
            </div>
            <Link
              href="/marketplace?mode=listitem"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-[0_18px_40px_rgba(34,29,92,0.22)] transition hover:scale-[1.02]"
            >
              <span className="material-symbols-outlined">add</span>
              List Item
            </Link>
          </section>

          {marketplaceData.items.length === 0 ? (
            <EmptyState
              title="No marketplace listings yet"
              description="This section is ready for real listings once item creation is connected."
              action={
                <Link
                  href="/marketplace?mode=listitem"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  List item
                </Link>
              }
            />
          ) : (
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {marketplaceData.items.map((item) => (
              <article
                key={item.post_id ?? item.id ?? item.title}
                id={item.post_id ?? item.id}
                className="overflow-hidden rounded-[28px] border border-surface-container-highest bg-white shadow-sm transition hover:shadow-xl"
              >
                <div className="relative h-44 overflow-hidden bg-primary-fixed">
                  {item.image ? <img alt={item.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" src={item.image} /> : null}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary backdrop-blur">
                    {item.mode}
                  </span>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-headline-md text-xl text-on-background">{item.title}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.category} - {item.condition}</p>
                    </div>
                    <span className={item.price ? "rounded-full bg-secondary px-3 py-1 text-sm font-bold text-white" : "rounded-full bg-primary-fixed px-3 py-1 text-sm font-bold text-primary"}>
                      {item.price || "Contact"}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-on-surface-variant">{item.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-surface-container-highest pt-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{item.owner}</p>
                        <p className="text-xs text-on-surface-variant">{item.location}</p>
                      </div>
                    </div>
                    <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                      Contact
                    </button>
                  </div>
                </div>
              </article>
              ))}
            </section>
          )}
        </main>

        <Link href="/marketplace?mode=listitem" className="group fixed bottom-24 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-2xl transition-all hover:scale-110 active:scale-90">
          <span className="material-symbols-outlined text-3xl">add_shopping_cart</span>
          <span className="absolute right-full mr-4 whitespace-nowrap rounded-2xl bg-primary px-4 py-2 text-sm font-label-md text-white opacity-0 transition-opacity group-hover:opacity-100">
            List Item
          </span>
        </Link>
      </div>

      <SourceBottomNav active="marketplace" variant="club" />
    </>
  );
}


