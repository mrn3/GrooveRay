/**
 * Returns the first image URL for a search query using Unsplash.
 * Set UNSPLASH_ACCESS_KEY in .env to enable.
 * @param {string} query - Search query (e.g. playlist name, station name, username)
 * @returns {Promise<string|null>} Image URL or null
 */
export async function searchImage(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey?.trim()) return null;

  const q = typeof query === 'string' ? query.trim() : '';
  if (!q) return null;

  const search = encodeURIComponent(q.slice(0, 200));
  const url = `https://api.unsplash.com/search/photos?query=${search}&per_page=1&client_id=${accessKey}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept-Version': 'v1' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data?.results?.[0];
    return photo?.urls?.regular || photo?.urls?.small || photo?.urls?.thumb || null;
  } catch (_) {
    return null;
  }
}
