import { 
  addDoc, 
  collection, 
  getDocs, 
  getDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

// Interface for conversation messages
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Timestamp;
  audioUrl?: string;  // URL to the audio file for this specific message
  category?: string;
  relatedVerses?: string[];
  bibleVerses?: string[];
}

// Interface for AI conversation history
export interface AIConversation {
  question: string;
  answer: string;
  timestamp: any;
}

// Interface for entry link
export interface EntryLink {
  id?: string;
  sourceEntryId: string;
  targetEntryId: string;
  createdAt?: any;
  userId: string;
}

// Interface for entry data
export interface Entry {
  id?: string;
  title: string;
  type: 'chat' | 'link' | 'video' | 'text' | 'audio' | 'song' | 'poem' | 'quote' | 'twitter' | 'youtube' | 'image' | 'pathway';
  messages?: Message[];
  content?: string;
  description?: string;
  bibleVerses?: string[];
  category?: string;
  relatedVerses?: string[];
  audioUrl?: string | string[];
  imageUrl?: string; // URL to the image file for the entry
  audioSegments?: {
    [key: string]: {
      url: string;
      timestamp: number;
      messageCount: number;
    }
  };
  aiConversations?: AIConversation[]; // Array to store AI conversation history
  createdAt?: any;
  updatedAt?: any;
  userId: string;
  _audioPath?: string;
  _recordingType?: string;
}

// Get all entries for a user
export const getUserEntries = async (userId: string) => {
  try {
    // Try to use the ideal query with sorting by createdAt
    try {
      const q = query(
        collection(db, 'entries'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const entries: Entry[] = [];
      
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as Entry);
      });
      
      return entries;
    } catch (error: any) {
      // If the error is about missing index, use a simpler query without sorting
      if (error.message && error.message.includes('requires an index')) {
        console.log('Falling back to simple query without sorting (index not yet created)');
        
        const simpleQuery = query(
          collection(db, 'entries'),
          where('userId', '==', userId)
        );
        
        const querySnapshot = await getDocs(simpleQuery);
        const entries: Entry[] = [];
        
        querySnapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() } as Entry);
        });
        
        // Sort the entries client-side instead
        return entries.sort((a, b) => {
          // Handle different timestamp formats
          const getTimestamp = (entry: Entry) => {
            if (!entry.createdAt) return 0;
            if (typeof entry.createdAt === 'object' && entry.createdAt.toDate) {
              return entry.createdAt.toDate().getTime();
            }
            return new Date(entry.createdAt).getTime();
          };
          
          return getTimestamp(b) - getTimestamp(a); // Descending order
        });
      }
      
      // If it's a different error, throw it
      throw error;
    }
  } catch (error) {
    console.error('Error fetching entries:', error);
    throw error;
  }
};

// Get a single entry by ID
export const getEntryById = async (entryId: string) => {
  try {
    const entryDoc = await getDoc(doc(db, 'entries', entryId));
    if (entryDoc.exists()) {
      return { id: entryDoc.id, ...entryDoc.data() } as Entry;
    }
    return null;
  } catch (error) {
    console.error('Error fetching entry:', error);
    throw error;
  }
};

// Create a new entry
export const createEntry = async (entry: Entry) => {
  try {
    // Prepare the entry data - remove any existing ID field as Firestore will generate one
    const { id, ...entryWithoutId } = entry;
    
    const entryData = {
      ...entryWithoutId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log("Creating new entry in Firestore with data:", {
      type: entryData.type,
      title: entryData.title,
      userId: entryData.userId,
      hasContent: !!entryData.content,
      hasBibleVerses: !!entryData.bibleVerses && entryData.bibleVerses.length > 0
    });
    
    // Add the document to Firestore
    const docRef = await addDoc(collection(db, 'entries'), entryData);
    console.log("Firestore document created with ID:", docRef.id);
    
    // Create the return object with the new ID
    const createdEntry = { 
      ...entryData, 
      id: docRef.id 
    };
    
    return createdEntry;
  } catch (error) {
    console.error('Error creating entry:', error);
    throw error;
  }
};

// Update an existing entry
export const updateEntry = async (entryId: string, updates: Partial<Entry>) => {
  try {
    const entryRef = doc(db, 'entries', entryId);
    
    // First get the current entry data so we can properly merge audioSegments
    const currentEntry = await getDoc(entryRef);
    const currentData = currentEntry.exists() ? currentEntry.data() : {};
    
    // Special handling for audioSegments to ensure proper merge
    let updateData: any = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    
    // If we're updating audioSegments, merge with existing ones instead of replacing
    if (updates.audioSegments && currentData.audioSegments) {
      updateData.audioSegments = {
        ...currentData.audioSegments,
        ...updates.audioSegments
      };
    }
    
    await updateDoc(entryRef, updateData);
    
    return { id: entryId, ...currentData, ...updates };
  } catch (error) {
    console.error('Error updating entry:', error);
    throw error;
  }
};

// Upload audio file to Firebase Storage and update entry with URL
export const uploadAudio = async (audioBuffer: ArrayBuffer, entryId: string) => {
  try {
    console.log(`Starting audio upload for entry ${entryId}, buffer size: ${audioBuffer.byteLength} bytes`);
    
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.error('Invalid audio buffer - empty or null');
      return null;
    }
    
    if (!entryId) {
      console.error('Missing entryId for audio upload');
      return null;
    }
    
    // Create a more organized file structure with entry ID and timestamp
    const timestamp = new Date().getTime();
    const fileName = `audio/${entryId}/${timestamp}_${uuidv4()}.mp3`;
    console.log(`Generated file name: ${fileName}`);
    
    // Ensure storage reference is valid
    const audioRef = ref(storage, fileName);
    if (!audioRef) {
      console.error('Failed to create storage reference');
      return null;
    }
    
    // Convert ArrayBuffer to Blob
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    console.log(`Created audio blob of size: ${audioBlob.size} bytes`);
    
    if (audioBlob.size === 0) {
      console.error('Created an empty audio blob');
      return null;
    }
    
    // Upload the audio file
    console.log('Uploading audio blob to Firebase Storage...');
    
    try {
      const uploadResult = await uploadBytes(audioRef, audioBlob);
      console.log('Upload complete. Metadata:', uploadResult.metadata);
      
      if (!uploadResult || !uploadResult.metadata) {
        console.error('Upload failed - no metadata returned');
        return null;
      }
      
      // Get the download URL
      console.log('Getting download URL...');
      const downloadUrl = await getDownloadURL(audioRef);
      
      if (!downloadUrl) {
        console.error('Failed to get download URL');
        return null;
      }
      
      console.log('Download URL obtained:', downloadUrl);
      
      // Update the entry with the audio URL
      console.log('Updating entry document with audio URL...');
      
      // Check if the entry exists before updating
      const entryDoc = await getDoc(doc(db, 'entries', entryId));
      if (!entryDoc.exists()) {
        console.error(`Entry ${entryId} does not exist`);
        return downloadUrl; // Still return the URL even if we can't update the entry
      }
      
      await updateDoc(doc(db, 'entries', entryId), {
        audioUrl: downloadUrl,
        updatedAt: serverTimestamp(),
        // Store the original path for reference
        _audioPath: fileName
      });
      console.log('Entry document updated successfully');
      
      return downloadUrl;
    } catch (uploadError) {
      console.error('Error in upload process:', uploadError);
      return null;
    }
  } catch (error) {
    console.error('Error in uploadAudio:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return null;
  }
};

// Upload audio blob directly (specifically for recorded audio)
export const uploadRecordedAudio = async (audioBlob: Blob, entryId: string) => {
  try {
    console.log(`Starting recorded audio upload for entry ${entryId}, blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
    
    if (!audioBlob || audioBlob.size === 0) {
      console.error('Invalid audio blob - empty or null');
      return null;
    }
    
    if (!entryId) {
      console.error('Missing entryId for audio upload');
      return null;
    }
    
    // Validate the entry ID by attempting to get the entry
    try {
      const entryDoc = await getDoc(doc(db, 'entries', entryId));
      if (!entryDoc.exists()) {
        console.error(`Entry ${entryId} does not exist in Firestore before upload`);
        // We'll still try to upload, but this indicates a potential issue
      } else {
        console.log(`Entry ${entryId} exists in Firestore, proceeding with upload`);
      }
    } catch (validateError) {
      console.error('Error validating entry before upload:', validateError);
      // Continue with upload attempt despite validation error
    }
    
    // Get the proper file extension based on MIME type
    let fileExt = 'mp3';
    let contentType = 'audio/mpeg';
    
    if (audioBlob.type === 'audio/webm') {
      fileExt = 'webm';
      contentType = 'audio/webm';
    } else if (audioBlob.type.includes('audio/webm')) {
      fileExt = 'webm';
      contentType = 'audio/webm';
    } else if (audioBlob.type === 'audio/wav') {
      fileExt = 'wav';
      contentType = 'audio/wav';
    } else if (audioBlob.type === 'audio/mp4' || audioBlob.type === 'audio/m4a') {
      fileExt = 'm4a';
      contentType = 'audio/mp4';
    }
    
    // Create a more organized file structure with entry ID and timestamp
    const timestamp = new Date().getTime();
    const fileName = `audio/${entryId}/${timestamp}_recording.${fileExt}`;
    console.log(`Generated file name: ${fileName}`);
    
    // Ensure storage reference is valid
    const storageRef = ref(storage, fileName);
    console.log('Storage reference created:', storageRef.fullPath);
    
    // For debugging - log Firebase config
    console.log('Firebase projectId:', storage.app.options.projectId);
    console.log('Firebase storageBucket:', storage.app.options.storageBucket);
    
    try {
      // Convert blob to File for more detailed upload options
      const file = new File([audioBlob], `recording_${timestamp}.${fileExt}`, { 
        type: contentType,
        lastModified: timestamp
      });
      console.log('Created File object from Blob:', file.name, file.size, file.type);
      
      // Upload with more detailed metadata
      const metadata = {
        contentType: contentType,
        customMetadata: {
          'entryId': entryId,
          'timestamp': timestamp.toString(),
          'source': 'user_recording',
          'originalSize': audioBlob.size.toString(),
          'originalType': audioBlob.type
        }
      };
      
      console.log('Starting upload with metadata:', metadata);
      
      // Upload the file
      const uploadResult = await uploadBytes(storageRef, file, metadata);
      console.log('Upload complete. Metadata:', uploadResult.metadata);
      
      if (!uploadResult || !uploadResult.metadata) {
        console.error('Upload failed - no metadata returned');
        return null;
      }
      
      // Get the download URL with retry logic
      console.log('Getting download URL...');
      let downloadUrl = null;
      let retries = 3;
      
      while (retries > 0 && !downloadUrl) {
        try {
          downloadUrl = await getDownloadURL(storageRef);
          console.log('Successfully got download URL on attempt', 4 - retries);
          break;
        } catch (urlError) {
          console.error(`Error getting download URL (${retries} retries left):`, urlError);
          retries--;
          
          if (retries > 0) {
            console.log('Retrying in 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!downloadUrl) {
        console.error('Failed to get download URL after retries');
        return null;
      }
      
      console.log('Download URL obtained:', downloadUrl.substring(0, 100) + '...');
      
      // Update the entry with the audio URL
      console.log(`Updating entry document ${entryId} with audio URL...`);
      
      // Final validation to make absolutely sure the entry exists
      const finalCheck = await getDoc(doc(db, 'entries', entryId));
      if (!finalCheck.exists()) {
        console.error(`Critical error: Entry ${entryId} does not exist at final check. Cannot update with audio URL.`);
        // Return the URL anyway, so at least it's not lost
        return downloadUrl;
      }
      
      try {
        await updateDoc(doc(db, 'entries', entryId), {
          audioUrl: downloadUrl,
          updatedAt: serverTimestamp(),
          // Store the original path for reference
          _audioPath: fileName,
          _recordingType: audioBlob.type
        });
        console.log('Entry document updated successfully with recording URL');
      } catch (updateError) {
        console.error('Error updating entry document:', updateError);
        return downloadUrl; // Still return the URL even if the document update fails
      }
      
      return downloadUrl;
    } catch (uploadError) {
      console.error('Error in upload process:', uploadError);
      return null;
    }
  } catch (error) {
    console.error('Error in uploadRecordedAudio:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    return null;
  }
};

// Delete an entry
export const deleteEntry = async (entryId: string): Promise<void> => {
  try {
    const entryRef = doc(db, 'entries', entryId);
    await deleteDoc(entryRef);
  } catch (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
};

// Create a link between two entries
export const createEntryLink = async (sourceEntryId: string, targetEntryId: string, userId: string) => {
  try {
    // Check if the link already exists to prevent duplicates
    const existingLinks = await getEntryLinks(sourceEntryId);
    const alreadyLinked = existingLinks.some(link => link.targetEntryId === targetEntryId);
    
    if (alreadyLinked) {
      console.log('Entries are already linked');
      return null;
    }
    
    const linkData: EntryLink = {
      sourceEntryId,
      targetEntryId,
      userId,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'entryLinks'), linkData);
    console.log('Entry link created with ID:', docRef.id);
    
    return { id: docRef.id, ...linkData };
  } catch (error) {
    console.error('Error creating entry link:', error);
    throw error;
  }
};

// Get all links for a specific entry (both as source and target)
export const getAllEntryLinks = async (entryId: string) => {
  try {
    // Get links where this entry is the source
    const sourceQuery = query(
      collection(db, 'entryLinks'),
      where('sourceEntryId', '==', entryId)
    );
    
    // Get links where this entry is the target
    const targetQuery = query(
      collection(db, 'entryLinks'),
      where('targetEntryId', '==', entryId)
    );
    
    const [sourceSnapshot, targetSnapshot] = await Promise.all([
      getDocs(sourceQuery),
      getDocs(targetQuery)
    ]);
    
    const sourceLinks: EntryLink[] = [];
    const targetLinks: EntryLink[] = [];
    
    sourceSnapshot.forEach((doc) => {
      sourceLinks.push({ id: doc.id, ...doc.data() } as EntryLink);
    });
    
    targetSnapshot.forEach((doc) => {
      targetLinks.push({ id: doc.id, ...doc.data() } as EntryLink);
    });
    
    return {
      sourceLinks,
      targetLinks
    };
  } catch (error) {
    console.error('Error fetching entry links:', error);
    throw error;
  }
};

// Get links where the entry is the source
export const getEntryLinks = async (sourceEntryId: string) => {
  try {
    const q = query(
      collection(db, 'entryLinks'),
      where('sourceEntryId', '==', sourceEntryId)
    );
    
    const querySnapshot = await getDocs(q);
    const links: EntryLink[] = [];
    
    querySnapshot.forEach((doc) => {
      links.push({ id: doc.id, ...doc.data() } as EntryLink);
    });
    
    return links;
  } catch (error) {
    console.error('Error fetching entry links:', error);
    throw error;
  }
};

// Delete a link between entries
export const deleteEntryLink = async (linkId: string) => {
  try {
    const linkRef = doc(db, 'entryLinks', linkId);
    await deleteDoc(linkRef);
    console.log('Entry link deleted:', linkId);
    return true;
  } catch (error) {
    console.error('Error deleting entry link:', error);
    throw error;
  }
}; 