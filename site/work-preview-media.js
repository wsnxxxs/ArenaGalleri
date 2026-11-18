const mediaPath = (value) => typeof value === 'string' && value.trim() ? value : '';

// Prefer the platform's display-only adaptation, then the standard desktop shot, gallery cover,
// and any remaining capture such as mobile.
export function screenshotOf(work = {}) {
  const captures = work.captures ?? {};
  const otherCapture = Object.entries(captures).find(([key, value]) => key !== 'first' && mediaPath(value))?.[1];
  return mediaPath(work.previewCapture)
    || mediaPath(captures.first)
    || mediaPath(work.gallery?.[0]?.src)
    || mediaPath(otherCapture);
}

export function hasModelPreview(work = {}) {
  return work.previewMode !== 'screenshot' && Boolean(work.previewModel || work.previewLoader);
}

const FIRST_CAPTURE_RE = /(?:^|\/)first(?:-[a-z0-9]{8,24})?\.jpg(?:[?#]|$)/i;

export function previewZoomKind(task, src = '') {
  if (!task || !FIRST_CAPTURE_RE.test(String(src || ''))) return '';
  if (task.category === '文学') return 'text';
  if (task.category === '音乐') return 'audio';
  return '';
}
