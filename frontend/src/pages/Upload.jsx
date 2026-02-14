import { useState } from 'react';
import { songs as songsApi } from '../api';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [guitarTab, setGuitarTab] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // 0–100 or null
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Choose a file first');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setMessage('');
    const extra = {};
    if (description.trim()) extra.description = description.trim();
    if (lyrics.trim()) extra.lyrics = lyrics.trim();
    if (guitarTab.trim()) extra.guitar_tab = guitarTab.trim();
    try {
      await songsApi.uploadWithProgress(
        file,
        title || file.name,
        artist || 'Unknown',
        (percent) => setUploadProgress(percent),
        extra
      );
      setMessage('Uploaded successfully');
      setFile(null);
      setTitle('');
      setArtist('');
      setDescription('');
      setLyrics('');
      setGuitarTab('');
    } catch (err) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
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
        <div>
          <label className="mb-1 block text-sm text-gray-400">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="About this song…"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Lyrics (optional, use [M:SS] for karaoke)</label>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            placeholder="[0:12] First line…"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 font-mono text-sm text-white placeholder-gray-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Guitar tab (optional)</label>
          <textarea
            value={guitarTab}
            onChange={(e) => setGuitarTab(e.target.value)}
            rows={4}
            placeholder="e|-----0---0---| …"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 font-mono text-sm text-white placeholder-gray-500"
          />
        </div>
        {uploading && (
          <div className="space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-groove-700">
              <div
                className="h-full rounded-full bg-ray-500 transition-all duration-300"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-400">
              Uploading… {uploadProgress != null ? `${uploadProgress}%` : ''}
            </p>
          </div>
        )}
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
