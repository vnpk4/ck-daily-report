import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Lightbox({ image, images = [], onClose, onSelectImage }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setScale(1);
    setRotation(0);
  }, [image]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, images]);

  if (!image) return null;

  const currentIndex = images.findIndex((img) => img.id === image.id);

  const handleNext = () => {
    if (images.length > 1 && currentIndex < images.length - 1) {
      onSelectImage(images[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (images.length > 1 && currentIndex > 0) {
      onSelectImage(images[currentIndex - 1]);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="lightbox-modal" onClick={onClose}>
      {/* Top Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
          zIndex: 160
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: '#fff', fontSize: '0.9rem' }}>
          <strong>{image.original_name}</strong>
          {image.file_size && (
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
              ({formatSize(image.file_size)})
            </span>
          )}
          {images.length > 1 && (
            <span style={{ color: 'var(--primary)', marginLeft: '0.75rem', fontWeight: 600 }}>
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: '50%' }}
            title="Thu nhỏ"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            <ZoomOut size={16} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: '50%' }}
            title="Phóng to"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: '50%' }}
            title="Xoay ảnh"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw size={16} />
          </button>
          <a
            href={image.url}
            download={image.original_name}
            className="btn btn-secondary"
            style={{ padding: '0.45rem', borderRadius: '50%' }}
            title="Tải ảnh này về"
          >
            <Download size={16} />
          </a>
          <button
            className="btn btn-danger"
            style={{ padding: '0.45rem', borderRadius: '50%', marginLeft: '0.5rem' }}
            title="Đóng"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          style={{
            position: 'absolute',
            left: '1.5rem',
            zIndex: 160,
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          style={{
            position: 'absolute',
            right: '1.5rem',
            zIndex: 160,
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Main Image View */}
      <div className="lightbox-img-wrapper" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.url}
          alt={image.original_name}
          className="lightbox-img"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`
          }}
        />
      </div>
    </div>
  );
}
