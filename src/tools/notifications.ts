import { graphql } from "../auth.js";

const GET_NOTIFICATIONS = `
  query GetNotifications {
    notifications {
      id
      type
      message
      is_read
      created_at
      actor {
        id
        username
        profile {
          thumbnail
        }
      }
      post {
        id
        title
        url_slug
        user {
          username
        }
      }
    }
  }
`;

const READ_NOTIFICATIONS = `
  mutation ReadNotifications {
    readNotifications {
      id
    }
  }
`;

type NotificationItem = {
  id: string;
  type: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  actor: {
    id: string;
    username: string;
    profile: { thumbnail: string | null };
  } | null;
  post: {
    id: string;
    title: string;
    url_slug: string;
    user: { username: string };
  } | null;
};

export async function getNotifications(params: {
  mark_as_read?: boolean;
}): Promise<{
  unread_count: number;
  notifications: {
    id: string;
    type: string;
    message: string | null;
    is_read: boolean;
    created_at: string;
    actor_username: string | null;
    post_title: string | null;
    post_url: string | null;
  }[];
}> {
  const { data } = await graphql<{ notifications: NotificationItem[] }>(
    GET_NOTIFICATIONS,
  );
  const items = data.notifications ?? [];

  if (params.mark_as_read && items.some((n: NotificationItem) => !n.is_read)) {
    await graphql(READ_NOTIFICATIONS).catch(() => null);
  }

  const notifications = items.map((n: NotificationItem) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    is_read: n.is_read,
    created_at: n.created_at,
    actor_username: n.actor?.username ?? null,
    post_title: n.post?.title ?? null,
    post_url: n.post
      ? `https://velog.io/@${n.post.user.username}/${n.post.url_slug}`
      : null,
  }));

  return {
    unread_count: notifications.filter((n: { is_read: boolean }) => !n.is_read)
      .length,
    notifications,
  };
}
