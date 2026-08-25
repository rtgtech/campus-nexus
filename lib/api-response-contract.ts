import responseFields from "@/lib/api-response-fields.json";

export type ApiEntityName = keyof typeof responseFields;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertApiEntity(
  value: unknown,
  entityName: ApiEntityName,
  location: string = entityName,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${location} must be an object`);
  }

  const contract = responseFields[entityName];
  const known = new Set<string>([...contract.required, ...contract.optional]);
  const missing = contract.required.filter((field) => !(field in value));
  const unknown = Object.keys(value).filter((field) => !known.has(field));

  if (missing.length > 0 || unknown.length > 0) {
    const details = [
      missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
      unknown.length > 0 ? `unknown: ${unknown.join(", ")}` : "",
    ].filter(Boolean).join("; ");
    throw new Error(`${location} does not match ${entityName} (${details})`);
  }
}

function assertArrayEntities(value: unknown, entityName: ApiEntityName, location: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array`);
  }
  value.forEach((item, index) => assertApiEntity(item, entityName, `${location}[${index}]`));
}

function assertFeedRanking(value: unknown, location: string) {
  assertApiEntity(value, "FeedCard", location);
  const card = value as Record<string, unknown>;
  if (typeof card.feedScore !== "number" || !Number.isFinite(card.feedScore)) {
    throw new Error(`${location}.feedScore must be a finite number`);
  }
  const signals = assertRoot(
    card.rankingSignals,
    ["pagerank", "engagement", "recency", "social"],
    [],
    `${location}.rankingSignals`,
  );
  for (const key of ["pagerank", "engagement", "recency", "social"] as const) {
    if (typeof signals[key] !== "number" || !Number.isFinite(signals[key])) {
      throw new Error(`${location}.rankingSignals.${key} must be a finite number`);
    }
  }
}

function assertRoot(value: unknown, required: string[], optional: string[] = [], location = "response") {
  if (!isRecord(value)) {
    throw new Error(`${location} must be an object`);
  }
  const known = new Set([...required, ...optional]);
  const missing = required.filter((field) => !(field in value));
  const unknown = Object.keys(value).filter((field) => !known.has(field));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `${location} fields do not match (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`,
    );
  }
  return value;
}

function validateClubCardNestedUser(value: unknown, location: string) {
  assertApiEntity(value, "ClubMember", location);
  const member = value as Record<string, unknown>;
  if (member.user !== null) {
    assertApiEntity(member.user, "CampusUser", `${location}.user`);
  }
}

function validateProfileOverview(value: unknown) {
  const root = assertRoot(
    value,
    ["user", "profile", "stats", "friendsPreview", "mutualFriendsPreview", "badges", "clubs", "marketplace"],
    ["preferences"],
  );
  assertApiEntity(root.user, "CampusUser", "response.user");
  assertApiEntity(root.profile, "ProfileData", "response.profile");
  assertRoot(root.stats, ["friends", "mutualFriends", "rank", "totalXp"], [], "response.stats");
  assertArrayEntities(root.friendsPreview, "ProfileFriend", "response.friendsPreview");
  assertArrayEntities(root.mutualFriendsPreview, "ProfileFriend", "response.mutualFriendsPreview");
  assertArrayEntities(root.badges, "ProfileBadge", "response.badges");

  const clubs = assertRoot(root.clubs, ["memberOf", "following", "followingVisible"], [], "response.clubs");
  if (!Array.isArray(clubs.memberOf)) {
    throw new Error("response.clubs.memberOf must be an array");
  }
  clubs.memberOf.forEach((summary, index) => {
    const item = assertRoot(summary, ["club", "membership"], [], `response.clubs.memberOf[${index}]`);
    assertApiEntity(item.club, "ClubCard", `response.clubs.memberOf[${index}].club`);
    validateClubCardNestedUser(item.membership, `response.clubs.memberOf[${index}].membership`);
  });
  assertArrayEntities(clubs.following, "ClubCard", "response.clubs.following");

  const marketplace = assertRoot(
    root.marketplace,
    ["activeListings", "sellerId", "sellerRating", "sellerRatingCount", "successfulTrades"],
    [],
    "response.marketplace",
  );
  assertArrayEntities(marketplace.activeListings, "MarketplaceItem", "response.marketplace.activeListings");

  if (root.preferences !== undefined) {
    const preferences = assertRoot(root.preferences, ["notificationSources", "privacy"], [], "response.preferences");
    assertRoot(
      preferences.notificationSources,
      ["official", "department", "club", "student", "external"],
      [],
      "response.preferences.notificationSources",
    );
    assertRoot(
      preferences.privacy,
      ["profileVisibility", "eventHistoryVisibility", "marketplaceActivityVisibility"],
      [],
      "response.preferences.privacy",
    );
  }
}

export function validateApiResponse(path: string, value: unknown): void {
  const pathOnly = path.split("?", 1)[0];

  if (pathOnly === "/api/feed") {
    const root = assertRoot(value, ["feedCards", "trending", "suggestedPeople"]);
    if (!Array.isArray(root.feedCards)) {
      throw new Error("response.feedCards must be an array");
    }
    root.feedCards.forEach((card, index) => assertFeedRanking(card, `response.feedCards[${index}]`));
    return;
  }
  if (pathOnly === "/api/signal-bar" || /^\/api\/signal-bar\/\d+$/.test(pathOnly)) {
    if (isRecord(value) && "items" in value) {
      const root = assertRoot(value, ["items", "total"]);
      assertArrayEntities(root.items, "SignalBarItem", "response.items");
    } else {
      assertApiEntity(value, "SignalBarItem", "response");
    }
    return;
  }
  if (pathOnly === "/api/events" || /^\/api\/events\/\d+$/.test(pathOnly)) {
    if (isRecord(value) && "items" in value) {
      const root = assertRoot(value, ["items", "total"]);
      assertArrayEntities(root.items, "CampusEvent", "response.items");
    } else {
      assertApiEntity(value, "CampusEvent", "response");
    }
    return;
  }
  if (pathOnly === "/api/clubs") {
    const root = assertRoot(value, ["spotlightClubs", "clubCards", "stats"]);
    assertArrayEntities(root.clubCards, "ClubCard", "response.clubCards");
    return;
  }
  if (pathOnly === "/api/clubs/items") {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "ClubCard", "response");
    } else {
      assertApiEntity(value, "ClubCard", "response");
    }
    return;
  }
  if (/^\/api\/clubs\/items\/\d+$/.test(pathOnly)) {
    assertApiEntity(value, "ClubCard", "response");
    return;
  }
  if (/^\/api\/clubs\/[^/]+\/members(?:\/\d+)?$/.test(pathOnly)) {
    if (Array.isArray(value)) {
      value.forEach((member, index) => validateClubCardNestedUser(member, `response[${index}]`));
    } else {
      validateClubCardNestedUser(value, "response");
    }
    return;
  }
  if (/^\/api\/clubs\/[^/]+$/.test(pathOnly)) {
    const root = assertRoot(value, ["club", "members", "posts", "followers", "postsCount"]);
    assertApiEntity(root.club, "ClubCard", "response.club");
    if (!Array.isArray(root.members)) {
      throw new Error("response.members must be an array");
    }
    root.members.forEach((member, index) => validateClubCardNestedUser(member, `response.members[${index}]`));
    assertArrayEntities(root.posts, "FeedCard", "response.posts");
    return;
  }
  if (pathOnly === "/api/games") {
    const root = assertRoot(value, ["gameCards", "topRated", "recentActivity"]);
    assertArrayEntities(root.gameCards, "GameCard", "response.gameCards");
    return;
  }
  if (pathOnly === "/api/games/leaderboards") {
    const root = assertRoot(value, ["entries", "totalPlayers", "generatedAt"]);
    assertArrayEntities(root.entries, "LeaderboardEntry", "response.entries");
    return;
  }
  if (pathOnly === "/api/games/items" || /^\/api\/games\/items\/\d+$/.test(pathOnly)) {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "GameCard", "response");
    } else {
      assertApiEntity(value, "GameCard", "response");
    }
    return;
  }
  if (pathOnly === "/api/games/xp") {
    assertRoot(value, ["userId", "awardedXp", "totalXp"]);
    return;
  }
  if (pathOnly === "/api/marketplace") {
    const root = assertRoot(value, ["items"], ["sellerSummary"]);
    assertArrayEntities(root.items, "MarketplaceItem", "response.items");
    if (root.sellerSummary !== undefined) {
      assertApiEntity(root.sellerSummary, "MarketplaceSellerSummary", "response.sellerSummary");
    }
    return;
  }
  if (pathOnly === "/api/marketplace/items" || /^\/api\/marketplace\/items\/\d+$/.test(pathOnly)) {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "MarketplaceItem", "response");
    } else {
      assertApiEntity(value, "MarketplaceItem", "response");
    }
    return;
  }
  if (pathOnly === "/api/messages") {
    const root = assertRoot(value, ["conversations", "messages"]);
    assertArrayEntities(root.conversations, "Conversation", "response.conversations");
    assertArrayEntities(root.messages, "Message", "response.messages");
    for (const [index, conversation] of (root.conversations as unknown[]).entries()) {
      const participants = (conversation as Record<string, unknown>).participants;
      assertArrayEntities(participants, "CampusUser", `response.conversations[${index}].participants`);
    }
    return;
  }
  if (pathOnly === "/api/messages/conversations" || /^\/api\/messages\/conversations\/\d+$/.test(pathOnly)) {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "Conversation", "response");
    } else {
      assertApiEntity(value, "Conversation", "response");
    }
    const conversations = Array.isArray(value) ? value : [value];
    conversations.forEach((conversation, index) => {
      assertArrayEntities(
        (conversation as Record<string, unknown>).participants,
        "CampusUser",
        `response[${index}].participants`,
      );
    });
    return;
  }
  if (pathOnly === "/api/messages/items" || /^\/api\/messages\/items\/\d+$/.test(pathOnly)) {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "Message", "response");
    } else {
      assertApiEntity(value, "Message", "response");
    }
    return;
  }
  if (/^\/api\/posts(?:\/\d+)?$/.test(pathOnly)) {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "FeedCard", "response");
    } else {
      assertApiEntity(value, "FeedCard", "response");
    }
    return;
  }
  if (/^\/api\/posts\/\d+\/like$/.test(pathOnly)) {
    const root = assertRoot(value, ["post", "postId", "likes", "liked", "likedByCurrentUser"]);
    assertApiEntity(root.post, "FeedCard", "response.post");
    return;
  }
  if (/^\/api\/posts\/\d+\/save$/.test(pathOnly)) {
    const root = assertRoot(
      value,
      ["post", "postId", "bookmarks", "saved", "savedByCurrentUser", "bookmarkedByCurrentUser"],
    );
    assertApiEntity(root.post, "FeedCard", "response.post");
    return;
  }
  if (pathOnly === "/api/saved-posts") {
    const root = assertRoot(value, ["items", "total"]);
    assertArrayEntities(root.items, "FeedCard", "response.items");
    return;
  }
  if (pathOnly === "/api/notifications") {
    const root = assertRoot(value, ["items", "total", "unreadCount"]);
    assertArrayEntities(root.items, "NotificationItem", "response.items");
    return;
  }
  if (pathOnly === "/api/search") {
    const root = assertRoot(value, ["query", "users", "clubs", "posts", "products"]);
    for (const key of ["users", "clubs", "posts", "products"] as const) {
      assertArrayEntities(root[key], "SearchItem", `response.${key}`);
    }
    return;
  }
  if (["/api/auth/me", "/api/auth/login", "/api/auth/signup"].includes(pathOnly)) {
    const root = assertRoot(value, ["user"]);
    assertApiEntity(root.user, "CampusUser", "response.user");
    return;
  }
  if (pathOnly === "/api/users") {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "CampusUser", "response");
    } else {
      assertApiEntity(value, "CampusUser", "response");
    }
    return;
  }
  if (/^\/api\/users\/[^/]+\/profile-overview$/.test(pathOnly)) {
    validateProfileOverview(value);
    return;
  }
  if (/^\/api\/users\/[^/]+\/friends$/.test(pathOnly)) {
    const root = assertRoot(value, ["isFriend", "isSelf", "friends", "friendship"], ["friendsList", "mutualsList"]);
    if (root.friendship !== null) {
      assertApiEntity(root.friendship, "FriendshipRecord", "response.friendship");
    }
    if (root.friendsList !== undefined) {
      assertArrayEntities(root.friendsList, "FriendshipUser", "response.friendsList");
    }
    if (root.mutualsList !== undefined) {
      assertArrayEntities(root.mutualsList, "FriendshipUser", "response.mutualsList");
    }
    return;
  }
  if (/^\/api\/users\/[^/]+\/preferences$/.test(pathOnly)) {
    const preferences = assertRoot(value, ["notificationSources", "privacy"]);
    assertRoot(
      preferences.notificationSources,
      ["official", "department", "club", "student", "external"],
      [],
      "response.notificationSources",
    );
    assertRoot(
      preferences.privacy,
      ["profileVisibility", "eventHistoryVisibility", "marketplaceActivityVisibility"],
      [],
      "response.privacy",
    );
    return;
  }
  if (/^\/api\/clubs\/[^/]+\/follow$/.test(pathOnly)) {
    assertApiEntity(value, "ClubFollowStatus", "response");
    return;
  }
  if (pathOnly === "/api/profiles") {
    if (Array.isArray(value)) {
      assertArrayEntities(value, "ProfileData", "response");
    } else {
      assertApiEntity(value, "ProfileData", "response");
    }
    return;
  }
  if (/^\/api\/profiles\/[^/]+$/.test(pathOnly) || /^\/api\/profile\/[^/]+$/.test(pathOnly)) {
    assertApiEntity(value, "ProfileData", "response");
    return;
  }
}

export function parseApiResponse<T>(path: string, value: unknown): T {
  validateApiResponse(path, value);
  return value as T;
}
