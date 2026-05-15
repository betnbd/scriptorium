import type { ParsedAssistantResult } from "./responseParser";

interface DiffHunk {
  oldStart: number;
  oldLines: string[];
  newLines: string[];
}

const DIFF_APPLY_ERROR = "Diff could not be applied to the current document.";

export function applyAssistantResult(
  currentMarkdown: string,
  result: ParsedAssistantResult,
): string {
  if (result.kind === "rewrite") {
    return result.markdown;
  }

  if (result.kind === "diff") {
    return applySimpleUnifiedDiff(currentMarkdown, result.patch);
  }

  return currentMarkdown;
}

function applySimpleUnifiedDiff(currentMarkdown: string, patch: string): string {
  const hunks = parseUnifiedDiff(patch);

  if (hunks.length === 0) {
    throw new Error(DIFF_APPLY_ERROR);
  }

  const document = splitMarkdownLines(currentMarkdown);
  let offset = 0;

  for (const hunk of hunks) {
    const expectedIndex = Math.max(0, hunk.oldStart - 1 + offset);
    const index = findHunkIndex(document.lines, hunk.oldLines, expectedIndex);

    document.lines.splice(index, hunk.oldLines.length, ...hunk.newLines);
    offset += hunk.newLines.length - hunk.oldLines.length;
  }

  return joinMarkdownLines(document.lines, document.hasFinalNewline);
}

function parseUnifiedDiff(patch: string): DiffHunk[] {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  const hunks: DiffHunk[] = [];
  let index = 0;

  while (index < lines.length) {
    const header = lines[index];
    const headerMatch = header.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/);

    if (!headerMatch) {
      index += 1;
      continue;
    }

    const hunk: DiffHunk = {
      oldStart: Number(headerMatch[1]),
      oldLines: [],
      newLines: [],
    };

    index += 1;

    while (index < lines.length && !lines[index].startsWith("@@ ")) {
      const line = lines[index];

      if (line.startsWith(" ")) {
        const value = line.slice(1);
        hunk.oldLines.push(value);
        hunk.newLines.push(value);
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        hunk.oldLines.push(line.slice(1));
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        hunk.newLines.push(line.slice(1));
      } else if (line.startsWith("\\ No newline at end of file")) {
        // Git emits this marker as metadata, not document content.
      } else if (line === "") {
        throw new Error(DIFF_APPLY_ERROR);
      } else {
        throw new Error(DIFF_APPLY_ERROR);
      }

      index += 1;
    }

    hunks.push(hunk);
  }

  return hunks;
}

function splitMarkdownLines(markdown: string): {
  lines: string[];
  hasFinalNewline: boolean;
} {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const hasFinalNewline = normalized.endsWith("\n");
  const lines = normalized.split("\n");

  if (hasFinalNewline) {
    lines.pop();
  }

  return { lines, hasFinalNewline };
}

function joinMarkdownLines(lines: string[], hasFinalNewline: boolean): string {
  return `${lines.join("\n")}${hasFinalNewline ? "\n" : ""}`;
}

function findHunkIndex(
  lines: string[],
  oldLines: string[],
  expectedIndex: number,
): number {
  if (matchesAt(lines, oldLines, expectedIndex)) {
    return expectedIndex;
  }

  const matches: number[] = [];

  for (let index = 0; index <= lines.length - oldLines.length; index += 1) {
    if (matchesAt(lines, oldLines, index)) {
      matches.push(index);
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  throw new Error(DIFF_APPLY_ERROR);
}

function matchesAt(lines: string[], expected: string[], startIndex: number) {
  if (startIndex < 0 || startIndex + expected.length > lines.length) {
    return false;
  }

  return expected.every((line, index) => lines[startIndex + index] === line);
}
