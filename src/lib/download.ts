export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function safeFileName(name: string): string {
  return (name.trim() || 'episode').replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase().slice(0, 50) || 'episode';
}
