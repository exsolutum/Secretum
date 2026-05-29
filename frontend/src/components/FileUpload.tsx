import React, { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
  onUpload: (file: { name: string; mime: string; data: string; size: number }) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, disabled }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      onUpload({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        data: btoa(data),
        size: file.size,
      });
    };
    reader.readAsBinaryString(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFile]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <button
        className="btn btn-sm"
        onClick={handleClick}
        disabled={disabled}
        style={{
          fontSize: '14px',
          padding: '4px 8px',
          minWidth: 'auto',
          height: '40px',
        }}
        title="Upload file"
      >
        📎
      </button>
      {dragOver && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 240, 255, 0.1)',
            border: '2px dashed var(--accent-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{
            color: 'var(--accent-cyan)',
            fontSize: '18px',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '4px',
          }}>
            DROP FILE TO ENCRYPT & SEND
          </div>
        </div>
      )}
    </>
  );
};
