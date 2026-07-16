import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ogs from 'open-graph-scraper';
import { defineMdastPlugin } from 'satteri';

const defaultOptions = {
  cache: false,
  shortenUrl: true,
  thumbnailPosition: 'right',
  noThumbnail: false,
  noFavicon: false,
  ignoreExtensions: [],
  timeoutMs: 10_000,
};
const pluginCacheVersion = '8';
const cacheDirectoryName = 'satteri-link-card';
const knownImageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif'];
let buildRenderKey = 'dev';
if (process.env.ASTRO_COMMAND === 'build') {
  if (!process.env.SATTERI_LINK_CARD_BUILD_KEY) {
    process.env.SATTERI_LINK_CARD_BUILD_KEY = Date.now().toString(36);
  }
  buildRenderKey = process.env.SATTERI_LINK_CARD_BUILD_KEY;
}

/**
 * Create a Satteri-compatible copy of satteri-link-card.
 *
 * It converts a paragraph containing only a bare URL into the same class-based
 * link-card HTML shape used by satteri-link-card.
 */
export function createSatteriLinkCardPlus(options = {}) {
  const config = {
    ...defaultOptions,
    ...options,
    ignoreExtensions: (options.ignoreExtensions ?? defaultOptions.ignoreExtensions).map((extension) => extension.toLowerCase()),
    thumbnailPosition: options.thumbnailPosition === 'left' ? 'left' : 'right',
  };

  const ogCache = new Map();

  return defineMdastPlugin({
    name: createPluginName(config),
    async paragraph(node, ctx) {
      if (hasListItemAncestor(node, ctx)) return;

      const link = getCardLink(node, ctx);
      if (!link) return;

      let url;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }

      if (!['http:', 'https:'].includes(url.protocol) || isIgnoredUrl(url, config.ignoreExtensions)) {
        return;
      }

      let og;
      try {
        let ogPromise = ogCache.get(url.href);
        if (!ogPromise) {
          ogPromise = getOgData(url, config);
          ogCache.set(url.href, ogPromise);
          // Evict failed fetches so a transient error doesn't permanently poison
          // the in-memory cache for every later occurrence of the same URL.
          ogPromise.catch(() => ogCache.delete(url.href));
        }

        og = await ogPromise;

        if (typeof config.ogTransformer === 'function') {
          og = await config.ogTransformer(og, url);
        }
      } catch (error) {
        ctx.report({
          message: `Falling back to URL-only link card for ${url.href}: ${error.message}`,
          node,
          severity: 'warning',
        });
        og = createFallbackOgData(url, link.label);
      }

      ctx.replaceNode(node, {
        rawHtml: renderLinkCard(url, normalizeOgData(og, url), config),
      });
    },
  });
}

export const satteriLinkCardPlus = createSatteriLinkCardPlus();

export default createSatteriLinkCardPlus;

function createPluginName(config) {
  const cacheKey = [
    `v${pluginCacheVersion}`,
    `cache:${config.cache}`,
    `shorten:${config.shortenUrl}`,
    `thumbnail:${config.thumbnailPosition}`,
    `no-thumbnail:${config.noThumbnail}`,
    `no-favicon:${config.noFavicon}`,
    `ignore:${config.ignoreExtensions.join(',')}`,
    `timeout:${config.timeoutMs}`,
    `transformer:${typeof config.ogTransformer === 'function'}`,
    // Astro's content layer skips Markdown rendering when the source digest is
    // unchanged. Link cards depend on external metadata/cache, so build needs a
    // fresh render to avoid persisting an old fallback card.
    `build-render:${buildRenderKey}`,
  ].join(';');

  return `satteri-link-card-plus:${createHash('sha256').update(cacheKey).digest('hex').slice(0, 12)}`;
}

function getCardLink(node, ctx) {
  if (node.children.length !== 1) return undefined;

  const [child] = node.children;
  if (child.type !== 'link') return undefined;

  const text = ctx.textContent(child).trim();
  const url = child.url.trim();

  if (text === url) return { href: url };
  if (isSingleLineNode(node)) return { href: url, label: text };

  return undefined;
}

function isSingleLineNode(node) {
  const { start, end } = node.position ?? {};
  return start?.line !== undefined && start.line === end?.line;
}

function hasListItemAncestor(node, ctx) {
  let current = node;

  while (current) {
    const parent = ctx.parent(current);
    if (!parent) return false;
    if (parent.type === 'listItem') return true;
    current = parent;
  }

  return false;
}

function isIgnoredUrl(url, ignoreExtensions) {
  const pathname = url.pathname.toLowerCase();
  return ignoreExtensions.some((extension) => pathname.endsWith(extension));
}

async function getOgData(url, config) {
  const cachedOg = config.cache ? await readOgCache(url) : undefined;
  if (cachedOg) return cachedOg;

  const { result } = await ogs({
    url: url.href,
    timeout: Math.ceil(config.timeoutMs / 1000),
    fetchOptions: {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'satteri-link-card-plus',
      },
    },
  });
  const title = result.ogTitle ?? result.twitterTitle ?? url.hostname;
  const description = result.ogDescription ?? result.twitterDescription ?? '';
  const imageUrl = resolveUrl(getFirstImageUrl(result.ogImage ?? result.twitterImage), url);
  const faviconUrl = resolveUrl(result.favicon, url) ?? `https://www.google.com/s2/favicons?domain=${url.hostname}`;

  const og = { title, description, faviconUrl, imageUrl };

  if (config.cache) {
    const cachedOg = {
      ...og,
      faviconUrl: config.noFavicon ? og.faviconUrl : await cacheAsset(og.faviconUrl, config.timeoutMs, og.faviconUrl),
      imageUrl: config.noThumbnail ? og.imageUrl : await cacheAsset(og.imageUrl, config.timeoutMs, og.imageUrl),
    };

    await writeOgCache(url, cachedOg, config);
    return cachedOg;
  }

  return og;
}

async function cacheAsset(assetUrl, timeoutMs, fallbackUrl = assetUrl) {
  if (!assetUrl) return undefined;

  try {
    const cacheKey = createHash('sha256').update(assetUrl).digest('hex');
    const cacheDir = path.join(process.cwd(), 'public', cacheDirectoryName);
    const url = new URL(assetUrl);
    const pathnameExtension = getSafeExtension(path.extname(url.pathname));
    const cachedFile = await findCachedFile(cacheDir, cacheKey);

    if (cachedFile) {
      await mirrorAssetToBuildOutput(path.join(cacheDir, cachedFile), cachedFile);
      return `/satteri-link-card/${cachedFile}`;
    }

    const response = await fetchWithTimeout(assetUrl, timeoutMs);
    if (!response.ok) return fallbackUrl;

    // Only persist assets we can confirm are actual images. Otherwise a
    // non-image response (e.g. an HTML error page served with a 200 status)
    // would get cached and rendered as a broken <img>.
    const extension = knownImageExtensions.includes(pathnameExtension)
      ? pathnameExtension
      : extensionFromContentType(response.headers.get('content-type'));
    if (!extension) return fallbackUrl;

    const fileName = `${cacheKey}${extension}`;
    const filePath = path.join(cacheDir, fileName);
    const bytes = new Uint8Array(await response.arrayBuffer());

    await mkdir(cacheDir, { recursive: true });
    await writeFile(filePath, bytes);
    await mirrorAssetToBuildOutput(filePath, fileName);

    return `/satteri-link-card/${fileName}`;
  } catch {
    return fallbackUrl;
  }
}

function getFirstImageUrl(image) {
  const firstImage = Array.isArray(image) ? image[0] : image;
  if (typeof firstImage === 'string') return firstImage;
  return firstImage?.url;
}

async function findCachedFile(cacheDir, cacheKey) {
  for (const extension of knownImageExtensions) {
    const fileName = `${cacheKey}${extension}`;

    try {
      await readFile(path.join(cacheDir, fileName));
      return fileName;
    } catch {
      // Try the next known extension.
    }
  }

  return undefined;
}

async function mirrorAssetToBuildOutput(sourcePath, fileName) {
  if (process.env.ASTRO_COMMAND !== 'build' && process.env.NODE_ENV !== 'production') {
    return;
  }

  const outputDir = path.join(process.cwd(), 'dist', cacheDirectoryName);
  const outputPath = path.join(outputDir, fileName);

  try {
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, await readFile(sourcePath));
  } catch {
    // The public cache remains the source of truth; mirroring only helps builds
    // where Astro has already copied public assets before Markdown rendering.
  }
}

async function readOgCache(url) {
  const filePath = ogCachePath(url);

  try {
    const cached = JSON.parse(await readFile(filePath, 'utf8'));
    return {
      title: cached.title,
      description: cached.description,
      faviconUrl: cached.faviconUrl,
      imageUrl: cached.imageUrl,
    };
  } catch {
    return undefined;
  }
}

async function writeOgCache(url, og, config) {
  if (!config.cache) return;

  const filePath = ogCachePath(url);

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(og, null, 2));
  } catch {
    // Link cards still render from the current fetch result.
  }
}

function ogCachePath(url) {
  const cacheKey = createHash('sha256').update(url.href).digest('hex');
  return path.join(process.cwd(), 'public', cacheDirectoryName, 'metadata', `${cacheKey}.json`);
}

function getSafeExtension(extension) {
  if (!extension || extension.length > 10 || !/^\.[a-z0-9]+$/i.test(extension)) {
    return undefined;
  }

  return extension.toLowerCase();
}

function extensionFromContentType(contentType) {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();

  return {
    'image/avif': '.avif',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
  }[mediaType];
}

async function fetchWithTimeout(resource, timeoutMs, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(resource, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function resolveUrl(value, baseUrl) {
  if (!value) return undefined;

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return undefined;
  }
}

function normalizeOgData(og, url) {
  return {
    title: og.title || url.hostname,
    description: og.description || '',
    faviconUrl: og.faviconUrl,
    imageUrl: og.imageUrl,
  };
}

function createFallbackOgData(url, label) {
  return {
    title: url.hostname,
    description: label && label !== url.href ? label : '',
    faviconUrl: `https://www.google.com/s2/favicons?domain=${url.hostname}`,
    imageUrl: undefined,
  };
}

function renderLinkCard(url, og, config) {
  const displayedUrl = config.shortenUrl ? url.hostname : url.href;
  const thumbnail = config.noThumbnail || !og.imageUrl
    ? ''
    : [
        '    <div class="satteri-link-card__thumbnail">',
        `      <img src="${escapeHtml(og.imageUrl)}" class="satteri-link-card__image" alt="">`,
        '    </div>',
      ].join('\n');
  const favicon = config.noFavicon || !og.faviconUrl
    ? ''
    : `        <img src="${escapeHtml(og.faviconUrl)}" class="satteri-link-card__favicon" width="14" height="14" alt="">\n`;
  const main = [
    '    <div class="satteri-link-card__main">',
    '      <div class="satteri-link-card__content">',
    `        <div class="satteri-link-card__title">${escapeHtml(og.title)}</div>`,
    `        <div class="satteri-link-card__description">${escapeHtml(og.description)}</div>`,
    '      </div>',
    '      <div class="satteri-link-card__meta">',
    `${favicon}        <span class="satteri-link-card__url">${escapeHtml(displayedUrl)}</span>`,
    '      </div>',
    '    </div>',
  ].join('\n');
  const body = config.thumbnailPosition === 'left' && thumbnail
    ? `${thumbnail}\n${main}`
    : `${main}${thumbnail ? `\n${thumbnail}` : ''}`;

  return [
    '<div class="satteri-link-card__container not-prose">',
    `  <a href="${escapeHtml(url.href)}" target="_blank" rel="noreferrer noopener" class="satteri-link-card__card">`,
    body,
    '  </a>',
    '</div>',
  ].join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
