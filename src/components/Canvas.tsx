import React, { useRef, useState, useEffect } from 'react';
import { Plus, Image as ImageIcon, Video, FileText as PdfIcon, X, Globe, MonitorPlay, Type, ClipboardPaste } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import MediaItemComponent from './MediaItem';
import './Canvas.css';

const Canvas = () => {
  const { state, activePageId, addMediaItem, updatePageTitle } = useAppContext();
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'image' | 'video' | 'pdf' | null>(null);
  const [urlModal, setUrlModal] = useState<{isOpen: boolean, type: 'webpage' | 'youtube' | null, inputValue: string}>({isOpen: false, type: null, inputValue: ''});
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clientX: number, clientY: number } | null>(null);

  const processFile = (file: File, x: number = 50, y: number = 50) => {
    if (!activePageId) return;
    
    let type: 'image' | 'video' | 'pdf' | null = null;
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type === 'application/pdf') type = 'pdf';
    
    if (!type) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      let width = 300;
      let height = 200;
      if (type === 'pdf') {
        width = 600;
        height = 800;
      } else if (type === 'video') {
        width = 480;
        height = 270;
      }

      addMediaItem(activePageId, {
        type,
        url: dataUrl,
        x,
        y,
        width,
        height
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (!activePageId) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file, 50, 50);
          }
          break; // Only handle the first image pasted
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activePageId, addMediaItem]);

  // Hide context menu on outside click
  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    document.addEventListener('click', hideMenu);
    return () => document.removeEventListener('click', hideMenu);
  }, []);

  if (!activePageId) {
    return (
      <div className="canvas empty-state">
        <div className="empty-state-content">
          <ImageIcon size={48} className="empty-icon" />
          <h3>No Page Selected</h3>
          <p>Select a page from the sidebar or create a new one to get started.</p>
        </div>
      </div>
    );
  }

  const activePage = state.pages[activePageId];

  if (!activePage) {
    return <div className="canvas empty-state">Page not found.</div>;
  }

  const handleAddMedia = (type: 'image' | 'video' | 'pdf') => {
    setUploadType(type);
    if (fileInputRef.current) {
      if (type === 'image') fileInputRef.current.accept = 'image/*';
      if (type === 'video') fileInputRef.current.accept = 'video/*';
      if (type === 'pdf') fileInputRef.current.accept = 'application/pdf';
      fileInputRef.current.click();
    }
    setShowMenu(false);
  };

  const openUrlModal = (type: 'webpage' | 'youtube') => {
    setUrlModal({ isOpen: true, type, inputValue: '' });
    setShowMenu(false);
  };

  const handleUrlSubmit = () => {
    const { type, inputValue } = urlModal;
    if (!type || !inputValue.trim()) return;
    
    let finalUrl = inputValue.trim();
    
    if (type === 'youtube') {
      let videoId = '';
      if (finalUrl.includes('youtu.be/')) {
        videoId = finalUrl.split('youtu.be/')[1]?.split('?')[0];
      } else if (finalUrl.includes('watch?v=')) {
        try {
          videoId = new URL(finalUrl).searchParams.get('v') || '';
        } catch (e) {
          // Invalid URL format
        }
      } else if (finalUrl.includes('embed/')) {
        videoId = finalUrl.split('embed/')[1]?.split('?')[0];
      }
      
      if (videoId) {
        finalUrl = `https://www.youtube.com/embed/${videoId}`;
      }
    } else if (type === 'webpage') {
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
    }

    addMediaItem(activePageId, {
      type,
      url: finalUrl,
      x: 50,
      y: 50,
      width: 560,
      height: 315
    });

    setUrlModal({ isOpen: false, type: null, inputValue: '' });
  };

  const handleAddText = () => {
    addMediaItem(activePageId, {
      type: 'text',
      url: '',
      content: 'New Text Note',
      x: 50,
      y: 50,
      width: 300,
      height: 200
    });
    setShowMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;
    
    processFile(file, 50, 50);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => processFile(file, x, y));
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Only show context menu on canvas itself, not on media items
    if ((e.target as HTMLElement).classList.contains('canvas-area') || (e.target as HTMLElement).classList.contains('dot-grid')) {
      e.preventDefault();
      const canvasRect = e.currentTarget.getBoundingClientRect();
      setContextMenu({
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top,
        clientX: e.clientX,
        clientY: e.clientY
      });
    }
  };

  const handleContextMenuPaste = async () => {
    if (!contextMenu) return;
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
        for (const imageType of imageTypes) {
          const blob = await clipboardItem.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          processFile(file, contextMenu.x, contextMenu.y);
          break;
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert('Unable to read clipboard. You may need to grant clipboard permissions to the browser, or try using Ctrl+V / Cmd+V instead.');
    }
    setContextMenu(null);
  };

  return (
    <div className="canvas">
      <div className="canvas-header">
        <input 
          className="canvas-title-input"
          value={activePage.title}
          onChange={(e) => updatePageTitle(activePage.id, e.target.value)}
          placeholder="Page Title"
        />
      </div>

      <div 
        className={`canvas-area dot-grid ${isDraggingOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
      >
        {isDraggingOver && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              <Plus size={48} />
              <h2>Drop Files Here</h2>
            </div>
          </div>
        )}
        
        {activePage.mediaItems.map(item => (
          <MediaItemComponent key={item.id} item={item} pageId={activePageId} />
        ))}
        
        {contextMenu && (
          <div 
            className="context-menu" 
            style={{ left: contextMenu.clientX, top: contextMenu.clientY }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="context-menu-item" onClick={handleContextMenuPaste}>
              <ClipboardPaste size={16} />
              Paste Image
            </button>
          </div>
        )}
      </div>

      <div className="floating-action-button">
        {showMenu && (
          <div className="fab-menu">
            <button className="fab-item" onClick={() => handleAddMedia('image')}>
              <ImageIcon size={18} />
              <span>Image</span>
            </button>
            <button className="fab-item" onClick={() => handleAddMedia('video')}>
              <Video size={18} />
              <span>Video</span>
            </button>
            <button className="fab-item" onClick={() => handleAddMedia('pdf')}>
              <PdfIcon size={18} />
              <span>PDF</span>
            </button>
            <button className="fab-item" onClick={() => openUrlModal('webpage')}>
              <Globe size={18} />
              <span>Webpage</span>
            </button>
            <button className="fab-item" onClick={() => openUrlModal('youtube')}>
              <MonitorPlay size={18} />
              <span>YouTube</span>
            </button>
            <button className="fab-item" onClick={() => handleAddText()}>
              <Type size={18} />
              <span>Text Note</span>
            </button>
          </div>
        )}
        <button 
          className={`fab-main ${showMenu ? 'active' : ''}`}
          onClick={() => setShowMenu(!showMenu)}
        >
          {showMenu ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />

      {urlModal.isOpen && (
        <div className="modal-overlay" onClick={() => setUrlModal({ isOpen: false, type: null, inputValue: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add {urlModal.type === 'youtube' ? 'YouTube Video' : 'Webpage'}</h3>
            {urlModal.type === 'webpage' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>
                Note: Many major websites explicitly block embedding for security reasons. If the page refuses to connect, it is restricted by the website itself.
              </p>
            )}
            <input 
              autoFocus
              className="modal-input"
              type="text" 
              placeholder="Paste URL here..." 
              value={urlModal.inputValue}
              onChange={(e) => setUrlModal(prev => ({ ...prev, inputValue: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setUrlModal({ isOpen: false, type: null, inputValue: '' })}>Cancel</button>
              <button className="btn-primary" onClick={handleUrlSubmit}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
