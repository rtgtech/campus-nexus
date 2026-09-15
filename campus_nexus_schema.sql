-- Campus Nexus authoritative SQLite schema

-- Generated from backend/schema_app.py; contains structure only.

PRAGMA foreign_keys=ON;


CREATE TABLE badges (
	"badgeId" VARCHAR(80) NOT NULL,
	name VARCHAR(120) NOT NULL,
	icon VARCHAR(80) NOT NULL,
	description TEXT,
	"isActive" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("badgeId")
);

CREATE TABLE campus_events (
	"eventId" INTEGER NOT NULL,
	title VARCHAR(160) NOT NULL,
	link VARCHAR(2048) NOT NULL,
	"eventType" VARCHAR(32) NOT NULL,
	"eventDate" DATE NOT NULL,
	place VARCHAR(200) NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("eventId"),
	CONSTRAINT ck_campus_events_type CHECK ("eventType" IN ('Competition', 'Workshop', 'Alumni Talk'))
);

CREATE TABLE clubs (
	"clubId" INTEGER NOT NULL,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	description TEXT,
	"logoUrl" TEXT,
	status TEXT NOT NULL,
	"createdByService" TEXT,
	"isActive" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("clubId"),
	UNIQUE (name)
);

CREATE UNIQUE INDEX ix_clubs_slug ON clubs (slug);

CREATE TABLE games (
	"gameId" INTEGER NOT NULL,
	name TEXT NOT NULL,
	description TEXT,
	"startDate" DATETIME,
	"endDate" DATETIME,
	"isActive" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("gameId")
);

CREATE TABLE signal_bar_items (
	"signalBarItemId" INTEGER NOT NULL,
	title VARCHAR(160) NOT NULL,
	link VARCHAR(2048) NOT NULL,
	position INTEGER NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("signalBarItemId"),
	CONSTRAINT uq_signal_bar_items_position UNIQUE (position)
);

CREATE TABLE users (
	"userId" INTEGER NOT NULL,
	"fullName" TEXT NOT NULL,
	username TEXT NOT NULL,
	email TEXT NOT NULL,
	"passwordHash" TEXT NOT NULL,
	"accountRole" TEXT NOT NULL,
	"dateOfBirth" DATE,
	department TEXT,
	semester INTEGER,
	"batchYear" INTEGER,
	bio TEXT,
	"profilePhotoUrl" TEXT,
	"profileVisibility" TEXT NOT NULL,
	"notificationsEnabled" BOOLEAN NOT NULL,
	"lastActiveAt" DATETIME,
	"reputationScore" FLOAT NOT NULL,
	"safetyScore" FLOAT NOT NULL,
	"isActive" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("userId"),
	CONSTRAINT ck_users_year CHECK (semester IS NULL OR semester BETWEEN 1 AND 4),
	CONSTRAINT ck_users_department CHECK (department IS NULL OR department IN ('CS', 'Mech', 'ECE', 'Electrical', 'AIML', 'Information Science'))
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE UNIQUE INDEX ix_users_username ON users (username);

CREATE TABLE club_followers (
	"clubId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("clubId", "userId"),
	FOREIGN KEY("clubId") REFERENCES clubs ("clubId") ON DELETE CASCADE,
	FOREIGN KEY("userId") REFERENCES users ("userId")
);

CREATE TABLE club_members (
	"clubMemberId" INTEGER NOT NULL,
	"clubId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	role TEXT NOT NULL,
	"canPost" BOOLEAN NOT NULL,
	"canPublishEvent" BOOLEAN NOT NULL,
	"canCreateAnnouncement" BOOLEAN NOT NULL,
	"canManageMembers" BOOLEAN NOT NULL,
	status TEXT NOT NULL,
	"addedByService" TEXT,
	"joinedAt" DATETIME NOT NULL,
	PRIMARY KEY ("clubMemberId"),
	CONSTRAINT uq_club_members_club_user UNIQUE ("clubId", "userId"),
	FOREIGN KEY("clubId") REFERENCES clubs ("clubId") ON DELETE CASCADE,
	FOREIGN KEY("userId") REFERENCES users ("userId")
);

CREATE INDEX "ix_club_members_clubId" ON club_members ("clubId");

CREATE INDEX "ix_club_members_userId" ON club_members ("userId");

CREATE TABLE friendships (
	"friendshipId" INTEGER NOT NULL,
	"requesterId" INTEGER NOT NULL,
	"receiverId" INTEGER NOT NULL,
	status TEXT NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("friendshipId"),
	CONSTRAINT ck_friendships_canonical_pair CHECK ("requesterId" < "receiverId"),
	CONSTRAINT uq_friendships_requester_receiver UNIQUE ("requesterId", "receiverId"),
	FOREIGN KEY("requesterId") REFERENCES users ("userId"),
	FOREIGN KEY("receiverId") REFERENCES users ("userId")
);

CREATE INDEX "ix_friendships_receiverId" ON friendships ("receiverId");

CREATE INDEX "ix_friendships_requesterId" ON friendships ("requesterId");

CREATE TABLE marketplace_items (
	"itemId" INTEGER NOT NULL,
	"sellerId" INTEGER NOT NULL,
	title TEXT NOT NULL,
	description TEXT,
	category TEXT,
	price NUMERIC(12, 2),
	"imageUrl" TEXT,
	status TEXT NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("itemId"),
	FOREIGN KEY("sellerId") REFERENCES users ("userId")
);

CREATE INDEX "ix_marketplace_items_sellerId" ON marketplace_items ("sellerId");

CREATE TABLE notifications (
	"notificationId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	"actorId" INTEGER NOT NULL,
	type TEXT NOT NULL,
	"targetType" TEXT NOT NULL,
	"targetId" TEXT NOT NULL,
	message TEXT NOT NULL,
	"isRead" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("notificationId"),
	FOREIGN KEY("userId") REFERENCES users ("userId"),
	FOREIGN KEY("actorId") REFERENCES users ("userId")
);

CREATE INDEX "ix_notifications_actorId" ON notifications ("actorId");

CREATE INDEX ix_notifications_type ON notifications (type);

CREATE INDEX "ix_notifications_userId" ON notifications ("userId");

CREATE TABLE posts (
	"postId" INTEGER NOT NULL,
	"authorId" INTEGER NOT NULL,
	"clubId" INTEGER,
	"postType" TEXT NOT NULL,
	content TEXT,
	"mediaUrl" TEXT,
	"mediaType" TEXT,
	"originalPostId" INTEGER,
	visibility TEXT NOT NULL,
	"eventTitle" TEXT,
	"eventStartTime" DATETIME,
	"eventEndTime" DATETIME,
	"eventLocation" TEXT,
	"registrationLink" TEXT,
	"likeCount" INTEGER NOT NULL,
	"commentCount" INTEGER NOT NULL,
	"shareCount" INTEGER NOT NULL,
	"bookmarkCount" INTEGER NOT NULL,
	"repostCount" INTEGER NOT NULL,
	"reportCount" INTEGER NOT NULL,
	"engagementScore" FLOAT NOT NULL,
	"isDeleted" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("postId"),
	FOREIGN KEY("authorId") REFERENCES users ("userId"),
	FOREIGN KEY("clubId") REFERENCES clubs ("clubId") ON DELETE SET NULL,
	FOREIGN KEY("originalPostId") REFERENCES posts ("postId")
);

CREATE INDEX "ix_posts_authorId" ON posts ("authorId");

CREATE INDEX "ix_posts_clubId" ON posts ("clubId");

CREATE TABLE user_badges (
	"userId" INTEGER NOT NULL,
	"badgeId" VARCHAR(80) NOT NULL,
	"earnedAt" DATETIME NOT NULL,
	PRIMARY KEY ("userId", "badgeId"),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE,
	FOREIGN KEY("badgeId") REFERENCES badges ("badgeId") ON DELETE CASCADE
);

CREATE TABLE user_interests (
	"userId" INTEGER NOT NULL,
	interest VARCHAR(80) NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("userId", interest),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE user_points (
	"pointId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	"gameId" INTEGER,
	points INTEGER NOT NULL,
	reason TEXT,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("pointId"),
	FOREIGN KEY("userId") REFERENCES users ("userId"),
	FOREIGN KEY("gameId") REFERENCES games ("gameId")
);

CREATE INDEX "ix_user_points_userId" ON user_points ("userId");

CREATE TABLE user_preferences (
	"userId" INTEGER NOT NULL,
	"notifyOfficial" BOOLEAN NOT NULL,
	"notifyDepartment" BOOLEAN NOT NULL,
	"notifyClub" BOOLEAN NOT NULL,
	"notifyStudent" BOOLEAN NOT NULL,
	"notifyExternal" BOOLEAN NOT NULL,
	"profileVisibility" VARCHAR(16) NOT NULL,
	"eventHistoryVisibility" VARCHAR(16) NOT NULL,
	"marketplaceActivityVisibility" VARCHAR(16) NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("userId"),
	CONSTRAINT ck_user_preferences_profile_visibility CHECK ("profileVisibility" IN ('private', 'friends', 'campus')),
	CONSTRAINT ck_user_preferences_event_visibility CHECK ("eventHistoryVisibility" IN ('private', 'friends', 'campus')),
	CONSTRAINT ck_user_preferences_marketplace_visibility CHECK ("marketplaceActivityVisibility" IN ('private', 'friends', 'campus')),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE chat_threads (
	"threadId" INTEGER NOT NULL,
	"threadType" TEXT NOT NULL,
	"clubId" INTEGER,
	"marketplaceItemId" INTEGER,
	"directKey" VARCHAR(64),
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("threadId"),
	FOREIGN KEY("clubId") REFERENCES clubs ("clubId") ON DELETE SET NULL,
	FOREIGN KEY("marketplaceItemId") REFERENCES marketplace_items ("itemId") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "ix_chat_threads_directKey" ON chat_threads ("directKey");

CREATE TABLE comments (
	"commentId" INTEGER NOT NULL,
	"postId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	content TEXT NOT NULL,
	"isDeleted" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("commentId"),
	FOREIGN KEY("postId") REFERENCES posts ("postId"),
	FOREIGN KEY("userId") REFERENCES users ("userId")
);

CREATE INDEX "ix_comments_postId" ON comments ("postId");

CREATE INDEX "ix_comments_userId" ON comments ("userId");

CREATE TABLE marketplace_trades (
	"tradeId" INTEGER NOT NULL,
	"itemId" INTEGER NOT NULL,
	"sellerId" INTEGER NOT NULL,
	"buyerId" INTEGER NOT NULL,
	status VARCHAR(16) NOT NULL,
	"completedAt" DATETIME,
	"createdAt" DATETIME NOT NULL,
	"updatedAt" DATETIME NOT NULL,
	PRIMARY KEY ("tradeId"),
	CONSTRAINT ck_marketplace_trades_status CHECK (status IN ('pending', 'completed', 'cancelled')),
	CONSTRAINT ck_marketplace_trades_distinct_users CHECK ("sellerId" <> "buyerId"),
	UNIQUE ("itemId"),
	FOREIGN KEY("itemId") REFERENCES marketplace_items ("itemId") ON DELETE CASCADE,
	FOREIGN KEY("sellerId") REFERENCES users ("userId") ON DELETE CASCADE,
	FOREIGN KEY("buyerId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE INDEX "ix_marketplace_trades_buyerId" ON marketplace_trades ("buyerId");

CREATE INDEX "ix_marketplace_trades_sellerId" ON marketplace_trades ("sellerId");

CREATE TABLE post_bookmarks (
	"postId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("postId", "userId"),
	FOREIGN KEY("postId") REFERENCES posts ("postId") ON DELETE CASCADE,
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE post_likes (
	"postId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("postId", "userId"),
	FOREIGN KEY("postId") REFERENCES posts ("postId"),
	FOREIGN KEY("userId") REFERENCES users ("userId")
);

CREATE TABLE post_media (
	"mediaId" INTEGER NOT NULL,
	"postId" INTEGER NOT NULL,
	"mediaUrl" TEXT NOT NULL,
	"mediaType" TEXT NOT NULL,
	"sortOrder" INTEGER NOT NULL,
	PRIMARY KEY ("mediaId"),
	FOREIGN KEY("postId") REFERENCES posts ("postId") ON DELETE CASCADE
);

CREATE INDEX "ix_post_media_postId" ON post_media ("postId");

CREATE TABLE chat_messages (
	"messageId" INTEGER NOT NULL,
	"threadId" INTEGER NOT NULL,
	"senderId" INTEGER NOT NULL,
	content TEXT,
	"isDeleted" BOOLEAN NOT NULL,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("messageId"),
	FOREIGN KEY("threadId") REFERENCES chat_threads ("threadId") ON DELETE CASCADE,
	FOREIGN KEY("senderId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE INDEX "ix_chat_messages_threadId" ON chat_messages ("threadId");

CREATE TABLE chat_participants (
	"threadId" INTEGER NOT NULL,
	"userId" INTEGER NOT NULL,
	"joinedAt" DATETIME NOT NULL,
	"lastReadAt" DATETIME,
	PRIMARY KEY ("threadId", "userId"),
	FOREIGN KEY("threadId") REFERENCES chat_threads ("threadId") ON DELETE CASCADE,
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE marketplace_reviews (
	"reviewId" INTEGER NOT NULL,
	"tradeId" INTEGER NOT NULL,
	"reviewerId" INTEGER NOT NULL,
	"revieweeId" INTEGER NOT NULL,
	rating INTEGER NOT NULL,
	comment TEXT,
	"createdAt" DATETIME NOT NULL,
	PRIMARY KEY ("reviewId"),
	CONSTRAINT uq_marketplace_reviews_trade_reviewer UNIQUE ("tradeId", "reviewerId"),
	CONSTRAINT ck_marketplace_reviews_rating CHECK (rating BETWEEN 1 AND 5),
	CONSTRAINT ck_marketplace_reviews_distinct_users CHECK ("reviewerId" <> "revieweeId"),
	FOREIGN KEY("tradeId") REFERENCES marketplace_trades ("tradeId") ON DELETE CASCADE,
	FOREIGN KEY("reviewerId") REFERENCES users ("userId") ON DELETE CASCADE,
	FOREIGN KEY("revieweeId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE INDEX "ix_marketplace_reviews_revieweeId" ON marketplace_reviews ("revieweeId");

CREATE INDEX "ix_marketplace_reviews_tradeId" ON marketplace_reviews ("tradeId");

CREATE TABLE feed_affinities (
	"userId" INTEGER NOT NULL,
	target VARCHAR(100) NOT NULL,
	day VARCHAR(10) NOT NULL,
	weight FLOAT NOT NULL,
	PRIMARY KEY ("userId", target, day),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE feed_exclusions (
	"userId" INTEGER NOT NULL,
	target VARCHAR(100) NOT NULL,
	PRIMARY KEY ("userId", target),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE feed_settings (
	"userId" INTEGER NOT NULL,
	enabled BOOLEAN NOT NULL,
	"historyResetAt" DATETIME,
	PRIMARY KEY ("userId"),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE TABLE feed_snapshots (
	id VARCHAR(64) NOT NULL,
	"userId" INTEGER,
	mode VARCHAR(20) NOT NULL,
	version VARCHAR(20) NOT NULL,
	records TEXT NOT NULL,
	"createdAt" DATETIME NOT NULL,
	"expiresAt" DATETIME NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE
);

CREATE INDEX "ix_feed_snapshots_expiresAt" ON feed_snapshots ("expiresAt");

CREATE INDEX "ix_feed_snapshots_userId" ON feed_snapshots ("userId");

CREATE TABLE feed_events (
	"userId" INTEGER NOT NULL,
	"postId" INTEGER NOT NULL,
	kind VARCHAR(20) NOT NULL,
	day VARCHAR(10) NOT NULL,
	"createdAt" DATETIME NOT NULL,
	duration INTEGER NOT NULL,
	version VARCHAR(20) NOT NULL,
	position INTEGER,
	PRIMARY KEY ("userId", "postId", kind, day),
	FOREIGN KEY("userId") REFERENCES users ("userId") ON DELETE CASCADE,
	FOREIGN KEY("postId") REFERENCES posts ("postId") ON DELETE CASCADE
);

CREATE INDEX "ix_feed_events_createdAt" ON feed_events ("createdAt");

CREATE INDEX ix_posts_feed_order ON posts ("createdAt", "postId");
CREATE INDEX ix_feed_affinities_day ON feed_affinities (day);
