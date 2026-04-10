<h1 align="center">Auto Catalog Archive — Bulk Brochure Downloader</h1>

<p align="center">
  <i>Scarica in massa le brochure PDF di <a href="https://autocatalogarchive.com">autocatalogarchive.com</a> per qualsiasi lista di modelli auto, in un click, dal tuo browser.</i>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="autocatalogarchive-bulk-downloader.user.js"><img src="https://img.shields.io/badge/version-1.2.0-brightgreen" alt="Version"></a>
  <img src="https://img.shields.io/badge/type-userscript-7c3aed" alt="Userscript">
  <a href="https://www.tampermonkey.net/"><img src="https://img.shields.io/badge/Tampermonkey-compatible-00485B?logo=tampermonkey&logoColor=white" alt="Tampermonkey"></a>
  <a href="https://violentmonkey.github.io/"><img src="https://img.shields.io/badge/Violentmonkey-compatible-663399" alt="Violentmonkey"></a>
  <a href="#contributing"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome"></a>
</p>

<p align="center">
  <b><a href="https://github.com/0xDonnie/autocatalogarchive-scraper/raw/main/autocatalogarchive-bulk-downloader.user.js">⬇️ Installa con un click (Tampermonkey)</a></b>
  &nbsp;·&nbsp;
  <a href="#installazione">Installazione manuale</a>
  &nbsp;·&nbsp;
  <a href="#come-funziona-davvero">Come funziona</a>
  &nbsp;·&nbsp;
  <a href="#disclaimer">Disclaimer</a>
</p>

---

## Cos'è

`autocatalogarchive.com` è un archivio enorme di brochure ufficiali (cataloghi PDF) di auto di tutte le marche e di tutti gli anni. È una miniera. Però:

- non c'è un bottone "scarica tutto"
- è dietro **Cloudflare managed challenge**, quindi qualsiasi scraper esterno (curl, wget, Python `requests`, Playwright headless, anche con stealth + TLS impersonation) viene bloccato
- gli URL dei PDF sono prevedibili ma raccoglierli a mano è una rottura

Questo progetto risolve il problema con **un singolo userscript** che gira nel tuo browser normale (dove sei già passato Cloudflare in modo legittimo) e che:

1. aggiunge un pannello fluttuante a qualsiasi pagina di `autocatalogarchive.com`
2. ti fa configurare una lista di "query" (brand + filtro regex sul nome del file)
3. al click di **Scarica tutto** scansiona le pagine brand, segue la paginazione, raccoglie tutti i PDF e li scarica nel tuo Download in **cartelle separate per modello**

Niente Node, niente Python, niente server, niente API. Solo un file `.user.js`.

---

## Anteprima

```
┌────────────────────────────────────────────────────┐
│ ● Auto Catalog Archive — Bulk Downloader   42 / 87 │
├────────────────────────────────────────────────────┤
│ Mercedes G-Class    │ mercedes  │ Mercedes-G(-|6│✕│
│ Lotus (all)         │ lotus     │ ^Lotus-       │✕│
│ Abarth 500          │ fiat      │ Abarth-500    │✕│
│ Maybach S600        │ mercedes  │ Maybach       │✕│
│ Mitsubishi Evo X    │ mitsubishi│ Lancer-Evolut │✕│
│ Porsche 911 GT3 RS  │ porsche   │ 911-GT3       │✕│
│ Porsche Cayenne     │ porsche   │ Cayenne       │✕│
│   [+ aggiungi modello]   [reset default]           │
│                                                    │
│  delay (ms): [700]    cartella: [AutoCatalogArc..] │
│                                                    │
│        [forget] [clear log] [Stop] [Scarica tutto] │
├────────────────────────────────────────────────────┤
│ ▸ Mercedes G-Class — scansione /mercedes/          │
│   trovati 312 PDF totali, 24 dopo filtro           │
│   ok  Mercedes G-Class → Mercedes-G-2020-USA.pdf   │
│   ok  Mercedes G-Class → Mercedes-G-63-AMG-2023…   │
│   …                                                │
└────────────────────────────────────────────────────┘
```

---

## Installazione

### 1. Installa un userscript manager
Una di queste estensioni del browser:
- [Tampermonkey](https://www.tampermonkey.net/) (Chrome / Firefox / Edge / Safari) — **consigliato**
- [Violentmonkey](https://violentmonkey.github.io/) (open source, Chrome / Firefox / Edge)
- [Greasemonkey](https://www.greasespot.net/) (Firefox)

### 2. Installa lo script

**Modo veloce** (consigliato):

> 👉 **[Click qui per installare](https://github.com/0xDonnie/autocatalogarchive-scraper/raw/main/autocatalogarchive-bulk-downloader.user.js)** 👈

Tampermonkey rileva automaticamente che il file è uno userscript e ti mostra la schermata di install. Clicca **Install** e fine.

**Modo manuale** (se il primo non funziona):
1. Apri Tampermonkey → "Crea un nuovo script"
2. Cancella tutto il contenuto del nuovo script
3. Apri il [file userscript](autocatalogarchive-bulk-downloader.user.js), copia tutto, incolla nel Tampermonkey
4. `Ctrl+S` per salvare

**Aggiornamenti futuri**: Tampermonkey controlla automaticamente la `@version` nello header e ti propone l'update quando una versione nuova è pushata su `main`.

### 3. Usa
1. Vai su https://autocatalogarchive.com (passa il check Cloudflare la prima volta)
2. Vedrai apparire in basso a destra il pannello **Auto Catalog Archive — Bulk Downloader**
3. Modifica la lista (o lascia i 7 default) e clicca **Scarica tutto**

I PDF finiscono in `~/Downloads/AutoCatalogArchive/<Etichetta modello>/<filename.pdf>`.

> 💡 **Routing in sottocartelle** (opzionale, ma carino): in Tampermonkey vai su **Impostazioni → Modalità → Avanzata** e in **Download BETA** scegli `Browser API`. Così i PDF finiscono in `Downloads/AutoCatalogArchive/<Etichetta>/<file.pdf>`. Senza questa opzione lo script riconosce il fallimento di `GM_download`, passa automaticamente al fallback **fetch+blob+anchor** e i PDF finiscono nella cartella Downloads predefinita con il nome prefissato (es. `AutoCatalogArchive__Mercedes-G-Class__Mercedes-G-2020-USA.pdf`) per raggrupparli alfabeticamente.

> ⚠️ **Permesso "download multipli"**: Chrome al primo run mostra un banner in alto "Vuoi consentire a autocatalogarchive.com di scaricare più file?". Click **Consenti**. Senza questo permesso il browser blocca silenziosamente i download dopo il primo.

---

## Default

Lo script parte con questi 7 modelli pre-configurati (gli stessi della richiesta originale che ha fatto nascere il progetto):

| Etichetta | Brand path | Regex sul filename |
|---|---|---|
| Mercedes G-Class | `mercedes` | `Mercedes-G(-\|63\|65)` |
| Lotus (all) | `lotus` | `^Lotus-` |
| Abarth 500 | `fiat` | `Abarth-500` |
| Maybach S600 / S-Class | `mercedes` | `Maybach` |
| Mitsubishi Lancer Evo X | `mitsubishi` | `Lancer-Evolution` |
| Porsche 911 GT3 RS | `porsche` | `911-GT3` |
| Porsche Cayenne | `porsche` | `Cayenne` |

Puoi aggiungerne quanti vuoi, modificarli, eliminarli — la configurazione viene salvata localmente con `GM_setValue`.

---

## Come si configura una nuova query

Ogni riga ha 3 campi:

| Campo | Cosa metterci | Esempio |
|---|---|---|
| **etichetta** | nome libero, usato come sottocartella di download | `Ferrari F40` |
| **brand path** | lo slug della pagina brand su autocatalogarchive.com (senza `/`) | `ferrari` |
| **regex** | espressione regolare (case-insensitive) applicata al **nome del file PDF** | `F40` |

Lo script:
1. apre `https://autocatalogarchive.com/<brand>/`
2. segue la paginazione fino a esaurire i risultati
3. raccoglie tutti gli `<a href>` che puntano a `wp-content/uploads/.../*.pdf` (sia diretti, sia dentro le pagine dei singoli post)
4. tiene solo quelli il cui **filename** matcha la tua regex

Suggerimenti per le regex:
- ancorare l'inizio con `^` se vuoi solo i file che iniziano per quel pattern (es. `^Lotus-` evita di pescare file di altre marche che contengono "Lotus" nella descrizione)
- usare `(`alternative`)` per pescare più varianti (es. `Mercedes-G(-|63|65)`)
- attenzione ai modelli con nome ambiguo (es. cercare `S` da solo prende qualsiasi cosa: usare `S-Class`, `S-?600`, ecc.)

---

## Come funziona davvero

`autocatalogarchive.com` è **WordPress + WPBakery Visual Composer**. Tutti i PDF sono asset statici dentro `/wp-content/uploads/YYYY/MM/<Brand>-<Model>-<Year>-<Region>.pdf`. Le pagine brand (`/porsche/`, `/lotus/`, ecc.) sono **pagine statiche** WPBakery, NON archivi WordPress canonici.

**Trick chiave**: ogni brochure sulle brand page non è un `<a href>`, è un `<div class="iconbox">` con un handler inline:

```html
<div onclick="location.href='https://autocatalogarchive.com/wp-content/uploads/2017/01/Lotus-2-Eleven-GT4-SS-2008.pdf';">
  <i class="sl-cloud-download"></i>
  <p>2008 — 2-Eleven GT4 SS (INT)</p>
</div>
```

Quindi cercare `a[href$=".pdf"]` non trova nulla. Bisogna parsare gli attributi `onclick` di tutti i `[onclick]` ed estrarre la stringa `*.pdf` con una regex.

Lo userscript:

1. **Stessa origine** — gira su `autocatalogarchive.com`, quindi `fetch()` non ha problemi CORS e i cookie di sessione (incluso il token Cloudflare "umano") sono inviati automaticamente.
2. **Estrazione PDF** — fa fetch di `/<brand>/`, parsa l'HTML con `DOMParser`, scorre tutti gli `[onclick]` (e in fallback `[data-href]/[data-url]/[data-link]`) e tira fuori l'URL `*.pdf` con la regex `/['"]([^'"]*\.pdf[^'"]*)['"]/`. Mantiene anche un fallback su `a[href$=".pdf"]` per pagine future con template diversi.
3. **Paginazione** — al momento le brand page del tema **unicon** mettono tutto in una pagina sola (es. Lotus = 145 brochure su `/lotus/`), ma lo script segue comunque `a.next.page-numbers` / `a[rel=next]` se trovati, per essere a prova di futuro.
4. **Filtro** — applica la regex configurata al **nome del file**, non all'URL completo (così scrivere `^Lotus-` o `911-GT3` è intuitivo).
5. **Download** — strategia a due livelli:
   - **Primario**: `GM_download` (richiede `@connect autocatalogarchive.com` nello header e idealmente l'opzione "Downloads BETA → Browser API" attiva in Tampermonkey). Supporta routing in sottocartelle.
   - **Fallback automatico**: se `GM_download` ritorna `xhr_failed` o non disponibile, lo script passa a `fetch()` → `Blob` → click su un `<a download>` invisibile. Funziona sempre perché eredita la sessione del browser. Limite: nessuna sottocartella, ma il filename viene prefissato con `<RootFolder>__<Etichetta>__` per raggruppare a colpo d'occhio.
6. **Dedup** — l'URL di ogni PDF scaricato viene salvato con `GM_setValue`, così run successivi non riscaricano nulla. Bottone **forget** per azzerare la memoria.
7. **Politeness** — delay configurabile tra ogni download (default 700 ms) per non martellare il server.

### Diagramma logico

```
              ┌─────────────────────┐
              │  pannello UI        │
              │  (queries + start)  │
              └──────────┬──────────┘
                         │
                         ▼
        ┌───────────────────────────────┐
   ┌────│  for each query:              │
   │    │    fetch /<brand>/            │
   │    │    ↳ follow pagination        │
   │    │    ↳ collect PDF <a> hrefs    │
   │    │    ↳ follow post pages        │
   │    │    ↳ filter by regex          │
   │    └───────────────┬───────────────┘
   │                    │
   │                    ▼
   │        ┌───────────────────────┐
   │        │  download queue       │
   │        │  (deduped, persisted) │
   │        └───────────┬───────────┘
   │                    │
   │                    ▼
   │   ┌──────────────────────────────────┐
   │   │  GM_download(url, name=          │
   │   │   AutoCatalogArchive/Label/file) │
   │   │  ── fallback ──> blob anchor     │
   │   └──────────────────────────────────┘
   │                    │
   └────────────────────┘  delay 700ms tra uno e l'altro
```

---

## Perché un userscript e non uno scraper Python/Node?

Provato. Non funziona. Sintesi del rabbit hole:

| Approccio | Risultato |
|---|---|
| `curl` / `wget` | 403 — Cloudflare managed challenge |
| `python-requests` | 403 |
| `curl_cffi` con `impersonate=chrome120` (TLS+JA3 spoofing) | 403 |
| Playwright headless Chromium | bloccato a "Just a moment…" all'infinito |
| Playwright headed con stealth plugin + Chrome reale | idem, anche con click manuale dell'utente |
| WebFetch / AI fetch generico | 403 |

L'unica cosa che passa Cloudflare è **il tuo Chrome vero**, che ha già il token di sessione legittimo. Da lì in poi tutto è facile: stessa origine, niente CORS, accesso pieno ai cookie e ai PDF.

Se ti viene voglia di scrivere un fork CLI con browser automation: ricordati che CF qui è in modalità abbastanza aggressiva, devi quasi sicuramente usare `userDataDir` con un profilo Chrome dell'utente che ha già passato la challenge una volta a mano. E mantenere i cookie freschi.

---

## Disclaimer

Lo script è pensato per **uso personale e di ricerca** (collezionisti, archivi privati, educazione). Quando lo usi tieni a mente:

- rispetta il sito: il delay di default (700 ms) è già abbastanza gentile, non abbassarlo
- non usarlo per ridistribuire commercialmente i PDF — sono ufficiali dei costruttori, non sono pubblico dominio
- se autocatalogarchive.com ti chiede di smettere, smetti

Lo userscript scarica solo materiale che è già pubblicamente accessibile dal sito a chiunque acceda con un browser.

---

## Roadmap / idee future

- [ ] esportare la lista PDF trovata come `.csv` / `.json` senza scaricare
- [ ] preview thumbnail accanto al log
- [ ] modalità "dry run" che mostra solo cosa scaricherebbe
- [ ] supporto a query basate su **categorie/tag** WordPress oltre che su brand
- [ ] modalità "differenziale" che scarica solo i PDF aggiunti dall'ultimo run
- [ ] setting per saltare i PDF sopra un certo peso

PR aperte per chiunque voglia contribuire — vedi sotto.

---

## Contributing

1. Fork
2. Modifica `autocatalogarchive-bulk-downloader.user.js`
3. Bumpa la `@version` nell'header
4. Apri una PR descrivendo cosa cambia e perché

Non c'è build, non c'è test runner: è un singolo file. Test manuale visitando il sito con lo script attivo.

---

## License

[MIT](LICENSE) — fai quello che vuoi, niente garanzie.
