// js/document.js
// Documents avec dossiers/sous-dossiers + fichiers (persistant localStorage)

const LS_KEY = 'familyApp.docs.v1';

export function init(el, core){
  // ====== État ======
  let state = loadState();
  let current = ''; // "" = racine

  // ====== Rendu ======
  el.innerHTML = `
    <section class="fade-in">
      <h2>Documents</h2>

      <!-- Outils du dossier courant -->
      <div class="row" style="margin:6px 0 10px">
        <span class="chip">Dossier: <strong id="curLabel">Racine</strong></span>
        <div class="spacer"></div>
        <button id="btnNewFolder" class="ghost">Nouveau dossier</button>
        <button id="btnDelFolder" class="btn-danger">Supprimer ce dossier</button>
      </div>

      <!-- Addbar fichiers -->
      <form id="fileForm" class="addbar grid2" autocomplete="off">
        <input name="name" placeholder="Nom du fichier (ex: Contrat.pdf)" required>
        <input name="url"  placeholder="URL (https://...)" inputmode="url" required>
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- Grille dossiers -->
      <div id="folderGrid" class="folder-grid" style="margin-bottom:12px"></div>

      <!-- Grille fichiers -->
      <div id="fileGrid" class="file-grid"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const folderGrid = $('#folderGrid');
  const fileGrid   = $('#fileGrid');
  const curLabel   = $('#curLabel');
  const fileForm   = $('#fileForm');
  const btnNew     = $('#btnNewFolder');
  const btnDel     = $('#btnDelFolder');

  // ====== Persistence ======
  function loadState(){
    try{
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return normalize(raw);
    }catch{
      return normalize({});
    }
  }
  function normalize(s){
    const st = {
      folders: Array.isArray(s.folders) ? s.folders.filter(Boolean) : [],
      filesByFolder: (s.filesByFolder && typeof s.filesByFolder==='object') ? s.filesByFolder : {}
    };
    st.folders = Array.from(new Set(st.folders)).sort();   // uniques
    return st;
  }
  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

  // ====== Helpers structure ======
  function safeName(name){
    return String(name||'').trim().replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').slice(0,80);
  }
  function joinPath(parent, name){
    return parent ? `${parent}/${name}` : name;
  }
  function parentOf(path){
    if (!path) return '';
    return path.includes('/') ? path.split('/').slice(0,-1).join('/') : '';
  }
  function childrenFolders(path){
    // renvoie les sous-dossiers immédiats de "path"
    const prefix = path ? path + '/' : '';
    const depth  = path ? path.split('/').length + 1 : 1;
    return state.folders
      .filter(f => f.startsWith(prefix) && f.split('/').length === depth)
      .map(f => f.slice(prefix.length))
      .sort();
  }
  function ensureFolder(path){
    if (!path) return; // racine implicite
    if (!state.folders.includes(path)){
      state.folders.push(path);
      state.folders.sort();
      state.filesByFolder[path] ||= [];
    }
  }
  function listFiles(path){
    return (state.filesByFolder[path||''] ||= []);
  }
  function removeFolderRecursive(path){
    // supprime le dossier et tout son sous-arbre
    const prefix = path ? path + '/' : '';
    const toRemove = state.folders.filter(f => f===path || f.startsWith(prefix));
    // supprimer les fichiers de ces dossiers
    toRemove.forEach(p => { delete state.filesByFolder[p]; });
    // supprimer les dossiers
    state.folders = state.folders.filter(f => !toRemove.includes(f));
    // si on supprimait un dossier non racine, on reste sur son parent
    if (current === path) current = parentOf(path);
    save();
  }

  // ====== UI: rendu ======
  function renderBreadcrumb(){
    curLabel.textContent = current || 'Racine';

    // fil d’Ariane en tête de la grille des dossiers
    folderGrid.innerHTML = '';
    const trail = document.createElement('div');
    trail.className = 'row';
    trail.style.gridColumn = '1 / -1';
    trail.style.marginBottom = '6px';

    const homeBtn = document.createElement('button');
    homeBtn.className = 'ghost';
    homeBtn.textContent = '🏠 Racine';
    homeBtn.onclick = () => { current=''; renderAll(); };
    trail.appendChild(homeBtn);

    if (current){
      let acc = '';
      current.split('/').forEach((part, idx, arr)=>{
        const sep = document.createElement('span');
        sep.style.opacity = .5; sep.style.margin = '0 6px'; sep.textContent = '/';
        trail.appendChild(sep);
        acc = acc ? acc + '/' + part : part;
        const b = document.createElement('button');
        b.className = 'ghost';
        b.textContent = part || '(vide)';
        b.onclick = ()=> { current = arr.slice(0, idx+1).join('/'); renderAll(); };
        trail.appendChild(b);
      });
    }
    folderGrid.appendChild(trail);
  }

  function renderFolders(){
    // Fil d’Ariane déjà ajouté dans renderBreadcrumb()
    const items = childrenFolders(current);
    if (!items.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = 'Aucun sous-dossier';
      folderGrid.appendChild(empty);
      return;
    }
    items.forEach(name=>{
      const card = document.createElement('button');
      card.className = 'tile';
      card.style.alignItems = 'flex-start';
      card.style.width = '100%';
      card.innerHTML = `<div class="icon">📁</div><div class="title">${core.escapeHTML(name)}</div><div class="subtitle">Ouvrir</div>`;
      card.onclick = ()=> { current = joinPath(current, name); renderAll(); };
      folderGrid.appendChild(card);
    });
  }

  function isImg(u){ return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(u||''); }
  function isPdf(u){ return /\.pdf(\?|#|$)/i.test(u||''); }
  function normalizeUrl(u){
    const s = (u||'').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s;
  }

  function renderFiles(){
    fileGrid.innerHTML = '';
    const files = listFiles(current);

    if (!files.length){
      const empty = document.createElement('div');
      empty.className = 'card';
      empty.innerHTML = `<p class="muted">Aucun fichier dans "${current || 'Racine'}".</p>`;
      fileGrid.appendChild(empty);
      return;
    }

    [...files].sort((a,b)=> (b.ts||0)-(a.ts||0)).forEach((f, i)=>{
      const idx = files.indexOf(f);
      const card = document.createElement('div');
      card.className = 'file-card';
      const url = f.url, name = core.escapeHTML(f.name||'--');
      const when = new Date(f.ts||Date.now()).toLocaleString('fr-FR');

      const thumb = isImg(url)
        ? `<img class="thumb" src="${url}" alt="${name}">`
        : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:36px">${isPdf(url)?'📄':'📦'}</div>`;

      card.innerHTML = `
        ${thumb}
        <div class="name" title="${name}">${name}</div>
        <div class="meta">${when}</div>
        <div class="file-actions">
          <a class="ghost" href="${url}" target="_blank" rel="noopener">Ouvrir</a>
          <button class="ghost" data-copy>Copier l’URL</button>
          <button class="del btn-danger" data-del>Suppr</button>
        </div>
      `;

      card.querySelector('[data-del]').addEventListener('click', ()=>{
        if (!confirm(`Supprimer "${f.name}" ?`)) return;
        files.splice(idx,1); save(); renderFiles();
      });

      card.querySelector('[data-copy]').addEventListener('click', async ()=>{
        try{ await navigator.clipboard.writeText(url); }catch{}
      });

      fileGrid.appendChild(card);
    });
  }

  function renderAll(){
    renderBreadcrumb();
    renderFolders();
    renderFiles();
  }

  // ====== Actions ======
  btnNew.addEventListener('click', ()=>{
    const name = safeName(prompt('Nom du nouveau dossier ?') || '');
    if (!name) return;
    const path = joinPath(current, name);
    if (state.folders.includes(path)){
      alert('Ce dossier existe déjà.');
      return;
    }
    ensureFolder(path);
    save(); renderAll();
  });

  btnDel.addEventListener('click', ()=>{
    if (!current){ alert('Tu es à la racine (rien à supprimer).'); return; }
    if (!confirm(`Supprimer le dossier "${current}" et tout son contenu ?`)) return;
    removeFolderRecursive(current);
    save(); renderAll();
  });

  fileForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(fileForm);
    const name = safeName(fd.get('name'));
    const raw  = String(fd.get('url')||'').trim();
    const url  = normalizeUrl(raw);
    if (!name || !url) return;
    try{ new URL(url); }catch{ alert('URL invalide'); return; }

    const files = listFiles(current);
    files.unshift({ name, url, ts: Date.now() });
    save();
    fileForm.reset();
    renderFiles();
  });

  // Drag & drop d’un lien
  el.addEventListener('dragover', (ev)=>{ ev.preventDefault(); });
  el.addEventListener('drop', (ev)=>{
    ev.preventDefault();
    const data = ev.dataTransfer.getData('text/uri-list') || ev.dataTransfer.getData('text');
    if (!data) return;
    const url = normalizeUrl(data);
    try{ new URL(url); }catch{ return; }
    const name = safeName(url.split('/').pop() || 'Lien');
    const files = listFiles(current);
    files.unshift({ name, url, ts: Date.now() });
    save(); renderFiles();
  });

  // ====== Init ======
  // s’assurer que la racine existe dans filesByFolder
  state.filesByFolder[''] ||= [];
  save();
  renderAll();

  return { destroy(){ /* rien */ } };
}