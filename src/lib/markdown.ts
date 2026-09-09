/**
 * Safe client-side Markdown to HTML converter.
 * Escapes HTML to prevent XSS, converts basic markdown constructs into HTML.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function inlineMarkdown(s: string): string {
  let out = s.replace(/`([^`]+)`/g, '<code class="bg-black/40 text-primary px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  return out;
}

export function markdownToHtml(md: string): string {
  if (!md) return "";

  const text = md.replace(/\r\n/g, "\n");
  const parts: string[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const lang = match[1];
    const code = escapeHtml(match[2].trimEnd());
    parts.push(`__CODE_BLOCK_${lang}__${code}__END_CODE__`);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  const htmlBlocks: string[] = [];

  for (const part of parts) {
    if (part.startsWith("__CODE_BLOCK_")) {
      const matchCode = part.match(/^__CODE_BLOCK_([a-zA-Z0-9_-]*)__([\s\S]*?)__END_CODE__$/);
      if (matchCode) {
        const code = matchCode[2];
        htmlBlocks.push(
          `<pre class="my-2 p-3 rounded-lg bg-black/60 border border-white/10 text-xs font-mono overflow-x-auto text-emerald-400"><code>${code}</code></pre>`
        );
      }
      continue;
    }

    const blocks = part.split(/\n\n+/);
    for (const rawBlock of blocks) {
      const trimmed = rawBlock.trim();
      if (!trimmed) continue;

      const lines = trimmed.split("\n");

      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        const items = lines
          .map((l) => `<li class="ml-4 list-disc">${inlineMarkdown(escapeHtml(l.replace(/^\s*[-*]\s+/, "")))}</li>`)
          .join("");
        htmlBlocks.push(`<ul class="my-2 space-y-1">${items}</ul>`);
        continue;
      }

      if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
        const items = lines
          .map((l) => `<li class="ml-4 list-decimal">${inlineMarkdown(escapeHtml(l.replace(/^\s*\d+\.\s+/, "")))}</li>`)
          .join("");
        htmlBlocks.push(`<ol class="my-2 space-y-1">${items}</ol>`);
        continue;
      }

      if (trimmed.startsWith("### ")) {
        htmlBlocks.push(`<h3 class="text-sm font-semibold mt-3 mb-1 text-foreground">${inlineMarkdown(escapeHtml(trimmed.slice(4)))}</h3>`);
        continue;
      }
      if (trimmed.startsWith("## ")) {
        htmlBlocks.push(`<h2 class="text-base font-semibold mt-4 mb-1 text-foreground">${inlineMarkdown(escapeHtml(trimmed.slice(3)))}</h2>`);
        continue;
      }
      if (trimmed.startsWith("# ")) {
        htmlBlocks.push(`<h1 class="text-lg font-bold mt-4 mb-2 text-foreground">${inlineMarkdown(escapeHtml(trimmed.slice(2)))}</h1>`);
        continue;
      }

      const pContent = lines.map((l) => inlineMarkdown(escapeHtml(l))).join("<br />");
      htmlBlocks.push(`<p class="my-1.5 leading-relaxed">${pContent}</p>`);
    }
  }

  return htmlBlocks.join("");
}
