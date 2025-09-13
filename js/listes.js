export function init(el, core){
  const { $, state, save, escapeHTML } = core;
  state.tasks ||= [];

  el.innerHTML = `
    <section>
      <h2>Listes</h2>
      <div class="addbar">
        <form id="taskForm" class="grid2">
          <input id="taskInput" placeholder="Nouvelle tâche..." required>
          <input id="taskWho" placeholder="Assignée à (optionnel)">
          <button class="btn btn-primary">Ajouter</button>
        </form>
      </div>
      <ul class="list" id="taskList"></ul>
      <div class="row row-end"><button id="clearDone" class="btn btn-danger">Supprimer les terminées</button></div>
    </section>
  `;

  const form = $('#taskForm', el), input=$('#taskInput', el), who=$('#taskWho', el), list=$('#taskList', el);
  const clearBtn = $('#clearDone', el);

  function render(){
    list.innerHTML = '';
    state.tasks.forEach((t,i)=>{
      const li = document.createElement('li'); li.className='item';
      li.innerHTML = `
        <input type="checkbox" ${t.done?'checked':''} aria-label="Terminer">
        <div><div>${escapeHTML(t.text)}</div><div class="who">${escapeHTML(t.who||'Tous')}</div></div>
        <div class="spacer"></div>
        <button class="del">Suppr</button>`;
      li.querySelector('input').onchange = (ev)=>{ t.done = ev.target.checked; save(); };
      li.querySelector('.del').onclick   = ()=>{ state.tasks.splice(i,1); save(); render(); };
      list.appendChild(li);
    });
  }

  form.onsubmit = (e)=>{ e.preventDefault();
    const text = (input.value||'').trim(); if(!text) return;
    state.tasks.unshift({ text, who: who.value||'Tous', done:false, ts:Date.now() });
    save(); form.reset(); render();
  };
  clearBtn.onclick = ()=>{ state.tasks = state.tasks.filter(t=>!t.done); save(); render(); };

  render();
  return { destroy(){} };
}
export function destroy(){}