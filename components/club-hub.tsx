"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClubFollowButton } from "@/components/club-follow-button";
import { ClubPostComposer } from "@/components/club-post-composer";
import { PostDeleteButton } from "@/components/post-delete-button";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, authFetch, readAuthSession } from "@/lib/auth-client";
import { getInitials, type ClubDetailData, type ClubEvent, type ClubMember, type FeedCard, type PostLikeData } from "@/lib/app-data";
import { parseApiResponse } from "@/lib/api-response-contract";
import { formatPostTime } from "@/lib/post-time";
import { cn } from "@/lib/utils";

type ClubHubProps = {
  detail: ClubDetailData;
};

type HubTab = "posts" | "events" | "members" | "about";

const tabs: Array<{ id: HubTab; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "events", label: "Events" },
  { id: "members", label: "Members" },
  { id: "about", label: "About" },
];

function readMetric(value: string | number | undefined) {
  if (typeof value === "number") {
    return Math.max(0, value);
  }
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 1000 ? "compact" : "standard" }).format(value);
}

function isMp4(url: string) {
  const normalized = url.toLowerCase().split("?", 1)[0];
  return normalized.endsWith(".mp4") || normalized.startsWith("data:video/mp4");
}

function postText(post: FeedCard) {
  return post.caption || post.body || post.title || "Post content not available.";
}

function memberProfileHref(member: ClubMember) {
  return `/${encodeURIComponent(member.username || member.userId)}`;
}

function joinedLabel(createdAt: string) {
  const date = new Date(createdAt);
  return Number.isFinite(date.getTime()) ? `Member since ${date.getFullYear()}` : "Member since —";
}

function memberRoleLabel(value: string) {
  return value || "Member";
}

function eventDate(event: ClubEvent) {
  if (!event.startsAt) {
    return { day: "—", month: "TBD" };
  }
  const date = new Date(event.startsAt);
  if (!Number.isFinite(date.getTime())) {
    return { day: "—", month: "TBD" };
  }
  return {
    day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en", { month: "short" }).format(date).toUpperCase(),
  };
}

function ClubHubPostCard({ post, now }: { post: FeedCard; now: number }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.likedByCurrentUser ?? post.viewerHasLiked ?? false);
  const [likes, setLikes] = useState(readMetric(post.likes));
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const timestamp = post.createdAt || post.meta;
  const postedAt = now && timestamp ? formatPostTime(timestamp, now) : "Time unavailable";
  const isAnnouncement = post.type === 3;
  const tag = isAnnouncement ? "Announcement" : post.hashtags?.[0] || post.tag;
  const mediaUrls = post.mediaUrls?.length
    ? post.mediaUrls
    : post.mediaUrl || post.image
      ? [post.mediaUrl || post.image]
      : [];

  async function toggleLike() {
    if (!post.postId || pending || !readAuthSession()) {
      return;
    }

    const previousLiked = liked;
    const previousLikes = likes;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes((current) => Math.max(0, current + (nextLiked ? 1 : -1)));
    setPending(true);

    try {
      const response = await authFetch(`${API_BASE_URL}/api/posts/${encodeURIComponent(post.postId)}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error("Like request failed");
      }
      const payload = parseApiResponse<PostLikeData>(`/api/posts/${post.postId}/like`, data);
      setLiked(payload.liked);
      setLikes(readMetric(payload.likes));
    } catch {
      setLiked(previousLiked);
      setLikes(previousLikes);
    } finally {
      setPending(false);
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}/viewpost?=${encodeURIComponent(post.postId ?? "")}`;
    if (navigator.share) {
      await navigator.share({ title: post.title, text: postText(post), url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  function handleDeleted() {
    setDeleted(true);
    router.refresh();
  }

  if (deleted) {
    return null;
  }

  return (
    <article className="flex gap-3 rounded-[12px] border border-primary/12 bg-white p-4 shadow-[0_10px_28px_rgba(35,30,93,0.05)] sm:p-[18px]">
      <Link
        aria-label={`View ${post.author}'s profile`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border border-primary/15 bg-primary-fixed text-[11px] font-bold text-black"
        href={`/${encodeURIComponent(post.authorId || post.author)}`}
      >
        {getInitials(post.author)}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[12px] text-[#686862]">
            <Link className="font-semibold text-[#171717] hover:underline" href={`/${encodeURIComponent(post.authorId || post.author)}`}>
              {post.author}
            </Link>
            <span> · posted · </span>
            <time dateTime={timestamp}>{postedAt}</time>
          </div>
          <PostDeleteButton authorId={post.authorId} postId={post.postId} onDeleted={handleDeleted} />
        </div>
        <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-6 text-[#242422]">{postText(post)}</p>

        {mediaUrls.length > 0 ? (
          <div className={cn("mt-3 grid overflow-hidden rounded-[8px] border border-[#deded8]", mediaUrls.length > 1 && "grid-cols-2 gap-px bg-[#deded8]")}>
            {mediaUrls.map((url, index) =>
              isMp4(url) ? (
                <video key={`${url}-${index}`} className="max-h-80 h-full w-full bg-black object-cover" controls src={url} />
              ) : (
                <img key={`${url}-${index}`} alt="" className="max-h-80 h-full w-full bg-[#f1f1ed] object-cover" src={url} />
              ),
            )}
          </div>
        ) : null}

        {tag ? (
          <span className="mt-3 inline-flex rounded-[5px] border border-secondary/15 bg-secondary-fixed px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-black">
            {tag}
          </span>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-[#686862]">
          <button
            aria-label={liked ? "Unlike post" : "Like post"}
            aria-pressed={liked}
            className={cn("inline-flex items-center gap-1.5 hover:text-[#171717]", liked && "text-[#171717]")}
            disabled={pending || !post.postId}
            type="button"
            onClick={toggleLike}
          >
            <span className="material-symbols-outlined text-[17px]">{liked ? "favorite" : "favorite_border"}</span>
            {formatMetric(likes)}
          </button>
          <button className="inline-flex items-center gap-1.5 hover:text-[#171717]" type="button" onClick={sharePost}>
            <span className="material-symbols-outlined text-[17px]">arrow_outward</span>
            Share
          </button>
          {isAnnouncement ? (
            post.registrationLink ? (
              <a className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#deded8] px-2 py-1 hover:text-[#171717]" href={post.registrationLink}>
                <span className="material-symbols-outlined text-[17px]">how_to_reg</span>
                Apply
              </a>
            ) : (
              <span aria-disabled="true" className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#deded8] px-2 py-1 opacity-50">
                <span className="material-symbols-outlined text-[17px]">how_to_reg</span>
                Apply
              </span>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EventRow({ event }: { event: ClubEvent }) {
  const date = eventDate(event);
  return (
    <div className="grid grid-cols-[44px_1fr] items-center gap-3 rounded-[9px] border border-primary/10 bg-primary-fixed/55 px-3 py-2.5">
      <div className="text-center font-mono">
        <div className="text-base font-bold leading-none">{date.day}</div>
        <div className="mt-1 text-[9px] tracking-[0.08em] text-[#72726c]">{date.month}</div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold">{event.title}</p>
        <p className="mt-1 truncate text-[10px] text-[#72726c]">{event.location || "Location not available"}</p>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: ClubMember }) {
  const isLeader = member.title && member.title.toLowerCase() !== "member";
  return (
    <Link className="flex items-center gap-2.5 py-2 hover:text-[#171717]" href={memberProfileHref(member)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-primary/15 bg-primary-fixed text-[10px] font-bold text-black">
        {member.initials || getInitials(member.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{member.name}</span>
        <span className="mt-0.5 block truncate text-[10px] text-[#72726c]">{joinedLabel(member.createdAt)}</span>
      </span>
      {isLeader ? (
        <span className="rounded-[4px] border border-[#d7d7d1] px-1.5 py-0.5 font-mono text-[8px] uppercase text-[#70706a]">
          {memberRoleLabel(member.title)}
        </span>
      ) : null}
    </Link>
  );
}

export function ClubHub({ detail }: ClubHubProps) {
  const { club, members, posts } = detail;
  const initialFollowers = detail.followers ?? club.followers ?? 0;
  const [activeTab, setActiveTab] = useState<HubTab>("posts");
  const [followers, setFollowers] = useState(initialFollowers);
  const [now, setNow] = useState(0);
  const events = detail.events ?? [];
  const postsCount = detail.postsCount ?? club.postsCount ?? posts.length;
  const membersCount = club.memberCount ?? club.membersCount ?? members.length;
  const recruiting = club.status.toLowerCase().includes("recruit");
  const latestPostTime = posts[0] && now ? formatPostTime(posts[0].createdAt || posts[0].meta, now) : "Not available";

  useEffect(() => {
    setNow(Date.now());
  }, []);

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1240px] px-5 pb-16 pt-7 text-black md:px-8 md:pl-24">
      <Link className="inline-flex items-center gap-2 text-xs text-[#686862] hover:text-[#171717]" href="/clubs">
        <span aria-hidden="true">←</span>
        All clubs
      </Link>

      <section className="mt-4 flex flex-col items-start gap-5 rounded-[14px] border border-primary/12 bg-white p-5 shadow-[0_14px_36px_rgba(35,30,93,0.06)] sm:p-6 md:flex-row">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-primary/15 bg-primary-fixed text-lg font-bold text-black">
          {club.bannerImage ? (
            <img alt="" className="h-full w-full object-cover" src={club.bannerImage} />
          ) : (
            getInitials(club.title)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em]">{club.title}</h1>
              <p className="mt-1 font-mono text-[10px] uppercase text-[#72726c]">
                {club.category || "Category —"} · {membersCount} members · est. {club.establishedYear ?? "—"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="h-9 rounded-[8px] border border-[#d7d7d1] bg-[#f7f7f4] px-4 text-xs font-bold text-[#777770]"
                disabled
                title="Club messaging is not available from the API yet."
                type="button"
              >
                Message
              </button>
              <ClubFollowButton
                clubSlug={club.slug}
                clubTitle={club.title}
                initialFollowers={initialFollowers}
                layout="button"
                onFollowersChange={setFollowers}
              />
            </div>
          </div>

          <p className="mt-3 max-w-[660px] text-[13px] leading-6 text-[#686862]">
            {club.description || "Description not available yet."}
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
            <div>
              <dd className="text-base font-bold">{formatMetric(followers)}</dd>
              <dt className="mt-0.5 text-[10px] text-[#72726c]">Followers</dt>
            </div>
            <div>
              <dd className="text-base font-bold">{formatMetric(membersCount)}</dd>
              <dt className="mt-0.5 text-[10px] text-[#72726c]">Members</dt>
            </div>
            <div>
              <dd className="text-base font-bold">{club.eventsHosted ?? "—"}</dd>
              <dt className="mt-0.5 text-[10px] text-[#72726c]">Events hosted</dt>
            </div>
            <div>
              <dd className="text-base font-bold">
                {club.activityRank === undefined ? "—" : String(club.activityRank).startsWith("#") ? club.activityRank : `#${club.activityRank}`}
              </dd>
              <dt className="mt-0.5 text-[10px] text-[#72726c]">Activity rank</dt>
            </div>
          </dl>

          <div className="mt-4 flex w-fit items-center gap-2 rounded-full border border-secondary/15 bg-secondary-fixed px-3.5 py-1.5 font-mono text-[10px] uppercase text-black">
            <span className={cn("h-[7px] w-[7px] rounded-full", recruiting ? "animate-pulse bg-secondary" : "bg-outline")} />
            {club.status || "Status —"}
            {recruiting ? ` · ${club.recruitingDeadline || "deadline unavailable"}` : null}
          </div>
        </div>
      </section>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-primary/15" role="tablist" aria-label="Club sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-controls={`club-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={cn(
              "border-b-2 border-transparent px-4 py-3 text-[13px] font-semibold text-[#72726c] transition hover:text-[#171717]",
              activeTab === tab.id && "border-secondary text-black",
            )}
            id={`club-tab-${tab.id}`}
            role="tab"
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "posts" ? (
        <section aria-labelledby="club-tab-posts" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" id="club-panel-posts" role="tabpanel">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Club posts</h2>
                <p className="mt-1 text-[10px] text-[#72726c]">Showing all {posts.length} of {postsCount}</p>
              </div>
              <ClubPostComposer
                clubSlug={club.slug}
                members={members}
                triggerClassName="h-9 rounded-[8px] border border-primary bg-primary px-3 text-xs font-bold text-white shadow-[0_7px_18px_rgba(35,30,93,0.18)] hover:bg-primary/90"
              />
            </div>

            {posts.length === 0 ? (
              <div className="rounded-[12px] border border-[#deded8] bg-white px-6 py-12 text-center">
                <p className="text-sm font-semibold">No club posts yet</p>
                <p className="mt-1 text-xs text-[#72726c]">Posts will appear here when club members publish updates.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {posts.map((post) => (
                  <ClubHubPostCard key={post.postId ?? post.title} now={now} post={post} />
                ))}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-3">
            <section className="rounded-[12px] border border-[#deded8] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">Upcoming events</h2>
                <button className="text-[10px] text-[#94948d]" disabled type="button">See all</button>
              </div>
              {events.length > 0 ? (
                <div className="space-y-2">
                  {events.slice(0, 2).map((event, index) => (
                    <EventRow key={event.id ?? `${event.title}-${index}`} event={event} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[9px] border border-primary/10 bg-primary-fixed/55 px-3 py-4 text-[11px] leading-5 text-black">
                  Event schedule not available yet.
                </div>
              )}
            </section>

            <section className="rounded-[12px] border border-[#deded8] bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">Members</h2>
                <button className="text-[10px] text-[#72726c] hover:text-[#171717]" type="button" onClick={() => setActiveTab("members")}>
                  See all
                </button>
              </div>
              {members.length > 0 ? (
                members.slice(0, 4).map((member) => <MemberRow key={member.id} member={member} />)
              ) : (
                <p className="py-3 text-[11px] text-[#72726c]">No members yet.</p>
              )}
            </section>

            <section className="rounded-[12px] border border-[#deded8] bg-white p-4">
              <h2 className="text-[13px] font-semibold">Activity</h2>
              <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase text-[#70706a]">
                <span className="h-[7px] w-[7px] rounded-full bg-secondary" />
                Latest post · {latestPostTime}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-[#72726c]">
                {postsCount} {postsCount === 1 ? "post" : "posts"} · activity rank {club.activityRank ?? "—"} · events hosted {club.eventsHosted ?? "—"}
              </p>
            </section>
          </aside>
        </section>
      ) : null}

      {activeTab === "events" ? (
        <section aria-labelledby="club-tab-events" className="mt-5" id="club-panel-events" role="tabpanel">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Club events</h2>
            <p className="mt-1 text-xs text-[#72726c]">Workshops, meetups, and club activities.</p>
          </div>
          {events.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {events.map((event, index) => <EventRow key={event.id ?? `${event.title}-${index}`} event={event} />)}
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#deded8] bg-white px-6 py-12 text-center">
              <p className="text-sm font-semibold">Event details are not available yet</p>
              <p className="mt-1 text-xs text-[#72726c]">This section is ready for the future club-events API.</p>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section aria-labelledby="club-tab-members" className="mt-5" id="club-panel-members" role="tabpanel">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Club members</h2>
            <p className="mt-1 text-xs text-[#72726c]">{members.length} active {members.length === 1 ? "member" : "members"}</p>
          </div>
          {members.length > 0 ? (
            <div className="grid gap-x-8 rounded-[12px] border border-[#deded8] bg-white px-4 py-2 md:grid-cols-2">
              {members.map((member) => <MemberRow key={member.id} member={member} />)}
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#deded8] bg-white px-6 py-12 text-center text-sm text-[#72726c]">
              No members yet.
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "about" ? (
        <section aria-labelledby="club-tab-about" className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" id="club-panel-about" role="tabpanel">
          <div className="rounded-[12px] border border-[#deded8] bg-white p-5">
            <h2 className="text-base font-semibold">About {club.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-[#686862]">
              {club.description || "Description not available yet."}
            </p>
          </div>
          <dl className="rounded-[12px] border border-[#deded8] bg-white p-5 text-xs">
            {[
              ["Category", club.category || "Not available yet"],
              ["Established", club.establishedYear ?? "Not available yet"],
              ["Members", membersCount],
              ["Status", club.status || "Not available yet"],
              ["Recruiting deadline", club.recruitingDeadline || "Not available yet"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-[#e2e2dc] py-3 first:pt-0 last:border-0 last:pb-0">
                <dt className="text-[#72726c]">{label}</dt>
                <dd className="text-right font-semibold text-[#353532]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
