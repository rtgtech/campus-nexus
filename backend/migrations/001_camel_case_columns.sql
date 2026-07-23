BEGIN;

DO $$
DECLARE
    columnRename RECORD;
BEGIN
    FOR columnRename IN
        SELECT * FROM (VALUES
            ('users', 'user_id', 'userId'),
            ('users', 'full_name', 'fullName'),
            ('users', 'password_hash', 'passwordHash'),
            ('users', 'account_role', 'accountRole'),
            ('users', 'date_of_birth', 'dateOfBirth'),
            ('users', 'batch_year', 'batchYear'),
            ('users', 'profile_photo_url', 'profilePhotoUrl'),
            ('users', 'profile_visibility', 'profileVisibility'),
            ('users', 'notifications_enabled', 'notificationsEnabled'),
            ('users', 'reputation_score', 'reputationScore'),
            ('users', 'safety_score', 'safetyScore'),
            ('users', 'is_active', 'isActive'),
            ('users', 'created_at', 'createdAt'),
            ('users', 'updated_at', 'updatedAt'),
            ('auth_sessions', 'user_id', 'userId'),
            ('auth_sessions', 'created_at', 'createdAt'),
            ('friendships', 'friendship_id', 'friendshipId'),
            ('friendships', 'requester_id', 'requesterId'),
            ('friendships', 'receiver_id', 'receiverId'),
            ('friendships', 'created_at', 'createdAt'),
            ('friendships', 'updated_at', 'updatedAt'),
            ('user_blocks', 'blocker_id', 'blockerId'),
            ('user_blocks', 'blocked_id', 'blockedId'),
            ('user_blocks', 'created_at', 'createdAt'),
            ('reports', 'report_id', 'reportId'),
            ('reports', 'reporter_id', 'reporterId'),
            ('reports', 'target_type', 'targetType'),
            ('reports', 'target_id', 'targetId'),
            ('reports', 'reviewed_by', 'reviewedBy'),
            ('reports', 'reviewed_at', 'reviewedAt'),
            ('reports', 'created_at', 'createdAt'),
            ('clubs', 'club_id', 'clubId'),
            ('clubs', 'logo_url', 'logoUrl'),
            ('clubs', 'created_by_service', 'createdByService'),
            ('clubs', 'is_active', 'isActive'),
            ('clubs', 'created_at', 'createdAt'),
            ('clubs', 'updated_at', 'updatedAt'),
            ('club_members', 'club_member_id', 'clubMemberId'),
            ('club_members', 'club_id', 'clubId'),
            ('club_members', 'user_id', 'userId'),
            ('club_members', 'can_post', 'canPost'),
            ('club_members', 'can_publish_event', 'canPublishEvent'),
            ('club_members', 'can_create_announcement', 'canCreateAnnouncement'),
            ('club_members', 'can_manage_members', 'canManageMembers'),
            ('club_members', 'added_by_service', 'addedByService'),
            ('club_members', 'joined_at', 'joinedAt'),
            ('club_followers', 'club_id', 'clubId'),
            ('club_followers', 'user_id', 'userId'),
            ('club_followers', 'created_at', 'createdAt'),
            ('posts', 'post_id', 'postId'),
            ('posts', 'author_id', 'authorId'),
            ('posts', 'club_id', 'clubId'),
            ('posts', 'post_type', 'postType'),
            ('posts', 'media_url', 'mediaUrl'),
            ('posts', 'media_type', 'mediaType'),
            ('posts', 'original_post_id', 'originalPostId'),
            ('posts', 'event_title', 'eventTitle'),
            ('posts', 'event_start_time', 'eventStartTime'),
            ('posts', 'event_end_time', 'eventEndTime'),
            ('posts', 'event_location', 'eventLocation'),
            ('posts', 'registration_link', 'registrationLink'),
            ('posts', 'like_count', 'likeCount'),
            ('posts', 'comment_count', 'commentCount'),
            ('posts', 'share_count', 'shareCount'),
            ('posts', 'bookmark_count', 'bookmarkCount'),
            ('posts', 'repost_count', 'repostCount'),
            ('posts', 'report_count', 'reportCount'),
            ('posts', 'engagement_score', 'engagementScore'),
            ('posts', 'is_deleted', 'isDeleted'),
            ('posts', 'created_at', 'createdAt'),
            ('posts', 'updated_at', 'updatedAt'),
            ('post_media', 'media_id', 'mediaId'),
            ('post_media', 'post_id', 'postId'),
            ('post_media', 'media_url', 'mediaUrl'),
            ('post_media', 'media_type', 'mediaType'),
            ('post_media', 'sort_order', 'sortOrder'),
            ('comments', 'comment_id', 'commentId'),
            ('comments', 'post_id', 'postId'),
            ('comments', 'user_id', 'userId'),
            ('comments', 'is_deleted', 'isDeleted'),
            ('comments', 'created_at', 'createdAt'),
            ('comments', 'updated_at', 'updatedAt'),
            ('post_likes', 'post_id', 'postId'),
            ('post_likes', 'user_id', 'userId'),
            ('post_likes', 'created_at', 'createdAt'),
            ('post_bookmarks', 'post_id', 'postId'),
            ('post_bookmarks', 'user_id', 'userId'),
            ('post_bookmarks', 'created_at', 'createdAt'),
            ('post_shares', 'share_id', 'shareId'),
            ('post_shares', 'post_id', 'postId'),
            ('post_shares', 'user_id', 'userId'),
            ('post_shares', 'created_at', 'createdAt'),
            ('marketplace_items', 'item_id', 'itemId'),
            ('marketplace_items', 'seller_id', 'sellerId'),
            ('marketplace_items', 'image_url', 'imageUrl'),
            ('marketplace_items', 'created_at', 'createdAt'),
            ('marketplace_items', 'updated_at', 'updatedAt'),
            ('chat_threads', 'thread_id', 'threadId'),
            ('chat_threads', 'thread_type', 'threadType'),
            ('chat_threads', 'club_id', 'clubId'),
            ('chat_threads', 'marketplace_item_id', 'marketplaceItemId'),
            ('chat_threads', 'created_at', 'createdAt'),
            ('chat_participants', 'thread_id', 'threadId'),
            ('chat_participants', 'user_id', 'userId'),
            ('chat_participants', 'joined_at', 'joinedAt'),
            ('chat_participants', 'last_read_at', 'lastReadAt'),
            ('chat_messages', 'message_id', 'messageId'),
            ('chat_messages', 'thread_id', 'threadId'),
            ('chat_messages', 'sender_id', 'senderId'),
            ('chat_messages', 'is_deleted', 'isDeleted'),
            ('chat_messages', 'created_at', 'createdAt'),
            ('games', 'game_id', 'gameId'),
            ('games', 'start_date', 'startDate'),
            ('games', 'end_date', 'endDate'),
            ('games', 'is_active', 'isActive'),
            ('games', 'created_at', 'createdAt'),
            ('user_points', 'point_id', 'pointId'),
            ('user_points', 'user_id', 'userId'),
            ('user_points', 'game_id', 'gameId'),
            ('user_points', 'created_at', 'createdAt'),
            ('notifications', 'notification_id', 'notificationId'),
            ('notifications', 'user_id', 'userId'),
            ('notifications', 'actor_id', 'actorId'),
            ('notifications', 'target_type', 'targetType'),
            ('notifications', 'target_id', 'targetId'),
            ('notifications', 'is_read', 'isRead'),
            ('notifications', 'created_at', 'createdAt'),
            ('interaction_events', 'event_id', 'eventId'),
            ('interaction_events', 'actor_id', 'actorId'),
            ('interaction_events', 'target_user_id', 'targetUserId'),
            ('interaction_events', 'target_type', 'targetType'),
            ('interaction_events', 'target_id', 'targetId'),
            ('interaction_events', 'event_type', 'eventType'),
            ('interaction_events', 'created_at', 'createdAt'),
            ('user_trust_scores', 'viewer_id', 'viewerId'),
            ('user_trust_scores', 'target_user_id', 'targetUserId'),
            ('user_trust_scores', 'friendship_score', 'friendshipScore'),
            ('user_trust_scores', 'club_score', 'clubScore'),
            ('user_trust_scores', 'interaction_score', 'interactionScore'),
            ('user_trust_scores', 'final_trust_score', 'finalTrustScore'),
            ('user_trust_scores', 'updated_at', 'updatedAt'),
            ('admin_logs', 'log_id', 'logId'),
            ('admin_logs', 'admin_actor', 'adminActor'),
            ('admin_logs', 'action_type', 'actionType'),
            ('admin_logs', 'target_type', 'targetType'),
            ('admin_logs', 'target_id', 'targetId'),
            ('admin_logs', 'created_at', 'createdAt')
        ) AS columns(tableName, oldName, newName)
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = columnRename.tableName
              AND column_name = columnRename.oldName
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I RENAME COLUMN %I TO %I',
                columnRename.tableName,
                columnRename.oldName,
                columnRename.newName
            );
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION campus_nexus_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_increment_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET "likeCount" = "likeCount" + 1 WHERE "postId" = NEW."postId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_decrement_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET "likeCount" = GREATEST("likeCount" - 1, 0) WHERE "postId" = OLD."postId";
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_increment_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET "commentCount" = "commentCount" + 1 WHERE "postId" = NEW."postId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_increment_post_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET "bookmarkCount" = "bookmarkCount" + 1 WHERE "postId" = NEW."postId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_decrement_post_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET "bookmarkCount" = GREATEST("bookmarkCount" - 1, 0) WHERE "postId" = OLD."postId";
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_increment_post_share_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET "shareCount" = "shareCount" + 1 WHERE "postId" = NEW."postId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_increment_repost_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."postType" = 'repost' AND NEW."originalPostId" IS NOT NULL THEN
        UPDATE posts SET "repostCount" = "repostCount" + 1 WHERE "postId" = NEW."originalPostId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION campus_nexus_increment_report_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."targetType" = 'post' THEN
        UPDATE posts SET "reportCount" = "reportCount" + 1 WHERE "postId" = NEW."targetId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
