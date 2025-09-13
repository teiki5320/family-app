import * as Accueil from './js/accueil.js';

const routes = {
  accueil: Accueil,
  listes: await import('./js/listes.js'),
  calendrier: await import('./js/calendrier.js'),
  documents: await import('./js/documents.js'),
  // etc...
};

function renderRoute() {
  const page = location.hash.replace('#/', '') || 'accueil';
  const module = routes[page];
  if (module && module.render) {
    document.getElementById('app').innerHTML = module.render();
  } else {
    document.getElementById('app').innerHTML = `<p>Page non trouvée</p>`;
  }
}
window.addEventListener('hashchange', renderRoute);
window.addEventListener('load', renderRoute);