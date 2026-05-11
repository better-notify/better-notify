import type { AnyCatalog, Catalog, LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

type RoutesOf<TCatalog> = TCatalog extends Catalog<infer M, any> ? keyof M & string : string;

export type OneSignalTransportOptions = {
  /** OneSignal App ID (UUID v4). Found in Settings → Keys & IDs. */
  appId: string;
  /** OneSignal REST API Key. Sent as `Authorization: Key <apiKey>`. */
  apiKey: string;
  /** Override the API base URL. Useful for testing. @default "https://api.onesignal.com" */
  baseUrl?: string;
  /** Override the default logger. */
  logger?: LoggerLike;
  /** HTTP client options — timeout, retry, and request lifecycle hooks. */
  http?: HttpClientBehaviorOptions;
};

export type OneSignalFilter =
  | {
      field: string;
      relation?: string;
      key?: string;
      value?: string;
    }
  | {
      operator: 'AND' | 'OR';
    };

/** Shared OneSignal fields available on all channels (targeting, scheduling, templates). */
export type OneSignalBaseBody = {
  /** Target users by external_id, onesignal_id, or custom alias (up to 20,000). */
  include_aliases?: Record<string, string[]>;
  /** Delivery channel. Required when using `include_aliases`. */
  target_channel?: 'push' | 'email' | 'sms';
  /** Target specific subscription IDs (up to 20,000). */
  include_subscription_ids?: string[];
  /** Target predefined segments. */
  included_segments?: string[];
  /** Exclude users in predefined segments. */
  excluded_segments?: string[];
  /** Filter users by tags, activity, or location (max 200 entries). */
  filters?: OneSignalFilter[];
  /** Internal message name for organization (max 128 chars). */
  name?: string;
  /** Template ID (UUID v4) to use for the message. */
  template_id?: string;
  /** User/context-specific data for message personalization. Max 2KB (push/SMS), 10KB (email). */
  custom_data?: Record<string, unknown>;
  /** Schedule delivery for a future ISO 8601 date/time. */
  send_after?: string;
  /** Per-user delivery method: `"timezone"` or `"last-active"`. */
  delayed_option?: string;
  /** Consistent local delivery time (e.g. `"9:00AM"`, `"21:45"`). */
  delivery_time_of_day?: string;
  /** Override the dashboard throttle limit. */
  throttle_rate_per_minute?: number;
  /** Override the dashboard frequency cap setting. */
  enable_frequency_cap?: boolean;
  /** UUID to prevent duplicate messages. Valid for 30 days. */
  idempotency_key?: string;
  [key: string]: unknown;
};

/** Push-specific OneSignal fields. */
export type OneSignalPushBody = OneSignalBaseBody & {
  /** iOS-only subtitle with language-specific values. */
  subtitle?: Record<string, string>;

  /** Media attachment URL for iOS notifications. */
  ios_attachments?: Record<string, string>;
  /** Image URL for Android notification expansion. */
  big_picture?: string;
  /** Image URL for Huawei notification expansion. */
  huawei_big_picture?: string;
  /** Image URL for Amazon notification expansion. */
  adm_big_picture?: string;
  /** Image URL for Chrome web notification expansion. */
  chrome_web_image?: string;
  /** Small icon resource name for Android. */
  small_icon?: string;
  /** Small icon resource name for Huawei. */
  huawei_small_icon?: string;
  /** Small icon resource name for Amazon. */
  adm_small_icon?: string;
  /** Large icon URL for Android. */
  large_icon?: string;
  /** Large icon URL for Huawei. */
  huawei_large_icon?: string;
  /** Large icon URL for Amazon. */
  adm_large_icon?: string;
  /** Icon URL for Chrome web notifications. */
  chrome_web_icon?: string;
  /** Icon URL for Firefox web notifications. */
  firefox_icon?: string;
  /** Badge icon URL for Android Chrome web tray. */
  chrome_web_badge?: string;

  /** UUID of Android notification channel in OneSignal. */
  android_channel_id?: string;
  /** UUID of existing Android app notification channel. */
  existing_android_channel_id?: string;
  /** ARGB hex color for Android small icon background. */
  android_accent_color?: string;
  /** Group key for Android notification stacking. */
  android_group?: string;

  /** UUID of Huawei notification channel in OneSignal. */
  huawei_channel_id?: string;
  /** UUID of existing Huawei app notification channel. */
  huawei_existing_channel_id?: string;
  /** Huawei self-classification category (e.g. `"MARKETING"`, `"IM"`). */
  huawei_category?: string;
  /** Huawei notification type: `"message"` or `"data"`. */
  huawei_msg_type?: string;
  /** Huawei tag for batch delivery tracking. */
  huawei_bi_tag?: string;
  /** Fully qualified Activity class name for Huawei badge. */
  huawei_badge_class?: string;
  /** Set Huawei badge count (0–99). */
  huawei_badge_set_num?: number;
  /** Increment Huawei badge count (1–99). */
  huawei_badge_add_num?: number;
  /** ARGB hex color for Huawei small icon background. */
  huawei_accent_color?: string;

  /** Message urgency: 10 = high, 5 = normal. */
  priority?: number;
  /** iOS notification interruption level. */
  ios_interruption_level?: 'active' | 'critical' | 'passive' | 'time-sensitive';
  /** Custom sound file name for iOS. */
  ios_sound?: string;
  /** Badge operation on iOS. */
  ios_badgeType?: 'None' | 'SetTo' | 'Increase';
  /** Badge count change amount on iOS. */
  ios_badgeCount?: number;
  /** iOS category enabling direct user response without launching app. */
  ios_category?: string;
  /** Score (0–1) to sort iOS notification importance in summary. */
  ios_relevance_score?: number;
  /** Override APNs push type (use `"voip"` for VoIP). */
  apns_push_type_override?: string;
  /** Enable data/background notifications. */
  content_available?: boolean;

  /** HTTPS URL opened when user interacts with the notification. */
  url?: string;
  /** App-specific URL (supports custom schemes). */
  app_url?: string;
  /** Website URL when app and web need different links. */
  web_url?: string;
  /** Direct notification to specific user experience (App Clip, window). */
  target_content_identifier?: string;
  /** Up to 3 action buttons for Android/iOS. */
  buttons?: { id: string; text: string; icon?: string }[];
  /** Up to 2 action buttons for Chrome web push. */
  web_buttons?: { id: string; text: string; url?: string }[];

  /** Group key for iOS notification stacking. */
  thread_id?: string;
  /** Replace older notifications with this ID (mobile only). */
  collapse_id?: string;
  /** Web push topic ID. */
  web_push_topic?: string;
  /** Group key for Amazon notification stacking. */
  adm_group?: string;

  /** Duration (0–2419200 seconds) notification remains valid when device is offline. */
  ttl?: number;
  /** Custom key-value data passed to the app. */
  data?: Record<string, unknown>;

  /** Target iOS devices only. */
  isIos?: boolean;
  /** Target Android devices only. */
  isAndroid?: boolean;
  /** Target Huawei devices only. */
  isHuawei?: boolean;
  /** Target all web push platforms. */
  isAnyWeb?: boolean;
  /** Target Chrome web push only. */
  isChromeWeb?: boolean;
  /** Target Firefox web push only. */
  isFirefox?: boolean;
  /** Target Safari web push only. */
  isSafari?: boolean;
  /** Target Windows apps only. */
  isWP_WNS?: boolean;
  /** Target Amazon devices only. */
  isAdm?: boolean;
};

/** Email-specific OneSignal fields. */
export type OneSignalEmailBody = OneSignalBaseBody & {
  /** Preview text displayed after the email subject. */
  email_preheader?: string;
  /** Authenticated sending domain for email delivery. */
  email_sender_domain?: string;
  /** Send to unsubscribed addresses for account-level emails. */
  include_unsubscribed?: boolean;
  /** Disable URL link tracking in email body. */
  disable_email_click_tracking?: boolean;
};

/** SMS-specific OneSignal fields. */
export type OneSignalSmsBody = OneSignalBaseBody & {
  /** Send to specific phone numbers in E.164 format (up to 20,000). */
  include_phone_numbers?: string[];
  /** URLs for media files to send as MMS. */
  sms_media_urls?: string[];
};

/** Union of all channel-specific OneSignal body types. */
export type OneSignalBody = OneSignalPushBody | OneSignalEmailBody | OneSignalSmsBody;

export type OneSignalPushTransportOptions<TCatalog extends AnyCatalog = AnyCatalog> =
  OneSignalTransportOptions & {
    /** Extra fields merged into every OneSignal request body. Applied to all sends. */
    body?: OneSignalPushBody;
    /** Per-route overrides merged on top of `body`. Pass `<typeof catalog>` for route autocomplete. */
    bodyFor?: Partial<Record<RoutesOf<TCatalog>, OneSignalPushBody>>;
  };

export type OneSignalEmailTransportOptions<TCatalog extends AnyCatalog = AnyCatalog> =
  OneSignalTransportOptions & {
    /** Extra fields merged into every OneSignal request body. Applied to all sends. */
    body?: OneSignalEmailBody;
    /** Per-route overrides merged on top of `body`. Pass `<typeof catalog>` for route autocomplete. */
    bodyFor?: Partial<Record<RoutesOf<TCatalog>, OneSignalEmailBody>>;
  };

export type OneSignalSmsTransportOptions<TCatalog extends AnyCatalog = AnyCatalog> =
  OneSignalTransportOptions & {
    /** Phone number (E.164) or Messaging Service SID for `sms_from`. */
    from?: string;
    /** Extra fields merged into every OneSignal request body. Applied to all sends. */
    body?: OneSignalSmsBody;
    /** Per-route overrides merged on top of `body`. Pass `<typeof catalog>` for route autocomplete. */
    bodyFor?: Partial<Record<RoutesOf<TCatalog>, OneSignalSmsBody>>;
  };

export type OneSignalSuccessResponse = {
  id: string;
  external_id?: string;
  errors?: {
    invalid_player_ids?: string[];
    invalid_aliases?: Record<string, string[]>;
    invalid_email_tokens?: string[];
    invalid_phone_numbers?: string[];
    [key: string]: unknown;
  };
};

export type OneSignalErrorResponse = {
  errors: string[];
};
