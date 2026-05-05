export type FeedCard = {
  author: string;
  meta: string;
  title: string;
  body: string;
  image: string;
  tag: string;
  likes: string;
  comments: string;
};

export type TrendingItem = {
  label: string;
  tag: string;
  posts: string;
};

export type SuggestedPerson = {
  name: string;
  subtitle: string;
};

export type FeedData = {
  feedCards: FeedCard[];
  trending: TrendingItem[];
  suggestedPeople: SuggestedPerson[];
};

export type SpotlightClub = {
  badge: string;
  badgeFill: boolean;
  badgeClass: string;
  title: string;
  description: string;
  image: string;
  icon: string;
};

export type ClubCard = {
  title: string;
  description: string;
  status: string;
  icon: string;
  iconBg: string;
  bannerBg: string;
  bannerImage: string;
  extraMembers: string;
  extraMembersClass: string;
  avatars: string[];
  statusClass: string;
};

export type StatCard = {
  value: string;
  label: string;
  className: string;
  valueClass: string;
  labelClass: string;
};

export type ClubsData = {
  spotlightClubs: SpotlightClub[];
  clubCards: ClubCard[];
  stats: StatCard[];
};

export type GameCard = {
  title: string;
  image: string;
  online: string;
  rating: string;
};

export type TopRatedGame = {
  rank: string;
  title: string;
  subtitle: string;
  rating: string;
  badge: string;
  image: string;
  badgeClass: string;
};

export type RecentActivity = {
  title: string;
  subtitle: string;
  image: string;
};

export type GamesData = {
  gameCards: GameCard[];
  topRated: TopRatedGame[];
  recentActivity: RecentActivity[];
};

export type Conversation = {
  name: string;
  preview: string;
  time: string;
  active?: boolean;
};

export type Message = {
  side: "left" | "right";
  text: string;
};

export type MessagesData = {
  conversations: Conversation[];
  messages: Message[];
};

export type ProfileData = {
  avatar: string;
  major: string;
  badge: string;
  stats: Array<[string, string]>;
  postImages: string[];
};

export const profileAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDhDngMlYP4ueK1rG1n1YglyuSuKmiLwNG-IGppRVpb797E97d8FUPIs9VEvE16hsybk3Go6-T8GzOncJaTXlY7nPGsXxcTwHia2E_rH8uTXkZ9OSVohLz1qh9lf4sUWuSK4ytQiKdt8RKntmeCaNpWLo5qWyFIqjpC-erm324XgHDySw1tTQ4ATzhfggXDZ9l_FDNRcSZdQRAGSx2aQ6L08XDaDfkQk7PS5sxXWJBKvGGozrB47Ad76HIhmV3Ob2nr0kHSPiUWWDA";

export const fallbackFeed: FeedData = {
  feedCards: [
    {
      author: "Ananya Reddy",
      meta: "2h ago • Architecture Dept",
      title: "Rainy Bengaluru morning, full studio energy.",
      body: "The design block lit up after the drizzle, so we stayed back to pin up prototypes and turn critique hour into a mini showcase.",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDDbsQFosHW6vZSMffXbQjy-PzN-BoaByAnK_Sl_YFURfiMtKtThcON-b8DL2IDTKvMvU2NSqBHTN4XsURfSGSR8GYCacBCydrBdvSTc7o23v0F6RGvbsURQm5wt8ucXJM6CoPUd2hDx0Iwox_MfNZ85RjfPkecyZKOLXF9C_gJPF8v1hUdOF8eYEtpR2VYogWMBuM-2uovf2-Y8g_3OU5CBblw-bVGxFqGe9LMS1UeaRklI_oARDPiX34Z5Qk1F55QLV7lTJS87k0",
      tag: "#bengalurudesign",
      likes: "1.2k",
      comments: "42",
    },
    {
      author: "Rohit Nair",
      meta: "5h ago • Sports Club",
      title: "Golden hour after practice in Bengaluru.",
      body: "Placements are close, but the floodlights, chai break, and one last net session made the evening feel worth slowing down for.",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBwzpgmmiYF6RpJki5O0MBK3WD9yR4DhZsm4Fz7u0d1P203pGFKhis03MIUEN38icmvVItSo9XQhl9GGTMq3TMnRYjn5ckju4V6uii53IkzkHsZbQb2zV9qpiL_Q5hFKqtr7Hq7_csF5O3aaIoVmPUAIFdTuEPGVzYDAv-hloE7Kd6EynVr09EimJqdGWXdk9WBuNQYAgHWK6dDpqbuebxRRHoOG6DQ340iObPfIi2edREqK5fLiSwN-3THx82p7S7oHUp2xiZiln8",
      tag: "#nammacampus",
      likes: "856",
      comments: "18",
    },
  ],
  trending: [
    { label: "Placements", tag: "#BengaluruHiring", posts: "126 posts today" },
    { label: "College Fest", tag: "#NammaUtsav", posts: "1.8k posts this week" },
  ],
  suggestedPeople: [
    { name: "Meera Iyer", subtitle: "Visual Communication" },
    { name: "Aditya Shetty", subtitle: "CSE • 2nd Year" },
    { name: "Sanjana Rao", subtitle: "Debate + Product" },
  ],
};

export const fallbackClubs: ClubsData = {
  spotlightClubs: [
    {
      badge: "Trending",
      badgeFill: true,
      badgeClass: "bg-secondary",
      title: "Bengaluru AI Collective",
      description: "Building practical AI projects, campus tools, and responsible automation.",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuB6gUvJTAIpwVMBX00dvhyPDuLb28fwbb_9D_py3kC_yYRDk1rlKioyZEST8bg59TxgdhzUHUwYRHxv5e7YvIGt7JAMWG1zQqWEhO_QU2qaVnnAxwrv6SWMZBiDOVHLtoU_4t75BsqQ_YIVav3jJSmgLSf_LQgcD7UpAt8Lrw7T8QpoYvsuifAYM27JpUyq4AAT1ewSEDRmXVg-ER5GhacBMp3ye2GzEPXqujtuEv2NdF4yX6D9y2JCmjaH_BYuCwp94IfV88U_JsA",
      icon: "bolt",
    },
    {
      badge: "Featured",
      badgeFill: false,
      badgeClass: "bg-primary-container",
      title: "Namma Creators Collective",
      description: "A collaboration hub for Bengaluru storytellers, filmmakers, and digital artists.",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAT_Vk-jXlajrhtywbAPlc92j2juwHwrgFArbzjs51cAB8nZ-Y_R-uYevZhe4n_9I4ssF_-ShnTi03D-v5knHJl_STP21NI4B3M1ddoY8Ofq9oY9K9v35FIsijDtjW97-UwDlbhsgWcAiG7thMnb5dMeEUTWrUDj0ynYxihwMTXX4kco5CDNrqHdmS9JzsxdFfmjjpgZQT5zDqbzJ5nXqevL15ICN4y4C-FKDo-yLinqSrsXCGau-c9buyFssKWEJaoPAPYzEfa43g",
      icon: "celebration",
    },
  ],
  clubCards: [
    {
      title: "Bengaluru Builders Guild",
      description:
        "A student builder community for hack nights, product sprints, and demo days across Bengaluru.",
      status: "5 active projects",
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
      title: "Cubbon Park Runners",
      description:
        "Weekend runs, conditioning meetups, and city race prep for students who like moving early.",
      status: "Run in 2h",
      icon: "directions_run",
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
      title: "Filter Coffee Collective",
      description:
        "Exploring Bengaluru cafes, dosa spots, and late-night student food trails every week.",
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
  ],
  stats: [
    {
      value: "124",
      label: "New Today",
      className: "rounded-[24px] border border-primary/10 bg-primary/5 p-6 text-center",
      valueClass: "text-display-lg font-display-lg text-primary",
      labelClass: "text-xs font-label-md uppercase tracking-widest text-primary/60",
    },
    {
      value: "2.8k",
      label: "City Clubs",
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
      className: "rounded-[24px] bg-primary p-6 text-center shadow-lg shadow-primary/20",
      valueClass: "text-display-lg font-display-lg text-white",
      labelClass: "text-xs font-label-md uppercase tracking-widest text-white/70",
    },
  ],
};

export const fallbackGames: GamesData = {
  gameCards: [
    {
      title: "Tower Stack",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBOOakKeb6IoVrU5kd864OVTeVipTVWOplb4rNtNfmXAlXersoymDg6E4aZEZ9fBXsjy0Xtx-4nEVkZGHzo4sJzG8l54_09_FzDOVBcsQNDY7eK4h_5-09Na0vqXzRFZZHJmPjsXE1Gjr5ZVUbscev9lrftNECvbxhgDiigWGsSiWY3OXm4xVGWHG9Ojn6OT0Ituus9sSdLzhKHhYo_CqePYLeQeB6DzXUS6tVWYB6GTgrab14ZXF8qFjq8Wio_sipiyB6yCtvrHlo",
      online: "1.2k Online",
      rating: "4.8",
    },
    {
      title: "Campus Quest",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCZgxMvce-RQKRBBOEP2fTZHMAYNZUDCigRuiqZisqy_mZn5SMMjAnIGkWK0TehBpLOrJVjPLoLQP6oiUFXWh3-QF_bnRn_0r6Ajrh2R-dFH60veIsu_9Vbo2O6nAKPl5a8BxQd72y3_4B1KlBws0HNbcfx1a8JgiEdKtOgatpMOJRoDdlAruaXYCYz6Odwm5iPpgyGlWNRJlXYGY5q7atjjP0kymYlMs8AxoA3uDhqltFjqtYiN4Q9PZxihcCwQpfIr1m0HpKVd4A",
      online: "840 Online",
      rating: "4.9",
    },
    {
      title: "Neon Pong",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDBng5saUttVc-mB6g9MGdxWLPLk9V4ym-2q2eG_q2vh_GagmQJrWD5iy0PE7VQh0JMlT5Z7jSBZTBUN0lQmZcnI6O5lHuyaDQJiUMV6g6d9ITaBVpGKYZEYH__daBqr9P2sd5nF0m-yfgUEXOrb8aG--6hOW-RcK4cYHI6LJgcZCPUAleB9V16LeBCvV1HP4-opT2l8f3j1ZW7D7_V3DFAAsXcPHAOHh1yA466Zl3rzVg2ouacbX_j0ZAA1U9-wO_gcssMyRpjdro",
      online: "3.5k Online",
      rating: "4.7",
    },
    {
      title: "Social Trivia",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBs2yaKtWs6uTt59SLpmArNvnvzTIVohN75iFaaBWWR09ojT210H7O1otZpqiYkoP_mP0fEpE7paQx9EtK4Dm_PFm-K5JVBOVtmyzVW8wGWUXRBpLdk_FH_xBsT6j41ZZKY5SobeyC0zlzsz-XqVrM_zSA1xdX5RORdEu5KHK59fGOBRBgde1E625zELBTY65vRzmhtoGSzlF8QkFaUmn6n-gi2uuljWuJ27hofVAdmhKHZxDem_-Ya8WTT7kU3REsYS4unc7M4I0A",
      online: "2.1k Online",
      rating: "4.6",
    },
  ],
  topRated: [
    {
      rank: "01",
      title: "Word Blitz",
      subtitle: "Action Puzzle • 12k plays",
      rating: "5.0",
      badge: "Trending",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBYVfjvZn9wm6xy8l3AYTZA4dUKQQ8CQlY4eZ3Nz1AoKXjEZdgF8oxFh5lWvDUg3lxBy3rFLboLP377J9E2P6t94vysLEfDR1ZS0kWa9JiHFTw996ZvTEwnguBgTexOSrNAjZVztuq8oIvoDPVYLkP4dC-oqvOP_rT896MNie6bsE74_JrDNeCyoY-LKkCfNyHsxwYF-IgV-KveD6hb98d7OKu9--hix6SxCVgZ_KQFLX5fjiM_NYgVTEX--8jN4xfNPAfYbmo0c9E",
      badgeClass: "text-secondary",
    },
    {
      rank: "02",
      title: "Campus Run",
      subtitle: "Endless Runner • 8.4k plays",
      rating: "4.9",
      badge: "Stable",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAQFBZmIV8jyjb0-LWpeHQDrTrHe1c8H8dWKHhEM_Qaa_cQvfrXIs8bz-N9VlTgyQPlUVJiUK0HwlroHyEnyWzjG0ExMa8vVoRXzMo2IXtHAaXRyW9TY1thuDxd7D7L0IBtseY77jl3nLPV0zjir7lnrSnDy2rUqAtKHjaEb_rJDctThbXQZ7yWKumlf6yY3wFVzvxJr6KTJeanX93hhauV2WHMT2LzkjymWVrgeGLBpSeyqg0o-GLoDqbFuivPZOm51E5U3AJJTLk",
      badgeClass: "text-outline",
    },
  ],
  recentActivity: [
    {
      title: "Cyber Drift",
      subtitle: "Last played 2h ago",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA5aMIC2BC_PNfU79OHfSgC7EMuHi3glbdRh5bh49TdcJVUXQ3TmYLpdlnXekg4pJcM5xHDK46cHTEObU9sy1qz425P9mPeUS3xWMoLEMFZH4GwPDoxB0TttqafCWCUz-2o_AW8ul2v72ZBqU8Z0ku7DheAzzYw9RRYK8MDmUtlQL1p9B2llZ6PhMbm11FpgvswQwzE23rRUtTh-olq_XUje06fQOmo5-GC5v1GWeD_oJwoncgjYs2iMLd_voBTzZmj53nxj1g-a3M",
    },
    {
      title: "Tower Stack",
      subtitle: "Last played Yesterday",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDJ65dK-WM3Vmo_XqC9ADeuv64W3y7gBM8k1AlDOdCXolMjNEOxAgI-t7vCgz9o0XUHm9kR7smm-us6YDfk_PE3zUkEFolJgG7atPv_ZhOr2JP6I8ZmzmeFOY_HR2pzmcaG3keXBBZFR6YvO2fi3VjiWJZY0ONs_oxwr8s6m-FypouOGkc3fAvNw-JMqYuRDqkpB-4XWzMUI5q9l1KOq641_Upc92f2Kmw-qjKCVGOsDGi-K8Eeag7ChHhdFGIsdHFZJuqQFkLvRN0",
    },
  ],
};

export const fallbackMessages: MessagesData = {
  conversations: [
    { name: "Nisha Rao", preview: "Are you going to the Indiranagar mixer tonight?", time: "Just now", active: true },
    { name: "CSE Placement Prep", preview: "Did anyone save the aptitude notes from...", time: "12m ago" },
    { name: "Karthik Menon", preview: "Sent a photo", time: "1h ago" },
    { name: "Ananya Reddy", preview: "That design sprint was intense, but it landed well.", time: "Yesterday" },
  ],
  messages: [
    { side: "left", text: "Did you see the lineup for the Bengaluru student fest? The main stage set looks solid." },
    { side: "right", text: "Yes. I am going if early access is still open for campus pass holders." },
    { side: "left", text: "A few slots are left. I booked mine already, and the poster drop looks great too." },
    { side: "right", text: "Send the link. I do not want to miss this one." },
  ],
};

export const fallbackProfile: ProfileData = {
  avatar: profileAvatar,
  major: "Computer Science & Product Design, Bengaluru",
  badge: "Senior",
  stats: [
    ["42", "Posts"],
    ["892", "Friends"],
    ["2.4k", "Nexus Score"],
  ],
  postImages: [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC8C_RuYjQtvq8vWOiPC31iK9YmUALvdAYd9OXqdJsWGOD-U93opfFPBsgt371HwB-2r35WH_A4NHnEaNRSRjQ2Wce2h6CDMQ1cTwhttvzs4IndZUr7y8P3U-h10GWlvAFwVrB-C8-JcbfvPBK7X34gpxJkZHJWYgM1fhSFAF8RobAhL-tkShKrfFltWndo5uSyOUW7ErqbxNQAjxQvdbsTnmvA0wiVPs5tqwUACswtLYp4H5I5aAQvr_WweccPC8WLZATJifBfovQ",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCIofFh-dajUK-0sl5sUHIQJQYuTDk_bPQg3YnL3F7cYXHgMiWVovzm-mWnekRobEBqRL9dsLlpc1ao3Swhe8-6kdhpC6bliKbI4cqY9q6SbHkcTvYbU6NnkEwS2G808QCyzWfZVN02kMr6FSpw0m98dUXacurlAj7MbYJwok2o7TyQglNc0_hw-JiJC0Kf8KcWwUtqwgWxY27f154FydHRNeRQWuRIVrD4j7YnHi7LnzCHRtk4x7m-s6yGAQg9dDgWjFPyLhUrEsM",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCnysQcbBBZIvPHRbREH7eBhJDH9lDE-HPdLqBu-20t8WVaKhobI29o8PQ7JkyuD-UtpojVZLngf3IAz8HVEoNysbjR1WFfFn1EGHZGpLj0vi0fWspKb0daq5Vxu984gEJtaYCQyLVyCU__YjNwp8Jc8KlNEEUmzz85KdrXaUeXdzqVjKG9ejDb1KmlajLl-H0_nk-8idU5lv6SXMPaHZhrFoUzvX1CwSqEEdxATsdDUDTwunsp3saT06HMVY0JNyWagJgj-YbJSPA",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCvAZU8JA3PN0Kqdin3dnLpkKWC6IjvWzOOkWGuPueQEESdcf32NejvlG35DzbYs1REgQgArjOfwLqSkTt9yjYVg-mCkbRqB90Xv4LjORLInUQPRYBjNa_6zUxcaFTkpUGik3h18ARG0SEByh2U6aGB6j949BdmJ3Orl40VYnyrPAMNbfvpdkG4fSema84XY850PRumsTU3IMkEEyKwXuul285txDUbFpW5RauNGSR9MzSsLyy1oPxrscSTI_IuZLiOI2TaZyH1GoI",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAnpk4Tjh3saj1ncoN4r62vzqR84MocbQma9zPNZuGP8k7PTayFJi1e1rLtN2PRh6Y06vQ-GwqPAhSYjEkhA8Sy0WxLxF_7ZA4yuOMiPUFkYQQR3rAvv-k4_PqzRzvulCrfet3A-517TWyt-c00xMz1UWzUewuQ2tVE5nM5CeXbhETZeDvzvQlrAtH-ju5Wc_R_0Eiq9CKvKmJHaSkO7IBOsyinQSw3KVXtiWirwTY9Fxb-7NkZTA9f5tox-W7c90d3JIHjXW_qRTc",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCYeFyk5HUgZox96VMGMgZi3nK5MnT-JYFQgGOuBB8GdbJo11wjPJ8qrXd1zi49J5b8lln7PnHeI1pItEmPqZb0GxHhjS8bl9j5-7kammKir0BRWn3kTGkFgXGiOB1iHmlou7gy6e-hAXfFieVyigXPf8C6X76DHj1pxGj954l9WV8u8cNvnC-sJ8z8VIiKjTi0Qx3vgDIT-pDs8wkaHrnQKurMFpdc7jM7j8NUfoHM14QTP5ra9Dxl7sHfYUTvPABm_cMZSnEMUPU",
  ],
};
