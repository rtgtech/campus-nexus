DROP CONSTRAINT campus_user_id IF EXISTS;
DROP CONSTRAINT campus_club_id IF EXISTS;

MATCH (user:User)
WHERE user.user_id IS NOT NULL
SET user.userId = coalesce(user.userId, user.user_id)
REMOVE user.user_id;

MATCH (club:Club)
WHERE club.club_id IS NOT NULL
SET club.clubId = coalesce(club.clubId, club.club_id)
REMOVE club.club_id;

MATCH ()-[friendship:FRIENDS_WITH]->()
SET friendship.friendshipId = coalesce(friendship.friendshipId, friendship.friendship_id),
    friendship.createdAt = coalesce(friendship.createdAt, friendship.created_at)
REMOVE friendship.friendship_id, friendship.created_at;

MATCH ()-[related:RELATED_TO]->()
SET related.isMember = coalesce(related.isMember, related.is_member),
    related.isFollower = coalesce(related.isFollower, related.is_follower)
REMOVE related.is_member, related.is_follower;

MATCH (graph:GraphMetadata)
SET graph.bootstrappedAt = coalesce(graph.bootstrappedAt, graph.bootstrapped_at),
    graph.updatedAt = coalesce(graph.updatedAt, graph.updated_at),
    graph.schemaVersion = 2
REMOVE graph.bootstrapped_at, graph.updated_at, graph.schema_version;

CREATE CONSTRAINT campus_user_id IF NOT EXISTS
FOR (user:User) REQUIRE user.userId IS UNIQUE;

CREATE CONSTRAINT campus_club_id IF NOT EXISTS
FOR (club:Club) REQUIRE club.clubId IS UNIQUE;
