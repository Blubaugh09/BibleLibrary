import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Entry, getAllEntryLinks, EntryLink, getEntryById, deleteEntryLink } from '../../services/firestore';
import MDEditor from '@uiw/react-md-editor';
import AudioPlayer from '../Audio/AudioPlayer';
import { getBiblePassage } from '../../services/api';
import ReactMarkdown from 'react-markdown';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { deleteEntry } from '../../services/firestore';

// Add this at the top of the file before the component definitions
declare global {
  interface Window {
    twttr: {
      widgets: {
        load: () => void;
      };
    };
  }
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

// Generic entry props
interface EntryComponentProps {
  entry?: Entry;
}

// Link Entry Component
export const LinkEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this link entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry?.title || 'Link Entry'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/link/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Embedded content */}
        {entry?.content ? (
          <div className="my-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-4">
            {/* Show as a clickable link if it's a URL */}
            {entry.content.startsWith('http') && !entry.content.includes('<iframe') ? (
              <div>
                <a 
                  href={entry.content} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {entry.content}
                </a>
              </div>
            ) : (
              // Otherwise show as text
              <div>
                <p className="text-gray-700 whitespace-pre-wrap">{entry.content}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="py-4 text-gray-500 italic">No content available for this link entry.</p>
        )}
        
        {/* Bible Verses */}
        {entry?.bibleVerses && entry.bibleVerses.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-lg font-medium text-gray-800">Bible Verses</h3>
            <div className="flex flex-wrap gap-2">
              {entry.bibleVerses.map((verse, index) => (
                <span 
                  key={index}
                  className="inline-flex rounded-md bg-indigo-50 px-2.5 py-0.5 text-sm font-medium text-indigo-700"
                >
                  {verse}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Description */}
        {entry?.description && (
          <div className="mt-4">
            <h3 className="mb-2 text-lg font-medium text-gray-800">Description</h3>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-gray-700 whitespace-pre-wrap">{entry.description}</p>
            </div>
          </div>
        )}
        
        {/* Category */}
        {entry?.category && (
          <div className="mt-4">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Created At */}
        {entry?.createdAt && (
          <div className="mt-6 text-sm text-gray-500">
            Created on: {entry.createdAt.toDate ? entry.createdAt.toDate().toLocaleDateString() : new Date(entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Video Entry Component
export const VideoEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this video entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Video Entry</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/video/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Text Entry Component
export const TextEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
    }
  };
  
  if (!entry) return null;
  
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this text entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry.title}</h2>
          <div className="flex space-x-2">
            <Link 
              to={`/text/edit/${entryId}`} 
              className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        </div>
        
        {/* Description */}
        {entry.description && (
          <div className="mb-4 text-gray-600">
            {entry.description}
          </div>
        )}
        
        {/* Category */}
        {entry.category && (
          <div className="mb-4">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Bible Verses */}
        {entry.bibleVerses && entry.bibleVerses.length > 0 && (
          <div className="mb-6 rounded-md bg-indigo-50 p-4">
            <h3 className="mb-2 font-medium text-indigo-700">Related Bible Verses:</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              {entry.bibleVerses.map((verse, index) => (
                <li 
                  key={index} 
                  className="cursor-pointer italic hover:text-indigo-700 hover:underline"
                  onClick={() => handleVerseClick(verse)}
                >
                  {verse}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Content */}
        <div className="mb-6 prose max-w-none" data-color-mode="light">
          <MDEditor.Markdown source={entry.content || ''} />
        </div>
        
        {/* Audio Player */}
        {entry.audioUrl && (
          <div className="mt-6 rounded-md bg-green-50 p-4">
            <h3 className="mb-2 font-medium text-green-700">Audio Version:</h3>
            <AudioPlayer src={typeof entry.audioUrl === 'string' ? entry.audioUrl : Array.isArray(entry.audioUrl) ? entry.audioUrl[0] : ''} />
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Audio Entry Component
export const AudioEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const navigate = useNavigate();
  const { entryId } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  if (!entry) {
    return (
      <div className="flex h-screen flex-col bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-gray-800">Audio Entry Not Found</h2>
          <p className="text-gray-600">The audio entry could not be loaded.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this audio entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry.title}</h2>
          <div className="flex space-x-2">
            <Link 
              to={`/audio/edit/${entryId}`} 
              className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        </div>
        
        {/* Recording date */}
        <div className="mb-4 text-sm text-gray-500">
          Recorded on {entry.createdAt ? formatDate(entry.createdAt) : 'Unknown date'}
        </div>
        
        {/* Audio Player */}
        <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 font-medium text-blue-700">Original Recording:</h3>
          {entry.audioUrl ? (
            <>
              <AudioPlayer 
                src={typeof entry.audioUrl === 'string' ? entry.audioUrl : Array.isArray(entry.audioUrl) ? entry.audioUrl[0] : ''} 
                showFileInfo={false}
                className="bg-white"
              />
              <div className="mt-2 text-xs text-gray-500">
                {(entry as any)._recordingType ? (
                  <span>Recording format: {(entry as any)._recordingType}</span>
                ) : (
                  <span>Recording saved to Firebase Storage</span>
                )}
                {(entry as any)._audioPath && (
                  <div className="mt-1 truncate text-xs text-gray-400">
                    File: {(entry as any)._audioPath}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white p-4 rounded-md border border-gray-200">
              <p className="text-gray-600 italic">Audio recording not available</p>
              <p className="text-sm text-red-500 mt-2">
                The audio file may not have been properly saved to Firebase Storage.
              </p>
            </div>
          )}
        </div>
        
        {/* Transcription Content */}
        {entry.content && (
          <div className="mb-6">
            <h3 className="mb-2 font-medium text-gray-700">Transcription:</h3>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 whitespace-pre-wrap">
              {entry.content}
            </div>
          </div>
        )}
        
        {/* Category */}
        {entry.category && (
          <div className="mb-4">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Bible Verses */}
        {entry.bibleVerses && entry.bibleVerses.length > 0 && (
          <div className="mb-6 rounded-md bg-indigo-50 p-4">
            <h3 className="font-semibold text-indigo-700">Bible Verses:</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              {entry.bibleVerses.map((verse, index) => (
                <li 
                  key={index} 
                  className="cursor-pointer italic hover:text-indigo-700 hover:underline"
                  onClick={() => handleVerseClick(verse)}
                >
                  {verse}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Related Verses */}
        {entry.relatedVerses && entry.relatedVerses.length > 0 && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <h3 className="mb-2 font-medium text-green-700">Related Verses:</h3>
            <ul className="space-y-1 text-sm text-gray-700">
              {entry.relatedVerses.map((verse, index) => (
                <li 
                  key={index} 
                  className="cursor-pointer italic hover:text-green-700 hover:underline"
                  onClick={() => handleVerseClick(verse)}
                >
                  {verse}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Song Entry Component
export const SongEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Parse content into verses and comments
  const [verses, setVerses] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  
  useEffect(() => {
    if (entry?.content) {
      try {
        const contentObj = JSON.parse(entry.content);
        if (contentObj.verses && Array.isArray(contentObj.verses)) {
          setVerses(contentObj.verses);
        } else {
          setVerses([entry.content]);
        }
        
        if (contentObj.comments) {
          setComments(contentObj.comments);
        }
      } catch (e) {
        // If JSON parsing fails, use content as one verse
        setVerses([entry.content]);
      }
    }
  }, [entry]);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
    }
  };
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  if (!entry) return null;
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this song? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry.title}</h2>
          <div className="flex space-x-2">
            <Link 
              to={`/song/edit/${entryId}`} 
              className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        </div>
        
        {/* Song content */}
        <div className="space-y-6">
          {verses.map((verse, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Verse {index + 1}</h3>
              <div className="whitespace-pre-wrap text-gray-800">{verse}</div>
            </div>
          ))}
        </div>
        
        {/* Comments section */}
        {comments && (
          <div className="mt-6">
            <h3 className="mb-2 text-lg font-medium text-gray-700">Comments</h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="whitespace-pre-wrap text-gray-700">{comments}</p>
            </div>
          </div>
        )}
        
        {/* Category */}
        {entry.category && (
          <div className="mt-4">
            <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Bible verses */}
        {entry.bibleVerses && entry.bibleVerses.length > 0 && (
          <div className="mt-6 rounded-md bg-indigo-50 p-4">
            <h3 className="font-semibold text-indigo-700">Bible Verses:</h3>
            <div className="mt-2 space-y-1">
              {entry.bibleVerses.map((verse, index) => (
                <div 
                  key={index} 
                  className="cursor-pointer italic text-gray-700 hover:text-indigo-700 hover:underline"
                  onClick={() => handleVerseClick(verse)}
                >
                  {verse}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Creation date */}
        {entry.createdAt && (
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(entry.createdAt.toDate ? entry.createdAt.toDate() : entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Poem Entry Component
export const PoemEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this poem entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry?.title || 'Poem Entry'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/poem/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Poem content */}
        {entry?.content ? (
          <div className="prose prose-indigo mx-auto my-6 max-w-none whitespace-pre-wrap text-center font-serif leading-relaxed">
            {entry.content}
          </div>
        ) : (
          <p className="text-center text-gray-600">No poem content available.</p>
        )}
        
        {/* Show attribution if available */}
        {(entry as any)?.attribution && (
          <div className="mt-4 text-right">
            <span className="italic text-gray-700">— {(entry as any).attribution}</span>
          </div>
        )}
        
        {/* Show category if available */}
        {entry?.category && (
          <div className="mt-4">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Show related verses if available */}
        {((entry?.bibleVerses && entry.bibleVerses.length > 0) || (entry?.relatedVerses && entry.relatedVerses.length > 0)) && (
          <div className="mt-4 rounded-md bg-indigo-50 p-3">
            <h3 className="font-semibold text-indigo-700">Related Bible Verses:</h3>
            <div className="mt-2 space-y-1">
              {/* Show bibleVerses */}
              {entry?.bibleVerses && entry.bibleVerses.map((verse, index) => (
                <div
                  key={`bible-${index}`}
                  className="block w-full text-left text-sm italic text-indigo-600"
                >
                  {verse}
                </div>
              ))}
              
              {/* Show relatedVerses if they're not already in bibleVerses */}
              {entry?.relatedVerses && entry.relatedVerses
                .filter(verse => !entry.bibleVerses || !entry.bibleVerses.includes(verse))
                .map((verse, index) => (
                  <div
                    key={`related-${index}`}
                    className="block w-full text-left text-sm italic text-indigo-600"
                  >
                    {verse}
                  </div>
                ))
              }
            </div>
          </div>
        )}
        
        {/* Show creation date */}
        {entry?.createdAt && (
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(entry.createdAt.toDate ? entry.createdAt.toDate() : entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Quote Entry Component
export const QuoteEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this quote? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry?.title || 'Quote'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/quote/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Quote content */}
        {entry?.content ? (
          <div className="mb-6 flex flex-col items-center justify-center">
            <div className="relative mx-auto max-w-2xl py-6">
              <div className="absolute left-0 top-0 text-5xl text-gray-300">"</div>
              <div className="relative z-10 px-8">
                <p className="text-center text-xl font-serif italic text-gray-700">{entry.content}</p>
              </div>
              <div className="absolute bottom-0 right-0 text-5xl text-gray-300">"</div>
            </div>
            
            {(entry as any)?.author && (
              <div className="mt-4 self-end">
                <p className="text-right text-gray-600">— {(entry as any).author}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-600">No quote content available.</p>
        )}
        
        {/* Show category if available */}
        {entry?.category && (
          <div className="mt-4">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Show related verses if available */}
        {((entry?.bibleVerses && entry.bibleVerses.length > 0) || (entry?.relatedVerses && entry.relatedVerses.length > 0)) && (
          <div className="mt-4 rounded-md bg-indigo-50 p-3">
            <h3 className="font-semibold text-indigo-700">Related Bible Verses:</h3>
            <div className="mt-2 space-y-1">
              {/* Show bibleVerses */}
              {entry?.bibleVerses && entry.bibleVerses.map((verse, index) => (
                <button
                  key={`bible-${index}`}
                  onClick={() => handleVerseClick(verse)}
                  className="block w-full cursor-pointer text-left text-sm italic text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {verse}
                </button>
              ))}
              
              {/* Show relatedVerses if they're not already in bibleVerses */}
              {entry?.relatedVerses && entry.relatedVerses
                .filter(verse => !entry.bibleVerses || !entry.bibleVerses.includes(verse))
                .map((verse, index) => (
                  <button
                    key={`related-${index}`}
                    onClick={() => handleVerseClick(verse)}
                    className="block w-full cursor-pointer text-left text-sm italic text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {verse}
                  </button>
                ))}
            </div>
          </div>
        )}
        
        {/* Show creation date */}
        {entry?.createdAt && (
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(entry.createdAt.toDate ? entry.createdAt.toDate() : entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// Twitter Entry Component
export const TwitterEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
    }
  };
  
  // Twitter embed script
  useEffect(() => {
    // Load Twitter widget script
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    document.body.appendChild(script);

    // After the script is loaded, call twttr.widgets.load() to process embeds
    const onScriptLoad = () => {
      if (window.twttr && window.twttr.widgets) {
        window.twttr.widgets.load();
      }
    };

    script.onload = onScriptLoad;
    
    // Cleanup function to remove the script
    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        console.warn('Twitter script already removed');
      }
    };
  }, [entry?.content]);
  
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  // Get clean embed code - ensure it has both blockquote and script if needed
  const getEmbedCode = () => {
    if (!entry?.content) return '';
    
    // If it already has a blockquote and script, return as is
    if (entry.content.includes('<blockquote class="twitter-tweet"') && 
        entry.content.includes('platform.twitter.com/widgets.js')) {
      return entry.content;
    }
    
    // If it has blockquote but no script, add the script
    if (entry.content.includes('<blockquote class="twitter-tweet"') && 
        !entry.content.includes('platform.twitter.com/widgets.js')) {
      return `${entry.content}\n<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
    }
    
    // If it's a tweet URL (either twitter.com or x.com)
    const tweetUrlMatch = entry.content.match(/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/[0-9]+/);
    if (tweetUrlMatch) {
      return `<blockquote class="twitter-tweet"><a href="${entry.content}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
    }
    
    // If it's a regular Twitter/X URL (not a specific tweet)
    if (entry.content.includes('twitter.com/') || entry.content.includes('x.com/')) {
      return `<a href="${entry.content}" target="_blank" rel="noopener noreferrer">${entry.content}</a>`;
    }
    
    return entry.content;
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this Twitter entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry?.title || 'Twitter Entry'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/link/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Twitter embed content */}
        {entry?.content ? (
          <div 
            className="twitter-embed my-4 rounded-lg border border-blue-100 bg-blue-50 p-4"
            dangerouslySetInnerHTML={{ __html: getEmbedCode() }}
          />
        ) : (
          <p className="text-gray-600">No Twitter content available.</p>
        )}
        
        {/* Show category if available */}
        {entry?.category && (
          <div className="mt-4">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Show Bible verses if available - All verses in one section */}
        {((entry?.bibleVerses && entry.bibleVerses.length > 0) || (entry?.relatedVerses && entry.relatedVerses.length > 0)) && (
          <div className="mt-4 rounded-md bg-indigo-50 p-4">
            <h3 className="font-semibold text-indigo-700">Bible Verses:</h3>
            <ul className="mt-2 space-y-1">
              {/* Show bibleVerses */}
              {entry?.bibleVerses && entry.bibleVerses.map((verse, index) => (
                <li 
                  key={`bible-${index}`}
                  className="cursor-pointer italic text-gray-700 hover:text-indigo-700 hover:underline"
                  onClick={() => handleVerseClick(verse)}
                >
                  {verse}
                </li>
              ))}
              
              {/* Show relatedVerses if they're not already in bibleVerses */}
              {entry?.relatedVerses && entry.relatedVerses
                .filter(verse => !entry.bibleVerses || !entry.bibleVerses.includes(verse))
                .map((verse, index) => (
                  <li 
                    key={`related-${index}`}
                    className="cursor-pointer italic text-gray-700 hover:text-indigo-700 hover:underline"
                    onClick={() => handleVerseClick(verse)}
                  >
                    {verse}
                  </li>
                ))}
            </ul>
          </div>
        )}
        
        {/* Show creation date */}
        {entry?.createdAt && (
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(entry.createdAt.toDate ? entry.createdAt.toDate() : entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// YouTube Entry Component
export const YouTubeEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  // Format YouTube embed code if needed
  const getYouTubeEmbed = (content: string | undefined) => {
    if (!content) return '';
    
    // If it's already an embed code with iframe, return as is
    if (content.includes('<iframe')) {
      return content;
    }
    
    // Extract video ID from different URL formats
    let videoId = null;
    
    // Standard YouTube URL format
    const standardMatch = content.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (standardMatch && standardMatch[1]) {
      videoId = standardMatch[1];
    }
    
    // YouTube short URL
    if (!videoId) {
      const shortMatch = content.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (shortMatch && shortMatch[1]) {
        videoId = shortMatch[1];
      }
    }
    
    // YouTube embed URL
    if (!videoId) {
      const embedMatch = content.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch && embedMatch[1]) {
        videoId = embedMatch[1];
      }
    }
    
    // If a video ID was found, create an embed iframe
    if (videoId) {
      return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" title="YouTube Video ${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    
    // If it's a YouTube URL without extractable ID, return a link
    if (content.includes('youtube.com') || content.includes('youtu.be')) {
      return `<a href="${content}" target="_blank" rel="noopener noreferrer">YouTube Link: ${content}</a>`;
    }
    
    // Default: return content as is
    return content;
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this YouTube entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry?.title || 'YouTube Video'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/link/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* YouTube embed content */}
        {entry?.content ? (
          <div 
            className="youtube-embed my-6 rounded-lg border border-red-100 bg-red-50 p-4"
            dangerouslySetInnerHTML={{ __html: getYouTubeEmbed(entry.content) }}
          />
        ) : (
          <p className="text-gray-600">No YouTube content available.</p>
        )}
        
        {/* Show category if available */}
        {entry?.category && (
          <div className="mt-4">
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Show Bible verses if available - All verses in one section */}
        {((entry?.bibleVerses && entry.bibleVerses.length > 0) || (entry?.relatedVerses && entry.relatedVerses.length > 0)) && (
          <div className="mt-4 rounded-md bg-indigo-50 p-4">
            <h3 className="font-semibold text-indigo-700">Bible Verses:</h3>
            <ul className="mt-2 space-y-1">
              {/* Show bibleVerses */}
              {entry?.bibleVerses && entry.bibleVerses.map((verse, index) => (
                <li 
                  key={`bible-${index}`}
                  className="cursor-pointer italic text-gray-700 hover:text-indigo-700 hover:underline"
                  onClick={() => handleVerseClick(verse)}
                >
                  {verse}
                </li>
              ))}
              
              {/* Show relatedVerses if they're not already in bibleVerses */}
              {entry?.relatedVerses && entry.relatedVerses
                .filter(verse => !entry.bibleVerses || !entry.bibleVerses.includes(verse))
                .map((verse, index) => (
                  <li 
                    key={`related-${index}`}
                    className="cursor-pointer italic text-gray-700 hover:text-indigo-700 hover:underline"
                    onClick={() => handleVerseClick(verse)}
                  >
                    {verse}
                  </li>
                ))}
            </ul>
          </div>
        )}
        
        {/* Show creation date */}
        {entry?.createdAt && (
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(entry.createdAt.toDate ? entry.createdAt.toDate() : entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
}; 

// Image Entry Component
export const ImageEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
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
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    // Extract just the reference part
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
  
  // Close the modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this image? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry?.title || 'Image'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/image/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Image Display */}
        {entry?.imageUrl ? (
          <div className="mb-6 flex flex-col items-center justify-center">
            <img 
              src={entry.imageUrl as string} 
              alt={entry.title || 'Image'}
              className="max-h-[500px] w-auto max-w-full rounded-md shadow-md"
            />
          </div>
        ) : (
          <p className="text-center text-gray-600">No image available.</p>
        )}
        
        {/* Description */}
        {entry?.content && (
          <div className="mb-6 rounded-md bg-gray-50 p-4">
            <p className="text-gray-700">{entry.content}</p>
          </div>
        )}
        
        {/* Show category if available */}
        {entry?.category && (
          <div className="mt-4">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Show related verses if available */}
        {((entry?.bibleVerses && entry.bibleVerses.length > 0) || (entry?.relatedVerses && entry.relatedVerses.length > 0)) && (
          <div className="mt-4 rounded-md bg-indigo-50 p-3">
            <h3 className="font-semibold text-indigo-700">Related Bible Verses:</h3>
            <div className="mt-2 space-y-1">
              {/* Show bibleVerses */}
              {entry?.bibleVerses && entry.bibleVerses.map((verse, index) => (
                <button
                  key={`bible-${index}`}
                  onClick={() => handleVerseClick(verse)}
                  className="block w-full cursor-pointer text-left text-sm italic text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {verse}
                </button>
              ))}
              
              {/* Show relatedVerses if they're not already in bibleVerses */}
              {entry?.relatedVerses && entry.relatedVerses
                .filter(verse => !entry.bibleVerses || !entry.bibleVerses.includes(verse))
                .map((verse, index) => (
                  <button
                    key={`related-${index}`}
                    onClick={() => handleVerseClick(verse)}
                    className="block w-full cursor-pointer text-left text-sm italic text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {verse}
                  </button>
                ))}
            </div>
          </div>
        )}
        
        {/* Show creation date */}
        {entry?.createdAt && (
          <div className="mt-4 text-sm text-gray-500">
            Created: {new Date(entry.createdAt.toDate ? entry.createdAt.toDate() : entry.createdAt).toLocaleDateString()}
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
}; 

export const PathwayEntry: React.FC<EntryComponentProps> = ({ entry }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  
  // State for verse modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Format date helper
  const formatDate = (date: any) => {
    if (!date) return '';
    
    // Handle Firestore Timestamp or Date object
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dateObj);
  };
  
  // Handle verse click
  const handleVerseClick = async (verse: string) => {
    setSelectedVerse(verse);
    setVerseLoading(true);
    setModalOpen(true);
    
    try {
      const bibleText = await getBiblePassage(verse);
      setVerseText(bibleText || 'Verse text not available');
    } catch (error) {
      console.error('Error fetching verse:', error);
      setVerseText('Error loading verse content. Please try again.');
    } finally {
      setVerseLoading(false);
    }
  };
  
  // Handle closing the verse modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  // Handle entry deletion
  const handleDelete = async () => {
    if (!entryId) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(entryId);
      
      // Navigate back to the library
      navigate('/');
    } catch (error) {
      console.error('Error deleting entry:', error);
      setIsDeleting(false);
    }
  };
  
  if (!entry) {
    return (
      <div className="flex h-screen flex-col bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-2xl font-bold text-gray-800">Pathway Entry Not Found</h2>
          <p className="text-gray-600">The pathway entry could not be loaded.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen flex-col bg-gray-50 p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Confirm Delete</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this pathway entry? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        {/* Header with title and edit/delete buttons */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{entry.title || 'Pathway Entry'}</h2>
          {entryId && (
            <div className="flex space-x-2">
              <Link 
                to={`/pathway/edit/${entryId}`} 
                className="rounded-md bg-indigo-100 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-200"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        
        {/* Creation Date */}
        {entry.createdAt && (
          <div className="mb-4 text-sm text-gray-500">
            Created: {formatDate(entry.createdAt)}
          </div>
        )}
        
        {/* Render content with Markdown */}
        {entry.content && (
          <div className="my-6">
            {(() => {
              try {
                // Try to parse content as JSON containing pathway points
                const contentData = JSON.parse(entry.content);
                if (contentData.pathwayPoints && Array.isArray(contentData.pathwayPoints)) {
                  return (
                    <div className="pathway-timeline relative pl-8">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-200"></div>
                      
                      {/* Pathway points */}
                      {contentData.pathwayPoints.map((point: any, index: number) => (
                        <div key={index} className="mb-8 relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-8 w-4 h-4 rounded-full bg-indigo-500 z-10 mt-1.5"></div>
                          
                          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">{point.title}</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-700 mb-3">{point.description}</p>
                                
                                {point.primaryVerse && (
                                  <div className="bg-indigo-50 p-3 rounded-md">
                                    <div className="font-medium text-indigo-700 mb-1">Primary Verse:</div>
                                    <div 
                                      onClick={() => handleVerseClick(point.primaryVerse)}
                                      className="cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline"
                                    >
                                      {point.primaryVerse}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {point.additionalVerses && point.additionalVerses.length > 0 && (
                                <div>
                                  <div className="font-medium text-gray-700 mb-2">Also read:</div>
                                  <ul className="space-y-1">
                                    {point.additionalVerses.map((verse: string, idx: number) => (
                                      <li key={idx}>
                                        <span 
                                          onClick={() => handleVerseClick(verse)}
                                          className="cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline"
                                        >
                                          {verse}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
              } catch (e) {
                // If parsing fails, render content as Markdown
                console.error("Error parsing pathway content:", e);
              }
              
              // Fallback to regular Markdown rendering
              return <MDEditor.Markdown source={entry.content} />;
            })()}
          </div>
        )}
        
        {/* Comments section */}
        {entry.description && (
          <div className="my-6">
            <h3 className="mb-2 text-lg font-medium text-gray-700">Comments:</h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-600 italic">
              {entry.description}
            </div>
          </div>
        )}
        
        {/* Category */}
        {entry.category && (
          <div className="mb-4">
            <span className="font-medium text-gray-700">Category:</span> 
            <span className="ml-2 rounded-md bg-indigo-50 px-2 py-1 text-sm text-indigo-600">
              {entry.category}
            </span>
          </div>
        )}
        
        {/* Bible Verses */}
        {entry.bibleVerses && entry.bibleVerses.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-lg font-medium text-gray-700">Related Bible Verses:</h3>
            <ul className="flex flex-wrap gap-2">
              {entry.bibleVerses.map((verse, index) => (
                <li
                  key={index}
                  onClick={() => handleVerseClick(verse)}
                  className="cursor-pointer rounded-md bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                >
                  {verse}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Linked Entries Section */}
        {entryId && <LinkedEntries entryId={entryId} />}
      </div>
    </div>
  );
};

// LinkedEntries Component
interface LinkedEntriesProps {
  entryId: string;
}

const LinkedEntries: React.FC<LinkedEntriesProps> = ({ entryId }) => {
  const [loading, setLoading] = useState(true);
  const [linkedEntries, setLinkedEntries] = useState<Entry[]>([]);
  const [links, setLinks] = useState<{sourceLinks: EntryLink[], targetLinks: EntryLink[]}>({
    sourceLinks: [],
    targetLinks: []
  });

  useEffect(() => {
    const fetchLinkedEntries = async () => {
      try {
        // Get all links for this entry
        const allLinks = await getAllEntryLinks(entryId);
        setLinks(allLinks);
        
        // Get all linked entry IDs
        const linkedIds = [
          ...allLinks.sourceLinks.map(link => link.targetEntryId),
          ...allLinks.targetLinks.map(link => link.sourceEntryId)
        ];
        
        // Fetch all linked entries
        const fetchPromises = linkedIds.map(id => getEntryById(id));
        const entries = await Promise.all(fetchPromises);
        
        // Filter out any null entries and make unique by ID
        const validEntries = entries.filter(e => e !== null) as Entry[];
        const uniqueEntries = Array.from(
          new Map(validEntries.map(item => [item.id, item])).values()
        );
        
        setLinkedEntries(uniqueEntries);
      } catch (error) {
        console.error('Error fetching linked entries:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (entryId) {
      fetchLinkedEntries();
    }
  }, [entryId]);
  
  const handleUnlink = async (linkId: string) => {
    try {
      await deleteEntryLink(linkId);
      
      // Refresh links
      const newLinks = await getAllEntryLinks(entryId);
      setLinks(newLinks);
      
      // Update linked entries
      const linkedIds = [
        ...newLinks.sourceLinks.map(link => link.targetEntryId),
        ...newLinks.targetLinks.map(link => link.sourceEntryId)
      ];
      
      setLinkedEntries(prevEntries => 
        prevEntries.filter(entry => entry.id && linkedIds.includes(entry.id))
      );
    } catch (error) {
      console.error('Error unlinking entries:', error);
    }
  };
  
  if (loading) {
    return (
      <div className="mt-6 py-4 text-center text-gray-500">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"></div>
        <span className="ml-2">Loading linked entries...</span>
      </div>
    );
  }
  
  if (linkedEntries.length === 0) {
    return (
      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Linked Entries</h3>
          <Link 
            to="/"
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 mr-1" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" 
              />
            </svg>
            Link with entries in library
          </Link>
        </div>
        <p className="mt-2 text-sm text-gray-500">No linked entries found.</p>
      </div>
    );
  }
  
  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Linked Entries</h3>
        <Link 
          to="/"
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" 
            />
          </svg>
          Manage links
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {linkedEntries.map(entry => {
          // Find the link object between these entries
          const sourceLink = links.sourceLinks.find(link => link.targetEntryId === entry.id);
          const targetLink = links.targetLinks.find(link => link.sourceEntryId === entry.id);
          const linkId = sourceLink?.id || targetLink?.id;
          
          return (
            <div key={entry.id} className="flex flex-col rounded-md border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between">
                <div className="mb-2 text-sm text-gray-500">
                  {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                </div>
                {linkId && (
                  <button
                    onClick={() => linkId && handleUnlink(linkId)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <h4 className="mb-1 font-medium text-gray-900 line-clamp-1">{entry.title}</h4>
              {entry.description && (
                <p className="mb-2 text-sm text-gray-600 line-clamp-2">{entry.description}</p>
              )}
              <div className="mt-auto">
                <Link
                  to={entry.type === 'chat' ? `/chat/${entry.id}` : entry.type === 'pathway' ? `/pathway/${entry.id}` : `/entry/${entry.id}`}
                  className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  View {entry.type}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};