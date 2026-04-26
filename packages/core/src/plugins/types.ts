import type { AnyEmailCatalog } from '../catalog.js';
import type { AnyMiddleware } from '../middlewares/types.js';
import type { ClientHooks } from '../client.js';

export type Plugin<R extends AnyEmailCatalog = AnyEmailCatalog> = {
  name: string;
  hooks?: ClientHooks<R>;
  middleware?: AnyMiddleware[];
  onCreate?: (params: { catalog: R }) => void;
  onClose?: () => void | Promise<void>;
};
