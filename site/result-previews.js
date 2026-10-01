import * as THREE from 'three';
import { disposeObject } from './scene-resources.js';

import { readModel } from './preview-model.js';

// Shared with scripts/bake-posters.mjs, so each baked poster matches the first live frame.
export function createPreviewRenderer(pixelRatio) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;
  return renderer;
}
export function createPreviewCamera() {
  const camera = new THREE.OrthographicCamera(-80, 80, 50, -50, 0.1, 1000);
  camera.position.set(115, 92, 138);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
export function buildPreviewScene(imported, architecture, clip) {
  const { group, previewBounds } = imported;
  // Card previews use the small overview mesh; full originals keep their detail.
  for (const lod of imported.lods ?? []) {
    lod.autoUpdate = false;
    lod.levels.forEach((level, index) => { level.object.visible = index === lod.levels.length - 1; });
  }
  const pivot = new THREE.Group(); pivot.add(group);
  if (architecture) {
    const size = previewBounds.getSize(new THREE.Vector3());
    const base = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.7, 1.25, size.z + 0.7), new THREE.MeshStandardMaterial({ color: 0x223336, roughness: 1 }));
    base.position.y = previewBounds.min.y - 0.65;
    pivot.add(base); previewBounds.min.y -= 1.3;
  }
  const scene = new THREE.Scene(); scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xd5e4de, 0x4a5140, 2.1));
  const sun = new THREE.DirectionalLight(0xffe6be, 3.3); sun.position.set(-80, 110, 90); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb5d9db, 0.55); fill.position.set(70, 50, -80); scene.add(fill);
  const result = { scene, pivot, bounds: previewBounds };
  // A world-axis box includes empty corners around thin, diagonal models such
  // as aircraft. Frame their visible vertices in the resting camera instead.
  // Architecture keeps its authored clipping bounds and display plinth.
  if (!architecture) result.bounds = { projection: projectVisibleMeshes(createPreviewCamera(), group) };
  // Clip distant scenery from extraction copies, as in the existing sandtable.
  if (clip) {
    const { min, max } = previewBounds;
    result.localPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -min.x), new THREE.Plane(new THREE.Vector3(-1, 0, 0), max.x),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -min.z), new THREE.Plane(new THREE.Vector3(0, 0, -1), max.z),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), max.y),
    ];
    result.planes = result.localPlanes.map((plane) => plane.clone());
    group.traverse((mesh) => {
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) if (material) material.clippingPlanes = result.planes;
    });
  }
  return result;
}
function projectVisibleMeshes(camera, group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3(), point = new THREE.Vector3();
  const view = new THREE.Matrix4(), instance = new THREE.Matrix4(), transform = new THREE.Matrix4();
  group.traverseVisible((mesh) => {
    if (!mesh.isMesh || !mesh.geometry.attributes.position) return;
    const { geometry, material } = mesh, positions = geometry.attributes.position;
    const visible = (value) => value?.visible && !(value.transparent && value.opacity === 0);
    const ranges = Array.isArray(material)
      ? geometry.groups.filter((range) => visible(material[range.materialIndex]))
      : visible(material) ? [{ start: 0, count: Infinity }] : [];
    const draw = geometry.drawRange, count = geometry.index?.count ?? positions.count;
    view.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); transform.multiplyMatrices(view, instance); }
      else transform.copy(view);
      for (const range of ranges) {
        const end = Math.min(count, draw.start + draw.count, range.start + range.count);
        for (let j = Math.max(draw.start, range.start); j < end; j++) {
          point.fromBufferAttribute(positions, geometry.index ? geometry.index.getX(j) : j).applyMatrix4(transform);
          box.expandByPoint(point);
        }
      }
    }
  });
  return { minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y };
}
function projectBounds(camera, bounds) {
  if (bounds.projection) return bounds.projection;
  const point = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}
// A poster rendered at this aspect and shown with object-fit: contain matches
// fitPreviewCamera at any card aspect.
export function previewAspect(camera, bounds) {
  const { minX, maxX, minY, maxY } = projectBounds(camera, bounds);
  return (maxX - minX) / (maxY - minY);
}
export function fitPreviewCamera(camera, bounds, aspect) {
  const { minX, maxX, minY, maxY } = projectBounds(camera, bounds);
  const halfH = Math.max((maxY - minY) / 2, (maxX - minX) / aspect / 2) * 1.08;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  camera.left = cx - halfH * aspect; camera.right = cx + halfH * aspect;
  camera.top = cy + halfH; camera.bottom = cy - halfH;
  camera.updateProjectionMatrix();
}

export function createResultPreviews(root, task) {
  return createPreviews(root, task.results.map((result) => {
    const card = root.querySelector(`.result[data-id="${result.id}"]`);
    const element = card.querySelector('.result-media');
    return { result, task, card, element, target: element.querySelector('a') };
  }));
}

export function createQuestionPreviews(root, choices) {
  return createPreviews(root, choices.filter(({ result }) => result?.previewModel || result?.previewLoader).map(({ task, result }) => {
    const card = root.querySelector(`[data-task-card="${task.id}"]`);
    const element = card.querySelector('.question-visual');
    return { result, task, card, element, target: element };
  }));
}

function createPreviews(root, choices) {
  const abort = new AbortController(), { signal } = abort;
  const mobile = matchMedia('(max-width: 640px)').matches;
  const parallelLoads = mobile ? 2 : 3;
  const cacheLimit = mobile ? 6 : 9;
  const renderer = createPreviewRenderer(Math.min(devicePixelRatio, mobile ? 1 : 1.5));
  const camera = createPreviewCamera();
  let paused = false, destroyed = false, frame = 0, lastTime = 0;
  const loading = new Map();
  const entries = choices.map(({ result, task, card, element, target }) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'result-model-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const status = document.createElement('span');
    status.className = 'result-model-status';
    status.textContent = '正在载入模型';
    target.append(canvas, status);
    card.dataset.previewState = 'queued';
    return { result, task, card, element, canvas, context: canvas.getContext('2d'), status, nearby: false, dirty: true, x: 0, y: 0, targetX: 0, targetY: 0 };
  });

  function requestRender() {
    if (!frame && !destroyed && !paused && !document.hidden) frame = requestAnimationFrame(render);
  }
  function refresh() {
    for (const entry of entries) entry.dirty = true;
    requestRender();
    pump();
  }
  function setStatus(entry, state, text = '') {
    entry.card.dataset.previewState = state;
    entry.status.textContent = text;
  }
  const observer = new IntersectionObserver((changes) => {
    for (const change of changes) {
      const entry = entries.find((entry) => entry.element === change.target);
      entry.nearby = change.isIntersecting;
      entry.dirty = true;
    }
    requestRender(); pump();
  }, { rootMargin: '180px' });
  const resizeObserver = new ResizeObserver(refresh);
  for (const entry of entries) {
    observer.observe(entry.element); resizeObserver.observe(entry.element);
    entry.element.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = entry.element.getBoundingClientRect();
      entry.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.26;
      entry.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.075;
      requestRender();
    }, { signal });
    entry.element.addEventListener('pointerleave', () => {
      entry.targetX = entry.targetY = 0; requestRender();
    }, { signal });
  }
  window.addEventListener('scroll', requestRender, { passive: true, signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  }, { signal });

  function addScene(entry, imported) {
    const architecture = entry.task.sceneProfile === 'architecture';
    // Clip distant scenery from extraction copies, as in the existing sandtable.
    Object.assign(entry, buildPreviewScene(imported, architecture, architecture && (imported.clip || !entry.result.previewModel)), { dirty: true });
    // Without a matching poster, let the model settle into place instead of cutting over.
    if (!entry.result.previewPoster && !entry.card.classList.contains('has-model-preview') && !matchMedia('(prefers-reduced-motion: reduce)').matches) entry.x = -0.2;
    setStatus(entry, 'ready'); requestRender();
    // Keep nearby models interactive without retaining every large scene in RAM.
    const cached = entries.filter((entry) => entry.scene);
    for (const old of cached.filter((entry) => !entry.nearby).slice(0, Math.max(0, cached.length - cacheLimit))) {
      disposeObject(old.scene); old.scene = null;
    }
  }

  function stopLoader(job) {
    clearTimeout(job.timeout);
    job.iframe?.remove(); loading.delete(job.entry);
  }
  async function finish(job, imported, error) {
    if (destroyed || loading.get(job.entry) !== job) {
      if (imported) disposeObject(imported.group);
      return;
    }
    if (error) {
      setStatus(job.entry, 'error', '模型暂未载入 · 点击打开原作');
      console.error('Card model preview:', job.entry.result.id, error);
    } else addScene(job.entry, imported);
    stopLoader(job); pump();
  }
  function pump() {
    if (destroyed || paused || document.hidden || loading.size >= parallelLoads) return;
    const pending = entries.filter((entry) => entry.nearby && !entry.scene && !loading.has(entry) && entry.card.dataset.previewState !== 'error' && !entry.card.hidden)
      .map(entry => ({ entry, rect: entry.element.getBoundingClientRect() }))
      .sort((a, b) => Number(a.rect.top >= innerHeight || a.rect.bottom <= 0) - Number(b.rect.top >= innerHeight || b.rect.bottom <= 0) || a.rect.top - b.rect.top || a.rect.left - b.rect.left);
    for (const { entry } of pending) {
      if (loading.size >= parallelLoads) break;
      // Baked models load in parallel. Keep procedural fallback generation serial.
      if (!entry.result.previewModel && [...loading.values()].some(job => job.iframe)) continue;
      const job = { entry }; loading.set(entry, job);
      setStatus(entry, 'loading', '正在载入模型');
      if (entry.result.previewModel) {
        readModel(entry.result.previewModel, signal).then((model) => finish(job, model), (error) => finish(job, null, error));
      } else {
        const iframe = document.createElement('iframe');
        iframe.className = 'result-model-loader'; iframe.tabIndex = -1; iframe.setAttribute('aria-hidden', 'true');
        iframe.title = `载入 ${entry.result.title} 的建模场景`;
        iframe.src = `${entry.result.previewLoader}?sandtable=1`;
        job.iframe = iframe;
        job.timeout = setTimeout(() => { if (!job.importing) finish(job, null, new Error('Model load timed out')); }, 60000);
        root.append(iframe);
      }
    }
  }
  window.addEventListener('message', async (event) => {
    if (event.origin !== location.origin || event.data?.type !== 'gallery-scene-ready') return;
    const job = [...loading.values()].find(job => job.iframe?.contentWindow === event.source);
    if (!job || job.importing) return;
    job.importing = true; clearTimeout(job.timeout);
    try {
      const { importArchitecture } = await import('./sandtable.js');
      const architecture = job.entry.task.sceneProfile === 'architecture', railway = job.entry.task.sceneProfile === 'railway';
      await finish(job, await importArchitecture(job.iframe.contentWindow.__galleryScenes, job.entry.result.id, { architecture, railwayPreview: railway }));
    } catch (error) { await finish(job, null, error); }
  }, { signal });

  function render(time) {
    frame = 0;
    if (destroyed || paused || document.hidden) return;
    const dt = Math.min(0.05, (time - lastTime) / 1000 || 0.016); lastTime = time;
    let moving = false, deferred = false, rendered = 0;
    const started = performance.now();
    for (const entry of entries) {
      if (!entry.scene || entry.card.hidden || !entry.nearby) continue;
      const rect = entry.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight || !rect.width) continue;
      const changed = Math.abs(entry.targetX - entry.x) + Math.abs(entry.targetY - entry.y) > 0.0001;
      if (!entry.dirty && !changed) continue;
      // Spread first paint / resize uploads across frames to leave room for input.
      if (rendered && performance.now() - started >= 8) { deferred = true; break; }
      moving ||= changed;
      const follow = 1 - Math.exp(-dt * 9);
      entry.x += (entry.targetX - entry.x) * follow; entry.y += (entry.targetY - entry.y) * follow;
      entry.pivot.rotation.set(entry.y, entry.x, 0);
      entry.pivot.updateMatrixWorld(true);
      entry.planes?.forEach((plane, index) => plane.copy(entry.localPlanes[index]).applyMatrix4(entry.pivot.matrixWorld));
      const width = Math.round(rect.width), height = Math.round(rect.height);
      renderer.setSize(width, height, false);
      fitPreviewCamera(camera, entry.bounds, width / height);
      renderer.render(entry.scene, camera);
      // One shared GPU context; card-local canvases preserve rounded clipping,
      // sticky navigation, overlays and the gallery's existing layout.
      if (entry.canvas.width !== renderer.domElement.width || entry.canvas.height !== renderer.domElement.height) {
        entry.canvas.width = renderer.domElement.width; entry.canvas.height = renderer.domElement.height;
      }
      entry.context.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
      entry.context.drawImage(renderer.domElement, 0, 0);
      entry.card.classList.add('has-model-preview'); entry.dirty = false;
      rendered++;
    }
    if (moving || deferred) requestRender();
  }
  return {
    refresh,
    setPaused(value) {
      paused = value;
      if (paused) { cancelAnimationFrame(frame); frame = 0; }
      else refresh();
    },
    destroy() {
      destroyed = true; abort.abort();
      for (const job of loading.values()) stopLoader(job);
      cancelAnimationFrame(frame);
      observer.disconnect(); resizeObserver.disconnect();
      for (const entry of entries) {
        if (entry.scene) disposeObject(entry.scene);
        entry.canvas.remove(); entry.status.remove();
        entry.card.classList.remove('has-model-preview');
        delete entry.card.dataset.previewState;
      }
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
