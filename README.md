# @minittupoyo/satteri-link-card

A high-performance [Sätteri](https://github.com/bruits/satteri) plugin that transforms bare links (paragraphs containing a single URL) into beautiful, content-rich, and search-engine-optimized Open Graph link cards (inspired by and compatible with [remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus)).

## Features

- ⚡ **Native Performance**: Leverages Sätteri's ultra-fast native MDAST pipeline.
- 📦 **Zero Bundler Hassle**: Drop-in ES module plugin.
- 🖼️ **Rich Open Graph Metadata**: Automatically fetches title, description, thumbnail image, and favicon using `open-graph-scraper`.
- 💾 **Local Asset Caching**: Cache fetched metadata and download asset files (images/favicons) locally to bypass hotlinking and speed up builds.
- ⚙️ **Flexible Configuration**: Control thumbnail positions, ignore specific file extensions, customize timeout values, or map URLs via custom transformers.

---

## Installation

Install the package via npm:

```bash
npm install @minittupoyo/satteri-link-card
```

Make sure you also have `satteri` installed as a peer dependency:

```bash
npm install satteri
```

---

## Usage

### Basic Usage

Import the creator function or the default instance, and pass it to Sätteri's `mdastPlugins`:

```javascript
import { markdownToHtml } from 'satteri';
import { createSatteriLinkCardPlus } from '@minittupoyo/satteri-link-card';

const markdown = `
Check out this page:
https://github.com/minittupoyo/satteri-link-card
`;

const { html } = markdownToHtml(markdown, {
  mdastPlugins: [
    createSatteriLinkCardPlus({
      cache: true // Recommended to enable local file caching
    })
  ]
});

console.log(html);
```

### Options

`createSatteriLinkCardPlus` accepts a configuration object with the following properties:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `cache` | `boolean` | `false` | When `true`, caches OG metadata JSON files and downloads images/favicons locally under `public/satteri-link-card/`. Also handles copying assets during Astro builds (`dist/`). |
| `shortenUrl` | `boolean` | `true` | When `true`, displays only the hostname in the card footer instead of the full URL path. |
| `thumbnailPosition` | `'left' \| 'right'` | `'right'` | The layout direction of the card's thumbnail image. |
| `noThumbnail` | `boolean` | `false` | When `true`, ignores and hides the thumbnail image completely. |
| `noFavicon` | `boolean` | `false` | When `true`, ignores and hides the site favicon. |
| `ignoreExtensions` | `string[]` | `[]` | List of lowercased file extensions (e.g. `['.zip', '.pdf']`) to skip. |
| `timeoutMs` | `number` | `10000` | Fetch timeout in milliseconds for metadata and asset retrieval. |
| `ogTransformer` | `(og: OgData, url: URL) => OgData \| Promise<OgData>` | `undefined` | A custom mapping function to inspect or mutate fetched Open Graph data before generating the HTML. |

#### TypeScript Definitions

```typescript
export interface OgData {
  title: string;
  description: string;
  faviconUrl?: string;
  imageUrl?: string;
}
```

### Custom OG Transformer Example

Modify metadata for specific domains, or dynamically provide fallback descriptions:

```javascript
createSatteriLinkCardPlus({
  ogTransformer: (og, url) => {
    if (url.hostname === 'github.com') {
      og.title = `GitHub - ${og.title}`;
    }
    if (!og.description) {
      og.description = 'No description available for this link.';
    }
    return og;
  }
})
```

---

## Styling the Card

The plugin generates clean semantic HTML with dedicated classes. You can add the following starter CSS to your project's stylesheet to render beautiful link cards:

```css
.satteri-link-card__container {
  margin: 1.5rem 0;
  width: 100%;
}

.satteri-link-card__card {
  display: flex;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background-color: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.satteri-link-card__card:hover {
  border-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.satteri-link-card__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  min-width: 0;
}

.satteri-link-card__content {
  margin-bottom: 0.5rem;
}

.satteri-link-card__title {
  overflow: hidden;
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #1a1a1a;
}

.satteri-link-card__description {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #666;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.satteri-link-card__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.satteri-link-card__favicon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.satteri-link-card__url {
  overflow: hidden;
  font-size: 0.75rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #888;
}

.satteri-link-card__thumbnail {
  flex-shrink: 0;
  width: 160px;
  min-height: 100%;
}

.satteri-link-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .satteri-link-card__card {
    flex-direction: column;
  }
  .satteri-link-card__thumbnail {
    width: 100%;
    height: 140px;
  }
}

/* Dark Mode support */
@media (prefers-color-scheme: dark) {
  .satteri-link-card__card {
    border-color: rgba(255, 255, 255, 0.1);
    background-color: #1e1e1e;
  }
  .satteri-link-card__card:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }
  .satteri-link-card__title {
    color: #f5f5f5;
  }
  .satteri-link-card__description {
    color: #aaa;
  }
  .satteri-link-card__url {
    color: #777;
  }
}
```

---

## License

MIT © [minittupoyo](LICENSE)
