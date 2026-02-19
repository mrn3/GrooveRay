/**
 * Only return a URL for use in <img src> when it is our self-hosted upload path.
 * Prevents hot-loading external image links; we only display images we host.
 */
export function selfHostedImageUrl(url) {
  return url && typeof url === 'string' && url.startsWith('/api/uploads/') ? url : null;
}
