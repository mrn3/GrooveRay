/**
 * Fetches a thumbnail image URL for a playlist based on its name and description
 * using the Unsplash API. Set UNSPLASH_ACCESS_KEY in .env to enable.
 * @param {string} name - Playlist name
 * @param {string|null|undefined} description - Playlist description (optional)
 * @returns {Promise<string|null>} Image URL or null
 */
export async function fetchThumbnailForPlaylist(name, description) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey?.trim()) return null;

  const query = [name, description].filter(Boolean).join(' ').trim();
  if (!query) return null;

  const search = encodeURIComponent(query.slice(0, 200));
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
