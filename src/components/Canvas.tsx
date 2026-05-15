import React, { useRef, useState, useEffect } from 'react';
import { Plus, Image as ImageIcon, Video, FileText as PdfIcon, X, Globe, MonitorPlay, Type } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import MediaItemComponent from './MediaItem';
import './Canvas.css';

const Canvas = () => {
  const { state, activePageId, addMediaItem, updatePageTitle } = useAppContext();
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'image' | 'video' | 'pdf' | null>(null);
  const [urlModal, setUrlModal] = useState<{isOpen: boolean, type: 'webpage' | 'youtube' | null, inputValue: string}>({isOpen: false, type: null, inputValue: ''});

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
            const reader = new FileReader();
            reader.onload = (event) => {
              addMediaItem(activePageId, {
                type: 'image',
                url: event.target?.result as string,
                x: 50,
                y: 50,
                width: 300,
                height: 200
              });
            };
            reader.readAsDataURL(file);
          }
          break; // Only handle the first image pasted
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activePageId, addMediaItem]);

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

    // Use a FileReader to convert the file to a Base64 URL
    // Note: For very large videos/PDFs, this might hit storage limits in IndexedDB.
    // In a real app, we'd upload to a server and return a URL.
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // Default dimensions based on type
      let width = 300;
      let height = 200;
      if (uploadType === 'pdf') {
        width = 600;
        height = 800;
      } else if (uploadType === 'video') {
        width = 480;
        height = 270;
      }

      addMediaItem(activePageId, {
        type: uploadType,
        url: dataUrl,
        x: 50, // Initial default position
        y: 50,
        width,
        height
      });
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

      <div className="canvas-area dot-grid">
        {activePage.mediaItems.map(item => (
          <MediaItemComponent key={item.id} item={item} pageId={activePageId} />
        ))}
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
