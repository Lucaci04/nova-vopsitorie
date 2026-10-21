import { palette, gallery, filterGallery, contact, parsePaintCode } from './content.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const root = document.documentElement;
let viewer, selectedPaint = palette[0], visibleImages = gallery, imageIndex = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

for (const anchor of $$('[data-map]')) anchor.href = contact.maps;

// The container wall takes the new paint as a sweep, in step with the wave on the car.
const wall = $('.wall-steel');
function paintWall(paint, animate) {
  if (!wall) return;
  wall.classList.remove('sweeping');
  if (!animate) { root.style.setProperty('--wall', paint.hex); return; }
  root.style.setProperty('--wall-next', paint.hex);
  void wall.offsetWidth;
  wall.classList.add('sweeping');
}
wall?.addEventListener('animationend', () => {
  root.style.setProperty('--wall', root.style.getPropertyValue('--wall-next'));
  wall.classList.remove('sweeping');
});

function choosePaint(paint) {
  const animate = Boolean(viewer) && paint !== selectedPaint;
  selectedPaint = paint;
  root.style.setProperty('--accent', paint.accent);
  root.style.setProperty('--paint', paint.hex);
  paintWall(paint, animate);
  $('#paint-name').textContent = paint.name;
  $('#wall-paint-name').textContent = paint.name;
  $$('.swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === paint.hex)));
  viewer?.setColor(paint.hex);
  // Static renders exist only for the five studio colours; a custom code keeps the last render.
  if (palette.includes(paint)) $('#car-fallback').src = `assets/car-${paint.hex.slice(1)}.webp`;
  $('#car-fallback').alt = `Mașină demonstrativă de tip concept, fără emblemă. Culoare: ${paint.name}.`;
  $('#paint-picker').value = paint.hex;
  if (palette.includes(paint)) { $('#paint-code').value = ''; $('#paint-code').removeAttribute('aria-invalid'); }
}

// Any colour by code: HEX typed in, or picked from the system palette.
function mixHex(hex, target, amount) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(target.slice(1), 16);
  return '#' + [16, 8, 0].map(shift => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount).toString(16).padStart(2, '0')).join('');
}
function customPaint(hex) {
  return { name: `Cod #${hex.slice(1).toUpperCase()}`, hex, accent: mixHex(hex, '#ffffff', .5), swatch: hex };
}
const codeInput = $('#paint-code');
codeInput.addEventListener('input', () => {
  // Repaint once the six digits are in; a three-digit short code applies on Enter.
  const complete = codeInput.value.trim().replace(/^#/, '').length >= 6;
  const hex = complete ? parsePaintCode(codeInput.value) : null;
  codeInput.toggleAttribute('aria-invalid', complete && !hex);
  if (hex && hex !== selectedPaint.hex) choosePaint(customPaint(hex));
});
codeInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  const hex = parsePaintCode(codeInput.value);
  codeInput.toggleAttribute('aria-invalid', !hex);
  if (hex) choosePaint(customPaint(hex));
});
$('#paint-picker').addEventListener('input', event => {
  const hex = event.target.value.toLowerCase();
  codeInput.value = hex.slice(1).toUpperCase();
  codeInput.removeAttribute('aria-invalid');
  choosePaint(customPaint(hex));
});
for (const paint of palette) {
  const button = document.createElement('button');
  button.className = 'swatch';
  button.style.setProperty('--swatch', paint.swatch);
  button.dataset.color = paint.hex;
  button.setAttribute('aria-label', paint.name);
  button.setAttribute('title', paint.name);
  button.setAttribute('aria-pressed', String(paint === palette[0]));
  button.addEventListener('click', () => choosePaint(paint));
  $('#swatches').append(button);
}
root.style.setProperty('--wall', selectedPaint.hex);

function openDialog(dialog, opener) {
  dialog._opener = opener || document.activeElement;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}
for (const dialog of $$('dialog')) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; dialog._opener?.focus(); });
}
$$('[data-book]').forEach(button => button.addEventListener('click', () => {
  $('#booking-service').textContent = button.dataset.service ? `Te interesează ${button.dataset.service.toLowerCase()}? Spune-ne despre mașina ta. Stabilim telefonic detaliile evaluării și disponibilitatea atelierului.` : 'Spune-ne de ce are nevoie mașina ta. Stabilim telefonic detaliile evaluării și disponibilitatea atelierului.';
  openDialog($('#booking-dialog'), button);
}));

function showImage(index) {
  imageIndex = (index + visibleImages.length) % visibleImages.length;
  const item = visibleImages[imageIndex];
  $('#lightbox-image').src = item.image;
  $('#lightbox-image').alt = item.alt;
  $('#lightbox-title').textContent = item.title;
  $('#image-count').textContent = `${imageIndex + 1} / ${visibleImages.length}`;
  $('#image-prev').disabled = $('#image-next').disabled = visibleImages.length < 2;
}
function renderGallery(category = 'all') {
  visibleImages = filterGallery(category);
  const grid = $('#gallery-grid');
  grid.replaceChildren();
  grid.classList.toggle('filtered', category !== 'all');
  visibleImages.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = 'gallery-item';
    button.setAttribute('aria-label', `${item.title} ${item.notice}. Deschide imaginea.`);
    const photo = document.createElement('div'); photo.className = 'gallery-photo';
    const image = document.createElement('img'); image.src = item.image; image.alt = item.alt; image.loading = 'lazy'; image.width = 1536; image.height = 1024;
    const notice = document.createElement('span'); notice.className = 'photo-notice'; notice.textContent = item.notice;
    photo.append(image, notice);
    const info = document.createElement('div'); info.className = 'gallery-info';
    const text = document.createElement('div'); const categoryLabel = document.createElement('small'); categoryLabel.textContent = item.label;
    const title = document.createElement('strong'); title.textContent = item.title; text.append(title, categoryLabel);
    const arrow = document.createElement('span'); arrow.innerHTML = '<svg class="icon"><use href="#arrow-up-right"/></svg>'; arrow.setAttribute('aria-hidden', 'true');
    info.append(text, arrow); button.append(photo, info);
    button.addEventListener('click', () => { showImage(index); openDialog($('#image-dialog'), button); });
    grid.append(button);
  });
  $('#gallery-status').textContent = `${visibleImages.length} imagini demonstrative afișate.`;
}
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  $$('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  renderGallery(button.dataset.filter);
}));
$('#image-prev').addEventListener('click', () => showImage(imageIndex - 1));
$('#image-next').addEventListener('click', () => showImage(imageIndex + 1));
$('#image-dialog').addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); showImage(imageIndex + (event.key === 'ArrowLeft' ? -1 : 1)); } });
renderGallery();

function closeMenu() { $('.navigation').classList.remove('open'); $('.menu-button').setAttribute('aria-expanded', 'false'); $('.menu-button').setAttribute('aria-label', 'Deschide meniul'); }
$('.menu-button').addEventListener('click', () => { const open = $('.navigation').classList.toggle('open'); $('.menu-button').setAttribute('aria-expanded', String(open)); $('.menu-button').setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul'); });
$$('.navigation a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('.navigation').classList.contains('open')) { closeMenu(); $('.menu-button').focus(); } });
matchMedia('(min-width: 821px)').addEventListener('change', closeMenu);

const info = {
  privacy: ['Confidențialitate', '<p>Această versiune de prezentare nu include formulare de colectare a datelor, analytics sau cookie-uri de marketing. Preferința de culoare se păstrează doar cât timp pagina este deschisă.</p><p>Apelul deschide aplicația de telefonie a dispozitivului. Linkul către locație deschide Google Maps, serviciu extern cu propria politică de confidențialitate.</p><p>Înainte de lansarea publică, politica completă a operatorului Nova trebuie confirmată.</p>'],
  credits: ['Despre această versiune', '<p>Versiune de prezentare pentru Nova Vopsitorie. Imaginile din galerie sunt ilustrații generate cu AI, nu fotografii ale atelierului sau ale unor lucrări Nova.</p><p>Modelul 3D: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept" target="_blank" rel="noopener noreferrer">Car Concept</a>, de Eric Chadwick, © Darmstadt Graphics Group GmbH, licență <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Modificat pentru acest site: logo-uri eliminate, materiale simplificate, fișier comprimat. Este un model concept, nu un model de serie, și nu reprezintă o mașină reparată de Nova. Culorile sunt orientative.</p><p>Motorul 3D: Three.js, licență MIT. Fonturi: Big Shoulders Stencil și Barlow, licență SIL Open Font License.</p><p>Telefonul și adresa provin din <a href="https://nova-vopsitorie.example/" target="_blank" rel="noopener noreferrer">site-ul existent</a>. Locația Google Maps este cea furnizată de client. Programările și condițiile serviciilor se confirmă telefonic.</p>'],
};
$$('[data-info]').forEach(button => button.addEventListener('click', () => { const [title, body] = info[button.dataset.info]; $('#info-title').textContent = title; $('#info-content').innerHTML = body; openDialog($('#info-dialog'), button); }));

// Scroll tour: each service scene moves the camera to its stop as it rises into view.
const stage = $('#car-stage');
const services = $$('.service');
let tourFrame = 0;
function readTour() {
  tourFrame = 0;
  const height = innerHeight;
  let tour = 0;
  for (const scene of services) {
    const top = scene.getBoundingClientRect().top;
    // Phones arrive when the scene reaches the top, so the outgoing plate has left; desktop arrives a little earlier.
    const arrive = innerWidth > 820 ? height * .25 : 0;
    tour += Math.min(1, Math.max(0, (height * .85 - top) / (height * .85 - arrive)));
  }
  viewer?.setTour(tour);
  document.body.classList.toggle('touring', tour > .35);
  document.body.classList.toggle('scrolled', scrollY > 40);
}
addEventListener('scroll', () => { if (!tourFrame) tourFrame = requestAnimationFrame(readTour); }, { passive: true });
addEventListener('resize', () => { if (!tourFrame) tourFrame = requestAnimationFrame(readTour); });

function useFallback(message) {
  stage.classList.remove('has-webgl', 'is-loading');
  $('#viewer-help').textContent = message;
  stage.setAttribute('aria-label', 'Imagine statică a modelului demonstrativ.');
  $$('[data-rotate], #reset-view').forEach(button => { button.disabled = true; });
}
let loading = false;
async function loadViewer() {
  if (loading || viewer) return;
  if (reducedMotion.matches) { useFallback('Vizualizare statică · mișcare redusă'); return; }
  loading = true;
  try {
    const { createViewer } = await import('./car-viewer.js');
    if (reducedMotion.matches) return useFallback('Vizualizare statică · mișcare redusă');
    stage.classList.add('is-loading');
    $('#viewer-help').textContent = 'Mașina intră pe chei…';
    const slow = setTimeout(() => stage.classList.add('is-slow'), 3500);
    const lost = () => { clearTimeout(slow); viewer?.dispose(); viewer = null; useFallback('Vizualizare statică · 3D indisponibil'); };
    const wallBox = $('.wall');
    viewer = createViewer(stage, selectedPaint.hex, {
      label: $('#part-label'),
      labels: ['', 'Lac și vopsea', 'Aripă și caroserie', 'Jantă, disc, etrier', 'Luciu pe capotă și plafon'],
      onLost: lost,
      onReady() {
        clearTimeout(slow);
        stage.classList.remove('is-loading', 'is-slow');
        document.body.classList.add('car-arrived');
        $('#viewer-help').innerHTML = '<svg class="icon"><use href="#rotate"/></svg> Trage pentru a roti';
        readTour();
      },
      onFrame({ azimuth }) {
        const pan = Math.max(-1, Math.min(1, (azimuth - .78) / 1.2));
        wallBox.style.transform = `translate3d(${(pan * -40).toFixed(1)}px, 0, 0)`;
      },
    });
    stage.setAttribute('aria-label', 'Mașină 3D. Trage orizontal sau folosește săgețile stânga și dreapta pentru rotire.');
    $$('[data-rotate], #reset-view').forEach(button => { button.disabled = false; });
  } catch { viewer?.dispose(); viewer = null; useFallback('Vizualizare statică · 3D indisponibil'); }
  finally { loading = false; }
}
$$('[data-rotate]').forEach(button => button.addEventListener('click', () => viewer?.rotate(Number(button.dataset.rotate) * .3)));
$('#reset-view').addEventListener('click', () => viewer?.reset());
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { viewer?.dispose(); viewer = null; useFallback('Vizualizare statică · mișcare redusă'); } else loadViewer(); });
loadViewer();
