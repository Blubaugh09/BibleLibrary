import axios from 'axios';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const openaiInstance = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add interceptor to set the API key dynamically for each request
openaiInstance.interceptors.request.use(
  config => {
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (apiKey) {
      config.headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

const esvInstance = axios.create({
  baseURL: 'https://api.esv.org/v3',
  headers: {
    'Authorization': `Token ${process.env.REACT_APP_ESV_API_KEY}`
  }
});

// OpenAI ChatGPT API
export const chatWithGPT = async (messages: any[]) => {
  try {
    // Check if API key is available and log masked version for debugging
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    
    // More detailed environment variable debugging 
    console.log("Environment variables check:");
    console.log(`- REACT_APP_OPENAI_API_KEY exists: ${!!apiKey}`);
    console.log(`- REACT_APP_ESV_API_KEY exists: ${!!process.env.REACT_APP_ESV_API_KEY}`);
    
    if (!apiKey) {
      console.error('OpenAI API key is missing. Check your .env file and environment variables.');
      // Try to list all available environment variables that start with REACT_APP_
      const envVars = Object.keys(process.env)
        .filter(key => key.startsWith('REACT_APP_'))
        .map(key => `${key}: ${key.includes('KEY') ? '***' : process.env[key]}`);
      
      console.log('Available environment variables:', envVars.length ? envVars : 'None found');
      throw new Error('API key configuration error - OpenAI API key is missing');
    }
    
    // Check if key appears valid (starts with 'sk-')
    if (!apiKey.startsWith('sk-')) {
      console.error('OpenAI API key appears malformed - should start with "sk-"');
      throw new Error('API key configuration error - Malformed API key');
    }
    
    const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 5);
    console.log(`Using OpenAI API key: ${maskedKey}`);
    
    // Log request details (without sensitive data)
    console.log(`Sending request to OpenAI with ${messages.length} messages`);
    messages.forEach((msg, i) => {
      console.log(`Message ${i+1} - Role: ${msg.role}, Content length: ${msg.content.length} chars`);
    });
    
    // Ensure authorization header is set correctly for this specific request
    const response = await openaiInstance.post('/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    // Log response details
    console.log('Received response from OpenAI:');
    console.log(`- Status: ${response.status}`);
    console.log(`- Has data: ${!!response.data}`);
    console.log(`- Has choices: ${!!(response.data && response.data.choices)}`);
    
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error('Unexpected response format from OpenAI:', response.data);
      throw new Error('Invalid response from OpenAI API');
    }
    
    return response.data.choices[0].message;
  } catch (error: any) {
    console.error('Error with OpenAI API:', error);
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    
    if (error.response) {
      console.error('API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // Try to parse detailed error information
      try {
        if (typeof error.response.data === 'object') {
          console.error('Error details:', error.response.data.error || error.response.data);
        } else if (typeof error.response.data === 'string') {
          console.error('Error response text:', error.response.data);
        }
      } catch (e) {
        console.error('Could not parse error response details');
      }
    } else if (error.request) {
      console.error('No response received - Network issue?', error.request);
    }
    
    throw error;
  }
};

// OpenAI Whisper API for text-to-speech
export const textToSpeech = async (text: string) => {
  try {
    console.log("Starting text-to-speech conversion...");
    
    if (!text || text.trim() === '') {
      console.error("Empty text provided for text-to-speech");
      throw new Error("Empty text cannot be converted to speech");
    }
    
    // Check if API key is available
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      throw new Error('API key configuration error');
    }
    
    // Ensure text isn't too long (OpenAI has limits)
    const maxLength = 4096;
    const trimmedText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    console.log(`Text length: ${text.length} characters, using ${trimmedText.length} characters`);
    
    console.log("Making OpenAI API call to /audio/speech endpoint");
    const response = await openaiInstance.post('/audio/speech', {
      model: 'gpt-4o-mini-tts',
      input: `Read the following text in a warm, male voice: '${trimmedText}'`,
      voice: 'echo', // Using echo as it has a male voice quality
    }, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("OpenAI API call successful, response status:", response.status);
    console.log("Response data type:", typeof response.data);
    console.log("Response data length:", response.data.byteLength, "bytes");
    
    return response.data;
  } catch (error: any) {
    console.error('Error with text-to-speech API:', error);
    if (error.response) {
      console.error('API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // Try to parse error data if it's not an ArrayBuffer
      if (error.response.data && !(error.response.data instanceof ArrayBuffer)) {
        try {
          const errorText = new TextDecoder().decode(error.response.data);
          console.error('Error response text:', errorText);
        } catch (e) {
          console.error('Could not decode error response');
        }
      }
    }
    throw error;
  }
};

// ESV Bible API for searching verses
export const searchBibleVerses = async (query: string) => {
  try {
    const response = await esvInstance.get('/passage/search/', {
      params: {
        q: query,
        page_size: 5,
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error with ESV API:', error);
    throw error;
  }
};

// ESV Bible API for getting full passage
export const getBiblePassage = async (passage: string) => {
  try {
    const response = await esvInstance.get('/passage/text/', {
      params: {
        q: passage,
        include_passage_references: true,
        include_verse_numbers: true,
        include_footnotes: false,
        include_headings: false,
      }
    });
    return response.data.passages[0];
  } catch (error) {
    console.error('Error with ESV API:', error);
    throw error;
  }
};

// Browser-based Text-to-Speech fallback
export const browserTextToSpeech = async (text: string): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    console.log("Using browser's built-in speech synthesis...");
    
    // Check if speech synthesis is available
    if (!window.speechSynthesis) {
      console.error("Speech synthesis not supported in this browser");
      reject(new Error("Speech synthesis not supported"));
      return;
    }
    
    try {
      // Create an audio context for recording
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(destination.stream);
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/mp3' });
        const arrayBuffer = await blob.arrayBuffer();
        resolve(arrayBuffer);
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Set up speech synthesis
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      
      // When speech is done, stop recording
      utterance.onend = () => {
        mediaRecorder.stop();
        audioContext.close();
      };
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error("Error with browser speech synthesis:", error);
      reject(error);
    }
  });
};

// Simple Text-to-Speech (no recording required)
export const simpleTextToSpeech = async (text: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log("Using simple speech synthesis without recording...");
    
    // Just speak it and return a placeholder URL
    try {
      // Check if speech synthesis is supported
      if (!window.speechSynthesis) {
        console.error("Speech synthesis not supported");
        reject(new Error("Speech synthesis not supported"));
        return;
      }
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // This approach doesn't create an audio file, but we'll return a special URL 
      // that indicates we've used browser speech
      utterance.onend = () => {
        // Create a tiny audio file with a beep sound as a placeholder
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, 44100, 44100);
        const data = buffer.getChannelData(0);
        
        // Create a simple beep sound
        for (let i = 0; i < 44100; i++) {
          data[i] = Math.sin(i * 0.01) * 0.5 * Math.exp(-i * 0.0001);
        }
        
        // Convert to a Blob
        const offlineContext = new OfflineAudioContext(1, 44100, 44100);
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineContext.destination);
        source.start();
        
        offlineContext.startRendering().then((renderedBuffer) => {
          const audioData = renderedBuffer.getChannelData(0);
          const blob = new Blob([audioData], { type: 'audio/wav' });
          
          // Convert to data URL
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
      };
      
      // Speak it
      window.speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error("Error with simple speech synthesis:", error);
      reject(error);
    }
  });
};

// Speech-to-Text using OpenAI Whisper API
export const speechToText = async (audioBlob: Blob): Promise<string> => {
  try {
    console.log("Starting speech-to-text transcription...");
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error("Empty audio blob provided");
      throw new Error("Empty audio cannot be transcribed");
    }
    
    // Check if API key is available
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      throw new Error('API key configuration error');
    }
    
    // Convert blob to file for upload
    const file = new File([audioBlob], 'recording.mp3', { type: 'audio/mp3' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    
    console.log("Sending audio to OpenAI for transcription, file size:", file.size);
    const response = await openaiInstance.post('/audio/transcriptions', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    console.log("Transcription successful");
    return response.data;
  } catch (error: any) {
    console.error('Error with speech-to-text API:', error);
    if (error.response) {
      console.error('API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

// Add this new function for pathway AI chat
export const chatWithPathwayAI = async (messages: any[], context: string) => {
  try {
    console.log("Starting pathway AI chat...");
    console.log("Context:", context);
    console.log("Messages:", messages.length, "messages");
    
    // Create a system message with the context
    const systemMessage = {
      role: "system",
      content: `You are a helpful Bible study assistant. Your task is to help users understand Bible 
      verses, theological concepts, and pathway study points. 
      
      The current study context is:
      ${context}`
    };
    
    // Add the system message at the beginning
    const allMessages = [systemMessage, ...messages];
    
    // Use the existing chatWithGPT function
    const response = await chatWithGPT(allMessages);
    
    console.log("AI chat response received:", response);
    
    // Generate audio for the response
    let audioUrl = null;
    try {
      console.log("Generating audio for AI response...");
      const audioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: response.content }),
      });
      
      if (!audioResponse.ok) {
        throw new Error(`Audio generation failed with status: ${audioResponse.status}`);
      }
      
      // Get the audio buffer from the response
      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Generate a unique filename
      const timestamp = new Date().getTime();
      const filename = `pathway-ai-response-${timestamp}.mp3`;
      
      // Upload to Firebase Storage
      console.log("Uploading audio to Firebase Storage...");
      const storage = getStorage();
      const storageRef = ref(storage, `audio/${filename}`);
      
      // Upload the audio buffer
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      await uploadBytes(storageRef, audioBlob);
      
      // Get the download URL
      audioUrl = await getDownloadURL(storageRef);
      console.log("Audio uploaded successfully:", audioUrl);
    } catch (audioError) {
      console.error("Error generating or uploading audio:", audioError);
      // Continue without audio if generation fails
    }
    
    return {
      message: response.content,
      role: "assistant",
      audioUrl
    };
  } catch (error: any) {
    console.error("Error in pathway AI chat:", error);
    throw error;
  }
}; 