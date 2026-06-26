"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/auth-client";

export type SearchKind = "user" | "club" | "post" | "product";

type SearchItem = {
  id: string | number;
  type: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  initials?: string;
};

type SearchResponse = {
  users: SearchItem[];
  clubs: SearchItem[];
  posts: SearchItem[];
  products: SearchItem[];
};

export type HeaderSearchProps = {
  className?: string;
  placeholder?: string;
  types?: SearchKind[];
};

const emptyResults: SearchResponse = {
  users: [],
  clubs: [],
  posts: [],
  products: [],
};

const defaultTypes: SearchKind[] = ["user", "club", "post"];

const searchGroupConfig: Array<{ key: keyof SearchResponse; label: string; type: SearchKind }> = [
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

function resultGroups(results: SearchResponse, enabledTypes: SearchKind[]) {
  return [
    ...searchGroupConfig
      .filter((group) => enabledTypes.includes(group.type))
      .map((group) => ({ label: group.label, items: results[group.key] })),
  ].filter((group) => group.items.length > 0);
}

function resultIcon(item: SearchItem) {
  if (item.type === "user" && item.initials) {
    return <span className="text-xs font-bold">{item.initials}</span>;
  }

  return <span className="material-symbols-outlined text-lg">{item.icon}</span>;
}

export function HeaderSearch({
  className = "",
  placeholder = "Search campus spaces...",
  types = defaultTypes,
}: HeaderSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(emptyResults);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [open, setOpen] = useState(false);

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

        setResults({
          users: Array.isArray(data.users) ? data.users : [],
          clubs: Array.isArray(data.clubs) ? data.clubs : [],
          posts: Array.isArray(data.posts) ? data.posts : [],
          products: Array.isArray(data.products) ? data.products : [],
        });
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
    router.push(firstResult.href);
  }

  return (
    <form
      className={`relative ${className}`}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onFocus={() => setOpen(true)}
      onSubmit={handleSubmit}
    >
      <div className="flex w-full items-center gap-3 rounded-full border border-outline-variant bg-[#F5F5F5] px-4 h-10">
        <span className="material-symbols-outlined text-base text-on-surface-variant">search</span>
        <input
          className="w-full appearance-none border-none bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:outline-none focus:ring-0"
          placeholder={placeholder}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
      </div>

      {open && trimmedQuery.length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-[24px] border border-outline-variant/70 bg-white shadow-[0_24px_70px_rgba(15,18,33,0.2)]">
          {status === "loading" ? (
            <p className="p-4 text-sm font-semibold text-on-surface-variant">Searching...</p>
          ) : status === "error" ? (
            <p className="p-4 text-sm font-semibold text-secondary">Search is unavailable.</p>
          ) : groups.length === 0 ? (
            <p className="p-4 text-sm font-semibold text-on-surface-variant">No results found.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {groups.map((group) => (
                <div key={group.label} className="py-1">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">{group.label}</p>
                  {group.items.map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-surface-container-low"
                      onClick={() => setOpen(false)}
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                        {resultIcon(item)}
                        <span
                          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white text-primary shadow-sm"
                          aria-label={typeMeta[item.type].label}
                          title={typeMeta[item.type].label}
                        >
                          <span className="material-symbols-outlined text-[11px] leading-none">
                            {typeMeta[item.type].badge}
                          </span>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-on-surface">{item.title}</span>
                        <span className="block truncate text-xs text-on-surface-variant">{item.subtitle}</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">
                        {typeMeta[item.type].label}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </form>
  );
}
