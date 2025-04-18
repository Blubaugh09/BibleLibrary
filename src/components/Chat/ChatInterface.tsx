import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getEntryById, updateEntry, createEntry, Message, Entry } from '../../services/firestore';
import { chatWithGPT, textToSpeech, searchBibleVerses, getBiblePassage } from '../../services/api';
import { uploadAudio } from '../../services/firestore';
import { Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getStorage, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import AudioPlayer from '../Audio/AudioPlayer';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../../firebase';
// Commented out unused icon imports that were causing TypeScript errors
// import { MdSend, MdMic, MdStop, MdSettings, MdRefresh, MdContentCopy, MdBookmark } from 'react-icons/md';
// import { FaPlay, FaPause, FaSpinner, FaVolumeUp } from 'react-icons/fa';

interface ChatMessage extends Message {
  id?: string;
  audioUrl?: string;
  audioProcessing?: boolean;
  timeCreated?: Timestamp;
  bibleVerses?: string[];
  category?: string;
  relatedVerses?: string[];
  isProcessing?: boolean;
}

// Extended Message type with entry property
interface ExtendedMessage extends ChatMessage {
  entry?: {
    id: string;
    messages: ExtendedMessage[];
  };
}

// Bible Verse Modal Component
interface BibleVerseModalProps {
  isOpen: boolean;
  onClose: () => void;
  verse: string;
  verseText: string;
  isLoading: boolean;
}

const BibleVerseModal: React.FC<BibleVerseModalProps> = ({ isOpen, onClose, verse, verseText, isLoading }) => {
  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    
    // If modal is open, prevent background scrolling
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Click outside to close
  const modalRef = useRef<HTMLDivElement>(null);
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 className="mb-4 text-xl font-semibold text-indigo-800">{verse}</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
          </div>
        ) : (
          <div className="prose prose-indigo max-w-none">
            <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{verseText}</p>
            <div className="mt-6 flex justify-between items-center border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500">English Standard Version (ESV)</p>
              <button 
                onClick={() => window.open(`https://www.esv.org/verses/${encodeURIComponent(verse)}`, '_blank')}
                className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                View on ESV.org
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInterface: React.FC = () => {
  const { entryId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('New Conversation');
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Helper function to clean objects for Firestore (remove undefined values)
  const cleanObjectForFirestore = (obj: any): any => {
    if (obj === undefined || obj === null) return null;
    
    if (Array.isArray(obj)) {
      return obj.map(item => cleanObjectForFirestore(item));
    }
    
    if (typeof obj === 'object') {
      const cleanObj: any = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== undefined) {
          cleanObj[key] = cleanObjectForFirestore(value);
        }
      });
      return cleanObj;
    }
    
    return obj;
  };

  // Load existing conversation if entryId is provided
  useEffect(() => {
    const loadEntry = async () => {
      if (entryId && currentUser) {
        try {
          const loadedEntry = await getEntryById(entryId);
          if (loadedEntry && loadedEntry.userId === currentUser.uid) {
            setEntry(loadedEntry);
            setTitle(loadedEntry.title);
            if (loadedEntry.messages) {
              setMessages(loadedEntry.messages as ExtendedMessage[]);
            }
          } else {
            navigate('/');
          }
        } catch (error) {
          console.error('Error loading entry:', error);
          navigate('/');
        }
      }
    };
    
    loadEntry();
  }, [entryId, currentUser, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus on input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Find Bible verses related to the message content
  const findRelatedBibleVerses = async (content: string) => {
    try {
      // Extract key terms from the message for Bible verse search
      const words = content.split(' ');
      const keyTerms = words.filter(word => 
        word.length > 4 && 
        !['about', 'these', 'those', 'their', 'would', 'could', 'should'].includes(word.toLowerCase())
      ).slice(0, 3).join(' ');
      
      if (keyTerms) {
        const verses = await searchBibleVerses(keyTerms);
        if (verses && verses.length > 0) {
          const topVerse = verses[0].reference;
          const passage = await getBiblePassage(topVerse);
          return [passage];
        }
      }
      return [];
    } catch (error) {
      console.error('Error finding Bible verses:', error);
      return [];
    }
  };

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isLoading || !currentUser) return;
    
    const userMessage: ExtendedMessage = {
      role: 'user',
      content: newMessage,
      timestamp: Timestamp.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);
    
    try {
      // Prepare AI context with previous messages
      const aiContext = messages.map(({ role, content }) => ({ role, content }));
      
      // Add context about continuing previous conversation
      if (messages.length > 0 && entry) {
        aiContext.unshift({
          role: 'system',
          content: `This is a continuation of a previous conversation. The topic is: ${entry.title}. Please ensure your responses are informative, helpful, and include relevant Bible verses when possible. For each response, include a structured response at the end in the format [JSON_RESPONSE]{"category": "one of: Person, Place, Event, Object, Theme, Symbol, Prophecy, Teaching, Genealogy, Covenant, Doctrine, Practice, Virtue/Vice, Group, Literary Type, Time Period, Miracle, Relationship", "relatedVerses": ["verse1", "verse2", "verse3"]}[/JSON_RESPONSE]. Choose the single most appropriate category that best describes the main topic of discussion.`
        });
      } else {
        aiContext.unshift({
          role: 'system',
          content: 'You are a helpful assistant that provides thoughtful answers and includes relevant Bible verses in your responses whenever possible. Your goal is to provide spiritual guidance alongside practical information. For each response, include a structured response at the end in the format [JSON_RESPONSE]{"category": "one of: Person, Place, Event, Object, Theme, Symbol, Prophecy, Teaching, Genealogy, Covenant, Doctrine, Practice, Virtue/Vice, Group, Literary Type, Time Period, Miracle, Relationship", "relatedVerses": ["verse1", "verse2", "verse3"]}[/JSON_RESPONSE]. Choose the single most appropriate category that best describes the main topic of discussion.'
        });
      }
      
      // Add the latest user message
      aiContext.push({ role: 'user', content: newMessage });
      
      // Get response from OpenAI
      const response = await chatWithGPT(aiContext);
      
      // Extract JSON data if present
      let responseContent = response.content;
      let category = "";
      let relatedVerses: string[] = [];
      
      const jsonMatch = responseContent.match(/\[JSON_RESPONSE\]([\s\S]*?)\[\/JSON_RESPONSE\]/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          category = jsonData.category || "";
          relatedVerses = jsonData.relatedVerses || [];
          
          // Remove the JSON part from the displayed content
          responseContent = responseContent.replace(/\[JSON_RESPONSE\]([\s\S]*?)\[\/JSON_RESPONSE\]/, '').trim();
        } catch (error) {
          console.error("Error parsing JSON response:", error);
        }
      }
      
      // Find related Bible verses (keep existing functionality as backup)
      const bibleVerses = await findRelatedBibleVerses(responseContent);
      
      // Format the AI response with Bible verses
      const assistantMessage: ExtendedMessage = {
        role: 'assistant',
        content: responseContent,
        bibleVerses,
        category,
        relatedVerses: relatedVerses.length > 0 ? relatedVerses : undefined,
        timestamp: Timestamp.now()
      };
      
      // Update messages state with the new response
      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);
      
      // If this is a new conversation, create a new entry
      if (!entryId) {
        const newTitle = newMessage.length > 30 ? `${newMessage.substring(0, 30)}...` : newMessage;
        const newEntry: Entry = {
          title: newTitle,
          type: 'chat',
          messages: updatedMessages,
          userId: currentUser.uid,
          bibleVerses: bibleVerses,
          category: assistantMessage.category,
          relatedVerses: assistantMessage.relatedVerses
        };
        
        // Create entry first
        const createdEntry = await createEntry(newEntry);
        
        // Start audio processing
        try {
          console.log("Processing audio for new entry...");
          // Combine messages into a single text for narration
          const textToConvert = [userMessage, assistantMessage]
            .map(msg => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');
          
          // Generate audio with OpenAI
          try {
            const audioBuffer = await textToSpeech(textToConvert);
            console.log("Generated audio for new entry");
            
            // Upload directly
            const audioUrl = await uploadAudio(audioBuffer, createdEntry.id as string);
            
            if (audioUrl) {
              // Update the message object with the audio URL
              updatedMessages[updatedMessages.length - 1] = {
                ...updatedMessages[updatedMessages.length - 1],
                audioUrl
              };
              
              // Update the entry with the new messages that include audio
              await updateEntry(createdEntry.id as string, {
                messages: updatedMessages,
                audioUrl
              });
              
              console.log("Updated new entry with audio");
            } else {
              // Still update messages in Firestore, just without the audioUrl
              console.log("Audio URL was not generated, updating entry with just the messages");
              await updateEntry(createdEntry.id as string, {
                messages: updatedMessages
              });
            }
          } catch (error) {
            console.error("Failed to generate audio for new entry:", error);
          }
        } catch (audioError) {
          console.error("Error processing audio for new entry:", audioError);
        }
        
        // Now set state and navigate
        setEntry({
          ...createdEntry,
          messages: updatedMessages
        });
        navigate(`/chat/${createdEntry.id}`);
      } else if (entry) {
        // Update existing entry with ALL messages to ensure we don't lose history
        const updatedBibleVerses = [...(entry.bibleVerses || [])];
        if (bibleVerses && bibleVerses.length > 0) {
          updatedBibleVerses.push(...bibleVerses);
        }
        
        const updatedRelatedVerses = [...(entry.relatedVerses || [])];
        if (assistantMessage.relatedVerses && assistantMessage.relatedVerses.length > 0) {
          updatedRelatedVerses.push(...assistantMessage.relatedVerses);
        }
        
        // Create update object, ensuring no undefined values
        const updateData: Partial<Entry> = {
          // Clean messages to remove any undefined values
          messages: cleanObjectForFirestore(updatedMessages)
        };
        
        // Only include bibleVerses if they exist
        if (updatedBibleVerses && updatedBibleVerses.length > 0) {
          updateData.bibleVerses = updatedBibleVerses;
        }
        
        // Only include category if it exists
        if (assistantMessage.category) {
          updateData.category = assistantMessage.category;
        } else if (entry.category) {
          updateData.category = entry.category;
        }
        
        // Only include relatedVerses if they exist
        if (updatedRelatedVerses && updatedRelatedVerses.length > 0) {
          updateData.relatedVerses = updatedRelatedVerses;
        }
        
        // Update Firestore with clean data
        await updateEntry(entryId, updateData);
        
        // Process audio directly instead of using the separate function
        console.log("Processing audio for continued conversation...");
        try {
          // Combine messages for narration
          const textToConvert = [userMessage, assistantMessage]
            .map(msg => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');
          
          setAudioProcessing(true);
          
          // Generate audio with OpenAI
          try {
            const audioBuffer = await textToSpeech(textToConvert);
            console.log("Generated audio for continuation");
            
            // Upload directly
            const audioUrl = await uploadAudio(audioBuffer, entryId);
            
            if (audioUrl) {
              // Add audio URL directly to the last message in our local state
              updatedMessages[updatedMessages.length - 1] = {
                ...updatedMessages[updatedMessages.length - 1],
                audioUrl
              };
              
              // Clean the messages before updating Firestore
              const cleanedMessages = cleanObjectForFirestore(updatedMessages);
              
              // Update Firestore with the updated messages
              await updateEntry(entryId, {
                messages: cleanedMessages,
                audioUrl
              });
              
              // Update the local state
              setMessages(updatedMessages);
              
              console.log("Updated continuation with audio");
            } else {
              // Still update messages in Firestore, just without the audioUrl
              console.log("Audio URL was not generated, updating entry with just the messages");
              
              // Clean the messages before updating Firestore
              const cleanedMessages = cleanObjectForFirestore(updatedMessages);
              
              await updateEntry(entryId, {
                messages: cleanedMessages
              });
              
              // Update the local state
              setMessages(updatedMessages);
            }
          } catch (error) {
            console.error("Failed to generate audio for continuation:", error);
          } finally {
            setAudioProcessing(false);
          }
        } catch (audioError) {
          console.error("Error processing audio for continuation:", audioError);
          setAudioProcessing(false);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error message to user
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your request. Please try again.',
          timestamp: Timestamp.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle title change
  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    if (entryId && entry) {
      await updateEntry(entryId, { title: newTitle });
    }
  };

  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part (e.g., "John 3:16" from "John 3:16 - For God so loved...")
    const reference = extractVerseReference(verse);
    
    setSelectedVerse(reference);
    setModalOpen(true);
    setVerseLoading(true);
    
    try {
      const fullText = await getBiblePassage(reference);
      setVerseText(fullText);
    } catch (error) {
      console.error('Error fetching verse:', error);
      setVerseText('Error loading verse. Please try again.');
    } finally {
      setVerseLoading(false);
    }
  };

  // Extract verse reference from different possible formats
  const extractVerseReference = (verseText: string): string => {
    // Common Bible verse patterns
    const patterns = [
      // Match standard reference like "John 3:16" or "Genesis 1:1-10"
      /^([1-3]?(?:\s*[A-Za-z]+)(?:\s*\d+):\d+(?:-\d+)?)/,
      // Match book chapter and verse like "John 3 verse 16" or "John Chapter 3 Verse 16"
      /^([1-3]?(?:\s*[A-Za-z]+)(?:\s*\d+)(?:\s*(?:verse|v)?\s*\d+))/i,
      // Match book and chapter like "Psalm 23"
      /^([1-3]?(?:\s*[A-Za-z]+)(?:\s*\d+))/
    ];
    
    for (const pattern of patterns) {
      const match = verseText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // If no pattern matches, just take the first few words as a fallback
    return verseText.split(' ').slice(0, 3).join(' ');
  };

  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };

  // Render Bible verses section
  const renderBibleVerses = (verses: string[] | undefined) => {
    if (!verses || verses.length === 0) return null;
    
    return (
      <div className="mt-2 rounded-md bg-indigo-50 p-3 text-sm text-gray-700">
        <div className="font-semibold text-indigo-700">Related Bible Verse:</div>
        {verses.map((verse, index) => (
          <div 
            key={index} 
            className="mt-1 cursor-pointer italic hover:underline hover:text-indigo-700"
            onClick={() => handleVerseClick(verse.split(' ')[0])} // Extract the reference
          >
            {verse}
          </div>
        ))}
      </div>
    );
  };

  // Render related verses section
  const renderRelatedVerses = (verses: string[] | undefined) => {
    if (!verses || verses.length === 0) return null;
    
    return (
      <div className="mt-2 rounded-md bg-indigo-100 p-3 text-sm text-gray-700">
        <div className="font-semibold text-indigo-700">Applicable Bible Verses:</div>
        {verses.map((verse, index) => (
          <div 
            key={index} 
            className="mt-1 cursor-pointer italic hover:underline hover:text-indigo-700"
            onClick={() => handleVerseClick(verse)}
          >
            {verse}
          </div>
        ))}
      </div>
    );
  };

  // Render category badge
  const renderCategoryBadge = (category: string | undefined) => {
    if (!category) return null;
    
    const categoryColors: Record<string, string> = {
      'Person': 'bg-blue-100 text-blue-800',
      'Place': 'bg-green-100 text-green-800',
      'Event': 'bg-yellow-100 text-yellow-800',
      'Object': 'bg-orange-100 text-orange-800',
      'Theme': 'bg-purple-100 text-purple-800',
      'Symbol': 'bg-pink-100 text-pink-800',
      'Prophecy': 'bg-red-100 text-red-800',
      'Teaching': 'bg-indigo-100 text-indigo-800',
      'Genealogy': 'bg-gray-100 text-gray-800',
      'Covenant': 'bg-yellow-100 text-yellow-800',
      'Doctrine': 'bg-teal-100 text-teal-800',
      'Practice': 'bg-cyan-100 text-cyan-800',
      'Virtue/Vice': 'bg-lime-100 text-lime-800',
      'Group': 'bg-amber-100 text-amber-800',
      'Literary Type': 'bg-violet-100 text-violet-800',
      'Time Period': 'bg-emerald-100 text-emerald-800',
      'Miracle': 'bg-rose-100 text-rose-800',
      'Relationship': 'bg-fuchsia-100 text-fuchsia-800'
    };
    
    const colorClass = categoryColors[category] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
        {category}
      </span>
    );
  };

  // Update the generateAudioForMessage function with proper Firebase usage
  const generateAudioForMessage = async (message: ExtendedMessage, entryId?: string) => {
    try {
      // Check if message has content
      if (!message || !message.content) {
        console.error('Invalid message or empty content');
        return null;
      }

      console.log('Starting audio generation for message:', message.content.substring(0, 50) + '...');
      setAudioProcessing(true);

      // Call the API to generate audio
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message.content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Audio generation failed: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      console.log('Received audio buffer from API');

      // Create a unique filename for the audio file
      const filename = `messages/audio_${Date.now()}.mp3`;
      const storageRef = ref(storage, filename);

      // Upload the audio file to Firebase Storage
      await uploadBytes(storageRef, new Uint8Array(audioBuffer));
      console.log('Uploaded audio to Firebase Storage');

      // Get the download URL
      const audioUrl = await getDownloadURL(storageRef);
      console.log('Got download URL for audio:', audioUrl);

      // Find the message in the messages array and update it with the audio URL
      const messageToUpdate = messages.find(
        (m) => 
          // If the message has an ID, use that for comparison
          (message.id && m.id === message.id) || 
          // Otherwise, try to match by content
          (!message.id && m.content === message.content)
      );

      if (!messageToUpdate) {
        console.error('Could not find message to update with audio URL');
        return audioUrl;
      }

      // Update the message with the audio URL
      const updatedMessages = messages.map((m) =>
        // If the message has an ID, use that for comparison
        (message.id && m.id === message.id) || 
        // Otherwise, try to match by content
        (!message.id && m.content === message.content)
          ? { ...m, audioUrl }
          : m
      );

      // Update the state
      setMessages(updatedMessages);
      console.log('Updated messages in state with audio URL');

      // If this is part of an entry, save to Firestore
      if (entryId) {
        // Clean the messages before updating Firestore
        const cleanedMessages = cleanObjectForFirestore(updatedMessages);
        
        // Update the entry in Firestore
        await updateEntry(entryId, {
          messages: cleanedMessages
        });
        console.log('Updated entry in Firestore with audio URL');
      }

      return audioUrl;
    } catch (error) {
      console.error('Error generating or uploading audio:', error);
      return null;
    } finally {
      // Reset audio processing state
      setAudioProcessing(false);
      console.log('Audio processing completed');
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Header */}
      <div className="border-b bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            className="w-2/3 bg-transparent text-xl font-semibold text-gray-800 focus:outline-none"
          />
          <div className="flex items-center space-x-3">
            {audioProcessing && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-indigo-500"></div>
                Processing audio...
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-gray-500">
              <h3 className="mb-2 text-xl font-semibold">Start a new conversation</h3>
              <p>Ask a question or share a thought to begin your spiritual journey.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex flex-col rounded-lg p-4 ${
                  message.role === 'user' ? 'ml-12 bg-indigo-50' : 'mr-12 bg-white shadow'
                }`}
              >
                <div className="font-semibold text-gray-700">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                  {message.role === 'assistant' && message.category && renderCategoryBadge(message.category)}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-gray-800">{message.content}</div>
                {message.role === 'assistant' && renderBibleVerses(message.bibleVerses)}
                {message.role === 'assistant' && renderRelatedVerses(message.relatedVerses)}
                {message.role === 'assistant' && (
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    {message.audioUrl ? (
                      <div className="flex flex-col rounded-md bg-green-50 p-3">
                        <div className="mb-1 font-medium text-green-700">
                          {message.audioUrl.startsWith('data:') ? 'Audio (Browser Speech):' : 'Audio Available:'}
                        </div>
                        <AudioPlayer 
                          src={message.audioUrl}
                          showFileInfo={!message.audioUrl.startsWith('data:')}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center text-xs text-gray-400">
                        <div className="mr-1 h-2 w-2 rounded-full bg-gray-300"></div>
                        <span className="mr-2">No audio available yet</span>
                        <button 
                          onClick={() => generateAudioForMessage(message, entryId)}
                          className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200"
                          disabled={audioProcessing}
                        >
                          {audioProcessing ? 'Processing...' : 'Generate Audio'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="mr-12 flex rounded-lg bg-white p-4 shadow">
              <div className="flex items-center text-gray-600">
                <div className="bounce-dots flex">
                  <div className="bounce-dot dot-1"></div>
                  <div className="bounce-dot dot-2"></div>
                  <div className="bounce-dot dot-3"></div>
                </div>
                Assistant is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Message Input */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSendMessage} className="mx-auto max-w-3xl">
          <div className="flex items-center rounded-lg border bg-white p-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type your message here..."
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent p-2 focus:outline-none"
              rows={1}
            />
            <button
              type="submit"
              disabled={isLoading || !newMessage.trim()}
              className="ml-2 rounded-md bg-indigo-600 px-4 py-2 text-white transition disabled:opacity-50 hover:bg-indigo-700"
            >
              Send
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Press Enter to send, Shift+Enter for a new line
          </div>
        </form>
      </div>
      
      {/* CSS for bounce animation */}
      <style>
        {`
        .bounce-dots {
          display: flex;
          align-items: center;
          margin-right: 8px;
        }
        .bounce-dot {
          width: 6px;
          height: 6px;
          margin: 0 2px;
          background-color: #6366f1;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot-1 {
          animation-delay: -0.32s;
        }
        .dot-2 {
          animation-delay: -0.16s;
        }
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        `}
      </style>
    </div>
  );
};

export default ChatInterface; 