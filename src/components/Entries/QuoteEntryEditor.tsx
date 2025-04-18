import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createEntry, updateEntry, getEntryById, Entry, getUserEntries } from '../../services/firestore';
import { Timestamp } from 'firebase/firestore';

interface QuoteEntryEditorProps {
  isEditing?: boolean;
}

const QuoteEntryEditor: React.FC<QuoteEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State variables
  const [title, setTitle] = useState('New Quote');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const [bibleVerses, setBibleVerses] = useState<string[]>([]);
  const [verseInput, setVerseInput] = useState('');
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Category options
  const categoryOptions = [
    'Inspirational', 'Spiritual', 'Biblical', 'Theological',
    'Philosophical', 'Literary', 'Historical', 'Motivational',
    'Faith', 'Wisdom', 'Prayer', 'Leadership',
    'Encouragement', 'Love', 'Hope', 'Reflection'
  ];
  
  // Load existing entry if in edit mode
  useEffect(() => {
    const loadEntry = async () => {
      if (isEditing && entryId && currentUser) {
        try {
          setLoading(true);
          const loadedEntry = await getEntryById(entryId);
          
          if (loadedEntry && loadedEntry.userId === currentUser.uid) {
            setTitle(loadedEntry.title || 'New Quote');
            setContent(loadedEntry.content || '');
            setCategory(loadedEntry.category || '');
            setBibleVerses(loadedEntry.bibleVerses || []);
            setAuthor((loadedEntry as any).author || '');
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

  // Load existing authors for suggestions
  useEffect(() => {
    const loadAuthors = async () => {
      if (!currentUser) return;
      
      try {
        const entries = await getUserEntries(currentUser.uid);
        const uniqueAuthors = Array.from(new Set(
          entries
            .filter(entry => entry.type === 'quote' && (entry as any).author)
            .map(entry => (entry as any).author as string)
        )).sort();
        
        setAuthorSuggestions(uniqueAuthors);
      } catch (error) {
        console.error('Error loading authors:', error);
      }
    };
    
    loadAuthors();
  }, [currentUser]);

  // Handle selecting an author from suggestions
  const handleAuthorSelect = (selectedAuthor: string) => {
    setAuthor(selectedAuthor);
    setShowSuggestions(false);
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
  const removeVerse = (verseToRemove: string) => {
    setBibleVerses(bibleVerses.filter(verse => verse !== verseToRemove));
  };
  
  // Handle saving the entry
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please add a title');
      return;
    }
    
    if (!content.trim()) {
      setError('Please add the quote content');
      return;
    }
    
    if (!author.trim()) {
      setError('Please add the quote author');
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
      const entryData: any = {
        title,
        type: 'quote',
        content,
        category,
        bibleVerses,
        author,
        updatedAt: Timestamp.now()
      };
      
      if (isEditing && entryId) {
        // Update existing entry
        await updateEntry(entryId, entryData);
        setSuccess('Quote updated successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        // Create new entry
        const newEntry: any = {
          ...entryData,
          userId: currentUser.uid,
          createdAt: Timestamp.now()
        };
        
        await createEntry(newEntry);
        setSuccess('Quote created successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving quote:', error);
      setError('Failed to save quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex h-full flex-col bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          {isEditing ? 'Edit Quote' : 'Create New Quote'}
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
              Title (optional)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter a title for this quote"
            />
          </div>
          
          {/* Quote Content */}
          <div>
            <label htmlFor="content" className="mb-1 block font-medium text-gray-700">
              Quote Text
            </label>
            <textarea
              id="content"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full min-h-[120px] rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter the quote text"
            />
          </div>
          
          {/* Author Field with Dropdown */}
          <div className="relative">
            <label htmlFor="author" className="mb-1 block font-medium text-gray-700">
              Author
            </label>
            <div className="relative">
              <input
                type="text"
                id="author"
                value={author}
                onChange={e => {
                  setAuthor(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter the author's name"
              />
              {showSuggestions && authorSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                  <ul className="max-h-60 overflow-auto py-1 text-base">
                    {authorSuggestions
                      .filter(suggestion => 
                        suggestion.toLowerCase().includes(author.toLowerCase())
                      )
                      .map((suggestion, index) => (
                        <li
                          key={index}
                          className="cursor-pointer px-3 py-2 hover:bg-indigo-50"
                          onClick={() => handleAuthorSelect(suggestion)}
                        >
                          {suggestion}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Enter an existing author or add a new one
            </div>
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
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          
          {/* Bible Verses */}
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
                className="flex-1 rounded-l-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddVerse}
                className="rounded-r-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
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
                      onClick={() => removeVerse(verse)}
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
                'Save Quote'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuoteEntryEditor; 