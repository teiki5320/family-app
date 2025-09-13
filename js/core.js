// =============== helpers basiques ===============
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

// expose quelques utilitaires aux pages (simple)
export const core = {
  $, $$,
  pad: n => String(n).padStart(2,'0'),
  todayISO: () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
  escapeHTML: s => (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])),
};

// =============== router (lazy import + robustesse) ===============
const modules = {
  accueil:     () => import('./accueil.js'),
  listes:      () => import('./listes.js'),
  calendrier:  () => import('./calendrier.js'),
  document:    () => import('./document.js'),
  impots:      () => import('./impots.js'),
  sante:       () => import('./sante.js'),
  vehicule:    () => import('./vehicule.js'),
  message:     () => import('./message.js'),
  menu:        () => import('./menu.js'),
};

let currentDestroy = null;

async function renderRoute(){
  const id = (location.hash || '#/accueil').slice(2);
  const loader = modules[id] || modules.accueil; // défaut

  // nettoie l'ancienne page si elle avait un destroy()
  try{ currentDestroy && currentDestroy(); }catch{}

  const host = document.getElementById('app');
  host.innerHTML = '';

  try{
    const mod = await loader();      // { init() ... } OU { render() ... }
    let api = null;

    if (typeof mod.init === 'function') {
      api = mod.init(host, core);    // rend dans host
    } else if (typeof mod.render === 'function') {
      host.innerHTML = mod.render(host, core) || '';
    } else if (typeof mod.default === 'function') {
      // au cas où la page exporte une fonction par défaut
      api = mod.default(host, core);
    } else {
      host.innerHTML = `<section><h2>${id}</h2><p>Page chargée, mais aucun rendu exporté.</p></section>`;
    }

    currentDestroy = (api && api.destroy) || mod.destroy || null;
  } catch(e){
    // si le module n'existe pas encore → message doux
    host.innerHTML = `
      <section class="fade-in">
        <h2>${id[0]?.toUpperCase() + id.slice(1) || 'Page'}</h2>
        <div class="card">
          <div class="card-meta">Cette page n'est pas encore disponible.</div>
          <div class="card-meta" style="margin-top:6px; opacity:.8">Crée le fichier <code>js/${id}.js</code>.</div>
        </div>
        <div class="tiles" style="margin-top:12px">
          <a class="tile" href="#/accueil"><div class="icon">🏠</div><div class="title">Retour accueil</div><div class="subtitle">Tuiles de navigation</div></a>
        </div>
      </section>`;
    currentDestroy = null;
  }

  document.title = `Family · ${id ? id[0].toUpperCase()+id.slice(1) : 'Accueil'}`;
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', renderRoute);