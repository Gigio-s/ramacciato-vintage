# Come aggiungere prodotti allo shop

## Il flusso

1. Di' a Claude che prodotto vuoi inserire
2. Claude aggiorna `catalogo.json`
3. Ricarica il sito su bunny.net — il prodotto appare

---

## Cosa dire a Claude (basta anche informale)

Esempio minimo:
> "Aggiungi: vinile Led Zeppelin IV, 1971 stampa italiana, 35 euro, condizioni buone"

Esempio completo:
> "Aggiungi: Giubbotto Belstaff anni '80, categoria oggetti, 120 euro, condizioni ottime,
> descrizione: giacca in cotone cerato originale Belstaff, taglia L, patina naturale da uso.
> Link eBay: https://www.ebay.it/... — isNew: true"

---

## Campi disponibili

| Campo        | Valori possibili                                          | Obbligatorio |
|--------------|-----------------------------------------------------------|--------------|
| `name`       | nome del prodotto                                         | ✅ |
| `cat`        | `videogiochi` `musica` `oggetti` `elettronica` `libri` `trading` | ✅ |
| `price`      | numero intero (es. 35)                                    | ✅ |
| `condition`  | `Mint` `Ottime` `Buone` `Discrete`                        | ✅ |
| `desc`       | descrizione 1-3 righe                                     | ✅ |
| `sold`       | `true` se già venduto (default: `false`)                  | ❌ |
| `isNew`      | `true` se è un arrivo recente (default: `false`)          | ❌ |
| `ebay`       | URL annuncio eBay completo                                | ❌ |
| `model`      | nome file `.glb` se c'è un modello 3D                     | ❌ |
| `photos`     | array di path foto (es. `["foto/oggetto1.jpg"]`)          | ❌ |

---

## Operazioni comuni

**Segna come venduto:**
> "Segna come venduto il prodotto id 7 (lampada stelo)"

**Modifica prezzo:**
> "Cambia il prezzo del Walkman Sony a 120 euro"

**Rimuovi un prodotto:**
> "Rimuovi il vaso in ceramica dal catalogo"

**Aggiungi più prodotti insieme:**
> "Aggiungi questi 3 pezzi: [lista]"

---

## File da modificare

- **`catalogo.json`** — l'unico file da toccare per i prodotti
- **`shop.html`** — NON modificare, legge il JSON automaticamente

---

## ID prossimo disponibile

Controlla l'id più alto in `catalogo.json` e usa il successivo.
Attualmente il più alto è **20** → il prossimo è **21**.
