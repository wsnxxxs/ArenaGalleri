const mediaPath = (value) => typeof value === 'string' && value.trim() ? value : '';

// Prefer the platform's display-only adaptation, then the standard desktop shot, gallery cover,
// and any remaining capture such as mobile. When fullRes is requested (50% zoomed prose/audio),
// prefer the 1440×900 desktop first capture over the half-res 720×450 preview.jpg.
export function screenshotOf(work = {}, { fullRes = false } = {}) {
  const captures = work.captures ?? {};
  const otherCapture = Object.entries(captures).find(([key, value]) => key !== 'first' && mediaPath(value))?.[1];
  if (fullRes && mediaPath(captures.first)) return mediaPath(captures.first);
  return mediaPath(work.previewCapture)
    || mediaPath(captures.first)
    || mediaPath(work.gallery?.[0]?.src)
    || mediaPath(otherCapture);
}

export function hasModelPreview(work = {}) {
  return work.previewMode !== 'screenshot' && Boolean(work.previewModel || work.previewLoader);
}

const DESKTOP_CAPTURE_RE = /(?:^|\/)(?:first|preview)(?:-[a-z0-9]{8,24})?\.(?:jpg|webp)(?:[?#]|$)/i;

export function previewZoomKind(task, src = '') {
  if (!task || !DESKTOP_CAPTURE_RE.test(String(src || ''))) return '';
  if (task.category === '文学') return 'text';
  if (task.category === '音乐') return 'audio';
  return '';
}

export function previewScreenshotOf(task, work = {}) {
  const zoom = task?.category === '文学' || task?.category === '音乐';
  return screenshotOf(work, { fullRes: zoom });
}
