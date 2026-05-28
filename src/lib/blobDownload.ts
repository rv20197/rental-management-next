// Fetch a same-origin endpoint that returns a binary attachment and
// trigger a browser download. The session cookie rides along via
// credentials: 'include'. Parses Content-Disposition for the filename
// when present, falling back to the caller-supplied default.
export async function downloadAttachment(path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  let filename = fallbackFilename;
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.indexOf('attachment') !== -1) {
    const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
    if (match?.[1]) filename = match[1].replace(/['"]/g, '');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
