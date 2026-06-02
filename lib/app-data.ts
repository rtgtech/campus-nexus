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
  avatar: string;
  major: string;
  bio: string;
};

export const profileAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23e9e7f3'/%3E%3Ccircle cx='64' cy='48' r='24' fill='%23777d86'/%3E%3Cpath d='M24 116c6-27 22-41 40-41s34 14 40 41' fill='%23777d86'/%3E%3C/svg%3E";

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

export const fallbackGames: GamesData = {
  gameCards: [],
  topRated: [],
  recentActivity: [],
};

export const fallbackMessages: MessagesData = {
  conversations: [],
  messages: [],
};

export const fallbackMarketplace: MarketplaceData = {
  items: [],
};

export const fallbackProfile: ProfileData = {
  avatar: profileAvatar,
  major: "",
  bio: "",
};
