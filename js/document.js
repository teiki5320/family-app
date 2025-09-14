// js/document.js
// Documents avec dossiers + fichiers (IndexedDB). La barre d’ajout est cachée à la racine.

const LS_KEY = 'familyApp.docs.v2';
const DB_NAME = 'familyDocs';
const DB_STORE = 'files';

// --- IndexedDB helpers ---
function openDB(){
  return new Promise((res, rej)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = ()=> {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)){
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = ()=> res(req.result);
    req.onerror  = ()=> rej(req.error);
  });
}
async function idbPut(record){
  const db = await openDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(record);
    tx.oncomplete = ()=> res();
    tx.onerror    = ()=> rej(tx.error);
  });
}
async function idbGet(key){
  const db = await openDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction(DB_STORE, 'readonly');
    const rq = tx.objectStore(DB_STORE).get(key);
    rq.onsuccess = ()=> res(rq.result || null);
    rq.onerror   = ()=> rej(rq.error);
  });
}
async function idbDel(key){
  const db = await openDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = ()=> res();
    tx.onerror    = ()=> rej(tx.error);
  });
}

// --- small helpers ---
function safeName(s){ return String(s||'').trim().replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').slice(0,120); }
function join(parent, name){ return parent ? `${parent}/${name}` : name; }
function parentOf(p){ return p.includes('/') ? p.split('/').slice(0,-1).join('/') : ''; }
function isImgType(t){ return /^image\//i.test(t||''); }
function isPdfType(t){ return /^application\/pdf$/i.test(t||''); }

export function init(el, core){
  // ========== état ==========
  let state = loadState();
  let current = ''; // "" = racine

  // ========== rendu ==========
  el.innerHTML = `
    <section class="fade-in">
      <h2>Documents</h2>

      <div class="row" style="margin:6px 0 10px">
        <span class="chip">Dossier: <strong id="curLabel">Racine</strong></span>
        <div class="spacer"></div>
        <button id="btnNewFolder" class="ghost">Nouveau dossier</button>
        <button id="btnDelFolder" class="btn-danger">Supprimer ce dossier</button>
      </div>

      <!-- Barre d’ajout de fichiers (cachée à la racine) -->
      <div class="addbar row" id="fileAddBar">
        <input id="filePicker" type="file" multiple hidden>
        <button id="btnAddFile" class="btn">Ajouter un fichier…</button>
        <span id="hint" class="muted" style="margin-left:8px">Tu peux aussi glisser un fichier ici.</span>
      </div>

      <div id="folderGrid" class="folder-grid" style="margin-bottom:12px"></div>
      <div id="fileGrid" class="file-grid"></div>
    </section>
  `;

  const $ = (s)=> el.querySelector(s);
  const folderGrid = $('#folderGrid');
  const fileGrid   = $('#fileGrid');
  const curLabel   = $('#curLabel');
  const btnNew     = $('#btnNewFolder');
  const btnDel     = $('#btnDelFolder');
  const btnAdd     = $('#btnAddFile');
  const picker     = $('#filePicker');
  const addBar     = $('#fileAddBar');     // <- on la montre/masque selon le dossier

  // ========== persistance méta ==========
  function loadState(){
    try{
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      const st = {
        folders: Array.isArray(raw.folders) ? raw.folders : [],
        filesByFolder: raw.filesByFolder && typeof raw.filesByFolder==='object' ? raw.filesByFolder : {}
      };
      st.folders = Array.from(new Set(st.folders)).sort();
      st.filesByFolder[''] ||= []; // racine
      return st;
    }catch{ return { folders:[], filesByFolder:{ '':[] } }; }
  }
  function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

  function listFiles(path){ return (state.filesByFolder[path||''] ||= []); }
  function ensureFolder(path){
    if (!path) return;
    if (!state.folders.includes(path)){ state.folders.push(path); state.folders.sort(); }
    state.filesByFolder[path] ||= [];
  }
  function childrenFolders(path){
    const prefix = path ? path + '/' : '';
    const depth  = path ? path.split('/').length + 1 : 1;
    return state.folders
      .filter(f => f.startsWith(prefix) && f.split('/').length === depth)
      .map(f => f.slice(prefix.length))
      .sort();
  }
  function removeFolderRecursive(path){
    const prefix = path ? path + '/' : '';
    const toRemove = state.folders.filter(f => f===path || f.startsWith(prefix));
    toRemove.concat([path]).forEach(p=>{
      const arr = state.filesByFolder[p] || [];
      arr.forEach(f=> idbDel(f.key).catch(()=>{}));
    });
    toRemove.forEach(p=> delete state.filesByFolder[p]);
    state.folders = state.folders.filter(f => !toRemove.includes(f));
    if (current === path) current = parentOf(path);
    saveState();
  }

  // ========== rendu ==========
  function renderBreadcrumb(){
    curLabel.textContent = current || 'Racine';
    folderGrid.innerHTML = '';

    // Affiche/masque la barre d’ajout en fonction du dossier (cachée à la racine)
    addBar.style.display = current ? 'flex' : 'none';

    const trail = document.createElement('div');
    trail.className = 'row';
    trail.style.gridColumn = '1 / -1';
    trail.style.marginBottom = '6px';

    const home = document.createElement('button');
    home.className = 'ghost';
    home.textContent = '🏠 Racine';
    home.onclick = ()=> { current=''; renderAll(); };
    trail.appendChild(home);

    if (current){
      let acc = '';
      current.split('/').forEach((part, idx, arr)=>{
        const sep = document.createElement('span'); sep.style.opacity=.5; sep.style.margin='0 6px'; sep.textContent='/';
        trail.appendChild(sep);
        acc = acc ? acc + '/' + part : part;
        const b = document.createElement('button'); b.className='ghost'; b.textContent=part;
        b.onclick = ()=> { current = arr.slice(0, idx+1).join('/'); renderAll(); };
        trail.appendChild(b);
      });
    }
    folderGrid.appendChild(trail);
  }

  function renderFolders(){
    const items = childrenFolders(current);
    if (!items.length) return;
    items.forEach(name=>{
      const card = document.createElement('button');
      card.className = 'tile';
      card.style.alignItems = 'flex-start';
      card.innerHTML = `<div class="icon">📁</div><div class="title">${core.escapeHTML(name)}</div><div class="subtitle">Ouvrir</div>`;
      card.onclick = ()=> { current = join(current, name); renderAll(); };
      folderGrid.appendChild(card);
    });
  }

  async function renderFiles(){
    fileGrid.innerHTML = '';
    const files = listFiles(current);
    if (!files.length) return;

    const items = [...files].sort((a,b)=> (b.ts||0)-(a.ts||0));
    for (const f of items){
      const card = document.createElement('div');
      card.className = 'file-card';

      const ph = document.createElement('div');
      ph.className = 'thumb';
      ph.style.display='flex'; ph.style.alignItems='center'; ph.style.justifyContent='center'; ph.style.fontSize='36px';
      ph.textContent = '📦';
      card.appendChild(ph);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = f.name || 'Fichier';
      card.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = new Date(f.ts||Date.now()).toLocaleString('fr-FR');
      card.appendChild(meta);

      const actions = document.createElement('div'); actions.className='file-actions';
      const openBtn = document.createElement('button'); openBtn.className='ghost'; openBtn.textContent='Ouvrir';
      const delBtn  = document.createElement('button'); delBtn.className='del btn-danger'; delBtn.textContent='Suppr';
      actions.append(openBtn, delBtn);
      card.appendChild(actions);

      try{
        const rec = await idbGet(f.key);
        if (rec && rec.blob){
          const blob = rec.blob;
          const url  = URL.createObjectURL(blob);
          if (isImgType(blob.type)){
            const img = document.createElement('img');
            img.className = 'thumb'; img.src = url; img.alt = f.name;
            card.replaceChild(img, ph);
          } else {
            ph.textContent = isPdfType(blob.type) ? '📄' : '📦';
          }
          openBtn.onclick = ()=> { const a=document.createElement('a'); a.href=url; a.download=f.name || 'fichier'; a.target='_blank'; a.click(); };
          delBtn.onclick = async ()=>{
            if (!confirm(`Supprimer "${f.name}" ?`)) return;
            await idbDel(f.key).catch(()=>{});
            const arr = listFiles(current);
            const idx = arr.indexOf(f);
            if (idx>-1) arr.splice(idx,1);
            saveState();
            URL.revokeObjectURL(url);
            renderFiles();
          };
        } else {
          // entrée orpheline
          const arr = listFiles(current);
          const idx = arr.indexOf(f);
          if (idx>-1){ arr.splice(idx,1); saveState(); }
          continue;
        }
      } catch(e){}

      fileGrid.appendChild(card);
    }
  }

  function renderAll(){
    renderBreadcrumb();
    renderFolders();
    renderFiles();
  }

  // ========== actions ==========
  btnNew.addEventListener('click', ()=>{
    const name = safeName(prompt('Nom du nouveau dossier ?') || '');
    if (!name) return;
    const path = join(current, name);
    if (state.folders.includes(path)){ alert('Existe déjà.'); return; }
    ensureFolder(path); saveState(); renderAll();
  });

  btnDel.addEventListener('click', ()=>{
    if (!current){ alert('Tu es à la racine.'); return; }
    if (!confirm(`Supprimer le dossier "${current}" et tout son contenu ?`)) return;
    removeFolderRecursive(current); renderAll();
  });

  btnAdd.addEventListener('click', ()=>{
    if (!current){ alert('Choisis un dossier avant d’ajouter un fichier.'); return; }
    picker.click();
  });

  picker.addEventListener('change', async ()=>{
    if (!current) { picker.value=''; return; } // protection racine
    const files = Array.from(picker.files || []);
    if (!files.length) return;
    for (const file of files){
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      await idbPut({ key, blob: file, name: file.name, uploaded: Date.now(), type: file.type });
      listFiles(current).unshift({ key, name: file.name, ts: Date.now(), type: file.type });
    }
    saveState();
    picker.value = '';
    renderFiles();
  });

  // drag & drop : ignoré à la racine
  el.addEventListener('dragover', (ev)=>{ ev.preventDefault(); });
  el.addEventListener('drop', async (ev)=>{
    ev.preventDefault();
    if (!current) return; // pas d’ajout à la racine
    const items = ev.dataTransfer.items;
    if (!items) return;
    const files = [];
    for (const it of items){
      if (it.kind === 'file'){
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    for (const file of files){
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      await idbPut({ key, blob: file, name: file.name, uploaded: Date.now(), type: file.type });
      listFiles(current).unshift({ key, name: file.name, ts: Date.now(), type: file.type });
    }
    saveState();
    renderFiles();
  });

  // ========== init ==========
  renderAll();
  return { destroy(){} };
}