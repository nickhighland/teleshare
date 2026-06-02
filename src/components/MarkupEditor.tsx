import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, PenLine, Highlighter, Type, Undo2, Trash2, Check, Palette } from 'lucide-react';
import type { Annotation, AnnotationPoint, AnnotationTool, MediaItem } from '../types';
import { useAppContext } from '../store/AppContext';
import './MarkupEditor.css';

interface MarkupEditorProps {
  item: MediaItem;
  pageId: string;
  onClose: () => void;
}

const toolStyles: Record<AnnotationTool, { color: string; opacity: number; strokeWidth: number; fontSize: number }> = {
  pen: { color: '#f97316', opacity: 1, strokeWidth: 4, fontSize: 18 },
  highlight: { color: '#facc15', opacity: 0.42, strokeWidth: 10, fontSize: 18 },
  text: { color: '#111827', opacity: 1, strokeWidth: 0, fontSize: 18 }
};

const colorOptions = [
  '#f97316',
  '#ef4444',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#111827',
];

const createAnnotation = (tool: AnnotationTool, points: AnnotationPoint[], text?: string): Annotation => ({
  id: uuidv4(),
  tool,
  points,
  text,
  ...toolStyles[tool]
});

const pointFromEvent = (element: HTMLElement, event: React.PointerEvent) => {
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y))
  };
};

const renderPoints = (points: AnnotationPoint[]) => points.map(point => `${point.x},${point.y}`).join(' ');

export const renderAnnotationLayer = (annotations: Annotation[] = [], activeAnnotation?: Annotation | null, interactive = false) => {
  const allAnnotations = activeAnnotation ? [...annotations, activeAnnotation] : annotations;

  return (
    <div className={`annotation-layer ${interactive ? 'interactive' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="annotation-svg">
        {allAnnotations.filter(annotation => annotation.tool !== 'text').map(annotation => (
          <polyline
            key={annotation.id}
            points={renderPoints(annotation.points)}
            fill="none"
            stroke={annotation.color}
            strokeOpacity={annotation.opacity}
            strokeWidth={annotation.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {allAnnotations.filter(annotation => annotation.tool === 'text').map(annotation => {
        const anchor = annotation.points[0];

        return (
          <div
            key={annotation.id}
            className="annotation-text"
            style={{
              left: `${anchor?.x ?? 0}%`,
              top: `${anchor?.y ?? 0}%`,
              color: annotation.color,
              opacity: annotation.opacity,
              fontSize: `${annotation.fontSize ?? 18}px`
            }}
          >
            {annotation.text}
          </div>
        );
      })}
    </div>
  );
};

const MarkupEditor: React.FC<MarkupEditorProps> = ({ item, pageId, onClose }) => {
  const { updateMediaItem } = useAppContext();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draftStrokeRef = useRef<Annotation | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('pen');
  const [annotations, setAnnotations] = useState<Annotation[]>(item.annotations ?? []);
  const [draftText, setDraftText] = useState(item.content ?? '');
  const [textLabel, setTextLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(toolStyles.pen.color);
  const [strokeWidth, setStrokeWidth] = useState(toolStyles.pen.strokeWidth);
  const [persistChanges, setPersistChanges] = useState(true);
  const [currentStroke, setCurrentStroke] = useState<Annotation | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    setAnnotations(item.annotations ?? []);
  }, [item.annotations]);

  useEffect(() => {
    setDraftText(item.content ?? '');
  }, [item.content]);

  useEffect(() => {
    const defaults = toolStyles[tool];
    setSelectedColor(defaults.color);
    setStrokeWidth(defaults.strokeWidth);
  }, [tool]);

  const commitChanges = () => {
    if (persistChanges) {
      updateMediaItem(pageId, item.id, {
        annotations,
        ...(item.type === 'text' ? { content: draftText } : {})
      });
    }
    onClose();
  };

  const surfacePreview = useMemo(() => renderAnnotationLayer(annotations, currentStroke, true), [annotations, currentStroke]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!surfaceRef.current) return;

    const point = pointFromEvent(surfaceRef.current, event);

    if (tool === 'text') {
      const label = textLabel.trim();
      if (!label) {
        return;
      }

      setAnnotations(prev => [
        ...prev,
        {
          ...createAnnotation('text', [point], label.trim()),
          color: selectedColor,
        }
      ]);
      return;
    }

    event.preventDefault();
    surfaceRef.current.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    const stroke = {
      ...createAnnotation(tool, [point]),
      color: selectedColor,
      strokeWidth: strokeWidth,
      opacity: tool === 'highlight' ? 0.42 : 1,
    };
    draftStrokeRef.current = stroke;
    setCurrentStroke(stroke);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !surfaceRef.current || !draftStrokeRef.current) return;

    const point = pointFromEvent(surfaceRef.current, event);
    draftStrokeRef.current = {
      ...draftStrokeRef.current,
      points: [...draftStrokeRef.current.points, point]
    };
    setCurrentStroke(draftStrokeRef.current);
  };

  const finishStroke = (event: React.PointerEvent<HTMLDivElement>) => {
    const finishedStroke = draftStrokeRef.current;

    if (!surfaceRef.current || !finishedStroke) {
      setIsDrawing(false);
      setCurrentStroke(null);
      draftStrokeRef.current = null;
      return;
    }

    if (surfaceRef.current.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId);
    }

    setIsDrawing(false);

    if (finishedStroke.points.length > 1) {
      setAnnotations(prev => [...prev, finishedStroke]);
    }

    draftStrokeRef.current = null;
    setCurrentStroke(null);
  };

  const undoLast = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const clearAll = () => {
    setAnnotations([]);
    setCurrentStroke(null);
    draftStrokeRef.current = null;
  };

  return (
    <div className="markup-backdrop" onClick={onClose}>
      <div className="markup-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="markup-header">
          <div>
            <div className="markup-kicker">Markup Editor</div>
            <h3>{item.type === 'text' ? 'Text note' : item.type.toUpperCase()}</h3>
            <p>Draw, highlight, and label directly on the content.</p>
          </div>
          <button className="markup-close" onClick={onClose} aria-label="Close editor">
            <X size={18} />
          </button>
        </div>

        <div className="markup-toolbar">
          <div className="markup-tool-strip">
            <button className={`markup-tool icon-only ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Draw" aria-label="Draw">
              <PenLine size={14} />
            </button>
            <button className={`markup-tool icon-only ${tool === 'highlight' ? 'active' : ''}`} onClick={() => setTool('highlight')} title="Highlight" aria-label="Highlight">
              <Highlighter size={14} />
            </button>
            <button className={`markup-tool icon-only ${tool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')} title="Text" aria-label="Text">
              <Type size={14} />
            </button>
          </div>

          <div className="markup-inline-controls">
            <div className="markup-inline-group">
              <div className="markup-setting-label compact">
                <Palette size={12} />
                Color
              </div>
              <div className="markup-color-grid compact">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={`markup-color-swatch ${selectedColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </div>

            <label className="markup-inline-group markup-slider-inline">
              <div className="markup-setting-label compact">Width</div>
              <input
                type="range"
                min="1"
                max="24"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.target.value))}
              />
            </label>

            <label className="markup-inline-group markup-text-inline">
              <div className="markup-setting-label compact">Text</div>
              <input
                className="markup-text-input compact"
                type="text"
                value={textLabel}
                onChange={(event) => setTextLabel(event.target.value)}
                placeholder="Label"
              />
            </label>

            <label className="markup-inline-group markup-toggle compact">
              <input
                type="checkbox"
                checked={persistChanges}
                onChange={(event) => setPersistChanges(event.target.checked)}
              />
              Save
            </label>
          </div>

          <div className="markup-toolbar-actions">
            <button className="markup-tool icon-only secondary" onClick={undoLast} disabled={!annotations.length} title="Undo" aria-label="Undo">
              <Undo2 size={14} />
            </button>
            <button className="markup-tool icon-only secondary" onClick={clearAll} disabled={!annotations.length} title="Clear" aria-label="Clear">
              <Trash2 size={14} />
            </button>
            <button className="markup-tool icon-only primary" onClick={commitChanges} title={persistChanges ? 'Save changes' : 'Use for this session'} aria-label={persistChanges ? 'Save changes' : 'Use for this session'}>
              <Check size={14} />
            </button>
          </div>
        </div>

        <div className={`markup-body ${item.type === 'text' ? 'text-layout' : ''}`}>
          {item.type === 'text' && (
            <aside className="markup-notes-panel">
              <label className="markup-notes-label" htmlFor="markup-note-text">Edit note text</label>
              <textarea
                id="markup-note-text"
                className="markup-note-textarea"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                placeholder="Write the note content here..."
              />
            </aside>
          )}

          <div className="markup-stage-shell">
            <div
              ref={surfaceRef}
              className={`markup-stage ${item.type === 'pdf' ? 'pdf-stage' : ''} ${item.type === 'text' ? 'text-stage' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
            >
              {item.type === 'image' && <img src={item.url} alt="Markup target" className="markup-media" draggable="false" />}
              {item.type === 'pdf' && <iframe src={item.url} title="Markup PDF" className="markup-media markup-frame" />}
              {item.type === 'text' && <div className="markup-paper">{draftText || 'Start typing the note content in the sidebar.'}</div>}
              {surfacePreview}
            </div>
          </div>
        </div>

        <div className="markup-footer">
          <button className="markup-tool icon-only secondary" onClick={onClose} title="Discard" aria-label="Discard">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkupEditor;