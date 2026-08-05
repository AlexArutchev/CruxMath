import { latexToHtml, latexInHtml } from "@/lib/latex";

/**
 * Render LaTeX without ever handing the DOM to KaTeX.
 *
 * `mode="text"` treats the input as prose that may contain math and escapes it.
 * `mode="html"` treats it as trusted markup (ladder rungs, review layers) and
 * only renders math in the text between tags.
 */
export default function Tex({
  children,
  mode = "text",
  className,
  as: Tag = "div",
}: {
  children: string | null | undefined;
  mode?: "text" | "html";
  className?: string;
  as?: "div" | "span" | "p";
}) {
  const html = mode === "html" ? latexInHtml(children) : latexToHtml(children);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
