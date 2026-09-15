"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoadError({ message = "We couldn't load this right now." }: { message?: string }) {
  const router = useRouter();
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded border border-border bg-white p-5 text-sm">
    <p>{message}</p><Button variant="outline" onClick={() => router.refresh()}>Try again</Button>
  </div>;
}
