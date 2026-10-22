#!/usr/bin/env python3
"""
Generatore SEO per ramacciatovintage.it

Legge i cataloghi pubblicati dal Gestionale Inventario Condiviso (catalogo-*.json)
e le impostazioni del sito (catalogo.json), poi crea pagine HTML statiche che
Google puo leggere senza JavaScript:

  prodotto/<slug>.html        una pagina per ogni prodotto visibile
  negozio/<categoria>.html    una pagina per ogni categoria (CD, vinili, DVD...)
  vintage-usato-<zona>.html   pagine territoriali (Vicenza, Padova, Marostica,
                              Mestre-Venezia, Veneto) con le date dei mercatini
  prodotto/indice.json        mappa id -> indirizzo pagina (usata da shop e Libreria)
  sitemap.xml                 sitemap completa
  mercatini.html              aggiorna solo il blocco dati "eventi" tra i marcatori
  feed/meta-catalogo.csv      catalogo per Instagram/Facebook (foto JPG in feed/img/)

Non modifica i cataloghi e non tocca il gestionale.
Uso:  python scripts/genera_seo.py      (dalla cartella del sito)
"""
import datetime as dt
import html
import json
import os
import re
import unicodedata
import urllib.parse

BASE = "https://ramacciatovintage.it"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OGGI = dt.date.today()
EMAIL = "ramacciatoluca@gmail.com"
PIVA = "IT04400570240"

CATEGORIE_FILE = ["musica", "dvd", "videogiochi", "oggetti", "elettronica", "libri", "trading"]

# Pagine di categoria. "filtro" decide quali prodotti entrano.
PAGINE_CAT = [
    {"slug": "cd-usati", "cat": "musica", "sezione": "cd", "h1": "CD usati e da collezione",
     "breve": "CD", "title": "CD Usati e da Collezione Online",
     "intro": "CD originali selezionati a mano: rock, metal, psichedelia, live da edicola e rarità da collezione. "
              "Ogni disco è un pezzo unico con condizioni descritte e copertina reale dell'edizione. "
              "Spedisco in tutta Italia oppure puoi ritirarlo di persona ai mercatini in Veneto.",
     "libreria": True},
    {"slug": "vinili-usati", "cat": "musica", "sezione": "vinili", "h1": "Vinili usati 33 e 45 giri",
     "breve": "Vinile", "title": "Vinili Usati 33 e 45 Giri Online", "libreria": True,
     "intro": "Dischi in vinile usati e da collezione, controllati uno per uno. "
              "Spedizione protetta in tutta Italia o ritiro ai mercatini di Vicenza, Padova, Marostica e Mestre."},
    {"slug": "musicassette", "cat": "musica", "sezione": "musicassette", "h1": "Musicassette usate",
     "breve": "Musicassetta", "title": "Musicassette Usate e Vintage",
     "intro": "Musicassette originali e rarità su nastro per chi ama il suono analogico."},
    {"slug": "dvd-usati", "cat": "dvd", "h1": "DVD usati: film, serie TV e animazione",
     "breve": "DVD", "title": "DVD Usati Originali: Film, Serie TV, Animazione",
     "intro": "DVD originali usati di film, serie TV, animazione e documentari. "
              "Il supporto fisico resta tuo per sempre: niente licenze che scadono, niente contenuti rimossi."},
    {"slug": "videogiochi-retro-usati", "cat": "videogiochi", "h1": "Videogiochi retro usati",
     "breve": "Videogioco", "title": "Videogiochi Retro Usati: PS1, PS2, PS3, Nintendo",
     "intro": "Videogiochi originali per PlayStation, Nintendo, Xbox e PC. Giochi fisici, completi quando indicato, "
              "da collezionare o da giocare davvero."},
    {"slug": "elettronica-vintage", "cat": "elettronica", "h1": "Elettronica vintage",
     "breve": "Elettronica", "title": "Elettronica Vintage Usata",
     "intro": "Radio, lettori, walkman e apparecchi d'epoca, testati prima della vendita quando possibile."},
    {"slug": "libri-usati", "cat": "libri", "h1": "Libri usati e curiosi",
     "breve": "Libro", "title": "Libri Usati e Curiosi",
     "intro": "Libri usati, edizioni particolari e curiosità da scaffale."},
    {"slug": "oggetti-vintage-modernariato", "cat": "oggetti", "h1": "Oggetti vintage e modernariato",
     "breve": "Oggetto", "title": "Oggetti Vintage e Modernariato",
     "intro": "Oggetti da collezione, modernariato e design d'epoca selezionati nelle cantine e nelle case del Veneto."},
    {"slug": "trading-cards", "cat": "trading", "h1": "Trading cards",
     "breve": "Carta", "title": "Trading Cards Usate e da Collezione",
     "intro": "Carte collezionabili singole e lotti, descritte con condizioni reali."},
]

# ───────────── videogiochi (dati IGDB dal gestionale) ─────────────
# Il gestionale manda subcat/platform = nome console IGDB (es. "PlayStation 2").
# Qui diventa la sottocategoria del sito. Le console nuove hanno etichetta e pagina SEO propria.
# (chiavi in minuscolo, confronto esatto sul nome; "sigla" = nome breve per pagine e titoli)
PIATTAFORME = [
    {"id": "ps1", "nomi": ["playstation", "playstation 1", "ps1", "psx", "psone"], "label": "PlayStation 1", "sigla": "PS1"},
    {"id": "ps2", "nomi": ["playstation 2", "ps2"], "label": "PlayStation 2", "sigla": "PS2"},
    {"id": "ps3", "nomi": ["playstation 3", "ps3"], "label": "PlayStation 3", "sigla": "PS3"},
    {"id": "ps4", "nomi": ["playstation 4", "ps4"], "label": "PlayStation 4", "sigla": "PS4"},
    {"id": "ps5", "nomi": ["playstation 5", "ps5"], "label": "PlayStation 5", "sigla": "PS5"},
    {"id": "psp", "nomi": ["playstation portable", "psp"], "label": "PSP", "sigla": "PSP"},
    {"id": "psvita", "nomi": ["playstation vita", "ps vita", "psvita"], "label": "PS Vita", "sigla": "PS Vita"},
    {"id": "xbox", "nomi": ["xbox"], "label": "Xbox", "sigla": "Xbox"},
    {"id": "xbox360", "nomi": ["xbox 360"], "label": "Xbox 360", "sigla": "Xbox 360"},
    {"id": "xboxone", "nomi": ["xbox one"], "label": "Xbox One", "sigla": "Xbox One"},
    {"id": "wii", "nomi": ["wii", "nintendo wii"], "label": "Nintendo Wii", "sigla": "Wii"},
    {"id": "wiiu", "nomi": ["wii u", "nintendo wii u"], "label": "Wii U", "sigla": "Wii U"},
    {"id": "switch", "nomi": ["nintendo switch", "switch"], "label": "Nintendo Switch", "sigla": "Switch"},
    {"id": "gamecube", "nomi": ["nintendo gamecube", "gamecube"], "label": "GameCube", "sigla": "GameCube"},
    {"id": "n64", "nomi": ["nintendo 64", "n64"], "label": "Nintendo 64", "sigla": "N64"},
    {"id": "nds", "nomi": ["nintendo ds", "ds"], "label": "Nintendo DS", "sigla": "DS"},
    {"id": "3ds", "nomi": ["nintendo 3ds", "3ds", "new nintendo 3ds"], "label": "Nintendo 3DS", "sigla": "3DS"},
    {"id": "gb", "nomi": ["game boy"], "label": "Game Boy", "sigla": "Game Boy"},
    {"id": "gbc", "nomi": ["game boy color"], "label": "Game Boy Color", "sigla": "Game Boy Color"},
    {"id": "gba", "nomi": ["game boy advance"], "label": "Game Boy Advance", "sigla": "GBA"},
    {"id": "snes", "nomi": ["super nintendo entertainment system", "super nintendo", "snes"], "label": "Super Nintendo", "sigla": "SNES"},
    {"id": "nes", "nomi": ["nintendo entertainment system", "nes"], "label": "NES", "sigla": "NES"},
    {"id": "megadrive", "nomi": ["sega mega drive/genesis", "sega mega drive", "mega drive", "genesis"], "label": "Sega Mega Drive", "sigla": "Mega Drive"},
    {"id": "mastersystem", "nomi": ["sega master system/mark iii", "sega master system", "master system"], "label": "Sega Master System", "sigla": "Master System"},
    {"id": "saturn", "nomi": ["sega saturn", "saturn"], "label": "Sega Saturn", "sigla": "Saturn"},
    {"id": "dreamcast", "nomi": ["dreamcast", "sega dreamcast"], "label": "Dreamcast", "sigla": "Dreamcast"},
    {"id": "pc", "nomi": ["pc (microsoft windows)", "pc", "windows", "dos"], "label": "PC", "sigla": "PC"},
]
# generi IGDB (inglese) -> italiano; EN/ES li traduce il dizionario del sito
GENERI_IGDB = {
    "point-and-click": "Punta e clicca", "fighting": "Picchiaduro", "shooter": "Sparatutto", "music": "Musicale",
    "platform": "Piattaforme", "puzzle": "Rompicapo", "racing": "Corse", "real time strategy (rts)": "Strategia in tempo reale",
    "role-playing (rpg)": "Gioco di ruolo", "simulator": "Simulazione", "sport": "Sport", "strategy": "Strategia",
    "turn-based strategy (tbs)": "Strategia a turni", "tactical": "Tattico", "hack and slash/beat 'em up": "Picchiaduro a scorrimento",
    "quiz/trivia": "Quiz", "pinball": "Flipper", "adventure": "Avventura", "indie": "Indie", "arcade": "Arcade",
    "visual novel": "Visual novel", "card & board game": "Carte e giochi da tavolo", "moba": "MOBA",
}


def piattaforma(p):
    """Console del gioco -> voce di PIATTAFORME (o None se sconosciuta)."""
    for k in (p.get("platform"), p.get("subcat")):
        n = str(k or "").strip().lower()
        if not n:
            continue
        for pf in PIATTAFORME:
            if n == pf["id"] or n in pf["nomi"]:
                return pf
    return None


def adatta_gioco(p):
    """Videogiochi dal gestionale (contratto IGDB): subcat = id console del sito, generi in italiano."""
    pf = piattaforma(p)
    if pf:
        p["subcat"] = pf["id"]
        p["_pf"] = pf
    elif p.get("platform") or p.get("subcat"):
        p["_pf"] = {"id": "", "label": str(p.get("platform") or p.get("subcat")), "sigla": str(p.get("platform") or p.get("subcat"))}
    p["_generi"] = [GENERI_IGDB.get(str(g).strip().lower(), str(g).strip()) for g in (p.get("genres") or []) if str(g).strip()]


def slug_console(pf):
    return "giochi-%s-usati" % slugify(pf["sigla"], 30)


def e_cover_illustrativa(src):
    """Copertina scaricata da IGDB (nome file igdb-<id>-cover-...): non e' la foto della copia in vendita."""
    return bool(re.search(r"(^|/)igdb-\d+-cover", str(src or "")))


# Calendario tipico dei mercatini (stesso contenuto della pagina mercatini.html)
# n = settimana del mese (1..4), wd = giorno (5 sabato, 6 domenica)
MERCATINI = [
    {"id": "marostica", "nome": "Mercatino di Marostica", "luogo": "Piazza degli Scacchi", "citta": "Marostica",
     "prov": "VI", "cap": "36063", "lat": 45.7519, "lng": 11.6596, "n": 1, "wd": 6, "quando": "1ª domenica del mese"},
    {"id": "vicenza-signori", "nome": "Non ho l'età - Vicenza", "luogo": "Piazza dei Signori", "citta": "Vicenza",
     "prov": "VI", "cap": "36100", "lat": 45.5475, "lng": 11.5467, "n": 2, "wd": 6, "quando": "2ª domenica del mese"},
    {"id": "padova-prato", "nome": "Non ho l'età - Padova", "luogo": "Prato della Valle", "citta": "Padova",
     "prov": "PD", "cap": "35123", "lat": 45.3984, "lng": 11.8763, "n": 3, "wd": 6, "quando": "3ª domenica del mese"},
    {"id": "mestre", "nome": "Mercatino di Mestre", "luogo": "Corso del Popolo", "citta": "Mestre (Venezia)",
     "prov": "VE", "cap": "30172", "lat": 45.4903, "lng": 12.2446, "n": 2, "wd": 5, "quando": "2° sabato del mese",
     "alterna": True},
    {"id": "vicenza-duomo", "nome": "Sabato Vintage - Vicenza", "luogo": "Piazza Duomo", "citta": "Vicenza",
     "prov": "VI", "cap": "36100", "lat": 45.5460, "lng": 11.5440, "n": 2, "wd": 5, "quando": "2° sabato del mese",
     "alterna": True},
]

# Altri mercatini ricorrenti del Veneto (calendario pubblico nella pagina Mercatini).
# Fonte: agendaonline.it (mercatini Veneto e Verona), ottobre 2026. Date teoriche: verificare con gli organizzatori.
# n = settimana del mese (-1 = ultima), wd = 5 sabato / 6 domenica, no = mesi in cui non si tiene
ALTRI_MERCATINI = [
    {"prov": "VI", "citta": "Marostica", "nome": "Mercatino dell'antiquariato", "luogo": "Piazza Castello e portici", "n": 1, "wd": 6, "rv": "marostica"},
    {"prov": "VI", "citta": "Vicenza", "nome": "Antiquariato, collezionismo e vintage", "luogo": "Centro storico", "n": 2, "wd": 6, "no": [7, 8], "rv": "vicenza-signori"},
    {"prov": "VI", "citta": "Bassano del Grappa", "nome": "Antiquariato, collezionismo e vintage", "luogo": "Piazza Terraglio", "n": 3, "wd": 6},
    {"prov": "PD", "citta": "Piazzola sul Brenta", "nome": "Mercatino dell'antiquariato e modernariato", "luogo": "Piazza Camerini", "n": -1, "wd": 6},
    {"prov": "PD", "citta": "Padova", "nome": "Mercatino dell'antiquariato", "luogo": "Prato della Valle", "n": 3, "wd": 6, "rv": "padova-prato"},
    {"prov": "PD", "citta": "Arquà Petrarca", "nome": "Usato e antiquariato", "luogo": "Centro storico", "n": 2, "wd": 6, "no": [12, 1, 2, 3]},
    {"prov": "PD", "citta": "Cittadella", "nome": "Mercatino delle pulci", "luogo": "Centro", "n": 3, "wd": 6, "no": [8]},
    {"prov": "PD", "citta": "Conselve", "nome": "Mercatino delle cose d'altri tempi", "luogo": "Piazze XX Settembre e Cesare Battisti", "n": -1, "wd": 6},
    {"prov": "TV", "citta": "Treviso", "nome": "Mercatino dell'antiquariato", "luogo": "Borgo Cavour", "n": 4, "wd": 6},
    {"prov": "TV", "citta": "Montebelluna", "nome": "Mercatino dell'antiquariato", "luogo": "Piazza D'Annunzio", "n": 3, "wd": 6, "no": [12]},
    {"prov": "TV", "citta": "Portobuffolè", "nome": "Mercatino dell'antiquariato", "luogo": "Centro storico", "n": 2, "wd": 6},
    {"prov": "TV", "citta": "Monastier di Treviso", "nome": "Mercatino dell'antiquariato", "luogo": "Centro", "n": 1, "wd": 6, "no": [1, 7, 8, 12]},
    {"prov": "VE", "citta": "Mestre (Venezia)", "nome": "Mercatino di Mestre", "luogo": "Corso del Popolo", "n": 2, "wd": 5, "rv": "mestre"},
    {"prov": "VE", "citta": "Noale", "nome": "Mercatino dell'antiquariato", "luogo": "Piazza Castello", "n": 2, "wd": 6, "no": [4, 6]},
    {"prov": "VE", "citta": "Portogruaro", "nome": "Mercatino dell'antiquariato", "luogo": "Centro storico", "n": 2, "wd": 6, "no": [7, 8]},
    {"prov": "VE", "citta": "Mirano", "nome": "Oggetti dei nonni", "luogo": "Piazza Martiri", "n": 3, "wd": 6, "no": [7, 8]},
    {"prov": "VR", "citta": "Verona", "nome": "Mercatino dell'antiquariato di San Zeno", "luogo": "Piazza San Zeno", "n": 1, "wd": 6, "no": [8]},
    {"prov": "VR", "citta": "Villafranca di Verona", "nome": "Mercatino dell'antiquariato", "luogo": "Corso Vittorio Emanuele II", "n": 2, "wd": 6, "no": [7, 8]},
    {"prov": "VR", "citta": "Soave", "nome": "Mercatino dell'antiquariato", "luogo": "Via Roma e piazza Marogna", "n": 3, "wd": 6},
    {"prov": "VR", "citta": "Valeggio sul Mincio", "nome": "Mercatino dell'antiquariato", "luogo": "Piazza Carlo Alberto", "n": 4, "wd": 6},
    {"prov": "BL", "citta": "Feltre", "nome": "Fiera dell'Oggetto Ritrovato", "luogo": "Piazza Vittorio Emanuele", "n": 2, "wd": 6, "no": [1, 2, 3]},
    {"prov": "BL", "citta": "Belluno", "nome": "Cose di vecchie case", "luogo": "Centro storico", "n": 4, "wd": 6, "no": [1, 2, 3, 4, 5, 10, 11, 12]},
    {"prov": "RO", "citta": "Lendinara", "nome": "Antiquariato e hobbistica", "luogo": "Centro", "n": 1, "wd": 6},
    {"prov": "RO", "citta": "Polesella", "nome": "Mercatino dell'antiquariato", "luogo": "Piazza", "n": 3, "wd": 6},
]
PROVINCE = [("VI", "Vicenza"), ("PD", "Padova"), ("TV", "Treviso"), ("VE", "Venezia"), ("VR", "Verona"), ("BL", "Belluno"), ("RO", "Rovigo")]


def regola_txt(m):
    g = "domenica" if m["wd"] == 6 else "sabato"
    if m["n"] == -1:
        t = "Ultima %s del mese" % g
    else:
        t = "%d%s %s del mese" % (m["n"], "ª" if m["wd"] == 6 else "°", g)
    no = m.get("no") or []
    if no:
        t += " (non a " + ", ".join(MESI[x - 1] for x in sorted(no)) + ")"
    return t


def calendario_veneto_html():
    """Blocco "Calendario mercatini antiquariato in Veneto" per mercatini.html (static per Google + aggiornamento live in pagina)."""
    righe = []
    for sig, nome_p in PROVINCE:
        lista = [m for m in ALTRI_MERCATINI if m["prov"] == sig]
        if not lista:
            continue
        carte = []
        for m in lista:
            date = ", ".join(data_it(d) for d in prossime_date(m, 2))
            maps = "https://www.google.com/maps/search/?api=1&query=%s" % urllib.parse.quote("%s, %s" % (m["luogo"], m["citta"].split(" (")[0]))
            rv = ('<span class="cv-rv">C\'è anche Ramacciato Vintage</span>' if m.get("rv") else "")
            carte.append(f'<li class="cv-item{" cv-mio" if m.get("rv") else ""}"><b>{e(m["citta"])}</b><span class="cv-nome">{e(m["nome"])}</span>'
                         f'<span class="cv-luogo">&#x1F4CD; {e(m["luogo"])}</span><span class="cv-regola">{e(regola_txt(m))}</span>'
                         f'<span class="cv-date">Prossime date: {e(date)}</span>{rv}<a href="{maps}" target="_blank" rel="noopener">Apri in Maps</a></li>')
        righe.append(f'<h3 class="cv-prov">Provincia di {e(nome_p)}</h3><ul class="cv-lista">{"".join(carte)}</ul>')
    dati = json.dumps([{k: m.get(k) for k in ("citta", "nome", "luogo", "n", "wd", "no", "rv")} for m in ALTRI_MERCATINI], ensure_ascii=False).replace("</", "<\\/")
    return ("<!-- CAL-VENETO:START (generato da scripts/genera_seo.py, non modificare a mano) -->\n"
            '<section id="calendario-veneto" class="cv"><div class="wrap">'
            '<p class="sec-label">Calendario antiquariato e vintage</p>'
            '<h2 class="h2">Mercatini dell\'antiquariato in Veneto: date e luoghi</h2>'
            '<div class="divider-line"></div>'
            '<p class="body-copy">I principali mercatini ricorrenti di antiquariato, modernariato, usato e vintage in Veneto, provincia per provincia, '
            'con le prossime date. Quelli segnati sono i mercatini dove trovi anche il banco di Ramacciato Vintage.</p>'
            '<div class="cv-weekend" id="cvWeekend"><h3>Questo weekend in Veneto</h3><ul id="cvWeekendLista"></ul></div>'
            + "".join(righe)
            + '<p class="cv-nota">Date teoriche ricavate dai calendari pubblici dei mercatini (ottobre 2026): meteo, festività ed eventi possono cambiarle. '
              'Prima di partire verifica sempre con gli organizzatori o con il Comune.</p>'
            f'<script type="application/json" id="cvDati">{dati}</script>'
            "</div></section>\n<!-- CAL-VENETO:END -->")


ZONE = [
    {"slug": "vintage-usato-vicenza", "zona": "Vicenza", "mercatini": ["vicenza-signori", "vicenza-duomo", "marostica"],
     "title": "Negozio Vintage a Vicenza: Dischi, Videogiochi e Usato",
     "h1": "Negozio vintage a Vicenza",
     "testo": [
         "Cerchi un negozio vintage a Vicenza? Ramacciato Vintage è il negozio di vintage e usato nato a Vicenza: "
         "non ho una vetrina fissa, il negozio è online e dal vivo lo trovi ai mercatini del centro e della provincia.",
         "Ramacciato Vintage nasce a Vicenza. Qui trovi il mio banco nei mercatini del centro: "
         "la seconda domenica del mese in Piazza dei Signori con Non ho l'età e, alcuni mesi, "
         "il secondo sabato in Piazza Duomo con il Sabato Vintage.",
         "Porto CD, vinili, DVD, videogiochi retro e oggetti vintage recuperati nelle cantine della provincia. "
         "Tutto quello che vedi nel negozio online lo puoi prenotare e ritirare di persona al mercatino, senza spese di spedizione.",
         "A Vicenza e provincia mi occupo anche di svuotacantine: valuto gli oggetti, ritiro quelli che hanno valore "
         "e per lo sgombero completo collaboro con L2 Traslochi."]},
    {"slug": "vintage-usato-padova", "zona": "Padova", "mercatini": ["padova-prato"],
     "title": "Vintage e Usato a Padova: Prato della Valle",
     "h1": "Vintage e usato a Padova",
     "testo": [
         "A Padova mi trovi la terza domenica del mese in Prato della Valle, al mercatino Non ho l'età.",
         "Sul banco porto una selezione di dischi, film, videogiochi e oggetti d'epoca. Se hai visto qualcosa nel "
         "negozio online, prenotalo: te lo tengo da parte e lo ritiri direttamente al mercatino.",
         "Anche a Padova e provincia svolgo servizio di svuotacantine con valutazione gratuita degli oggetti."]},
    {"slug": "vintage-usato-marostica", "zona": "Marostica", "mercatini": ["marostica"],
     "title": "Mercatino Vintage a Marostica: Piazza degli Scacchi",
     "h1": "Vintage e usato a Marostica",
     "testo": [
         "La prima domenica del mese il mercatino di Marostica anima Piazza degli Scacchi, sotto il castello. "
         "Qui porto il mio banco di vintage e collezionismo secondo il calendario dei mercatini.",
         "Musica su CD e vinile, film, videogiochi retro e oggetti d'epoca: quello che trovi online lo puoi "
         "prenotare e ritirare in piazza senza pagare la spedizione.",
         "In tutta la provincia di Vicenza mi occupo anche di svuotacantine, con valutazione gratuita degli oggetti."]},
    {"slug": "vintage-usato-mestre-venezia", "zona": "Mestre e Venezia", "mercatini": ["mestre"],
     "title": "Vintage e Usato a Mestre e Venezia: Mercatino Corso del Popolo",
     "h1": "Vintage e usato a Mestre e Venezia",
     "testo": [
         "Alcuni mesi il secondo sabato mi trovi a Mestre, in Corso del Popolo, al mercatino dell'usato e del vintage. "
         "Negli altri mesi, lo stesso sabato, sono a Vicenza: controlla la pagina Mercatini prima di partire.",
         "Porto dischi, CD, DVD, videogiochi e oggetti vintage. Prenota online quello che ti interessa e ritiralo "
         "al banco senza spese di spedizione.",
         "Per Venezia e la terraferma mi occupo anche di svuotacantine e ritiro di oggetti su richiesta."]},
    {"slug": "vintage-usato-veneto", "zona": "Veneto", "mercatini": ["marostica", "vicenza-signori", "padova-prato", "mestre", "vicenza-duomo"],
     "title": "Vintage e Usato in Veneto: Mercatini e Negozio Online",
     "h1": "Vintage e usato in Veneto",
     "testo": [
         "Ramacciato Vintage è un negozio dell'usato e del collezionismo con base a Vicenza: vendo online in tutta Italia "
         "e ogni mese porto il banco nei mercatini del Veneto, tra Vicenza, Padova, Marostica e Mestre.",
         "Da Verona a Treviso, da Rovigo a Belluno spedisco in pochi giorni. Se preferisci vedere il pezzo dal vivo, "
         "prenotalo online e ritiralo al primo mercatino utile.",
         "In tutto il Veneto svolgo anche servizio di svuotacantine: valutazione gratuita e ritiro degli oggetti di valore."]},
]

MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto",
        "settembre", "ottobre", "novembre", "dicembre"]
GIORNI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]


# ───────────────────────── utilità ─────────────────────────
def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def slugify(s, n=70):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:n].strip("-") or "prodotto"


def leggi_json(nome, default):
    p = os.path.join(ROOT, nome)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def scrivi(rel, testo):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    vecchio = None
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            vecchio = f.read()
    if vecchio != testo:
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(testo)
        return True
    return False


def prezzo_txt(p):
    v = p.get("price")
    if v is None:
        return ""
    return ("%d" % v) if float(v).is_integer() else ("%.2f" % v).replace(".", ",")


def prezzo_schema(p):
    v = p.get("price")
    return None if v is None else ("%.2f" % float(v))


def url_img(src):
    if not src:
        return ""
    if re.match(r"^https?://", src):
        return src
    return BASE + "/" + urllib.parse.quote(urllib.parse.unquote(src.lstrip("/")))


def src_img(src):
    if not src:
        return ""
    if re.match(r"^https?://", src):
        return src
    return "/" + urllib.parse.quote(urllib.parse.unquote(src.lstrip("/")))


def data_it(d):
    return "%s %d %s" % (GIORNI[d.weekday()], d.day, MESI[d.month - 1])


def nth_weekday(anno, mese, n, wd):
    """n-esimo giorno della settimana del mese (n = -1: l'ultimo)."""
    d = dt.date(anno, mese, 1)
    d += dt.timedelta(days=(wd - d.weekday()) % 7)
    if n == -1:
        while (d + dt.timedelta(weeks=1)).month == mese:
            d += dt.timedelta(weeks=1)
        return d
    return d + dt.timedelta(weeks=n - 1)


def prossime_date(m, quante=3):
    out, a, me = [], OGGI.year, OGGI.month
    while len(out) < quante:
        d = nth_weekday(a, me, m["n"], m["wd"])
        if d >= OGGI and me not in m.get("no", []):
            out.append(d)
        me += 1
        if me > 12:
            me, a = 1, a + 1
    return out


# ───────────── adattatore gestionale -> sottocategorie RV ─────────────
def colonne_sonore(p, m):
    """Artista "... - colonne sonore film" nel gestionale: toglie il suffisso e segna il pezzo."""
    c = (m or {}).get("colonne_sonore")
    if not c:
        return False
    al = str(p.get("artist") or "").lower()
    for k in sorted(c.get("artista_contiene", []), key=len, reverse=True):
        if k not in al:
            continue
        kr = re.escape(k)
        a = re.sub(r"\s*[-\u2013:]?\s*" + kr + r"\s*", " ", str(p["artist"]), count=1, flags=re.I)
        p["artist"] = re.sub(r"^[\s\-\u2013:]+|[\s\-\u2013:]+$", "", a).strip()
        if p.get("name"):
            p["name"] = re.sub(r"\s*[-\u2013:]\s*" + kr + r"(?=\s*([-\u2013:]|$))", "", str(p["name"]), count=1, flags=re.I).strip()
        p["_colonna_sonora"] = True
        return True
    # oppure genere Discogs/gestionale da colonna sonora (Soundtrack, Stage & Screen, Colonne Sonore)
    gl = [str(g).lower() for g in (p.get("genres") or [])]
    if any(k in g for k in c.get("genere_contiene", []) for g in gl):
        p["_colonna_sonora"] = True
        return True
    return False


def instrada_cs(p, m):
    c = (m or {}).get("colonne_sonore") or {}
    s = str(p.get("subcat") or "")
    sez = "cd" if s.startswith("cd") else "vinili" if s.startswith("vinili") else "musicassette" if s.startswith("musicassette") else ""
    if sez and c.get("sottocategorie", {}).get(sez):
        p["subcat"] = c["sottocategorie"][sez]


def adatta(p, mappa, subcats):
    if p.get("cat") == "videogiochi":
        adatta_base(p, mappa, subcats)     # foto e pulizie comuni (per i giochi non c'e' mappa: si ferma li')
        adatta_gioco(p)
        dettagli_condizioni(p)
        return
    m = mappa.get(p.get("cat"))
    cs = colonne_sonore(p, m)
    adatta_base(p, mappa, subcats)
    if cs:
        instrada_cs(p, m)
    codice_edizione(p)
    dettagli_condizioni(p)


def dettagli_condizioni(p):
    """Riga "Dettagli condizioni:" del gestionale: va in evidenza sotto il prezzo e si toglie dalla descrizione."""
    d = p.get("desc")
    if not d:
        return
    m = re.search(r"^[ \t]*Dettagli condizioni:[ \t]*(.+)$", str(d), flags=re.I | re.M)
    if not m:
        return
    p["dettagliCondizioni"] = m.group(1).strip()
    p["desc"] = re.sub(r"^[ \t]*Dettagli condizioni:.*(\r?\n|$)", "", str(d), count=1, flags=re.I | re.M).rstrip()


def codice_edizione(p):
    """Codice edizione (riga della descrizione del gestionale): mostrato solo per i vinili, tolto dal testo per tutto il resto."""
    d = p.get("desc")
    if not d:
        return
    m = re.search(r"^[ \t]*Codice edizione:[ \t]*(.+)$", str(d), flags=re.I | re.M)
    p["desc"] = re.sub(r"^[ \t]*Codice edizione:.*(\r?\n|$)", "", str(d), count=1, flags=re.I | re.M).rstrip()
    if m and str(p.get("subcat") or "").startswith("vinili"):
        p["codiceEdizione"] = m.group(1).strip()


def adatta_base(p, mappa, subcats):
    # il gestionale a volte elenca foto non scaricate: tengo solo quelle che esistono (o remote)
    if p.get("photos"):
        p["photos"] = [x for x in p["photos"] if x and (re.match(r"^https?://", str(x)) or os.path.exists(os.path.join(ROOT, urllib.parse.unquote(str(x)))))]
    ph = p.get("photos") or []
    if p.get("discogsId") and ph and re.match(r"^https?://i\.discogs\.com", str(ph[0])):
        loc = "photos/inventario/discogs-%s-cover.jpg" % p["discogsId"]
        if os.path.exists(os.path.join(ROOT, loc)):
            p["photos"] = [loc] + ph[1:]
    if p.get("artist"):
        p["artist"] = re.sub(r"\s*\(\d+\)\s*$", "", str(p["artist"])).strip()
    m = mappa.get(p.get("cat"))
    gen = [str(g).strip() for g in (p.get("genres") or [])]
    if not gen and p.get("desc") and " · " in p["desc"]:
        gen = [g.strip() for g in " · ".join(p["desc"].split(" · ")[1:]).split(",")]
    p["_generi"] = [g for g in gen if g]
    if not m:
        return
    ids = []
    for sc in subcats.get(p["cat"], []):
        ids.append(sc["id"])
        ids += [c["id"] for c in sc.get("children", [])]
    if not p.get("subcat") or p["subcat"] in ids:
        return
    formato = str(p["subcat"])
    fl = formato.lower()
    p["_formato"] = formato
    gl = [g.lower() for g in p["_generi"]]
    lab = (p.get("label") or "").lower()

    def w(t, k):
        return re.search(r"(^|[^a-z])" + re.escape(k) + r"([^a-z]|$)", t) is not None

    sez = m.get("sezione_default")
    for r in m.get("formati", []):
        if any(w(fl, k) for k in r["contiene"]):
            sez = r["sezione"]
            break
    sub = sez
    if sez == "cd":
        sub = m.get("cd_default")
        for c in m.get("cd", []):
            ok = False
            if c.get("etichetta_contiene"):
                ok = any(k in lab for k in c["etichetta_contiene"])
            if not ok and c.get("formato_contiene"):
                ok = any(k in fl for k in c["formato_contiene"])
            if not ok and c.get("genere_contiene"):
                ok = any(k in g for g in gl for k in c["genere_contiene"])
            if ok and c.get("escludi_se") and any(g in c["escludi_se"] for g in gl):
                ok = False
            if ok:
                sub = c["sottocategoria"]
                break
    p["subcat"] = sub


def sezione_musica(p):
    s = p.get("subcat") or ""
    if s.startswith("cd"):
        return "cd"
    for base in ("vinili", "musicassette"):
        if s.startswith(base):
            return base
    return "altro"


def artista(p):
    if p.get("cat") == "videogiochi":
        return ""
    if p.get("artist"):
        return p["artist"]
    n = p.get("name") or ""
    return n.split(" - ")[0] if " - " in n else ""


def titolo(p):
    n = p.get("name") or ""
    a = artista(p)
    if " - " in n:
        return " - ".join(n.split(" - ")[1:])
    if a and n.lower().startswith(a.lower()):
        return n[len(a):].lstrip(" -:") or n
    return n


def nome_completo(p):
    a, t = artista(p), titolo(p)
    return (a + " - " + t) if a and t and a.lower() not in t.lower() else (p.get("name") or t)


def e_nuovo(p):
    if str(p.get("completeness") or "").lower().startswith("nuovo"):
        return True
    c = (p.get("condition") or "").lower()
    return "nuovo" in c or "sigillato" in c or "mint (m)" in c


def foto(p):
    ph = p.get("photos") or []
    return p.get("cover") or (ph[0] if ph else "")


# ───────────────────────── layout comune ─────────────────────────
FONT = ('<link rel="preload" href="/fonts/archivo-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>'
        '<link rel="preload" href="/fonts/archivo-latin-900-normal.woff2" as="font" type="font/woff2" crossorigin>'
        '<link rel="stylesheet" href="/fonts/fonts.css">')


def testa(title, desc, canon, og_img="", robots="index,follow", og_type="website", jsonld=None):
    j = ""
    for blk in (jsonld or []):
        j += '<script type="application/ld+json">%s</script>\n' % json.dumps(blk, ensure_ascii=False)
    img = og_img or BASE + "/og-image.jpg"
    return f"""<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="/i18n.js"></script>
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{canon}">
<link rel="alternate" hreflang="it" href="{canon}">
<link rel="alternate" hreflang="en" href="{canon}?lang=en">
<link rel="alternate" hreflang="es" href="{canon}?lang=es">
<link rel="alternate" hreflang="x-default" href="{canon}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Ramacciato Vintage">
<meta property="og:locale" content="it_IT">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{e(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/logo.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
{FONT}
<link rel="stylesheet" href="/seo/seo.css">
{j}</head>
<body>
<header class="sx-top">
  <a class="sx-brand" href="/"><img src="/logo.png" alt="" width="26" height="26"><span>Ramacciato <b>Vintage</b></span></a>
  <nav class="sx-nav" aria-label="Menu"><a href="/shop.html">Shop</a><a href="/negozio/cd-usati.html">CD</a><a href="/mercatini.html">Mercatini</a><a href="/svuotacantine.html">Svuotacantine</a></nav>
</header>
<main class="sx-main">
"""


def hub_link():
    cats = "".join('<a href="/negozio/%s.html">%s</a>' % (c["slug"], e(c["h1"].split(":")[0])) for c in PAGINE_CAT)
    zone = "".join('<a href="/%s.html">%s</a>' % (z["slug"], e("Negozio vintage Vicenza" if z["zona"] == "Vicenza" else z["zona"])) for z in ZONE)
    return f'<nav class="sx-hub" aria-label="Esplora"><div><b>Negozio</b>{cats}</div><div><b>Dove trovarmi</b>{zone}<a href="/mercatini.html#calendario-veneto">Calendario mercatini Veneto</a></div></nav>'


def piede():
    return f"""</main>
{hub_link()}
<footer class="sx-foot">
  <p><b>Ramacciato Vintage</b> di Luca Ramacciato - Vicenza (VI) - P.IVA {PIVA} - <a href="mailto:{EMAIL}">{EMAIL}</a></p>
  <p><a href="/privacy-policy.html">Privacy</a> · <a href="/cookie-policy.html">Cookie</a> · <a href="/termini-di-servizio.html">Termini</a> · <a href="/faq.html">FAQ e spedizioni</a></p>
</footer>
<script src="/cart-widget.js" defer></script>
<script src="/rv-weekend.js" defer></script>
</body>
</html>
"""


def breadcrumb_ld(voci):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u}
                                for i, (n, u) in enumerate(voci)]}


def breadcrumb_html(voci):
    parti = []
    for i, (n, u) in enumerate(voci):
        if i == len(voci) - 1:
            parti.append('<span aria-current="page">%s</span>' % e(n))
        else:
            parti.append('<a href="%s">%s</a>' % (u.replace(BASE, "") or "/", e(n)))
    return '<nav class="sx-bc" aria-label="Percorso">%s</nav>' % " › ".join(parti)


def card(p):
    img = src_img(foto(p))
    stato = "Nuovo" if e_nuovo(p) else (p.get("condition") or "")
    if p.get("cat") == "videogiochi" and (p.get("_pf") or {}).get("sigla"):
        stato = p["_pf"]["sigla"] + (" · " + p["region"] if p.get("region") else "") + " · " + stato
    q = " q" if p.get("cat") == "musica" else (" q g" if p.get("cat") == "videogiochi" else "")
    return (f'<a class="sx-card" href="{p["_url"]}"><span class="sx-card-img{q}">'
            f'<img src="{e(img)}" alt="{e(nome_completo(p))}" width="400" height="{"300" if not q else "400"}" loading="lazy" decoding="async"></span>'
            f'<span class="sx-card-b"><span class="sx-card-n">{e(nome_completo(p))}</span>'
            f'<span class="sx-card-c">{e(stato)}</span><span class="sx-card-p">€ {prezzo_txt(p)}</span></span></a>')


def mercatini_box(ids, titolo_box="Dove trovarmi di persona"):
    righe = []
    for m in [x for x in MERCATINI if x["id"] in ids]:
        date = ", ".join(data_it(d) for d in prossime_date(m, 2))
        nota = ' <em>(alcuni mesi sono a Vicenza, altri a Mestre)</em>' if m.get("alterna") else ""
        maps = "https://www.google.com/maps/search/?api=1&query=%s" % urllib.parse.quote("%s, %s" % (m["luogo"], m["citta"]))
        righe.append(f'<li><b>{e(m["nome"])}</b><span>{e(m["luogo"])}, {e(m["citta"])} ({m["prov"]}) - {e(m["quando"])}{nota}</span>'
                     f'<span class="sx-date">Prossime date: {e(date)}</span><a href="{maps}" target="_blank" rel="noopener">Apri in Maps</a></li>')
    return (f'<section class="sx-box"><h2>{e(titolo_box)}</h2><ul class="sx-merc">{"".join(righe)}</ul>'
            '<p class="sx-nota">Calendario tipico: le presenze possono variare di mese in mese. '
            'Prima di venire controlla la pagina <a href="/mercatini.html">Mercatini</a>.</p></section>')


def eventi_ld(ids, quante=2):
    out = []
    for m in [x for x in MERCATINI if x["id"] in ids]:
        for d in prossime_date(m, quante):
            out.append({
                "@context": "https://schema.org", "@type": "Event",
                "name": m["nome"] + " - mercatino vintage e antiquariato",
                "startDate": d.isoformat(), "endDate": d.isoformat(),
                "eventStatus": "https://schema.org/EventScheduled",
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                "description": "Mercatino dell'usato, del vintage e dell'antiquariato. Ramacciato Vintage partecipa "
                               "con il suo banco di dischi, film, videogiochi e oggetti d'epoca secondo calendario.",
                "image": [BASE + "/og-image.jpg"],
                "location": {"@type": "Place", "name": m["luogo"] + ", " + m["citta"],
                             "address": {"@type": "PostalAddress", "streetAddress": m["luogo"],
                                         "addressLocality": m["citta"].split(" (")[0], "postalCode": m["cap"],
                                         "addressRegion": m["prov"], "addressCountry": "IT"},
                             "geo": {"@type": "GeoCoordinates", "latitude": m["lat"], "longitude": m["lng"]}},
                "isAccessibleForFree": True,
                "url": BASE + "/mercatini.html",
            })
    return out


NEGOZIO_LD = {"@type": "OnlineStore", "@id": BASE + "/#store", "name": "Ramacciato Vintage", "url": BASE + "/"}


# ───────────────────────── pagine ─────────────────────────
def pagina_prodotto(p, pc, simili):
    nome = nome_completo(p)
    a, t = artista(p), titolo(p)
    img = foto(p)
    nuovo = e_nuovo(p)
    formato = pc["breve"] if pc else "Articolo"
    stato_txt = "nuovo sigillato" if nuovo and p.get("cat") == "musica" else ("nuovo" if nuovo else "usato")
    gioco = p.get("cat") == "videogiochi"
    pf = p.get("_pf") or {}
    if gioco and pf.get("sigla"):
        formato = "Gioco " + pf["sigla"]
    title = f"{nome} | {formato} {stato_txt} | Ramacciato Vintage"
    parti = [f"{nome}"]
    if gioco:
        parti += [x for x in [pf.get("label"), p.get("region"), p.get("completeness"), p.get("publisher")] if x]
    if p.get("_formato"):
        parti.append(p["_formato"])
    if p.get("label"):
        parti.append(p["label"])
    if p.get("year") and str(p["year"]) != "0":
        parti.append(str(p["year"]))
    desc = (f"{' · '.join(parti)}. Condizioni: {p.get('condition') or 'come da descrizione'}. "
            f"€ {prezzo_txt(p)}. Spedizione in tutta Italia o ritiro ai mercatini in Veneto.")[:300]
    canon = BASE + p["_url"]
    venduto = bool(p.get("sold"))
    voci = [("Home", BASE + "/"), ("Shop", BASE + "/shop.html")]
    if pc:
        voci.append((pc["h1"].split(":")[0], BASE + "/negozio/%s.html" % pc["slug"]))
    if gioco and pf.get("id"):
        voci.append(("Giochi %s usati" % pf["sigla"], BASE + "/negozio/%s.html" % slug_console(pf)))
    voci.append((nome, canon))
    prodotto_ld = {
        "@context": "https://schema.org", "@type": "Product", "name": nome,
        "image": [url_img(x) for x in ([img] + [x for x in (p.get("photos") or []) if x != img])[:4] if x],
        "description": desc, "sku": "RV-%s" % p["id"],
        "category": (pc["h1"] if pc else "Vintage"),
        "offers": {"@type": "Offer", "url": canon, "priceCurrency": "EUR", "price": prezzo_schema(p),
                   "availability": "https://schema.org/SoldOut" if venduto else "https://schema.org/InStock",
                   "itemCondition": "https://schema.org/NewCondition" if nuovo else "https://schema.org/UsedCondition",
                   "seller": {"@type": "Organization", "name": "Ramacciato Vintage"},
                   "shippingDetails": {"@type": "OfferShippingDetails",
                                       "shippingRate": {"@type": "MonetaryAmount", "value": "5.90", "currency": "EUR"},
                                       "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "IT"}}},
    }
    if a:
        prodotto_ld["brand"] = {"@type": "Brand", "name": a}
    if gioco:
        prodotto_ld["@type"] = ["Product", "VideoGame"]
        if pf.get("label"):
            prodotto_ld["gamePlatform"] = pf["label"]
        if p.get("publisher"):
            prodotto_ld["brand"] = {"@type": "Brand", "name": p["publisher"]}
            prodotto_ld["publisher"] = {"@type": "Organization", "name": p["publisher"]}
        if p.get("_generi"):
            prodotto_ld["genre"] = p["_generi"]
    if prezzo_schema(p) is None:
        prodotto_ld.pop("offers")
    # testo descrittivo
    frasi = []
    if p.get("cat") == "musica" and a:
        f = f"{p.get('_formato') or formato} di <b>{e(a)}</b>, «{e(t)}»"
        if p.get("label"):
            f += f", pubblicato da {e(p['label'])}"
        if p.get("year") and str(p["year"]) != "0":
            f += f" nel {e(p['year'])}"
        frasi.append(f + ".")
        if p.get("_generi"):
            frasi.append("Generi e stili: " + e(", ".join(p["_generi"])) + ".")
    elif gioco:
        f = f"Videogioco per <b>{e(pf.get('label') or 'console')}</b>, «{e(nome)}»"
        if p.get("publisher"):
            f += f", pubblicato da {e(p['publisher'])}"
        if p.get("year") and str(p["year"]) != "0":
            f += f" nel {e(p['year'])}"
        frasi.append(f + ".")
        if p.get("developer"):
            frasi.append(f"Sviluppato da {e(p['developer'])}.")
        if p.get("desc"):
            frasi.append(e(p["desc"]))
    elif p.get("desc"):
        frasi.append(e(p["desc"]))
    frasi.append(f"Condizioni: <b>{e(p.get('condition') or 'come da descrizione')}</b>.")
    frasi.append("Pezzo unico: lo spedisco in tutta Italia oppure puoi prenotarlo e ritirarlo di persona "
                 "a uno dei miei mercatini in Veneto (Vicenza, Padova, Marostica, Mestre).")
    chips = [x for x in [p.get("region"), p.get("completeness"), (str(p["year"]) if p.get("year") and str(p["year"]) != "0" else None),
                         p.get("publisher"), ("Codice: " + p["codiceEdizione"]) if p.get("codiceEdizione") else None] + list(p.get("_generi") or []) if x] if gioco else \
            [x for x in [p.get("_formato"), ("Codice edizione: " + p["codiceEdizione"]) if p.get("codiceEdizione") else None, p.get("label"), (str(p["year"]) if p.get("year") and str(p["year"]) != "0" else None)] if x]
    sub_mail = "Prenotazione ritiro al mercatino: %s (ID %s)" % (nome, p["id"])
    body_mail = ("Ciao Luca,\n\nvorrei prenotare \"%s\" (ID %s, € %s) e ritirarlo al mercatino di: \n\n"
                 "Nome:\nTelefono:\n\nGrazie!" % (nome, p["id"], prezzo_txt(p)))
    mailto = "mailto:%s?subject=%s&body=%s" % (EMAIL, urllib.parse.quote(sub_mail), urllib.parse.quote(body_mail))
    pub = {k: v for k, v in p.items() if not k.startswith("_")}
    libreria = ""
    if pc and pc.get("libreria"):
        par = "vinile" if pc.get("sezione") == "vinili" else "cd"
        libreria = f'<a class="sx-btn sx-btn-l" href="/shop-libreria.html?{par}={e(p["id"])}">Guardalo nella Libreria</a>'
    if gioco:
        libreria = f'<a class="sx-btn sx-btn-l" href="/shop-libreria-giochi.html?gioco={e(p["id"])}">Guardalo nella Libreria</a>'
    sim = "".join(card(x) for x in simili)
    # banner concerti Dead People Activity (solo musica, no colonne sonore): montato da /dpa-live.js
    dpa = (f'<div data-dpa-artist="{e(a)}" style="margin:0 -12px 6px"></div><script src="/dpa-live.js" defer></script>'
           if p.get("cat") == "musica" and a and not p.get("_colonna_sonora")
           and re.match(r"(cd|vinil|musicassett)", str(p.get("subcat") or "cd"), re.I) else "")
    nota_discogs = ('<p class="sx-nota">Copertina da Discogs a scopo illustrativo: il prodotto fisico può differire dall\'immagine.</p>' if p.get('discogsId') else '')
    if gioco and e_cover_illustrativa(img):
        nota_discogs = ('<p class="sx-nota">Copertina a scopo illustrativo: edizione e regione della copia in vendita possono differire'
                        + (', le foto reali sono nelle immagini successive.' if len(p.get("photos") or []) > 1 else '.') + '</p>')
    dati_json = json.dumps(pub, ensure_ascii=False).replace('</', '<\\/')
    # videogiochi: miniature delle foto (copertina + foto reali della copia)
    galleria = ""
    fotos = [x for x in (p.get("photos") or []) if x]
    if gioco and len(fotos) > 1:
        galleria = ('<div class="sx-thumbs">' + "".join(
            f'<button type="button" class="sx-thumb{" on" if i == 0 else ""}" data-src="{e(src_img(x))}" aria-label="Foto {i + 1}">'
            f'<img src="{e(src_img(x))}" alt="" width="72" height="72" loading="lazy"></button>' for i, x in enumerate(fotos[:8]))
            + '</div><script>document.querySelectorAll(".sx-thumb").forEach(function(b){b.onclick=function(){document.getElementById("sxMain").src=b.dataset.src;'
              'document.querySelectorAll(".sx-thumb").forEach(function(x){x.classList.toggle("on",x===b)});};});</script>')
    h = testa(title, desc, canon, url_img(img), "index,follow", "product", [prodotto_ld, breadcrumb_ld(voci)])
    h += breadcrumb_html(voci)
    h += f"""<article class="sx-prod">
  {('<div class="sx-prod-col">' if gioco else '')}<div class="sx-prod-img{' q' if p.get('cat') == 'musica' else (' g' if gioco else '')}"><img {('id="sxMain" ' if gioco else '')}src="{e(src_img(img))}" alt="{e(nome)}" width="600" height="600"></div>{(galleria + '</div>') if gioco else ''}
  <div class="sx-prod-info">
    <p class="sx-kick">{e(pc['h1'].split(':')[0] if pc else 'Shop')}</p>
    <h1>{e(a) if a else e(nome)}</h1>
    {'<p class="sx-sub">' + e(t) + '</p>' if a else ('<p class="sx-sub">' + e(pf.get("label")) + '</p>' if gioco and pf.get("label") else '')}
    <div class="sx-chips">{''.join('<span>' + e(c) + '</span>' for c in chips)}</div>
    <p class="sx-cond">Condizioni: {e(p.get('condition') or '-')}</p>
    <p class="sx-price">{'<span class="rv-venduto rv-venduto-l">Venduto</span>' if venduto else '€ ' + prezzo_txt(p)}{'' if venduto else ' <small>+ spedizione, oppure ritiro gratuito al mercatino</small>'}</p>
    {('<p class="sx-difetti" style="margin:-4px 0 16px;padding:10px 14px;border-radius:12px;background:#fff3d6;border:1.5px solid rgba(192,120,0,.45);color:#7a3d00;font-weight:800;line-height:1.4">&#x26A0; ' + e(p['dettagliCondizioni']) + '</p>') if p.get('dettagliCondizioni') else ''}
    <div data-rv-weekend="compatto" hidden></div>
    <div class="sx-azioni">
      <button class="sx-btn" id="sxCart" {'disabled' if venduto else ''}>Aggiungi al carrello</button>
      <button class="sx-btn sx-btn-s" id="sxBuy" {'disabled' if venduto else ''}>Compra ora</button>
      <a class="sx-btn sx-btn-s sx-full" href="{e(mailto)}">Prenota e ritira al mercatino</a>
      {libreria}
    </div>
    {dpa}
    <div class="sx-desc"><p>{' '.join('<span>%s</span>' % x for x in frasi)}</p></div>
    {nota_discogs}
  </div>
</article>
{mercatini_box([m['id'] for m in MERCATINI], 'Ritiralo di persona ai mercatini')}
{('<section class="sx-box"><h2>Potrebbero interessarti</h2><div class="sx-grid">' + sim + '</div></section>') if sim else ''}
<script type="application/json" id="sxData">{dati_json}</script>
<script src="/rv-stock-live.js"></script>
<script>
(function(){{var K='rv_cart_v1',p=JSON.parse(document.getElementById('sxData').textContent);
function L(){{try{{return JSON.parse(localStorage.getItem(K)||'[]')}}catch(e){{return[]}}}}
function S(c){{try{{localStorage.setItem(K,JSON.stringify(c))}}catch(e){{}}if(window.rvCart&&window.rvCart.refresh)window.rvCart.refresh();}}
var b=document.getElementById('sxCart');function st(){{var on=L().some(function(x){{return x.id===p.id}});b.textContent=on?'Nel carrello':'Aggiungi al carrello';b.classList.toggle('on',on);}}
if(!b.disabled){{st();b.onclick=function(){{var c=L(),i=-1;c.forEach(function(x,k){{if(x.id===p.id)i=k}});if(i<0){{var it=JSON.parse(JSON.stringify(p));it.qty=1;c.push(it)}}else c.splice(i,1);S(c);st();}};
document.getElementById('sxBuy').onclick=function(){{var c=L();if(!c.some(function(x){{return x.id===p.id}})){{var it=JSON.parse(JSON.stringify(p));it.qty=1;c.push(it);S(c)}}location.href='/checkout.html';}};}}
/* disponibilita in diretta: venduto dal gestionale -> VENDUTO subito, senza aspettare la rigenerazione della pagina */
if(window.rvStockLive)rvStockLive(function(m){{var k=String(p.id),c=m.has(k)?m.get(k):0;if(c>0)return;var pr=document.querySelector('.sx-price');if(pr&&!pr.querySelector('.rv-venduto'))pr.innerHTML='<span class="rv-venduto rv-venduto-l">Venduto</span>';['sxCart','sxBuy'].forEach(function(i){{var x=document.getElementById(i);if(x)x.disabled=true;}});}});
}})();
</script>
"""
    h += piede()
    return h


def pagina_categoria(pc, prodotti, sotto_label):
    canon = BASE + "/negozio/%s.html" % pc["slug"]
    disp = [p for p in prodotti if not p.get("sold")]
    robots = "index,follow" if disp else "noindex,follow"
    title = f"{pc['title']} | Ramacciato Vintage"
    desc = (pc["intro"].split(". ")[0] + ". " + ("%d articoli disponibili. " % len(disp) if disp else "")
            + "Spedizione in tutta Italia o ritiro ai mercatini di Vicenza e Padova.")[:300]
    voci = [("Home", BASE + "/"), ("Shop", BASE + "/shop.html"), (pc["h1"].split(":")[0], canon)]
    lista_ld = {"@context": "https://schema.org", "@type": "ItemList", "name": pc["h1"],
                "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": BASE + p["_url"]} for i, p in enumerate(disp[:100])]}
    h = testa(title, desc, canon, url_img(foto(disp[0])) if disp else "", robots, "website",
              [breadcrumb_ld(voci)] + ([lista_ld] if disp else []))
    h += breadcrumb_html(voci)
    extra = (('<a class="sx-btn sx-btn-l" href="/shop-libreria.html?sala=vinili">Sfoglia i vinili nella Libreria</a>' if pc.get("sezione") == "vinili"
              else '<a class="sx-btn sx-btn-l" href="/shop-libreria.html">Sfoglia i CD nella Libreria</a>') if pc.get("libreria") else
             ('<a class="sx-btn sx-btn-l" href="/shop-libreria-giochi.html">Sfoglia i giochi nella Libreria</a>' if pc.get("cat") == "videogiochi" else ""))
    h += f'<section class="sx-hero"><h1>{e(pc["h1"])}</h1><p>{e(pc["intro"])}</p><div class="sx-hero-az"><a class="sx-btn" href="/shop.html?cat={pc["cat"]}">Apri nello shop</a>{extra}</div></section>'
    if not disp:
        h += '<section class="sx-box"><p>Nuovi arrivi in preparazione: i pezzi di questa categoria saranno online a breve. Intanto guarda lo <a href="/shop.html">shop completo</a> o passa ai <a href="/mercatini.html">mercatini</a>.</p></section>'
    else:
        gruppi = {}
        for p in disp:
            gruppi.setdefault(sotto_label.get(p.get("subcat"), ""), []).append(p)
        for g in sorted(gruppi, key=lambda x: (x == "", x)):
            pfg = next((x for x in PIATTAFORME if x["label"] == g), None) if pc.get("cat") == "videogiochi" else None
            tit = (f'<a href="/negozio/{slug_console(pfg)}.html">{e(g)}</a>' if pfg else e(g))
            h += '<section class="sx-box">' + (f'<h2>{tit}</h2>' if g and len(gruppi) > 1 else '') + '<div class="sx-grid">'
            h += "".join(card(p) for p in sorted(gruppi[g], key=lambda x: (artista(x) or x.get("name") or "").lower()))
            h += "</div></section>"
    h += mercatini_box([m["id"] for m in MERCATINI], "Vedi i pezzi dal vivo")
    h += piede()
    return h, bool(disp)


def pagina_zona(z, vetrina):
    canon = BASE + "/%s.html" % z["slug"]
    title = z["title"] + " | Ramacciato Vintage"
    desc = (z["testo"][0][:180].rsplit(" ", 1)[0] + "... Negozio online con spedizione e ritiro al mercatino.")
    voci = [("Home", BASE + "/"), ("Mercatini", BASE + "/mercatini.html"), (z["zona"], canon)]
    store = dict(NEGOZIO_LD)
    store.update({"@context": "https://schema.org", "description": "Negozio online di vintage, dischi, film e videogiochi usati, "
                  "presente ai mercatini di " + z["zona"] + ".", "email": EMAIL,
                  "areaServed": [{"@type": "City", "name": c} for c in ["Vicenza", "Padova", "Marostica", "Venezia", "Verona", "Treviso"]],
                  "address": {"@type": "PostalAddress", "addressLocality": "Vicenza", "addressRegion": "VI", "addressCountry": "IT"}})
    h = testa(title, desc, canon, "", "index,follow", "website", [store, breadcrumb_ld(voci)] + eventi_ld(z["mercatini"]))
    h += breadcrumb_html(voci)
    h += f'<section class="sx-hero"><h1>{e(z["h1"])}</h1>' + "".join(f"<p>{e(t)}</p>" for t in z["testo"])
    h += '<div class="sx-hero-az"><a class="sx-btn" href="/shop.html">Guarda lo shop</a><a class="sx-btn sx-btn-l" href="/svuotacantine.html">Svuotacantine</a></div></section>'
    h += mercatini_box(z["mercatini"], "Mercatini a " + z["zona"] if z["zona"] != "Veneto" else "Tutti i mercatini in Veneto")
    h += ('<section class="sx-box"><h2>Come funziona il ritiro al mercatino</h2><ol class="sx-steps">'
          '<li>Scegli il pezzo nel negozio online.</li><li>Nella pagina del prodotto premi <b>Prenota e ritira al mercatino</b> e scrivimi dove preferisci ritirarlo.</li>'
          '<li>Te lo tengo da parte: lo vedi dal vivo, lo paghi al banco e niente spese di spedizione.</li></ol></section>')
    if vetrina:
        h += '<section class="sx-box"><h2>Ultimi arrivi nel negozio</h2><div class="sx-grid">' + "".join(card(p) for p in vetrina) + "</div></section>"
    h += piede()
    return h


def aggiorna_mercatini_html():
    p = os.path.join(ROOT, "mercatini.html")
    if not os.path.exists(p):
        return False
    with open(p, "rb") as f:
        s = f.read().decode("utf-8", "surrogateescape")
    blocco = ("<!-- SEO-EVENTI:START (generato da scripts/genera_seo.py, non modificare a mano) -->\n"
              + "".join('<script type="application/ld+json">%s</script>\n' % json.dumps(ev, ensure_ascii=False)
                        for ev in eventi_ld([m["id"] for m in MERCATINI]))
              + "<!-- SEO-EVENTI:END -->")
    if "<!-- SEO-EVENTI:START" in s:
        nuovo = re.sub(r"<!-- SEO-EVENTI:START.*?<!-- SEO-EVENTI:END -->", lambda m: blocco, s, flags=re.S)
    else:
        nuovo = s.replace("</head>", blocco + "\n</head>", 1)
    if "<!-- CAL-VENETO:START" in nuovo:
        cal = calendario_veneto_html()
        nuovo = re.sub(r"<!-- CAL-VENETO:START.*?<!-- CAL-VENETO:END -->", lambda m: cal, nuovo, flags=re.S)
    if nuovo != s:
        with open(p, "wb") as f:
            f.write(nuovo.encode("utf-8", "surrogateescape"))
        return True
    return False


def sitemap(url_extra):
    statiche = [("/", "1.0", "weekly"), ("/shop.html", "0.95", "daily"), ("/shop-libreria.html", "0.8", "daily"), ("/shop-libreria-giochi.html", "0.75", "daily"),
                ("/mercatini.html", "0.85", "weekly"), ("/svuotacantine.html", "0.8", "monthly"),
                ("/fisico-vs-digitale.html", "0.6", "weekly"), ("/archivio-licenze.html", "0.5", "monthly"),
                ("/faq.html", "0.7", "monthly")]
    righe = []
    for u, pr, fq in statiche:
        righe.append((u, pr, fq))
    righe += url_extra
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for u, pr, fq in righe:
        alt = "".join(f'<xhtml:link rel="alternate" hreflang="{h}" href="{BASE}{u}{q}"/>' for h, q in (("it", ""), ("en", "?lang=en"), ("es", "?lang=es"), ("x-default", "")))
        out.append(f"  <url><loc>{BASE}{u}</loc>{alt}<lastmod>{OGGI.isoformat()}</lastmod><changefreq>{fq}</changefreq><priority>{pr}</priority></url>")
    out.append("</urlset>\n")
    return "\n".join(out)


# ───────────────────────── main ─────────────────────────
# ───────────── feed catalogo Meta (Instagram / Facebook) ─────────────
# feed/meta-catalogo.csv: letto ogni giorno da Commerce Manager (feed programmato).
# Meta accetta solo JPG/PNG da almeno 500x500: le foto (spesso webp, copertine IGDB piccole)
# vengono convertite in feed/img/ come JPG quadrati 1080x1080 su fondo bianco.
# I venduti restano nel feed come "out of stock", cosi' i tag nei post vecchi non si rompono.
FEED_CAT_GOOGLE = {
    "musica": "Media > Music & Sound Recordings",
    "dvd": "Media > DVDs & Videos",
    "videogiochi": "Software > Video Game Software",
    "libri": "Media > Books",
    "elettronica": "Electronics",
    "trading": "Arts & Entertainment > Hobbies & Creative Arts > Collectibles",
    "oggetti": "Arts & Entertainment > Hobbies & Creative Arts > Collectibles",
}
FEED_COLONNE = ["id", "title", "description", "availability", "condition", "price", "link", "image_link",
                "additional_image_link", "brand", "google_product_category", "product_type",
                "custom_label_0", "custom_label_1", "custom_label_2"]


def feed_jpg(src, nome_base, usati):
    """Converte una foto del sito in JPG quadrato per Meta. Ritorna l'URL pubblico o ''."""
    try:
        from PIL import Image
    except ImportError:
        return url_img(src) if re.search(r"\.(jpe?g|png)(\?|$)", src or "", re.I) else ""
    if not src or re.match(r"^https?://", src):
        return ""          # solo foto pubblicate sul sito (link esterni possono scadere o essere bloccati)
    loc = os.path.join(ROOT, urllib.parse.unquote(src.lstrip("/")))
    if not os.path.exists(loc):
        return ""
    import hashlib
    firma = hashlib.md5((src + str(os.path.getsize(loc))).encode()).hexdigest()[:8]
    rel = "feed/img/%s-%s.jpg" % (nome_base, firma)
    usati.add(os.path.basename(rel))
    dest = os.path.join(ROOT, rel)
    if not os.path.exists(dest):
        try:
            im = Image.open(loc)
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            L, M = 1080, 1000
            r = min(M / im.width, M / im.height)
            im = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
            tela = Image.new("RGB", (L, L), (255, 255, 255))
            tela.paste(im, ((L - im.width) // 2, (L - im.height) // 2), im if im.mode == "RGBA" else None)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            tela.save(dest, "JPEG", quality=84, optimize=True, progressive=True)
        except Exception as ex:
            print("feed: foto non convertita", src, ex)
            return ""
    return BASE + "/" + rel


def feed_testo(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def feed_meta(prodotti, sotto_label):
    import csv
    import io
    righe, usati = [], set()
    for p in prodotti:
        if p.get("price") is None:
            continue
        ph = [x for x in ([foto(p)] + list(p.get("photos") or [])) if x]
        ph = list(dict.fromkeys(ph))[:4]
        base = "%s" % slugify(str(p["id"]), 12)
        imgs = [u for u in (feed_jpg(x, "%s-%d" % (base, i), usati) for i, x in enumerate(ph)) if u]
        if not imgs:
            continue
        pc = p.get("_pc") or {}
        gioco = p.get("cat") == "videogiochi"
        pf = p.get("_pf") or {}
        formato = ("Gioco " + pf["sigla"]) if gioco and pf.get("sigla") else (pc.get("breve") or "")
        nome = nome_completo(p)
        titolo_f = feed_testo(nome + (" (%s)" % formato if formato else ""))[:150]
        parti = []
        if gioco:
            parti += [x for x in [pf.get("label"), p.get("region"), p.get("completeness"), p.get("publisher")] if x]
        parti += [x for x in [p.get("_formato"), p.get("label")] if x]
        if p.get("year") and str(p["year"]) != "0":
            parti.append(str(p["year"]))
        cond = p.get("condition") or "come da descrizione"
        if p.get("dettagliCondizioni"):
            cond += " (" + p["dettagliCondizioni"] + ")"
        extra = feed_testo(re.sub(r"^[ \t]*Codice edizione:.*$", "", str(p.get("desc") or ""), flags=re.M))
        desc = feed_testo("%s. %s Condizioni: %s. %s Pezzo unico, spedizione in tutta Italia o ritiro ai mercatini in Veneto."
                          % (nome, (" · ".join(parti) + ".") if parti else "", cond, (extra + ".") if extra and not extra.endswith(".") else extra))
        disponibile = not p.get("sold") and (p.get("copie") is None or (int(p.get("copie") or 0) > 0))
        marca = artista(p) or p.get("publisher") or p.get("label") or "Ramacciato Vintage"
        righe.append({
            "id": str(p["id"]),
            "title": titolo_f,
            "description": desc[:4900],
            "availability": "in stock" if disponibile else "out of stock",
            "condition": "new" if e_nuovo(p) else "used",
            "price": "%.2f EUR" % float(p["price"]),
            "link": BASE + p["_url"],
            "image_link": imgs[0],
            "additional_image_link": ",".join(imgs[1:]),
            "brand": feed_testo(marca)[:100],
            "google_product_category": FEED_CAT_GOOGLE.get(p.get("cat"), FEED_CAT_GOOGLE["oggetti"]),
            "product_type": feed_testo(" > ".join(x for x in [pc.get("h1", "").split(":")[0], sotto_label.get(p.get("subcat"), p.get("subcat") or "")] if x)),
            "custom_label_0": p.get("cat") or "",
            "custom_label_1": feed_testo(pf.get("sigla") or sotto_label.get(p.get("subcat"), p.get("subcat") or ""))[:100],
            "custom_label_2": "nuovo arrivo" if p.get("isNew") else "",
        })
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=FEED_COLONNE, lineterminator="\n")
    w.writeheader()
    w.writerows(righe)
    n = scrivi("feed/meta-catalogo.csv", buf.getvalue())
    cart = os.path.join(ROOT, "feed", "img")
    try:
        from PIL import Image  # noqa: F401  (pulizia solo se le foto sono state rigenerate qui)
        if os.path.isdir(cart):
            for fn in os.listdir(cart):
                if fn.endswith(".jpg") and fn not in usati:
                    os.remove(os.path.join(cart, fn))
    except ImportError:
        pass
    print("Feed Meta: %d prodotti (%d disponibili)" % (len(righe), sum(r["availability"] == "in stock" for r in righe)))
    return n


def main():
    meta = leggi_json("catalogo.json", {})
    mappa = meta.get("mappa_gestionale", {})
    subcats = meta.get("sottocategorie", {})
    sotto_label = {}
    for lista in subcats.values():
        for sc in lista:
            sotto_label[sc["id"]] = sc["label"]
            for c in sc.get("children", []):
                sotto_label[c["id"]] = c["label"]

    for pf in PIATTAFORME:
        sotto_label.setdefault(pf["id"], pf["label"])

    prodotti = []
    for c in CATEGORIE_FILE:
        arr = leggi_json("catalogo-%s.json" % c, [])
        if isinstance(arr, list):
            prodotti += [p for p in arr if isinstance(p, dict)]
    prodotti = [p for p in prodotti if not p.get("nascosto") and (p.get("model") or foto(p)) and p.get("id") is not None]
    for p in prodotti:
        adatta(p, mappa, subcats)

    def pagina_di(p):
        for pc in PAGINE_CAT:
            if pc["cat"] != p.get("cat"):
                continue
            if pc.get("sezione") and sezione_musica(p) != pc["sezione"]:
                continue
            return pc
        return None

    usati = set()
    for p in prodotti:
        base = slugify(nome_completo(p), 64)
        slug = "%s-%s" % (base, slugify(str(p["id"]), 12))
        while slug in usati:
            slug += "-x"
        usati.add(slug)
        p["_url"] = "/prodotto/%s.html" % slug
        p["_pc"] = pagina_di(p)

    cambiati = 0
    generati = set()
    url_sitemap = []
    for p in prodotti:
        pc = p["_pc"]
        simili = [x for x in prodotti if x is not p and not x.get("sold") and x["_pc"] is pc
                  and x.get("subcat") == p.get("subcat")][:4]
        if len(simili) < 4:
            simili += [x for x in prodotti if x is not p and not x.get("sold") and x["_pc"] is pc and x not in simili][:4 - len(simili)]
        rel = p["_url"].lstrip("/")
        cambiati += scrivi(rel, pagina_prodotto(p, pc, simili))
        generati.add(rel)
        if not p.get("sold"):
            url_sitemap.append((p["_url"], "0.7", "weekly"))

    # rimuove pagine prodotto non piu presenti nei cataloghi
    cart = os.path.join(ROOT, "prodotto")
    rimossi = 0
    if os.path.isdir(cart):
        for fn in os.listdir(cart):
            if fn.endswith(".html") and ("prodotto/" + fn) not in generati:
                os.remove(os.path.join(cart, fn))
                rimossi += 1

    cs_lista = [p for p in prodotti if p.get("_colonna_sonora")]
    if cs_lista:
        pc_cs = {"slug": "colonne-sonore-film", "cat": "musica", "h1": "Colonne sonore di film: CD, vinili e musicassette",
                 "title": "Colonne Sonore di Film Usate: CD, Vinili, Musicassette",
                 "intro": "Colonne sonore originali di film su CD, vinile e musicassetta, usate e da collezione. "
                          "Ogni pezzo è unico, con condizioni descritte: spedizione in tutta Italia o ritiro ai mercatini in Veneto."}
        et = {k: v for k, v in sotto_label.items()}
        et.update({"cd-colonne-sonore": "CD", "vinili-colonne-sonore": "Vinili", "musicassette-colonne-sonore": "Musicassette"})
        h, indicizza = pagina_categoria(pc_cs, cs_lista, et)
        cambiati += scrivi("negozio/colonne-sonore-film.html", h)
        if indicizza:
            url_sitemap.append(("/negozio/colonne-sonore-film.html", "0.8", "daily"))
    elif os.path.exists(os.path.join(ROOT, "negozio", "colonne-sonore-film.html")):
        os.remove(os.path.join(ROOT, "negozio", "colonne-sonore-film.html"))

    # pagine per console (videogiochi): solo per le console con almeno un gioco
    giochi = [p for p in prodotti if p.get("cat") == "videogiochi" and (p.get("_pf") or {}).get("id")]
    console_fatte = set()
    for pf in PIATTAFORME:
        lista = [p for p in giochi if p["_pf"]["id"] == pf["id"]]
        if not lista:
            continue
        pcc = {"slug": slug_console(pf), "cat": "videogiochi", "h1": "Giochi %s usati" % pf["sigla"],
               "title": "Giochi %s Usati Originali" % pf["sigla"],
               "intro": "Videogiochi originali per %s, usati e da collezione. Per ogni gioco trovi regione (PAL/NTSC), "
                        "completezza (custodia, manuale) e condizioni reali. Spedizione in tutta Italia o ritiro ai mercatini in Veneto." % pf["label"]}
        h, indicizza = pagina_categoria(pcc, lista, sotto_label)
        cambiati += scrivi("negozio/%s.html" % pcc["slug"], h)
        console_fatte.add("%s.html" % pcc["slug"])
        if indicizza:
            url_sitemap.append(("/negozio/%s.html" % pcc["slug"], "0.8", "daily"))
    cart_neg = os.path.join(ROOT, "negozio")
    if os.path.isdir(cart_neg):
        for fn in os.listdir(cart_neg):
            if re.match(r"^giochi-.+-usati\.html$", fn) and fn not in console_fatte:
                os.remove(os.path.join(cart_neg, fn))

    for pc in PAGINE_CAT:
        lista = [p for p in prodotti if p["_pc"] is pc]
        h, indicizza = pagina_categoria(pc, lista, sotto_label)
        cambiati += scrivi("negozio/%s.html" % pc["slug"], h)
        if indicizza:
            url_sitemap.append(("/negozio/%s.html" % pc["slug"], "0.85", "daily"))

    vetrina = sorted([p for p in prodotti if not p.get("sold")], key=lambda x: str(x["id"]), reverse=True)
    vetrina = sorted(vetrina, key=lambda x: -int(x["id"]) if str(x["id"]).isdigit() else 0)[:8]
    for z in ZONE:
        cambiati += scrivi("%s.html" % z["slug"], pagina_zona(z, vetrina))
        url_sitemap.append(("/%s.html" % z["slug"], "0.8", "weekly"))

    # "Nuovo": data di prima pubblicazione dei pezzi segnati nuovi nel gestionale.
    # Lo shop toglie l'etichetta dopo 7 giorni. Se nel gestionale si toglie "nuovo", la data si cancella.
    nov_path = os.path.join(ROOT, "prodotto", "novita.json")
    try:
        with open(nov_path, encoding="utf-8") as f:
            novita = json.load(f)
        if not isinstance(novita, dict):
            novita = {}
    except Exception:
        novita = {}
    novita = {str(p["id"]): novita.get(str(p["id"]), OGGI.isoformat()) for p in prodotti if p.get("isNew")}
    cambiati += scrivi("prodotto/novita.json", json.dumps(dict(sorted(novita.items())), ensure_ascii=False, indent=0) + "\n")

    indice = {str(p["id"]): p["_url"] for p in prodotti}
    cambiati += scrivi("prodotto/indice.json", json.dumps(indice, ensure_ascii=False, indent=0) + "\n")
    cambiati += scrivi("sitemap.xml", sitemap(url_sitemap))
    cambiati += feed_meta(prodotti, sotto_label)
    cambiati += aggiorna_mercatini_html()
    print("Prodotti: %d | pagine aggiornate: %d | pagine prodotto rimosse: %d | URL in sitemap: %d"
          % (len(prodotti), cambiati, rimossi, len(url_sitemap) + 7))


if __name__ == "__main__":
    main()
