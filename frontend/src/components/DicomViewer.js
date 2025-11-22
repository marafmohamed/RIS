'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function DicomViewer({ studyUid }) {
  const [studyData, setStudyData] = useState(null);
  const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Cache for loaded series instances
  const seriesInstancesCache = useRef(new Map());
  const [loadedInstances, setLoadedInstances] = useState([]);

  useEffect(() => {
    fetchStudyMetadata();
  }, [studyUid]);

  // Load instances for current series when it changes
  useEffect(() => {
    if (studyData && studyData.series[currentSeriesIndex]) {
      loadSeriesInstances(currentSeriesIndex);
    }
  }, [currentSeriesIndex, studyData]);

  const fetchStudyMetadata = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      const response = await axios.get(
        `${apiUrl}/proxy/dicom-images/${studyUid}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setStudyData(response.data);
      setCurrentSeriesIndex(0);
      setCurrentImageIndex(0);
      setError(null);
    } catch (err) {
      console.error('Failed to load study metadata:', err);
      setError('Failed to load DICOM study');
    } finally {
      setLoading(false);
    }
  };

  const loadSeriesInstances = async (seriesIndex) => {
    const series = studyData.series[seriesIndex];
    if (!series) return;

    // Check if already cached
    if (seriesInstancesCache.current.has(series.id)) {
      setLoadedInstances(seriesInstancesCache.current.get(series.id));
      return;
    }

    try {
      setImageLoading(true);
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

      const response = await axios.get(
        `${apiUrl}/proxy/dicom-images/series/${series.id}/instances`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const instances = response.data.instances;
      
      // Cache the instances
      seriesInstancesCache.current.set(series.id, instances);
      setLoadedInstances(instances);
      
    } catch (err) {
      console.error('Failed to load series instances:', err);
    } finally {
      setImageLoading(false);
    }
  };

  const currentSeries = studyData?.series[currentSeriesIndex];
  const currentInstance = loadedInstances[currentImageIndex];

  const nextImage = () => {
    if (!currentSeries) return;
    if (currentImageIndex < currentSeries.numberOfInstances - 1) {
      setCurrentImageIndex(prev => prev + 1);
    } else if (currentSeriesIndex < studyData.series.length - 1) {
      // Move to next series
      setCurrentSeriesIndex(prev => prev + 1);
      setCurrentImageIndex(0);
    }
  };

  const previousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    } else if (currentSeriesIndex > 0) {
      // Move to previous series
      setCurrentSeriesIndex(prev => prev - 1);
      const prevSeries = studyData.series[currentSeriesIndex - 1];
      setCurrentImageIndex(prevSeries.numberOfInstances - 1);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextImage();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') previousImage();
  };

  const changeSeries = (seriesIndex) => {
    setCurrentSeriesIndex(seriesIndex);
    setCurrentImageIndex(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-white">Loading study metadata...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center text-white">
          <p className="text-red-500 text-xl mb-4">⚠️ {error}</p>
          <button onClick={fetchStudyMetadata} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!studyData || studyData.totalImages === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <p className="text-white">No images found for this study</p>
      </div>
    );
  }

  return (
    <div 
      className="relative h-full bg-black flex flex-col"
      onKeyDown={handleKeyPress}
      tabIndex={0}
    >
      {/* Study Info Header - Responsive */}
      <div className="bg-gray-900 bg-opacity-95 px-3 md:px-6 py-3 text-white text-xs md:text-sm border-b border-gray-700">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm md:text-base">{studyData.patientName}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">ID: {studyData.patientID}</span>
          </div>
          <div className="text-gray-400 text-xs md:text-sm">
            {studyData.studyDescription}
          </div>
        </div>
      </div>

      {/* Series Tabs - Responsive with scroll */}
      {studyData.series.length > 1 && (
        <div className="bg-gray-800 px-2 md:px-4 py-2 md:py-3 border-b border-gray-700">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pb-1">
            {studyData.series.map((series, index) => (
              <button
                key={series.id}
                onClick={() => changeSeries(index)}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded text-xs md:text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                  currentSeriesIndex === index
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span className="font-semibold">{series.modality}</span>
                <span className="hidden sm:inline mx-1 md:mx-2">•</span>
                <span className="hidden sm:inline text-xs">{series.seriesDescription.slice(0, 20)}</span>
                <span className="ml-1 md:ml-2 text-xs opacity-75 bg-black bg-opacity-30 px-1.5 py-0.5 rounded">
                  {series.numberOfInstances}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

        {/* Image Display - Responsive padding */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 lg:p-6 relative min-h-0">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {currentInstance ? (
          <img
            src={currentInstance.imageUrl}
            alt={`${currentSeries?.seriesDescription} - Image ${currentImageIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            style={{ imageRendering: 'crisp-edges' }}
            loading="lazy"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" fill="white">Image Error</text></svg>';
            }}
          />
        ) : (
          <div className="text-white text-center">
            <div className="animate-pulse">Loading image...</div>
          </div>
        )}

        {/* Image Info Overlay - Responsive positioning */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black bg-opacity-80 text-white px-2 md:px-3 py-1.5 md:py-2 rounded text-xs backdrop-blur-sm">
          <div className="font-medium mb-0.5">{currentSeries?.seriesDescription}</div>
          <div className="text-blue-400">
            Slice: <span className="font-semibold">{currentImageIndex + 1}</span> / {currentSeries?.numberOfInstances}
          </div>
          <div className="text-gray-400 text-[10px] md:text-xs mt-0.5">
            Instance: {currentInstance?.instanceNumber || '...'}
          </div>
        </div>        {/* Total Progress - Responsive */}
        <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-black bg-opacity-80 text-white px-2 md:px-3 py-1.5 md:py-2 rounded text-xs backdrop-blur-sm">
          <div className="font-semibold text-green-400">
            {studyData.series.slice(0, currentSeriesIndex).reduce((sum, s) => sum + s.numberOfInstances, 0) + currentImageIndex + 1} / {studyData.totalImages}
          </div>
          <div className="text-gray-400 text-[10px] md:text-xs">
            Series {currentSeriesIndex + 1}/{studyData.totalSeries}
          </div>
        </div>
      </div>

      {/* Controls - Fully Responsive */}
      <div className="bg-gray-900 bg-opacity-95 p-3 md:p-4 lg:p-5 border-t border-gray-700">
        {/* Mobile Layout - Stack vertically */}
        <div className="lg:hidden space-y-3">
          {/* Series Info - Mobile */}
          <div className="text-white text-center">
            <div className="font-medium text-sm mb-1">{currentSeries?.seriesDescription}</div>
            <div className="text-xs text-gray-400">
              Image {currentImageIndex + 1} of {currentSeries?.numberOfInstances}
              <span className="mx-2">•</span>
              {studyData.totalSeries} Series, {studyData.totalImages} Total
            </div>
          </div>

          {/* Slider - Mobile */}
          <div className="w-full">
            <input
              type="range"
              min="0"
              max={currentSeries ? currentSeries.numberOfInstances - 1 : 0}
              value={currentImageIndex}
              onChange={(e) => setCurrentImageIndex(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Navigation Buttons - Mobile */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={previousImage}
              disabled={currentSeriesIndex === 0 && currentImageIndex === 0}
              className="flex-1 max-w-[140px] px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium text-sm"
            >
              ← Prev
            </button>
            
            <button
              onClick={nextImage}
              disabled={
                currentSeriesIndex === studyData.series.length - 1 &&
                currentImageIndex === loadedInstances.length - 1
              }
              className="flex-1 max-w-[140px] px-4 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium text-sm"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Desktop Layout - Horizontal */}
        <div className="hidden lg:flex items-center justify-between gap-6">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={previousImage}
              disabled={currentSeriesIndex === 0 && currentImageIndex === 0}
              className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium shadow-lg"
            >
              ← Prev
            </button>
            
            <div className="text-white text-center min-w-[180px]">
              <div className="font-semibold text-sm mb-1">
                {currentSeries?.seriesDescription}
              </div>
              <div className="text-xs text-gray-400">
                Image {currentImageIndex + 1} of {currentSeries?.numberOfInstances}
              </div>
            </div>
            
            <button
              onClick={nextImage}
              disabled={
                currentSeriesIndex === studyData.series.length - 1 &&
                currentImageIndex === loadedInstances.length - 1
              }
              className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium shadow-lg"
            >
              Next →
            </button>
          </div>

          {/* Image Slider */}
          <div className="flex-1 max-w-md">
            <input
              type="range"
              min="0"
              max={currentSeries ? currentSeries.numberOfInstances - 1 : 0}
              value={currentImageIndex}
              onChange={(e) => setCurrentImageIndex(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Stats */}
          <div className="text-white text-xs text-right min-w-[110px]">
            <div className="font-semibold text-blue-400 mb-1">
              {studyData.totalSeries} Series
            </div>
            <div className="text-gray-400">
              {studyData.totalImages} Images
            </div>
          </div>
        </div>

        {/* Instructions - Hidden on mobile */}
        <div className="hidden md:block text-center mt-3">
          <p className="text-gray-400 text-xs">
            Use arrow keys (← → ↑ ↓) or controls to navigate • Drag slider to jump • Click viewer to focus
          </p>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        .slider:hover::-webkit-slider-thumb {
          background: #2563eb;
          transform: scale(1.1);
        }
        .slider:hover::-moz-range-thumb {
          background: #2563eb;
          transform: scale(1.1);
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }
        .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 3px;
        }
        .scrollbar-track-gray-800::-webkit-scrollbar-track {
          background-color: #1f2937;
        }
      `}</style>
    </div>
  );
}
