export function init(el, core){
  const { $, escapeHTML, WORKER_URL, SECRET, ROOM } = core;

  el.innerHTML = `
    <section>
      <h2>Messages</h2>
      <div class="row">
        <input id="chatName" placeholder="Ton nom (optionnel)">
        <div class="spacer"></div>
        <input id="chatFile" type="file">
        <button id="chatUpload" class="btn">Uploader</button>
      </div>
      <div class="chat-messages" id="chatList"></div>
      <div class="row" style="margin-top:8px">
        <input id="chatInput" placeholder="Écris un message... (Entrée pour envoyer)">
        <button id="chatSend" class="btn btn-primary">Envoyer</button>
      </div>
    </section>
  `;

  const chatList=$('#chatList', el), chatInput=$('#chatInput', el), chatSend=$('#chatSend', el), chatFile=$('#chatFile', el), chatUpload=$('#chatUpload', el), chatName=$('#chatName', el);

  const NAME_KEY = 'familyApp.chatName';
  chatName.value = localStorage.getItem(NAME_KEY) || '';
  chatName.onchange = ()=> localStorage.setItem(NAME_KEY, (chatName.value||'').trim());

  let lastTs = 0;
  const linkify = t => escapeHTML(t).replace(/https?:\/\/\S+/g, m => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
  const scrollBottom = ()=>{ chatList.scrollTop = chatList.scrollHeight; };
  function renderMessages(msgs){
    for(const m of msgs){
      const me = (chatName?.value || '').trim() && (m.author||'') === (chatName?.value||'').trim();
      const el = document.createElement('div'); el.className = 'msg' + (me ? ' me' : '');
      el.innerHTML = `<div class="bubble"><div>${linkify(m.text)}</div><div class="meta">${escapeHTML(m.author||'Anonyme')} · ${new Date(m.ts).toLocaleString('fr-FR')}</div></div>`;
      chatList.appendChild(el);
      lastTs = Math.max(lastTs, m.ts);
    }
    scrollBottom();
  }
  async function refreshMessages(){
    try{
      const r = await fetch(`${WORKER_URL}/messages?room=${encodeURIComponent(ROOM)}&since=${lastTs}`);
      if(!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data.messages) && data.messages.length) renderMessages(data.messages);
    }catch(e){}
  }
  async function uploadFile(){
    if (!chatFile?.files?.length) { alert('Choisis un fichier'); return null; }
    const f = chatFile.files[0];
    chatUpload.setAttribute('disabled','true'); chatSend.setAttribute('disabled','true');
    const old = chatSend.textContent; chatSend.textContent='Envoi…';
    try{
      const fd = new FormData();
      fd.append('file', f); fd.append('author', (chatName?.value || 'Anonyme')); fd.append('room', ROOM);
      const r = await fetch(`${WORKER_URL}/upload`, { method:'POST', headers:{ Authorization:'Bearer '+SECRET }, body: fd });
      if (!r.ok) { alert('Échec upload'); return null; }
      const data = await r.json().catch(()=> ({}));
      chatFile.value = ''; return data.url || null;
    } finally {
      chatUpload.removeAttribute('disabled'); chatSend.removeAttribute('disabled'); chatSend.textContent = old||'Envoyer';
    }
  }
  async function sendMessage(){
    const hasFile = !!(chatFile?.files && chatFile.files.length);
    const text = (chatInput?.value || '').trim();
    const author = (chatName?.value || 'Anonyme').trim() || 'Anonyme';
    if (hasFile){
      const url = await uploadFile();
      if (url && text) {
        chatInput.value = '';
        await fetch(`${WORKER_URL}/messages`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET }, body: JSON.stringify({ room: ROOM, author, text }) });
      }
      setTimeout(refreshMessages, 250); return;
    }
    if (!text) return;
    chatInput.value = '';
    await fetch(`${WORKER_URL}/messages`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+SECRET }, body: JSON.stringify({ room: ROOM, author, text }) });
    renderMessages([{ author, text, ts: Date.now() }]);
    setTimeout(refreshMessages, 200);
  }
  chatSend.onclick = sendMessage;
  chatInput.onkeydown = e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }};
  chatUpload.onclick = uploadFile;

  refreshMessages(); const timer = setInterval(refreshMessages, 4000);
  return { destroy(){ clearInterval(timer); } };
}
export function destroy(){}