export function init(el, core){
  const { $, escapeHTML, WORKER_URL, SECRET } = core;

  el.innerHTML = `
    <section>
      <h2>Documents</h2>
      <div class="row" id="docsRootTools">
        <input id="newFolderName" placeholder="Nouveau dossier">
        <button id="createFolderBtn" class="btn">Créer</button>
        <div class="spacer"></div>
        <button id="deleteFolderBtn" class="btn btn-danger">Supprimer ce dossier</button>
      </div>

      <div class="box" id="fileBar" style="display:none">
        <div class="row">
          <input id="docFile" type="file" multiple>
          <button id="uploadDocBtn" class="btn btn-primary">Uploader</button>
          <div class="spacer"></div>
          <div class="muted">Dossier : <span id="currentFolderName">Racine</span></div>
        </div>
      </div>

      <div class="folder-grid" id="folderGrid"></div>
      <div id="filesArea" style="display:none">
        <div class="file-grid" id="docGrid"></div>
      </div>
    </section>
  `;

  const folderGrid=$('#folderGrid', el), filesArea=$('#filesArea', el), currentFolderName=$('#currentFolderName', el);
  const newFolderName=$('#newFolderName', el), createFolderBtn=$('#createFolderBtn', el), deleteFolderBtn=$('#deleteFolderBtn', el);
  const docFileInput=$('#docFile', el), uploadDocBtn=$('#uploadDocBtn', el), docGrid=$('#docGrid', el);
  const docsRootTools=$('#docsRootTools', el), fileBar=$('#fileBar', el);

  const DOCS = { folder:'', folders:[], files:[] };

  function isImageType(t){ return /^image\//i.test(t||''); }
  function isPdfType(t){ return /^application\/pdf$/i.test(t||''); }
  async function docsFetchJSON(url, init = {}) {
    const r = await fetch(url, { ...init, headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) }});
    if (!r.ok) throw new Error(await r.text().catch(()=>r.statusText));
    return await r.json();
  }
  async function loadEntries(folderPath = DOCS.folder) {
    const u = new URL(`${WORKER_URL}/docs/list`);
    if (folderPath) u.searchParams.set('folder', folderPath);
    const data = await docsFetchJSON(u.toString());
    DOCS.folder  = data.folder || '';
    DOCS.folders = data.folders || [];
    DOCS.files   = data.files   || [];
    renderFolderGrid(); renderFiles();
  }

  // open folder hint depuis Impôts
  const hint = sessionStorage.getItem('docs_open_folder');
  if (hint) { sessionStorage.removeItem('docs_open_folder'); loadEntries(hint).catch(()=> loadEntries('')); }
  else { loadEntries(''); }

  function renderFolderGrid() {
    folderGrid.innerHTML = '';
    folderGrid.style.display = 'grid';
    folderGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    folderGrid.style.gap = '12px';

    const trail = document.createElement('div');
    trail.className = 'row'; trail.style.gridColumn = '1 / -1'; trail.style.marginBottom = '6px';
    const homeBtn = document.createElement('button'); homeBtn.className = 'ghost'; homeBtn.textContent = '🏠 Racine';
    homeBtn.onclick = () => loadEntries('');
    trail.appendChild(homeBtn);

    const crumbs = DOCS.folder ? DOCS.folder.split('/') : [];
    let acc = '';
    crumbs.forEach((part) => {
      const sep = document.createElement('span'); sep.style.opacity = .5; sep.style.margin = '0 6px'; sep.textContent = '/';
      trail.appendChild(sep);
      acc = acc ? acc + '/' + part : part;
      const b = document.createElement('button'); b.className = 'ghost'; b.textContent = part;
      b.onclick = () => loadEntries(acc);
      trail.appendChild(b);
    });
    folderGrid.appendChild(trail);

    if (docsRootTools) docsRootTools.style.display = DOCS.folder ? 'none' : 'flex';
    if (fileBar) fileBar.style.display = DOCS.folder ? 'flex' : 'none';

    if (!DOCS.folders.length) {
      const empty = document.createElement('div'); empty.className = 'muted';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = DOCS.folder ? 'Aucun sous-dossier' : 'Aucun dossier';
      folderGrid.appendChild(empty);
    } else {
      DOCS.folders.forEach(name => {
        const card = document.createElement('button');
        card.className = 'tile'; card.style.alignItems = 'flex-start'; card.style.width = '100%';
        card.innerHTML = `<div class="icon">📁</div><div class="title">${name}</div><div class="subtitle">Ouvrir</div>`;
        card.onclick = () => { const next = DOCS.folder ? `${DOCS.folder}/${name}` : name; loadEntries(next); };
        folderGrid.appendChild(card);
      });
    }

    if (filesArea) filesArea.style.display = 'block';
    if (currentFolderName) currentFolderName.textContent = DOCS.folder || 'Racine';
  }

  function renderFiles() {
    docGrid.innerHTML = '';
    if (!DOCS.files.length) {
      const empty = document.createElement('div'); empty.className = 'muted';
      empty.textContent = `Aucun fichier dans "${currentFolderName?.textContent || 'Racine'}".`;
      docGrid.appendChild(empty); return;
    }
    const files = [...DOCS.files].sort((a,b)=> new Date(b.uploaded) - new Date(a.uploaded));
    files.forEach(f=>{
      const card = document.createElement('div'); card.className = 'file-card';
      const type = (f.httpMetadata && f.httpMetadata.contentType) || '';
      const isImg = isImageType(type); const isPdf = isPdfType(type);

      if (isImg){
        const img = document.createElement('img'); img.className='thumb'; img.alt=f.name; img.loading='lazy';
        img.src = `${WORKER_URL}/docs/get?key=${encodeURIComponent(f.key)}`;
        img.onclick = ()=> window.open(img.src, '_blank', 'noopener'); card.appendChild(img);
      } else {
        const ph = document.createElement('div'); ph.className = 'thumb';
        ph.style.display='flex'; ph.style.alignItems='center'; ph.style.justifyContent='center'; ph.style.fontSize='36px';
        ph.textContent = isPdf ? '📄' : '📦'; card.appendChild(ph);
      }
      const name = document.createElement('div'); name.className='name'; name.title=f.name; name.textContent=f.name; card.appendChild(name);
      const meta = document.createElement('div'); meta.className='meta';
      const when = new Date(f.uploaded).toLocaleString('fr-FR'); const sizeKB = (f.size/1024).toFixed(1) + ' Ko';
      meta.textContent = `${sizeKB} · ${type || 'fichier'} · ${when}`; card.appendChild(meta);

      const actions = document.createElement('div'); actions.className='file-actions';
      const openBtn = document.createElement('a'); openBtn.className='ghost'; openBtn.textContent='Ouvrir';
      openBtn.href = `${WORKER_URL}/docs/get?key=${encodeURIComponent(f.key)}`; openBtn.target='_blank'; openBtn.rel='noopener';
      const dlBtn = document.createElement('a'); dlBtn.className='ghost'; dlBtn.textContent='Télécharger';
      dlBtn.href = `${WORKER_URL}/docs/download?key=${encodeURIComponent(f.key)}`;
      const delBtn = document.createElement('button'); delBtn.className='del'; delBtn.textContent='Suppr';
      delBtn.onclick = async ()=>{ if (!confirm(`Supprimer "${f.name}" ?`)) return;
        await docsFetchJSON(`${WORKER_URL}/docs/del`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: JSON.stringify({ key: f.key }) });
        loadEntries();
      };
      actions.append(openBtn, dlBtn, delBtn); card.appendChild(actions);
      docGrid.appendChild(card);
    });
  }

  createFolderBtn.onclick = async ()=>{
    const name = (newFolderName?.value || '').trim();
    if (!name) return alert('Nom de dossier vide');
    await docsFetchJSON(`${WORKER_URL}/docs/mkdir`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: JSON.stringify({ name, parent: DOCS.folder }) });
    newFolderName.value = ''; await loadEntries(DOCS.folder);
  };
  deleteFolderBtn.onclick = async ()=>{
    if (!DOCS.folder) return alert('Tu es à la racine.');
    if (!confirm(`Supprimer le dossier "${DOCS.folder}" et tout son contenu ?`)) return;
    await docsFetchJSON(`${WORKER_URL}/docs/rmdir`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET, 'x-confirm-delete':'yes' }, body: JSON.stringify({ folder: DOCS.folder }) });
    const parent = DOCS.folder.includes('/') ? DOCS.folder.split('/').slice(0,-1).join('/') : '';
    await loadEntries(parent);
  };
  uploadDocBtn.onclick = async ()=>{
    if (!docFileInput?.files?.length) return alert('Choisis un ou plusieurs fichiers');
    const fd = new FormData(); fd.append('folder', DOCS.folder); for (const f of docFileInput.files) fd.append('file', f);
    const r = await fetch(`${WORKER_URL}/docs/upload`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: fd });
    if (!r.ok) return alert('Upload échoué: ' + (await r.text().catch(()=>r.statusText)));
    docFileInput.value = ''; loadEntries();
  };

  return { destroy(){ } };
}
export function destroy(){}