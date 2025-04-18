import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getEntryById, Entry } from '../../services/firestore';
import {
  LinkEntry,
  VideoEntry,
  TextEntry,
  AudioEntry,
  SongEntry,
  PoemEntry,
  QuoteEntry,
  TwitterEntry,
  YouTubeEntry,
  ImageEntry
} from './BlankEntryComponents';

const EntryDetail: React.FC = () => {
  const { entryId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
        
        setEntry(loadedEntry);
      } catch (err) {
        console.error('Error fetching entry:', err);
        setError('Failed to load entry');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntry();
  }, [entryId, currentUser, navigate]);
  
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
  
  // Render the appropriate component based on entry type
  switch (entry.type) {
    case 'chat':
      navigate(`/chat/${entryId}`);
      return null;
    case 'pathway':
      navigate(`/pathway/${entryId}`);
      return null;
    case 'link':
      return <LinkEntry entry={entry} />;
    case 'video':
      return <VideoEntry entry={entry} />;
    case 'text':
      return <TextEntry entry={entry} />;
    case 'audio':
      return <AudioEntry entry={entry} />;
    case 'song':
      return <SongEntry entry={entry} />;
    case 'poem':
      return <PoemEntry entry={entry} />;
    case 'quote':
      return <QuoteEntry entry={entry} />;
    case 'twitter':
      return <TwitterEntry entry={entry} />;
    case 'youtube':
      return <YouTubeEntry entry={entry} />;
    case 'image':
      return <ImageEntry entry={entry} />;
    default:
      return (
        <div className="flex h-screen flex-col bg-gray-50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">{entry.title}</h2>
            <p className="text-gray-600">
              This entry type ({entry.type}) is not currently supported.
            </p>
          </div>
        </div>
      );
  }
};

export default EntryDetail; 