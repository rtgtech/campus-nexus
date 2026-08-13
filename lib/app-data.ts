export type FeedCard = {
  postId?: string;
  authorId?: string;
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
  mediaUrls?: string[];
  likes: string | number;
  shares?: number;
  comments: string | number;
  hashtags?: string[];
  mentions?: string[];
  price?: string | null;
  description?: string | null;
  createdAt?: string;
  likedByCurrentUser?: boolean;
  viewerHasLiked?: boolean;
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
  userId: string;
  name: string;
  username: string;
  email: string;
  dateOfBirth: string;
  yearOfStudy: number;
  department: string;
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
  followers?: number;
  postsCount?: number;
  category?: string;
  memberCount?: number;
  membersCount?: number;
  establishedYear?: number | string;
  eventsHosted?: number;
  activityRank?: number | string;
  recruitingDeadline?: string;
  latestPost?: {
    title?: string;
    body?: string;
    caption?: string;
    createdAt?: string;
  };
  mutualFollowers?: number;
};

export type ClubMember = {
  id: number;
  clubId: number;
  userId: string;
  title: string;
  createdAt: string;
  name: string;
  username: string;
  email: string;
  initials: string;
  canPost: boolean;
  canCreateAnnouncement: boolean;
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
  followers?: number;
  postsCount?: number;
  events?: ClubEvent[];
};

export type ClubEvent = {
  id?: string | number;
  title: string;
  startsAt?: string;
  location?: string;
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
  userId: string;
  totalXp: number;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  totalPlayers?: number;
  generatedAt?: string;
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
  id?: string;
  postId?: string;
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
  followers: 0,
  postsCount: 0,
};

export const fallbackGames: GamesData = {
  gameCards: [],
  topRated: [],
  recentActivity: [],
};

export const fallbackLeaderboard: LeaderboardData = {
  entries: [],
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
