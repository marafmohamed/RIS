'use client';

import { useEffect, useState } from 'react';

export default function OHIFViewer({ studyUid, clinicId }) {
  const [viewerUrl, setViewerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const setupViewer = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (!token) {
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }

        // Use the proxy's viewer endpoint which handles authentication server-side
        // This avoids browser blocking of HTTP Basic Auth popups in iframes
        let url = `${apiUrl}/proxy/viewer?StudyInstanceUIDs=${studyUid}&token=${token}`;
        if (clinicId) {
          url += `&clinicId=${clinicId}`;
        }

        setViewerUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Setup viewer error:', err);
        setError('Failed to load viewer configuration');
        setLoading(false);
      }
    };

    setupViewer();
  }, [studyUid, clinicId]);

  if (error) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="text-white text-sm">Loading viewer...</div>
        </div>
      )}
      {viewerUrl && (
        <iframe
          src={viewerUrl}
          className="w-full h-full border-0"
          allow="fullscreen"
          title="OHIF Viewer"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Failed to load OHIF viewer');
            setLoading(false);
          }}
        />
      )}
    </div>
  );
}