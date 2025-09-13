export function init(el, core) {
  // état local (pour la démo, tu pourras plus tard brancher sur localStorage comme avant)
  let tasks = [];

  // rendu principal
  el.innerHTML = `
    <section class="fade-in">
      <h2>Listes</h2>

      <!-- barre d’ajout -->
      <form id="taskForm" class="addbar">
        <input id="taskInput" placeholder="Nouvelle tâche…" required>
        <button class="btn" type="submit">Ajouter</button>
      </form>

      <!-- liste des tâches -->
      <div id="taskList" class="cards"></div>
    </section>
  `;

  const form = el.querySelector('#taskForm');
  const input = el.querySelector('#taskInput');
  const list = el.querySelector('#taskList');

  function render() {
    list.innerHTML = '';
    if (!tasks.length) {
      list.innerHTML = `<div class="card"><p class="muted">Aucune tâche pour l’instant</p></div>`;
      return;
    }
    tasks.forEach((t, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="row">
          <input type="checkbox" ${t.done ? 'checked' : ''} style="margin-right:8px">
          <div style="flex:1">${core.escapeHTML(t.text)}</div>
          <button class="del">Suppr</button>
        </div>
      `;
      card.querySelector('input').addEventListener('change', e => {
        t.done = e.target.checked;
        render();
      });
      card.querySelector('.del').addEventListener('click', () => {
        tasks.splice(i,1);
        render();
      });
      list.appendChild(card);
    });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    tasks.unshift({ text, done:false });
    input.value = '';
    render();
  });

  // affichage initial
  render();

  return { destroy(){ tasks=[]; } };
}