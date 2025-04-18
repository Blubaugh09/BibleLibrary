import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getEntryById, updateEntry, createEntry, Entry } from '../../services/firestore';
import { Timestamp } from 'firebase/firestore';

interface LinkEntryEditorProps {
  isEditing?: boolean;
}

// Main component for creating and editing link entries
const LinkEntryEditor: React.FC<LinkEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State variables
  const [title, setTitle] = useState('New Link Entry');
  const [embedCode, setEmbedCode] = useState('');
  const [content, setContent] = useState('');
  const [linkType, setLinkType] = useState<'twitter' | 'youtube' | 'website'>('twitter');
  const [category, setCategory] = useState('');
  const [relatedVerses, setRelatedVerses] = useState<string[]>([]);
  const [verseInput, setVerseInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  
  // Load existing entry if in edit mode
  useEffect(() => {
    const loadEntry = async () => {
      if (isEditing && entryId && currentUser) {
        try {
          setLoading(true);
          const loadedEntry = await getEntryById(entryId);
          
          if (loadedEntry && loadedEntry.userId === currentUser.uid) {
            setTitle(loadedEntry.title || 'New Link Entry');
            setContent(loadedEntry.content || '');
            setCategory(loadedEntry.category || '');
            setRelatedVerses(loadedEntry.relatedVerses || []);
            
            // Determine link type based on content
            if (loadedEntry.content?.includes('twitter.com') || loadedEntry.type === 'twitter') {
              setLinkType('twitter');
            } else if (loadedEntry.content?.includes('youtube.com') || loadedEntry.type === 'youtube') {
              setLinkType('youtube');
            } else {
              setLinkType('website');
            }
            
            setEmbedCode(loadedEntry.content || '');
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
  
  // Handle embed code change
  const handleEmbedCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newEmbedCode = e.target.value;
    setEmbedCode(newEmbedCode);
    
    // Auto-detect link type and format
    if (newEmbedCode.includes('twitter.com') || newEmbedCode.includes('x.com')) {
      setLinkType('twitter');
      
      // If it's already a properly formatted Twitter embed code, keep it as is
      if (newEmbedCode.includes('<blockquote class="twitter-tweet"')) {
        // Ensure the script tag is included
        if (!newEmbedCode.includes('platform.twitter.com/widgets.js')) {
          const completeEmbed = `${newEmbedCode}\n<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
          setEmbedCode(completeEmbed);
          setContent(completeEmbed);
        } else {
          setContent(newEmbedCode);
        }
      } 
      // If it's a Twitter/X URL, convert it to proper embed code
      else {
        // Extract the tweet URL or ID
        const tweetMatch = newEmbedCode.match(/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/);
        
        if (tweetMatch) {
          // Use the entire URL in the embed code
          const tweetUrl = newEmbedCode.trim();
          const embedCode = `<blockquote class="twitter-tweet"><a href="${tweetUrl}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
          setEmbedCode(embedCode);
          setContent(embedCode);
          
          // Try to extract username from URL for the title
          const usernameMatch = tweetUrl.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
          if (usernameMatch && usernameMatch[1] && usernameMatch[1] !== 'status') {
            if (title === 'New Link Entry') {
              setTitle(`Tweet by @${usernameMatch[1]}`);
            }
          } else if (title === 'New Link Entry') {
            setTitle('Twitter Post');
          }
        } else {
          // It's not a tweet URL but some other Twitter-related URL
          setContent(newEmbedCode);
          
          // Try to extract username from URL
          const urlUsernameMatch = newEmbedCode.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
          if (urlUsernameMatch && urlUsernameMatch[1] && title === 'New Link Entry' && 
              urlUsernameMatch[1] !== 'status' && urlUsernameMatch[1] !== 'i') {
            setTitle(`Twitter: @${urlUsernameMatch[1]}`);
          } else if (title === 'New Link Entry') {
            setTitle('Twitter Profile');
          }
        }
      }
    } else if (newEmbedCode.includes('youtube.com') || newEmbedCode.includes('youtu.be')) {
      setLinkType('youtube');
      
      // Check if it's already an iframe embed
      if (newEmbedCode.includes('<iframe') && newEmbedCode.includes('youtube.com/embed')) {
        // It's already a properly formatted YouTube embed
        setContent(newEmbedCode);
      } else {
        // Extract video ID from different URL formats
        let videoId = null;
        
        // Standard YouTube URL
        const standardMatch = newEmbedCode.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
        if (standardMatch && standardMatch[1]) {
          videoId = standardMatch[1];
        }
        
        // YouTube short URL
        if (!videoId) {
          const shortMatch = newEmbedCode.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/);
          if (shortMatch && shortMatch[1]) {
            videoId = shortMatch[1];
          }
        }
        
        // YouTube embed URL
        if (!videoId) {
          const embedMatch = newEmbedCode.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
          if (embedMatch && embedMatch[1]) {
            videoId = embedMatch[1];
          }
        }
        
        if (videoId) {
          // Create a proper YouTube embed
          const embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
          setContent(embedCode);
          
          // Try to get video title from API (not implemented - would require YouTube API key)
          if (title === 'New Link Entry') {
            setTitle(`YouTube Video: ${videoId}`);
          }
        } else {
          // Just store the URL as is
          setContent(newEmbedCode);
        }
      }
      
      if (title === 'New Link Entry') {
        setTitle('YouTube Video');
      }
    } else {
      setLinkType('website');
      setContent(newEmbedCode);
      if (title === 'New Link Entry') {
        setTitle('Web Link');
      }
    }
  };
  
  // Preview Twitter embed
  useEffect(() => {
    if (previewVisible && embedCode && linkType === 'twitter') {
      // Load Twitter widget script to render the preview
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
      
      return () => {
        try {
          document.body.removeChild(script);
        } catch (e) {
          console.warn('Twitter script already removed');
        }
      };
    }
  }, [previewVisible, embedCode, linkType]);
  
  // Handle saving the entry
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Please add some content');
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
      const entryType = linkType === 'twitter' ? 'twitter' : 
                        linkType === 'youtube' ? 'youtube' : 'link';
      
      // Extract Bible verses if any (for metadata)
      const extractedVerses = relatedVerses.length > 0 ? relatedVerses : [];
      
      const entryData: Partial<Entry> = {
        title,
        type: entryType,
        content,
        category,
        relatedVerses: extractedVerses,
        bibleVerses: extractedVerses, // Also store as bibleVerses for consistency with other entry types
        updatedAt: Timestamp.now()
      };
      
      if (isEditing && entryId) {
        // Update existing entry
        await updateEntry(entryId, entryData);
        setSuccess('Entry updated successfully!');
        setTimeout(() => {
          // Redirect to library page instead of entry detail
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
        setSuccess('Entry created successfully!');
        setTimeout(() => {
          // Redirect to library page instead of entry detail
          navigate('/');
        }, 1500);
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      setError('Failed to save entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle adding a verse
  const handleAddVerse = () => {
    if (!verseInput.trim()) return;
    
    if (!relatedVerses.includes(verseInput)) {
      setRelatedVerses([...relatedVerses, verseInput]);
    }
    
    setVerseInput('');
  };
  
  // Remove a verse
  const removeVerse = (verseToRemove: string) => {
    setRelatedVerses(relatedVerses.filter(verse => verse !== verseToRemove));
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">
            {isEditing ? 'Edit Link Entry' : 'New Link Entry'}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-green-700">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSave} className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          
          {/* Link Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Link Type</label>
            <div className="mt-1 flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-indigo-600"
                  value="twitter"
                  checked={linkType === 'twitter'}
                  onChange={() => setLinkType('twitter')}
                />
                <span className="ml-2 text-sm text-gray-700">Twitter</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-indigo-600"
                  value="youtube"
                  checked={linkType === 'youtube'}
                  onChange={() => setLinkType('youtube')}
                />
                <span className="ml-2 text-sm text-gray-700">YouTube</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-indigo-600"
                  value="website"
                  checked={linkType === 'website'}
                  onChange={() => setLinkType('website')}
                />
                <span className="ml-2 text-sm text-gray-700">Website</span>
              </label>
            </div>
          </div>
          
          {/* Embed Code */}
          <div>
            <label htmlFor="embedCode" className="block text-sm font-medium text-gray-700">
              {linkType === 'twitter' ? 'Twitter URL' : linkType === 'youtube' ? 'YouTube URL/Embed' : 'Website URL/Embed'}
            </label>
            <textarea
              id="embedCode"
              value={embedCode}
              onChange={handleEmbedCodeChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              rows={4}
              placeholder={
                linkType === 'twitter'
                  ? 'Paste Twitter/X post URL here (e.g., https://twitter.com/username/status/123456...)'
                  : linkType === 'youtube'
                  ? 'Paste YouTube video URL here (e.g., https://youtube.com/watch?v=abcdef)'
                  : 'Paste website URL or embed code here'
              }
              required
            />
            {linkType === 'twitter' && (
              <p className="mt-1 text-xs text-gray-500">
                Just paste the URL of the tweet - the embed will be created automatically.
              </p>
            )}
            {linkType === 'youtube' && (
              <p className="mt-1 text-xs text-gray-500">
                Paste the YouTube video URL - the embed will be created automatically.
              </p>
            )}
          </div>
          
          {/* Preview Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setPreviewVisible(!previewVisible)}
              className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {previewVisible ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
          
          {/* Preview */}
          {previewVisible && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Preview</h3>
              <div className="rounded-md border p-3">
                {embedCode ? (
                  <div dangerouslySetInnerHTML={{ __html: embedCode }} />
                ) : (
                  <p className="text-sm text-gray-500">No preview available. Please add embed code.</p>
                )}
              </div>
            </div>
          )}
          
          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Spiritual Category (optional)
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a category...</option>
              <option value="Person">Person</option>
              <option value="Place">Place</option>
              <option value="Event">Event</option>
              <option value="Object">Object</option>
              <option value="Theme">Theme</option>
              <option value="Symbol">Symbol</option>
              <option value="Prophecy">Prophecy</option>
              <option value="Teaching">Teaching</option>
              <option value="Genealogy">Genealogy</option>
              <option value="Covenant">Covenant</option>
              <option value="Doctrine">Doctrine</option>
              <option value="Practice">Practice</option>
              <option value="Virtue/Vice">Virtue/Vice</option>
              <option value="Group">Group</option>
              <option value="Literary Type">Literary Type</option>
              <option value="Time Period">Time Period</option>
              <option value="Miracle">Miracle</option>
              <option value="Relationship">Relationship</option>
            </select>
          </div>
          
          {/* Related Verses */}
          <div>
            <label htmlFor="verseInput" className="block text-sm font-medium text-gray-700">
              Related Bible Verses (optional)
            </label>
            <div className="mt-1 flex">
              <input
                type="text"
                id="verseInput"
                value={verseInput}
                onChange={(e) => setVerseInput(e.target.value)}
                placeholder="e.g., John 3:16"
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
            
            {relatedVerses.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedVerses.map((verse, index) => (
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
          
          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {loading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : isEditing ? (
                'Update Entry'
              ) : (
                'Save Entry'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkEntryEditor; 