import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Section, Page, MediaItem } from '../types';

interface AppContextType {
  state: AppState;
  activePageId: string | null;
  setActivePageId: (id: string | null) => void;
  addSection: (title: string) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  deleteSection: (sectionId: string) => void;
  addPage: (sectionId: string, title: string) => void;
  updatePageTitle: (pageId: string, title: string) => void;
  deletePage: (sectionId: string, pageId: string) => void;
  reorderPages: (sourceSectionId: string, destinationSectionId: string, sourceIndex: number, destinationIndex: number, pageId: string) => void;
  reorderSections: (sourceIndex: number, destinationIndex: number, sectionId: string) => void;
  addMediaItem: (pageId: string, item: Omit<MediaItem, 'id'>) => void;
  updateMediaItem: (pageId: string, itemId: string, updates: Partial<MediaItem>) => void;
  deleteMediaItem: (pageId: string, itemId: string) => void;
  isLoaded: boolean;
}

const defaultState: AppState = {
  sections: [],
  pages: {},
  sectionOrder: [],
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
        const savedState = await localforage.getItem<any>(STORAGE_KEY);
        if (savedState) {
          // Migration from headers to sections
          if (savedState.headers) {
            savedState.sections = savedState.headers;
            delete savedState.headers;
          }
          if (savedState.headerOrder) {
            savedState.sectionOrder = savedState.headerOrder;
            delete savedState.headerOrder;
          }
          
          setState(savedState as AppState);
          // Set first page as active if possible
          if (savedState.sections.length > 0 && savedState.sections[0].pageIds.length > 0) {
            setActivePageId(savedState.sections[0].pageIds[0]);
          }
        } else {
          // Initialize with a default section and page
          const defaultSectionId = uuidv4();
          const defaultPageId = uuidv4();
          
          const initialState: AppState = {
            sections: [{ id: defaultSectionId, title: 'Default Section', pageIds: [defaultPageId] }],
            pages: {
              [defaultPageId]: {
                id: defaultPageId,
                title: 'Welcome Page',
                mediaItems: []
              }
            },
            sectionOrder: [defaultSectionId]
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

  const addSection = (title: string) => {
    const newSection: Section = { id: uuidv4(), title, pageIds: [] };
    setState(prev => ({
      ...prev,
      sections: [...prev.sections, newSection],
      sectionOrder: [...prev.sectionOrder, newSection.id]
    }));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId ? { ...s, title } : s
      )
    }));
  };

  const deleteSection = (sectionId: string) => {
    setState(prev => {
      const sectionToDelete = prev.sections.find(s => s.id === sectionId);
      if (!sectionToDelete) return prev;

      // Clean up pages
      const newPages = { ...prev.pages };
      sectionToDelete.pageIds.forEach(id => {
        delete newPages[id];
      });

      return {
        ...prev,
        sections: prev.sections.filter(s => s.id !== sectionId),
        sectionOrder: prev.sectionOrder.filter(id => id !== sectionId),
        pages: newPages
      };
    });
    
    // Check if active page was in the deleted section
    setState(prev => {
      if (activePageId && !prev.pages[activePageId]) {
        setActivePageId(null);
      }
      return prev;
    });
  };

  const addPage = (sectionId: string, title: string) => {
    const newPage: Page = { id: uuidv4(), title, mediaItems: [] };
    setState(prev => {
      const newPages = { ...prev.pages, [newPage.id]: newPage };
      const newSections = prev.sections.map(s => {
        if (s.id === sectionId) {
          return { ...s, pageIds: [...s.pageIds, newPage.id] };
        }
        return s;
      });
      return { ...prev, pages: newPages, sections: newSections };
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

  const deletePage = (sectionId: string, pageId: string) => {
    setState(prev => {
      const newSections = prev.sections.map(s => {
        if (s.id === sectionId) {
          return { ...s, pageIds: s.pageIds.filter(id => id !== pageId) };
        }
        return s;
      });
      const newPages = { ...prev.pages };
      delete newPages[pageId];
      return { ...prev, sections: newSections, pages: newPages };
    });
    
    if (activePageId === pageId) {
      setActivePageId(null);
    }
  };

  const reorderPages = (sourceSectionId: string, destinationSectionId: string, sourceIndex: number, destinationIndex: number, pageId: string) => {
    setState(prev => {
      const newSections = [...prev.sections];
      
      const sourceSectionIndex = newSections.findIndex(s => s.id === sourceSectionId);
      const destSectionIndex = newSections.findIndex(s => s.id === destinationSectionId);
      
      const sourceSection = newSections[sourceSectionIndex];
      const destSection = newSections[destSectionIndex];
      
      // Moving within the same section
      if (sourceSectionId === destinationSectionId) {
        const newPageIds = Array.from(sourceSection.pageIds);
        newPageIds.splice(sourceIndex, 1);
        newPageIds.splice(destinationIndex, 0, pageId);
        
        newSections[sourceSectionIndex] = { ...sourceSection, pageIds: newPageIds };
      } else {
        // Moving to a different section
        const sourcePageIds = Array.from(sourceSection.pageIds);
        sourcePageIds.splice(sourceIndex, 1);
        
        const destPageIds = Array.from(destSection.pageIds);
        destPageIds.splice(destinationIndex, 0, pageId);
        
        newSections[sourceSectionIndex] = { ...sourceSection, pageIds: sourcePageIds };
        newSections[destSectionIndex] = { ...destSection, pageIds: destPageIds };
      }
      
      return { ...prev, sections: newSections };
    });
  };

  const reorderSections = (sourceIndex: number, destinationIndex: number, sectionId: string) => {
    setState(prev => {
      const newSectionOrder = Array.from(prev.sectionOrder);
      newSectionOrder.splice(sourceIndex, 1);
      newSectionOrder.splice(destinationIndex, 0, sectionId);
      
      return { ...prev, sectionOrder: newSectionOrder };
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
    addSection,
    updateSectionTitle,
    deleteSection,
    addPage,
    updatePageTitle,
    deletePage,
    reorderPages,
    reorderSections,
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
