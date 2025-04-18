import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createEntry, updateEntry, getEntryById, Entry } from '../../services/firestore';
import { Timestamp } from 'firebase/firestore';

interface SongEntryEditorProps {
  isEditing?: boolean;
}

const SongEntryEditor: React.FC<SongEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State variables
  const [title, setTitle] = useState('New Song');
  const [verses, setVerses] = useState<string[]>(['', '', '']); // Start with 3 empty verses
  const [comments, setComments] = useState('');
  const [category, setCategory] = useState('');
  const [bibleVerses, setBibleVerses] = useState<string[]>([]);
  const [verseInput, setVerseInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Load existing entry if in edit mode
  useEffect(() => {
    const loadEntry = async () => {
      if (isEditing && entryId && currentUser) {
        try {
          setLoading(true);
          const loadedEntry = await getEntryById(entryId);
          
          if (loadedEntry && loadedEntry.userId === currentUser.uid) {
            setTitle(loadedEntry.title || 'New Song');
            
            // Handle the verses from content
            if (loadedEntry.content) {
              try {
                const contentObj = JSON.parse(loadedEntry.content);
                if (contentObj.verses && Array.isArray(contentObj.verses)) {
                  setVerses(contentObj.verses);
                }
                if (contentObj.comments) {
                  setComments(contentObj.comments);
                }
              } catch (e) {
                // If JSON parsing fails, just use content as first verse
                setVerses([loadedEntry.content, '', '']);
              }
            }
            
            setCategory(loadedEntry.category || '');
            setBibleVerses(loadedEntry.bibleVerses || []);
          } else {
            setError('Entry not found or you do not have permission to edit it');
            navigate('/');
          }
        } catch (error) {
          console.error('Error loading entry:', error);
          setError('Failed to load entry');
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadEntry();
  }, [entryId, currentUser, isEditing, navigate]);
  
  // Add a new verse
  const addVerse = () => {
    setVerses([...verses, '']);
  };
  
  // Update a verse at specific index
  const updateVerse = (index: number, text: string) => {
    const newVerses = [...verses];
    newVerses[index] = text;
    setVerses(newVerses);
  };
  
  // Remove a verse at specific index
  const removeVerse = (index: number) => {
    if (verses.length <= 1) return; // Keep at least one verse
    const newVerses = verses.filter((_, i) => i !== index);
    setVerses(newVerses);
  };
  
  // Handle adding a Bible verse reference
  const handleAddVerse = () => {
    if (!verseInput.trim()) return;
    
    if (!bibleVerses.includes(verseInput)) {
      setBibleVerses([...bibleVerses, verseInput]);
    }
    
    setVerseInput('');
  };
  
  // Remove a Bible verse reference
  const removeReference = (verseToRemove: string) => {
    setBibleVerses(bibleVerses.filter(verse => verse !== verseToRemove));
  };
  
  // Handle saving the entry
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please add a title');
      return;
    }
    
    // Check if at least one verse has content
    if (!verses.some(verse => verse.trim())) {
      setError('Please add at least one verse');
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in to save');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Create a JSON string with verses and comments
      const contentData = {
        verses: verses.filter(v => v.trim()), // Remove empty verses
        comments: comments
      };
      
      const contentString = JSON.stringify(contentData);
      
      const entryData: Partial<Entry> = {
        title,
        type: 'song',
        content: contentString,
        category,
        bibleVerses,
        updatedAt: Timestamp.now()
      };
      
      if (isEditing && entryId) {
        // Update existing entry
        await updateEntry(entryId, entryData);
        setSuccess('Song updated successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        // Create new entry
        const newEntry: Entry = {
          ...entryData as any,
          userId: currentUser.uid,
          createdAt: Timestamp.now()
        };
        
        await createEntry(newEntry);
        setSuccess('Song created successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving song:', error);
      setError('Failed to save song. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex h-full flex-col bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          {isEditing ? 'Edit Song' : 'Create New Song'}
        </h2>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-green-700">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSave} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="mb-1 block font-medium text-gray-700">
              Song Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter song title"
            />
          </div>
          
          {/* Verses */}
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Song Verses
            </label>
            {verses.map((verse, index) => (
              <div key={index} className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-600">
                    Verse {index + 1}
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVerse(index)}
                    className="text-red-500 hover:text-red-700"
                    disabled={verses.length <= 1}
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={verse}
                  onChange={e => updateVerse(index, e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  rows={5}
                  placeholder={`Enter verse ${index + 1} lyrics`}
                />
              </div>
            ))}
            
            <button
              type="button"
              onClick={addVerse}
              className="mt-2 inline-flex items-center rounded-md bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <svg className="-ml-1 mr-2 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Verse
            </button>
          </div>
          
          {/* Comments */}
          <div>
            <label htmlFor="comments" className="mb-1 block font-medium text-gray-700">
              Comments (optional)
            </label>
            <textarea
              id="comments"
              value={comments}
              onChange={e => setComments(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={4}
              placeholder="Add any notes or comments about the song"
            />
          </div>
          
          {/* Category */}
          <div>
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
              <option value="Worship">Worship</option>
              <option value="Hymn">Hymn</option>
              <option value="Praise">Praise</option>
              <option value="Testimony">Testimony</option>
              <option value="Prayer">Prayer</option>
              <option value="Christmas">Christmas</option>
              <option value="Easter">Easter</option>
              <option value="Special">Special</option>
            </select>
          </div>
          
          {/* Related Bible Verses */}
          <div>
            <label htmlFor="verseInput" className="mb-1 block font-medium text-gray-700">
              Related Bible Verses (optional)
            </label>
            <div className="mt-1 flex">
              <input
                type="text"
                id="verseInput"
                value={verseInput}
                onChange={e => setVerseInput(e.target.value)}
                placeholder="e.g., Psalm 23:1"
                className="block w-full rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <button
                type="button"
                onClick={handleAddVerse}
                className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Add
              </button>
            </div>
            
            {bibleVerses.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {bibleVerses.map((verse, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-0.5 text-sm font-medium text-indigo-800"
                  >
                    {verse}
                    <button
                      type="button"
                      onClick={() => removeReference(verse)}
                      className="ml-1.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-200 hover:text-indigo-900 focus:bg-indigo-500 focus:text-white focus:outline-none"
                    >
                      <span className="sr-only">Remove {verse}</span>
                      <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                        <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? (
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
                'Save Song'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SongEntryEditor; 