import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getEntryById, 
  Entry as BaseEntry, 
  deleteEntry, 
  updateEntry, 
  getAllEntryLinks, 
  EntryLink,
  deleteEntryLink
} from '../services/firestore';
import { getBiblePassage, chatWithPathwayAI } from '../services/api';
import MDEditor from '@uiw/react-md-editor';
import { getFirestore, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';

// Extend the Entry type to include mainContent
interface Entry extends BaseEntry {
  mainContent?: string;
}

// Interface for completion data
interface CompletionData {
  userId: string;
  timestamp: Timestamp;
}

// Interface for AI conversation
interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
}

// Interface for pathway point
interface PathwayPoint {
  title: string;
  description: string;
  primaryVerse?: string;
  additionalVerses?: string[];
  completions?: Record<string, CompletionData>;
  notes?: string;
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
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
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

const PathwayDetailPage: React.FC = () => {
  const { entryId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingPointIndex, setUpdatingPointIndex] = useState<number | null>(null);
  
  // AI chat states
  const [activeAIPointIndex, setActiveAIPointIndex] = useState<number | null>(null);
  const [aiMessages, setAiMessages] = useState<Record<number, AIMessage[]>>({});
  const [aiInput, setAiInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  
  // Bible verse modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // Add point modal states
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  const [insertPointIndex, setInsertPointIndex] = useState<number | null>(null);
  const [newPointTitle, setNewPointTitle] = useState('');
  const [newPointDescription, setNewPointDescription] = useState('');
  const [newPointPrimaryVerse, setNewPointPrimaryVerse] = useState('');
  const [newPointAdditionalVerses, setNewPointAdditionalVerses] = useState('');
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const pointRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [plusPositions, setPlusPositions] = useState<number[]>([]);
  
  // Inline verse editing states
  const [editingPrimaryVerse, setEditingPrimaryVerse] = useState<number | null>(null);
  const [newPrimaryVerseText, setNewPrimaryVerseText] = useState('');
  const [editingAdditionalVerse, setEditingAdditionalVerse] = useState<{pointIndex: number, verseIndex: number} | null>(null);
  const [newAdditionalVerseText, setNewAdditionalVerseText] = useState('');
  const [addingAdditionalVerse, setAddingAdditionalVerse] = useState<number | null>(null);
  const [newAdditionalVerseInput, setNewAdditionalVerseInput] = useState('');
  const [isSavingVerses, setIsSavingVerses] = useState(false);
  
  // Notes state
  const [showingNotesForIndex, setShowingNotesForIndex] = useState<number[]>([]);
  const [editingNoteForIndex, setEditingNoteForIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  
  // Main pathway content state
  const [mainContent, setMainContent] = useState<string>('');
  const [isEditingMainContent, setIsEditingMainContent] = useState(false);
  const [isSavingMainContent, setIsSavingMainContent] = useState(false);
  
  // Add Bible verse state
  const [verseInput, setVerseInput] = useState('');
  const [isAddingVerse, setIsAddingVerse] = useState(false);
  
  // Editor theme state
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');
  
  // Linked entries state
  const [linkedEntries, setLinkedEntries] = useState<BaseEntry[]>([]);
  const [entryLinks, setEntryLinks] = useState<{sourceLinks: EntryLink[], targetLinks: EntryLink[]}>({
    sourceLinks: [],
    targetLinks: []
  });
  const [loadingLinks, setLoadingLinks] = useState(true);
  
  // Format date helper
  const formatDate = (date: any) => {
    if (!date) return '';
    
    try {
      // Handle Firestore Timestamp in different formats
      let dateObj: Date;
      
      if (date.toDate && typeof date.toDate === 'function') {
        // Handle Firestore Timestamp object with toDate method
        dateObj = date.toDate();
      } else if (date.seconds !== undefined && date.nanoseconds !== undefined) {
        // Handle Firestore Timestamp raw format (seconds and nanoseconds)
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        // Already a Date object
        dateObj = date;
      } else {
        // Try to convert from string or number
        dateObj = new Date(date);
      }
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid date';
    }
  };

  // Format time helper
  const formatTime = (date: any) => {
    if (!date) return '';
    
    try {
      // Handle Firestore Timestamp in different formats
      let dateObj: Date;
      
      if (date.toDate && typeof date.toDate === 'function') {
        // Handle Firestore Timestamp object with toDate method
        dateObj = date.toDate();
      } else if (date.seconds !== undefined && date.nanoseconds !== undefined) {
        // Handle Firestore Timestamp raw format (seconds and nanoseconds)
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        // Already a Date object
        dateObj = date;
      } else {
        // Try to convert from string or number
        dateObj = new Date(date);
      }
      
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting time:', error, date);
      return 'Invalid time';
    }
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

  // Handle point completion
  const handleCompletePoint = async (pointIndex: number) => {
    if (!entryId || !currentUser || !entry || !entry.content) return;
    
    setUpdatingPointIndex(pointIndex);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      // Get the current point
      const point = contentData.pathwayPoints[pointIndex] as PathwayPoint;
      
      // Initialize completions object if it doesn't exist
      if (!point.completions) {
        point.completions = {};
      }
      
      // Add or update current user's completion
      const completionData: CompletionData = {
        userId: currentUser.uid,
        timestamp: Timestamp.now()
      };
      
      point.completions[currentUser.uid] = completionData;
      
      // Update the point in the content array
      contentData.pathwayPoints[pointIndex] = point;
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
    } catch (error) {
      console.error('Error completing point:', error);
    } finally {
      setUpdatingPointIndex(null);
    }
  };

  // Toggle AI interaction for a specific point
  const toggleAiInteraction = (pointIndex: number) => {
    if (activeAIPointIndex === pointIndex) {
      setActiveAIPointIndex(null);
    } else {
      console.log(`Toggling AI interaction for point ${pointIndex}`);
      console.log(`Current messages for point ${pointIndex}:`, aiMessages[pointIndex] || []);
      
      setActiveAIPointIndex(pointIndex);
      // No need to reset messages if they already exist in the state
      // This ensures we don't overwrite existing messages
    }
  };

  // Handle AI input change
  const handleAiInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAiInput(e.target.value);
  };

  // Send message to AI
  const sendMessageToAI = async (pointIndex: number, point: PathwayPoint) => {
    if (!aiInput.trim() || isAiLoading || activeAIPointIndex !== pointIndex || !entryId) return;
    
    const userMessage: AIMessage = {
      role: 'user',
      content: aiInput
    };
    
    // Add user message to conversation
    setAiMessages(prev => ({
      ...prev,
      [pointIndex]: [...(prev[pointIndex] || []), userMessage]
    }));
    
    // Clear input
    setAiInput('');
    
    // Set loading state
    setIsAiLoading(true);
    
    try {
      // Create context about the current point for the AI
      const context = `
        Pathway point: ${point.title}
        Description: ${point.description}
        Primary Bible verse: ${point.primaryVerse || 'None'}
        Additional verses to read: ${point.additionalVerses ? point.additionalVerses.join(', ') : 'None'}
        
        User question: ${userMessage.content}
      `;
      
      // Prepare messages array
      const messages = [...(aiMessages[pointIndex] || []), userMessage];
      
      console.log('AI Request:', {
        messages,
        context,
        pointIndex,
        pointTitle: point.title
      });
      
      // Call our API service function instead of making a fetch request
      const responseData = await chatWithPathwayAI(messages, context);
      
      console.log('AI Response data:', responseData);
      
      // Add AI response to conversation
      const aiResponse: AIMessage = {
        role: 'assistant',
        content: responseData.message || "I'm sorry, I couldn't process your request. Please try again.",
        audioUrl: responseData.audioUrl || undefined
      };
      
      // Update state with new message
      const updatedMessages = {
        ...aiMessages,
        [pointIndex]: [...(aiMessages[pointIndex] || []), aiResponse]
      };
      
      setAiMessages(updatedMessages);
      
      // Save chat history to Firestore
      await saveChatHistoryToFirestore(pointIndex, updatedMessages[pointIndex]);
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      console.error('Error details:', {
        name: error?.name || 'Unknown error',
        message: error?.message || 'No error message available',
        stack: error?.stack || 'No stack trace available'
      });
      
      // Add error message to conversation
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: "I'm sorry, there was an error processing your request. Please try again later."
      };
      
      const updatedMessages = {
        ...aiMessages,
        [pointIndex]: [...(aiMessages[pointIndex] || []), errorMessage]
      };
      
      setAiMessages(updatedMessages);
      
      // Save chat history to Firestore even with the error message
      await saveChatHistoryToFirestore(pointIndex, updatedMessages[pointIndex]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Save chat history to Firestore
  const saveChatHistoryToFirestore = async (pointIndex: number, messages: AIMessage[]) => {
    if (!entryId || !currentUser) return;
    
    try {
      console.log(`Saving chat history for point ${pointIndex} to Firestore`);
      const db = getFirestore();
      const entryRef = doc(db, 'entries', entryId);
      
      // Sanitize messages to remove undefined values
      const sanitizedMessages = messages.map(msg => {
        const sanitized: AIMessage = {
          role: msg.role,
          content: msg.content
        };
        
        // Only include audioUrl if it exists and is not undefined/null
        if (msg.audioUrl) {
          sanitized.audioUrl = msg.audioUrl;
        }
        
        return sanitized;
      });
      
      // Log the sanitized messages
      console.log('Sanitized messages to save:', sanitizedMessages);
      
      // Create a chatHistory field if it doesn't exist in the document
      await updateDoc(entryRef, {
        [`chatHistory.${pointIndex}`]: sanitizedMessages
      });
      
      console.log('Chat history saved successfully');
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  // Load chat history from Firestore
  const loadChatHistoryFromFirestore = async () => {
    if (!entryId || !currentUser) return;
    
    try {
      console.log('Loading chat history from Firestore');
      const db = getFirestore();
      const entryRef = doc(db, 'entries', entryId);
      const entryDoc = await getDoc(entryRef);
      
      if (entryDoc.exists()) {
        const entryData = entryDoc.data();
        console.log('Entry data:', entryData);
        
        if (entryData.chatHistory) {
          const chatHistory = entryData.chatHistory;
          console.log('Raw chat history from Firestore:', chatHistory);
          
          // Convert the object to the expected format
          const formattedChatHistory: Record<number, AIMessage[]> = {};
          
          Object.keys(chatHistory).forEach(key => {
            const pointIndex = parseInt(key);
            
            // Ensure messages have the correct format
            const messages = Array.isArray(chatHistory[key]) 
              ? chatHistory[key].map((msg: any) => ({
                  role: msg.role || 'assistant',
                  content: msg.content || '',
                  audioUrl: msg.audioUrl || undefined
                }))
              : [];
            
            formattedChatHistory[pointIndex] = messages;
            console.log(`Formatted messages for point ${pointIndex}:`, messages);
          });
          
          console.log('Final formatted chat history:', formattedChatHistory);
          setAiMessages(formattedChatHistory);
        } else {
          console.log('No chat history field in the document');
        }
      } else {
        console.log('Document does not exist');
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };
  
  // Check if a point is completed by the current user
  const isPointCompleted = (point: PathwayPoint): boolean => {
    if (!currentUser || !point.completions) return false;
    return !!point.completions[currentUser.uid];
  };

  // Get formatted completion date 
  const getCompletionDate = (point: PathwayPoint): string => {
    if (!currentUser || !point.completions || !point.completions[currentUser.uid]) return '';
    
    const completion = point.completions[currentUser.uid];
    
    return `${formatDate(completion.timestamp)} at ${formatTime(completion.timestamp)}`;
  };
  
  // Open add point modal
  const handleTimelineClick = (index: number) => {
    setInsertPointIndex(index);
    setShowAddPointModal(true);
    
    // Reset form fields
    setNewPointTitle('');
    setNewPointDescription('');
    setNewPointPrimaryVerse('');
    setNewPointAdditionalVerses('');
  };

  // Close add point modal
  const closeAddPointModal = () => {
    setShowAddPointModal(false);
    setInsertPointIndex(null);
  };

  // Handle add point form fields
  const handleNewPointTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPointTitle(e.target.value);
  };

  const handleNewPointDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewPointDescription(e.target.value);
  };

  const handleNewPointPrimaryVerseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPointPrimaryVerse(e.target.value);
  };

  const handleNewPointAdditionalVersesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPointAdditionalVerses(e.target.value);
  };

  // Submit new point
  const handleAddPoint = async () => {
    if (!entryId || !currentUser || !entry || !entry.content || insertPointIndex === null) return;
    
    setIsAddingPoint(true);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      // Create new point
      const newPoint: PathwayPoint = {
        title: newPointTitle,
        description: newPointDescription,
        primaryVerse: newPointPrimaryVerse || undefined,
        additionalVerses: newPointAdditionalVerses ? newPointAdditionalVerses.split(',').map(v => v.trim()) : undefined
      };
      
      // Store current chat histories before updating
      const db = getFirestore();
      const entryRef = doc(db, 'entries', entryId);
      const entryDoc = await getDoc(entryRef);
      const chatHistory = entryDoc.exists() && entryDoc.data().chatHistory ? entryDoc.data().chatHistory : {};
      
      // Insert the new point at the specified index
      contentData.pathwayPoints.splice(insertPointIndex, 0, newPoint);
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update chat history indices to account for the inserted point
      const updatedChatHistory: Record<string, any> = {};
      
      // Adjust chat history indices - move all chats at index >= insertPointIndex one position up
      Object.keys(chatHistory).forEach(key => {
        const pointIndex = parseInt(key);
        
        if (pointIndex >= insertPointIndex) {
          // This chat belongs to a point that has been shifted
          updatedChatHistory[pointIndex + 1] = chatHistory[pointIndex];
        } else {
          // This chat stays at the same index
          updatedChatHistory[pointIndex] = chatHistory[pointIndex];
        }
      });
      
      // Update the chat history in Firestore
      if (Object.keys(updatedChatHistory).length > 0) {
        console.log('Updating chat history indices after point insertion:', updatedChatHistory);
        await updateDoc(entryRef, {
          chatHistory: updatedChatHistory
        });
        
        // Update local state to reflect the changes
        const formattedChatHistory: Record<number, AIMessage[]> = {};
        
        Object.keys(updatedChatHistory).forEach(key => {
          const pointIndex = parseInt(key);
          formattedChatHistory[pointIndex] = updatedChatHistory[key];
        });
        
        setAiMessages(formattedChatHistory);
      }
      
      // Update local state
      setEntry(updatedEntry);
      
      // Close the modal
      closeAddPointModal();
    } catch (error) {
      console.error('Error adding point:', error);
    } finally {
      setIsAddingPoint(false);
    }
  };
  
  // Calculate plus positions based on actual card positions
  const calculatePlusPositions = () => {
    if (!timelineRef.current || pointRefs.current.length === 0) return;
    
    const timelineRect = timelineRef.current.getBoundingClientRect();
    const timelineTop = timelineRect.top;
    const positions: number[] = [];
    
    // Add position for the very top
    positions.push(0);
    
    // Add positions between cards
    for (let i = 0; i < pointRefs.current.length - 1; i++) {
      const currentCard = pointRefs.current[i];
      const nextCard = pointRefs.current[i + 1];
      
      if (currentCard && nextCard) {
        const currentCardRect = currentCard.getBoundingClientRect();
        const nextCardRect = nextCard.getBoundingClientRect();
        
        // Calculate the midpoint between the bottom of current card and top of next card
        const midpoint = 
          (currentCardRect.bottom - timelineTop + (nextCardRect.top - timelineTop)) / 2;
        
        positions.push(midpoint);
      }
    }
    
    // Add position for the very bottom
    if (pointRefs.current.length > 0) {
      const lastCard = pointRefs.current[pointRefs.current.length - 1];
      if (lastCard) {
        const lastCardRect = lastCard.getBoundingClientRect();
        positions.push(lastCardRect.bottom - timelineTop + 20); // 20px below the last card
      }
    }
    
    setPlusPositions(positions);
  };
  
  // Recalculate positions when points change
  useEffect(() => {
    if (entry?.content) {
      try {
        const contentData = JSON.parse(entry.content);
        if (contentData.pathwayPoints && Array.isArray(contentData.pathwayPoints)) {
          // Reset refs array to match the number of points
          pointRefs.current = contentData.pathwayPoints.map(() => null);
          
          // Use setTimeout to ensure the DOM has been updated
          setTimeout(() => {
            calculatePlusPositions();
          }, 300);
        }
      } catch (e) {
        console.error("Error parsing pathway content:", e);
      }
    }
  }, [entry?.content]);
  
  // Also calculate positions when loading is complete
  useEffect(() => {
    if (!loading && entry?.content) {
      setTimeout(() => {
        calculatePlusPositions();
      }, 300);
    }
  }, [loading]);
  
  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      calculatePlusPositions();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  useEffect(() => {
    const fetchEntry = async () => {
      if (!entryId || !currentUser) {
        navigate('/');
        return;
      }
      
      try {
        const loadedEntry = await getEntryById(entryId);
        
        if (!loadedEntry) {
          setError('Entry not found');
          return;
        }
        
        if (loadedEntry.userId !== currentUser.uid) {
          setError('You do not have permission to view this entry');
          return;
        }
        
        if (loadedEntry.type !== 'pathway') {
          setError('This is not a pathway entry');
          return;
        }
        
        setEntry(loadedEntry as Entry);
        
        // Set initial main content if available
        if ((loadedEntry as Entry).mainContent) {
          setMainContent((loadedEntry as Entry).mainContent || '');
        }
        
        // Load chat history after entry is loaded
        await loadChatHistoryFromFirestore();
      } catch (err) {
        console.error('Error fetching entry:', err);
        setError('Failed to load entry');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntry();
  }, [entryId, currentUser, navigate]);
  
  // Handle starting to edit a primary verse
  const startEditingPrimaryVerse = (pointIndex: number, currentVerse: string) => {
    setEditingPrimaryVerse(pointIndex);
    setNewPrimaryVerseText(currentVerse);
  };

  // Handle starting to add a primary verse (when none exists)
  const startAddingPrimaryVerse = (pointIndex: number) => {
    setEditingPrimaryVerse(pointIndex);
    setNewPrimaryVerseText('');
  };

  // Handle saving primary verse changes
  const savePrimaryVerseChanges = async (pointIndex: number) => {
    if (!entryId || !currentUser || !entry || !entry.content) return;
    
    setIsSavingVerses(true);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      // Update the primary verse for the point
      contentData.pathwayPoints[pointIndex].primaryVerse = newPrimaryVerseText.trim() || undefined;
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
      
      // Close editing
      cancelEditingPrimaryVerse();
    } catch (error) {
      console.error('Error saving primary verse:', error);
    } finally {
      setIsSavingVerses(false);
    }
  };

  // Cancel editing primary verse
  const cancelEditingPrimaryVerse = () => {
    setEditingPrimaryVerse(null);
    setNewPrimaryVerseText('');
  };

  // Start editing an additional verse
  const startEditingAdditionalVerse = (pointIndex: number, verseIndex: number, currentVerse: string) => {
    setEditingAdditionalVerse({ pointIndex, verseIndex });
    setNewAdditionalVerseText(currentVerse);
  };

  // Save changes to an additional verse
  const saveAdditionalVerseChanges = async () => {
    if (!editingAdditionalVerse || !entryId || !currentUser || !entry || !entry.content) return;
    
    const { pointIndex, verseIndex } = editingAdditionalVerse;
    setIsSavingVerses(true);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      const point = contentData.pathwayPoints[pointIndex];
      
      // Ensure additionalVerses array exists
      if (!point.additionalVerses) {
        point.additionalVerses = [];
      }
      
      // Update the verse
      if (newAdditionalVerseText.trim()) {
        point.additionalVerses[verseIndex] = newAdditionalVerseText.trim();
      } else {
        // If empty, remove the verse
        point.additionalVerses.splice(verseIndex, 1);
      }
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
      
      // Close editing
      cancelEditingAdditionalVerse();
    } catch (error) {
      console.error('Error saving additional verse:', error);
    } finally {
      setIsSavingVerses(false);
    }
  };

  // Cancel editing additional verse
  const cancelEditingAdditionalVerse = () => {
    setEditingAdditionalVerse(null);
    setNewAdditionalVerseText('');
  };

  // Start adding a new additional verse
  const startAddingAdditionalVerse = (pointIndex: number) => {
    setAddingAdditionalVerse(pointIndex);
    setNewAdditionalVerseInput('');
  };

  // Save the new additional verse
  const saveNewAdditionalVerse = async () => {
    if (addingAdditionalVerse === null || !entryId || !currentUser || !entry || !entry.content) return;
    
    const pointIndex = addingAdditionalVerse;
    setIsSavingVerses(true);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      const point = contentData.pathwayPoints[pointIndex];
      
      // Ensure additionalVerses array exists
      if (!point.additionalVerses) {
        point.additionalVerses = [];
      }
      
      // Add the new verse
      if (newAdditionalVerseInput.trim()) {
        point.additionalVerses.push(newAdditionalVerseInput.trim());
      }
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
      
      // Close adding form
      cancelAddingAdditionalVerse();
    } catch (error) {
      console.error('Error adding additional verse:', error);
    } finally {
      setIsSavingVerses(false);
    }
  };

  // Cancel adding additional verse
  const cancelAddingAdditionalVerse = () => {
    setAddingAdditionalVerse(null);
    setNewAdditionalVerseInput('');
  };

  // Delete an additional verse
  const deleteAdditionalVerse = async (pointIndex: number, verseIndex: number) => {
    if (!entryId || !currentUser || !entry || !entry.content) return;
    
    setIsSavingVerses(true);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      const point = contentData.pathwayPoints[pointIndex];
      
      // Ensure additionalVerses array exists
      if (!point.additionalVerses || !Array.isArray(point.additionalVerses)) {
        return;
      }
      
      // Remove the verse
      point.additionalVerses.splice(verseIndex, 1);
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
    } catch (error) {
      console.error('Error deleting additional verse:', error);
    } finally {
      setIsSavingVerses(false);
    }
  };
  
  // Toggle showing notes for a point
  const toggleShowNotes = (pointIndex: number) => {
    if (showingNotesForIndex.includes(pointIndex)) {
      setShowingNotesForIndex(showingNotesForIndex.filter(idx => idx !== pointIndex));
    } else {
      setShowingNotesForIndex([...showingNotesForIndex, pointIndex]);
    }
  };
  
  // Start editing notes
  const startEditingNotes = (pointIndex: number, currentNotes: string) => {
    setEditingNoteForIndex(pointIndex);
    setNoteText(currentNotes || '');
    
    // Ensure notes section is shown
    if (!showingNotesForIndex.includes(pointIndex)) {
      setShowingNotesForIndex([...showingNotesForIndex, pointIndex]);
    }
  };
  
  // Save notes
  const saveNotes = async (pointIndex: number) => {
    if (!entryId || !currentUser || !entry || !entry.content) return;
    
    setIsSavingNote(true);
    
    try {
      // Parse the content
      const contentData = JSON.parse(entry.content);
      if (!contentData.pathwayPoints || !Array.isArray(contentData.pathwayPoints)) {
        throw new Error('Invalid pathway data format');
      }
      
      // Update the notes for the point
      contentData.pathwayPoints[pointIndex].notes = noteText;
      
      // Update the entry with the modified content
      const updatedEntry = {
        ...entry,
        content: JSON.stringify(contentData)
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
      
      // Close editing
      setEditingNoteForIndex(null);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSavingNote(false);
    }
  };
  
  // Cancel editing notes
  const cancelEditingNotes = () => {
    setEditingNoteForIndex(null);
    setNoteText('');
  };
  
  // Handle saving main content
  const saveMainContent = async () => {
    if (!entryId || !currentUser || !entry) return;
    
    setIsSavingMainContent(true);
    
    try {
      // Update entry with new main content
      const updatedEntry: Entry = {
        ...entry,
        mainContent: mainContent
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry);
      
      // Update local state
      setEntry(updatedEntry);
      
      // Exit edit mode
      setIsEditingMainContent(false);
    } catch (error) {
      console.error('Error saving main content:', error);
    } finally {
      setIsSavingMainContent(false);
    }
  };
  
  // Toggle editor theme
  const toggleEditorTheme = () => {
    setEditorTheme(editorTheme === 'light' ? 'dark' : 'light');
  };
  
  // Handle verse input change
  const handleVerseInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVerseInput(e.target.value);
  };
  
  // Add a Bible verse to the pathway
  const handleAddVerse = async () => {
    if (!verseInput.trim() || !entryId || !currentUser || !entry) return;
    
    setIsAddingVerse(true);
    
    try {
      // Verify the verse is valid by fetching it
      const verseData = await getBiblePassage(verseInput);
      
      if (verseData) {
        // Create updated verses array
        const updatedVerses = entry.bibleVerses ? [...entry.bibleVerses] : [];
        
        // Only add if not already in the list
        if (!updatedVerses.includes(verseInput)) {
          updatedVerses.push(verseInput);
          
          // Update entry with new verses
          const updatedEntry = {
            ...entry,
            bibleVerses: updatedVerses
          };
          
          // Save to Firestore
          await updateEntry(entryId, updatedEntry as any);
          
          // Update local state
          setEntry(updatedEntry);
          setVerseInput('');
        }
      } else {
        console.error('Invalid verse reference');
      }
    } catch (error) {
      console.error('Error adding verse:', error);
    } finally {
      setIsAddingVerse(false);
    }
  };
  
  // Remove a Bible verse
  const handleRemoveVerse = async (index: number) => {
    if (!entryId || !currentUser || !entry || !entry.bibleVerses) return;
    
    try {
      const updatedVerses = [...entry.bibleVerses];
      updatedVerses.splice(index, 1);
      
      // Update entry with new verses
      const updatedEntry = {
        ...entry,
        bibleVerses: updatedVerses
      };
      
      // Save to Firestore
      await updateEntry(entryId, updatedEntry as any);
      
      // Update local state
      setEntry(updatedEntry);
    } catch (error) {
      console.error('Error removing verse:', error);
    }
  };
  
  // Fetch linked entries
  useEffect(() => {
    const fetchLinkedEntries = async () => {
      if (!entryId) return;
      
      try {
        setLoadingLinks(true);
        
        // Get all links for this entry
        const allLinks = await getAllEntryLinks(entryId);
        setEntryLinks(allLinks);
        
        // Get all linked entry IDs
        const linkedIds = [
          ...allLinks.sourceLinks.map(link => link.targetEntryId),
          ...allLinks.targetLinks.map(link => link.sourceEntryId)
        ];
        
        if (linkedIds.length === 0) {
          setLinkedEntries([]);
          setLoadingLinks(false);
          return;
        }
        
        // Fetch all linked entries
        const fetchPromises = linkedIds.map(id => getEntryById(id));
        const entries = await Promise.all(fetchPromises);
        
        // Filter out any null entries and make unique by ID
        const validEntries = entries.filter(e => e !== null) as BaseEntry[];
        const uniqueEntries = Array.from(
          new Map(validEntries.map(item => [item.id, item])).values()
        );
        
        setLinkedEntries(uniqueEntries);
      } catch (error) {
        console.error('Error fetching linked entries:', error);
      } finally {
        setLoadingLinks(false);
      }
    };
    
    fetchLinkedEntries();
  }, [entryId]);
  
  // Function to unlink entries
  const handleUnlink = async (linkId: string) => {
    try {
      await deleteEntryLink(linkId);
      
      // Refresh links
      const newLinks = await getAllEntryLinks(entryId!);
      setEntryLinks(newLinks);
      
      // Update linked entries
      const linkedIds = [
        ...newLinks.sourceLinks.map(link => link.targetEntryId),
        ...newLinks.targetLinks.map(link => link.sourceEntryId)
      ];
      
      setLinkedEntries(prev => 
        prev.filter(entry => entry.id && linkedIds.includes(entry.id))
      );
    } catch (error) {
      console.error('Error unlinking entries:', error);
    }
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-4 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !entry) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
          <h2 className="mb-4 text-xl font-bold text-red-600">{error || 'Entry not found'}</h2>
          <button
            onClick={() => navigate('/')}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
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
              Are you sure you want to delete this pathway? This action cannot be undone.
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
      
      {/* Add Point Modal */}
      {showAddPointModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Add New Point</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="pointTitle" className="block text-sm font-medium text-gray-700">
                  Point Title
                </label>
                <input
                  type="text"
                  id="pointTitle"
                  value={newPointTitle}
                  onChange={handleNewPointTitleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter title for the new point"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="pointDescription" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="pointDescription"
                  value={newPointDescription}
                  onChange={handleNewPointDescriptionChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Describe this point"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="primaryVerse" className="block text-sm font-medium text-gray-700">
                  Primary Bible Verse
                </label>
                <input
                  type="text"
                  id="primaryVerse"
                  value={newPointPrimaryVerse}
                  onChange={handleNewPointPrimaryVerseChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="e.g. John 3:16"
                />
              </div>
              
              <div>
                <label htmlFor="additionalVerses" className="block text-sm font-medium text-gray-700">
                  Additional Verses (comma-separated)
                </label>
                <input
                  type="text"
                  id="additionalVerses"
                  value={newPointAdditionalVerses}
                  onChange={handleNewPointAdditionalVersesChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="e.g. Romans 8:28, Psalm 23:1"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={closeAddPointModal}
                className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
                disabled={isAddingPoint}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPoint}
                className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                disabled={isAddingPoint || !newPointTitle || !newPointDescription}
              >
                {isAddingPoint ? 'Adding...' : 'Add Point'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-20">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">{entry.title}</h1>
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
        </div>
        
        {/* Main Pathway Content WYSIWYG - Always Editable */}
        <div className="mb-6 border border-gray-200 rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-700">Pathway Overview</h2>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={toggleEditorTheme}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
              >
                {editorTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </button>
              {mainContent && (
                <button
                  onClick={saveMainContent}
                  disabled={isSavingMainContent}
                  className="px-3 py-1 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {isSavingMainContent ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
          
          <div data-color-mode={editorTheme}>
            <MDEditor
              value={mainContent}
              onChange={(val) => {
                setMainContent(val || '');
                setIsEditingMainContent(true);
              }}
              preview="edit"
              height={200}
            />
          </div>
        </div>
        
        {/* Bible Verses Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Related Bible Verses</h3>
          
          <div className="flex mb-3">
            <input
              type="text"
              value={verseInput}
              onChange={handleVerseInputChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., John 3:16"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddVerse();
                }
              }}
            />
            <button
              onClick={handleAddVerse}
              disabled={isAddingVerse || !verseInput.trim()}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
            >
              {isAddingVerse ? 'Adding...' : 'Add'}
            </button>
          </div>
          
          {entry && entry.bibleVerses && entry.bibleVerses.length > 0 ? (
            <div className="bg-gray-50 rounded-md p-3">
              <ul className="space-y-2">
                {entry.bibleVerses.map((verse, index) => (
                  <li key={index} className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm">
                    <span 
                      className="text-indigo-600 cursor-pointer hover:text-indigo-800 hover:underline"
                      onClick={() => handleVerseClick(verse)}
                    >
                      {verse}
                    </span>
                    <button
                      onClick={() => handleRemoveVerse(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-gray-500 italic bg-gray-50 p-4 rounded-md text-center">
              No related Bible verses added yet. Add verses above to associate them with this pathway.
            </div>
          )}
        </div>
        
        {/* Creation Date */}
        {entry.createdAt && (
          <div className="mb-4 text-sm text-gray-500">
            Created: {formatDate(entry.createdAt)}
          </div>
        )}
        
        {/* Render the pathway content */}
        {entry.content && (
          <div className="my-6">
            {(() => {
              try {
                // Try to parse content as JSON containing pathway points
                const contentData = JSON.parse(entry.content);
                if (contentData.pathwayPoints && Array.isArray(contentData.pathwayPoints)) {
                  return (
                    <div className="pathway-timeline relative pb-8 w-full">
                      {/* Timeline line - centered with insertion areas */}
                      <div 
                        ref={timelineRef}
                        className="absolute left-1/2 top-0 bottom-0 w-0.5 -ml-0.5 bg-indigo-200"
                      >
                        {/* Dynamic plus buttons */}
                        {plusPositions.map((position, index) => (
                          <div 
                            key={`insert-dynamic-${index}`}
                            className="absolute left-0 h-8 w-8 -ml-4 cursor-pointer flex items-center justify-center hover:bg-indigo-100 bg-white border-2 border-indigo-300 rounded-full transition-all duration-200 z-30"
                            style={{ top: `${position}px` }}
                            onClick={() => handleTimelineClick(index)}
                            title={`Add point ${index === 0 ? 'at beginning' : index === plusPositions.length - 1 ? 'at end' : 'here'}`}
                          >
                            <span className="text-indigo-500 text-xl font-bold hover:scale-125 transition-transform">+</span>
                          </div>
                        ))}
                      </div>

                      {/* Instructions for adding points */}
                      <div className="text-center mb-4 text-sm text-gray-500 italic">
                        Click on the + icons to add new points
                      </div>

                      {/* Pathway points */}
                      {contentData.pathwayPoints.map((point: PathwayPoint, index: number) => {
                        const isCompleted = isPointCompleted(point);
                        const completionDate = getCompletionDate(point);
                        const isAiActive = activeAIPointIndex === index;
                        const pointMessages = aiMessages[index] || [];
                        
                        return (
                          <div 
                            key={index} 
                            className={`${index === 0 ? 'mt-0' : 'mt-16'} relative`}
                            ref={(el) => {
                              pointRefs.current[index] = el;
                              return undefined;
                            }}
                          >
                            {/* Timeline dot - positioned on the center line */}
                            <div className={`absolute left-1/2 top-6 w-4 h-4 rounded-full z-20 -translate-x-1/2
                              ${isCompleted ? 'bg-green-500' : 'bg-indigo-500'}`}></div>
                            
                            {/* Horizontal connector line */}
                            <div className={`absolute top-[30px] h-0.5 bg-indigo-200 z-10 ${
                              index % 2 !== 0 
                                ? 'left-[calc(50%+2px)] w-[calc(50%-4rem-2px)]' 
                                : 'right-[calc(50%+2px)] w-[calc(50%-4rem-2px)]'
                            }`}></div>
                            
                            {/* Content box */}
                            <div className={`flex ${index % 2 !== 0 ? 'justify-end pr-6' : 'justify-start pl-6'} ${
                              index % 2 !== 0 ? 'ml-auto mr-[4rem]' : 'mr-auto ml-[4rem]'
                            } w-[calc(50%-4rem)]`}>
                              <div className={`rounded-lg border border-gray-200 shadow-sm p-4 w-full mt-3 
                                ${isCompleted ? 'bg-green-50' : 'bg-white'}
                                ${index % 2 !== 0 ? 'text-right' : 'text-left'}`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <h3 className={`text-lg font-semibold text-gray-800 ${index % 2 !== 0 ? 'order-2' : 'order-1'}`}>
                                    {point.title}
                                  </h3>
                                  
                                  <button
                                    onClick={() => handleCompletePoint(index)}
                                    disabled={isCompleted || updatingPointIndex === index}
                                    className={`px-3 py-1 rounded-md text-sm font-medium ${index % 2 !== 0 ? 'order-1' : 'order-2'} 
                                      ${isCompleted 
                                        ? 'bg-green-100 text-green-800 cursor-default' 
                                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
                                  >
                                    {updatingPointIndex === index 
                                      ? 'Saving...' 
                                      : isCompleted 
                                        ? 'Completed' 
                                        : 'Mark Complete'}
                                  </button>
                                </div>
                                
                                {isCompleted && (
                                  <div className={`text-sm text-green-600 italic mb-3 ${index % 2 !== 0 ? 'text-right' : 'text-left'}`}>
                                    Completed on {completionDate}
                                  </div>
                                )}
                                
                                <div className="flex flex-col">
                                  <p className="text-gray-700 mb-3">{point.description}</p>
                                  
                                  {point.primaryVerse && (
                                    <div className="bg-indigo-50 p-3 rounded-md mb-3">
                                      <div className="font-medium text-indigo-700 mb-1">Primary Verse:</div>
                                      {editingPrimaryVerse === index ? (
                                        <div className="flex flex-col space-y-2">
                                          <input
                                            type="text"
                                            value={newPrimaryVerseText}
                                            onChange={(e) => setNewPrimaryVerseText(e.target.value)}
                                            className="w-full p-2 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Enter Bible verse (e.g. John 3:16)"
                                          />
                                          <div className="flex justify-end space-x-2">
                                            <button
                                              onClick={cancelEditingPrimaryVerse}
                                              disabled={isSavingVerses}
                                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={() => savePrimaryVerseChanges(index)}
                                              disabled={isSavingVerses}
                                              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                            >
                                              {isSavingVerses ? 'Saving...' : 'Save'}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex justify-between items-center">
                                          <div 
                                            onClick={() => handleVerseClick(point.primaryVerse as string)}
                                            className="cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline"
                                          >
                                            {point.primaryVerse}
                                          </div>
                                          <button
                                            onClick={() => startEditingPrimaryVerse(index, point.primaryVerse || '')}
                                            className="ml-2 p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 rounded"
                                            title="Edit primary verse"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {!point.primaryVerse && (
                                    <div className="mb-3">
                                      {editingPrimaryVerse === index ? (
                                        <div className="bg-indigo-50 p-3 rounded-md">
                                          <div className="font-medium text-indigo-700 mb-1">Primary Verse:</div>
                                          <div className="flex flex-col space-y-2">
                                            <input
                                              type="text"
                                              value={newPrimaryVerseText}
                                              onChange={(e) => setNewPrimaryVerseText(e.target.value)}
                                              className="w-full p-2 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                              placeholder="Enter Bible verse (e.g. John 3:16)"
                                            />
                                            <div className="flex justify-end space-x-2">
                                              <button
                                                onClick={cancelEditingPrimaryVerse}
                                                disabled={isSavingVerses}
                                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                onClick={() => savePrimaryVerseChanges(index)}
                                                disabled={isSavingVerses}
                                                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                              >
                                                {isSavingVerses ? 'Saving...' : 'Save'}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startAddingPrimaryVerse(index)}
                                          className="flex items-center px-3 py-1.5 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-md hover:bg-indigo-50"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                          </svg>
                                          Add Primary Verse
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Additional verses section - always show regardless of whether there are verses */}
                                  <div className="bg-blue-50 p-3 rounded-md mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <div className="font-medium text-gray-700">Also read:</div>
                                      <button
                                        onClick={() => startAddingAdditionalVerse(index)}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                        title="Add verse"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                      </button>
                                    </div>
                                    
                                    {addingAdditionalVerse === index && (
                                      <div className="mb-2 p-2 bg-white rounded border border-blue-200">
                                        <input
                                          type="text"
                                          value={newAdditionalVerseInput}
                                          onChange={(e) => setNewAdditionalVerseInput(e.target.value)}
                                          className="w-full p-1.5 border border-blue-300 rounded mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          placeholder="Enter Bible verse (e.g. Romans 8:28)"
                                        />
                                        <div className="flex justify-end space-x-2">
                                          <button
                                            onClick={cancelAddingAdditionalVerse}
                                            disabled={isSavingVerses}
                                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={saveNewAdditionalVerse}
                                            disabled={isSavingVerses || !newAdditionalVerseInput.trim()}
                                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                          >
                                            {isSavingVerses ? 'Adding...' : 'Add'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {(!point.additionalVerses || point.additionalVerses.length === 0) && addingAdditionalVerse !== index && (
                                      <div className="text-gray-500 italic text-sm">No additional verses.</div>
                                    )}
                                    
                                    {point.additionalVerses && point.additionalVerses.length > 0 && (
                                      <ul className={`space-y-1 ${index % 2 !== 0 ? 'text-right' : 'text-left'}`}>
                                        {point.additionalVerses.map((verse: string, idx: number) => (
                                          <li key={idx} className="flex items-center justify-between">
                                            {editingAdditionalVerse && 
                                             editingAdditionalVerse.pointIndex === index && 
                                             editingAdditionalVerse.verseIndex === idx ? (
                                              <div className="w-full p-1.5 bg-white rounded border border-blue-200">
                                                <input
                                                  type="text"
                                                  value={newAdditionalVerseText}
                                                  onChange={(e) => setNewAdditionalVerseText(e.target.value)}
                                                  className="w-full p-1.5 border border-blue-300 rounded mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  placeholder="Enter Bible verse (e.g. Romans 8:28)"
                                                />
                                                <div className="flex justify-end space-x-2">
                                                  <button
                                                    onClick={cancelEditingAdditionalVerse}
                                                    disabled={isSavingVerses}
                                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                                  >
                                                    Cancel
                                                  </button>
                                                  <button
                                                    onClick={saveAdditionalVerseChanges}
                                                    disabled={isSavingVerses}
                                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                                  >
                                                    {isSavingVerses ? 'Saving...' : 'Save'}
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                <span 
                                                  onClick={() => handleVerseClick(verse)}
                                                  className="cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline"
                                                >
                                                  {verse}
                                                </span>
                                                <div className="flex space-x-1">
                                                  <button
                                                    onClick={() => startEditingAdditionalVerse(index, idx, verse)}
                                                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded"
                                                    title="Edit verse"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                  </button>
                                                  <button
                                                    onClick={() => deleteAdditionalVerse(index, idx)}
                                                    className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded"
                                                    title="Remove verse"
                                                  >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                  </button>
                                                </div>
                                              </>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  
                                  {/* Notes Section */}
                                  <div className="mb-3">
                                    <button 
                                      onClick={() => toggleShowNotes(index)}
                                      className="flex items-center px-3 py-1.5 text-xs text-gray-600 border border-dashed border-gray-300 rounded-md hover:bg-gray-50 mb-2"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {showingNotesForIndex.includes(index) ? (
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        ) : (
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        )}
                                      </svg>
                                      {point.notes ? 'View Notes' : 'Add Notes'}
                                    </button>
                                    
                                    {showingNotesForIndex.includes(index) && (
                                      <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                        <div className="flex justify-between items-center mb-2">
                                          <h4 className="font-medium text-gray-700">Notes:</h4>
                                          {point.notes && editingNoteForIndex !== index && (
                                            <button
                                              onClick={() => startEditingNotes(index, point.notes || '')}
                                              className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 rounded"
                                              title="Edit notes"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                        
                                        {editingNoteForIndex === index ? (
                                          <div>
                                            <textarea
                                              value={noteText}
                                              onChange={(e) => setNoteText(e.target.value)}
                                              rows={4}
                                              className="w-full p-2 border border-yellow-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                              placeholder="Enter your notes for this point..."
                                            />
                                            <div className="flex justify-end space-x-2">
                                              <button
                                                onClick={cancelEditingNotes}
                                                disabled={isSavingNote}
                                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                onClick={() => saveNotes(index)}
                                                disabled={isSavingNote}
                                                className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                                              >
                                                {isSavingNote ? 'Saving...' : 'Save'}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div>
                                            {point.notes ? (
                                              <p className="text-gray-700 whitespace-pre-wrap">{point.notes}</p>
                                            ) : (
                                              <div className="text-center py-2">
                                                <button
                                                  onClick={() => startEditingNotes(index, '')}
                                                  className="px-3 py-1.5 text-xs text-yellow-600 border border-dashed border-yellow-300 rounded-md hover:bg-yellow-100"
                                                >
                                                  + Add Notes
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* AI Chat Section - always show input */}
                                  <div className="border border-purple-200 rounded-md p-3 bg-purple-50">
                                    {/* Messages */}
                                    {aiMessages[index] && aiMessages[index].length > 0 && (
                                      <div className="mb-3 max-h-64 overflow-y-auto space-y-3 p-2">
                                        {aiMessages[index].map((msg, msgIdx) => (
                                          <div key={msgIdx}>
                                            {/* Add a label to clearly identify messages */}
                                            <div className={`text-xs font-semibold mb-1 ${
                                              msg.role === 'user' ? 'text-right text-blue-600' : 'text-left text-purple-600'
                                            }`}>
                                              {msg.role === 'user' ? 'You:' : 'AI Assistant:'}
                                            </div>
                                            
                                            <div 
                                              className={`p-3 rounded-lg ${
                                                msg.role === 'user' 
                                                  ? 'bg-blue-100 text-blue-800 ml-auto max-w-[80%] border border-blue-200' 
                                                  : 'bg-purple-50 text-gray-800 mr-auto max-w-[80%] border border-purple-200'
                                              }`}
                                            >
                                              {msg.content}
                                              {msg.role === 'assistant' && msg.audioUrl && (
                                                <div className="mt-2">
                                                  <audio 
                                                    src={msg.audioUrl} 
                                                    controls 
                                                    className="w-full h-8"
                                                  >
                                                    Your browser does not support the audio element.
                                                  </audio>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* AI Input */}
                                    <div className="flex items-center">
                                      <input
                                        type="text"
                                        value={activeAIPointIndex === index ? aiInput : ''}
                                        onChange={handleAiInputChange}
                                        onClick={() => {
                                          if (activeAIPointIndex !== index) {
                                            setActiveAIPointIndex(index);
                                          }
                                        }}
                                        placeholder="Ask the AI assistant about this point..."
                                        className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter' && activeAIPointIndex === index) {
                                            sendMessageToAI(index, point);
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() => sendMessageToAI(index, point)}
                                        disabled={isAiLoading || !aiInput.trim() || activeAIPointIndex !== index}
                                        className="bg-purple-600 text-white p-2 rounded-r-md hover:bg-purple-700 disabled:bg-purple-300"
                                      >
                                        {isAiLoading && activeAIPointIndex === index ? (
                                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-2 border-white"></div>
                                        ) : (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                          </svg>
                                        )}
                                      </button>
                                    </div>
                                    
                                    {/* AI context hint */}
                                    <div className="mt-2 text-xs text-gray-500 italic">
                                      Ask a question about this pathway point, Bible verses, or related theological concepts.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
        
        {/* Linked Entries Section */}
        <div className="mt-12 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Linked Entries</h2>
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
          
          {loadingLinks ? (
            <div className="py-8 text-center text-gray-500">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"></div>
              <span className="ml-2">Loading linked entries...</span>
            </div>
          ) : linkedEntries.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p>No linked entries found.</p>
              <p className="mt-2 text-sm">
                Connect this pathway with other entries to build relationships between your content.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {linkedEntries.map(entry => {
                // Find the link object between these entries
                const sourceLink = entryLinks.sourceLinks.find(link => link.targetEntryId === entry.id);
                const targetLink = entryLinks.targetLinks.find(link => link.sourceEntryId === entry.id);
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
          )}
        </div>
      </div>
    </div>
  );
};

export default PathwayDetailPage; 