// Enabled only in the gallery's temporary, same-origin scene loader.
(() => {
  if (window.parent === window || !new URLSearchParams(location.search).has('sandtable')) return;
  const scenes = window.__galleryScenes = [];
  window.__galleryCaptureScene = (scene) => scenes.push(scene);
  // Only the extraction copy runs this bridge. Once ready, stop its animation
  // loop so it does not compete with the sandtable while meshes are imported.
  const requestFrame = window.requestAnimationFrame.bind(window);
  const pendingFrames = new Set();
  let paused = false;
  window.requestAnimationFrame = (callback) => {
    if (paused) return 0;
    const id = requestFrame(time => { pendingFrames.delete(id); callback(time); });
    pendingFrames.add(id);
    return id;
  };
  let previous = '', stable = 0;
  const started = performance.now();
  const timer = setInterval(() => {
    let meshes = 0, vertices = 0;
    for (const scene of scenes) scene.traverse((object) => {
      if (object.isMesh) { meshes++; vertices += object.geometry?.attributes?.position?.count ?? 0; }
    });
    const signature = `${meshes}/${vertices}`;
    stable = signature === previous ? stable + 1 : 0;
    previous = signature;
    if (meshes && stable >= 3 && performance.now() - started > 1800) {
      clearInterval(timer);
      paused = true;
      pendingFrames.forEach(id => cancelAnimationFrame(id));
      pendingFrames.clear();
      parent.postMessage({ type: 'gallery-scene-ready' }, location.origin);
    }
  }, 400);
})();
