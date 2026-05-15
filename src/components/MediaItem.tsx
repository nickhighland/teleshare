import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { Trash2, Maximize2, Minimize2, Download, Link as LinkIcon, Move } from 'lucide-react';
import type { MediaItem } from '../types';
import { useAppContext } from '../store/AppContext';
import './MediaItem.css';

interface MediaItemProps {
  item: MediaItem;
  pageId: string;
}

const MediaItemComponent: React.FC<MediaItemProps> = ({ item, pageId }) => {
  const { updateMediaItem, deleteMediaItem } = useAppContext();
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clientX: number, clientY: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  React.useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    document.addEventListener('click', hideMenu);
    return () => document.removeEventListener('click', hideMenu);
  }, []);

  const handleDragStop = (_e: any, d: { x: number, y: number }) => {
    updateMediaItem(pageId, item.id, { x: d.x, y: d.y });
  };

  const handleResizeStop = (_e: any, _direction: any, ref: any, _delta: any, position: { x: number, y: number }) => {
    updateMediaItem(pageId, item.id, {
      width: ref.style.width,
      height: ref.style.height,
      ...position
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY
    });
  };

  const handleSave = () => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `teleshare-${item.type}-${Date.now()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setContextMenu(null);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(item.url).then(() => {
      // Optional: Could add a small toast notification here
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
    setContextMenu(null);
  };

  const renderContent = () => {
    switch (item.type) {
      case 'image':
        return <img src={item.url} alt="Media" className="media-content image-content" draggable="false" />;
      case 'video':
        return (
          <video 
            src={item.url} 
            controls 
            className="media-content video-content"
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking controls
          />
        );
      case 'pdf':
        return (
          <iframe 
            src={item.url} 
            title="PDF Viewer"
            className="media-content pdf-content"
            onMouseDown={(e) => e.stopPropagation()} // Let user interact with PDF
          />
        );
      case 'youtube':
        return (
          <iframe 
            src={item.url} 
            title="YouTube Video"
            className={`media-content ${item.type}-content`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onMouseDown={(e) => e.stopPropagation()}
          />
        );
      case 'webpage':
        // use standard iframe if not in electron (e.g. dev browser preview), otherwise use webview
        const isElectron = typeof window !== 'undefined' && window.api?.isElectron;
        if (isElectron) {
          // React typings don't include webview by default, we cast it or use it as any
          const Webview = 'webview' as any;
          return (
            <Webview 
              src={item.url} 
              className={`media-content ${item.type}-content`}
              onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
            />
          );
        } else {
          return (
            <iframe 
              src={item.url} 
              title="Webpage Viewer"
              className={`media-content ${item.type}-content`}
              allowFullScreen
              onMouseDown={(e) => e.stopPropagation()}
            />
          );
        }
      case 'text':
        return (
          <textarea
            className="media-content text-content"
            value={item.content || ''}
            onChange={(e) => updateMediaItem(pageId, item.id, { content: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Type your notes here..."
          />
        );
      default:
        return <div>Unknown media type</div>;
    }
  };

  if (isFullscreen) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button 
          onClick={() => setIsFullscreen(false)} 
          style={{ position: 'absolute', top: 20, right: 20, zIndex: 10000, background: 'var(--bg-primary)', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex' }}
          title="Exit Full Screen"
        >
          <Minimize2 size={24} color="var(--text-primary)" />
        </button>
        <div style={{ width: '90%', height: '90%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: item.width, height: item.height }}
      position={{ x: item.x, y: item.y }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      className={`media-item-container ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      dragHandleClassName="drag-handle"
      minWidth={150}
      minHeight={150}
    >
      <div className="media-wrapper" onContextMenu={handleContextMenu}>
        <div className={`media-toolbar ${isHovered ? 'visible' : ''}`}>
          <div className="drag-handle" title="Drag to move">
            <Move size={16} />
          </div>
          <button 
            className="full-screen-btn action-btn" 
            onClick={() => setIsFullscreen(true)}
            title="Full Screen"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            className="delete-media-btn" 
            onClick={() => deleteMediaItem(pageId, item.id)}
            title="Delete media"
          >
            <Trash2 size={16} />
          </button>
        </div>
        
        {/* Iframe-based media need an overlay when dragging so iframe doesn't steal mouse events */}
        {(item.type === 'pdf' || item.type === 'webpage' || item.type === 'youtube') && (
          <div className="iframe-drag-overlay drag-handle"></div>
        )}
        
        {renderContent()}

        {contextMenu && (
          <div 
            className="context-menu" 
            style={{ 
              position: 'fixed',
              left: contextMenu.clientX, 
              top: contextMenu.clientY,
              zIndex: 10000 
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {(item.type === 'image' || item.type === 'video' || item.type === 'pdf' || item.type === 'text') && (
              <button className="context-menu-item" onClick={handleSave}>
                <Download size={16} />
                Save / Download
              </button>
            )}
            {(item.type === 'youtube' || item.type === 'webpage') && item.url && (
              <button className="context-menu-item" onClick={handleCopyLink}>
                <LinkIcon size={16} />
                Copy Link
              </button>
            )}
          </div>
        )}
      </div>
    </Rnd>
  );
};

export default MediaItemComponent;
