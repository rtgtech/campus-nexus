export type FeedCard = {
  post_id?: string;
  author_id?: string;
  authorId?: string;
  club_id?: number | null;
  clubId?: number | null;
  clubSlug?: string | null;
  author: string;
  meta: string;
  title: string;
  body: string;
  image: string;
  tag: string;
  caption?: string;
  type?: 0 | 1 | 2 | 3;
  mediaUrl?: string;
  likes: string | number;
  shares?: number;
  comments: string | number;
  hashtags?: string[];
  mentions?: string[];
  price?: string | null;
  description?: string | null;
  createdAt?: string;
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

export type CampusUser = {
  user_id: string;
  userId: string;
  id: string;
  name: string;
  username: string;
  mail: string;
  email: string;
  DOB: string;
  dateOfBirth: string;
  year: number;
  yearOfStudy: number;
  department: string;
  acronym: string;
  initials: string;
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
  id?: number;
  title: string;
  slug: string;
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

export type ClubMember = {
  id: number;
  club_id: number;
  clubId: number;
  user_id: string;
  userId: string;
  title: string;
  createdAt: string;
  name: string;
  username: string;
  mail: string;
  initials: string;
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

export type ClubDetailData = {
  club: ClubCard;
  members: ClubMember[];
  posts: FeedCard[];
};

export type GameCard = {
  id?: number;
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

export type LeaderboardEntry = {
  rank: number;
  acronym: string;
  name: string;
  user_id: string;
  userId: string;
  totalXp: number;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
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

export type MarketplaceItem = {
  title: string;
  owner: string;
  mode: string;
  category: string;
  condition: string;
  price: string;
  location: string;
  description: string;
  image: string;
  tags: string[];
  contact: string;
  preferredExchange: string;
  createdAt: string;
};

export type MarketplaceData = {
  items: MarketplaceItem[];
};

export type ProfileData = {
  avatar?: string;
  major: string;
  bio: string;
};

export const profileAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23e9e7f3'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23777d86'/%3E%3Cpath d='M24 116c6-27 22-41 40-41s34 14 40 41' fill='%23777d86'/%3E%3C/svg%3E";

export function getInitials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "CN";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const fallbackFeed: FeedData = {
  feedCards: [],
  trending: [],
  suggestedPeople: [],
};

export const fallbackClubs: ClubsData = {
  spotlightClubs: [],
  clubCards: [],
  stats: [],
};

export const fallbackClubDetail: ClubDetailData = {
  club: {
    title: "",
    slug: "",
    description: "",
    status: "",
    icon: "groups",
    iconBg: "bg-primary",
    bannerBg: "bg-primary-fixed/20",
    bannerImage: "",
    extraMembers: "0",
    extraMembersClass: "bg-primary-container text-white",
    avatars: [],
    statusClass: "text-secondary",
  },
  members: [],
  posts: [],
};

export const fallbackGames: GamesData = {
  gameCards: [],
  topRated: [],
  recentActivity: [],
};

export const fallbackLeaderboard: LeaderboardData = {
  entries: [
    {
      rank: 1,
      acronym: "RZ",
      name: "Rumaan Zameer",
      user_id: "usr_rumaan_zameer",
      userId: "usr_rumaan_zameer",
      totalXp: 12840,
    },
    {
      rank: 2,
      acronym: "AP",
      name: "Aarav Patel",
      user_id: "usr_aarav_patel",
      userId: "usr_aarav_patel",
      totalXp: 11620,
    },
    {
      rank: 3,
      acronym: "NS",
      name: "Nisha Sharma",
      user_id: "usr_nisha_sharma",
      userId: "usr_nisha_sharma",
      totalXp: 10910,
    },
    {
      rank: 4,
      acronym: "KV",
      name: "Kabir Verma",
      user_id: "usr_kabir_verma",
      userId: "usr_kabir_verma",
      totalXp: 9425,
    },
    {
      rank: 5,
      acronym: "MS",
      name: "Meera Srinivasan",
      user_id: "usr_meera_srinivasan",
      userId: "usr_meera_srinivasan",
      totalXp: 8810,
    },
  ],
};

export const fallbackMessages: MessagesData = {
  conversations: [],
  messages: [],
};

export const fallbackMarketplace: MarketplaceData = {
  items: [],
};

export const fallbackProfile: ProfileData = {
  major: "",
  bio: "",
};
