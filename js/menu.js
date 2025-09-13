// js/menu.js
export function init(el, core){
  const BASE_URL = "https://clicetmiam.fr/mesmenus/5387/5765/";

  // fonction pour formatter la date au format YYYY/MM/DD
  function partsFromDate(d){
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth()+1).padStart(2,'0');
    const dd   = String(d.getDate()).padStart(2,'0');
    return { yyyy, mm, dd };
  }

  const today = new Date();
  const { yyyy, mm, dd } = partsFromDate(today);

  const url = `${BASE_URL}${yyyy}/${mm}/${dd}`;

  // redirige directement
  window.location.href = url;

  return { destroy(){} };
}