import logoShortSvg from '@libs/ui/assets/logo-short.svg?raw';
import logoShortWhiteSvg from '@libs/ui/assets/logo-short-white.svg?raw';
import logoStackedSvg from '@libs/ui/assets/logo-stacked.svg?raw';
import logoStackedWhiteSvg from '@libs/ui/assets/logo-stacked-white.svg?raw';
import logoWideSvg from '@libs/ui/assets/logo-wide.svg?raw';
import logoWideWhiteSvg from '@libs/ui/assets/logo-wide-white.svg?raw';

type BrandAsset = {
  fileName: string;
  source: string;
};

const normalizeSvg = (source: string) => source.trim() + '\n';

export const logoSvg = normalizeSvg(logoShortSvg);
export const wordmarkSvg = normalizeSvg(logoWideSvg);

export const brandAssets: BrandAsset[] = [
  { fileName: 'better-notify-logo.svg', source: logoSvg },
  { fileName: 'better-notify-logo-white.svg', source: normalizeSvg(logoShortWhiteSvg) },
  { fileName: 'better-notify-wordmark.svg', source: wordmarkSvg },
  { fileName: 'better-notify-wordmark-white.svg', source: normalizeSvg(logoWideWhiteSvg) },
  { fileName: 'better-notify-stacked.svg', source: normalizeSvg(logoStackedSvg) },
  { fileName: 'better-notify-stacked-white.svg', source: normalizeSvg(logoStackedWhiteSvg) },
];
