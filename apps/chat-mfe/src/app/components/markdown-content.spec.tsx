import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownContent } from './markdown-content';

describe('MarkdownContent', () => {
  it('should render plain text in paragraph', () => {
    const { container } = render(<MarkdownContent content="Simple plain text paragraph" />);
    expect(container.textContent).toContain('Simple plain text paragraph');
    expect(container.querySelector('p')).not.toBeNull();
  });

  it('should render bold, italic, and inline code formatting', () => {
    const { container } = render(
      <MarkdownContent content="Telemetry **critical** on *esp32c6* node with `temperature` metric." />
    );

    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('critical');

    const em = container.querySelector('em');
    expect(em?.textContent).toBe('esp32c6');

    const code = container.querySelector('code');
    expect(code?.textContent).toBe('temperature');
  });

  it('should render code blocks with language tag', () => {
    const markdown = '```json\n{"status": "ok", "anomalies": []}\n```';
    const { container } = render(<MarkdownContent content={markdown} />);

    expect(container.textContent).toContain('JSON');
    expect(container.textContent).toContain('{"status": "ok", "anomalies": []}');
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('should render unordered bullet list', () => {
    const markdown = '- Node esp32c6 is normal\n- Node esp32s3 has a spike';
    const { container } = render(<MarkdownContent content={markdown} />);

    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(2);
    expect(listItems[0].textContent).toContain('Node esp32c6 is normal');
    expect(listItems[1].textContent).toContain('Node esp32s3 has a spike');
  });

  it('should render summary table', () => {
    const markdown = '| Device | Metric | Status |\n|---|---|---|\n| esp32c6 | 24.5 °C | Normal |\n| esp32s3 | 42.1 °C | Anomaly |';
    const { container } = render(<MarkdownContent content={markdown} />);

    expect(container.querySelector('table')).not.toBeNull();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('esp32c6');
    expect(rows[1].textContent).toContain('Anomaly');
  });

  it('should render safe http and https links as anchor tags', () => {
    const markdown = 'Visit [Dashboard](http://localhost:4200) or [Docs](https://example.com)';
    const { container } = render(<MarkdownContent content={markdown} />);

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('http://localhost:4200');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noreferrer');
    expect(links[1].getAttribute('href')).toBe('https://example.com');
  });

  it('should sanitize unsafe javascript and data links to prevent XSS', () => {
    const markdown = 'Click [Exploit](javascript:alert(1)) or [Data](data:text/html,<script>alert(1)</script>)';
    const { container } = render(<MarkdownContent content={markdown} />);

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(0);

    expect(container.textContent).toContain('Click Exploit or Data');
    const spans = container.querySelectorAll('span');
    const texts = Array.from(spans).map((s) => s.textContent);
    expect(texts).toContain('Exploit');
    expect(texts).toContain('Data');
  });
});

