import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import ChatInterface from './components/Chat/ChatInterface';
import EntriesList from './components/Entries/EntriesList';
import AudioEntryEditor from './components/Entries/AudioEntryEditor';
import EntryDetail from './components/Entries/EntryDetail';
import TextEntryEditor from './components/Entries/TextEntryEditor';
import SongEntryEditor from './components/Entries/SongEntryEditor';
import PoemEntryEditor from './components/Entries/PoemEntryEditor';
import QuoteEntryEditor from './components/Entries/QuoteEntryEditor';
import LinkEntryEditor from './components/Entries/LinkEntryEditor';
import ImageEntryEditor from './components/Entries/ImageEntryEditor';
import PathwayDetailPage from './pages/PathwayDetailPage';
import PathwayEntryEditor from './components/Entries/PathwayEntryEditor';
import ListView from './pages/ListView';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout><EntriesList /></Layout>} />
            <Route path="/list" element={<Layout><ListView /></Layout>} />
            <Route path="/chat" element={<Layout><ChatInterface /></Layout>} />
            <Route path="/chat/:entryId" element={<Layout><ChatInterface /></Layout>} />
            <Route path="/entry/:entryId" element={<Layout><EntryDetail /></Layout>} />
            <Route path="/pathway/:entryId" element={<Layout><PathwayDetailPage /></Layout>} />
            
            {/* Audio Entry routes */}
            <Route path="/audio/new" element={<Layout><AudioEntryEditor /></Layout>} />
            <Route path="/audio/edit/:entryId" element={<Layout><AudioEntryEditor isEditing={true} /></Layout>} />
            
            {/* Text Entry routes */}
            <Route path="/text/new" element={<Layout><TextEntryEditor /></Layout>} />
            <Route path="/text/edit/:entryId" element={<Layout><TextEntryEditor isEditing={true} /></Layout>} />
            
            {/* Song Entry routes */}
            <Route path="/song/new" element={<Layout><SongEntryEditor /></Layout>} />
            <Route path="/song/edit/:entryId" element={<Layout><SongEntryEditor isEditing={true} /></Layout>} />
            
            {/* Poem Entry routes */}
            <Route path="/poem/new" element={<Layout><PoemEntryEditor /></Layout>} />
            <Route path="/poem/edit/:entryId" element={<Layout><PoemEntryEditor isEditing={true} /></Layout>} />
            
            {/* Quote Entry routes */}
            <Route path="/quote/new" element={<Layout><QuoteEntryEditor /></Layout>} />
            <Route path="/quote/edit/:entryId" element={<Layout><QuoteEntryEditor isEditing={true} /></Layout>} />
            
            {/* Link Entry routes */}
            <Route path="/link/new" element={<Layout><LinkEntryEditor /></Layout>} />
            <Route path="/link/edit/:entryId" element={<Layout><LinkEntryEditor isEditing={true} /></Layout>} />
            
            {/* Image Entry routes */}
            <Route path="/image/new" element={<Layout><ImageEntryEditor /></Layout>} />
            <Route path="/image/edit/:entryId" element={<Layout><ImageEntryEditor isEditing={true} /></Layout>} />
            
            {/* Pathway Entry routes */}
            <Route path="/pathway/new" element={<Layout><PathwayEntryEditor /></Layout>} />
            <Route path="/pathway/edit/:entryId" element={<Layout><PathwayEntryEditor isEditing={true} /></Layout>} />
          </Route>
          
          {/* Redirect unknown routes to home */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
