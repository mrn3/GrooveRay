import { useState } from 'react';
import { ai as aiApi } from '../api';

export default function AIGenerate() {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const song = await aiApi.generate({ prompt, genre, mood });
      setMessage(`Created: "${song.title}". (Demo: no actual audio generated; plug in an AI API for real generation.)`);
      setPrompt('');
      setGenre('');
      setMood('');
    } catch (err) {
      setMessage(err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">AI Music</h1>
      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 rounded-2xl border border-groove-700 bg-groove-900/50 p-6">
        {message && (
          <p className="rounded-lg bg-ray-500/20 px-3 py-2 text-sm text-ray-200">{message}</p>
        )}
        <div>
          <label className="mb-1 block text-sm text-gray-400">Prompt (optional)</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. upbeat summer anthem"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Genre</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="e.g. House, Lo-fi"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Mood</label>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="e.g. Chill, Energetic"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate track'}
        </button>
      </form>
      <p className="mt-4 max-w-md text-sm text-gray-500">
        GrooveRay AI creates a track entry in your library. For real audio generation, integrate an API like Replicate, Suno, or Mubert in the backend.
      </p>
    </div>
  );
}
