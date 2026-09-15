"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Clock3, ImagePlus, Plus, Repeat2, ShoppingBag, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { parseApiResponse } from "@/lib/api-response-contract";
import type { MarketplaceItem } from "@/lib/app-data";
import { cn } from "@/lib/utils";

type MarketplaceMode = MarketplaceItem["mode"];
type MarketplaceFilter = "All" | MarketplaceMode;

const modes: Array<{ value: MarketplaceMode; label: string; description: string }> = [
  { value: "Sale", label: "For sale", description: "Set a price and sell it to another student." },
  { value: "Exchange", label: "Exchange", description: "Swap it for something else you need." },
  { value: "Borrow", label: "Lend", description: "Let another student borrow it temporarily." },
];

const emptyForm = {
  title: "",
  mode: "Sale" as MarketplaceMode,
  category: "Books",
  condition: "Good",
  price: "",
  preferredExchange: "",
  location: "",
  description: "",
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function modeIcon(mode: MarketplaceMode) {
  if (mode === "Exchange") return Repeat2;
  if (mode === "Borrow") return Clock3;
  return Tag;
}

function listingOffer(item: MarketplaceItem) {
  if (item.mode === "Exchange") {
    return item.preferredExchange ? `Looking for ${item.preferredExchange}` : "Open to exchange offers";
  }
  if (item.mode === "Borrow") {
    return item.price ? `${item.price} / day` : "Free to borrow";
  }
  return item.price || "Open to offers";
}

export function MarketplaceWorkspace({
  initialItems,
  initialError,
}: {
  initialItems: MarketplaceItem[];
  initialError: string | null;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<MarketplaceFilter>("All");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    setSignedIn(Boolean(readAuthSession()));
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const visibleItems = useMemo(
    () => filter === "All" ? items : items.filter((item) => item.mode === filter),
    [filter, items],
  );

  function updateForm<Key extends keyof typeof emptyForm>(key: Key, value: (typeof emptyForm)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !file.type.startsWith("image/")) {
      setImageFile(null);
      setFormError("Select a valid image file.");
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setFormError("");
  }

  function clearImage() {
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function closeForm() {
    setFormOpen(false);
    setForm(emptyForm);
    clearImage();
    setFormError("");
  }

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.category.trim() || !form.location.trim() || !form.description.trim()) {
      setFormError("Title, category, pickup location, and description are required.");
      return;
    }
    if (!imageFile) {
      setFormError("A product image is required.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const image = await fileToDataUrl(imageFile);
      const response = await authFetch(`${API_BASE_URL}/api/marketplace/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image, mode: form.mode.toLowerCase(), price: form.price || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Listing could not be published");
      }
      const listing = parseApiResponse<MarketplaceItem>("/api/marketplace/items", data);
      setItems((current) => [listing, ...current]);
      setFilter("All");
      setForm(emptyForm);
      clearImage();
      setFormOpen(false);
      setNotice("Your listing is live.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Listing could not be published");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div aria-label="Filter marketplace listings" className="flex flex-wrap gap-2" role="group">
          {(["All", "Sale", "Exchange", "Borrow"] as MarketplaceFilter[]).map((mode) => (
            <Button
              key={mode}
              aria-pressed={filter === mode}
              className="rounded-full px-4"
              type="button"
              variant={filter === mode ? "default" : "outline"}
              onClick={() => setFilter(mode)}
            >
              {mode === "Sale" ? "For sale" : mode}
            </Button>
          ))}
        </div>
        {sessionLoaded && (signedIn ? (
          <Button className="rounded-[3px] px-4" type="button" onClick={() => { setNotice(""); setFormError(""); setFormOpen(true); }}>
            <Plus aria-hidden="true" /> List an item
          </Button>
        ) : (
          <Button className="rounded-[3px] px-4" render={<Link href="/auth" />}>Sign in to list</Button>
        ))}
      </div>

      {notice && <p className="mb-5 border border-primary/20 bg-primary-fixed px-4 py-3 text-sm text-primary" role="status">{notice}</p>}
      {initialError ? (
        <p className="border border-destructive/30 bg-error-container px-4 py-3 text-sm text-on-error-container" role="alert">{initialError}</p>
      ) : visibleItems.length === 0 ? (
        <div className="border border-dashed border-border bg-white px-6 py-14 text-center">
          <ShoppingBag className="mx-auto text-muted-foreground" size={34} aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">{filter === "All" ? "No listings right now" : `No ${filter.toLowerCase()} listings yet`}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Be the first to share something with your campus.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          {visibleItems.map((item) => {
            const ModeIcon = modeIcon(item.mode);
            return (
              <article key={item.id || item.postId} id={item.postId || item.id} className="overflow-hidden rounded border border-border bg-white">
                <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
                  {item.image ? <img alt={item.title} src={item.image} loading="lazy" className="h-full w-full object-contain" /> : <ShoppingBag size={36} aria-hidden="true" className="text-muted-foreground" />}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm">
                    <ModeIcon aria-hidden="true" size={14} /> {item.mode === "Sale" ? "For sale" : item.mode === "Borrow" ? "For borrowing" : "For exchange"}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold">{item.title}</h2>
                    <span className="text-sm font-semibold text-primary">{listingOffer(item)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{[item.category, item.condition].filter(Boolean).join(" · ")}</p>
                  <p className="text-sm leading-6">{item.description}</p>
                  <footer className="border-t pt-4">
                    <p className="text-sm font-medium">{item.owner}</p>
                    {item.location && <p className="mt-1 text-sm text-muted-foreground">Pickup: {item.location}</p>}
                    {item.contact && <p className="mt-2 break-words text-sm">{item.contact}</p>}
                    {item.sellerId && <Link href={`/${encodeURIComponent(item.sellerId)}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">View student <ArrowUpRight size={16} aria-hidden="true" /></Link>}
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => open ? setFormOpen(true) : closeForm()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto rounded border-outline-variant bg-white p-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-2xl font-semibold">List an item</DialogTitle>
            <DialogDescription>Offer it for sale, exchange, or temporary borrowing.</DialogDescription>
          </DialogHeader>
          <form className="mt-2 space-y-5" onSubmit={createListing}>
            <fieldset>
              <legend className="text-sm font-medium">How do you want to offer it?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {modes.map((mode) => {
                  const ModeIcon = modeIcon(mode.value);
                  return (
                    <button
                      key={mode.value}
                      aria-label={mode.label}
                      aria-pressed={form.mode === mode.value}
                      className={cn("rounded border p-3 text-left transition-colors", form.mode === mode.value ? "border-primary bg-primary-fixed" : "border-border hover:border-primary/40")}
                      type="button"
                      onClick={() => updateForm("mode", mode.value)}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold"><ModeIcon size={16} aria-hidden="true" />{mode.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{mode.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="listing-title">Item title</Label>
                <Input required id="listing-title" className="mt-1.5 h-11 rounded-[3px] bg-white" maxLength={120} placeholder="e.g. Engineering drawing kit" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="listing-category">Category</Label>
                <Input required id="listing-category" className="mt-1.5 h-11 rounded-[3px] bg-white" maxLength={80} placeholder="Books, electronics, supplies…" value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="listing-condition">Condition</Label>
                <NativeSelect id="listing-condition" className="mt-1.5 [&_select]:h-11 [&_select]:rounded-[3px] [&_select]:bg-white" value={form.condition} onChange={(event) => updateForm("condition", event.target.value)}>
                  {["New", "Like new", "Good", "Fair", "Well used"].map((condition) => <NativeSelectOption key={condition} value={condition}>{condition}</NativeSelectOption>)}
                </NativeSelect>
              </div>
              {form.mode !== "Exchange" && (
                <div>
                  <Label htmlFor="listing-price">{form.mode === "Borrow" ? "Daily price (optional)" : "Price (optional)"}</Label>
                  <Input id="listing-price" className="mt-1.5 h-11 rounded-[3px] bg-white" min="0" step="0.01" inputMode="decimal" placeholder="₹" type="number" value={form.price} onChange={(event) => updateForm("price", event.target.value)} />
                </div>
              )}
              {form.mode === "Exchange" && (
                <div>
                  <Label htmlFor="listing-exchange">What would you exchange it for?</Label>
                  <Input id="listing-exchange" className="mt-1.5 h-11 rounded-[3px] bg-white" maxLength={160} placeholder="A scientific calculator or best offer" value={form.preferredExchange} onChange={(event) => updateForm("preferredExchange", event.target.value)} />
                </div>
              )}
              <div>
                <Label htmlFor="listing-location">Campus pickup location</Label>
                <Input required id="listing-location" className="mt-1.5 h-11 rounded-[3px] bg-white" maxLength={120} placeholder="Library entrance" value={form.location} onChange={(event) => updateForm("location", event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="listing-description">Description</Label>
                <Textarea required id="listing-description" className="mt-1.5 min-h-24 rounded-[3px] bg-white" maxLength={1000} placeholder="Share useful details, what's included, and any terms." value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="listing-image">Product image <span className="text-destructive">(required)</span></Label>
                <Input
                  ref={imageInputRef}
                  id="listing-image"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  aria-required="true"
                  type="file"
                  onChange={selectImage}
                />
                {imagePreviewUrl ? (
                  <div className="relative mt-2 overflow-hidden rounded border border-border bg-muted">
                    <img alt="Selected product preview" className="h-48 w-full object-contain" src={imagePreviewUrl} />
                    <Button aria-label="Remove selected image" className="absolute right-2 top-2 bg-white" size="icon-sm" type="button" variant="outline" onClick={clearImage}>
                      <X aria-hidden="true" />
                    </Button>
                    <p className="truncate border-t border-border bg-white px-3 py-2 text-xs text-muted-foreground">{imageFile?.name}</p>
                  </div>
                ) : (
                  <button className="mt-2 flex min-h-32 w-full flex-col items-center justify-center rounded border border-dashed border-outline-variant bg-muted/40 px-4 text-center hover:border-primary" type="button" onClick={() => imageInputRef.current?.click()}>
                    <ImagePlus className="text-primary" aria-hidden="true" />
                    <span className="mt-2 text-sm font-semibold">Choose an image</span>
                    <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, or GIF</span>
                  </button>
                )}
              </div>
            </div>
            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
            <DialogFooter className="mx-0 mb-0 px-0 pb-0">
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button disabled={saving} type="submit">{saving ? "Publishing…" : "Publish listing"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
