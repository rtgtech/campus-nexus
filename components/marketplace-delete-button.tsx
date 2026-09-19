"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { chatRequest } from "@/lib/chat-api";

export function MarketplaceDeleteButton({ itemId, title, onDeleted }: { itemId: string; title: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await chatRequest<void>(`/api/marketplace/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      setOpen(false);
      window.dispatchEvent(new Event("marketplace-listings-changed"));
      onDeleted();
    } catch (cause) { setError((cause as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setError(""); setOpen(true); }}><Trash2 aria-hidden="true" />Delete item</Button>
    <AlertDialog open={open} onOpenChange={(value) => { if (!lock.current) setOpen(value); }}>
      <AlertDialogContent>
        <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
        <AlertDialogDescription>This removes the listing from the marketplace and your profile. This cannot be undone.</AlertDialogDescription>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete item"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
