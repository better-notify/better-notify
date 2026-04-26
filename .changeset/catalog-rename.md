---
'@emailrpc/core': minor
'@emailrpc/react-email': minor
'@emailrpc/smtp': minor
---

Rename `EmailRouter` to `EmailCatalog` and replace `emailRpc.init()` with `createEmailRpc()`. Adds nested catalog composition: `rpc.catalog({...})` now accepts both email procedures and sub-catalogs, flattening into dot-path IDs (e.g. `transactional.welcome`).

Migration:

```ts
// Before
import { emailRpc, createClient } from '@emailrpc/core';
const t = emailRpc.init<Ctx>();
const router = t.router({ welcome });
const mail = createClient({ router, transports });

// After
import { createEmailRpc, createClient } from '@emailrpc/core';
const rpc = createEmailRpc<Ctx>();
const catalog = rpc.catalog({ welcome });
const mail = createClient({ catalog, transports });
```

`createWebhookRouter` is unchanged (HTTP-shaped, intentionally distinct).
