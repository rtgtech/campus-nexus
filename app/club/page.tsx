import { SourceBottomNav } from "@/components/source-bottom-nav";

const spotlightClubs = [
  {
    badge: "Trending",
    badgeFill: true,
    badgeClass: "bg-secondary",
    title: "Nexus AI Guild",
    description: "Building the future of campus automation and ethical AI.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB6gUvJTAIpwVMBX00dvhyPDuLb28fwbb_9D_py3kC_yYRDk1rlKioyZEST8bg59TxgdhzUHUwYRHxv5e7YvIGt7JAMWG1zQqWEhO_QU2qaVnnAxwrv6SWMZBiDOVHLtoU_4t75BsqQ_YIVav3jJSmgLSf_LQgcD7UpAt8Lrw7T8QpoYvsuifAYM27JpUyq4AAT1ewSEDRmXVg-ER5GhacBMp3ye2GzEPXqujtuEv2NdF4yX6D9y2JCmjaH_BYuCwp94IfV88U_JsA",
    icon: "bolt",
  },
  {
    badge: "Featured",
    badgeFill: false,
    badgeClass: "bg-primary-container",
    title: "Social Creators Collective",
    description: "Collaboration hub for digital artists and content makers.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAT_Vk-jXlajrhtywbAPlc92j2juwHwrgFArbzjs51cAB8nZ-Y_R-uYevZhe4n_9I4ssF_-ShnTi03D-v5knHJl_STP21NI4B3M1ddoY8Ofq9oY9K9v35FIsijDtjW97-UwDlbhsgWcAiG7thMnb5dMeEUTWrUDj0ynYxihwMTXX4kco5CDNrqHdmS9JzsxdFfmjjpgZQT5zDqbzJ5nXqevL15ICN4y4C-FKDo-yLinqSrsXCGau-c9buyFssKWEJaoPAPYzEfa43g",
    icon: "celebration",
  },
];

const clubCards = [
  {
    title: "Developer Circle",
    description:
      "Join the campus's largest community of builders and dreamers. Open to all skill levels.",
    status: "3 active projects",
    icon: "code",
    iconBg: "bg-primary",
    bannerBg: "bg-primary-fixed/20",
    bannerImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAw_Xv8hWpdYy2fAJ8I9evq8nybROQu14uCFeF7BZRZuOu0aVWOfVVcm2Z25TCZ7oGpOu_74XA8B5IvD31ynPpEdOMtxTy84zaPXwQkb7dsSgCMWdZtkiVoxdXAutvyPhdG7Jln2u7w3njLVqnhqEA0BhzXr5NxVBgRrhGbn6Lz_Q2gR5XfP9HvrAEuvSP_BzfVuIobWR_T_1XqkvX5yzQqQ-D715QeEUmsoOb-ieoHsfSOv2mIq6O3xyiWnrMnEMQFw1X9HbxMhEI",
    extraMembers: "+1.2k",
    extraMembersClass: "bg-primary-container text-white",
    avatars: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC-WwTQCkdpE0iRPPcHwXqTcfyY5Fs4C77N68viBF8Oh_U3gwrUxFJjkNUOfoIyPa-Xsbn47ai65k9a9bGuEWuoJSZuSaABD1tm4HQs4m2P1HaGhoouZ81g9VYawm3wErdQz3O6cRD7ULxEx9jW95lBa6WRk8MFRgjbZbX6gWqqu7g-XnMRobP9NdI52YflGaDNALe0CDMCZJwrc67RiYMShHLA8KbwR3sqIXB2ngTOdmy3VlE5EUkZt2cUX4HdGnIGjgPYA2otnpU",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCCuIJA5ggaPFPILr85vI1UxbcaJxdmT783QwQqMNcf_lAHIBxmlOd3Pp9QYlm9SxQCb5ie3OHUZ2mS_ogeWK-WqwOdWlr83JJu_3nUSQMiLsZHHtfamEulI2n-k64pu9c3U5ag21KejUqn3twGYQK57iT-whIiQ8ECjIHm8pZ4APnUjz8HEPNVG7EP3NrXbIgjOhWbNLLsa1huxv_2pj_uJXmIMc5Oap_b4m-GLaC2Kh951hGPf6gB8_9zeUQ3Br2NzSBEC85jzto",
    ],
    statusClass: "text-secondary",
  },
  {
    title: "Courtside Kings",
    description:
      "Daily pick-up games and weekly tournaments for competitive spirits. All are welcome.",
    status: "Game in 2h",
    icon: "sports_basketball",
    iconBg: "bg-secondary",
    bannerBg: "bg-secondary-container/10",
    bannerImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCdOP8TLnf3ouBPsjSs_ssVQvpZ0RWrdFweagLGii4RfNUPToIewrWD2nkZZehZUYmJGgn961LgOT2ZKH9zzzwRXE5mN6wioVnUk-VIiiZExNKWh16XBSophAyCApQvsIsa2vTM9UqG8b6ILhJY9-biJqBMd5masncgCLEjBpoCaAh3BV-85hE4_ZkD0MkBOR_A3lU_1SfyV7etCc0lR8HDovh1dURUHyk78jRIAYH6m8_sVH4-tgVlYQytEQ_NAdgvp7tf07-VD-k",
    extraMembers: "842",
    extraMembersClass: "bg-surface-container-high text-on-surface",
    avatars: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCi5BHyp_Dx_6JrJzUhJEY1pD1KrCNv2RzVc5gumYRc_MqNrhENi6dvdY_dZADNDn8aFEdQ938R5ENzfkmtvb5-w-anifDkcdsnssoAmBU_ZXi4FFhcw9QGxEEKLQIQ6_mmTKO-en1XKmgHXKU-7xefNx0XtLXrFRv1AJb9NaC1RFxs4y2AznWHJkDhD2EURJxB_4CdcMVLqFTmLRmJ-fC3aIjqqjaEMYd5wh2byKhjApJ4paNjbTbV0vr3eH8BsgH3Nem6dkAEv9g",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB7oIXwv6wjOlinwSUS6NpnKl2GI_s8542tQyjITWzfyufDIz4C-ODW47TnBN6xjTGgp74tUOSHJJM0SbZtjBlccobH6116onPuPS4HVTrV7umZUhLRVfDxO58GjcwG--mnHAvR2rqpE_K4AbNGDuI0BTgfGS2ssgtBM8KBeDhV-HELU41xQKw-17ZxmHV55CiIdTJAAcm3fBjjRfDyad8peDUiyRKOaXCBQZ9TPXdy86T9TLAn99G6jjnWMrgU7XUl5OFpFQTKuxw",
    ],
    statusClass: "text-secondary",
  },
  {
    title: "Foodie Explorers",
    description:
      "Discovering the best bites around campus and hosting monthly themed dinners.",
    status: "Active daily",
    icon: "restaurant",
    iconBg: "bg-tertiary",
    bannerBg: "bg-tertiary-fixed/20",
    bannerImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuArlOY04LgVaqnmSR9kzO_5AuMuxKl05_CI7NUqYv3sae_w0ppAi9P8D_xHCxxfpLrrAlsJzYYorWFIAa1mPvCX_-9TmNDymjb2tDEzjHEKMeU_Z-YJb4r7dCIZkLKUkmQ5jZuBoyNt08Dq5icFQ9dz_dkpyjVLqiwMUF2OnNqpAxvytTRsLzOBjqsS2NJ6SbilxGX9vzzSluX0SDG9afZcC6t_HYE2oXWbLlv1qQ4LB6_gzTbfjWndvFGhR6tCcplV-nqYCsDbTYI",
    extraMembers: "4.5k",
    extraMembersClass: "bg-tertiary-fixed text-on-tertiary-fixed",
    avatars: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDFLcHDna3_Iq8jhDipMSzFJNI4MaUaXAjvOFk40XPqSvN5bgmhtKnRaZd4Dp7ptION_116QgMT5iPPv1TXxnMGQS6R8PwP4n9qBGWQ9FejW39xoHtCUXIP22ckN-XNWT5LIoLRa0i6LH989C4Q5YLvjiDi6rCi7ucB49EQSuF6kvwc72ZEV-ZLvT_T6rgRd-Lv_ok1XQfLTx4EDFeybyuwYGzF12DUL7t4T3d6CFzf9Eb5HLUGDw82GnRUGhzZh_A6xjbiz70DG7E",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBiCpijwoFnWVx3RMsVOwTvNvSZ7bCuHoNzDk43W9VmrBDFZBTfrn75ypTMO8Uwz7kiKHlH9aZvIvvM_ZmVzkzZ3NBA5Hrleuh9fVhZU1gRaNuFFvIzPTRHWpMf4vBFj2tF34SwGY_h5KGiuI2jHwd0RIZFDASa0_mbYnjsQp2Z-PuJci_EtOdDH7R7UbS8Ifz2O_OVlfi9BVZv-szFYxdirMDtGP_WN3_RMTkCl1qW9IT8wzRm67r8OYRxIpUYASrLD6WRTaCirKk",
    ],
    statusClass: "text-on-surface-variant",
  },
];

const stats = [
  {
    value: "124",
    label: "New Today",
    className:
      "rounded-[24px] border border-primary/10 bg-primary/5 p-6 text-center",
    valueClass: "text-display-lg font-display-lg text-primary",
    labelClass: "text-xs font-label-md uppercase tracking-widest text-primary/60",
  },
  {
    value: "2.8k",
    label: "Total Clubs",
    className:
      "rounded-[24px] border border-surface-container-highest bg-white p-6 text-center shadow-sm",
    valueClass: "text-display-lg font-display-lg text-secondary",
    labelClass: "text-xs font-label-md uppercase tracking-widest text-on-surface-variant",
  },
  {
    value: "15k",
    label: "Members",
    className:
      "rounded-[24px] border border-surface-container-highest bg-white p-6 text-center shadow-sm",
    valueClass: "text-display-lg font-display-lg text-tertiary",
    labelClass: "text-xs font-label-md uppercase tracking-widest text-on-surface-variant",
  },
  {
    value: "42",
    label: "Live Now",
    className:
      "rounded-[24px] bg-primary p-6 text-center shadow-lg shadow-primary/20",
    valueClass: "text-display-lg font-display-lg text-white",
    labelClass: "text-xs font-label-md uppercase tracking-widest text-white/70",
  },
];

export default function ClubPage() {
  return (
    <>
      <div className="min-h-screen bg-background pb-32 font-body-md text-on-background">
        <header className="fixed top-0 z-50 w-full border-b border-surface-container-highest bg-white/95 shadow-sm backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <span className="font-headline-lg text-2xl font-black tracking-tighter text-primary">
                Campus Nexus
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 md:flex">
                <span className="material-symbols-outlined text-xl text-outline">search</span>
                <input
                  className="w-64 border-none bg-transparent text-sm font-label-md focus:ring-0"
                  placeholder="Search clubs..."
                  type="text"
                />
              </div>
              <button className="material-symbols-outlined rounded-full p-2 text-primary transition-all duration-200 ease-out hover:bg-surface-container active:scale-95">
                notifications
              </button>
              <button className="material-symbols-outlined rounded-full p-2 text-secondary transition-all duration-200 ease-out hover:bg-secondary/10 active:scale-95">
                bolt
              </button>
              <div className="pulse-indicator h-10 w-10 overflow-hidden rounded-full border-2 border-primary">
                <img
                  alt="User avatar"
                  className="h-full w-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7NNioyD9stdKaYKBRFm6-N5pPXieBsUKPE8pOBaz5GtOkCQ3_SXsv8IhCqxoWr5uuQA2RtRqmlVkpNVlfAt5i_LROSbPfiN1ZQqoi4b21z-CeWoORPQLuucKGTMtI4j2PacnOU7oYn_aqb-pt8s5oeFGjYEZmOwHdlzsJqb5M-rgBLh4ZU_XhqvhbHcyNSHUq9eKwqQDxJEl_HYFdz77wyIDADnMvjSLIGV9fskCbZLGyMWHzQPtbsEmRbWssrb1Vau7GPwakXf0"
                />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-16 px-5 pt-24">
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-background">Spotlight Clubs</h2>
                <p className="font-body-md text-on-surface-variant">Rising stars of the campus community</p>
              </div>
              <div className="flex gap-2">
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            <div className="flex snap-x gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {spotlightClubs.map((club) => (
                <div
                  key={club.title}
                  className="group relative aspect-[16/9] min-w-[320px] snap-start cursor-pointer overflow-hidden rounded-[24px] shadow-xl md:min-w-[450px]"
                >
                  <img
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    src={club.image}
                  />
                  <div className="absolute inset-0 bg-primary/65" />
                  <div className="absolute bottom-0 left-0 p-6 text-white">
                    <span className={`mb-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-white ${club.badgeClass} ${club.badge === "Trending" ? "animate-pulse" : ""}`}>
                      <span
                        className="material-symbols-outlined text-xs"
                        style={club.badgeFill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      >
                        {club.icon}
                      </span>
                      {club.badge}
                    </span>
                    <h3 className="mb-1 font-headline-md text-headline-md">{club.title}</h3>
                    <p className="line-clamp-1 font-body-md opacity-80">{club.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {["All Clubs", "Academic", "Social", "Sports", "Hobby", "Wellness"].map((tab, index) => (
                <button
                  key={tab}
                  className={
                    index === 0
                      ? "flex-shrink-0 rounded-full bg-primary px-6 py-3 font-label-md text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
                      : "flex-shrink-0 rounded-full border border-surface-container-highest bg-white px-6 py-3 font-label-md text-primary transition-all hover:bg-surface-container-low active:scale-95"
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clubCards.map((card) => (
                <div
                  key={card.title}
                  className="group overflow-hidden rounded-[28px] border border-surface-container-highest bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
                >
                  <div className={`relative h-32 overflow-hidden ${card.bannerBg}`}>
                    <img
                      className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                      src={card.bannerImage}
                    />
                  </div>
                  <div className="space-y-6 p-6">
                    <div className="flex items-start justify-between">
                      <div className={`relative z-10 -mt-12 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white shadow-md ${card.iconBg}`}>
                        <span className="material-symbols-outlined text-3xl text-white">{card.icon}</span>
                      </div>
                      <button className="rounded-xl bg-surface-container-low p-2 text-primary transition-all hover:bg-primary hover:text-white">
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                    <div>
                      <h4 className="font-headline-md text-on-background">{card.title}</h4>
                      <p className="mt-1 line-clamp-2 text-sm font-body-md text-on-surface-variant">
                        {card.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-container-highest pt-3">
                      <div className="flex -space-x-2">
                        {card.avatars.map((avatar) => (
                          <img
                            key={avatar}
                            alt="Member avatar"
                            className="h-8 w-8 rounded-full border-2 border-white"
                            src={avatar}
                          />
                        ))}
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold ${card.extraMembersClass}`}>
                          {card.extraMembers}
                        </div>
                      </div>
                      <span className={`text-xs font-label-md uppercase tracking-tight ${card.statusClass}`}>
                        {card.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className={stat.className}>
                <span className={stat.valueClass}>{stat.value}</span>
                <span className={stat.labelClass}>{stat.label}</span>
              </div>
            ))}
          </section>
        </main>

        <button className="group fixed bottom-24 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-2xl transition-all hover:scale-110 active:scale-90">
          <span className="material-symbols-outlined text-3xl">group_add</span>
          <span className="absolute right-full mr-4 whitespace-nowrap rounded-2xl bg-primary px-4 py-2 text-sm font-label-md text-white opacity-0 transition-opacity group-hover:opacity-100">
            Create Club
          </span>
        </button>
      </div>

      <SourceBottomNav active="club" variant="club" />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .glass-card {
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
            }

            .pulse-indicator {
              position: relative;
            }

            .pulse-indicator::after {
              content: "";
              position: absolute;
              top: 0;
              right: 0;
              width: 10px;
              height: 10px;
              background-color: #EC2024;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 8px rgba(236, 32, 36, 0.5);
            }

            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }

            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `,
        }}
      />
    </>
  );
}
