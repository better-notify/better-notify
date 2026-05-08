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
  canonicalUrl?: string;
  article?: ArticleParams;
  noIndex?: boolean;
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
  canonicalUrl,
  article,
  noIndex = false,
}: SEOParams): SeoResult => {
  const safeTitle = truncateTitle(title);
  const safeDescription = truncateDescription(description);
  const absoluteImage = image?.startsWith('http')
    ? image
    : image
      ? `${appConfig.baseUrl}${image.startsWith('/') ? '' : '/'}${image}`
      : `${appConfig.baseUrl}/og/image.png`;

  const articleMeta: SeoAssetAttributes[] =
    type === 'article' && article
      ? [
          ...(article.publishedTime
            ? [{ property: 'article:published_time', content: article.publishedTime }]
            : []),
          ...(article.modifiedTime
            ? [{ property: 'article:modified_time', content: article.modifiedTime }]
            : []),
          ...(article.author ? [{ property: 'article:author', content: article.author }] : []),
          ...(article.section ? [{ property: 'article:section', content: article.section }] : []),
          ...(article.tags?.map((tag) => ({ property: 'article:tag', content: tag })) ?? []),
        ]
      : [];

  const robotsContent = [
    noIndex ? 'noindex' : 'index',
    'follow',
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
    { property: 'og:locale', content: appConfig.locale.openGraph },
    { property: 'og:image', content: absoluteImage },
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
    { name: 'twitter:domain', content: new URL(appConfig.baseUrl).hostname },
    { name: 'twitter:image', content: absoluteImage },
    { name: 'twitter:image:alt', content: safeTitle },

    { name: 'robots', content: robotsContent },
    { name: 'author', content: article?.author ?? appConfig.name },
    { name: 'theme-color', content: appConfig.themeColor },
    { name: 'color-scheme', content: 'dark light' },
    { name: 'referrer', content: 'origin-when-cross-origin' },
  ];

  const canonicalHref: string | undefined = canonicalUrl ?? url;
  const links: SeoAssetAttributes[] = [
    ...(canonicalHref
      ? [
          { rel: 'canonical', href: canonicalHref },
          { rel: 'alternate', hrefLang: appConfig.locale.bcp47, href: canonicalHref },
          { rel: 'alternate', hrefLang: 'x-default', href: canonicalHref },
        ]
      : []),
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous',
    },
    { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
  ];

  return { meta, links };
};
