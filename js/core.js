// ===== Helpers
export const $  = (s, root=document) => root.querySelector(s);
export const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
export const pad = n => String(n).padStart(2,'0');
export const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
export const escapeHTML = s => (s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
export const fmtEUR = x => (x||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});

// ===== State (localStorage)
const KEY = 'familyApp.v3';
const DEFAULT_STATE = {
  tasks:[], tx:[], notes:"", events:[],
  health:{ persons:[] },
  vehicles:{ list:[] },
  impots:{ items:[] }
};
export const state = (()=> {
  try{
    const cached = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_STATE, ...cached,
      health:   { persons:[], ...(cached.health||{}) },
      vehicles: { list:[],   ...(cached.vehicles||{}) },
      impots:   { items:[],  ...(cached.impots||{}) },
    };
  }catch{ return structuredClone(DEFAULT_STATE); }
})();
export const save = ()=> localStorage.setItem(KEY, JSON.stringify(state));

// ===== Worker endpoints (facultatifs)
export const WORKER_URL = 'https://family-app.teiki5320.workers.dev';
export const SECRET = 'Partenaire85/';
export const ROOM   = 'family';
export async function addToCalendar({ title, date, time='09:00', place='', category='Autre', note='' }){
  try{
    await fetch(`${WORKER_URL}/cal/add`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET },
      body: JSON.stringify({ title, date, time, place, category, note })
    });
  }catch(e){}
}

// ===== Router (ordre fixé)
const routes = {
  listes:      () => import('./listes.js'),
  calendrier:  () => import('./calendrier.js'),
  document:    () => import('./document.js'),
  impots:      () => import('./impots.js'),
  sante:       () => import('./sante.js'),
  vehicule:    () => import('./vehicule.js'),
  message:     () => import('./message.js'),
  menu:        () => import('./menu.js'),
  '':          () => import('./listes.js'),
};

let current = { destroy:null };

async function renderRoute(){
  const hash = (location.hash || '#/listes').replace('#/','');
  const name = routes[hash] ? hash : '';
  try{ current.destroy && current.destroy(); }catch{}
  const mod = await routes[name]();
  const el = document.getElementById('app');
  el.innerHTML = '';
  const api = (mod.init && typeof mod.init === 'function')
    ? mod.init(el, { $, $$, state, save, fmtEUR, todayISO, escapeHTML, addToCalendar, WORKER_URL, SECRET, ROOM })
    : null;
  current.destroy = (mod.destroy && typeof mod.destroy === 'function') ? mod.destroy : (api && api.destroy ? api.destroy : null);
  document.title = `Family · ${name ? name[0].toUpperCase()+name.slice(1) : 'Listes'}`;
}
window.addEventListener('hashchange', renderRoute);
document.addEventListener('DOMContentLoaded', renderRoute);