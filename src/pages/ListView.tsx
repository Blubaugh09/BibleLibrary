import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserEntries, Entry } from '../services/firestore';

const ListView: React.FC = () => {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'type' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  useEffect(() => {
    const fetchEntries = async () => {
      if (currentUser) {
        try {
          const userEntries = await getUserEntries(currentUser.uid);
          setEntries(userEntries);
        } catch (error: any) {
          console.error('Error fetching entries:', error);
          setError("Failed to load entries. Please try again later.");
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchEntries();
  }, [currentUser]);
  
  // Filter entries by type and search query
  const filteredEntries = entries
    .filter(entry => activeFilter === 'all' || entry.type === activeFilter)
    .filter(entry => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      
      return (
        (entry.title && entry.title.toLowerCase().includes(query)) ||
        (entry.description && entry.description.toLowerCase().includes(query)) ||
        (entry.content && typeof entry.content === 'string' && entry.content.toLowerCase().includes(query)) ||
        (entry.category && entry.category.toLowerCase().includes(query)) ||
        (entry.bibleVerses && entry.bibleVerses.some(verse => verse.toLowerCase().includes(query)))
      );
    });
  
  // Sort entries based on sort field and direction
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortField === 'title') {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return sortDirection === 'asc' 
        ? titleA.localeCompare(titleB)
        : titleB.localeCompare(titleA);
    }
    
    if (sortField === 'type') {
      const typeA = (a.type || '').toLowerCase();
      const typeB = (b.type || '').toLowerCase();
      return sortDirection === 'asc'
        ? typeA.localeCompare(typeB)
        : typeB.localeCompare(typeA);
    }
    
    // Sort by date (createdAt)
    const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    
    return sortDirection === 'asc'
      ? dateA.getTime() - dateB.getTime()
      : dateB.getTime() - dateA.getTime();
  });
  
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
  
  // Handle sort header click
  const handleSortClick = (field: 'title' | 'type' | 'createdAt') => {
    if (sortField === field) {
      // Toggle direction if clicking on the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Render sort indicator
  const renderSortIndicator = (field: 'title' | 'type' | 'createdAt') => {
    if (sortField !== field) return null;
    
    return (
      <span className="ml-1 text-gray-500">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
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
  
  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Library List View</h1>
        <Link to="/" className="text-indigo-600 hover:text-indigo-800">
          Back to Card View
        </Link>
      </div>
      
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
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
      
      {/* Entries Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">Error Loading Entries</h3>
          <p className="mt-2 text-gray-500">{error}</p>
        </div>
      ) : sortedEntries.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">No entries found</h3>
          <p className="mt-2 text-gray-500">
            {searchQuery 
              ? "No entries match your search criteria."
              : activeFilter === 'all'
                ? "You haven't created any entries yet."
                : `You don't have any ${activeFilter} entries yet.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSortClick('title')}
                >
                  Title {renderSortIndicator('title')}
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSortClick('type')}
                >
                  Type {renderSortIndicator('type')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Category
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSortClick('createdAt')}
                >
                  Created {renderSortIndicator('createdAt')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Bible Verses
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedEntries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                      {entry.title}
                    </div>
                    {entry.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {entry.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-800">
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {entry.category ? (
                      <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                        {entry.category}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.createdAt ? formatDate(entry.createdAt) : 'Unknown'}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    {entry.bibleVerses && entry.bibleVerses.length > 0 ? (
                      <div className="text-xs text-gray-600 truncate">
                        {entry.bibleVerses.slice(0, 3).join(', ')}
                        {entry.bibleVerses.length > 3 && ` +${entry.bibleVerses.length - 3} more`}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      to={entry.type === 'chat' ? `/chat/${entry.id}` : entry.type === 'pathway' ? `/pathway/${entry.id}` : `/entry/${entry.id}`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      View
                    </Link>
                    <Link
                      to={`/${entry.type}/edit/${entry.id}`}
                      className="text-emerald-600 hover:text-emerald-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 text-sm text-gray-500">
        Showing {sortedEntries.length} of {entries.length} entries
      </div>
    </div>
  );
};

export default ListView; 