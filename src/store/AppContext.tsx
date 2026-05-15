import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Header, Page, MediaItem } from '../types';

interface AppContextType {
  state: AppState;
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  addHeader: (title: string) => void;
  addPage: (headerId: string, title: string) => void;
  updatePageTitle: (pageId: string, title: string) => void;
  deletePage: (headerId: string, pageId: string) => void;
  reorderPages: (sourceHeaderId: string, destinationHeaderId: string, sourceIndex: number, destinationIndex: number, pageId: string) => void;
  addMediaItem: (pageId: string, item: Omit<MediaItem, 'id'>) => void;
  updateMediaItem: (pageId: string, itemId: string, updates: Partial<MediaItem>) => void;
  deleteMediaItem: (pageId: string, itemId: string) => void;
  isLoaded: boolean;
}

const defaultState: AppState = {
  headers: [],
  pages: {},
  headerOrder: [],
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'teleshare-data';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(defaultState);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localforage
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await localforage.getItem<AppState>(STORAGE_KEY);
        if (savedState) {
          setState(savedState);
          // Set first page as active if possible
          if (savedState.headers.length > 0 && savedState.headers[0].pageIds.length > 0) {
            setActivePageId(savedState.headers[0].pageIds[0]);
          }
        } else {
          // Initialize with a default header and page
          const defaultHeaderId = uuidv4();
          const defaultPageId = uuidv4();
          
          const initialState: AppState = {
            headers: [{ id: defaultHeaderId, title: 'Default Header', pageIds: [defaultPageId] }],
            pages: {
              [defaultPageId]: {
                id: defaultPageId,
                title: 'Welcome Page',
                mediaItems: []
              }
            },
            headerOrder: [defaultHeaderId]
          };
          setState(initialState);
          setActivePageId(defaultPageId);
        }
      } catch (error) {
        console.error('Failed to load state from localforage', error);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadState();
  }, []);

  // Save state to localforage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem(STORAGE_KEY, state).catch((err) => {
        console.error('Failed to save state to localforage', err);
      });
    }
  }, [state, isLoaded]);

  const addHeader = (title: string) => {
    const newHeader: Header = { id: uuidv4(), title, pageIds: [] };
    setState(prev => ({
      ...prev,
      headers: [...prev.headers, newHeader],
      headerOrder: [...prev.headerOrder, newHeader.id]
    }));
  };

  const addPage = (headerId: string, title: string) => {
    const newPage: Page = { id: uuidv4(), title, mediaItems: [] };
    setState(prev => {
      const newPages = { ...prev.pages, [newPage.id]: newPage };
      const newHeaders = prev.headers.map(h => {
        if (h.id === headerId) {
          return { ...h, pageIds: [...h.pageIds, newPage.id] };
        }
        return h;
      });
      return { ...prev, pages: newPages, headers: newHeaders };
    });
    setActivePageId(newPage.id);
  };

  const updatePageTitle = (pageId: string, title: string) => {
    setState(prev => ({
      ...prev,
      pages: {
        ...prev.pages,
        [pageId]: { ...prev.pages[pageId], title }
      }
    }));
  };

  const deletePage = (headerId: string, pageId: string) => {
    setState(prev => {
      const newHeaders = prev.headers.map(h => {
        if (h.id === headerId) {
          return { ...h, pageIds: h.pageIds.filter(id => id !== pageId) };
        }
        return h;
      });
      const newPages = { ...prev.pages };
      delete newPages[pageId];
      return { ...prev, headers: newHeaders, pages: newPages };
    });
    
    if (activePageId === pageId) {
      setActivePageId(null);
    }
  };

  const reorderPages = (sourceHeaderId: string, destinationHeaderId: string, sourceIndex: number, destinationIndex: number, pageId: string) => {
    setState(prev => {
      const newHeaders = [...prev.headers];
      
      const sourceHeaderIndex = newHeaders.findIndex(h => h.id === sourceHeaderId);
      const destHeaderIndex = newHeaders.findIndex(h => h.id === destinationHeaderId);
      
      const sourceHeader = newHeaders[sourceHeaderIndex];
      const destHeader = newHeaders[destHeaderIndex];
      
      // Moving within the same header
      if (sourceHeaderId === destinationHeaderId) {
        const newPageIds = Array.from(sourceHeader.pageIds);
        newPageIds.splice(sourceIndex, 1);
        newPageIds.splice(destinationIndex, 0, pageId);
        
        newHeaders[sourceHeaderIndex] = { ...sourceHeader, pageIds: newPageIds };
      } else {
        // Moving to a different header
        const sourcePageIds = Array.from(sourceHeader.pageIds);
        sourcePageIds.splice(sourceIndex, 1);
        
        const destPageIds = Array.from(destHeader.pageIds);
        destPageIds.splice(destinationIndex, 0, pageId);
        
        newHeaders[sourceHeaderIndex] = { ...sourceHeader, pageIds: sourcePageIds };
        newHeaders[destHeaderIndex] = { ...destHeader, pageIds: destPageIds };
      }
      
      return { ...prev, headers: newHeaders };
    });
  };

  const addMediaItem = (pageId: string, item: Omit<MediaItem, 'id'>) => {
    const newItem: MediaItem = { ...item, id: uuidv4() };
    setState(prev => {
      const page = prev.pages[pageId];
      if (!page) return prev;
      
      return {
        ...prev,
        pages: {
          ...prev.pages,
          [pageId]: {
            ...page,
            mediaItems: [...page.mediaItems, newItem]
          }
        }
      };
    });
  };

  const updateMediaItem = (pageId: string, itemId: string, updates: Partial<MediaItem>) => {
    setState(prev => {
      const page = prev.pages[pageId];
      if (!page) return prev;
      
      return {
        ...prev,
        pages: {
          ...prev.pages,
          [pageId]: {
            ...page,
            mediaItems: page.mediaItems.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            )
          }
        }
      };
    });
  };

  const deleteMediaItem = (pageId: string, itemId: string) => {
    setState(prev => {
      const page = prev.pages[pageId];
      if (!page) return prev;
      
      return {
        ...prev,
        pages: {
          ...prev.pages,
          [pageId]: {
            ...page,
            mediaItems: page.mediaItems.filter(item => item.id !== itemId)
          }
        }
      };
    });
  };

  const value = {
    state,
    activePageId,
    setActivePageId,
    addHeader,
    addPage,
    updatePageTitle,
    deletePage,
    reorderPages,
    addMediaItem,
    updateMediaItem,
    deleteMediaItem,
    isLoaded
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
