#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aggiornamento settimanale notizie "Fisico vs Digitale".

Pesca notizie da feed RSS di testate gaming/tech, tiene solo quelle a tema
(proprieta fisica/digitale, dischi, DRM, licenze, preservazione, delisting...),
scarta i duplicati e le AGGIUNGE in cima a news.json.

Gira su GitHub Actions (cron settimanale). NON pubblica nulla da solo:
il workflow apre una Pull Request che tu approvi.
"""

import json, os, re, sys, time
from datetime import datetime, timezone

try:
    import feedparser
except ImportError:
    print("feedparser mancante: pip install feedparser", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS_FILE = os.path.join(ROOT, "news.json")

# Feed RSS (testata -> url). Aggiungine/togline liberamente.
FEEDS = {
    "Eurogamer":        "https://www.eurogamer.net/feed",
    "Push Square":      "https://www.pushsquare.com/feeds/latest",
    "Kotaku":           "https://kotaku.com/rss",
    "The Verge":        "https://www.theverge.com/rss/index.xml",
    "PlayStation.Blog": "https://blog.playstation.com/feed/",
}

# Parole chiave a tema (minuscolo). Una basta perche la notizia sia tenuta.
KEYWORDS = [
    "physical", "disc", "disc-based", "discless", "disc-less",
    "digital-only", "digital only", "code in a box", "code-in-a-box",
    "drm", "license", "licence", "preservation", "preserve",
    "delist", "delisted", "delisting", "removed from", "remove from",
    "purchased content", "your library", "shut down", "shutting down",
    "servers offline", "ownership", "own the game", "boxed", "blu-ray",
    "cartridge", "collector", "second-hand", "resale",
    # italiano (per feed IT)
    "fisico", "disco", "licenza", "preservazione", "proprieta", "collezion",
]

MAX_ITEMS = 60  # tetto massimo di notizie conservate


def norm_url(u):
    u = (u or "").split("?")[0].rstrip("/").lower()
    return u


def entry_date(e):
    for k in ("published_parsed", "updated_parsed"):
        t = e.get(k)
        if t:
            return time.strftime("%Y-%m-%d", t)
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def is_relevant(e):
    text = (e.get("title", "") + " " + e.get("summary", "")).lower()
    return any(k in text for k in KEYWORDS)


def load_news():
    if os.path.exists(NEWS_FILE):
        with open(NEWS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("items", [])
    return []


def main():
    existing = load_news()
    seen = {norm_url(i.get("url")) for i in existing}
    added = []

    for source, url in FEEDS.items():
        try:
            feed = feedparser.parse(url)
        except Exception as ex:
            print(f"[warn] {source}: {ex}", file=sys.stderr)
            continue
        for e in feed.entries:
            link = e.get("link")
            if not link:
                continue
            nu = norm_url(link)
            if nu in seen:
                continue
            if not is_relevant(e):
                continue
            title = re.sub(r"\s+", " ", (e.get("title") or "").strip())
            if not title:
                continue
            item = {
                "date": entry_date(e),
                "title": title,
                "source": source,
                "url": link,
                "cat": "Notizia",
            }
            added.append(item)
            seen.add(nu)

    if not added:
        print("Nessuna nuova notizia a tema.")
        return

    items = added + existing
    # ordina per data desc, taglia al massimo
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    items = items[:MAX_ITEMS]

    out = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "items": items}
    with open(NEWS_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Aggiunte {len(added)} notizie:")
    for i in added:
        print(f"  - {i['date']} · {i['source']} · {i['title']}")


if __name__ == "__main__":
    main()
