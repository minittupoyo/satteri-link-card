import type { MdastPluginDefinition } from 'satteri';

export interface OgData {
  title: string;
  description: string;
  faviconUrl?: string;
  imageUrl?: string;
}

export interface SatteriLinkCardPlusOptions {
  cache?: boolean;
  shortenUrl?: boolean;
  thumbnailPosition?: 'left' | 'right';
  noThumbnail?: boolean;
  noFavicon?: boolean;
  ignoreExtensions?: string[];
  timeoutMs?: number;
  ogTransformer?: (og: OgData, url: URL) => OgData | Promise<OgData>;
}

/**
 * Create a Satteri-compatible link card plugin.
 * It converts a paragraph containing only a bare URL into a class-based link-card HTML.
 */
export declare function createSatteriLinkCardPlus(options?: SatteriLinkCardPlusOptions): MdastPluginDefinition;

/**
 * Default instance of the Satteri link card plugin with default options.
 */
export declare const satteriLinkCardPlus: MdastPluginDefinition;

export default createSatteriLinkCardPlus;
