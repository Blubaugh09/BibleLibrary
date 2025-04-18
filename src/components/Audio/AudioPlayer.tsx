import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  className?: string;
  onEnded?: () => void;
  showFileInfo?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  src, 
  className = '', 
  onEnded,
  showFileInfo = false
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Initialize audio player
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Reset state when src changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (progressRef.current) {
        progressRef.current.value = audio.currentTime.toString();
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };
    
    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    
    // For already loaded audio elements
    if (audio.readyState >= 2) {
      handleLoadedMetadata();
    }
    
    // Cleanup
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src, onEnded]);
  
  // Play/pause toggle
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Handle progress change from slider
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  // Handle seeking (when user is dragging the slider)
  const handleSeeking = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    }
  };
  
  // Handle after seek (when user releases the slider)
  const handleSeeked = () => {
    if (isPlaying) {
      audioRef.current?.play();
    }
  };
  
  // Cycle through playback rates: 1 -> 1.5 -> 2 -> 0.75 -> 1
  const changePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const rates = [1, 1.5, 2, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const newRate = rates[(currentIndex + 1) % rates.length];
    
    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  };
  
  // Rewind 30 seconds
  const rewind30 = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.max(0, audio.currentTime - 30);
    setCurrentTime(audio.currentTime);
  };
  
  // Forward 30 seconds
  const forward30 = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 30);
    setCurrentTime(audio.currentTime);
  };
  
  // Format time to mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Custom styles for the range input
  const rangeStyles = `
    input[type='range'] {
      -webkit-appearance: none;
      height: 6px;
      border-radius: 4px;
      background: #e5e7eb;
      outline: none;
      transition: background 0.2s;
    }
    
    input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #6366f1;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: all 0.2s;
    }
    
    input[type='range']::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #6366f1;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: all 0.2s;
    }
    
    input[type='range']::-webkit-slider-thumb:hover, 
    input[type='range']::-webkit-slider-thumb:active {
      width: 16px;
      height: 16px;
      background: #4f46e5;
    }
    
    input[type='range']::-moz-range-thumb:hover,
    input[type='range']::-moz-range-thumb:active {
      width: 16px;
      height: 16px;
      background: #4f46e5;
    }
    
    input[type='range']:disabled::-webkit-slider-thumb {
      background: #9ca3af;
    }
    
    input[type='range']:disabled::-moz-range-thumb {
      background: #9ca3af;
    }
  `;
  
  return (
    <div className={`rounded-md bg-white p-3 shadow-sm ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <style>{rangeStyles}</style>
      
      <div className="flex flex-col">
        {/* Playback controls */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Rewind button */}
            <button 
              onClick={rewind30}
              className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-indigo-100"
              aria-label="Rewind 30 seconds"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:text-indigo-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span className="absolute top-9 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white group-hover:block">-30s</span>
            </button>
            
            {/* Play/Pause button */}
            <button 
              onClick={togglePlayPause}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 transition hover:bg-indigo-200"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={loading}
            >
              {loading ? (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            {/* Forward button */}
            <button 
              onClick={forward30}
              className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-indigo-100"
              aria-label="Forward 30 seconds"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:text-indigo-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span className="absolute top-9 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white group-hover:block">+30s</span>
            </button>
            
            {/* Playback rate button */}
            <button 
              onClick={changePlaybackRate}
              className="ml-2 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-indigo-100 hover:text-indigo-700"
              aria-label="Change playback speed"
              disabled={loading}
            >
              {playbackRate}x
            </button>
          </div>
          
          {/* Time display */}
          <div className="text-xs text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="flex w-full items-center">
          <input
            ref={progressRef}
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            step="0.1"
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
            onChange={handleProgressChange}
            onMouseDown={handleSeeking}
            onMouseUp={handleSeeked}
            onTouchStart={handleSeeking}
            onTouchEnd={handleSeeked}
            style={{
              background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%, #e5e7eb 100%)`
            }}
            disabled={loading}
          />
        </div>
        
        {/* File info (optional) */}
        {showFileInfo && src && !src.startsWith('data:') && (
          <div className="mt-1 truncate text-xs text-gray-400">
            {src.substring(0, 50)}...
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer; 