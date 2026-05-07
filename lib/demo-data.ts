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
  avatar?: string;
  role?: string;
  unread?: number;
  typing?: boolean;
};

export type Message = {
  side: "left" | "right";
  text: string;
  time?: string;
  status?: string;
};

export type MessagesData = {
  conversations: Conversation[];
  messages: Message[];
};

export type ProfileData = {
  avatar: string;
  major: string;
  bio: string;
};

export const profileAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23e9e7f3'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23777d86'/%3E%3Cpath d='M24 116c6-27 22-41 40-41s34 14 40 41' fill='%23777d86'/%3E%3C/svg%3E";

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
      avatars: [profileAvatar, profileAvatar],
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
      avatars: [profileAvatar, profileAvatar],
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
      avatars: [profileAvatar, profileAvatar],
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
    {
      name: "Nisha Rao",
      preview: "I saved two passes. Can you reach by 6:30?",
      time: "Just now",
      active: true,
      avatar: profileAvatar,
      role: "Design Society",
      unread: 2,
      typing: true,
    },
    {
      name: "CSE Placement Prep",
      preview: "Mock interview room is booked for Thursday.",
      time: "12m ago",
      avatar: profileAvatar,
      role: "Group chat",
    },
    {
      name: "Karthik Menon",
      preview: "Sent the poster draft",
      time: "1h ago",
      avatar: profileAvatar,
      role: "Events Core",
    },
    {
      name: "Ananya Reddy",
      preview: "That design sprint was intense, but it landed well.",
      time: "Yesterday",
      avatar: profileAvatar,
      role: "Architecture Dept",
    },
  ],
  messages: [
    {
      side: "left",
      text: "Did you see the final lineup for the Bengaluru student fest? The indie stage starts right after the design showcase.",
      time: "5:42 PM",
    },
    {
      side: "right",
      text: "Yes. I can come after lab review. Is early access still open for campus pass holders?",
      time: "5:44 PM",
      status: "Seen",
    },
    {
      side: "left",
      text: "A few slots are left. I booked two because the QR check-in queue is usually painful after 7.",
      time: "5:45 PM",
    },
    {
      side: "right",
      text: "Perfect. Send the link and I will pay now.",
      time: "5:46 PM",
      status: "Seen",
    },
    {
      side: "left",
      text: "Sent. Also, bring your college ID. Security is checking it at the main gate.",
      time: "5:47 PM",
    },
  ],
};

export const fallbackProfile: ProfileData = {
  avatar: profileAvatar,
  major: "Computer Science & Product Design, Bengaluru",
  bio: "New to Campus Nexus.",
};
