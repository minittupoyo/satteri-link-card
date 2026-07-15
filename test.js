import { markdownToHtml } from 'satteri';
import { createSatteriLinkCardPlus } from './index.js';

const markdown = `
Hello world

https://example.com
`;

try {
  const { html } = await markdownToHtml(markdown, {
    mdastPlugins: [
      createSatteriLinkCardPlus({
        cache: false
      })
    ]
  });
  console.log("Success!");
  console.log(html);
} catch (e) {
  console.error("Failed:", e);
  process.exit(1);
}
