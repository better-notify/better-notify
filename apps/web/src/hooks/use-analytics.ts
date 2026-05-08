import { usePostHog } from '@posthog/react';

export type ActionTypes =
  | 'accept'
  | 'add'
  | 'cancel'
  | 'change'
  | 'click'
  | 'close'
  | 'collapse'
  | 'comment'
  | 'complete'
  | 'create'
  | 'delete'
  | 'deselect'
  | 'dislike'
  | 'downgrade'
  | 'error'
  | 'expand'
  | 'export'
  | 'fail'
  | 'filter'
  | 'finish'
  | 'flag'
  | 'follow'
  | 'invite'
  | 'like'
  | 'open'
  | 'pause'
  | 'play'
  | 'purchase'
  | 'rate'
  | 'read'
  | 'refund'
  | 'reject'
  | 'remove'
  | 'renew'
  | 'reply'
  | 'report'
  | 'retry'
  | 'review'
  | 'search'
  | 'seek'
  | 'select'
  | 'share'
  | 'skip'
  | 'sort'
  | 'start'
  | 'stop'
  | 'submit'
  | 'subscribe'
  | 'success'
  | 'unfollow'
  | 'unsubscribe'
  | 'update'
  | 'upgrade'
  | 'view'
  | 'write';

export const useAnalytics = (component: string) => {
  const ph = usePostHog();

  return {
    track: (track?: string) => ({
      action: (action: ActionTypes, data?: Record<string, unknown>) => {
        const event =
          component && track ? `${component}.${track}.${action}` : `${component}.${action}`;

        return ph?.capture(event, data);
      },
    }),
  };
};
