import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createEntry, updateEntry, getEntryById, Entry, uploadAudio, uploadRecordedAudio } from '../../services/firestore';
import { speechToText, chatWithGPT, getBiblePassage } from '../../services/api';
import { Timestamp } from 'firebase/firestore';
import AudioRecorder from '../Audio/AudioRecorder';
import AudioPlayer from '../Audio/AudioPlayer';

interface AudioEntryEditorProps {
  isEditing?: boolean;
}

const AudioEntryEditor: React.FC<AudioEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Entry state
  const [title, setTitle] = useState('New Audio Entry');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const [bibleVerses, setBibleVerses] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [relatedVerses, setRelatedVerses] = useState<string[]>([]);
  
  // Bible verse input state
  const [verseInput, setVerseInput] = useState('');
  const [showVerseModal, setShowVerseModal] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseLoading, setVerseLoading] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [autoProcessing, setAutoProcessing] = useState(false);
  
  // Define a type for the processWithAI return value
  type AIProcessResult = {
    success: boolean;
    verses: string[];
    category: string;
    relatedVerses: string[];
    suggestedTitle: string;
  };
  
  // Load existing entry if editing
  useEffect(() => {
    const loadEntry = async () => {
      if (isEditing && entryId && currentUser) {
        try {
          setIsLoading(true);
          const entry = await getEntryById(entryId);
          
          if (entry && entry.userId === currentUser.uid) {
            setTitle(entry.title || 'Untitled Audio');
            setTranscription(entry.content || '');
            setBibleVerses(entry.bibleVerses || []);
            setCategory(entry.category || '');
            setRelatedVerses(entry.relatedVerses || []);
            setAudioUrl(entry.audioUrl as string || null);
          } else {
            setError('Entry not found or you do not have permission to edit it');
          }
        } catch (err) {
          console.error('Error loading entry:', err);
          setError('Failed to load entry. Please try again.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadEntry();
  }, [isEditing, entryId, currentUser]);
  
  // Handle recording completion
  const handleRecordingComplete = (blob: Blob) => {
    console.log("🎤 Recording complete callback received in AudioEntryEditor");
    setAudioBlob(blob);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    console.log("🎤 Audio recording completed - Blob size:", blob.size, "URL created:", url, "Type:", blob.type);
    
    // Store a reference to the blob in localStorage (just the fact that we have one, not the blob itself)
    localStorage.setItem('hasRecordedAudio', 'true');
    
    // Verify the blob is valid
    const reader = new FileReader();
    reader.onload = function() {
      console.log("🎤 Audio blob read successfully, size:", reader.result ? (reader.result as ArrayBuffer).byteLength : 0);
      
      // Only start transcription if we have valid audio
      if (reader.result && (reader.result as ArrayBuffer).byteLength > 0) {
        console.log("🎤 Valid audio blob confirmed - Starting automatic transcription process");
        
        // Use a slightly longer timeout to ensure state is updated
        setTimeout(() => {
          if (!isEditing || !transcription) {
            console.log("🎤 Initiating automatic transcription...");
            // Pass the blob directly instead of relying on state
            handleTranscribeWithBlob(blob, true);
          } else {
            console.log("🎤 Skipping automatic transcription in edit mode with existing transcription");
          }
        }, 800);
      } else {
        console.error("🎤 Invalid audio blob - Cannot transcribe");
        setError("Recording resulted in invalid audio. Please try again.");
      }
    };
    reader.onerror = function() {
      console.error("🎤 Error reading audio blob:", reader.error);
      setError("Error processing recording. Please try again.");
    };
    reader.readAsArrayBuffer(blob);
  };
  
  // Transcribe directly with a blob
  const handleTranscribeWithBlob = async (blob: Blob, autoProcess = false) => {
    console.log("🔄 Starting transcription process with provided blob - Size:", blob.size);
    
    // Create a persistent copy of the blob to ensure it doesn't get garbage collected
    const persistentBlob = new Blob([blob], { type: blob.type });
    console.log("🔄 Created persistent copy of blob - Size:", persistentBlob.size);
    
    // Make sure we have the blob in state immediately
    setAudioBlob(persistentBlob);
    
    try {
      setIsTranscribing(true);
      setError('');
      setAutoProcessing(autoProcess);
      
      console.log("🔄 Sending provided blob to speech-to-text API...");
      const text = await speechToText(persistentBlob);
      console.log("🔄 Received transcription text:", text ? `${text.substring(0, 50)}...` : "No text received");
      
      if (!text || text.trim() === '') {
        console.error("🔄 Empty transcription received");
        setError('Failed to transcribe audio. The recording may be too quiet or in an unsupported format.');
        return;
      }
      
      // Update transcription state with the new text
      setTranscription(text);
      setSuccess('Audio transcribed successfully!');
      
      // Auto-title based on first few words
      if (title === 'New Audio Entry' && text) {
        const words = text.split(' ').slice(0, 5).join(' ');
        const autoTitle = `${words}...`;
        console.log("🔄 Setting auto-generated title:", autoTitle);
        setTitle(autoTitle);
      }
      
      // Auto process with AI if requested
      if (autoProcess) {
        console.log("🔄 Auto-processing with AI after transcription");
        // Add a small delay to ensure UI updates and state changes have been processed
        setTimeout(async () => {
          try {
            // Save a reference to the blob for the auto-save process
            const savedBlob = persistentBlob;
            
            const aiResult = await processWithAI(true, text);
            
            // After AI processing, automatically save if we're doing the full auto flow
            if (aiResult.success) {
              console.log("🔄 Auto-saving entry after AI processing");
              // Small delay to ensure all state updates have been applied
              setTimeout(async () => {
                // Final check to make sure we're not still processing
                if (!isProcessing) {
                  console.log("🔄 Auto-save: Using preserved blob - Size:", savedBlob.size);
                  // Pass the blob directly to handleSave instead of updating state
                  await handleSave(savedBlob, text, aiResult.verses, aiResult.category, aiResult.relatedVerses);
                } else {
                  console.error("🔄 Still processing, delaying auto-save");
                  // Try one more time after another delay
                  setTimeout(async () => {
                    console.log("🔄 Auto-save retry: Using preserved blob - Size:", savedBlob.size);
                    await handleSave(savedBlob, text, aiResult.verses, aiResult.category, aiResult.relatedVerses);
                  }, 1000);
                }
              }, 500);
            } else {
              console.error("🔄 AI processing failed, not proceeding to auto-save");
            }
          } catch (error) {
            console.error("🔄 Error during auto-processing:", error);
          }
        }, 500);
      }
      
    } catch (err) {
      console.error('🔄 Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
      setAutoProcessing(false);
    } finally {
      setIsTranscribing(false);
      console.log("🔄 Transcription process complete");
    }
  };
  
  // Transcribe audio recording (using state)
  const handleTranscribe = async (autoProcess = false) => {
    console.log("🔄 Starting transcription process - autoProcess:", autoProcess);
    
    if (!audioBlob && !audioUrl) {
      console.error("🔄 No audio recording found for transcription");
      setError('No audio recording found. Please record audio first.');
      return;
    }
    
    try {
      setIsTranscribing(true);
      setError('');
      setAutoProcessing(autoProcess);
      
      console.log("🔄 Transcription parameters - Blob available:", !!audioBlob, "Blob size:", audioBlob?.size, "URL available:", !!audioUrl);
      
      if (!audioBlob) {
        console.error("🔄 Audio data is missing");
        setError('Audio data is missing. Please try recording again.');
        return;
      }
      
      console.log("🔄 Sending audio to speech-to-text API...");
      const text = await speechToText(audioBlob);
      console.log("🔄 Received transcription text:", text ? `${text.substring(0, 50)}...` : "No text received");
      
      if (!text || text.trim() === '') {
        console.error("🔄 Empty transcription received");
        setError('Failed to transcribe audio. The recording may be too quiet or in an unsupported format.');
        return;
      }
      
      setTranscription(text);
      setSuccess('Audio transcribed successfully!');
      
      // Auto-title based on first few words
      if (title === 'New Audio Entry' && text) {
        const words = text.split(' ').slice(0, 5).join(' ');
        const autoTitle = `${words}...`;
        console.log("🔄 Setting auto-generated title:", autoTitle);
        setTitle(autoTitle);
      }
      
      // Auto process with AI if requested
      if (autoProcess) {
        console.log("🔄 Auto-processing with AI after transcription");
        // Add a small delay to ensure UI updates and state changes have been processed
        setTimeout(async () => {
          try {
            // Save a reference to the blob for the auto-save process
            const savedBlob = audioBlob;
            
            const aiResult = await processWithAI(true, text);
            
            // After AI processing, automatically save if we're doing the full auto flow
            if (aiResult.success) {
              console.log("🔄 Auto-saving entry after AI processing");
              // Small delay to ensure all state updates have been applied
              setTimeout(async () => {
                // Final check to make sure we're not still processing
                if (!isProcessing) {
                  console.log("🔄 Auto-save: Using preserved blob - Size:", savedBlob?.size || 'unknown');
                  // Pass the blob directly to handleSave if available
                  if (savedBlob) {
                    await handleSave(savedBlob, text, aiResult.verses, aiResult.category, aiResult.relatedVerses);
                  } else {
                    console.error("🔄 Auto-save failed: No blob available");
                  }
                } else {
                  console.error("🔄 Still processing, delaying auto-save");
                  // Try one more time after another delay
                  setTimeout(async () => {
                    console.log("🔄 Auto-save retry: Using preserved blob - Size:", savedBlob?.size || 'unknown');
                    if (savedBlob) {
                      await handleSave(savedBlob, text, aiResult.verses, aiResult.category, aiResult.relatedVerses);
                    } else {
                      console.error("🔄 Auto-save retry failed: No blob available");
                    }
                  }, 1000);
                }
              }, 500);
            } else {
              console.error("🔄 AI processing failed, not proceeding to auto-save");
            }
          } catch (error) {
            console.error("🔄 Error during auto-processing:", error);
          }
        }, 500);
      }
    } catch (err) {
      console.error('🔄 Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
      setAutoProcessing(false);
    } finally {
      setIsTranscribing(false);
      console.log("🔄 Transcription process complete");
    }
  };
  
  // Process with AI to find Bible verses and category
  const processWithAI = async (autoSave = false, transcriptionText?: string): Promise<AIProcessResult> => {
    console.log(`🤖 Starting AI processing... (autoSave: ${autoSave})`);
    
    // Use passed transcription text if available, otherwise use state
    const textToProcess = transcriptionText || transcription;
    
    if (!textToProcess.trim()) {
      console.error("🤖 No transcription text available for AI processing");
      setError('Please transcribe your audio before processing with AI.');
      return { success: false, verses: [], category: '', relatedVerses: [], suggestedTitle: '' };
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // First try the API endpoint
      try {
        const response = await fetch('/api/process-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToProcess }),
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            const result: AIProcessResult = {
              success: true,
              verses: data.verses || [],
              category: data.category || '',
              relatedVerses: data.relatedVerses || [],
              suggestedTitle: data.suggestedTitle || ''
            };
            
            // Update state with the results
            setBibleVerses(result.verses);
            setCategory(result.category);
            setRelatedVerses(result.relatedVerses);
            
            // Set suggested title if we have one and current title is empty
            if (result.suggestedTitle && (title === 'New Audio Entry' || !title)) {
              setTitle(result.suggestedTitle);
            }
            
            setSuccess('Successfully processed with AI');
            
            if (autoSave) {
              console.log('🤖 Auto-saving after AI processing');
              // Ensure we're passing the most up-to-date data directly
              // Rather than relying on state which might not have updated yet
              await handleSave(undefined, textToProcess, result.verses, result.category, result.relatedVerses);
            }
            
            return result;
          }
        }
        
        // If we're here, the API call wasn't successful or returned an error
        console.log(`🤖 API endpoint failed with status ${response.status}. Using fallback method.`);
      } catch (apiError) {
        console.log('🤖 API endpoint not available. Using fallback method:', apiError);
      }
      
      // Fallback method if API is not available
      console.log('🤖 Using local fallback method for text processing');
      
      // Simple title generation - first 5-7 words
      const words = textToProcess.split(' ');
      const wordCount = Math.min(7, Math.max(5, Math.floor(words.length / 10)));
      const suggestedTitle = words.slice(0, wordCount).join(' ') + '...';
      
      // Simple category detection based on keywords
      let category = 'Teaching'; // Default category
      const lowerText = textToProcess.toLowerCase();
      
      if (lowerText.includes('jesus') || lowerText.includes('christ') || lowerText.includes('messiah')) {
        category = 'Person';
      } else if (lowerText.includes('jerusalem') || lowerText.includes('israel') || lowerText.includes('egypt')) {
        category = 'Place';
      } else if (lowerText.includes('creation') || lowerText.includes('exodus') || lowerText.includes('resurrection')) {
        category = 'Event';
      } else if (lowerText.includes('faith') || lowerText.includes('hope') || lowerText.includes('love')) {
        category = 'Theme';
      } else if (lowerText.includes('prophecy') || lowerText.includes('prophet')) {
        category = 'Prophecy';
      }
      
      // Find potential related verses by looking for mentions of Bible books
      const bibleBooks = [
        'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
        'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms',
        'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
        'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
        'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
        'John', 'Acts', 'Romans', 'Corinthians', 'Galatians', 'Ephesians', 'Philippians',
        'Colossians', 'Thessalonians', 'Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
        'Peter', 'John', 'Jude', 'Revelation'
      ];
      
      // Default verses if no specific ones are detected
      const defaultVerses = ['John 3:16', 'Romans 8:28', 'Philippians 4:13'];
      const relatedVerses: string[] = [];
      
      // Add a default verse based on the category
      switch (category) {
        case 'Person':
          relatedVerses.push('John 1:14');
          break;
        case 'Place':
          relatedVerses.push('Psalm 122:1');
          break;
        case 'Event':
          relatedVerses.push('Acts 2:22-24');
          break;
        case 'Theme':
          relatedVerses.push('1 Corinthians 13:13');
          break;
        case 'Prophecy':
          relatedVerses.push('Isaiah 53:5-6');
          break;
        default:
          relatedVerses.push(defaultVerses[0]);
      }
      
      // Use another default verse
      relatedVerses.push(defaultVerses[1]);
      
      // Create a result object
      const fallbackResult: AIProcessResult = {
        success: true,
        verses: [defaultVerses[2]],
        category,
        relatedVerses,
        suggestedTitle
      };
      
      // Update state
      setBibleVerses(fallbackResult.verses);
      setCategory(fallbackResult.category);
      setRelatedVerses(fallbackResult.relatedVerses);
      
      // Set suggested title if current title is default
      if (title === 'New Audio Entry' || !title) {
        setTitle(fallbackResult.suggestedTitle);
      }
      
      setSuccess('Processing completed with local method');
      
      if (autoSave) {
        console.log('🤖 Auto-saving after local processing');
        await handleSave(
          undefined, 
          textToProcess, 
          fallbackResult.verses, 
          fallbackResult.category,
          fallbackResult.relatedVerses
        );
      }
      
      return fallbackResult;
    } catch (error) {
      console.error('🤖 Error processing with AI:', error);
      setError(error instanceof Error ? error.message : 'Failed to process with AI');
      return { success: false, verses: [], category: '', relatedVerses: [], suggestedTitle: '' };
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle adding a Bible verse manually
  const handleAddVerse = () => {
    if (!verseInput.trim()) return;
    
    // Add verse to the list if it's not already there
    if (!bibleVerses.includes(verseInput)) {
      setBibleVerses([...bibleVerses, verseInput]);
    }
    
    // Clear the input
    setVerseInput('');
  };
  
  // Handle verse click to view full passage
  const handleVerseClick = async (verse: string) => {
    setSelectedVerse(verse);
    setShowVerseModal(true);
    setVerseLoading(true);
    
    try {
      const passageText = await getBiblePassage(verse);
      setVerseText(passageText);
    } catch (error) {
      console.error('Error fetching verse:', error);
      setVerseText('Error loading verse. Please try again.');
    } finally {
      setVerseLoading(false);
    }
  };
  
  // Close verse modal
  const closeVerseModal = () => {
    setShowVerseModal(false);
    setSelectedVerse('');
    setVerseText('');
  };
  
  // Remove a verse from the list
  const removeVerse = (verseToRemove: string) => {
    setBibleVerses(bibleVerses.filter(verse => verse !== verseToRemove));
  };
  
  // Handle saving the entry
  const handleSave = async (
    e?: React.FormEvent | Blob,
    finalTranscription?: string, 
    finalVerses?: string[], 
    finalCategory?: string, 
    finalRelatedVerses?: string[]
  ) => {
    if (e && e instanceof Event) {
      e.preventDefault();
    }
    
    // Use provided values or fall back to state values
    const transcriptionToSave = finalTranscription || transcription;
    const versesToSave = finalVerses || bibleVerses;
    const categoryToSave = finalCategory || category;
    const relatedVersesToSave = finalRelatedVerses || relatedVerses;
    const titleToSave = title;
    
    console.log("💾 Saving entry with data:", {
      transcriptionLength: transcriptionToSave.length,
      versesCount: versesToSave.length,
      category: categoryToSave,
      relatedVersesCount: relatedVersesToSave.length,
      title: titleToSave
    });
    
    setSaving(true);
    setError('');

    // Debug info
    console.log({
      hasAudioBlob: !!audioBlob,
      audioBlobSize: audioBlob?.size,
      hasAudioUrl: !!audioUrl,
      hasRecordedFlag: localStorage.getItem('hasRecordedAudio')
    });
    
    // Use directly provided blob if available, otherwise try state blob
    let blobToUse = e instanceof Blob ? e : audioBlob;
    
    if (!blobToUse && !audioUrl) {
      setError('No audio available to save');
      setSaving(false);
      return;
    } else {
      console.log(`💾 Using ${blobToUse ? 'audio blob' : 'audio URL'} for saving. Blob size: ${blobToUse?.size || 'N/A'}`);
      console.log(`💾 Saving transcription of length: ${transcriptionToSave.length}`);
      console.log(`💾 Saving Bible verses: ${versesToSave.length}, Category: ${categoryToSave}, Related verses: ${relatedVersesToSave.length}`);
    }
    
    try {
      // Update entry data to use directly provided values or state values
      const entryData: Partial<Entry> = {
        title: titleToSave,
        type: 'audio',
        content: transcriptionToSave,
        bibleVerses: versesToSave,
        category: categoryToSave,
        relatedVerses: relatedVersesToSave,
        updatedAt: Timestamp.now(),
      };
      
      console.log("💾 Final entry data:", {
        title: entryData.title,
        contentLength: entryData.content?.length || 0,
        bibleVersesCount: entryData.bibleVerses?.length || 0,
        category: entryData.category,
        relatedVersesCount: entryData.relatedVerses?.length || 0
      });
      
      if (isEditing && entryId) {
        // Update existing entry
        console.log(`💾 Updating existing entry with ID: ${entryId}`);
        await updateEntry(entryId, entryData);
        
        // Upload new audio if changed
        if (blobToUse) {
          console.log("Uploading edited audio recording directly - Blob size:", blobToUse.size, "Type:", blobToUse.type || 'unknown');
          
          // Upload the audio blob directly (no conversion needed)
          const audioUrl = await uploadRecordedAudio(blobToUse, entryId);
          
          if (audioUrl) {
            console.log("Audio uploaded successfully for edited entry:", audioUrl);
          } else {
            console.error("Failed to upload edited audio recording");
          }
        }
        
        setSuccess('Entry updated successfully!');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        // Create new entry
        console.log('💾 Creating new entry');
        
        if (!currentUser) {
          throw new Error('You must be logged in to save');
        }
        
        // Create a new entry object
        const newEntry: Omit<Entry, 'id'> = {
          userId: currentUser.uid,
          title: titleToSave,
          type: 'audio',
          content: transcriptionToSave,
          bibleVerses: versesToSave,
          category: categoryToSave,
          relatedVerses: relatedVersesToSave,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        console.log("Creating new entry in Firestore...");
        
        try {
          // Create the entry in Firestore
          const createdEntry = await createEntry(newEntry);
          
          // Verify we have a valid ID
          if (!createdEntry || !createdEntry.id) {
            throw new Error("Failed to get valid ID from Firestore");
          }
          
          const newEntryId = createdEntry.id;
          console.log("Entry created with ID:", newEntryId);
          
          // Now upload audio to Firebase Storage with the new entry ID
          if (blobToUse && newEntryId) {
            try {
              console.log(`Uploading audio recording for entry ID: ${newEntryId} - Blob size: ${blobToUse.size || 'unknown'}, Type: ${blobToUse.type || 'unknown'}`);
              
              // Make sure blob can be read as data URL (as a fallback approach)
              const reader = new FileReader();
              reader.readAsDataURL(blobToUse);
              
              // Upload the audio blob directly
              let audioUrl = await uploadRecordedAudio(blobToUse, newEntryId);
              
              // If Firebase Storage upload fails, try to use data URL as fallback
              if (!audioUrl) {
                console.warn("Firebase Storage upload failed. Using data URL fallback.");
                
                await new Promise<void>((resolve, reject) => {
                  reader.onloadend = async () => {
                    if (reader.result) {
                      // Use the data URL directly (not ideal but better than nothing)
                      const dataUrl = reader.result as string;
                      console.log("Using data URL fallback, length:", dataUrl.length);
                      
                      try {
                        // Update the entry with the data URL
                        await updateEntry(newEntryId, {
                          audioUrl: dataUrl.substring(0, 100) + "...[truncated]",
                          updatedAt: Timestamp.now(),
                          _audioPath: "data_url_fallback",
                          _recordingType: blobToUse?.type || 'unknown'
                        });
                        audioUrl = dataUrl;
                        console.log("Entry updated with data URL fallback");
                        resolve();
                      } catch (err) {
                        console.error("Failed to update entry with data URL:", err);
                        reject(err);
                      }
                    } else {
                      console.error("Failed to read audio as data URL");
                      reject(new Error("Failed to read audio as data URL"));
                    }
                  };
                  
                  reader.onerror = () => {
                    console.error("Error reading audio blob:", reader.error);
                    reject(reader.error);
                  };
                });
              }
              
              if (audioUrl) {
                console.log("Audio uploaded successfully for new entry:", 
                  typeof audioUrl === 'string' ? (audioUrl.length > 100 ? audioUrl.substring(0, 100) + "..." : audioUrl) : "Unknown format");
              } else {
                console.error("Failed to upload audio recording - no URL returned from either method");
              }
            } catch (audioError) {
              console.error("Error uploading audio:", audioError);
              // Continue without audio, at least the entry is saved
            }
          } else {
            console.error("Missing audio blob or entry ID for upload", {
              hasBlob: !!blobToUse,
              entryId: newEntryId
            });
          }
          
          setSuccess('Entry created successfully!');
          setTimeout(() => {
            navigate('/');
          }, 1500);
        } catch (entryError) {
          console.error("Error creating entry:", entryError);
          setError("Failed to create entry in Firestore. Please try again.");
        }
      }
    } catch (err) {
      console.error('Error saving entry:', err);
      setError('Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Render Bible verses list
  const renderBibleVerses = () => {
    if (bibleVerses.length === 0) return null;
    
    return (
      <div className="mt-4 rounded-md bg-indigo-50 p-4">
        <h3 className="mb-2 font-semibold text-indigo-800">Bible Verses:</h3>
        <div className="flex flex-wrap gap-2">
          {bibleVerses.map((verse, index) => (
            <span key={index} className="rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700">
              {verse}
            </span>
          ))}
        </div>
      </div>
    );
  };
  
  // Render related verses list
  const renderRelatedVerses = () => {
    if (relatedVerses.length === 0) return null;
    
    return (
      <div className="mt-4 rounded-md bg-green-50 p-4">
        <h3 className="mb-2 font-semibold text-green-800">Related Verses:</h3>
        <div className="flex flex-wrap gap-2">
          {relatedVerses.map((verse, index) => (
            <span key={index} className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
              {verse}
            </span>
          ))}
        </div>
      </div>
    );
  };
  
  // Bible Verse Modal Component
  const VerseModal = () => {
    if (!showVerseModal) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="relative max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
          <button
            onClick={closeVerseModal}
            className="absolute right-4 top-4 rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h3 className="mb-4 text-xl font-semibold text-indigo-800">{selectedVerse}</h3>
          {verseLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
            </div>
          ) : (
            <div className="prose prose-indigo max-w-none">
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{verseText}</p>
              <div className="mt-6 flex justify-between items-center border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500">English Standard Version (ESV)</p>
                <button 
                  onClick={() => window.open(`https://www.esv.org/verses/${encodeURIComponent(selectedVerse)}`, '_blank')}
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
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      {/* Verse Modal */}
      <VerseModal />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Audio Entry' : 'New Audio Entry'}
        </h1>
        <p className="text-gray-600">Record your voice and we'll transcribe it for you.</p>
      </div>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-green-800">
          <p>{success}</p>
        </div>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-4">
            <label htmlFor="title" className="mb-1 block font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Enter a title for your audio entry"
            />
          </div>
          
          <AudioRecorder 
            onRecordingComplete={handleRecordingComplete}
            maxDuration={300} // 5 minutes max
            className="mb-4"
          />
          
          {audioUrl && !audioBlob && (
            <div className="mb-4">
              <h3 className="mb-2 font-medium text-gray-700">Existing Audio:</h3>
              <AudioPlayer
                src={audioUrl}
                showFileInfo={true}
              />
            </div>
          )}
          
          <div className="mt-4 flex flex-col space-y-3">
            <button
              onClick={() => handleTranscribe(false)}
              disabled={(!audioBlob && !audioUrl) || isTranscribing}
              className={`flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:bg-gray-400 ${isTranscribing ? 'cursor-not-allowed' : ''}`}
            >
              {isTranscribing ? (
                <>
                  <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Transcribing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Transcribe Audio
                </>
              )}
            </button>
            
            <button
              onClick={() => processWithAI(false)}
              disabled={!transcription || isProcessing}
              className={`flex items-center justify-center rounded-md bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700 disabled:bg-gray-400 ${isProcessing ? 'cursor-not-allowed' : ''}`}
            >
              {isProcessing ? (
                <>
                  <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                  </svg>
                  Process with AI
                </>
              )}
            </button>
            
            <button
              onClick={() => handleSave()}
              disabled={!title || (!audioBlob && !audioUrl) || isSaving}
              className={`flex items-center justify-center rounded-md bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400 ${isSaving ? 'cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <>
                  <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Save Entry
                </>
              )}
            </button>
          </div>
          
          {/* Manual Bible verse input */}
          <div className="mt-6">
            <h3 className="mb-2 font-medium text-gray-700">Add Bible Verses</h3>
            <div className="flex">
              <input
                type="text"
                value={verseInput}
                onChange={(e) => setVerseInput(e.target.value)}
                className="flex-1 rounded-l-md border border-gray-300 p-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. John 3:16"
              />
              <button
                onClick={handleAddVerse}
                className="rounded-r-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                Add
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter verse references like "John 3:16" or "Genesis 1:1-5"
            </p>
          </div>
        </div>
        
        <div>
          <div className="mb-4">
            <label htmlFor="transcription" className="mb-1 block font-medium text-gray-700">
              Transcription
            </label>
            <textarea
              id="transcription"
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="h-40 w-full rounded-md border border-gray-300 p-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Your audio will be transcribed here. You can edit it after transcription."
            />
          </div>
          
          {category && (
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700">Category:</span>
              <span className="ml-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
                {category}
              </span>
            </div>
          )}
          
          {/* Automatic Processing Status */}
          {autoProcessing && (
            <div className="mb-4 rounded-md bg-blue-50 p-3">
              <div className="flex items-center text-blue-700">
                <svg className="mr-2 h-5 w-5 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium">Processing in background...</span>
              </div>
              <p className="mt-1 text-sm text-blue-600">Your audio is being transcribed and analyzed. You can continue working.</p>
            </div>
          )}
          
          {/* Bible Verses List */}
          <div className="mb-4">
            <h3 className="mb-2 font-medium text-gray-700">Bible Verses:</h3>
            <div className="flex flex-wrap gap-2">
              {bibleVerses.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No Bible verses yet. Add manually or use AI processing.</p>
              ) : (
                bibleVerses.map((verse, idx) => (
                  <div key={idx} className="group flex items-center rounded-full bg-indigo-100 px-3 py-1">
                    <span 
                      className="cursor-pointer text-sm text-indigo-700 hover:underline"
                      onClick={() => handleVerseClick(verse)}
                    >
                      {verse}
                    </span>
                    <button 
                      className="ml-2 text-indigo-400 hover:text-indigo-700"
                      onClick={() => removeVerse(verse)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {renderRelatedVerses()}
        </div>
      </div>
    </div>
  );
};

export default AudioEntryEditor; 