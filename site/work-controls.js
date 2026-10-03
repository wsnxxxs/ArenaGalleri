// Compare frames share the content server's fold script and parent-message protocol.
// Curated works stay untouched on disk; only their current comparison document is injected.
import { fetchApi } from './platform-api.js';

let foldScript;
function scriptSource() {
  foldScript ??= fetchApi('fold.js').then((response) => {
    if (!response.ok) throw new Error('Fold script unavailable');
    return response.text();
  }).catch((error) => { foldScript = null; throw error; });
  return foldScript;
}

export function workFrameUrl(scene, query = '', fold = false) {
  const url = new URL(scene, document.baseURI);
  for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
  // Other opt-ins, such as aob=bridge, can coexist with folding.
  if (fold && !url.searchParams.getAll('aob').includes('fold')) url.searchParams.append('aob', 'fold');
  return url.href;
}

export function createWorkControls(onChange) {
  const frames = new Map();
  let folded = true;
  const notify = () => onChange({ folded, count: [...frames.values()].reduce((sum, item) => sum + item.count, 0) });
  const send = (frame, item, fold = folded) => frame.contentWindow?.postMessage({ source: 'sp-arena', fold }, item.origin);
  const onMessage = (event) => {
    if (event.data?.source !== 'sp-fold' || !Number.isInteger(event.data.count) || event.data.count < 0) return;
    for (const [frame, item] of frames) {
      if (event.source !== frame.contentWindow || event.origin !== item.origin) continue;
      item.count = event.data.count;
      send(frame, item);
      notify();
      break;
    }
  };
  window.addEventListener('message', onMessage);

  function add(frame, { inject = false } = {}) {
    const url = new URL(frame.src, document.baseURI);
    const item = { origin: url.origin, count: 0 };
    item.load = async () => {
      item.count = 0;
      notify();
      send(frame, item);
      if (!inject || url.origin !== location.origin || !/\/results\//.test(url.pathname)) return;
      try {
        const doc = frame.contentDocument;
        const source = await scriptSource();
        // A replaced pane or a document navigating meanwhile must not receive this script.
        if (!frames.has(frame) || !frame.isConnected || frame.contentDocument !== doc) return;
        if (!doc.querySelector('[data-gallery-fold]')) {
          const script = doc.createElement('script');
          script.dataset.galleryFold = '';
          script.textContent = source;
          doc.documentElement.appendChild(script);
        }
        send(frame, item);
      } catch { /* Static galleries without the platform still show the original controls. */ }
    };
    frames.set(frame, item);
    frame.addEventListener('load', item.load);
    notify();
  }

  function remove(frame) {
    const item = frames.get(frame);
    if (!item) return;
    send(frame, item, false);
    frame.removeEventListener('load', item.load);
    frames.delete(frame);
    notify();
  }

  function setFolded(value) {
    folded = value;
    for (const [frame, item] of frames) send(frame, item);
    notify();
  }

  return {
    add,
    remove,
    clear() { for (const frame of frames.keys()) remove(frame); },
    hide() { setFolded(true); },
    toggle() { setFolded(!folded); },
    destroy() {
      this.clear();
      window.removeEventListener('message', onMessage);
    },
  };
}
