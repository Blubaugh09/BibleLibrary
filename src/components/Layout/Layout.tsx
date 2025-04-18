import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  // Check if the current route is login or register
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  
  // Don't show navigation on auth pages
  if (isAuthPage) {
    return <>{children}</>;
  }
  
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-indigo-700 text-white">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link to="/" className="text-xl font-bold">Bible Library</Link>
          
          {/* Mobile menu button */}
          <button 
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          
          {/* Desktop navigation */}
          <nav className="hidden items-center space-x-6 md:flex">
            <Link to="/" className="hover:text-indigo-200">Home</Link>
            <Link to="/chat" className="hover:text-indigo-200">New Chat</Link>
            <div className="flex items-center space-x-2">
              <span className="text-sm">{currentUser?.displayName || currentUser?.email}</span>
              <button 
                onClick={handleSignOut}
                className="rounded-md bg-indigo-800 px-3 py-1.5 text-sm hover:bg-indigo-900"
              >
                Sign Out
              </button>
            </div>
          </nav>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="container mx-auto border-t border-indigo-600 py-2 px-4 md:hidden">
            <nav className="flex flex-col space-y-3">
              <Link to="/" className="py-1 hover:text-indigo-200">Home</Link>
              <Link to="/chat" className="py-1 hover:text-indigo-200">New Chat</Link>
              <div className="flex items-center justify-between border-t border-indigo-600 pt-2">
                <span className="text-sm">{currentUser?.displayName || currentUser?.email}</span>
                <button 
                  onClick={handleSignOut}
                  className="rounded-md bg-indigo-800 px-3 py-1.5 text-sm hover:bg-indigo-900"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="bg-gray-800 py-4 text-center text-sm text-gray-400">
        <div className="container mx-auto">
          &copy; {new Date().getFullYear()} Bible Library. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout; 