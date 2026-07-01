/**
 * Render a short inline-Markdown fragment to HTML, supporting the bold/italic
 * markup the CMS subtitle field produces: `**bold**` and `_italic_`.
 *
 * Plain text is HTML-escaped first (safe for `set:html`); only the emphasis
 * markers are converted. Returns '' for empty/whitespace input so callers can
 * skip rendering. Trusted input only (CMS-authored frontmatter).
 *
 * Deliberately tiny: a full parser (Sätteri/marked) can't run under the
 * Cloudflare adapter's workerd dev runtime.
 */
export function inlineMarkdown(source?: string): string {
  if (!source?.trim()) return '';
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}
