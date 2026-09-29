# Standard riutilizzabile — Upload documenti sicuro + consenso GDPR

**Versione:** 1.0 — 09/07/2026
**Uso previsto:** template tecnico/organizzativo da riapplicare a qualsiasi progetto Studio Digital che raccoglie documenti (identità, patenti, certificati, firme, contratti) o dati sensibili dal cliente tramite form web — es. Autoscuole Gasparella (rinnovo-online.html), ma riusabile su qualunque altro cliente.

> ⚠️ **Nota importante:** questo documento è una base tecnico-organizzativa costruita seguendo i principi GDPR e gli orientamenti pubblici del Garante Privacy italiano. Non sostituisce una consulenza legale. Prima di attivare in produzione qualsiasi flusso che raccoglie documenti identificativi o dati sensibili, fai validare questo standard (e la sua applicazione al singolo progetto) da un legale o da un DPO, ed effettua la valutazione di impatto (DPIA) se richiesta dal caso specifico.

---

## 1. Quando serve questo standard

Applicalo ogni volta che un sito o un'app raccoglie almeno uno di questi elementi dall'utente:

- copia di documento d'identità (carta d'identità, patente, passaporto)
- firma (anche grafometrica/disegnata su schermo)
- dati sanitari o certificati medici (categoria particolare, Art. 9 GDPR)
- qualunque documento allegato che contenga dati personali di terzi

## 2. Base giuridica e consenso

- Se la raccolta del documento è **necessaria per eseguire un contratto o un obbligo di legge** (es. verificare l'identità per una pratica di rinnovo patente), la base giuridica primaria è l'**Art. 6.1.b GDPR (esecuzione contratto)** — non è strettamente il consenso a rendere lecito il trattamento, ma l'interessato va comunque informato in modo chiaro, anche tramite l'informativa privacy generale, secondo le indicazioni del Garante Privacy italiano.
- Se nei documenti caricati compaiono **dati di categoria particolare** (es. certificato medico → dati sanitari, Art. 9), serve una condizione aggiuntiva: nella maggior parte dei casi pratici per un privato **consenso esplicito e specifico** (Art. 9.2.a), distinto da qualunque consenso marketing.
- **Regola pratica per i nostri progetti:** raccogliamo sempre un consenso esplicito e granulare prima dell'upload, anche quando non strettamente obbligatorio, perché rende il flusso più trasparente e riduce il rischio in caso di controllo. Il consenso deve essere:
  - **specifico** (una checkbox dedicata a questo trattamento, mai preselezionata, mai unita al consenso marketing);
  - **informato** (link diretto all'informativa privacy, visibile prima del click);
  - **revocabile** (indicare come revocarlo, es. email dedicata);
  - **documentato** (timestamp + versione dell'informativa accettata, conservati insieme alla pratica).
- Riferimento applicato: la checkbox di consenso in `rinnovo-online.html` (step "Documenti") segue esattamente questo pattern — riusala come componente di partenza per altri progetti.

## 3. Requisiti tecnici per l'upload sicuro

Da implementare quando si passa dal prototipo demo (solo client-side/localStorage) a una versione reale in produzione:

| Area | Requisito minimo |
|---|---|
| Trasporto | HTTPS obbligatorio, TLS 1.2 o superiore su tutto il sito, non solo sul form |
| Upload | Preferire upload diretto a storage cloud tramite URL pre-firmati (presigned URL), così i file non transitano/non si fermano sul server applicativo |
| Crittografia a riposo | AES-256 lato storage (S3/Cloud Storage con crittografia attiva by default, oppure crittografia applicativa se si usa storage generico) |
| Scambio chiavi | RSA-2048 o superiore per qualunque handshake/certificato TLS |
| Validazione file | Controllo tipo file (whitelist estensioni/MIME), dimensione massima, rifiuto file eseguibili |
| Scansione | Antivirus/antimalware automatico sui file caricati prima che siano accessibili a chiunque (incluso staff interno) |
| Accesso ai file | Accesso solo a chi ne ha necessità operativa (least privilege), mai link pubblici permanenti; se serve condividere un file, link temporaneo con scadenza |
| Log accessi | Registro di chi ha visualizzato/scaricato ogni documento e quando (obbligo di fatto se si tratta un volume significativo di documenti identificativi) |
| Conservazione | Tempo di conservazione definito per categoria di documento (vedi §4), cancellazione automatica allo scadere |
| Cancellazione | Cancellazione sicura (non solo "spostamento nel cestino") sia sul file originale sia sulle eventuali copie/backup, appena decorso il termine |

## 4. Tempi di conservazione consigliati (di default, da adattare)

- **Documenti identificativi raccolti per una pratica specifica** (es. rinnovo patente): fino a completamento della pratica + un breve periodo cuscinetto (es. 30 giorni) per gestire eventuali contestazioni, poi cancellazione.
- **Dati contrattuali/fiscali collegati alla pratica** (fatture, ricevute): termini fiscali standard italiani (10 anni), ma senza necessità di conservare l'intero documento d'identità per quel periodo — separare "prova del pagamento/servizio" da "copia del documento".
- **Certificati medici o dati sanitari**: conservazione minima indispensabile, valutare se sia proprio necessario conservarli oltre la pratica o se basti la sola attestazione "verificato in sede".
- Ogni progetto deve avere la propria tabella di conservazione esplicita nell'informativa privacy (vedi struttura già usata in `privacy.html`, sezione "Conservazione dei dati").

## 5. Checklist di implementazione per un nuovo progetto

1. Mappare quali documenti/dati sensibili verranno raccolti dal form.
2. Definire la base giuridica per ciascun dato (contratto/legge vs. consenso esplicito).
3. Scrivere o aggiornare l'informativa privacy del progetto includendo questi dati (riusa la struttura di `privacy.html`).
4. Inserire il modulo di consenso esplicito prima di qualsiasi upload (checkbox dedicata, non preselezionata, link all'informativa, timestamp registrato).
5. Se in produzione: implementare upload diretto a storage con URL pre-firmati + crittografia a riposo + scansione antivirus.
6. Definire ruoli e permessi di accesso ai documenti (chi in azienda può vederli).
7. Impostare cancellazione automatica secondo i tempi di conservazione definiti al punto 3.
8. Preparare una procedura interna sintetica per la gestione di un eventuale data breach (chi avvisare, entro le 72 ore previste dall'Art. 33 GDPR).
9. Verificare se serve una DPIA (valutazione d'impatto) — tipicamente sì se il trattamento è sistematico e su larga scala o riguarda dati di categoria particolare.
10. Se si usa un fornitore esterno (hosting, storage, servizio di firma digitale, gateway di pagamento), verificare che sia coperto da un Accordo sul Trattamento dei Dati (DPA) conforme all'Art. 28 GDPR.
11. Far rivedere il tutto da un legale/DPO prima del lancio pubblico.

## 6. Componenti riutilizzabili già pronti

- **Checkbox di consenso esplicito** — implementata in `autoscuole gasparella aggiornato/rinnovo-online.html`, step Documenti: non preselezionata, testo specifico, link all'informativa, timestamp salvato nel record della pratica. Copiabile così com'è (HTML/CSS/JS) in altri form che raccolgono documenti.
- **Struttura di informativa privacy in 13 sezioni** — `autoscuole gasparella aggiornato/privacy.html`, riusabile come scheletro per qualsiasi nuovo cliente, aggiornando solo i dati societari e le finalità specifiche.
- **Disclaimer "demo/dati non persistiti"** — pattern di nota gialla/rossa usato in tutte le pagine demo per essere trasparenti quando una funzionalità è solo dimostrativa e non tratta ancora dati reali in modo sicuro.

## 7. Fonti di riferimento

- Garante per la protezione dei dati personali — indicazioni su identificazione e raccolta di documenti di riconoscimento: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1189435
- Garante Privacy — nota di chiarimento sul trattamento dei documenti di identità: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10244289
- Garante Privacy — dimostrazione dell'identità personale da parte dell'interessato: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/1049413
- Regolamento (UE) 2016/679 (GDPR) — in particolare Art. 5 (principi), Art. 6 (liceità), Art. 9 (categorie particolari), Art. 28 (responsabili del trattamento/DPA), Art. 30 (registro trattamenti), Art. 32 (sicurezza), Art. 33 (notifica violazioni)

---

*Questo file è pensato per essere copiato e adattato in ogni nuova cartella progetto Studio Digital che tratta documenti o dati sensibili dei clienti finali.*
