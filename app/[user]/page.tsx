import { CampusShell, SectionTitle } from "@/components/campus-shell";

type ProfilePageProps = {
  params: Promise<{
    user: string;
  }>;
};

function formatName(user: string) {
  return decodeURIComponent(user)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { user } = await params;
  const displayName = formatName(user) || "Alex Chen";

  return (
    <CampusShell active="profile" userHref={`/${user}`}>
      <div className="space-y-8">
        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)] md:p-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="relative">
              <div className="h-36 w-36 rounded-full bg-primary p-1 md:h-40 md:w-40">
                <img
                  alt={displayName}
                  className="h-full w-full rounded-full object-cover border-4 border-white"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhDngMlYP4ueK1rG1n1YglyuSuKmiLwNG-IGppRVpb797E97d8FUPIs9VEvE16hsybk3Go6-T8GzOncJaTXlY7nPGsXxcTwHia2E_rH8uTXkZ9OSVohLz1qh9lf4sUWuSK4ytQiKdt8RKntmeCaNpWLo5qWyFIqjpC-erm324XgHDySw1tTQ4ATzhfggXDZ9l_FDNRcSZdQRAGSx2aQ6L08XDaDfkQk7PS5sxXWJBKvGGozrB47Ad76HIhmV3Ob2nr0kHSPiUWWDA"
                />
              </div>
              <button className="absolute bottom-1 right-1 rounded-full bg-secondary p-3 text-white shadow-lg">
                <span className="material-symbols-outlined text-base">photo_camera</span>
              </button>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight text-primary">{displayName}</h1>
                <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                  Senior
                </span>
              </div>
              <p className="mt-3 text-lg text-on-surface-variant">Interaction Design & Cognitive Science</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary">Edit Profile</button>
                <button className="rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface">
                  Share
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-3">
          {[
            ["42", "Posts"],
            ["892", "Friends"],
            ["2.4k", "Nexus Score"],
          ].map(([value, label], index) => (
            <div
              key={label}
              className={[
                "rounded-[28px] border border-outline-variant/60 p-6 text-center shadow-[0_12px_30px_rgba(27,27,35,0.06)]",
                index === 2 ? "bg-primary text-white" : "bg-white",
              ].join(" ")}
            >
              <p className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight">{value}</p>
              <p
                className={[
                  "mt-2 text-[11px] font-semibold uppercase tracking-[0.24em]",
                  index === 2 ? "text-white/75" : "text-on-surface-variant",
                ].join(" ")}
              >
                {label}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
          <SectionTitle
            title="My Posts"
            description="The profile layout now uses one spacing scale and one color system instead of competing HTML themes."
          />
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[
              "https://lh3.googleusercontent.com/aida-public/AB6AXuC8C_RuYjQtvq8vWOiPC31iK9YmUALvdAYd9OXqdJsWGOD-U93opfFPBsgt371HwB-2r35WH_A4NHnEaNRSRjQ2Wce2h6CDMQ1cTwhttvzs4IndZUr7y8P3U-h10GWlvAFwVrB-C8-JcbfvPBK7X34gpxJkZHJWYgM1fhSFAF8RobAhL-tkShKrfFltWndo5uSyOUW7ErqbxNQAjxQvdbsTnmvA0wiVPs5tqwUACswtLYp4H5I5aAQvr_WweccPC8WLZATJifBfovQ",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuCIofFh-dajUK-0sl5sUHIQJQYuTDk_bPQg3YnL3F7cYXHgMiWVovzm-mWnekRobEBqRL9dsLlpc1ao3Swhe8-6kdhpC6bliKbI4cqY9q6SbHkcTvYbU6NnkEwS2G808QCyzWfZVN02kMr6FSpw0m98dUXacurlAj7MbYJwok2o7TyQglNc0_hw-JiJC0Kf8KcWwUtqwgWxY27f154FydHRNeRQWuRIVrD4j7YnHi7LnzCHRtk4x7m-s6yGAQg9dDgWjFPyLhUrEsM",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuCnysQcbBBZIvPHRbREH7eBhJDH9lDE-HPdLqBu-20t8WVaKhobI29o8PQ7JkyuD-UtpojVZLngf3IAz8HVEoNysbjR1WFfFn1EGHZGpLj0vi0fWspKb0daq5Vxu984gEJtaYCQyLVyCU__YjNwp8Jc8KlNEEUmzz85KdrXaUeXdzqVjKG9ejDb1KmlajLl-H0_nk-8idU5lv6SXMPaHZhrFoUzvX1CwSqEEdxATsdDUDTwunsp3saT06HMVY0JNyWagJgj-YbJSPA",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuCvAZU8JA3PN0Kqdin3dnLpkKWC6IjvWzOOkWGuPueQEESdcf32NejvlG35DzbYs1REgQgArjOfwLqSkTt9yjYVg-mCkbRqB90Xv4LjORLInUQPRYBjNa_6zUxcaFTkpUGik3h18ARG0SEByh2U6aGB6j949BdmJ3Orl40VYnyrPAMNbfvpdkG4fSema84XY850PRumsTU3IMkEEyKwXuul285txDUbFpW5RauNGSR9MzSsLyy1oPxrscSTI_IuZLiOI2TaZyH1GoI",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuAnpk4Tjh3saj1ncoN4r62vzqR84MocbQma9zPNZuGP8k7PTayFJi1e1rLtN2PRh6Y06vQ-GwqPAhSYjEkhA8Sy0WxLxF_7ZA4yuOMiPUFkYQQR3rAvv-k4_PqzRzvulCrfet3A-517TWyt-c00xMz1UWzUewuQ2tVE5nM5CeXbhETZeDvzvQlrAtH-ju5Wc_R_0Eiq9CKvKmJHaSkO7IBOsyinQSw3KVXtiWirwTY9Fxb-7NkZTA9f5tox-W7c90d3JIHjXW_qRTc",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuCYeFyk5HUgZox96VMGMgZi3nK5MnT-JYFQgGOuBB8GdbJo11wjPJ8qrXd1zi49J5b8lln7PnHeI1pItEmPqZb0GxHhjS8bl9j5-7kammKir0BRWn3kTGkFgXGiOB1iHmlou7gy6e-hAXfFieVyigXPf8C6X76DHj1pxGj954l9WV8u8cNvnC-sJ8z8VIiKjTi0Qx3vgDIT-pDs8wkaHrnQKurMFpdc7jM7j8NUfoHM14QTP5ra9Dxl7sHfYUTvPABm_cMZSnEMUPU",
            ].map((image, index) => (
              <div key={image} className="group relative aspect-square overflow-hidden rounded-[22px]">
                <img alt={`Post ${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={image} />
                <div className="absolute inset-0 bg-[rgba(34,29,92,0.58)]" />
                <div className="absolute bottom-3 left-3 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                  {index + 54} likes
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </CampusShell>
  );
}
