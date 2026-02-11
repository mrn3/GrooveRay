/**
 * GrooveRay logo — orange circle with black ray.
 * Background: orange. Ray: black (from image, applied via mask).
 */
import { useId } from 'react';

const ORANGE = '#eb751a'; // brand ray color

export default function Logo({ className = 'h-8 w-8', showWordmark = true, wordmarkClassName = '' }) {
  const clipId = useId();
  const maskId = useId();
  const invertId = useId();
  return (
    <span className={`inline-flex items-center gap-2 ${wordmarkClassName}`}>
      <svg
        viewBox="0 0 64 64"
        className={className}
        aria-hidden
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="32" cy="32" r="30" />
          </clipPath>
          <filter id={invertId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
            />
          </filter>
          <mask id={maskId}>
            <image
              href="/ray-logo.png"
              x="0"
              y="0"
              width="64"
              height="64"
              preserveAspectRatio="xMidYMid meet"
              filter={`url(#${invertId})`}
            />
          </mask>
        </defs>
        <circle cx="32" cy="32" r="30" fill={ORANGE} />
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="64" height="64" fill="black" mask={`url(#${maskId})`} />
        </g>
      </svg>
      {showWordmark && <span className="font-semibold text-inherit">GrooveRay</span>}
    </span>
  );
}
