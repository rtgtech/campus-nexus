import { CampusHeader } from "@/components/campus-header";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getCampusData } from "@/lib/campus-api";
import { fallbackMarketplace, type MarketplaceData } from "@/lib/app-data";
import { cn } from "@/lib/utils";
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
        <Dialog defaultOpen>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-5xl overflow-hidden rounded-[10px] border-primary/20 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,18,33,0.28)] backdrop-blur-xl md:p-6" showCloseButton={false}>
            <DialogHeader className="flex-row items-start justify-between gap-4 text-left">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">List Item</p>
                <DialogTitle className="mt-2 font-headline-lg text-3xl text-on-background">
                  Add something for students to buy or exchange.
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                  Add enough detail for a quick decision. Leave price empty to show Contact on the listing.
                </DialogDescription>
              </div>
              <Link
                href="/marketplace"
                className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-4 text-on-surface-variant")}
              >
                Close
              </Link>
            </DialogHeader>

            <ScrollArea className="min-h-0">
            <form className="mt-2 space-y-5 pr-3">
              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="item-name">Item name</FieldLabel>
                  <Input id="item-name" className="h-11 rounded-2xl bg-surface-container-low px-4" type="text" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="listing-type">Listing type</FieldLabel>
                  <NativeSelect id="listing-type" className="w-full [&_select]:h-11 [&_select]:rounded-2xl [&_select]:bg-surface-container-low">
                    <NativeSelectOption>Sell</NativeSelectOption>
                    <NativeSelectOption>Exchange</NativeSelectOption>
                    <NativeSelectOption>Sell or exchange</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="item-category">Category</FieldLabel>
                  <NativeSelect id="item-category" className="w-full [&_select]:h-11 [&_select]:rounded-2xl [&_select]:bg-surface-container-low">
                    {["Books", "Electronics", "Stationery", "Hostel", "Music", "Sports"].map((value) => (
                      <NativeSelectOption key={value}>{value}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-condition">Condition</FieldLabel>
                  <NativeSelect id="item-condition" className="w-full [&_select]:h-11 [&_select]:rounded-2xl [&_select]:bg-surface-container-low">
                    {["New", "Like new", "Gently used", "Used", "Needs repair"].map((value) => (
                      <NativeSelectOption key={value}>{value}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="item-price">Price</FieldLabel>
                  <Input id="item-price" className="h-11 rounded-2xl bg-surface-container-low px-4" type="text" />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="item-description">Description</FieldLabel>
                <Textarea id="item-description" className="min-h-32 rounded-2xl bg-surface-container-low px-4 py-3" />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="preferred-exchange">Preferred exchange</FieldLabel>
                  <Input id="preferred-exchange" className="h-11 rounded-2xl bg-surface-container-low px-4" type="text" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pickup-location">Pickup location</FieldLabel>
                  <Input id="pickup-location" className="h-11 rounded-2xl bg-surface-container-low px-4" type="text" />
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="item-contact">Contact</FieldLabel>
                  <Input id="item-contact" className="h-11 rounded-2xl bg-surface-container-low px-4" type="text" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="photo-url">Photo URL</FieldLabel>
                  <Input id="photo-url" className="h-11 rounded-2xl bg-surface-container-low px-4" type="url" />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="item-tags">Tags</FieldLabel>
                <Input id="item-tags" className="h-11 rounded-2xl bg-surface-container-low px-4" type="text" />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-5">
                <p className="text-sm text-on-surface-variant">Listings will be saved when this workflow is connected.</p>
                <div className="flex flex-wrap gap-3">
                  <Button className="rounded-full px-5" type="button" variant="outline">
                    Save Draft
                  </Button>
                  <Button className="rounded-full px-5 shadow-[0_14px_34px_rgba(34,29,92,0.2)]" type="button">
                    List Item
                  </Button>
                </div>
              </div>
            </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      ) : null}

      <div className="min-h-screen bg-background pb-10 font-body-md text-on-background">
        <CampusHeader active="marketplace" searchProps={{ placeholder: "Search marketplace products...", types: ["product"] }} />

        <CollapsibleSidebar active="marketplace" />

        <main className="mx-auto max-w-7xl space-y-10 px-5 pt-8">
          <section className="grid gap-5 rounded-[10px] border border-surface-container-highest bg-white p-6 shadow-xs md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-secondary">Student Marketplace</p>
              <h1 className="mt-3 font-headline-lg text-4xl text-primary md:text-5xl">Exchange, sell, or find campus essentials.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                Marketplace listings will appear here when real items are added.
              </p>
            </div>
            <Link
              href="/marketplace?mode=listitem"
              className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6 shadow-[0_18px_40px_rgba(34,29,92,0.22)]")}
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
                  className={cn(buttonVariants({ size: "lg" }), "rounded-full px-5")}
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
                key={item.postId ?? item.id ?? item.title}
                id={item.postId ?? item.id}
                className="overflow-hidden rounded-[10px] border border-surface-container-highest bg-white shadow-xs transition hover:shadow-xl"
              >
                <div className="relative h-44 overflow-hidden bg-primary-fixed">
                  {item.image ? <img alt={item.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" src={item.image} /> : null}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary backdrop-blur-sm">
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
                    <Button className="rounded-full px-4">
                      Contact
                    </Button>
                  </div>
                </div>
              </article>
              ))}
            </section>
          )}
        </main>

        <Link href="/marketplace?mode=listitem" className={cn(buttonVariants({ size: "icon-lg" }), "group fixed bottom-24 right-6 z-40 size-16 rounded-full text-white shadow-2xl")}>
          <span className="material-symbols-outlined text-3xl">add_shopping_cart</span>
          <span className="absolute right-full mr-4 whitespace-nowrap rounded-2xl bg-primary px-4 py-2 text-sm font-label-md text-white opacity-0 transition-opacity group-hover:opacity-100">
            List Item
          </span>
        </Link>
      </div>
    </>
  );
}


