import { describe, it, expect } from "vitest";
import { markdownToHtml, inlineMarkdown, escapeHtml } from "./markdown";

describe("Markdown Parser Utility", () => {
  it("escapes HTML to prevent XSS", () => {
    const raw = '<script>alert("xss")</script>';
    const escaped = escapeHtml(raw);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  it("handles inline bold, italics, and backticks", () => {
    const text = "This is **bold**, *italic*, and `code`";
    const parsed = inlineMarkdown(text);
    expect(parsed).toContain("<strong>bold</strong>");
    expect(parsed).toContain("<em>italic</em>");
    expect(parsed).toContain("<code");
    expect(parsed).toContain("code</code>");
  });

  it("parses code blocks into pre code elements", () => {
    const md = "Here is code:\n\n```ts\nconst x: number = 42;\n```\n\nDone.";
    const html = markdownToHtml(md);
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("const x: number = 42;");
  });

  it("parses lists and headers correctly", () => {
    const md = "## Topic Overview\n\n- First item\n- Second item";
    const html = markdownToHtml(md);
    expect(html).toContain("<h2");
    expect(html).toContain("Topic Overview</h2>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("First item");
  });
});
