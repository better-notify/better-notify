import { createFileRoute } from '@tanstack/react-router';

import { brandAssets } from '@/lib/brand-assets';
import { createStoredZip } from '@/lib/zip';

export const Route = createFileRoute('/brand-assets.zip')({
  server: {
    handlers: {
      GET() {
        return new Response(createStoredZip(brandAssets), {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="better-notify-brand-assets.zip"',
          },
        });
      },
    },
  },
});
