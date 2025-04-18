import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createEntry, updateEntry, getEntryById, Entry } from '../../services/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';

interface PoemEntryEditorProps {
  isEditing?: boolean;
}

const PoemEntryEditor: React.FC<PoemEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State variables
  const [title, setTitle] = useState('New Poem');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [bibleVerses, setBibleVerses] = useState<string[]>([]);
  const [verseInput, setVerseInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category options - same as in TextEntryEditor
  const categoryOptions = [
    'Worship', 'Praise', 'Lament', 'Thanksgiving',
    'Wisdom', 'Prophetic', 'Love', 'Nature',
    'Faith', 'Hope', 'Devotional', 'Biblical',
    'Testimony', 'Prayer', 'Spiritual Growth', 'Reflection'
  ];
  
  // Load existing entry if in edit mode
  useEffect(() => {
    const loadEntry = async () => {
      if (isEditing && entryId && currentUser) {
        try {
          setLoading(true);
          const loadedEntry = await getEntryById(entryId);
          
          if (loadedEntry && loadedEntry.userId === currentUser.uid) {
            setTitle(loadedEntry.title || 'New Poem');
            setContent(loadedEntry.content || '');
            setCategory(loadedEntry.category || '');
            setBibleVerses(loadedEntry.bibleVerses || []);
            
            // Handle imageUrl if it exists
            if (loadedEntry.imageUrl) {
              setImageUrl(loadedEntry.imageUrl);
              setImagePreview(loadedEntry.imageUrl);
            }
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
  
  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.match('image.*')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };
  
  // Remove selected image
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Upload image to Firebase Storage
  const uploadImage = async (poemId: string): Promise<string | null> => {
    if (!imageFile) return imageUrl; // Return existing URL if no new file
    
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `poems/${currentUser?.uid}/${poemId}`);
      
      await uploadBytes(storageRef, imageFile);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
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
      setError('Please add your poem content');
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
      const entryData: Partial<Entry> = {
        title,
        type: 'poem',
        content,
        category,
        bibleVerses,
        updatedAt: Timestamp.now()
      };
      
      if (isEditing && entryId) {
        // Upload image if there's a new one
        if (imageFile) {
          const uploadedImageUrl = await uploadImage(entryId);
          if (uploadedImageUrl) {
            entryData.imageUrl = uploadedImageUrl;
          }
        }
        
        // Update existing entry
        await updateEntry(entryId, entryData);
        setSuccess('Poem updated successfully!');
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
        
        // Create entry first to get ID
        const createdEntry = await createEntry(newEntry);
        
        // Then upload image if there is one
        if (imageFile && createdEntry.id) {
          const uploadedImageUrl = await uploadImage(createdEntry.id);
          if (uploadedImageUrl) {
            // Update the entry with the image URL
            await updateEntry(createdEntry.id, { imageUrl: uploadedImageUrl });
          }
        }
        
        setSuccess('Poem created successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving poem:', error);
      setError('Failed to save poem. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex h-full flex-col bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          {isEditing ? 'Edit Poem' : 'Create New Poem'}
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
              Poem Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter poem title"
            />
          </div>
          
          {/* Poem Content */}
          <div>
            <label htmlFor="content" className="mb-1 block font-medium text-gray-700">
              Poem Text
            </label>
            <textarea
              id="content"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full min-h-[200px] rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter your poem here"
            />
          </div>
          
          {/* Image Upload */}
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Upload Image (optional)
            </label>
            <div className="mt-1 flex items-center space-x-4">
              <label className="flex cursor-pointer items-center justify-center rounded-md bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                Select Image
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Remove Image
                </button>
              )}
            </div>
            {imagePreview && (
              <div className="mt-3 rounded-md border border-gray-200 p-2">
                <img
                  src={imagePreview}
                  alt="Poem illustration"
                  className="mx-auto max-h-64 rounded"
                />
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              For best results, use an image that is related to your poem. Max size 5MB.
            </p>
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
                'Save Poem'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PoemEntryEditor; 