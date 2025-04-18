import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getUserEntries, 
  Entry, 
  updateEntry, 
  AIConversation, 
  createEntryLink, 
  getAllEntryLinks, 
  EntryLink,
  deleteEntryLink
} from '../../services/firestore';
import { getBiblePassage, chatWithGPT } from '../../services/api';
import AudioPlayer from '../Audio/AudioPlayer';

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

// Add SongEntry component
const SongEntry = ({ entry }: { entry: Entry }) => {
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

  return (
    <div className="space-y-2 w-full">
      {verses.length > 0 ? (
        <div className="max-h-32 overflow-y-auto pr-1 text-sm text-gray-600 bg-gray-50 rounded-md">
          {verses.map((verse, index) => (
            <div key={index} className="p-2 border-b border-gray-100 last:border-b-0">
              <div className="text-xs text-gray-500 mb-1">Verse {index + 1}</div>
              <p className="whitespace-pre-wrap">{verse}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No verses</p>
      )}
      
      {comments && (
        <p className="text-xs text-gray-500 italic">
          <span className="font-medium">Notes:</span> {comments.substring(0, 40)}{comments.length > 40 ? '...' : ''}
        </p>
      )}
    </div>
  );
};

// Add PoemEntry component after SongEntry component
const PoemEntry = ({ entry }: { entry: Entry }) => {
  return (
    <div className="space-y-2 w-full">
      {/* Display poem image if available */}
      {entry.imageUrl && (
        <div className="mb-2">
          <img 
            src={entry.imageUrl as string} 
            alt={`Illustration for ${entry.title}`}
            className="w-full h-32 object-cover rounded-md"
          />
        </div>
      )}
      
      {/* Display poem content */}
      {entry.content ? (
        <div className="max-h-40 overflow-y-auto pr-1 text-sm text-gray-600 bg-gray-50 rounded-md p-3">
          <p className="whitespace-pre-wrap font-serif">{entry.content}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No content available</p>
      )}
    </div>
  );
};

// Add QuoteEntry component for card view
const QuoteEntry = ({ entry }: { entry: Entry }) => {
  return (
    <div className="space-y-2 w-full">
      {entry.content ? (
        <div className="bg-gray-50 rounded-md p-3 relative">
          <div className="absolute left-2 top-1 text-3xl text-gray-300">"</div>
          <div className="relative z-10">
            <p className="text-sm font-serif italic text-gray-700 line-clamp-2 pl-3">{entry.content}</p>
          </div>
          {(entry as any)?.author && (
            <div className="mt-1 text-right">
              <p className="text-xs text-gray-600">— {(entry as any).author}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-600">No content available</p>
      )}
    </div>
  );
};

// Add ImageEntry component for card view
const ImageEntry = ({ entry }: { entry: Entry }) => {
  return (
    <div className="space-y-2 w-full">
      {/* Display image if available */}
      {entry.imageUrl && (
        <div className="flex justify-center items-center h-32 mb-2">
          <img 
            src={entry.imageUrl as string} 
            alt={entry.title || 'Image'}
            className="max-h-32 max-w-full object-contain rounded-md"
          />
        </div>
      )}
      
      {/* Display description if available */}
      {entry.content && (
        <p className="text-sm text-gray-600 line-clamp-2">
          {entry.content}
        </p>
      )}
    </div>
  );
};

// Add PathwayEntry component for card view
const PathwayEntry = ({ entry }: { entry: Entry }) => {
  // Try to parse the pathway content
  let pathwayPoints: { title: string; description: string; primaryVerse?: string }[] = [];
  let parseError = false;
  
  try {
    if (entry.content) {
      const contentData = JSON.parse(entry.content);
      if (contentData.pathwayPoints && Array.isArray(contentData.pathwayPoints)) {
        pathwayPoints = contentData.pathwayPoints;
      }
    }
  } catch (e) {
    console.error("Error parsing pathway content:", e);
    parseError = true;
  }
  
  return (
    <div className="space-y-2 w-full">
      {/* Display pathway points as numbered list */}
      {pathwayPoints.length > 0 ? (
        <div className="max-h-32 overflow-y-auto pr-1 text-sm text-gray-600 bg-purple-50 rounded-md p-3 border border-purple-100">
          <ol className="list-decimal list-inside">
            {pathwayPoints.map((point, index) => (
              <li key={index} className="truncate mb-1 font-medium text-purple-800">
                {point.title}
                {point.description && (
                  <span className="font-normal text-gray-600 ml-1 text-xs">
                    - {point.description.length > 30 ? `${point.description.substring(0, 30)}...` : point.description}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-2 text-xs text-gray-500 italic">
            {pathwayPoints.length} {pathwayPoints.length === 1 ? 'point' : 'points'} in this pathway
          </div>
        </div>
      ) : parseError ? (
        <div className="max-h-32 overflow-y-auto pr-1 text-sm text-gray-600 bg-purple-50 rounded-md p-3 border border-purple-100">
          <p className="italic text-red-500">Error parsing pathway content</p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No pathway points available</p>
      )}
      
      {/* Display main content overview if available */}
      {entry.description && (
        <div className="max-h-12 overflow-hidden pr-1 text-xs text-gray-500 mt-1">
          <p className="line-clamp-2">{entry.description}</p>
        </div>
      )}
      
      {/* Display category if available */}
      {entry.category && (
        <div className="mt-1">
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
            {entry.category}
          </span>
        </div>
      )}
      
      {/* Display Bible verses if available */}
      {entry.bibleVerses && entry.bibleVerses.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {entry.bibleVerses.slice(0, 2).map((verse, index) => (
            <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {verse}
            </span>
          ))}
          {entry.bibleVerses.length > 2 && (
            <span className="text-xs text-gray-500">+{entry.bibleVerses.length - 2} more</span>
          )}
        </div>
      )}
    </div>
  );
};

// Add state and handlers for AI interaction
const EntriesList: React.FC = () => {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [indexNeeded, setIndexNeeded] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  const [expandedAudioEntry, setExpandedAudioEntry] = useState<string | null>(null);
  const [expandedVersesEntry, setExpandedVersesEntry] = useState<string | null>(null);
  
  // New AI interaction state
  const [aiInputs, setAiInputs] = useState<Record<string, string>>({});
  const [activeAIEntryId, setActiveAIEntryId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
  const [showAiResponse, setShowAiResponse] = useState<Record<string, boolean>>({});
  const [showAiHistory, setShowAiHistory] = useState<Record<string, boolean>>({});
  
  // Entry linking state
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [selectedEntryForLinking, setSelectedEntryForLinking] = useState<string | null>(null);
  const [entryLinks, setEntryLinks] = useState<Record<string, { sourceLinks: EntryLink[], targetLinks: EntryLink[] }>>({});
  const [linkedEntries, setLinkedEntries] = useState<Record<string, Entry[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredForLinking, setFilteredForLinking] = useState<Entry[]>([]);
  const [selectedEntriesToLink, setSelectedEntriesToLink] = useState<string[]>([]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    const fetchEntries = async () => {
      if (currentUser) {
        try {
          const userEntries = await getUserEntries(currentUser.uid);
          setEntries(userEntries);
          setIndexNeeded(false);
          
          // Fetch links for all entries
          fetchAllEntryLinks(userEntries);
        } catch (error: any) {
          console.error('Error fetching entries:', error);
          // Check if error is about missing index
          if (error.message && error.message.includes('requires an index')) {
            setIndexNeeded(true);
            setError("Waiting for Firestore index to be created. This may take a few minutes.");
          } else {
            setError("Failed to load entries. Please try again later.");
          }
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchEntries();
  }, [currentUser]);
  
  // Fetch links for all entries
  const fetchAllEntryLinks = async (entriesList: Entry[]) => {
    try {
      const linksPromises = entriesList.map(entry => 
        entry.id ? getAllEntryLinks(entry.id) : Promise.resolve({ sourceLinks: [], targetLinks: [] })
      );
      
      const allLinks = await Promise.all(linksPromises);
      
      // Create a map of entryId to links
      const linksMap: Record<string, { sourceLinks: EntryLink[], targetLinks: EntryLink[] }> = {};
      entriesList.forEach((entry, index) => {
        if (entry.id) {
          linksMap[entry.id] = allLinks[index];
        }
      });
      
      setEntryLinks(linksMap);
      
      // Create a map of entryId to linked entries
      const linkedEntriesMap: Record<string, Entry[]> = {};
      
      for (const entry of entriesList) {
        if (!entry.id) continue;
        
        const links = linksMap[entry.id];
        if (!links) continue;
        
        // Get all entry IDs that are linked to this entry
        const linkedIds = [
          ...links.sourceLinks.map(link => link.targetEntryId),
          ...links.targetLinks.map(link => link.sourceEntryId)
        ];
        
        // Find the corresponding entries
        const linked = entriesList.filter(e => e.id && linkedIds.includes(e.id));
        linkedEntriesMap[entry.id] = linked;
      }
      
      setLinkedEntries(linkedEntriesMap);
    } catch (error) {
      console.error('Error fetching entry links:', error);
    }
  };
  
  // Start linking an entry
  const startLinking = (entryId: string) => {
    setIsLinkingMode(true);
    setSelectedEntryForLinking(entryId);
    setSearchQuery('');
    setSelectedEntriesToLink([]);
    setFilteredForLinking(entries.filter(e => e.id !== entryId)); // Don't show the selected entry itself
  };
  
  // Cancel linking mode
  const cancelLinking = () => {
    setIsLinkingMode(false);
    setSelectedEntryForLinking(null);
    setSearchQuery('');
    setSelectedEntriesToLink([]);
    setFilteredForLinking([]);
  };
  
  // Toggle selection of an entry for linking
  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntriesToLink(prev => {
      if (prev.includes(entryId)) {
        return prev.filter(id => id !== entryId);
      } else {
        return [...prev, entryId];
      }
    });
  };
  
  // Check if an entry is selected
  const isEntrySelected = (entryId: string) => {
    return selectedEntriesToLink.includes(entryId);
  };
  
  // Create links between entries
  const linkEntries = async () => {
    if (!selectedEntryForLinking || !currentUser || selectedEntriesToLink.length === 0) return;
    
    try {
      // Create a promise for each link creation
      const linkPromises = selectedEntriesToLink.map(targetId => 
        createEntryLink(selectedEntryForLinking, targetId, currentUser.uid)
      );
      
      // Wait for all link operations to complete
      await Promise.all(linkPromises);
      
      // Refresh links
      const entriesCopy = [...entries];
      await fetchAllEntryLinks(entriesCopy);
      
      // Exit linking mode
      cancelLinking();
    } catch (error) {
      console.error('Error linking entries:', error);
    }
  };
  
  // Delete a link between entries
  const unlinkEntries = async (linkId: string, entryId: string) => {
    try {
      await deleteEntryLink(linkId);
      
      // Update the links state
      const entriesCopy = [...entries];
      await fetchAllEntryLinks(entriesCopy);
    } catch (error) {
      console.error('Error unlinking entries:', error);
    }
  };
  
  // Handle search for linking
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredForLinking(entries.filter(e => e.id !== selectedEntryForLinking));
    } else {
      setFilteredForLinking(
        entries.filter(entry => 
          entry.id !== selectedEntryForLinking && 
          (entry.title.toLowerCase().includes(query) || 
           (entry.description && entry.description.toLowerCase().includes(query)) ||
           (entry.content && typeof entry.content === 'string' && entry.content.toLowerCase().includes(query)))
        )
      );
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
  const handleVerseClick = async (e: React.MouseEvent, verse: string) => {
    e.preventDefault();
    e.stopPropagation();
    
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
  
  /* These toggle functions are not currently used but kept for future expansion
  // Toggle audio player
  const toggleAudio = (e: React.MouseEvent, entryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (expandedAudioEntry === entryId) {
      setExpandedAudioEntry(null);
    } else {
      setExpandedAudioEntry(entryId);
    }
  };
  
  // Toggle verses display
  const toggleVerses = (e: React.MouseEvent, entryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (expandedVersesEntry === entryId) {
      setExpandedVersesEntry(null);
    } else {
      setExpandedVersesEntry(entryId);
    }
  };
  */
  
  // Filter entries by type
  const filteredEntries = activeFilter === 'all' 
    ? entries 
    : entries.filter(entry => entry.type === activeFilter);
  
  // Generate entry icon based on type
  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'pathway':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
        );
      case 'chat':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        );
      case 'link':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
            </svg>
          </div>
        );
      case 'video':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'audio':
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
    }
  };
  
  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  };
  
  // Helper function to determine if a verse is the last related verse
  const isLastRelatedVerse = (entry: Entry, msg: any, vidx: number): boolean => {
    if (!msg.relatedVerses || !Array.isArray(msg.relatedVerses)) return true;
    
    // Check if it's the last verse in this message
    if (vidx < msg.relatedVerses.length - 1) return false;
    
    // If it is the last verse in this message, check if it's the last message with related verses
    if (!entry.messages || !Array.isArray(entry.messages)) return true;
    
    const messagesWithVerses = entry.messages.filter(
      (m: any) => m.relatedVerses && Array.isArray(m.relatedVerses) && m.relatedVerses.length > 0
    );
    
    return msg === messagesWithVerses[messagesWithVerses.length - 1];
  };
  
  // Get color for category
  const getCategoryColors = (category: string): { bg: string, text: string } => {
    const categoryMap: Record<string, { bg: string, text: string }> = {
      'Person': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'Place': { bg: 'bg-green-100', text: 'text-green-800' },
      'Event': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Object': { bg: 'bg-gray-100', text: 'text-gray-800' },
      'Theme': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'Symbol': { bg: 'bg-pink-100', text: 'text-pink-800' },
      'Prophecy': { bg: 'bg-indigo-100', text: 'text-indigo-800' },
      'Teaching': { bg: 'bg-orange-100', text: 'text-orange-800' },
      'Genealogy': { bg: 'bg-teal-100', text: 'text-teal-800' },
      'Covenant': { bg: 'bg-red-100', text: 'text-red-800' },
      'Doctrine': { bg: 'bg-indigo-100', text: 'text-indigo-800' },
      'Practice': { bg: 'bg-amber-100', text: 'text-amber-800' },
      'Virtue/Vice': { bg: 'bg-lime-100', text: 'text-lime-800' },
      'Group': { bg: 'bg-cyan-100', text: 'text-cyan-800' },
      'Literary Type': { bg: 'bg-violet-100', text: 'text-violet-800' },
      'Time Period': { bg: 'bg-slate-100', text: 'text-slate-800' },
      'Miracle': { bg: 'bg-rose-100', text: 'text-rose-800' },
      'Relationship': { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' }
    };
    
    return categoryMap[category] || { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  };
  
  // Filter buttons
  const FilterButton: React.FC<{type: string, label: string}> = ({ type, label }) => (
    <button
      onClick={() => setActiveFilter(type)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        activeFilter === type
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  // Add this useEffect to load Twitter widget script when Twitter entries are present
  useEffect(() => {
    // Check if any Twitter entries exist in the filtered entries
    const hasTwitterEntries = filteredEntries.some(entry => 
      entry.type === 'twitter' || 
      (entry.content && typeof entry.content === 'string' && entry.content.includes('twitter.com'))
    );
    
    if (hasTwitterEntries) {
      // Load Twitter widget script
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
  }, [filteredEntries]);

  // Modify the renderTwitterPreview function to not return a direct element but defer to another render function
  const renderTwitterPreview = (content: string) => {
    // If it's a direct tweet URL (twitter.com or x.com)
    const tweetUrlMatch = content.match(/https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/);
    if (tweetUrlMatch && tweetUrlMatch[3]) {
      const tweetId = tweetUrlMatch[3];
      return (
        <div className="twitter-embed-preview overflow-hidden border border-blue-100 bg-blue-50 p-2 rounded">
          <div className="twitter-preview">
            <iframe 
              src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`}
              width="100%" 
              height="200" 
              frameBorder="0" 
              title={`Twitter Tweet ${tweetId}`}
              style={{ maxWidth: '100%', borderRadius: '8px', overflow: 'hidden' }}
            ></iframe>
          </div>
        </div>
      );
    }
    
    // If it's just a Twitter/X account URL
    if (content.includes('twitter.com/') || content.includes('x.com/')) {
      // Try to extract username
      const usernameMatch = content.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
      const username = usernameMatch && usernameMatch[1] ? usernameMatch[1] : null;
      
      return (
        <div className="twitter-preview p-2 bg-blue-50 border border-blue-100 rounded">
          <p className="text-sm text-blue-500">
            Twitter Profile
            {username && <span className="text-gray-700"> - @{username}</span>}
          </p>
        </div>
      );
    }
    
    // Default fallback
    return <p className="text-sm text-gray-600 line-clamp-2">{content}</p>;
  };

  // Modify the renderYouTubePreview function to not return a direct element but defer to another render function
  const renderYouTubePreview = (content: string) => {
    // Extract YouTube video ID from different URL formats
    let videoId = null;
    
    // Check for standard YouTube URL
    const standardMatch = content.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (standardMatch && standardMatch[1]) {
      videoId = standardMatch[1];
    }
    
    // Check for youtu.be short URL
    const shortMatch = content.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (!videoId && shortMatch && shortMatch[1]) {
      videoId = shortMatch[1];
    }
    
    // Check for YouTube embed URL
    const embedMatch = content.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (!videoId && embedMatch && embedMatch[1]) {
      videoId = embedMatch[1];
    }
    
    // If we found a video ID, display an embedded player
    if (videoId) {
      return (
        <div className="youtube-embed-preview overflow-hidden border border-red-100 bg-red-50 p-2 rounded">
          <div className="youtube-preview">
            <iframe 
              width="100%" 
              height="200" 
              src={`https://www.youtube.com/embed/${videoId}`} 
              title={`YouTube Video ${videoId}`} 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              style={{ borderRadius: '8px' }}
            ></iframe>
          </div>
        </div>
      );
    }
    
    // If it's a YouTube URL but we couldn't extract the ID
    if (content.includes('youtube.com') || content.includes('youtu.be')) {
      return (
        <div className="youtube-preview p-2 bg-red-50 border border-red-100 rounded">
          <p className="text-sm text-red-500">YouTube Video</p>
        </div>
      );
    }
    
    // Default fallback
    return <p className="text-sm text-gray-600 line-clamp-2">{content}</p>;
  };

  // Add AI input change handler
  const handleAiInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAiInputs({
      ...aiInputs,
      [activeAIEntryId!]: e.target.value
    });
  };
  
  // Toggle AI history visibility
  const toggleAiHistory = (entryId: string) => {
    setShowAiHistory({
      ...showAiHistory,
      [entryId]: !showAiHistory[entryId]
    });
  };
  
  // Add function to send message to AI
  const sendMessageToAI = async (entryId: string, entry: Entry) => {
    if (!aiInputs[entryId]?.trim() || isAiLoading) return;
    
    setIsAiLoading(true);
    const question = aiInputs[entryId];
    
    try {
      // Prepare context about the entry for the AI
      let entryContext = `Title: ${entry.title || 'Untitled'}\n`;
      
      if (entry.type) {
        entryContext += `Type: ${entry.type}\n`;
      }
      
      if (entry.content) {
        // For structured content, try to parse it
        if (entry.type === 'pathway' || entry.type === 'song') {
          try {
            const contentObj = JSON.parse(entry.content);
            entryContext += `Content: ${JSON.stringify(contentObj, null, 2)}\n`;
          } catch {
            entryContext += `Content: ${entry.content}\n`;
          }
        } else {
          entryContext += `Content: ${entry.content}\n`;
        }
      }
      
      if (entry.description) {
        entryContext += `Description: ${entry.description}\n`;
      }
      
      if (entry.category) {
        entryContext += `Category: ${entry.category}\n`;
      }
      
      if (entry.bibleVerses && entry.bibleVerses.length > 0) {
        entryContext += `Bible Verses: ${entry.bibleVerses.join(', ')}\n`;
      }
      
      const userMessage = question;
      
      // Send the message to OpenAI
      const response = await chatWithGPT([
        { role: "system", content: "You are a helpful biblical assistant that provides insights about Bible-related content." },
        { role: "user", content: `Here is information about an entry in my Bible library:\n\n${entryContext}\n\nQuestion: ${userMessage}` }
      ]);
      
      const answer = response.content;
      
      // Update the response state
      setAiResponses({
        ...aiResponses,
        [entryId]: answer
      });
      
      // Show the response
      setShowAiResponse({
        ...showAiResponse,
        [entryId]: true
      });
      
      // Clear the input
      setAiInputs({
        ...aiInputs,
        [entryId]: ''
      });
      
      // Save the conversation to Firestore
      saveAIConversation(entryId, question, answer);
      
      // Update local entries state
      const updatedEntries = entries.map(e => {
        if (e.id === entryId) {
          const newConversations = [...(e.aiConversations || []), {
            question,
            answer,
            timestamp: new Date()
          }];
          
          return {
            ...e,
            aiConversations: newConversations
          };
        }
        return e;
      });
      
      setEntries(updatedEntries);
      
    } catch (error) {
      console.error('Error sending message to AI:', error);
      setAiResponses({
        ...aiResponses,
        [entryId]: "Sorry, I encountered an error. Please try again."
      });
      setShowAiResponse({
        ...showAiResponse,
        [entryId]: true
      });
    } finally {
      setIsAiLoading(false);
    }
  };
  
  // Function to save AI conversation to Firestore
  const saveAIConversation = async (entryId: string, question: string, answer: string) => {
    try {
      // Get the current entry to access existing conversations
      const currentEntry = entries.find(e => e.id === entryId);
      if (!currentEntry) return;
      
      // Create new conversation object
      const newConversation: AIConversation = {
        question,
        answer,
        timestamp: new Date()
      };
      
      // Update the entry with the new conversation
      await updateEntry(entryId, {
        aiConversations: [...(currentEntry.aiConversations || []), newConversation]
      });
      
      console.log('AI conversation saved successfully');
    } catch (error) {
      console.error('Error saving AI conversation:', error);
    }
  };
  
  // Close AI response
  const closeAiResponse = (entryId: string) => {
    setShowAiResponse({
      ...showAiResponse,
      [entryId]: false
    });
  };

  // Format timestamp for AI conversations
  const formatAiTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate(); // Firestore Timestamp
    } else if (timestamp instanceof Date) {
      date = timestamp; // JavaScript Date
    } else {
      date = new Date(timestamp); // Try to parse from string/number
    }
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="container mx-auto p-4">
      {/* Bible Verse Modal */}
      <BibleVerseModal
        isOpen={modalOpen}
        onClose={closeModal}
        verse={selectedVerse}
        verseText={verseText}
        isLoading={verseLoading}
      />
      
      {/* Linking Mode UI */}
      {isLinkingMode && selectedEntryForLinking && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Link Entries</h2>
              <button
                onClick={cancelLinking}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Linking from: <span className="font-medium">{entries.find(e => e.id === selectedEntryForLinking)?.title}</span>
              </p>
              <input
                type="text"
                placeholder="Search entries to link..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div className="overflow-y-auto flex-1">
              {filteredForLinking.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No entries found</p>
              ) : (
                <div className="space-y-2">
                  {filteredForLinking.map(entry => (
                    <div 
                      key={entry.id} 
                      className={`flex items-center justify-between p-2 border border-gray-200 rounded-md ${isEntrySelected(entry.id!) ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`link-${entry.id}`}
                          checked={isEntrySelected(entry.id!)}
                          onChange={() => toggleEntrySelection(entry.id!)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2"
                        />
                        <div className="ml-2">
                          <label htmlFor={`link-${entry.id}`} className="font-medium cursor-pointer">{entry.title}</label>
                          <p className="text-xs text-gray-500">{entry.type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {selectedEntriesToLink.length} {selectedEntriesToLink.length === 1 ? 'entry' : 'entries'} selected
              </div>
              <button
                onClick={linkEntries}
                disabled={selectedEntriesToLink.length === 0}
                className={`px-4 py-2 rounded-md text-white ${selectedEntriesToLink.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                Link Selected
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Your Library</h1>
          <Link
            to="/list"
            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            List View
          </Link>
        </div>
        
        {/* Create new entry dropdown */}
        <div className="relative inline-block text-left" ref={dropdownRef}>
          <div>
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              id="create-new-button"
              aria-expanded="true"
              aria-haspopup="true"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
            >
              Create New
              <svg className="-mr-1 ml-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
  
          {showCreateMenu && (
            <div 
              className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="create-new-button"
            >
              <div className="py-1">
                <Link
                  to="/pathway/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Pathway
                </Link>
                <Link
                  to="/chat"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Chat
                </Link>
                <Link
                  to="/text/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Text
                </Link>
                <Link
                  to="/audio/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Audio Recording
                </Link>
                <Link
                  to="/link/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Link
                </Link>
                <Link
                  to="/song/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Song
                </Link>
                <Link
                  to="/poem/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Poem
                </Link>
                <Link
                  to="/quote/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Quote
                </Link>
                <Link
                  to="/image/new"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                >
                  New Image
                </Link>
                {/* Add other entry types as they are implemented */}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Index needed message */}
      {indexNeeded && (
        <div className="mb-4 rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Database Index Required</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  A Firestore index is being created. This happens the first time you run the app and usually takes a few minutes. 
                  You can still add new entries, but sorting may not work correctly until the index is ready.
                </p>
                <p className="mt-2">
                  <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="font-medium text-yellow-700 underline hover:text-yellow-600">
                    Open Firebase Console
                  </a>
                  {' '}to check the index status.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="mb-6 flex space-x-2 overflow-x-auto">
        <FilterButton type="all" label="All" />
        <FilterButton type="pathway" label="Pathways" />
        <FilterButton type="chat" label="Chats" />
        <FilterButton type="text" label="Text" />
        <FilterButton type="link" label="Links" />
        <FilterButton type="video" label="Videos" />
        <FilterButton type="audio" label="Audio" />
        <FilterButton type="song" label="Songs" />
        <FilterButton type="poem" label="Poems" />
        <FilterButton type="quote" label="Quotes" />
        <FilterButton type="image" label="Images" />
      </div>
      
      {/* Entries */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : error && entries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">Error Loading Entries</h3>
          <p className="mt-2 text-gray-500">{error}</p>
          {activeFilter === 'text' ? (
            <Link
              to="/text/new"
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Text Entry
            </Link>
          ) : activeFilter === 'chat' || activeFilter === 'all' ? (
            <Link
              to="/chat"
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Start a Chat
            </Link>
          ) : (
            <button
              onClick={() => setShowCreateMenu(true)}
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create New Entry
            </button>
          )}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">No entries found</h3>
          <p className="mt-2 text-gray-500">
            {activeFilter === 'all'
              ? "You haven't created any entries yet."
              : `You don't have any ${activeFilter} entries yet.`}
          </p>
          {activeFilter === 'text' ? (
            <Link
              to="/text/new"
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Text Entry
            </Link>
          ) : activeFilter === 'chat' || activeFilter === 'all' ? (
            <Link
              to="/chat"
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Start a Chat
            </Link>
          ) : (
            <button
              onClick={() => setShowCreateMenu(true)}
              className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create New Entry
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map(entry => (
            <div key={entry.id} className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
              <Link
                to={entry.type === 'chat' ? `/chat/${entry.id}` : `/entry/${entry.id}`}
                className="flex cursor-pointer flex-col p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  {getEntryIcon(entry.type)}
                  <div className="flex items-center space-x-1">
                    {entry.category && (
                      <span className={`mr-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryColors(entry.category).bg} ${getCategoryColors(entry.category).text}`}>
                        {entry.category}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                    </span>
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 line-clamp-1">{entry.title}</h3>
                <div className="flex-1">
                  {entry.type === 'chat' && entry.messages && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {entry.messages.length} message{entry.messages.length === 1 ? '' : 's'}
                    </p>
                  )}
                  {entry.type === 'text' && entry.description ? (
                    <p className="text-sm text-gray-600 line-clamp-2">{entry.description}</p>
                  ) : entry.type === 'text' && entry.content ? (
                    <p className="text-sm text-gray-600 line-clamp-2">{entry.content}</p>
                  ) : entry.type === 'song' ? (
                    <SongEntry entry={entry} />
                  ) : entry.type === 'poem' ? (
                    <PoemEntry entry={entry} />
                  ) : entry.type === 'quote' ? (
                    <QuoteEntry entry={entry} />
                  ) : entry.type === 'image' ? (
                    <ImageEntry entry={entry} />
                  ) : entry.type === 'pathway' ? (
                    <PathwayEntry entry={entry} />
                  ) : (entry.type === 'twitter' || entry.type === 'link' && entry.content && (entry.content.includes('twitter.com') || entry.content.includes('x.com'))) && entry.content ? (
                    renderTwitterPreview(entry.content)
                  ) : (entry.type === 'youtube' || entry.type === 'link' && entry.content && (entry.content.includes('youtube.com') || entry.content.includes('youtu.be'))) && entry.content ? (
                    renderYouTubePreview(entry.content)
                  ) : entry.content && entry.type !== 'chat' && (
                    <p className="text-sm text-gray-600 line-clamp-2">{entry.content}</p>
                  )}
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {entry.createdAt ? formatDate(entry.createdAt) : 'Unknown date'}
                  </span>
                </div>
              </Link>
              
              {/* Bible Verses section - display directly outside the link */}
              {((entry.bibleVerses && entry.bibleVerses.length > 0) || 
                (entry.type === 'chat' && entry.messages && 
                 entry.messages.some(msg => msg.bibleVerses && msg.bibleVerses.length > 0))) && (
                <div className="px-4 mt-1 mb-2">
                  <div className="text-xs text-indigo-600 mb-1">Bible Verses:</div>
                  <div className="text-xs italic text-gray-700">
                    {/* Display direct entry verses */}
                    {entry.bibleVerses && entry.bibleVerses.map((verse, idx) => (
                      <React.Fragment key={`entry-verse-${idx}`}>
                        <span 
                          className="cursor-pointer text-indigo-700 hover:text-indigo-900 hover:underline"
                          onClick={(e) => handleVerseClick(e, verse)}
                        >
                          {verse}
                        </span>
                        {idx < (entry.bibleVerses?.length || 0) - 1 && <span>; </span>}
                      </React.Fragment>
                    ))}
                    
                    {/* Display verses from chat messages */}
                    {entry.type === 'chat' && entry.messages && Array.isArray(entry.messages) && 
                      entry.messages.map((msg: any) => (
                        msg.bibleVerses && Array.isArray(msg.bibleVerses) && 
                        msg.bibleVerses.map((verse: string, vidx: number) => (
                          <React.Fragment key={`msg-verse-${vidx}`}>
                            {/* Add separator if there are entry verses and this is the first message verse */}
                            {entry.bibleVerses && entry.bibleVerses.length > 0 && vidx === 0 && 
                            entry.messages && 
                            msg === entry.messages.find((m: any) => m.bibleVerses && m.bibleVerses.length > 0) && 
                            <span>; </span>}
                            
                            <span 
                              className="cursor-pointer text-indigo-700 hover:text-indigo-900 hover:underline"
                              onClick={(e) => handleVerseClick(e, verse)}
                            >
                              {verse}
                            </span>
                            
                            {/* Add separator between verses */}
                            {((vidx < (msg.bibleVerses.length - 1)) || 
                              (entry.messages && 
                              msg !== entry.messages.filter((m: any) => m.bibleVerses && m.bibleVerses.length > 0).pop())) && 
                            <span>; </span>}
                          </React.Fragment>
                        ))
                    ))}
                  </div>
                </div>
              )}
              
              {/* Related Verses section - styled like in ChatInterface */}
              {((entry.relatedVerses && entry.relatedVerses.length > 0) || 
                (entry.type === 'chat' && entry.messages && 
                 entry.messages.some(msg => msg.relatedVerses && msg.relatedVerses.length > 0))) && (
                <div className="px-4 mt-2 mb-3">
                  <div className="rounded-md bg-indigo-100 p-3 text-sm">
                    <div className="font-semibold text-indigo-700 mb-1">Applicable Bible Verses:</div>
                    
                    <div className="text-gray-700 italic">
                      {/* Display direct entry related verses */}
                      {entry.relatedVerses && entry.relatedVerses.map((verse, idx) => (
                        <React.Fragment key={`entry-related-${idx}`}>
                          <span
                            className="cursor-pointer hover:underline hover:text-indigo-700"
                            onClick={(e) => handleVerseClick(e, verse)}
                          >
                            {verse}
                          </span>
                          {idx < (entry.relatedVerses?.length || 0) - 1 && (
                            <span className="mx-1">;</span>
                          )}
                          {/* Add separator if this is the last entry verse and there are message verses */}
                          {idx === ((entry.relatedVerses?.length || 0) - 1) && 
                           entry.type === 'chat' && entry.messages && 
                           entry.messages.some((m: any) => m.relatedVerses && m.relatedVerses.length > 0) && (
                            <span className="mx-1">;</span>
                          )}
                        </React.Fragment>
                      ))}
                      
                      {/* Display related verses from chat messages */}
                      {entry.type === 'chat' && entry.messages && Array.isArray(entry.messages) && 
                        entry.messages.flatMap((msg: any, msgIdx: number) => 
                          msg.relatedVerses && Array.isArray(msg.relatedVerses) 
                            ? msg.relatedVerses.map((verse: string, vidx: number) => (
                                <React.Fragment key={`msg-related-${msgIdx}-${vidx}`}>
                                  <span
                                    className="cursor-pointer hover:underline hover:text-indigo-700"
                                    onClick={(e) => handleVerseClick(e, verse)}
                                  >
                                    {verse}
                                  </span>
                                  
                                  {/* Add separator between verses, except after the very last one */}
                                  {!isLastRelatedVerse(entry, msg, vidx) && (
                                    <span className="mx-1">;</span>
                                  )}
                                </React.Fragment>
                              ))
                            : []
                        )
                      }
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audio player outside the Link component to prevent navigation */}
              {(entry.audioUrl || (entry.type === 'chat' && entry.messages && entry.messages.some(msg => msg.audioUrl))) && (
                <div className="px-4 pb-3">
                  <div className="text-xs text-indigo-600 mb-1">{entry.type === 'audio' ? 'Original Recording:' : 'Audio:'}</div>
                  
                  {/* Handle direct entry audioUrl */}
                  {typeof entry.audioUrl === 'string' && (
                    <div className="w-full my-1">
                      <AudioPlayer 
                        src={entry.audioUrl}
                        showFileInfo={!entry.audioUrl.startsWith('data:')}
                        className={entry.type === 'audio' ? 'bg-blue-50 border border-blue-200' : ''}
                      />
                      {entry.type === 'audio' && (
                        <div className="text-xs text-gray-500 mt-1">
                          Recorded on {entry.createdAt ? formatDate(entry.createdAt) : 'Unknown date'}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Handle audioUrl array */}
                  {Array.isArray(entry.audioUrl) && (entry.audioUrl as string[]).map((url: string, idx: number) => (
                    <div key={`entry-audio-${idx}`} className="w-full my-1">
                      <AudioPlayer 
                        src={url}
                        showFileInfo={!url.startsWith('data:')}
                        className={entry.type === 'audio' ? 'bg-blue-50 border border-blue-200' : ''}
                      />
                      {entry.type === 'audio' && idx === 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Recorded on {entry.createdAt ? formatDate(entry.createdAt) : 'Unknown date'}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Handle chat message audioUrls */}
                  {entry.type === 'chat' && entry.messages && entry.messages.map((msg: any, idx: number) => (
                    msg.audioUrl && (
                      <div key={`msg-audio-${idx}`} className="w-full my-1">
                        <div className="text-xs text-gray-500 mb-1">
                          {msg.role === 'user' ? 'Your message' : 'Assistant'} audio:
                        </div>
                        <AudioPlayer 
                          src={msg.audioUrl}
                          showFileInfo={!msg.audioUrl.startsWith('data:')}
                        />
                      </div>
                    )
                  ))}
                </div>
              )}
              
              {/* Linked Entries section */}
              {entry.id && linkedEntries[entry.id] && linkedEntries[entry.id].length > 0 && (
                <div className="px-4 py-2 mt-1 border-t border-gray-100">
                  <div className="text-xs text-indigo-600 mb-1">Linked Entries:</div>
                  <div className="space-y-1">
                    {linkedEntries[entry.id].map(linkedEntry => {
                      // Find the link object between these entries
                      const sourceLink = entryLinks[entry.id!]?.sourceLinks.find(link => link.targetEntryId === linkedEntry.id);
                      const targetLink = entryLinks[entry.id!]?.targetLinks.find(link => link.sourceEntryId === linkedEntry.id);
                      const linkId = sourceLink?.id || targetLink?.id;
                      
                      return (
                        <div key={linkedEntry.id} className="flex justify-between items-center">
                          <Link 
                            to={linkedEntry.type === 'chat' ? `/chat/${linkedEntry.id}` : `/entry/${linkedEntry.id}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {linkedEntry.title}
                            <span className="ml-1 text-gray-500">({linkedEntry.type})</span>
                          </Link>
                          
                          {linkId && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (linkId) {
                                  unlinkEntries(linkId, entry.id!);
                                }
                              }}
                              className="text-xs text-red-500 hover:text-red-700"
                              aria-label="Remove link"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Entry Linking Button */}
              <div className="px-4 py-2 mt-1 border-t border-gray-100 flex justify-end">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (entry.id) {
                      startLinking(entry.id);
                    }
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
                  </svg>
                  Link with other entries
                </button>
              </div>
              
              {/* AI Interaction - only for non-chat entries */}
              {entry.type !== 'chat' && entry.id && (
                <div className="px-4 pb-4 mt-2">
                  {/* AI Response Display */}
                  {showAiResponse[entry.id] && (
                    <div className="bg-purple-50 rounded-md p-3 mb-3 relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          closeAiResponse(entry.id!);
                        }}
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                        aria-label="Close AI response"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="text-xs font-semibold text-purple-700 mb-1">AI Assistant:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResponses[entry.id]}</p>
                    </div>
                  )}
                  
                  {/* AI Conversation History */}
                  {entry.aiConversations && entry.aiConversations.length > 0 && (
                    <div className="mb-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleAiHistory(entry.id!);
                        }}
                        className="flex items-center text-xs text-purple-600 hover:text-purple-800 mb-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 transition-transform ${showAiHistory[entry.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {entry.aiConversations.length} Previous AI Conversation{entry.aiConversations.length === 1 ? '' : 's'}
                      </button>
                      
                      {showAiHistory[entry.id] && (
                        <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 rounded-md p-2">
                          {entry.aiConversations.map((convo, idx) => (
                            <div key={idx} className="bg-white rounded border border-gray-200 p-2 text-sm">
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-medium text-purple-700">You asked:</p>
                                <span className="text-xs text-gray-500">{formatAiTimestamp(convo.timestamp)}</span>
                              </div>
                              <p className="text-gray-800 mb-2">{convo.question}</p>
                              <p className="font-medium text-purple-700">AI Assistant:</p>
                              <p className="text-gray-700 whitespace-pre-wrap">{convo.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* AI Input */}
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={aiInputs[entry.id] || ''}
                      onChange={handleAiInputChange}
                      onClick={() => {
                        if (activeAIEntryId !== entry.id) {
                          setActiveAIEntryId(entry.id || null);
                        }
                      }}
                      placeholder="Ask the AI assistant about this entry..."
                      className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && activeAIEntryId === entry.id) {
                          sendMessageToAI(entry.id!, entry);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        sendMessageToAI(entry.id!, entry);
                      }}
                      disabled={isAiLoading || !aiInputs[entry.id]?.trim() || activeAIEntryId !== entry.id}
                      className="bg-purple-600 text-white p-2 rounded-r-md hover:bg-purple-700 disabled:bg-purple-300"
                    >
                      {isAiLoading && activeAIEntryId === entry.id ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-2 border-white"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EntriesList; 