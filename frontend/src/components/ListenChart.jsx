export default function ListenChart({ buckets, scope, hoverBucket, onHover, onHoverScope, onHoverEnd }) {
  const maxCount = Math.max(1, ...(buckets || []).map((b) => b.count));
  return (
    <div className="relative flex items-end gap-0.5" style={{ minHeight: 32 }}>
      {!buckets?.length ? (
        <span className="text-xs text-gray-500">No data for this period</span>
      ) : (
        buckets.map((bucket) => {
          const isHovered = hoverBucket && hoverBucket.date === bucket.date && hoverBucket.label === bucket.label;
          return (
            <div
              key={bucket.label}
              className="group relative flex-1 min-w-0 flex flex-col items-center"
              onMouseEnter={() => {
                onHoverScope?.();
                onHover?.(bucket);
              }}
              onMouseLeave={onHoverEnd}
            >
              <div
                className="w-full rounded-t bg-groove-600 transition hover:bg-ray-500"
                style={{ height: Math.max(4, (bucket.count / maxCount) * 28) }}
                title={`${bucket.label}: ${bucket.count} play${bucket.count !== 1 ? 's' : ''}`}
              />
              {isHovered && bucket.events?.length > 0 && (
                <div className="absolute bottom-full left-1/2 z-50 mb-1 w-56 -translate-x-1/2 rounded-lg border border-groove-600 bg-groove-900 p-2 shadow-xl">
                  <p className="mb-2 text-xs font-medium text-gray-300">{bucket.label}</p>
                  <ul className="max-h-40 overflow-auto text-xs text-gray-400 space-y-1">
                    {bucket.events.map((ev, i) => (
                      <li key={i}>
                        {ev.username} — {ev.played_at ? new Date(ev.played_at).toLocaleString() : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
