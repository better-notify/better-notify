import type { AnyCatalog } from '../catalog.js';
import type { AnyMiddleware } from '../middlewares/types.js';
import type { ClientHooks } from '../client.js';

export type Plugin<R extends AnyCatalog = AnyCatalog> = {
  name: string;
  hooks?: ClientHooks<R>;
  middleware?: AnyMiddleware[];
  onCreate?: (params: { catalog: R }) => void;
  onClose?: () => void | Promise<void>;
};
