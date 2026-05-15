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
    addHeader, 
    addPage, 
    updatePageTitle, 
    deletePage, 
    reorderPages 
  } = useAppContext();
  
  const [collapsedHeaders, setCollapsedHeaders] = useState<Record<string, boolean>>({});
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [width, setWidth] = useState(300);
  const [isOpen, setIsOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [headerModal, setHeaderModal] = useState({ isOpen: false, inputValue: '' });
  
  const { updateAvailable, latestVersion, currentVersion } = useUpdateCheck('therapytools', 'teleshare');

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

  const toggleHeader = (headerId: string) => {
    setCollapsedHeaders(prev => ({
      ...prev,
      [headerId]: !prev[headerId]
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
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

  const handleAddHeaderSubmit = () => {
    if (headerModal.inputValue.trim() !== '') {
      addHeader(headerModal.inputValue.trim());
    }
    setHeaderModal({ isOpen: false, inputValue: '' });
  };

  const handleAddHeader = () => {
    setHeaderModal({ isOpen: true, inputValue: '' });
  };

  const handleAddPage = (headerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    addPage(headerId, 'New Page');
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
              <h2>TeleShare</h2>
              {updateAvailable && (
                <a 
                  href="https://github.com/therapytools/teleshare/releases/latest" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="update-badge"
                  title={`Update to v${latestVersion}`}
                >
                  <Download size={12} /> Update
                </a>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>v{currentVersion}</span>
          </div>
          <div className="sidebar-header-actions">
            <button onClick={handleAddHeader} className="btn-icon" title="Add Header">
              <Plus size={20} />
            </button>
            <button onClick={() => setIsOpen(false)} className="btn-icon" title="Close Sidebar">
              <Menu size={20} />
            </button>
          </div>
        </div>

      <div className="sidebar-content">
        <DragDropContext onDragEnd={handleDragEnd}>
          {state.headerOrder.map(headerId => {
            const header = state.headers.find(h => h.id === headerId);
            if (!header) return null;
            
            const isCollapsed = collapsedHeaders[headerId];

            return (
              <div key={header.id} className="header-group">
                <div 
                  className="header-title" 
                  onClick={() => toggleHeader(header.id)}
                >
                  <div className="header-title-left">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <Folder size={16} className="folder-icon" />
                    <span>{header.title}</span>
                  </div>
                  <button 
                    onClick={(e) => handleAddPage(header.id, e)}
                    className="btn-icon-small"
                    title="Add Page"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {!isCollapsed && (
                  <Droppable droppableId={header.id} type="PAGE">
                    {(provided, snapshot) => (
                      <div
                        className={`page-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {header.pageIds.map((pageId, index) => {
                          const page = state.pages[pageId];
                          if (!page) return null;
                          const isActive = activePageId === page.id;

                          return (
                            <Draggable key={page.id} draggableId={page.id} index={index}>
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
                                            deletePage(header.id, page.id);
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
            );
          })}
        </DragDropContext>
      </div>
      </div>
      <div 
        className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={() => setIsResizing(true)}
      />

      {headerModal.isOpen && (
        <div className="modal-overlay" onClick={() => setHeaderModal({ isOpen: false, inputValue: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Header</h3>
            <input 
              autoFocus
              className="modal-input"
              type="text" 
              placeholder="Header title..." 
              value={headerModal.inputValue}
              onChange={(e) => setHeaderModal(prev => ({ ...prev, inputValue: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddHeaderSubmit(); }}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setHeaderModal({ isOpen: false, inputValue: '' })}>Cancel</button>
              <button className="btn-primary" onClick={handleAddHeaderSubmit}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
