import katex from "katex";

export function renderKatex(latex: string, inline = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      trust: false,
      strict: "warn",
      displayMode: !inline,
      maxExpand: 1000,
      maxSize: 10,
    });
  } catch {
    return latex;
  }
}

export default function MathContent({
  value,
  inline = false,
}: {
  value: string;
  inline?: boolean;
}) {
  const html = renderKatex(value, inline);
  if (inline) {
    return (
      <span
        className="math math-inline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div
      className="math math-display"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
