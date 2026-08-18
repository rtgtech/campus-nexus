"use client";

import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INITIAL_COUNTDOWN = 3;
const ZERO_DISPLAY_DURATION_MS = 450;

function externalDestination(anchor: HTMLAnchorElement) {
  try {
    const destination = new URL(anchor.href, window.location.href);
    if (
      (destination.protocol === "http:" || destination.protocol === "https:") &&
      destination.origin !== window.location.origin
    ) {
      return destination.href;
    }
  } catch {
    // Invalid links follow the browser's normal behavior.
  }
  return null;
}

function openExternalInNewTab(destination: string) {
  const newTab = window.open("about:blank", "_blank");
  if (!newTab) {
    return false;
  }
  newTab.opener = null;
  newTab.location.replace(destination);
  return true;
}

export function ExternalLinkGuard() {
  const [destination, setDestination] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);

  useEffect(() => {
    function interceptExternalLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || destination) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.dataset.externalLinkGuard === "off") {
        return;
      }
      const href = externalDestination(anchor);
      if (!href) {
        return;
      }
      event.preventDefault();
      setCountdown(INITIAL_COUNTDOWN);
      setDestination(href);
    }

    document.addEventListener("click", interceptExternalLink);
    return () => document.removeEventListener("click", interceptExternalLink);
  }, [destination]);

  useEffect(() => {
    if (!destination) {
      return;
    }

    let current = INITIAL_COUNTDOWN;
    let redirectTimer: number | undefined;
    const countdownTimer = window.setInterval(() => {
      current -= 1;
      setCountdown(current);
      if (current === 0) {
        window.clearInterval(countdownTimer);
        redirectTimer = window.setTimeout(() => {
          if (openExternalInNewTab(destination)) {
            setDestination(null);
            setCountdown(INITIAL_COUNTDOWN);
          }
        }, ZERO_DISPLAY_DURATION_MS);
      }
    }, 1000);

    return () => {
      window.clearInterval(countdownTimer);
      if (redirectTimer !== undefined) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [destination]);

  function cancelRedirect() {
    setDestination(null);
    setCountdown(INITIAL_COUNTDOWN);
  }

  let hostname = "external site";
  if (destination) {
    try {
      hostname = new URL(destination).hostname;
    } catch {
      // Keep the generic label.
    }
  }

  return (
    <Dialog open={Boolean(destination)} onOpenChange={(open) => !open && cancelRedirect()}>
      <DialogContent
        className="gap-0 rounded-[3px] border border-outline-variant bg-white p-0 shadow-[0_16px_45px_rgba(15,18,33,0.16)]"
        style={{ width: "min(30rem, calc(100vw - 2rem))", maxWidth: "none" }}
      >
        <DialogHeader className="px-6 pb-5 pt-6 text-left">
          <DialogTitle className="text-lg font-semibold text-on-surface">You are being redirected</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-on-surface-variant">
            You are leaving Campus Nexus for {hostname}. The link will open in a new tab.
          </DialogDescription>
        </DialogHeader>
        <div className="border-y border-outline-variant/60 px-6 py-7 text-center">
          <p aria-live="assertive" aria-atomic="true" className="text-5xl font-semibold tabular-nums text-on-surface">
            {countdown}
          </p>
        </div>
        <DialogFooter className="m-0 rounded-none border-0 bg-white px-6 py-4 sm:justify-end">
          <Button className="rounded-[3px]" type="button" variant="outline" onClick={cancelRedirect}>
            Cancel
          </Button>
          <a
            className={buttonVariants({ className: "rounded-[3px]" })}
            data-external-link-guard="off"
            href={destination ?? undefined}
            rel="noopener noreferrer"
            target="_blank"
            onClick={cancelRedirect}
          >
            Open now
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
