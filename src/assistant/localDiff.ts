export function formatLocalDiff(previousMarkdown: string, nextMarkdown: string) {
  const previousLines = previousMarkdown.replace(/\r\n/g, "\n").split("\n");
  const nextLines = nextMarkdown.replace(/\r\n/g, "\n").split("\n");
  const maxLength = Math.max(previousLines.length, nextLines.length);
  const diffLines: string[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const previousLine = previousLines[index];
    const nextLine = nextLines[index];

    if (previousLine === nextLine) {
      if (previousLine !== undefined) {
        diffLines.push(`  ${previousLine}`);
      }
      continue;
    }

    if (previousLine !== undefined && nextLine !== undefined) {
      diffLines.push(formatChangedLine(previousLine, nextLine));
    } else {
      if (previousLine !== undefined) {
        diffLines.push(`- ${previousLine}`);
      }

      if (nextLine !== undefined) {
        diffLines.push(`+ ${nextLine}`);
      }
    }
  }

  return diffLines.join("\n") || "No text changes.";
}

function formatChangedLine(previousLine: string, nextLine: string) {
  const previousWords = previousLine.split(/(\s+)/);
  const nextWords = nextLine.split(/(\s+)/);
  let prefixLength = 0;

  while (
    prefixLength < previousWords.length &&
    prefixLength < nextWords.length &&
    previousWords[prefixLength] === nextWords[prefixLength]
  ) {
    prefixLength += 1;
  }

  let previousSuffix = previousWords.length - 1;
  let nextSuffix = nextWords.length - 1;

  while (
    previousSuffix >= prefixLength &&
    nextSuffix >= prefixLength &&
    previousWords[previousSuffix] === nextWords[nextSuffix]
  ) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  return [
    `- ${markChangedWords(previousWords, prefixLength, previousSuffix)}`,
    `+ ${markChangedWords(nextWords, prefixLength, nextSuffix)}`,
  ].join("\n");
}

function markChangedWords(parts: string[], start: number, end: number) {
  return parts
    .map((part, index) =>
      index >= start && index <= end && part.trim() ? `[${part}]` : part,
    )
    .join("");
}
