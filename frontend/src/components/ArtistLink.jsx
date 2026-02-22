import { Link } from 'react-router-dom';

/**
 * Renders an artist name as a link to the artist detail page.
 * Use anywhere an artist is referenced so users can navigate to the artist page.
 */
export default function ArtistLink({ artist, className = '' }) {
  if (artist == null || String(artist).trim() === '') {
    return <span className={className}>—</span>;
  }
  const name = String(artist).trim();
  const to = `/artists/${encodeURIComponent(name)}`;
  return (
    <Link to={to} className={`text-ray-400 hover:underline ${className}`}>
      {name}
    </Link>
  );
}
