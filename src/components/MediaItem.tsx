import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { Trash2, Maximize2, Download, Link as LinkIcon } from 'lucide-react';
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
      case 'webpage':
        return (
          <iframe 
            src={item.url} 
            title={item.type === 'youtube' ? 'YouTube Video' : 'Webpage Viewer'}
            className={`media-content ${item.type}-content`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onMouseDown={(e) => e.stopPropagation()}
          />
        );
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
            <Maximize2 size={16} />
          </div>
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
            {(item.type === 'image' || item.type === 'video' || item.type === 'pdf') && (
              <button className="context-menu-item" onClick={handleSave}>
                <Download size={16} />
                Save / Download
              </button>
            )}
            {(item.type === 'youtube' || item.type === 'webpage' || item.type === 'image' || item.type === 'video' || item.type === 'pdf') && item.url && (
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
