function guessFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() || 'download';
    return base.split('?')[0] || 'download';
  } catch {
    return 'download';
  }
}

/** Tải file media về máy (ưu tiên blob để có tên file). */
export async function downloadMediaUrl(url: string, filename?: string): Promise<void> {
  const name = filename || guessFilename(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
