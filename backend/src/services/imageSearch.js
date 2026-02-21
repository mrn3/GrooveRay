/**
 * Returns an image URL for a search query using Unsplash.
 * Tries the query, then broader fallbacks (fewer terms), then a generic "music" search.
 * Picks a random result from the first page so repeated calls return different images.
 * Set UNSPLASH_ACCESS_KEY in .env to enable.
 * @param {string} query - Search query (e.g. playlist name, song title + artist)
 * @returns {Promise<string|null>} Image URL or null
 */
const PER_PAGE = 30;
const FALLBACK_QUERIES = ['music', 'album cover', 'music art'];

async function fetchOneRandomResult(accessKey, searchQuery) {
  const search = encodeURIComponent(String(searchQuery).trim().slice(0, 200));
  const url = `https://api.unsplash.com/search/photos?query=${search}&per_page=${PER_PAGE}&client_id=${accessKey}`;

  const res = await fetch(url, {
    headers: { 'Accept-Version': 'v1' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) return null;

  const index = Math.floor(Math.random() * results.length);
  const photo = results[index];
  return photo?.urls?.regular || photo?.urls?.small || photo?.urls?.thumb || null;
}

/**
 * Build fallback queries: original, then with fewer words, then generic terms.
 */
function buildQueriesToTry(q) {
  const trimmed = typeof q === 'string' ? q.trim() : '';
  if (!trimmed) return [...FALLBACK_QUERIES];

  const terms = trimmed.split(/\s+/).filter(Boolean);
  const list = [trimmed];

  for (let n = terms.length - 1; n >= 1; n--) {
    const broader = terms.slice(0, n).join(' ');
    if (broader && !list.includes(broader)) list.push(broader);
  }

  for (const fallback of FALLBACK_QUERIES) {
    if (!list.includes(fallback)) list.push(fallback);
  }
  return list;
}

export async function searchImage(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey?.trim()) return null;

  const q = typeof query === 'string' ? query.trim() : '';
  const queriesToTry = buildQueriesToTry(q || 'music');

  for (const searchQuery of queriesToTry) {
    try {
      const url = await fetchOneRandomResult(accessKey, searchQuery);
      if (url) return url;
    } catch (_) {
      // try next query
    }
  }
  return null;
}
