"use client";

import { useState } from "react";

export default function StarRating({
  onRate,
  initial = 0,
  size = 28,
  accent = "#f5f5f7",
  readOnly = false,
}: {
  onRate?: (n: number) => void;
  initial?: number;
  size?: number;
  accent?: string;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const [picked, setPicked] = useState(initial);
  const shown = hover || picked;

  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(0)}
            onClick={() => {
              if (readOnly) return;
              setPicked(n);
              onRate?.(n);
            }}
            className="transition-transform hover:scale-110 disabled:cursor-default"
            aria-label={`${n} stars`}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill={filled ? accent : "none"}
              stroke={accent}
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
