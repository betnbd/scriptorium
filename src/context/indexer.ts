import type { IndexedDocument } from "../types";

interface MarkdownInput {
  path: string;
  relativePath: string;
  markdown: string;
  modifiedAt: number;
}

interface SelectContextInput {
  documents: IndexedDocument[];
  targetPath: string;
  instruction: string;
  limit: number;
}

export function buildIndex(files: MarkdownInput[]): IndexedDocument[] {
  return files.map((file) => ({
    path: file.path,
    relativePath: file.relativePath,
    title: titleFromMarkdown(file.markdown, file.relativePath),
    headings: extractHeadings(file.markdown),
    links: extractLinks(file.markdown),
    chunks: chunkMarkdown(file.markdown),
    modifiedAt: file.modifiedAt,
  }));
}

export function selectRelevantContext({
  documents,
  targetPath,
  instruction,
  limit,
}: SelectContextInput): IndexedDocument[] {
  const terms = tokenize(instruction);

  return documents
    .filter((doc) => doc.path !== targetPath)
    .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.doc.modifiedAt - a.doc.modifiedAt ||
        a.doc.relativePath.localeCompare(b.doc.relativePath) ||
        a.doc.path.localeCompare(b.doc.path),
    )
    .slice(0, limit)
    .map((entry) => entry.doc);
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  return extractHeadings(markdown)[0] ?? fallback;
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function extractLinks(markdown: string): string[] {
  const links = new Set<string>();
  const linkPattern =
    /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

  for (const match of markdown.matchAll(linkPattern)) {
    const label = match[1] ?? match[2] ?? match[3];
    if (label?.trim()) {
      links.add(label.trim());
    }
  }

  return [...links];
}

function chunkMarkdown(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function scoreDocument(doc: IndexedDocument, terms: string[]): number {
  const docTerms = new Set(
    tokenize(
      [
        doc.relativePath,
        doc.title,
        ...doc.headings,
        ...doc.links,
        ...doc.chunks,
      ].join(" "),
    ),
  );

  return terms.reduce(
    (score, term) => score + (docTerms.has(term) ? 1 : 0),
    0,
  );
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
}
