// === Classi ===

// Mappa i campi dell'API TheSportsDB in un oggetto con nomi italiani leggibili
class Squadra {
  constructor(data) {
    this.id = data.idTeam;
    this.nome = data.strTeam;
    this.logo = data.strBadge;
    this.lega = data.strLeague;
    this.paese = data.strCountry;
    this.sport = data.strSport;
  }
}

// Mappa i campi di un evento (partita) e aggiunge due metodi di utilità
class Evento {
  constructor(data) {
    this.id = data.idEvent;
    this.data = data.dateEvent;
    this.casa = data.strHomeTeam;
    this.trasferta = data.strAwayTeam;
    this.punteggioCasa = data.intHomeScore;
    this.punteggioTrasferta = data.intAwayScore;
  }

  // Converte "YYYY-MM-DD" in "DD/MM/YYYY"
  formatData() {
    if (!this.data) return "";
    const [y, m, d] = this.data.split("-");
    return `${d}/${m}/${y}`;
  }

  // Ritorna la stringa punteggio oppure null se la partita non è ancora giocata
  punteggio() {
    if (this.punteggioCasa === null || this.punteggioCasa === undefined)
      return null;
    return `${this.punteggioCasa} – ${this.punteggioTrasferta}`;
  }
}

// === API ===

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

// Chiama l'endpoint di ricerca e ritorna un array di istanze Squadra.
// encodeURIComponent evita errori se il nome contiene spazi o caratteri speciali.
async function cercaSquadre(query) {
  const res = await fetch(
    `${BASE_URL}/searchteams.php?t=${encodeURIComponent(query)}`,
  );
  // fetch non lancia errori per status HTTP 4xx/5xx, quindi lo controlliamo a mano
  if (!res.ok) throw new Error("Errore di rete");
  const data = await res.json();
  // L'API ritorna { teams: null } se non trova nulla, || [] lo normalizza ad array vuoto
  return (data.teams || []).map((t) => new Squadra(t));
}

// Carica prossimi eventi e ultimi risultati di una squadra in parallelo con Promise.all,
// così le due richieste partono contemporaneamente invece di aspettarsi a vicenda.
async function caricaDettagli(idTeam) {
  const [resNext, resLast] = await Promise.all([
    fetch(`${BASE_URL}/eventsnext.php?id=${idTeam}`),
    fetch(`${BASE_URL}/eventslast.php?id=${idTeam}`),
  ]);
  // Seconda Promise.all per leggere i body in parallelo, stessa logica
  const [dataNext, dataLast] = await Promise.all([
    resNext.json(),
    resLast.json(),
  ]);
  return {
    prossimi: (dataNext.events || []).map((e) => new Evento(e)),
    // L'endpoint eventslast usa la chiave "results" invece di "events"
    ultimi: (dataLast.results || []).map((e) => new Evento(e)),
  };
}

// Recupera solo i prossimi eventi di una squadra (più leggero di caricaDettagli)
async function caricaProssimoEvento(idTeam) {
  const res = await fetch(`${BASE_URL}/eventsnext.php?id=${idTeam}`);
  if (!res.ok) throw new Error("Errore di rete");
  const data = await res.json();
  return (data.events || []).map((e) => new Evento(e));
}

// === Stato ===

let squadreCorrente = [];
// Carichiamo i preferiti dal localStorage all'avvio: se non esiste ancora la chiave, partiamo da array vuoto
let preferite = JSON.parse(localStorage.getItem("preferite")) || [];

function salvaPreferite() {
  localStorage.setItem("preferite", JSON.stringify(preferite));
}

function aggiungiPreferita(squadra) {
  // Evitiamo duplicati confrontando gli id
  if (preferite.find((s) => s.id === squadra.id)) return;
  preferite.push(squadra);
  salvaPreferite();
  renderPreferite();
  caricaEventiPreferite();
  // Aggiorniamo i bottoni nei risultati per riflettere il nuovo stato
  renderRisultati(squadreCorrente);
}

function rimuoviPreferita(id) {
  preferite = preferite.filter((s) => s.id !== id);
  salvaPreferite();
  renderPreferite();
  caricaEventiPreferite();
  // Aggiorniamo i bottoni nei risultati per riflettere il nuovo stato
  renderRisultati(squadreCorrente);
}

// === Utilità ===

// Crea un <p> con classe e testo
function creaP(classe, testo) {
  const p = document.createElement("p");
  p.className = classe;
  p.textContent = testo;
  return p;
}

// Popola i campi visivi comuni a entrambi i tipi di card (risultato e preferita)
function popolaCard(clone, squadra) {
  clone.querySelector(".card-logo").src = squadra.logo;
  clone.querySelector(".card-logo").alt = squadra.nome;
  clone.querySelector(".card-nome").textContent = squadra.nome;
  clone.querySelector(".card-lega").textContent = squadra.lega;
  clone.querySelector(".card-paese").textContent = squadra.paese;
}

// === Riferimenti DOM (cachati una volta sola) ===

const tmplCard = document.getElementById("tmpl-card");
const tmplCardPreferita = document.getElementById("tmpl-card-preferita");
const tmplEventoItem = document.getElementById("tmpl-evento-item");
const tmplAppuntamento = document.getElementById("tmpl-appuntamento");
const tmplModal = document.getElementById("tmpl-modal");

const elAppuntamentiSection = document.getElementById("appuntamenti-section");
const elAppuntamentiLista = document.getElementById("appuntamenti-lista");
const elFiltriSport = document.getElementById("filtri-sport");
const elPreferiteGrid = document.getElementById("preferite-grid");
const elPreferitePlaceholder = document.getElementById("preferite-placeholder");
const elRisultatiGrid = document.getElementById("risultati-grid");
const elRisultatiPlaceholder = document.getElementById("risultati-placeholder");
const elModalContainer = document.getElementById("modal-container");
const elSpinner = document.getElementById("spinner");
const elErroreMsg = document.getElementById("errore-msg");
const elSearchInput = document.getElementById("search-input");

// === Render ===

// Crea i bottoni filtro per sport unici presenti nei risultati.
// Se tutti i risultati appartengono allo stesso sport, non mostra nulla.
function renderFiltri(squadre) {
  elFiltriSport.replaceChildren();

  const sport = [...new Set(squadre.map((s) => s.sport).filter(Boolean))];
  if (sport.length === 0) return;

  const creaBottone = (etichetta, onClick) => {
    const btn = document.createElement("button");
    btn.textContent = etichetta;
    btn.className = "btn-filtro";
    btn.addEventListener("click", () => {
      elFiltriSport
        .querySelectorAll(".btn-filtro")
        .forEach((b) => b.classList.remove("btn-filtro--attivo"));
      btn.classList.add("btn-filtro--attivo");
      onClick();
    });
    return btn;
  };

  const btnTutti = creaBottone("Tutti", () => renderRisultati(squadreCorrente));
  btnTutti.classList.add("btn-filtro--attivo");
  elFiltriSport.appendChild(btnTutti);

  sport.forEach((s) => {
    elFiltriSport.appendChild(
      creaBottone(s, () =>
        renderRisultati(squadreCorrente.filter((sq) => sq.sport === s)),
      ),
    );
  });
}

// Svuota la griglia dei preferiti e la ripopola; mostra il placeholder se vuota
function renderPreferite() {
  elPreferiteGrid.replaceChildren();

  if (preferite.length === 0) {
    elPreferitePlaceholder.hidden = false;
    return;
  }

  elPreferitePlaceholder.hidden = true;
  preferite.forEach((squadra) => {
    const clone = tmplCardPreferita.content.cloneNode(true);
    popolaCard(clone, squadra);
    // Click sul bottone Rimuovi: stopPropagation evita che il click raggiunga la card
    clone.querySelector(".card-prossimo-evento").textContent = "Caricamento...";
    clone.querySelector(".btn-rimuovi").addEventListener("click", (e) => {
      e.stopPropagation();
      rimuoviPreferita(squadra.id);
    });
    // Click sul corpo della card apre i dettagli
    clone
      .querySelector(".card")
      .addEventListener("click", () => onCardClick(squadra));
    elPreferiteGrid.appendChild(clone);
  });
}

function renderAppuntamenti(eventi) {
  if (eventi.length === 0) {
    elAppuntamentiSection.hidden = true;
    return;
  }

  elAppuntamentiSection.hidden = false;
  elAppuntamentiLista.replaceChildren();

  eventi.forEach(({ ev, squadra }) => {
    const clone = tmplAppuntamento.content.cloneNode(true);
    clone.querySelector(".appuntamento-data").textContent = ev.formatData();
    clone.querySelector(".appuntamento-squadra").textContent = squadra.nome;
    clone.querySelector(".appuntamento-partita").textContent =
      `${ev.casa} vs ${ev.trasferta}`;
    elAppuntamentiLista.appendChild(clone);
  });
}

// Recupera in parallelo il prossimo evento per ogni preferita con Promise.allSettled,
// così un singolo fallimento non blocca le altre card.
async function caricaEventiPreferite() {
  if (preferite.length === 0) {
    elAppuntamentiSection.hidden = true;
    return;
  }

  const risultati = await Promise.allSettled(
    preferite.map((s) => caricaProssimoEvento(s.id)),
  );

  // Aggiorna il testo del prossimo evento su ogni card preferita
  const els = elPreferiteGrid.querySelectorAll(".card-prossimo-evento");
  risultati.forEach((risultato, i) => {
    const el = els[i];
    if (!el) return;
    if (risultato.status === "fulfilled" && risultato.value.length > 0) {
      const ev = risultato.value[0];
      el.textContent = `${ev.formatData()} — ${ev.casa} vs ${ev.trasferta}`;
    } else {
      el.textContent = "Nessun evento in programma";
    }
  });

  // Aggrega tutti gli eventi di tutte le preferite e li ordina per data
  const tuttiEventi = [];
  risultati.forEach((risultato, i) => {
    if (risultato.status === "fulfilled") {
      risultato.value.forEach((ev) => {
        tuttiEventi.push({ ev, squadra: preferite[i] });
      });
    }
  });
  tuttiEventi.sort((a, b) => a.ev.data.localeCompare(b.ev.data));
  renderAppuntamenti(tuttiEventi);
}

// Svuota la griglia dei risultati e la ripopola clonando il template per ogni squadra
function renderRisultati(squadre) {
  elRisultatiGrid.replaceChildren();

  if (squadre.length === 0) {
    elRisultatiPlaceholder.textContent = "Nessuna squadra trovata.";
    elRisultatiPlaceholder.hidden = false;
    return;
  }

  elRisultatiPlaceholder.hidden = true;
  squadre.forEach((squadra) => {
    // cloneNode(true) copia l'intero sottoalbero del template
    const clone = tmplCard.content.cloneNode(true);
    popolaCard(clone, squadra);

    const btnAggiungi = clone.querySelector(".btn-aggiungi");
    const giaPreferita = preferite.some((s) => s.id === squadra.id);
    if (giaPreferita) {
      // Disabilitiamo il bottone se la squadra è già nei preferiti
      btnAggiungi.textContent = "✓ Aggiunta";
      btnAggiungi.disabled = true;
    } else {
      btnAggiungi.addEventListener("click", (e) => {
        e.stopPropagation();
        aggiungiPreferita(squadra);
      });
    }

    // Ogni card porta con sé il riferimento alla propria squadra tramite la closure
    clone
      .querySelector(".card")
      .addEventListener("click", () => onCardClick(squadra));
    elRisultatiGrid.appendChild(clone);
  });
}

// Popola una lista di eventi (prossimi o ultimi) nel contenitore indicato.
// conPunteggio = true mostra il badge verde con il risultato (solo per gli ultimi)
function renderEventi(eventi, container, conPunteggio) {
  container.replaceChildren();

  if (eventi.length === 0) {
    container.appendChild(
      creaP("placeholder-eventi", "Nessun evento in programma"),
    );
    return;
  }

  eventi.forEach((ev) => {
    const clone = tmplEventoItem.content.cloneNode(true);
    clone.querySelector(".evento-data").textContent = ev.formatData();
    clone.querySelector(".evento-partita").textContent =
      `${ev.casa} vs ${ev.trasferta}`;
    if (conPunteggio) {
      const p = ev.punteggio();
      // Mostriamo il badge solo se il punteggio esiste (partita già giocata)
      if (p !== null) {
        const badge = clone.querySelector(".badge-punteggio");
        badge.textContent = p;
        badge.hidden = false;
      }
    }
    container.appendChild(clone);
  });
}

function chiudiModal() {
  elModalContainer.replaceChildren();
}

// Clona il template modal, lo popola con i placeholder e lo inserisce nel DOM.
// Poi carica i dettagli in modo asincrono e aggiorna le liste già visibili.
async function onCardClick(squadra) {
  const clone = tmplModal.content.cloneNode(true);

  // Salviamo i riferimenti ai nodi prima che il fragment venga consumato dall'append
  const overlay = clone.querySelector(".modal-overlay");
  const prossimiLista = clone.querySelector(".modal-prossimi");
  const ultimiLista = clone.querySelector(".modal-ultimi");

  clone.querySelector(".modal-nome").textContent = squadra.nome;
  clone.querySelector(".modal-chiudi").addEventListener("click", chiudiModal);
  // Clic sull'overlay (fuori dalla modal) chiude senza toccare il contenuto interno
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) chiudiModal();
  });

  prossimiLista.appendChild(creaP("placeholder-eventi", "Caricamento..."));
  ultimiLista.appendChild(creaP("placeholder-eventi", "Caricamento..."));

  elModalContainer.replaceChildren(clone);

  try {
    const { prossimi, ultimi } = await caricaDettagli(squadra.id);
    renderEventi(prossimi, prossimiLista, false);
    renderEventi(ultimi, ultimiLista, true);
  } catch {
    prossimiLista.replaceChildren(
      creaP("errore", "Errore nel caricamento dei dettagli."),
    );
  }
}

// === Eventi ===

async function eseguiRicerca() {
  const query = elSearchInput.value.trim();
  if (!query) return;

  // Resettiamo lo stato visivo prima di ogni nuova ricerca
  elSpinner.hidden = false;
  elErroreMsg.hidden = true;
  elRisultatiPlaceholder.hidden = true;
  elFiltriSport.replaceChildren();
  elRisultatiGrid.replaceChildren();
  chiudiModal();

  try {
    const termini = query
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const risultati = await Promise.all(termini.map((t) => cercaSquadre(t)));
    // flat() unisce gli array di ogni termine in uno solo
    const tutte = risultati.flat();
    // Rimuoviamo i duplicati in caso lo stesso team esca in più ricerche
    const viste = new Set();
    squadreCorrente = tutte.filter((s) => {
      if (viste.has(s.id)) return false;
      viste.add(s.id);
      return true;
    });
    renderFiltri(squadreCorrente);
    renderRisultati(squadreCorrente);
  } catch {
    elErroreMsg.textContent = "Errore durante la ricerca. Riprova.";
    elErroreMsg.hidden = false;
  } finally {
    // finally garantisce che lo spinner sparisca sempre, anche in caso di errore
    elSpinner.hidden = true;
  }
}

document.getElementById("search-btn").addEventListener("click", eseguiRicerca);
// Permette di cercare premendo Invio senza dover cliccare il bottone
elSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") eseguiRicerca();
});

// === Init ===

// All'avvio rendiamo i preferiti e carichiamo subito i loro prossimi eventi
renderPreferite();
caricaEventiPreferite();
