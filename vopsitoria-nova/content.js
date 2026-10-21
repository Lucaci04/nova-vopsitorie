export const palette = [
  { name: 'Roșu rubin', hex: '#ac172b', accent: '#f17a79', swatch: '#b52b37' },
  { name: 'Albastru mineral', hex: '#165e9c', accent: '#7cb8f3', swatch: '#316bac' },
  { name: 'Verde pădure', hex: '#1c624e', accent: '#77c4a5', swatch: '#387d62' },
  { name: 'Portocaliu cupru', hex: '#b14f1d', accent: '#f5aa76', swatch: '#ca743b' },
  { name: 'Violet ametist', hex: '#653692', accent: '#c09aeb', swatch: '#875eab' },
];
export const gallery = [
  { id: 'paint', title: 'Culoare. Profunzime. Reflexie.', category: 'vopsitorie', label: 'Vopsitorie', image: 'assets/paint-demo.jpg', alt: 'Ilustrație AI: detaliu de caroserie roșu metalizat, cu reflexii de lumină.', demo: true, notice: 'Imagine AI · nu este o lucrare Nova' },
  { id: 'body', title: 'Totul începe cu suprafața.', category: 'tinichigerie', label: 'Tinichigerie', image: 'assets/body-demo.jpg', alt: 'Ilustrație AI: pregătirea unui panou de caroserie pentru vopsire.', demo: true, notice: 'Imagine AI · nu este o lucrare Nova' },
  { id: 'polish', title: 'Detaliul care schimbă totul.', category: 'detailing', label: 'Polish & detailing', image: 'assets/polish-demo.jpg', alt: 'Ilustrație AI: aparat de polish pe o capotă albastră.', demo: true, notice: 'Imagine AI · nu este o lucrare Nova' },
];
export const filterGallery = category => category === 'all' ? gallery : gallery.filter(item => item.category === category);
export const contact = {
  phoneHref: 'tel:+40700001001',
  maps: 'https://www.google.com/maps/search/?api=1&query=Constan%C8%9Ba',
};

// Paint code typed by the visitor: HEX with or without "#", six or three digits.
export function parsePaintCode(value) {
  const code = String(value).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(code)) return '#' + [...code].map(c => c + c).join('').toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(code)) return '#' + code.toLowerCase();
  return null;
}
