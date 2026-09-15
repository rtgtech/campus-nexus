import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bookmark, CalendarDays, Check, Circle, CircleAlert, Gamepad2, Grid2X2, Heart, ImagePlus, LogIn, LogOut, MessageCircle, Plus, Search, Send, ShoppingBag, Tag, Timer, Trash2, Trophy, User, Users, X, type LucideProps } from "lucide-react";

const icons = {
  add: Plus, add_photo_alternate: ImagePlus, add_shopping_cart: ShoppingBag,
  apps: Grid2X2, grid_view: Grid2X2, arrow_back: ArrowLeft, arrow_forward: ArrowRight,
  arrow_outward: ArrowUpRight, close: X, delete: Trash2, error: CircleAlert,
  favorite: Heart, favorite_border: Heart, forum: MessageCircle, groups: Users,
  how_to_reg: Check, leaderboard: Trophy, workspace_premium: Trophy, emoji_events: Trophy,
  login: LogIn, logout: LogOut, notifications: Bell, person: User, search: Search,
  sell: Tag, send: Send, timer: Timer, storefront: ShoppingBag, bookmark: Bookmark,
  bookmark_add: Bookmark, event: CalendarDays, sports_esports: Gamepad2,
  verified: Check, check: Check, check_circle: Check, person_add: Plus,
  play_arrow: ArrowRight,
};

export function CampusIcon({ name, ...props }: LucideProps & { name: string }) {
  const Icon = icons[name as keyof typeof icons] ?? Circle;
  return <Icon size="1.25em" aria-hidden="true" {...props} />;
}
