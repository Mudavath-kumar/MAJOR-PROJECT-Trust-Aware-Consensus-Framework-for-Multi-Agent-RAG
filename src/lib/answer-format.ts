export type AnswerBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

function flushParagraph(blocks: AnswerBlock[], lines: string[]) {
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (text) blocks.push({ type: "paragraph", text });
  lines.length = 0;
}

/** Convert the small Markdown subset emitted by the answer agent into UI blocks. */
export function parseAnswerBlocks(answer: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (list?.items.length) blocks.push({ type: "list", ...list });
    list = null;
  };

  for (const rawLine of answer.replace(/```(?:markdown)?/gi, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const unordered = line.match(/^[-*•]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);

    if (!line) {
      flushParagraph(blocks, paragraph);
      flushList();
      continue;
    }

    if (heading) {
      flushParagraph(blocks, paragraph);
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    if (unordered || ordered) {
      flushParagraph(blocks, paragraph);
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      const item = unordered?.[1] ?? (ordered ? ordered[1] : "");
      if (item) list.items.push(item.trim());
      continue;
    }

    if (list) {
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph(blocks, paragraph);
  flushList();
  return blocks;
}
