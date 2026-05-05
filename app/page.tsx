import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { CreatePostOverlay } from "@/components/create-post-overlay";
import { DismissibleCampusPulse } from "@/components/dismissible-campus-pulse";
import { getDemoData } from "@/lib/campus-api";
import { fallbackFeed, type FeedData } from "@/lib/demo-data";
import Link from "next/link";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const unnamedQuery = getSearchValue(resolvedSearchParams[""]);
  const mode = getSearchValue(resolvedSearchParams.mode);
  const view = getSearchValue(resolvedSearchParams.view);
  const showCreatePost =
    unnamedQuery === "createpost" || mode === "createpost" || view === "createpost";
  const feedData = await getDemoData<FeedData>("/api/feed", fallbackFeed);

  return (
    <CampusShell active="feed">
      <>
        {showCreatePost ? <CreatePostOverlay /> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="space-y-6">
          <DismissibleCampusPulse />

          <div className="rounded-[28px] border border-outline-variant/60 bg-white/85 p-5 shadow-[0_12px_30px_rgba(27,27,35,0.06)] backdrop-blur-xl md:p-6">
            <div className="flex gap-4">
              <img
                alt="Profile"
                className="h-12 w-12 rounded-full border border-outline-variant/60 object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2HG1xSJvAC-LTLuTgDj6ca7MKCl9pIhFHyow3UmQz2W4VnYd03tR47VxcwUR9KtWVt_AAtjU72yn00Fw3I1Uzoi08AanNjKwrZCDNzEY-8PnA19oa8SAbeWhNz14nkzGSrivl0FRKgrU60m_gnegiE-EufB6-vvjOZ9h2xlI8tAXtg4_o9OB28r0Y3O5tR6pGVS6nzBPuQl4e7T5uUr_koUHDIs_9qiQnQB6PAAKzCYzjfDHTewf0YaPXOd_hrTRZ_THoAcfdCSU"
              />
              <div className="flex-1">
                <Link
                  href="/?=createpost"
                  className="block w-full rounded-[20px] bg-surface-container px-4 py-4 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high"
                >
                  What is happening in Bengaluru today, Aarav?
                </Link>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3 text-sm font-semibold text-on-surface-variant">
                    <Link href="/?=createpost" className="rounded-full bg-primary-fixed px-4 py-2 text-primary">
                      Photo
                    </Link>
                    <Link href="/?=createpost" className="rounded-full bg-surface-container px-4 py-2 hover:text-primary">
                      Video
                    </Link>
                    <Link href="/?=createpost" className="rounded-full bg-surface-container px-4 py-2 hover:text-primary">
                      Event
                    </Link>
                  </div>
                  <Link
                    href="/?=createpost"
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-container"
                  >
                    Post
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {feedData.feedCards.map((card) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-[28px] border border-outline-variant/60 bg-white/85 shadow-[0_12px_30px_rgba(27,27,35,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="flex items-center gap-3">
                  <img
                    alt={card.author}
                    className="h-11 w-11 rounded-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUIgw-r8lL-hQJpHTVbQRmQ6qexraJJDerNbpw2ljWMfpSLTGKAIRxd4yUPs0fmC-via-dSqavbkXp8uAl3oqTMk773qE0y5G8Z1_esNWsCe0bbJpbFeZpprT_uLBcz8PPGAMa3jEaqDT5apX5CUNerWaLjtYr0-HajSZ9qoci5iIa-y3w8UTQwtNQ2VO9mYM4QrIb6IFW52n5VfoaLqSBb_zvSSvIVa6b7oyeL7bFBYzRk3zV0RnafvUCR05h25YzrduCREHXINU"
                  />
                  <div>
                    <h3 className="font-semibold text-on-surface">{card.author}</h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{card.meta}</p>
                  </div>
                </div>
                <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>

              <div className="relative aspect-[4/3] overflow-hidden bg-primary md:aspect-[16/10]">
                <img alt={card.title} className="h-full w-full object-cover" src={card.image} />
                <div className="absolute inset-x-0 bottom-0 bg-[rgba(34,29,92,0.72)] px-6 pb-6 pt-20 text-white">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h4 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight">{card.title}</h4>
                      <p className="mt-2 max-w-xl text-sm text-white/82">{card.body}</p>
                    </div>
                    <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                      {card.tag}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="flex gap-5 text-sm font-semibold text-on-surface-variant">
                  <button className="flex items-center gap-2 hover:text-primary">
                    <span className="material-symbols-outlined text-secondary">favorite</span>
                    {card.likes}
                  </button>
                  <button className="flex items-center gap-2 hover:text-primary">
                    <span className="material-symbols-outlined">chat_bubble</span>
                    {card.comments}
                  </button>
                  <button className="flex items-center gap-2 hover:text-primary">
                    <span className="material-symbols-outlined">share</span>
                    Share
                  </button>
                </div>
                <button className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container">
                  <span className="material-symbols-outlined">bookmark</span>
                </button>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-outline-variant/60 bg-white/85 p-6 shadow-[0_12px_30px_rgba(27,27,35,0.06)]">
            <SectionTitle title="Trending" description="Signals moving fastest across Bengaluru campuses." />
            <div className="mt-5 space-y-4">
              {feedData.trending.map((item) => (
                <div key={item.tag} className="rounded-2xl bg-surface-container-low p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">{item.label}</p>
                  <p className="mt-2 font-['Space_Grotesk'] text-lg font-bold text-primary">{item.tag}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{item.posts}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-outline-variant/60 bg-white/85 p-6 shadow-[0_12px_30px_rgba(27,27,35,0.06)]">
            <SectionTitle title="Suggested People" description="Students near your circles." />
            <div className="mt-5 space-y-4">
              {feedData.suggestedPeople.map(({ name, subtitle }) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      alt={name}
                      className="h-10 w-10 rounded-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmohnLH22aDgcO0HiQ_1BDFiNvP0g07KqJ3Hd7NnA1aWg5d5Jnlok7-NI18bm3jdM6mSlPfagAoExGl5BoYjNfQC27_QIhQ5VIu1pD8cvAg3MDCpWhEEPkDpF4YDxFTZpNiE1M8fSukSm6DULHLqteYb_WSasjwcZD3Nh4DErTIAk9FuMgB0V-Z-Ao6BGC-KgM19m6JlGrUvrP_2BG9RpZMVBmPoQYnawA9iI9CuYm97YjIiDwrrPyPmOgPVZs162o-pUJigTtfeA"
                    />
                    <div>
                      <p className="font-semibold text-on-surface">{name}</p>
                      <p className="text-sm text-on-surface-variant">{subtitle}</p>
                    </div>
                  </div>
                  <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
        </div>
      </>
    </CampusShell>
  );
}
