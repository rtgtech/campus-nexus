"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { EntityListItem } from "@/components/entity-list-item";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { API_BASE_URL } from "@/lib/auth-client";
import type { SearchData, SearchKind } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { cn } from "@/lib/utils";

export type { SearchKind } from "@/lib/app-data";

export type HeaderSearchProps = {
  className?: string;
  expandable?: boolean;
  placeholder?: string;
  types?: SearchKind[];
};

const emptyResults: SearchData = {
  query: "",
  users: [],
  clubs: [],
  posts: [],
  products: [],
};

const defaultTypes: SearchKind[] = ["user", "club", "post"];

const searchGroupConfig: Array<{
  key: "users" | "clubs" | "posts" | "products";
  label: string;
  type: SearchKind;
}> = [
  { key: "users", label: "People", type: "user" },
  { key: "clubs", label: "Clubs", type: "club" },
  { key: "products", label: "Products", type: "product" },
  { key: "posts", label: "Posts", type: "post" },
];

const typeMeta: Record<SearchKind, { badge: string; label: string }> = {
  user: { badge: "person", label: "Profile" },
  club: { badge: "groups", label: "Club" },
  product: { badge: "storefront", label: "Product" },
  post: { badge: "article", label: "Post" },
};

function resultGroups(results: SearchData, enabledTypes: SearchKind[]) {
  return [
    ...searchGroupConfig
      .filter((group) => enabledTypes.includes(group.type))
      .map((group) => ({ label: group.label, items: results[group.key] })),
  ].filter((group) => group.items.length > 0);
}

export function HeaderSearch({
  className = "",
  expandable = false,
  placeholder = "Search campus spaces...",
  types = defaultTypes,
}: HeaderSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchData>(emptyResults);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(!expandable);

  const enabledTypes = useMemo(() => Array.from(new Set(types)), [types]);
  const groups = useMemo(() => resultGroups(results, enabledTypes), [enabledTypes, results]);
  const firstResult = groups[0]?.items[0];
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2 || enabledTypes.length === 0) {
      setResults(emptyResults);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setStatus("loading");

      try {
        const params = new URLSearchParams({
          q: trimmedQuery,
          types: enabledTypes.join(","),
        });
        const response = await fetch(`${API_BASE_URL}/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => emptyResults);

        if (!response.ok) {
          throw new Error("Search failed");
        }
        setResults(parseApiResponse<SearchData>(`/api/search?${params.toString()}`, data));
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setResults(emptyResults);
          setStatus("error");
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [enabledTypes, trimmedQuery]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstResult) {
      return;
    }

    setOpen(false);
    setExpanded(!expandable);
    router.push(firstResult.href);
  }

  return (
    <Popover
      open={open && trimmedQuery.length >= 2}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setExpanded(!expandable);
        }
      }}
    >
      <form
        className={cn(
          "relative z-20 transition-[width] duration-300 ease-out",
          className,
          expandable && (expanded ? "w-52 sm:w-64 md:w-72" : "w-10"),
        )}
        onSubmit={handleSubmit}
      >
        <PopoverTrigger
          render={
            <InputGroup
              aria-expanded={expanded}
              className="h-10 overflow-hidden rounded-full border-outline-variant bg-muted px-2"
            />
          }
        >
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search campus"
            className={cn(
              "text-on-surface transition-opacity duration-200 placeholder:text-on-surface-variant",
              expandable && !expanded && "w-0 min-w-0 px-0 opacity-0",
            )}
            placeholder={placeholder}
            type="search"
            value={query}
            onBlur={() => {
              if (trimmedQuery.length < 2) {
                setExpanded(!expandable);
              }
            }}
            onFocus={() => {
              setExpanded(true);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && trimmedQuery.length < 2) {
                setExpanded(!expandable);
                event.currentTarget.blur();
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
        </PopoverTrigger>
      </form>

      <PopoverContent
        align={expandable ? "end" : "start"}
        className="w-(--anchor-width) min-w-80 overflow-hidden rounded-[10px] border-outline-variant/70 p-0 shadow-[0_24px_70px_rgba(15,18,33,0.2)]"
        initialFocus={false}
        sideOffset={8}
      >
        {status === "loading" ? (
          <p className="flex items-center gap-2 p-4 text-sm font-semibold text-on-surface-variant">
            <Spinner /> Searching...
          </p>
        ) : status === "error" ? (
          <p className="p-4 text-sm font-semibold text-destructive">Search is unavailable.</p>
        ) : groups.length === 0 ? (
          <p className="p-4 text-sm font-semibold text-on-surface-variant">No results found.</p>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <div className="p-2">
              {groups.map((group) => (
                <div key={group.label} className="py-1">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <EntityListItem
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      title={item.title}
                      subtitle={item.subtitle}
                      kind={item.type}
                      icon={item.icon}
                      initials={item.initials}
                      badgeIcon={typeMeta[item.type].badge}
                      badgeLabel={typeMeta[item.type].label}
                      className="flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-surface-container-low"
                      avatarClassName="rounded-full bg-primary-fixed text-primary"
                      trailing={
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
                          {typeMeta[item.type].label}
                        </span>
                      }
                      onNavigate={() => {
                        setOpen(false);
                        setExpanded(!expandable);
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
