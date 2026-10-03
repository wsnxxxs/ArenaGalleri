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
