'use client';

import { useEffect, useState } from 'react';

export default function OHIFViewer({ studyUid }) {
  const [viewerUrl, setViewerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const setupViewer = async () => {
      try {
        // Get Orthanc credentials from backend
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        if (!token) {
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }

        const response = await fetch(`${apiUrl}/settings/orthanc-credentials`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Orthanc credentials');
        }

        const credentials = await response.json();
        const { url, username, password } = credentials;

        // Pre-authenticate with Orthanc to establish session
        const authHeader = 'Basic ' + btoa(`${username}:${password}`);
        
        try {
          await fetch(`${url}/studies`, {
            headers: {
              'Authorization': authHeader
            },
            credentials: 'include'
          });
        } catch (e) {
          console.warn('Pre-authentication attempt:', e);
        }

        // Build direct OHIF URL
        const ohifUrl = `${url}/ohif/viewer?StudyInstanceUIDs=${studyUid}`;
        setViewerUrl(ohifUrl);
        setLoading(false);
      } catch (err) {
        console.error('Setup viewer error:', err);
        setError('Failed to load viewer configuration');
        setLoading(false);
      }
    };

    setupViewer();
  }, [studyUid]);

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
