import { useState, useEffect } from 'react';
import { torrents as torrentsApi } from '../api';

export default function Torrents() {
  const [magnet, setMagnet] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadJobs = () => {
    torrentsApi.jobs().then(setJobs).catch(() => setJobs([]));
  };

  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 3000);
    return () => clearInterval(t);
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!magnet.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await torrentsApi.add(magnet.trim());
      setMessage('Download started');
      setMagnet('');
      loadJobs();
    } catch (err) {
      setMessage(err.message || 'Failed to add torrent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Torrents</h1>
      <form onSubmit={handleAdd} className="mb-8 max-w-2xl">
        {message && (
          <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.includes('started') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </p>
        )}
        <label className="mb-2 block text-sm text-gray-400">Magnet link or torrent URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={magnet}
            onChange={(e) => setMagnet(e.target.value)}
            placeholder="magnet:?xt=urn:btih:..."
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
          <p className="py-6 text-center text-gray-500">No torrents yet. Paste a magnet link above.</p>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-lg border border-groove-600 bg-groove-800 px-4 py-3"
            >
              <code className="max-w-md truncate text-sm text-gray-400">{job.magnet_or_torrent.slice(0, 60)}…</code>
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
