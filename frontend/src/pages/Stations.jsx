import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stations as stationsApi } from '../api';

export default function Stations() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    return stationsApi
      .list()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await stationsApi.create(createName.trim(), createDesc.trim());
      setCreateName('');
      setCreateDesc('');
      load();
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" /></div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Stations</h1>
      <p className="mb-6 text-gray-400">Crowd-sourced radio: create a station, add songs to the queue, and upvote. Most upvoted plays next.</p>

      {user && (
        <form onSubmit={handleCreate} className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Station name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="My station"
              className="w-64 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Description (optional)</label>
            <input
              type="text"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Description"
              className="w-64 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !createName.trim()}
            className="rounded-lg bg-ray-600 px-6 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50"
          >
            Create station
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 ? (
          <p className="col-span-full py-12 text-center text-gray-500">No stations yet. Create one above.</p>
        ) : (
          list.map((s) => (
            <Link
              key={s.id}
              to={`/stations/${s.slug}`}
              className="block rounded-xl border border-groove-700 bg-groove-900/50 p-5 transition hover:border-ray-500/50 hover:bg-groove-800/50"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-500">
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl">◇</span>
                  )}
                </div>
                <h2 className="font-semibold text-white">{s.name}</h2>
              </div>
              {s.description && <p className="mb-2 line-clamp-2 text-sm text-gray-400">{s.description}</p>}
              <p className="text-xs text-gray-500">by {s.owner_name}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
