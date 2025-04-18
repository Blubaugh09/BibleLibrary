import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createEntry, updateEntry, getEntryById, Entry } from '../../services/firestore';
import { chatWithGPT, textToSpeech } from '../../services/api';
import { uploadAudio } from '../../services/firestore';
import { Timestamp } from 'firebase/firestore';
import MDEditor from '@uiw/react-md-editor';
import AudioPlayer from '../Audio/AudioPlayer';

interface TextEntryEditorProps {
  isEditing?: boolean;
}

const TextEntryEditor: React.FC<TextEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [bibleVerses, setBibleVerses] = useState<string[]>([]);
  const [newVerse, setNewVerse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioGenerated, setAudioGenerated] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingComplete, setSavingComplete] = useState(false);
  
  // Load existing entry data if in edit mode
  useEffect(() => {
    const loadEntry = async () => {
      if (isEditing && entryId && currentUser) {
        try {
          const loadedEntry = await getEntryById(entryId);
          if (loadedEntry && loadedEntry.userId === currentUser.uid) {
            setEntry(loadedEntry);
            setTitle(loadedEntry.title);
            setDescription(loadedEntry.description || '');
            setContent(loadedEntry.content || '');
            setCategory(loadedEntry.category || '');
            setBibleVerses(loadedEntry.bibleVerses || []);
            
            // Handle audioUrl which can be string or string[]
            if (loadedEntry.audioUrl) {
              if (typeof loadedEntry.audioUrl === 'string') {
                setAudioUrl(loadedEntry.audioUrl);
                setAudioGenerated(true);
              } else if (Array.isArray(loadedEntry.audioUrl) && loadedEntry.audioUrl.length > 0) {
                setAudioUrl(loadedEntry.audioUrl[0]);
                setAudioGenerated(true);
              } else {
                setAudioUrl('');
              }
            } else {
              setAudioUrl('');
            }
          } else {
            navigate('/');
          }
        } catch (error) {
          console.error('Error loading entry:', error);
          setError('Failed to load entry. Please try again.');
        }
      }
    };
    
    loadEntry();
  }, [entryId, currentUser, isEditing, navigate]);
  
  // Category options - same as in ChatInterface
  const categoryOptions = [
    'Person', 'Place', 'Event', 'Object', 'Theme', 'Symbol', 'Prophecy',
    'Teaching', 'Genealogy', 'Covenant', 'Doctrine', 'Practice', 'Virtue/Vice',
    'Group', 'Literary Type', 'Time Period', 'Miracle', 'Relationship'
  ];
  
  // Handle adding a Bible verse
  const handleAddVerse = () => {
    if (newVerse.trim()) {
      setBibleVerses([...bibleVerses, newVerse.trim()]);
      setNewVerse('');
    }
  };
  
  // Handle removing a Bible verse
  const handleRemoveVerse = (index: number) => {
    setBibleVerses(bibleVerses.filter((_, i) => i !== index));
  };
  
  // Process content with AI to extract verses and categorize
  const processWithAI = async () => {
    if (!content.trim()) return { verses: [], suggestedCategory: '' };
    
    try {
      // Prepare prompt for AI
      const prompt = `
        Please analyze the following text and provide:
        1. A list of applicable Bible verses that relate to the content
        2. The most appropriate category for this content from the following options: ${categoryOptions.join(', ')}
        
        Respond in JSON format like this:
        [JSON_RESPONSE]{"category": "chosen category", "relatedVerses": ["verse1", "verse2", "verse3"]}[/JSON_RESPONSE]
        
        Here is the text to analyze:
        ${content}
      `;
      
      const response = await chatWithGPT([
        { role: 'system', content: 'You are a helpful assistant that analyzes text and identifies relevant Bible verses and categories.' },
        { role: 'user', content: prompt }
      ]);
      
      // Extract JSON data
      let suggestedCategory = '';
      let extractedVerses: string[] = [];
      
      const jsonMatch = response.content.match(/\[JSON_RESPONSE\]([\s\S]*?)\[\/JSON_RESPONSE\]/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          suggestedCategory = jsonData.category || '';
          extractedVerses = jsonData.relatedVerses || [];
        } catch (error) {
          console.error('Error parsing AI response:', error);
        }
      }
      
      return {
        verses: extractedVerses,
        suggestedCategory
      };
    } catch (error) {
      console.error('Error processing with AI:', error);
      return { verses: [], suggestedCategory: '' };
    }
  };
  
  // Generate audio from text content
  const generateAudio = async (entryId: string): Promise<string | null> => {
    try {
      setAudioProcessing(true);
      
      // Generate audio from content
      const audioBuffer = await textToSpeech(content);
      
      // Upload audio to storage
      const audioUrl = await uploadAudio(audioBuffer, entryId);
      
      if (audioUrl) {
        setAudioUrl(audioUrl);
        setAudioGenerated(true);
      }
      
      return audioUrl;
    } catch (error) {
      console.error('Error generating audio:', error);
      return null;
    } finally {
      setAudioProcessing(false);
    }
  };
  
  // Handle saving the entry
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please add a title');
      return;
    }
    
    if (!content.trim()) {
      setError('Please add some content');
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in to save');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const entryData: Partial<Entry> = {
        title,
        description,
        content,
        category,
        type: 'text',
        bibleVerses, // Store the Bible verses for search/filter
        updatedAt: Timestamp.now()
      };
      
      let savedEntryId: string;
      
      if (isEditing && entryId) {
        // Update existing entry
        await updateEntry(entryId, entryData);
        savedEntryId = entryId;
        setSuccess('Entry updated successfully!');
      } else {
        // Create new entry
        const newEntry: Entry = {
          ...entryData as any,
          userId: currentUser.uid,
          createdAt: Timestamp.now()
        };
        
        const docRef = await createEntry(newEntry);
        savedEntryId = docRef.id;
        setSuccess('Entry created successfully!');
      }
      
      // Entry is saved, now process audio in background
      setSavingComplete(true);
      
      // Start audio generation in background
      generateAudio(savedEntryId).then(audioUrl => {
        if (audioUrl) {
          // Update entry with audio URL
          updateEntry(savedEntryId, { audioUrl });
        }
      }).catch(error => {
        console.error('Background audio generation failed:', error);
      });
      
      // If not already redirecting, redirect after a delay
      setTimeout(() => {
        // Only redirect if we're still on this page (user hasn't navigated away)
        if (document.visibilityState !== 'hidden') {
          navigate('/');
        }
      }, 3000);
    } catch (error) {
      console.error('Error saving entry:', error);
      setError('Failed to save entry. Please try again.');
      setSavingComplete(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex h-full flex-col bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          {isEditing ? 'Edit Text Entry' : 'Create Text Entry'}
        </h2>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-green-700">
            {success}
            {audioProcessing && savingComplete && (
              <div className="mt-2 flex items-center">
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm text-indigo-700">Generating audio in the background...</span>
              </div>
            )}
          </div>
        )}
        
        {/* Title */}
        <div className="mb-4">
          <label htmlFor="title" className="mb-1 block font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Enter a title"
          />
        </div>
        
        {/* Description */}
        <div className="mb-4">
          <label htmlFor="description" className="mb-1 block font-medium text-gray-700">
            Description (optional)
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Enter a short description"
          />
        </div>
        
        {/* Category */}
        <div className="mb-4">
          <label htmlFor="category" className="mb-1 block font-medium text-gray-700">
            Category (optional)
          </label>
          <select
            id="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a category</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            If not selected, we'll suggest a category based on your content
          </p>
        </div>
        
        {/* Bible Verses */}
        <div className="mb-6">
          <label className="mb-1 block font-medium text-gray-700">
            Bible Verses (optional)
          </label>
          <div className="mb-2 flex">
            <input
              type="text"
              value={newVerse}
              onChange={e => setNewVerse(e.target.value)}
              placeholder="e.g., John 3:16"
              className="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleAddVerse}
              className="rounded-r-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              type="button"
            >
              Add
            </button>
          </div>
          
          {bibleVerses.length > 0 && (
            <div className="mb-4 rounded-md bg-indigo-50 p-3">
              <h3 className="mb-2 font-medium text-indigo-700">Added Verses:</h3>
              <ul className="space-y-1">
                {bibleVerses.map((verse, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <span className="text-gray-700">{verse}</span>
                    <button
                      onClick={() => handleRemoveVerse(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <p className="text-xs text-gray-500">
            We'll also analyze your content to suggest relevant Bible verses
          </p>
        </div>
        
        {/* Markdown Editor */}
        <div className="mb-6">
          <label className="mb-1 block font-medium text-gray-700">
            Content
          </label>
          <div data-color-mode="light">
            <MDEditor
              value={content}
              onChange={value => setContent(value || '')}
              height={400}
              preview="edit"
              className="rounded-md border border-gray-300"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Your text will automatically be converted to audio after saving
          </p>
        </div>
        
        {/* Audio Preview (for editing or if generated) */}
        {audioGenerated && audioUrl && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <h3 className="mb-2 font-medium text-green-700">Audio Preview:</h3>
            <AudioPlayer src={audioUrl} />
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            type="button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Entry'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextEntryEditor; 