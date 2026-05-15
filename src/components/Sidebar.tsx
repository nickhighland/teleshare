import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, Edit2, FileText, ChevronDown, ChevronRight, Folder, Menu, Download } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import './Sidebar.css';

const Sidebar = () => {
  const { 
    state, 
    activePageId, 
    setActivePageId, 
    addSection, 
    addPage, 
    updatePageTitle, 
    deletePage, 
    reorderPages,
    reorderSections,
    updateSectionTitle,
    deleteSection
  } = useAppContext();
  
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState('');
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  
  const [width, setWidth] = useState(300);
  const [isOpen, setIsOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [sectionModal, setSectionModal] = useState({ isOpen: false, inputValue: '' });
  
  const { updateAvailable, latestVersion, currentVersion } = useUpdateCheck('nickhighland', 'teleshare');

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(200, e.clientX), 600);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    // Check if we're running in Electron
    const isElectron = typeof window !== 'undefined' && (window as any).require;
    if (!isElectron) return;

    try {
      const { ipcRenderer } = (window as any).require('electron');
      
      const onProgress = (_: any, progress: number) => setDownloadProgress(progress);
      const onComplete = () => {
        setIsDownloading(false);
        setDownloadProgress(100);
      };
      const onError = (_: any, error: string) => {
        setIsDownloading(false);
        setDownloadError(error);
      };

      ipcRenderer.on('download-progress', onProgress);
      ipcRenderer.on('download-complete', onComplete);
      ipcRenderer.on('download-error', onError);

      return () => {
        ipcRenderer.removeListener('download-progress', onProgress);
        ipcRenderer.removeListener('download-complete', onComplete);
        ipcRenderer.removeListener('download-error', onError);
      };
    } catch (e) {
      console.warn('Failed to setup IPC listeners:', e);
    }
  }, []);

  const handleUpdateClick = () => {
    const isElectron = typeof window !== 'undefined' && (window as any).require;
    if (isElectron && latestVersion) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        let url = '';
        if ((window as any).process?.platform === 'win32') {
          url = `https://github.com/nickhighland/teleshare/releases/download/v${latestVersion}/TeleShare-Setup-${latestVersion}.exe`;
        } else {
          url = `https://github.com/nickhighland/teleshare/releases/download/v${latestVersion}/TeleShare-${latestVersion}-arm64-mac.zip`;
        }
        ipcRenderer.send('start-download', url);
        setIsDownloading(true);
        setDownloadError(null);
        setDownloadProgress(0);
        return;
      } catch (e) {
        console.warn('Failed to send IPC message:', e);
      }
    }
    // Fallback if not in Electron or IPC fails
    window.open('https://github.com/nickhighland/teleshare/releases/latest', '_blank');
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === 'SECTION') {
      reorderSections(source.index, destination.index, draggableId);
      return;
    }

    reorderPages(
      source.droppableId,
      destination.droppableId,
      source.index,
      destination.index,
      draggableId
    );
  };

  const handleAddSectionSubmit = () => {
    if (sectionModal.inputValue.trim() !== '') {
      addSection(sectionModal.inputValue.trim());
    }
    setSectionModal({ isOpen: false, inputValue: '' });
  };

  const handleAddSection = () => {
    setSectionModal({ isOpen: true, inputValue: '' });
  };

  const handleAddPage = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    addPage(sectionId, 'New Page');
  };

  const startEdit = (pageId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPageId(pageId);
    setEditTitle(currentTitle);
  };

  const saveEdit = (pageId: string) => {
    if (editTitle.trim() !== '') {
      updatePageTitle(pageId, editTitle.trim());
    }
    setEditingPageId(null);
  };

  const startSectionEdit = (sectionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSectionId(sectionId);
    setEditSectionTitle(currentTitle);
  };

  if (!isOpen) {
    return (
      <div className="sidebar-collapsed">
        <button onClick={() => setIsOpen(true)} className="btn-icon" title="Open Sidebar">
          <Menu size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-wrapper" style={{ width: `${width}px` }}>
      <div className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src="./icon.png" alt="TeleShare Logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />
              <h2>TeleShare</h2>
              {updateAvailable && !isDownloading && (
                <button 
                  onClick={handleUpdateClick}
                  className="update-badge btn-icon-small"
                  title={`Update to v${latestVersion}`}
                  style={{ width: 'auto', padding: '0 8px', height: '20px', borderRadius: '10px', opacity: 1, backgroundColor: 'var(--accent-color)', color: 'white' }}
                >
                  <Download size={12} /> Update
                </button>
              )}
              {isDownloading && (
                <span className="update-badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  Downloading {downloadProgress !== null ? `${downloadProgress}%` : '...'}
                </span>
              )}
              {downloadError && (
                <span className="update-badge" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>
                  Error: {downloadError}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>v{currentVersion}</span>
          </div>
          <div className="sidebar-header-actions">
            <button onClick={handleAddSection} className="btn-icon" title="Add Section">
              <Plus size={20} />
            </button>
            <button onClick={() => setIsOpen(false)} className="btn-icon" title="Close Sidebar">
              <Menu size={20} />
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="all-sections" type="SECTION">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {state.sectionOrder.map((sectionId, index) => {
                    const section = state.sections.find(s => s.id === sectionId);
                    if (!section) return null;
                    
                    const isCollapsed = collapsedSections[sectionId];

                    return (
                      <Draggable key={section.id} draggableId={section.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`header-group ${snapshot.isDragging ? 'dragging-section' : ''}`}
                          >
                            <div 
                              className="header-title" 
                              onClick={() => toggleSection(section.id)}
                              {...provided.dragHandleProps}
                            >
                              <div className="header-title-left">
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                <Folder size={16} className="folder-icon" />
                                {editingSectionId === section.id ? (
                                  <input
                                    autoFocus
                                    className="section-edit-input"
                                    value={editSectionTitle}
                                    onChange={(e) => setEditSectionTitle(e.target.value)}
                                    onBlur={() => {
                                      if (editSectionTitle.trim() !== '') updateSectionTitle(section.id, editSectionTitle.trim());
                                      setEditingSectionId(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (editSectionTitle.trim() !== '') updateSectionTitle(section.id, editSectionTitle.trim());
                                        setEditingSectionId(null);
                                      }
                                      if (e.key === 'Escape') setEditingSectionId(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span>{section.title}</span>
                                )}
                              </div>
                              <div className="section-actions" style={{ display: 'flex', gap: '0.25rem' }}>
                                <button 
                                  onClick={(e) => startSectionEdit(section.id, section.title, e)}
                                  className="btn-icon-small"
                                  title="Edit Section"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this section and all its pages?')) {
                                      deleteSection(section.id);
                                    }
                                  }}
                                  className="btn-icon-small delete"
                                  title="Delete Section"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => handleAddPage(section.id, e)}
                                  className="btn-icon-small"
                                  title="Add Page"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>

                            {!isCollapsed && (
                              <Droppable droppableId={section.id} type="PAGE">
                                {(provided, snapshot) => (
                                  <div
                                    className={`page-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                  >
                                    {section.pageIds.map((pageId, pageIndex) => {
                                      const page = state.pages[pageId];
                                      if (!page) return null;
                                      const isActive = activePageId === page.id;

                                      return (
                                        <Draggable key={page.id} draggableId={page.id} index={pageIndex}>
                                          {(provided, snapshot) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              {...provided.dragHandleProps}
                                              className={`page-item ${isActive ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                                              onClick={() => setActivePageId(page.id)}
                                            >
                                              {editingPageId === page.id ? (
                                                <div className="page-edit-mode">
                                                  <input
                                                    autoFocus
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    onBlur={() => saveEdit(page.id)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') saveEdit(page.id);
                                                      if (e.key === 'Escape') setEditingPageId(null);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                  />
                                                </div>
                                              ) : (
                                                <>
                                                  <div className="page-item-content">
                                                    <FileText size={14} className="file-icon" />
                                                    <span className="page-name">{page.title}</span>
                                                  </div>
                                                  <div className="page-actions">
                                                    <button 
                                                      onClick={(e) => startEdit(page.id, page.title, e)}
                                                      className="action-btn"
                                                      title="Edit Title"
                                                    >
                                                      <Edit2 size={12} />
                                                    </button>
                                                    <button 
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        deletePage(section.id, page.id);
                                                      }}
                                                      className="action-btn delete"
                                                      title="Delete Page"
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
      
      <div 
        className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={() => setIsResizing(true)}
      />

      {sectionModal.isOpen && (
        <div className="modal-overlay" onClick={() => setSectionModal({ isOpen: false, inputValue: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Section</h3>
            <input 
              autoFocus
              className="modal-input"
              type="text" 
              placeholder="Section title..." 
              value={sectionModal.inputValue}
              onChange={(e) => setSectionModal(prev => ({ ...prev, inputValue: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSectionSubmit(); }}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setSectionModal({ isOpen: false, inputValue: '' })}>Cancel</button>
              <button className="btn-primary" onClick={handleAddSectionSubmit}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
