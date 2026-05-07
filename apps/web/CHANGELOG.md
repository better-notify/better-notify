# Changelog

## [1.2.0](https://github.com/better-notify/better-notify/compare/@betternotify/web-v1.1.1...@betternotify/web-v1.2.0) (2026-05-07)


### Features

* **web:** add SMTP failover example and flatten transport docs ([#66](https://github.com/better-notify/better-notify/issues/66)) ([817ed91](https://github.com/better-notify/better-notify/commit/817ed91f939932813c6cf1599bdcc05f7672c833))
* **web:** move blog to landing page with standalone routes ([#64](https://github.com/better-notify/better-notify/issues/64)) ([a780eb5](https://github.com/better-notify/better-notify/commit/a780eb5a6f5ac4899b9ac1ec9532beb4b556c0fd))

## [1.1.1](https://github.com/better-notify/better-notify/compare/@betternotify/web-v1.1.0...@betternotify/web-v1.1.1) (2026-05-06)


### Bug Fixes

* **create-better-notify,web:** add [@latest](https://github.com/latest) to hero CLI command and format landing components ([#61](https://github.com/better-notify/better-notify/issues/61)) ([e3d0e78](https://github.com/better-notify/better-notify/commit/e3d0e78f0d38628dabe2e33fa7c2978a430cb249))

## [1.1.0](https://github.com/better-notify/better-notify/compare/@betternotify/web-v1.0.0...@betternotify/web-v1.1.0) (2026-05-05)


### Features

* **cloudflare-email:** implement Cloudflare Email Service transport ([#34](https://github.com/better-notify/better-notify/issues/34)) ([914ee7e](https://github.com/better-notify/better-notify/commit/914ee7e01999713a4426ed80e75aa94408a15892))
* **core:** adopt @better-fetch/fetch as internal HTTP transport layer ([#43](https://github.com/better-notify/better-notify/issues/43)) ([dfc5102](https://github.com/better-notify/better-notify/commit/dfc51023f5fe7d086bfeb2d7733f1f4cab29a514))
* **create-better-notify:** add scaffolding tool for Better Notify projects ([#49](https://github.com/better-notify/better-notify/issues/49)) ([224a7ff](https://github.com/better-notify/better-notify/commit/224a7ffc614b2f0eaa5b950a1c1aef3dc13bab63))
* **discord:** implement Discord channel and transport ([#38](https://github.com/better-notify/better-notify/issues/38)) ([a8fd5ed](https://github.com/better-notify/better-notify/commit/a8fd5ed9554b09b32a044ff9a0eb1b07d78826d6))
* **mailchimp:** implement Mailchimp Transactional transport ([#46](https://github.com/better-notify/better-notify/issues/46)) ([28fd39d](https://github.com/better-notify/better-notify/commit/28fd39d1b7096f523103825049054913ae6909ce))
* **mjml,handlebars:** implement template adapters ([#39](https://github.com/better-notify/better-notify/issues/39)) ([2502ceb](https://github.com/better-notify/better-notify/commit/2502ceba23f984261d989bf18fc7e406b44c6dd1))
* **resend:** implement Resend transport ([#36](https://github.com/better-notify/better-notify/issues/36)) ([aff59d7](https://github.com/better-notify/better-notify/commit/aff59d7ecfdad29fb3c16f555e78023322c025cf))
* **ses:** remove ses package, use smtp transport ([#47](https://github.com/better-notify/better-notify/issues/47)) ([6c5ff25](https://github.com/better-notify/better-notify/commit/6c5ff255e3d2d9945f99957aac82fdb126279195))
* **slack:** implement Slack channel with Bot API transport ([#37](https://github.com/better-notify/better-notify/issues/37)) ([54f358e](https://github.com/better-notify/better-notify/commit/54f358e65c7fa6e320b142376bd0714ed2784b16))
* **telegram:** add Telegram channel with Bot API transport ([#33](https://github.com/better-notify/better-notify/issues/33)) ([a9b5d22](https://github.com/better-notify/better-notify/commit/a9b5d2294c344785c84c08578bd0629ac308fa53))
* **twilio:** implement Twilio SMS transport ([#42](https://github.com/better-notify/better-notify/issues/42)) ([0f0d082](https://github.com/better-notify/better-notify/commit/0f0d082c9fb8f961ba10b9bff07ff6be1187e13a))
* **web:** add CLI preview widget to landing hero ([#50](https://github.com/better-notify/better-notify/issues/50)) ([118ed5b](https://github.com/better-notify/better-notify/commit/118ed5b6fe81a9c317f97fd1f72df5777b21616d))
* **web:** add SEO meta, OpenAPI docs, and OG image generation ([#48](https://github.com/better-notify/better-notify/issues/48)) ([ab6cdfb](https://github.com/better-notify/better-notify/commit/ab6cdfb578d680419e5aaf88cfc4c2624a4b6ad5))
* **web:** add social links and author card to landing page ([#55](https://github.com/better-notify/better-notify/issues/55)) ([5991f76](https://github.com/better-notify/better-notify/commit/5991f768194c535149f7db46a7502e419b8bb93a))
* **web:** landing page, design system, and visual identity ([#32](https://github.com/better-notify/better-notify/issues/32)) ([7e305d8](https://github.com/better-notify/better-notify/commit/7e305d8eb98e5b9c7785065171df9a5fb964827f))
* **zapier:** implement Zapier channel and transport ([#41](https://github.com/better-notify/better-notify/issues/41)) ([04379d3](https://github.com/better-notify/better-notify/commit/04379d39a4e7b819bd71467f31470d6570575655))


### Bug Fixes

* package size and tree-shaking hardening ([#14](https://github.com/better-notify/better-notify/issues/14)) ([2f2c2e7](https://github.com/better-notify/better-notify/commit/2f2c2e79dbd0080e7f7429c0e2e74a33159041c2))
* **web:** canary ([#53](https://github.com/better-notify/better-notify/issues/53)) ([cca634b](https://github.com/better-notify/better-notify/commit/cca634b2b57fc0f9ffb83c0b5e2de4c1d85602a8))
* **web:** fix canary wrangler deploy and block indexing ([#54](https://github.com/better-notify/better-notify/issues/54)) ([a515a5d](https://github.com/better-notify/better-notify/commit/a515a5ddea5bda9a873de02ecbb66c6f5042220f))

## 1.0.0 (2026-04-30)


### Features

* add docs site with TanStack Start + Fumadocs ([#21](https://github.com/better-notify/better-notify/issues/21)) ([eba21f1](https://github.com/better-notify/better-notify/commit/eba21f135ba559369d7c5614ee9a137266ac1c05))
* **web:** add CI deploy workflow for website ([#23](https://github.com/better-notify/better-notify/issues/23)) ([b60a893](https://github.com/better-notify/better-notify/commit/b60a89326c17d78c740103a86817a6ec7ad36676))


### Bug Fixes

* add tslib dependency to resolve docs build failure ([#22](https://github.com/better-notify/better-notify/issues/22)) ([d8be5d4](https://github.com/better-notify/better-notify/commit/d8be5d434b4083160289ee0383de06c3ee693231))
