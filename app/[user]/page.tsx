import { CampusShell, SectionTitle } from "@/components/campus-shell";
import { EmptyState } from "@/components/empty-state";
import { getCampusData } from "@/lib/campus-api";
import { fallbackProfile, type ProfileData } from "@/lib/app-data";

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
  const displayName = formatName(user) || "Profile";
  const profile = await getCampusData<ProfileData>(`/api/profile/${encodeURIComponent(user)}`, fallbackProfile);

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
              <h1 className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight text-primary">{displayName}</h1>
              <p className="mt-3 text-lg text-on-surface-variant">{profile.major}</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">{profile.bio}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary">Edit Profile</button>
                <button className="rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface">
                  Share
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-outline-variant/60 bg-white p-6 shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
          <SectionTitle
            title="Posts"
            description="Posts for this profile will appear here."
          />
          <div className="mt-6">
            <EmptyState title="No posts yet" description="Profile posts will appear here when real content exists." />
          </div>
        </section>
      </div>
    </CampusShell>
  );
}
