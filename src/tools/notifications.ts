import { graphql } from "../auth.js";

const GET_NOTIFICATION_COUNT = `
  query GetNotificationCount {
    notificationCount
  }
`;

export async function getNotifications(_params: {
  mark_as_read?: boolean;
}): Promise<{
  unread_count: number;
  note: string;
}> {
  const { data } = await graphql<{ notificationCount: number }>(
    GET_NOTIFICATION_COUNT,
  );
  return {
    unread_count: data.notificationCount ?? 0,
    note: "Velog v2 API는 읽지 않은 알림 개수만 제공합니다. 개별 알림 목록은 API에서 지원되지 않습니다.",
  };
}
