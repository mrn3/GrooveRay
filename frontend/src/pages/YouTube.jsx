import { useState, useEffect } from 'react';
import { youtube as youtubeApi } from '../api';

export default function YouTube() {
  const [url, setUrl] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadJobs = () => {
    youtubeApi.jobs().then(setJobs).catch(() => setJobs([]));
  };

  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 3000);
    return () => clearInterval(t);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await youtubeApi.add(url.trim());
      setMessage('Download started — audio will be added to your library when ready.');
      setUrl('');
      loadJobs();
    } catch (err) {
      setMessage(err.message || 'Failed to add YouTube link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">YouTube</h1>
      <p className="mb-4 text-gray-400">
        Paste a YouTube music video link. We’ll extract the audio and add it to your library.
      </p>
      <form onSubmit={handleAdd} className="mb-8 max-w-2xl">
        {message && (
          <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.includes('started') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </p>
        )}
        <label className="mb-2 block text-sm text-gray-400">YouTube video URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
            className="flex-1 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-ray-600 px-6 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>
      <h2 className="mb-3 text-lg font-medium text-white">Downloads</h2>
      <div className="space-y-2 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
        {jobs.length === 0 ? (
          <p className="py-6 text-center text-gray-500">No YouTube links yet. Paste a music video URL above.</p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg border border-groove-600 bg-groove-800 px-4 py-3"
            >
              <code className="max-w-md truncate text-sm text-gray-400">{job.url}</code>
              <span className={`rounded px-2 py-1 text-xs font-medium ${
                job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-ray-500/20 text-ray-400'
              }`}>
                {job.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
