import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { prepareCar, addPaintWave, PARTS, WHEEL_RADIUS } from './car-model.js';

const easeOut = t => 1 - Math.pow(1 - t, 4);
const easeInOut = t => t < .5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2;
const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.min(1, Math.max(0, t));

// Camera stops of the scroll tour. The first is the quay view; the others frame one part each.
export const STOPS = [
  { position: [6.9, 1.9, 7.1], target: [0, .5, .2] },
  { position: [8.6, 1.35, .6], target: [0, .6, .15], part: 'door' },
  { position: [3.7, 1.15, 6.1], target: [.45, .6, 1.5], part: 'fender' },
  { position: [3.1, .7, 3.3], target: [.95, .42, 1.45], part: 'wheel' },
  { position: [4.6, 5.4, -5.3], target: [0, .65, .1], part: 'roof' },
];
const INTRO_DISTANCE = 11;

async function loadModel() {
  try {
    const response = await fetch(new URL('assets/car.glb', document.baseURI));
    if (!response.ok) throw new Error(response.statusText);
    return await response.arrayBuffer();
  } catch {
    // Pages opened from disk cannot fetch; the build ships the same model wrapped in a script.
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/car-glb.js';
      script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
    const binary = atob(window.__novaCarGLB);
    delete window.__novaCarGLB;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
}

export function createViewer(stage, color, { onLost, onReady, onFrame, label, labels = [], intro = true, snapshot = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: snapshot });
  const small = Math.min(innerWidth, innerHeight) < 600;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .035);
  scene.environment = environment.texture;
  scene.environmentIntensity = .8;
  room.dispose(); pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#cfd8e6', '#16181b', .5));
  // The quay floodlight: one warm-white spot above and in front of the car.
  const flood = new THREE.SpotLight('#fff1dc', 0, 26, .62, .55, 1.4);
  flood.position.set(2.8, 8.5, 5.2);
  flood.target.position.set(0, 0, .3);
  flood.castShadow = true;
  flood.shadow.mapSize.setScalar(small ? 1024 : 2048);
  flood.shadow.bias = -.0004;
  flood.shadow.normalBias = .02;
  flood.shadow.camera.near = 3; flood.shadow.camera.far = 20;
  scene.add(flood, flood.target);
  const rim = new THREE.DirectionalLight('#9fb6d6', 1.3);
  rim.position.set(-6, 3.5, -6);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const carRoot = new THREE.Group();
  scene.add(carRoot);
  // Soft contact shadow so the tyres sit on the asphalt even where the spot's shadow is thin.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,.7)'); gradient.addColorStop(.55, 'rgba(0,0,0,.4)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(shadowCanvas);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.6), new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, .004, .24);
  carRoot.add(contact);

  let car = null, wave = null, disposed = false, frame = 0, last = 0;
  let introStart = -1;
  let yaw = 0, yawTarget = 0;
  let tour = 0, tourTarget = 0;
  let waveStart = -1;
  const waveDuration = 1100;
  const pointerState = { id: null, x: 0, y: 0, dragging: false };
  const temp = { position: new THREE.Vector3(), target: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), part: new THREE.Vector3() };
  const size = { width: 1, height: 1 };
  let reach = 1;

  function cameraAt(t, position, target) {
    const i = Math.min(STOPS.length - 2, Math.floor(t));
    const f = smooth(clamp01(t - i));
    position.fromArray(STOPS[i].position).lerp(temp.a.fromArray(STOPS[i + 1].position), f);
    target.fromArray(STOPS[i].target).lerp(temp.b.fromArray(STOPS[i + 1].target), f);
    // Narrow screens pull back for the quay view, then come close again for the detail stops.
    const pull = 1 + (reach - 1) * (1 - .75 * smooth(clamp01(t)));
    position.sub(target).multiplyScalar(pull).add(target);
    // Keep the lens out of the bodywork while it travels between stops.
    const radius = Math.hypot(position.x, position.z);
    if (radius < 3.1) { position.x *= 3.1 / radius; position.z *= 3.1 / radius; }
  }

  function updateLabel() {
    if (!label) return;
    let best = -1, weight = 0;
    STOPS.forEach((stop, index) => {
      if (!stop.part) return;
      // Held at full strength around its stop, fading only while the camera travels.
      const w = 1 - clamp01((Math.abs(tour - index) - .14) * 3.2);
      if (w > weight) { weight = w; best = index; }
    });
    const introDone = introStart < 0 || performance.now() - introStart > 2600;
    if (best < 0 || weight <= .02 || !car || !introDone) { label.style.opacity = '0'; return; }
    carRoot.updateMatrixWorld();
    temp.part.fromArray(PARTS[STOPS[best].part]).applyMatrix4(carRoot.matrixWorld).project(camera);
    const x = (temp.part.x * .5 + .5) * size.width, y = (-temp.part.y * .5 + .5) * size.height;
    label.style.opacity = String(smooth(clamp01(weight)));
    label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    const text = labels[best] || '';
    if (label.dataset.text !== text) { label.dataset.text = text; label.querySelector('span').textContent = text; }
  }

  function step(now) {
    frame = 0;
    if (disposed) return;
    const dt = Math.min(.12, (now - (last || now)) / 1000);
    last = now;
    let moving = false;

    if (car && introStart >= 0) {
      const t = clamp01((now - introStart) / 2600);
      const travelled = INTRO_DISTANCE * easeOut(t);
      const previous = carRoot.position.z + INTRO_DISTANCE;
      carRoot.position.z = travelled - INTRO_DISTANCE;
      const spin = (travelled - previous) / WHEEL_RADIUS;
      car.wheels.forEach(wheel => wheel.rotateX(spin));
      // The floodlight strikes twice before it holds, like a quay lamp warming up.
      const lt = (now - introStart) / 1000;
      flood.intensity = lt < .12 ? 0 : lt < .2 ? 90 : lt < .32 ? 25 : 260 * easeOut(clamp01((lt - .32) / .5));
      if (t < 1) moving = true; else { introStart = -2; flood.intensity = 260; }
    }
    if (Math.abs(yawTarget - yaw) > .0005) { yaw += (yawTarget - yaw) * Math.min(1, dt * 9); moving = true; } else yaw = yawTarget;
    carRoot.rotation.y = yaw;
    if (Math.abs(tourTarget - tour) > .0005) { tour += (tourTarget - tour) * Math.min(1, dt * 5); moving = true; } else tour = tourTarget;
    if (wave && waveStart >= 0) {
      const t = clamp01((now - waveStart) / waveDuration);
      wave.novaWave.value = easeInOut(t);
      if (t < 1) moving = true; else waveStart = -1;
    }
    cameraAt(tour, temp.position, temp.target);
    if (introStart >= 0 && car) {
      const pull = 1 - easeOut(clamp01((now - introStart) / 2600));
      temp.position.multiplyScalar(1 + .22 * pull);
    }
    camera.position.copy(temp.position);
    camera.lookAt(temp.target);
    if (wave) { carRoot.updateMatrixWorld(); wave.novaWorldToCar.value.copy(carRoot.matrixWorld).invert(); }
    renderer.render(scene, camera);
    updateLabel();
    onFrame?.({ azimuth: Math.atan2(camera.position.x, camera.position.z) - yaw, tour });
    if (moving) frame = requestAnimationFrame(step); else last = 0;
  }
  function render() { if (!frame && !disposed) frame = requestAnimationFrame(step); }

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    size.width = width; size.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 40 : camera.aspect < 1.4 ? 34 : 30;
    reach = portrait ? 1.42 : camera.aspect < 1.4 ? 1.15 : 1;
    // Desktop copy sits on the left, so the car moves right; on phones the copy sits low, so the car moves up.
    if (snapshot) camera.clearViewOffset();
    else if (width > 820) camera.setViewOffset(width, height, -width * .19, -height * .02, width, height);
    else camera.setViewOffset(width, height, 0, height * (portrait ? .13 : .06), width, height);
    camera.updateProjectionMatrix();
    render();
  }

  function down(event) { if (event.pointerType === 'mouse' && event.button !== 0) return; Object.assign(pointerState, { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false }); }
  function move(event) {
    if (pointerState.id !== event.pointerId) return;
    const dx = event.clientX - pointerState.x, dy = event.clientY - pointerState.y;
    if (!pointerState.dragging && Math.abs(dx) < 6) return;
    if (!pointerState.dragging && Math.abs(dy) > Math.abs(dx)) { pointerState.id = null; return; }
    pointerState.dragging = true;
    stage.setPointerCapture(event.pointerId);
    yawTarget += dx * .008;
    pointerState.x = event.clientX; pointerState.y = event.clientY;
    render();
  }
  function up() { pointerState.id = null; }
  function keydown(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); rotate(event.key === 'ArrowLeft' ? -.25 : .25); }
    if (event.key === 'Home') { event.preventDefault(); reset(); }
  }
  function contextLost(event) { event.preventDefault(); onLost?.(); }
  function rotate(delta) { yawTarget += delta; render(); }
  function reset() { yawTarget = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; render(); }

  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('keydown', keydown);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'car-canvas';
  stage.append(renderer.domElement);
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ready = loadModel()
    .then(buffer => new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject)))
    .then(gltf => {
      if (disposed) return;
      car = prepareCar(gltf.scene, color);
      wave = addPaintWave(car.paint);
      carRoot.add(gltf.scene);
      stage.classList.add('has-webgl');
      if (intro) { introStart = performance.now(); carRoot.position.z = -INTRO_DISTANCE; } else flood.intensity = 260;
      renderer.compile(scene, camera);
      onReady?.();
      render();
    })
    .catch(error => { if (!disposed) onLost?.(error); });

  return {
    ready,
    setColor(hex) {
      if (!car) { color = hex; return; }
      const from = car.paint.color.clone();
      if (wave && waveStart >= 0) from.lerp(car.paint.color, wave.novaWave.value);
      wave.novaFrom.value.copy(from);
      car.paint.color.set(hex);
      wave.novaWave.value = 0;
      waveStart = performance.now();
      render();
    },
    setTour(value) { tourTarget = Math.max(0, Math.min(STOPS.length - 1, value)); render(); },
    rotate,
    reset,
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('keydown', keydown);
      scene.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        for (const material of [].concat(object.material)) { for (const value of Object.values(material)) if (value?.isTexture) value.dispose(); material.dispose(); }
      });
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stage.classList.remove('has-webgl');
      if (label) label.style.opacity = '0';
    },
  };
}
