import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { getDemoData } from "@/lib/campus-api";
import { fallbackProfile, type ProfileData } from "@/lib/demo-data";

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
  const displayName = formatName(user) || "Aarav Rao";
  const profile = await getDemoData<ProfileData>(`/api/profile/${encodeURIComponent(user)}`, fallbackProfile);

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
                  src={profile.avatar}
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
                  {profile.badge}
                </span>
              </div>
              <p className="mt-3 text-lg text-on-surface-variant">{profile.major}</p>
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
          {profile.stats.map(([value, label], index) => (
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
            description="Snapshots, project drops, and student moments shared across Bengaluru campus life."
          />
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {profile.postImages.map((image, index) => (
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
