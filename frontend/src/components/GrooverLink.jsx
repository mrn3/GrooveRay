import { Link } from 'react-router-dom';

/**
 * Renders a groover (user) username as a link to their public profile.
 * Use anywhere a contributor or user is referenced.
 */
export default function GrooverLink({ username, children, className = '' }) {
  if (username == null || String(username).trim() === '') {
    return children != null ? <span className={className}>{children}</span> : null;
  }
  const handle = String(username).trim();
  const to = `/groovers/${encodeURIComponent(handle)}`;
  return (
    <Link to={to} className={`text-ray-400 hover:underline ${className}`.trim()}>
      {children != null ? children : `@${handle}`}
    </Link>
  );
}
