# SportsHub

Applicazione web per cercare squadre sportive, scoprire i prossimi eventi e gli ultimi risultati, e salvare le squadre preferite.

## Funzionalità

- **Ricerca squadre** tramite nome, con invio da tastiera o click sul bottone — supporta più nomi separati da virgola (es. `Arsenal, Los Angeles Lakers`)
- **Filtro per sport** generato dinamicamente dai risultati della ricerca
- **Modal dettagli** con prossimi eventi e ultimi risultati al click su una card
- **Squadre preferite** salvate in `localStorage`, persistenti tra le sessioni
- **Prossimo evento** caricato automaticamente per ogni squadra preferita all'avvio
- **Prossimi appuntamenti** — vista aggregata e ordinata per data di tutti i prossimi eventi delle squadre preferite

## Tecnologie

- HTML5, CSS3, JavaScript ES6+ (vanilla, nessun framework)
- CSS Grid e Flexbox, layout mobile-first (breakpoint: 768px, 1200px)
- `<template>` HTML per il rendering delle card senza `innerHTML`
- `fetch` + `async/await` + `Promise.allSettled` per le chiamate API
- `localStorage` per la persistenza dei preferiti
- Google Fonts (Roboto)

## API

[TheSportsDB](https://www.thesportsdb.com/) — chiave gratuita `3`

| Endpoint | Utilizzo |
|---|---|
| `/searchteams.php?t={nome}` | Ricerca squadre per nome |
| `/eventsnext.php?id={id}` | Prossimi eventi di una squadra |
| `/eventslast.php?id={id}` | Ultimi risultati di una squadra |

> La chiave gratuita richiede il nome completo della squadra (es. "Los Angeles Lakers" invece di "Lakers").

## Struttura

```
PROGETTO-SETTIMANA-7/
├── index.html
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
└── README.md
```

## Come avviare

Apri `index.html` direttamente nel browser oppure usa un server locale (es. Live Server in VS Code).
