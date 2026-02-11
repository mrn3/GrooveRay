import { useState } from 'react';
import { songs as songsApi } from '../api';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Choose a file first');
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      await songsApi.upload(file, title || file.name, artist || 'Unknown');
      setMessage('Uploaded successfully');
      setFile(null);
      setTitle('');
      setArtist('');
    } catch (err) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Upload song</h1>
      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 rounded-2xl border border-groove-700 bg-groove-900/50 p-6">
        {message && (
          <p className={`rounded-lg px-3 py-2 text-sm ${message.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm text-gray-400">File</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white file:mr-4 file:rounded file:border-0 file:bg-ray-600 file:px-3 file:py-1 file:text-sm file:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Artist</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist name"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
          />
        </div>
        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </div>
  );
}
