import posthog, { PostHog } from 'posthog-js';
import { useEffect, useState } from 'react';

export const usePosthogClient = () => {
  const [client, setClient] = useState<PostHog | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    if (posthog.__loaded) return posthog;
    return undefined;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

    if (!posthogKey) return;

    if (posthog.__loaded) {
      setClient(posthog);
      return;
    }

    posthog.init(posthogKey, {
      api_host: '/ingest',
      ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      loaded: (ph) => setClient(ph as PostHog),
    });
  }, []);

  return { client };
};
