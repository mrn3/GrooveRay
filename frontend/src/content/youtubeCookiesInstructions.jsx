/**
 * Single source of copy for "how to set up YouTube cookies".
 * Used by: Profile page (info bubble) and Songs page ("Add from YouTube" modal when cookies not set).
 */

export const COOKIES_EXTENSION_URL = 'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc';

const linkClass = 'text-ray-400 underline hover:text-ray-300';

/**
 * Renders the shared YouTube cookies setup instructions.
 * @param {Object} props
 * @param {boolean} [props.showScreenshot=true] - Whether to show the extension screenshot (e.g. false in compact modals).
 * @param {string} [props.className] - Optional class for the wrapper.
 */
export function YouTubeCookiesInstructions({ showScreenshot = true, className = '' }) {
  return (
    <div className={className}>
      <p className="mb-2">To add songs from YouTube, we need cookies from your browser (while logged into YouTube).</p>
      <ol className="list-decimal list-inside space-y-1">
        <li>
          Install the Chrome extension{' '}
          <a href={COOKIES_EXTENSION_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Get cookies.txt LOCALLY</a>.
        </li>
        <li>
          Go to <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className={linkClass}>youtube.com</a> and make sure you're signed in.
          {showScreenshot && (
            <img src="/youtube-screenshot.png" alt="YouTube homepage while signed in" className="mt-2 block max-w-full rounded border border-groove-600" />
          )}
        </li>
        <li>
          Use the extension to export cookies in Netscape format and click the Copy button.
          {showScreenshot && (
            <img src="/cookies-extension-screenshot.png" alt="Get cookies.txt extension with Netscape format and Copy button" className="mt-2 block max-w-full rounded border border-groove-600" />
          )}
        </li>
        <li>Go to your <a href="/profile" className={linkClass}>profile</a>, click &quot;Edit Cookies&quot; and paste the entire contents into the modal, then save.</li>
      </ol>
    </div>
  );
}
