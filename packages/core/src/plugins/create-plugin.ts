import type { AnyCatalog } from '../catalog.js';
import type { Plugin } from './types.js';

export const createPlugin = <R extends AnyCatalog = AnyCatalog>(plugin: Plugin<R>): Plugin<R> =>
  plugin;
