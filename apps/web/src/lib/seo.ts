import { appConfig } from './shared';

type ArticleParams = {
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
};

type SEOParams = {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  locale?: string;
  canonicalUrl?: string;
  article?: ArticleParams;
  noIndex?: boolean;
  noFollow?: boolean;
  newsKeywords?: string;
  isNews?: boolean;
};

type SeoAssetAttributes = Record<string, string | boolean | undefined>;

type SeoResult = {
  meta: SeoAssetAttributes[];
  links: SeoAssetAttributes[];
};

const truncateDescription = (description: string, maxLength = 160): string => {
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength - 3)}...`;
};

const truncateTitle = (title: string, maxLength = 60): string => {
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 3)}...`;
};

export const seo = ({
  title,
  description,
  keywords = '',
  image,
  url,
  type = 'website',
  locale = appConfig.locale.openGraph,
  canonicalUrl,
  article,
  noIndex = false,
  noFollow = false,
  newsKeywords,
  isNews = false,
}: SEOParams): SeoResult => {
  const safeTitle = truncateTitle(title);
  const safeDescription = truncateDescription(description);
  const absoluteImage = image?.startsWith('http')
    ? image
    : image
      ? `${appConfig.baseUrl}${image.startsWith('/') ? '' : '/'}${image}`
      : `${appConfig.baseUrl}/og-image.png`;

  const articleMeta: SeoAssetAttributes[] =
    type === 'article' && article
      ? [
          ...(article.publishedTime
            ? [
                {
                  property: 'article:published_time',
                  content: article.publishedTime,
                },
              ]
            : []),
          ...(article.modifiedTime
            ? [
                {
                  property: 'article:modified_time',
                  content: article.modifiedTime,
                },
              ]
            : []),
          ...(article.author ? [{ property: 'article:author', content: article.author }] : []),
          ...(article.section ? [{ property: 'article:section', content: article.section }] : []),
          ...(article.tags?.map((tag) => ({
            property: 'article:tag',
            content: tag,
          })) ?? []),
        ]
      : [];

  const robotsContent = [
    noIndex ? 'noindex' : 'index',
    noFollow ? 'nofollow' : 'follow',
    'max-image-preview:large',
    'max-snippet:-1',
    'max-video-preview:-1',
  ].join(', ');

  const meta: SeoAssetAttributes[] = [
    { title: safeTitle },
    { name: 'description', content: safeDescription },
    ...(keywords ? [{ name: 'keywords', content: keywords }] : []),

    { property: 'og:type', content: type },
    { property: 'og:site_name', content: appConfig.name },
    { property: 'og:title', content: safeTitle },
    { property: 'og:description', content: safeDescription },
    { property: 'og:locale', content: locale },
    { property: 'og:locale:alternate', content: appConfig.locale.openGraph },
    { property: 'og:image', content: absoluteImage },
    { property: 'og:image:secure_url', content: absoluteImage },
    { property: 'og:image:alt', content: safeTitle },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/png' },
    ...(url ? [{ property: 'og:url', content: url }] : []),
    ...articleMeta,

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: appConfig.twitterHandle },
    { name: 'twitter:creator', content: appConfig.twitterHandle },
    { name: 'twitter:title', content: safeTitle },
    { name: 'twitter:description', content: safeDescription },
    { name: 'twitter:domain', content: 'csbot.app' },
    { name: 'twitter:image', content: absoluteImage },
    { name: 'twitter:image:alt', content: safeTitle },

    { name: 'robots', content: robotsContent },
    { name: 'googlebot', content: robotsContent },
    { name: 'googlebot-news', content: isNews ? 'index, follow' : 'noindex' },
    { name: 'bingbot', content: noIndex ? 'noindex' : 'index, follow' },
    ...(newsKeywords ? [{ name: 'news_keywords', content: newsKeywords }] : []),
    ...(isNews
      ? [
          { name: 'syndication-source', content: url ?? appConfig.baseUrl },
          { name: 'original-source', content: url ?? appConfig.baseUrl },
        ]
      : []),
    { name: 'author', content: article?.author ?? appConfig.name },
    { name: 'creator', content: appConfig.name },
    { name: 'publisher', content: appConfig.name },
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, viewport-fit=cover',
    },
    { name: 'theme-color', content: appConfig.themeColor },
    { name: 'format-detection', content: 'telephone=no' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    {
      name: 'apple-mobile-web-app-status-bar-style',
      content: 'black-translucent',
    },
    { name: 'apple-mobile-web-app-title', content: appConfig.name },
    { name: 'generator', content: 'TanStack Start' },
    { name: 'referrer', content: 'origin-when-cross-origin' },
    { name: 'color-scheme', content: 'dark light' },
    { name: 'rating', content: 'general' },
    { name: 'revisit-after', content: '1 day' },
    { httpEquiv: 'x-ua-compatible', content: 'IE=edge' },
    { httpEquiv: 'content-language', content: appConfig.locale.bcp47 },
  ];

  const canonicalHref: string | undefined = canonicalUrl ?? url;
  const links: SeoAssetAttributes[] = [
    ...(canonicalHref ? [{ rel: 'canonical', href: canonicalHref }] : []),
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous',
    },
    { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
    { rel: 'preconnect', href: 'https://www.googletagmanager.com' },
    { rel: 'dns-prefetch', href: 'https://www.googletagmanager.com' },
    {
      rel: 'alternate',
      hreflang: appConfig.locale.bcp47,
      href: canonicalHref ?? appConfig.baseUrl,
    },
    {
      rel: 'alternate',
      hreflang: 'x-default',
      href: canonicalHref ?? appConfig.baseUrl,
    },
  ];

  return { meta, links };
};
