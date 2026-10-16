import React from 'react';

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Parses inline formatting like bold, italic, and inline code spans safely into React nodes.
 */
export function formatInlineText(text: string): React.ReactNode[] {
  // Regex pattern matching:
  // 1. Code span: `code`
  // 2. Bold: **text**
  // 3. Italic: *text*
  // 4. Link: [label](url)
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="bg-black/30 text-accent font-mono text-xs px-1.5 py-0.5 rounded border border-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-text-primary">
          {part.slice(1, -1)}
        </em>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline hover:text-accent/80 transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Lightweight, zero-dependency Markdown block renderer.
 * Handles paragraphs, code blocks, lists, and tables safely into native React elements.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      const lang = line.trim().slice(3).trim();
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      elements.push(
        <div
          key={`code-${elements.length}`}
          className="my-2.5 rounded-lg border border-white/10 bg-surface-deep overflow-hidden"
        >
          {lang && (
            <div className="px-3 py-1 bg-white/5 border-b border-white/10 text-[10px] font-mono text-text-muted uppercase">
              {lang.toUpperCase()}
            </div>
          )}
          <pre className="p-3 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown Table: line starting and ending with |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        // Row 1 is usually the separator line (|---|---|)
        const dataRows = tableLines.slice(2).map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        );

        elements.push(
          <div
            key={`table-${elements.length}`}
            className="my-2.5 overflow-x-auto border border-white/10 rounded-lg"
          >
            <table className="w-full text-xs text-left text-text-secondary border-collapse">
              <thead className="bg-white/5 text-white font-medium border-b border-white/10">
                <tr>
                  {headerRow.map((col, idx) => (
                    <th key={idx} className="px-3 py-2">
                      {formatInlineText(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.02]">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-1.5">
                        {formatInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Unordered List: - item or * item
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        listItems.push(lines[i].trim().slice(2).trim());
        i++;
      }
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-1.5 pl-5 list-disc space-y-1 text-sm text-text-primary">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {formatInlineText(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered List: 1. item
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s*/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-1.5 pl-5 list-decimal space-y-1 text-sm text-text-primary">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {formatInlineText(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Heading: ### Header
    if (line.trim().startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const text = line.replace(/^#+\s*/, '');
      const headingClass =
        level === 1
          ? 'text-base font-bold text-white mt-3 mb-1.5'
          : level === 2
          ? 'text-sm font-semibold text-white mt-2.5 mb-1'
          : 'text-xs font-semibold text-accent uppercase tracking-wider mt-2 mb-1';

      elements.push(
        <div key={`h-${elements.length}`} className={headingClass}>
          {formatInlineText(text)}
        </div>
      );
      i++;
      continue;
    }

    // Standard paragraph or empty line
    if (line.trim().length > 0) {
      elements.push(
        <p key={`p-${elements.length}`} className="my-1.5 text-sm leading-relaxed text-text-primary">
          {formatInlineText(line)}
        </p>
      );
    }
    i++;
  }

  return <div className={`markdown-body space-y-1 ${className}`}>{elements}</div>;
};

export default MarkdownContent;
