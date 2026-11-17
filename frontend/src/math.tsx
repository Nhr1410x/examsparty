import katex from "katex";
import "katex/dist/katex.min.css";

export default function MathContent({ value }: { value: string }) {
  return (
    <div
      className="math"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          throwOnError: false,
          trust: false,
          strict: "warn",
          displayMode: true,
          maxExpand: 1000,
          maxSize: 10,
        }),
      }}
    />
  );
}
