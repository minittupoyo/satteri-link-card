# @minittupoyo/satteri-link-card

高速な Markdown/MDX 処理パイプラインである [Sätteri](https://github.com/bruits/satteri) のプラグインです。単一の URL のみが書かれた段落を、美しくコンテンツが豊富な Open Graph リンクカードに自動変換します（[remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus) を参考に作成されています）。

## 特徴

- ⚡ **圧倒的なパフォーマンス**: Sätteri の Rust 製の超高速 MDAST パイプライン上で直接動作します。
- 📦 **シンプルな導入**: 設定不要でそのまま使える ES Module プラグイン。
- 🖼️ **豊富な Open Graph メタデータ**: `open-graph-scraper` を使用して、ページのタイトル、説明文、サムネイル画像、ファビコンを自動取得します。
- 💾 **ローカルキャッシュ機能**: 取得したメタデータやダウンロードした画像ファイルをローカルディレクトリ（`public/`）にキャッシュし、アセットの直リンクを防ぐとともにビルドを高速化します。
- ⚙️ **柔軟なカスタマイズ**: サムネイルの位置変更、特定拡張子の無視設定、タイムアウト時間のカスタマイズ、カスタム関数によるメタデータの書き換え（`ogTransformer`）などに対応しています。

---

## インストール

npm を使用してパッケージをインストールします:

```bash
npm install @minittupoyo/satteri-link-card
```

ピア依存関係である `satteri` もプロジェクトにインストールされていることを確認してください:

```bash
npm install satteri
```

---

## 使い方

### 基本的な使い方

Sätteri の `mdastPlugins` オプションにプラグインを登録します:

```javascript
import { markdownToHtml } from 'satteri';
import { createSatteriLinkCardPlus } from '@minittupoyo/satteri-link-card';

const markdown = `
以下のリンクを参照してください:
https://github.com/minittupoyo/satteri-link-card
`;

const { html } = markdownToHtml(markdown, {
  mdastPlugins: [
    createSatteriLinkCardPlus({
      cache: true // ローカルアセットキャッシュを有効化（推奨）
    })
  ]
});

console.log(html);
```

### オプション設定

`createSatteriLinkCardPlus` は、以下のプロパティを持つオブジェクトを受け取ることができます。

| オプション名 | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `cache` | `boolean` | `false` | `true` の場合、OG メタデータの JSON キャッシュおよび画像/ファビコンファイルを `public/satteri-link-card/` にダウンロードしてキャッシュします。Astro のビルド時（`dist/` への出力）のコピー処理も自動で行われます。 |
| `shortenUrl` | `boolean` | `true` | `true` の場合、カードのフッターに表示される URL をフルパスではなくホスト名（ドメイン）のみに短縮します。 |
| `thumbnailPosition` | `'left' \| 'right'` | `'right'` | サムネイル画像の配置位置を指定します。 |
| `noThumbnail` | `boolean` | `false` | `true` の場合、サムネイル画像を取得・表示しません。 |
| `noFavicon` | `boolean` | `false` | `true` の場合、サイトのファビコンを取得・表示しません。 |
| `ignoreExtensions` | `string[]` | `[]` | 処理をスキップしたいファイルの拡張子の配列（例: `['.zip', '.pdf']`）。小文字で指定します。 |
| `timeoutMs` | `number` | `10000` | メタデータやアセット取得時のタイムアウト時間（ミリ秒）。 |
| `ogTransformer` | `(og: OgData, url: URL) => OgData \| Promise<OgData>` | `undefined` | 取得した Open Graph データを HTML にレンダリングする前に検証・書き換えを行うためのカスタムコールバック関数。 |

#### TypeScript 定義

```typescript
export interface OgData {
  title: string;
  description: string;
  faviconUrl?: string;
  imageUrl?: string;
}
```

### カスタムメタデータ変換 (ogTransformer) の例

特定のドメインに対してメタデータを変更したり、説明文が存在しない場合の代替テキストを設定したりできます。

```javascript
createSatteriLinkCardPlus({
  ogTransformer: (og, url) => {
    if (url.hostname === 'github.com') {
      og.title = `GitHub - ${og.title}`;
    }
    if (!og.description) {
      og.description = 'このリンクの説明文はありません。';
    }
    return og;
  }
})
```

---

## スタイリング

このプラグインはセマンティックな HTML を出力します。以下の CSS をプロジェクトのスタイルシートに追加することで、きれいなカード型リンクを表示できます。

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

/* レスポンシブ対応 */
@media (max-width: 576px) {
  .satteri-link-card__card {
    flex-direction: column;
  }
  .satteri-link-card__thumbnail {
    width: 100%;
    height: 140px;
  }
}

/* ダークモード対応 */
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

## ライセンス

MIT © [minittupoyo](LICENSE)
