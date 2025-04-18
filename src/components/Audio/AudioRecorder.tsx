import React, { useState, useRef, useEffect } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  maxDuration?: number; // Maximum recording time in seconds
  className?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onRecordingComplete, 
  maxDuration = 60, 
  className = '' 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Set up canvas for visualizer
  useEffect(() => {
    if (isRecording && canvasRef.current && analyserRef.current) {
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      
      if (canvasCtx) {
        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        let frameCounter = 0;
        const draw = () => {
          if (!isRecording) return;
          
          requestAnimationFrame(draw);
          frameCounter++;
          
          analyser.getByteTimeDomainData(dataArray);
          
          canvasCtx.fillStyle = 'rgb(245, 247, 250)';
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
          
          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = 'rgb(99, 102, 241)';
          
          canvasCtx.beginPath();
          
          const sliceWidth = canvas.width / bufferLength;
          let x = 0;
          
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * (canvas.height / 2);
            
            if (i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y);
            }
            
            x += sliceWidth;
          }
          
          canvasCtx.lineTo(canvas.width, canvas.height / 2);
          canvasCtx.stroke();
          
          // Save a sample of the audio data for review
          if (frameCounter % 10 === 0) { // Don't save every frame, just occasionally
            const avg = Array.from(dataArray).reduce((sum, val) => sum + val, 0) / bufferLength;
            setAudioData(prev => [...prev.slice(-50), avg]); // Keep last 50 data points
          }
        };
        
        draw();
      }
    }
  }, [isRecording]);
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);
  
  const stopRecording = () => {
    console.log("AudioRecorder: Stopping recording...");
    if (mediaRecorderRef.current && isRecording) {
      console.log("AudioRecorder: MediaRecorder is active, stopping it now");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } else {
      console.log("AudioRecorder: Cannot stop recording - recorder not active", {
        isRecording,
        hasMediaRecorder: !!mediaRecorderRef.current
      });
    }
  };
  
  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, maxDuration, stopRecording]);
  
  const startRecording = async () => {
    try {
      setAudioData([]);
      setRecordingTime(0);
      audioChunksRef.current = [];
      
      // Request high-quality audio
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      streamRef.current = stream;
      
      // Set up audio context for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      console.log("Creating MediaRecorder with proper MIME type...");
      // Try to use specific mime types for better compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp3') 
          ? 'audio/mp3'
          : 'audio/webm';
      
      console.log(`Using MIME type: ${mimeType}`);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // 128 kbps for good quality
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Received audio chunk: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        } else {
          console.warn("Received empty audio chunk");
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log(`Recording stopped, collected ${audioChunksRef.current.length} chunks`);
        
        if (audioChunksRef.current.length === 0) {
          console.error("No audio chunks collected during recording");
          alert("Recording failed. Please try again.");
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        
        console.log(`Recording complete: ${audioChunksRef.current.length} chunks, blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        
        // Update UI state first
        setAudioUrl(url);
        setIsRecording(false);
        
        // Stop all tracks to release the microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Verify we have valid data before calling the callback
        if (audioBlob.size > 0) {
          console.log("Calling onRecordingComplete callback with audio blob");
          // Wrap in setTimeout to ensure UI updates complete first
          setTimeout(() => {
            onRecordingComplete(audioBlob);
          }, 100);
        } else {
          console.error("Generated empty audio blob");
          alert("Recording failed to capture any audio. Please try again.");
        }
      };
      
      // Set a smaller timeslice to collect data more frequently
      mediaRecorder.start(500); // Collect chunks every 500ms
      console.log("MediaRecorder started");
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please ensure you have granted permission.');
    }
  };
  
  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioData([]);
      setRecordingTime(0);
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Voice Recording</h3>
        <div className="text-sm text-gray-500">
          {isRecording ? (
            <span className="flex items-center">
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
              Recording: {formatTime(recordingTime)}
            </span>
          ) : audioUrl ? (
            <span>Recording complete</span>
          ) : (
            <span>Ready to record</span>
          )}
        </div>
      </div>
      
      <div className="mb-4 rounded-md bg-gray-50 p-2">
        <canvas
          ref={canvasRef}
          className="h-20 w-full"
          width="600"
          height="80"
        ></canvas>
      </div>
      
      <div className="flex items-center justify-between">
        {!audioUrl ? (
          isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition-colors hover:bg-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              Stop Recording
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Start Recording
            </button>
          )
        ) : (
          <div className="flex items-center space-x-2">
            <audio src={audioUrl} controls className="w-full" />
            <button
              onClick={discardRecording}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        )}
        
        <div className="text-xs text-gray-500">
          Max {maxDuration} seconds
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder; 