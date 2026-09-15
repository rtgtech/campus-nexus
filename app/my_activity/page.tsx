import { CampusIcon } from "@/components/campus-icon";
import Link from "next/link";
import { cookies } from "next/headers";
import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { FeedPostCard } from "@/components/feed-post-card";
import { buttonVariants } from "@/components/ui/button";
import { getCampusData, getCampusDataResult } from "@/lib/campus-api";
import { LoadError } from "@/components/load-error";
import { type CampusUser, type FeedCard } from "@/lib/app-data";
import { cn } from "@/lib/utils";

async function getCurrentUser(token: string | undefined): Promise<CampusUser | null> {
  if (!token) {
    return null;
  }

  const payload = await getCampusData<{ user?: CampusUser }>(
    "/api/auth/me",
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return payload.user ?? null;
}

export default async function MyActivityPage() {
  const token = (await cookies()).get("campusNexusToken")?.value;
  const currentUser = await getCurrentUser(token);
  const options = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const [ownResult, likedResult] = currentUser ? await Promise.all([
    getCampusDataResult<FeedCard[]>(`/api/posts?authorId=${encodeURIComponent(currentUser.userId)}`, [], options),
    getCampusDataResult<FeedCard[]>("/api/liked-posts", [], options),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (ownResult.error || likedResult.error) return <CampusShell active="profile"><LoadError message="Your activity couldn't be loaded." /></CampusShell>;
  const myPosts = ownResult.data;
  const likedPosts = likedResult.data;
  const profileKey = currentUser?.username || currentUser?.userId;

  return (
    <CampusShell active="profile">
      <div className="space-y-8">
        <section className="rounded border border-outline-variant/60 bg-white p-6  md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-on-secondary-fixed-variant">My Activity</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-editorial font-medium text-4xl  tracking-tight text-on-background">
                {currentUser ? `${currentUser.name}'s activity` : "Your activity"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
                Review posts you shared and posts you liked across Campus Nexus.
              </p>
            </div>
            <Link
              href={profileKey ? `/${encodeURIComponent(profileKey)}` : "/auth"}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded px-4")}
            >
              <CampusIcon name="person" className=" text-base" />
              Profile
            </Link>
          </div>
        </section>

        <section className="rounded border border-outline-variant/60 bg-white p-6 ">
          <SectionTitle
            title="My Posts"
            description={myPosts.length > 0 ? `${myPosts.length} posts you shared.` : "Posts you create will appear here."}
          />
          <div className="mt-6">
            {myPosts.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {myPosts.map((post) => (
                  <FeedPostCard key={post.postId ?? post.title} post={post} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={currentUser ? "No posts yet" : "Sign in required"}
                description={currentUser ? "Your published posts will appear here." : "Sign in to see your activity."}
                action={
                  currentUser ? (
                    <Link
                      href="/?=createpost"
                      className={cn(buttonVariants({ size: "lg" }), "rounded bg-secondary px-5 text-black hover:bg-secondary/90")}
                    >
                      <CampusIcon name="add" className=" text-base" />
                      Create post
                    </Link>
                  ) : (
                    <Link
                      href="/auth"
                      className={cn(buttonVariants({ size: "lg" }), "rounded px-5")}
                    >
                      <CampusIcon name="login" className=" text-base" />
                      Sign in
                    </Link>
                  )
                }
              />
            )}
          </div>
        </section>

        <section className="rounded border border-outline-variant/60 bg-white p-6 ">
          <SectionTitle
            title="Liked Posts"
            description={likedPosts.length > 0 ? `${likedPosts.length} posts you liked.` : "Posts you like will appear here."}
          />
          <div className="mt-6">
            {likedPosts.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {likedPosts.map((post) => (
                  <FeedPostCard key={post.postId ?? post.title} post={post} />
                ))}
              </div>
            ) : (
              <EmptyState title="No liked posts yet" description="Use the heart action on posts to build this list." />
            )}
          </div>
        </section>
      </div>
    </CampusShell>
  );
}
