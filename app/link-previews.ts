import type { Plugin } from 'vite';

/** The size the pictures in `public/previews` are made at, the size chats and feeds draw a link's card at. */
const PICTURE = { width: 1200, height: 630 } as const;
const SITE_NAME = 'Palette Atlas';

const PICTURE_TAG = /<meta property="og:image" content="([^"]+)"\s*\/?>/;
const TITLE = /<title>([^<]*)<\/title>/;
const DESCRIPTION = /<meta name="description" content="([^"]*)"/;
/** How deep the pages indent the tags in their head. */
const HEAD_INDENT = '\n    ';

/**
 * Link previews: the Open Graph and Twitter card tags that chats and feeds read, without running
 * the page's scripts, to draw a link to the site as a card. A page asks for one by naming its
 * picture (`<meta property="og:image" content="/previews/….jpg">`); this plugin adds the rest
 * from the page's own title and description, and names the picture by its full address where the
 * site is served, as the cards require (the build's own paths are relative).
 */
export function linkPreviews(siteUrl: string): Plugin {
  return {
    name: 'link-previews',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const picture = PICTURE_TAG.exec(html);
        if (!picture) return html;
        const properties = [
          ['og:type', 'website'],
          ['og:site_name', SITE_NAME],
          ['og:title', TITLE.exec(html)?.[1] ?? SITE_NAME],
          ['og:description', DESCRIPTION.exec(html)?.[1] ?? ''],
          ['og:image', new URL(picture[1].replace(/^\.?\//, ''), siteUrl).href],
          ['og:image:width', String(PICTURE.width)],
          ['og:image:height', String(PICTURE.height)],
        ];
        const tags = properties.map(([key, content]) => `<meta property="${key}" content="${content}" />`);
        tags.push('<meta name="twitter:card" content="summary_large_image" />');
        return html.replace(picture[0], tags.join(HEAD_INDENT));
      },
    },
  };
}
