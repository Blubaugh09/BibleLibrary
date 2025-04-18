import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createEntry, updateEntry, getEntryById, Entry } from '../../services/firestore';
import { Timestamp } from 'firebase/firestore';
import { getBiblePassage, chatWithGPT } from '../../services/api';
import MDEditor from '@uiw/react-md-editor';

// Define the structure of a pathway point
interface PathwayPoint {
  id: string;
  title: string;
  description: string;
  primaryVerse: string;
  additionalVerses: string[];
}

interface PathwayEntryEditorProps {
  isEditing?: boolean;
}

const PathwayEntryEditor: React.FC<PathwayEntryEditorProps> = ({ isEditing = false }) => {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [comments, setComments] = useState('');
  const [category, setCategory] = useState('');
  const [verseInput, setVerseInput] = useState('');
  const [bibleVerses, setBibleVerses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // New state for pathway points
  const [pathwayPoints, setPathwayPoints] = useState<PathwayPoint[]>([]);
  
  // Track editor theme state
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('light');

  // Toggle editor theme between light and dark
  const toggleEditorTheme = () => {
    setEditorTheme(editorTheme === 'light' ? 'dark' : 'light');
  };

  // Load existing entry if in edit mode
  useEffect(() => {
    if (isEditing && entryId) {
      setIsLoading(true);
      getEntryById(entryId)
        .then((entry) => {
          if (entry) {
            setTitle(entry.title || '');
            setContent(entry.content || '');
            setComments(entry.description || '');
            setCategory(entry.category || '');
            setBibleVerses(entry.bibleVerses || []);
            
            // Load pathway points if they exist in the content
            try {
              if (entry.content) {
                const contentData = JSON.parse(entry.content);
                if (contentData.pathwayPoints && Array.isArray(contentData.pathwayPoints)) {
                  setPathwayPoints(contentData.pathwayPoints);
                }
              }
            } catch (e) {
              console.error("Error parsing pathway points from content:", e);
              // If parsing fails, keep the content as is
            }
          } else {
            setError('Entry not found');
          }
        })
        .catch((err) => {
          console.error('Error loading entry:', err);
          setError('Failed to load entry');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isEditing, entryId]);

  const handleAddVerse = async () => {
    if (!verseInput.trim()) return;
    
    try {
      // Verify the verse is valid by fetching it
      const verseData = await getBiblePassage(verseInput);
      if (verseData) {
        // Only add if it's not already in the list
        if (!bibleVerses.includes(verseInput)) {
          setBibleVerses([...bibleVerses, verseInput]);
          setVerseInput('');
        } else {
          setError('This verse is already added');
          setTimeout(() => setError(''), 3000);
        }
      } else {
        setError('Invalid verse reference');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error validating verse:', err);
      setError('Failed to validate verse reference');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemoveVerse = (index: number) => {
    const updatedVerses = [...bibleVerses];
    updatedVerses.splice(index, 1);
    setBibleVerses(updatedVerses);
  };
  
  // Define category options
  const categoryOptions = [
    'Person', 'Place', 'Event', 'Object', 'Theme', 'Symbol', 'Prophecy',
    'Teaching', 'Genealogy', 'Covenant', 'Doctrine', 'Practice', 'Virtue/Vice',
    'Group', 'Literary Type', 'Time Period', 'Miracle', 'Relationship'
  ];

  // Generate a unique ID for pathway points
  const generateId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  // Add a new empty pathway point
  const addPathwayPoint = () => {
    const newPoint: PathwayPoint = {
      id: generateId(),
      title: '',
      description: '',
      primaryVerse: '',
      additionalVerses: []
    };
    setPathwayPoints([...pathwayPoints, newPoint]);
  };

  // Update a pathway point
  const updatePathwayPoint = (id: string, field: keyof PathwayPoint, value: any) => {
    const updatedPoints = pathwayPoints.map(point => {
      if (point.id === id) {
        return { ...point, [field]: value };
      }
      return point;
    });
    setPathwayPoints(updatedPoints);
  };

  // Remove a pathway point
  const removePathwayPoint = (id: string) => {
    const updatedPoints = pathwayPoints.filter(point => point.id !== id);
    setPathwayPoints(updatedPoints);
  };

  // Add additional verse to a pathway point
  const addAdditionalVerse = (pointId: string, verse: string) => {
    const updatedPoints = pathwayPoints.map(point => {
      if (point.id === pointId) {
        // Only add if not already included
        if (!point.additionalVerses.includes(verse)) {
          return {
            ...point,
            additionalVerses: [...point.additionalVerses, verse]
          };
        }
      }
      return point;
    });
    setPathwayPoints(updatedPoints);
  };

  // Remove additional verse from a pathway point
  const removeAdditionalVerse = (pointId: string, index: number) => {
    const updatedPoints = pathwayPoints.map(point => {
      if (point.id === pointId) {
        const updatedVerses = [...point.additionalVerses];
        updatedVerses.splice(index, 1);
        return {
          ...point,
          additionalVerses: updatedVerses
        };
      }
      return point;
    });
    setPathwayPoints(updatedPoints);
  };

  // Generate pathway using AI
  const generatePathway = async () => {
    if (!title.trim()) {
      setError('Please enter a title/topic before generating a pathway');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const prompt = `
        I want to create a Bible study pathway about "${title}". 
        Please create a structured study plan with 7-10 key points.
        
        For each point in the pathway, include:
        1. A title for the point/step
        2. A brief description (1-2 sentences)
        3. One primary Bible verse that best illustrates this point
        4. 2-3 additional related Bible verses for further study
        
        Format your response as JSON with this structure:
        {
          "pathwayPoints": [
            {
              "id": "1",
              "title": "Point Title",
              "description": "Brief description of this point",
              "primaryVerse": "John 3:16",
              "additionalVerses": ["Romans 5:8", "1 John 4:9-10"]
            },
            ...more points...
          ]
        }
        
        Make the pathway coherent, starting with foundational concepts and building to deeper understanding.
        Use varied Bible verses from both Old and New Testament where appropriate.
        If specific verses are provided in my query, make sure to include them in the pathway.
      `;

      const response = await chatWithGPT([
        { role: 'system', content: 'You are a helpful assistant specializing in creating Bible study pathways. You respond with well-structured JSON as requested.' },
        { role: 'user', content: prompt }
      ]);

      try {
        // Extract JSON from the response
        const jsonRegex = /{[\s\S]*}/g;
        const jsonMatch = response.content.match(jsonRegex);
        
        if (jsonMatch && jsonMatch[0]) {
          const pathwayData = JSON.parse(jsonMatch[0]);
          
          if (pathwayData.pathwayPoints && Array.isArray(pathwayData.pathwayPoints)) {
            // Add unique IDs to each point
            const pointsWithIds = pathwayData.pathwayPoints.map((point: any) => ({
              ...point,
              id: generateId()
            }));
            
            setPathwayPoints(pointsWithIds);
            
            // Also set the content field to store the JSON data
            setContent(JSON.stringify({ pathwayPoints: pointsWithIds }));
            
            setSuccessMessage('Pathway generated successfully! You can now edit or add to it.');
            setTimeout(() => setSuccessMessage(''), 3000);
          } else {
            throw new Error('Invalid response format');
          }
        } else {
          throw new Error('Could not extract JSON from response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        setError('Failed to parse AI response. Please try again.');
      }
    } catch (err) {
      console.error('Error generating pathway:', err);
      setError('Failed to generate pathway. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in to save');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Store pathway points as JSON in the content field
      const pathwayContent = JSON.stringify({ pathwayPoints });
      
      const entryData: Partial<Entry> = {
        title,
        content: pathwayContent,
        description: comments,
        type: 'pathway',
        category,
        bibleVerses,
        userId: currentUser.uid,
      };
      
      // Only set createdAt when creating a new entry, not when updating
      if (!isEditing) {
        entryData.createdAt = Timestamp.now();
      }
      
      if (isEditing && entryId) {
        await updateEntry(entryId, entryData);
        setSuccessMessage('Pathway updated successfully');
      } else {
        const newEntry = await createEntry(entryData as Entry);
        setSuccessMessage('Pathway created successfully');
      }
      
      // Navigate back after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Error saving pathway:', err);
      setError('Failed to save pathway');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">
        {isEditing ? 'Edit Pathway' : 'Create New Pathway'}
      </h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
          <p>{successMessage}</p>
        </div>
      )}
      
      <div className="mb-6">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Study Topic
        </label>
        <div className="flex">
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter a topic for your Bible study pathway"
            disabled={isLoading || isGenerating}
          />
          <button
            type="button"
            onClick={generatePathway}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isLoading || isGenerating || !title.trim()}
          >
            {isGenerating ? 'Generating...' : 'Generate Pathway'}
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Enter a Bible study topic like "Holy Week", "Beatitudes", or "Armor of God" and click Generate to create a pathway.
        </p>
      </div>
      
      {/* Pathway Builder */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Pathway Builder</h2>
          <button
            type="button"
            onClick={addPathwayPoint}
            className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            disabled={isLoading || isGenerating}
          >
            Add Point
          </button>
        </div>
        
        {pathwayPoints.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">
              {isGenerating 
                ? "Generating your pathway..." 
                : "No pathway points yet. Generate a pathway or add points manually."}
            </p>
          </div>
        ) : (
          <div className="relative pl-8">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-200"></div>
            
            {/* Pathway points */}
            {pathwayPoints.map((point, index) => (
              <div key={point.id} className="mb-8 relative">
                {/* Timeline dot */}
                <div className="absolute -left-8 w-4 h-4 rounded-full bg-indigo-500 z-10 mt-1.5"></div>
                
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                  <div className="flex justify-between items-start mb-3">
                    <input
                      type="text"
                      value={point.title}
                      onChange={(e) => updatePathwayPoint(point.id, 'title', e.target.value)}
                      className="text-lg font-medium text-gray-800 border-b border-dashed border-gray-300 focus:outline-none focus:border-indigo-500 bg-transparent w-full"
                      placeholder="Point title"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => removePathwayPoint(point.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                      disabled={isLoading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <textarea
                        value={point.description}
                        onChange={(e) => updatePathwayPoint(point.id, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Description of this point"
                        rows={3}
                        disabled={isLoading}
                      />
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Primary Verse
                        </label>
                        <input
                          type="text"
                          value={point.primaryVerse}
                          onChange={(e) => updatePathwayPoint(point.id, 'primaryVerse', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="e.g., John 3:16"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Verses
                      </label>
                      
                      <div className="space-y-2">
                        {point.additionalVerses.map((verse, idx) => (
                          <div key={idx} className="flex">
                            <input
                              type="text"
                              value={verse}
                              onChange={(e) => {
                                const updatedVerses = [...point.additionalVerses];
                                updatedVerses[idx] = e.target.value;
                                updatePathwayPoint(point.id, 'additionalVerses', updatedVerses);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="e.g., Romans 5:8"
                              disabled={isLoading}
                            />
                            <button
                              type="button"
                              onClick={() => removeAdditionalVerse(point.id, idx)}
                              className="px-2 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              disabled={isLoading}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        
                        {/* Add new verse input */}
                        <div className="flex">
                          <input
                            type="text"
                            id={`new-verse-${point.id}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Add another verse"
                            disabled={isLoading}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.target as HTMLInputElement;
                                if (input.value.trim()) {
                                  addAdditionalVerse(point.id, input.value.trim());
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`new-verse-${point.id}`) as HTMLInputElement;
                              if (input && input.value.trim()) {
                                addAdditionalVerse(point.id, input.value.trim());
                                input.value = '';
                              }
                            }}
                            className="px-2 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            disabled={isLoading}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            Additional Notes
          </label>
          <button
            type="button"
            onClick={toggleEditorTheme}
            className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
          >
            {editorTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
        <div data-color-mode={editorTheme}>
          <MDEditor
            value={comments}
            onChange={(value) => setComments(value || '')}
            preview="edit"
            height={200}
            className="w-full shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            previewOptions={{
              rehypePlugins: []
            }}
            textareaProps={{
              placeholder: "Add any additional notes or reflections about this pathway...",
              id: "comments",
              disabled: isLoading
            }}
          />
        </div>
      </div>
      
      <div className="mb-6">
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          disabled={isLoading}
        >
          <option value="">Select a category (optional)</option>
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-6">
        <label htmlFor="verse" className="block text-sm font-medium text-gray-700 mb-1">
          Add Related Bible Verses
        </label>
        <div className="flex">
          <input
            type="text"
            id="verse"
            value={verseInput}
            onChange={(e) => setVerseInput(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., John 3:16"
            disabled={isLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddVerse();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddVerse}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isLoading}
          >
            Add
          </button>
        </div>
      </div>
      
      {bibleVerses.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Related Verses:</h3>
          <ul className="space-y-2">
            {bibleVerses.map((verse, index) => (
              <li key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                <span>{verse}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveVerse(index)}
                  className="text-red-600 hover:text-red-800"
                  disabled={isLoading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Pathway'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PathwayEntryEditor; 