import katex from "katex";

/**
 * LaTeX rendering that produces an HTML STRING.
 *
 * The obvious approach, KaTeX's auto-render walking a live DOM node, does not
 * survive React: it mutates nodes React owns, so the next reconcile restores the
 * original text and a second auto-render pass duplicates everything. Rendering
 * to a string and handing it to dangerouslySetInnerHTML keeps React the only
 * thing that touches the DOM. It also works unchanged on the server.
 */

const BACKSLASH = String.fromCharCode(92);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Segment =
  | { math: false; text: string }
  | { math: true; tex: string; display: boolean };

/**
 * Find the closing delimiter, stepping over escape pairs.
 *
 * Money problems carry an escaped dollar INSIDE math, e.g. "$\$12.50$". A plain
 * indexOf would close the span on that escaped dollar and mangle the rest.
 */
function findClose(src: string, from: number, delim: string): number {
  let i = from;
  while (i < src.length) {
    if (src[i] === BACKSLASH) {
      i += 2;
      continue;
    }
    if (src.startsWith(delim, i)) return i;
    i += 1;
  }
  return -1;
}

/** Split a string into alternating prose and math runs. */
function scan(src: string): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // An escaped dollar is currency, not a delimiter. Competition statements are
    // full of prices, and treating those as math is what corrupts them.
    if (ch === BACKSLASH && src[i + 1] === "$") {
      buf += "$";
      i += 2;
      continue;
    }

    if (ch === "$") {
      const display = src[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const end = findClose(src, i + delim.length, delim);
      if (end !== -1) {
        if (buf) {
          out.push({ math: false, text: buf });
          buf = "";
        }
        out.push({ math: true, tex: src.slice(i + delim.length, end), display });
        i = end + delim.length;
        continue;
      }
      // Unpaired delimiter: treat it as a literal character.
    }

    buf += ch;
    i += 1;
  }

  if (buf) out.push({ math: false, text: buf });
  return out;
}

function renderSegments(segments: Segment[], escapeProse: boolean): string {
  return segments
    .map((seg) => {
      if (!seg.math) return escapeProse ? escapeHtml(seg.text) : seg.text;
      try {
        return katex.renderToString(seg.tex, {
          displayMode: seg.display,
          throwOnError: true,
          strict: false,
        });
      } catch {
        // Show the source rather than KaTeX's red error markup. A handful of
        // scraped statements carry malformed TeX, and unreadable prose beats a
        // wall of error text.
        const d = seg.display ? "$$" : "$";
        return '<span class="tex-raw">' + escapeHtml(d + seg.tex + d) + "</span>";
      }
    })
    .join("");
}

/**
 * Rendering is pure and deterministic, so results are worth keeping. A browse
 * page re-renders whenever medals arrive or a page is appended, and without this
 * every visible statement would be typeset again from scratch each time.
 * Bounded so a long session cannot grow it without limit.
 */
const RENDER_CACHE = new Map<string, string>();
const RENDER_CACHE_MAX = 600;

function memoized(key: string, render: () => string): string {
  const hit = RENDER_CACHE.get(key);
  if (hit !== undefined) return hit;
  const out = render();
  if (RENDER_CACHE.size >= RENDER_CACHE_MAX) RENDER_CACHE.clear();
  RENDER_CACHE.set(key, out);
  return out;
}

/** Render plain text that may contain math. Prose is HTML-escaped. */
export function latexToHtml(text: string | null | undefined): string {
  if (!text) return "";
  return memoized("t:" + text, () => renderSegments(scan(text), true));
}

/**
 * Render math inside trusted HTML (ladder rung bodies, review layers), leaving
 * markup intact. Content inside <svg> is skipped: diagram labels are plain text
 * by house rule, and a stray "$" there must not be treated as math.
 */
export function latexInHtml(html: string | null | undefined): string {
  if (!html) return "";
  return memoized("h:" + html, () => renderInHtml(html));
}

function renderInHtml(html: string): string {
  const parts = html.split(/(<svg[\s\S]*?<\/svg>)/gi);
  return parts
    .map((part) => {
      if (/^<svg/i.test(part)) return part;
      // Only the text between tags is eligible for math rendering.
      return part.replace(/(<[^>]+>)|([^<]+)/g, (_m, tag: string, text: string) =>
        tag ? tag : renderSegments(scan(text), false)
      );
    })
    .join("");
}
