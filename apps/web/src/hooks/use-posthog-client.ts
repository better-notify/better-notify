import posthog from 'posthog-js';
import { useEffect } from 'react';

export const usePosthogInit = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

    if (!posthogKey || posthog.__loaded) return;

    posthog.init(posthogKey, {
      api_host: '/ph',
      ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
    });
  }, []);
}
