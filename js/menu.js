export function init(el, core){
  const tz = "Europe/Paris";
  const MENU_PREFIX = "https://clicetmiam.fr/mesmenus/5387/5765/";
  function partsFromDate(d){
    const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
    const [{ value: dd }, , { value: mm }, , { value: yyyy }] = fmt.formatToParts(d);
    return { yyyy, mm, dd };
  }
  function buildMenuUrl(d){ const { yyyy, mm, dd } = partsFromDate(d); return MENU_PREFIX + `${yyyy}/${mm}/${dd}Menu`; }

  el.innerHTML = `
    <section>
      <h2>Menu - Clic & Miam</h2>
      <div class="row">
        <button id="openToday" class="btn btn-primary">Ouvrir le menu d'aujourd'hui</button>
        <div class="spacer"></div>
        <input id="menuDate" type="date">
        <button id="openDate" class="btn">Ouvrir cette date</button>
      </div>
      <div class="box" style="margin-top:12px">
        <div class="section-body">
          Raccourci rapide pour consulter les menus sur clicetmiam.fr.
        </div>
      </div>
    </section>
  `;
  const d = new Date();
  const menuDate = el.querySelector('#menuDate'); if (menuDate) menuDate.valueAsDate = d;
  el.querySelector('#openToday').onclick = ()=> window.open(buildMenuUrl(new Date()), '_blank');
  el.querySelector('#openDate').onclick  = ()=>{
    const ds = menuDate.value ? new Date(menuDate.value+'T12:00:00') : new Date();
    window.open(buildMenuUrl(ds), '_blank');
  };
  return { destroy(){} };
}
export function destroy(){}