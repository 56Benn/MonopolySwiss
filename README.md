# SWISS MARKET

Schweizer Wirtschaftsspiel für 2–6 Plätze mit echten privaten Online-Räumen oder lokalem Spiel gegen Bots. 40 Felder, 22 Branchenfirmen, vier Flughäfen, zwei VC-Projekte und zwei Kartendecks mit je 24 Karten. Die internationale Schlussreihe ist beabsichtigt. Alle Preise und Casino-Einsätze sind fiktives Spielgeld.

## Starten

Voraussetzung: Node.js 24 LTS und npm. Auf einem neuen Rechner zuerst `npm ci` ausführen; für Änderungen an Abhängigkeiten `npm install`. Die installierten Versionen sind im Lockfile festgehalten.

| Zweck | Befehl |
| --- | --- |
| Lokaler Spieltisch, schnelle Frontend-Entwicklung | `npm run dev` |
| Vollständiges Spiel mit Online-Lobbys auf dem eigenen Rechner | `npm run dev:online` |
| Typprüfung / Lint | `npm run typecheck` / `npm run lint` |
| Regel-, Protokoll- und isolierte Worker-Integrationstests | `npm test` |
| Statischen Client für Produktion bauen | `npm run build` |
| Chromium für Browserabnahme installieren | `npx playwright install chromium` |
| Browserabnahme inkl. eigenem lokalem Worker, falls keiner läuft | `npm run test:browser` |
| Cloud-Konfiguration prüfen, **nicht** veröffentlichen | `npm run build`, danach `npx wrangler deploy --dry-run` |

Vite: normalerweise `http://localhost:5173`. Vollständige lokale Auslieferung: `http://127.0.0.1:8787`. Offline-Spiel braucht weder Anmeldung noch Worker: **Lokal gegen Bots** wählen, Gastname und Figur wählen, bereit melden und starten. Das Neuladen stellt den Spielstand aus IndexedDB wieder her. Auch ein gewöhnlicher statischer Hoster kann das gebaute Verzeichnis `dist/` ausliefern; dort funktionieren nur lokale Partien, keine simulierten Online-Lobbys. Für Online-Entwicklung mit Hot Reload den Worker parallel auf Port 8787 laufen lassen.

Für eine private Online-Partie **Lobby erstellen**, Einladungslink kopieren und eine freie Figur wählen. Zwei unabhängige Gäste auf demselben Rechner benötigen getrennte Browserprofile oder einen privaten Browserkontext. Zwei Tabs desselben Profils sind absichtlich derselbe Gast. Ein sechsstelliger Code, auch mit führender Null, ist keine Identität. Löschen der Sitzungscookies verliert den Zugriff auf den belegten Platz. Eine Loopback-Adresse ist nicht aus dem Internet erreichbar.

## Aufbau

**Brettansicht:** Neue Gäste landen am **3D**-Tisch, ohne WebGL auf dem **Fotobrett**. Beide Ansichten verwenden dieselben Würfel; ohne Grafikbeschleunigung erscheinen die Werte als Zahlen. Es gibt kein Seitenmenü mehr: neben dem Brett steht nur das grosse Spielhandy, wahlweise links oder rechts (Handy → Menü). Mobil steht das Handy unter dem Brett. Ein Klick auf ein Feld öffnet die Feldkarte mit Foto, Mietstaffel, Werten und Verwaltung, ohne das Brett zu sperren.

**Tischtour:** Im Handy-Menü startet eine Führung durch Brett, Zug, Handy-Tabs und Ansichtswechsel. Die Tour verändert den Spielstand nicht, ist jederzeit überspringbar und endet spätestens nach drei Minuten.

**Handel:** Unter **Handel** stehen alle Mitspielenden als Karten, vorgeschlagene Partner (sie besitzen Felder, die dein Set vervollständigen) zuerst. **Karten anzeigen** zeigt ihr Portfolio mit Markierung, **Anfrage schicken** öffnet den Entwurf. Der Empfänger entscheidet sofort; das Spiel wartet höchstens 30 Sekunden. Danach führt das Handy zurück zur Partnerliste.

**Blackjack:** Wer auf dem Casino landet, bekommt 10 Mio. CHF und wählt „Annehmen“ oder „Annehmen & ins Casino“. Alle anderen erhalten eine Einladung; nach 10 Sekunden sind alle im Casino. Dann 5 Sekunden für Teilnehmen oder Zuschauen und 20 Sekunden für den Einsatz direkt am Tisch (Gastgeber bis 40 Mio., andere bis 10 Mio.). Der Tisch wird von oben gezeigt, Karten fliegen vom Schlitten zu den Plätzen, gespielt und abgerechnet wird von rechts nach links.

**Felder und Standortfotos:** Das 2D- und das 3D-Brett zeigen Aufnahmen der 22 Firmenstandorte und vier Flughäfen. Sechs Hauptsitze sind als Luftbilder von swisstopo gekennzeichnet. Die Feldkarte öffnet das grössere Foto mit Ortsangabe, Bildnachweis und bei Firmen dem Logo. Freie Felder sind hellgrau; bei Besitz werden 18 Prozent Spielerfarbe beigemischt. Alle Bilder werden lokal ausgeliefert. Die [Fotonachweise](public/orte/quellen.html) und [Logonachweise](public/logos/quellen.txt) liegen bei. Nur die optionalen Importbefehle `node scripts/import-sites.mjs` und `node scripts/import-logos.mjs` benötigen Internet und installiertes Playwright-Chromium.

**Spielhandy und Mitteilungen:** Tabs: **Tisch** (Konto, wer am Zug ist, vorheriges → neues Feld, Würfeln, Spielerliste mit Verbindung, Akku und Gerät, Abstimmungen, Bankrott melden, Transaktionen), **Portfolio**, **Handel**, **News** (diese Runde, letzte Runde, Älteres) und **Chat** im Messenger-Stil mit angeheftetem Tischchat. Neue Meldungen erscheinen 3 Sekunden oben im Handy; nach oben wischen blendet sie aus, ein Tipp öffnet die passende Seite. Beim Tab-Wechsel springt jede Seite auf ihre Startansicht zurück, nur der Handelsentwurf bleibt erhalten.

**Ein Spielzug:** Erst nach der Fahrt wirkt das Zielfeld. Bei einem freien Besitzfeld wählst du auf dem Brett Kaufen oder Ablehnen. Jede Zahlung (Kauf, Ausbau, Tilgung, Freikauf, Miete, Steuer, Busse) bestätigst du im Handy mit einem Wisch nach rechts (Tastatur: Pfeil rechts oder Ende); danach erscheint 2.5 Sekunden eine Bestätigung. Fehlt Geld, öffnet sich die Finanzierung ohne Frist; Mitspieler sehen live, was beliehen oder verkauft wird, und erst wenn das Geld reicht, laufen 10 Sekunden zum Bezahlen. Darlehen sind nach der Darlehensfrist der Lobby (Standard 5 Runden) zurückzuzahlen, mit Erinnerung eine Runde vorher. Bricht online die Verbindung ab, sperrt ein Overlay alle Eingaben, bis die automatische Wiederverbindung steht. Kaufverzicht lässt das Feld bei der Bank. Verkaufsauktionen sind optional. Nur am lokalen Tisch gibt es unten links temporäre Testknöpfe für Casino und Gefängnis.

**Figur und Tempowürfel:** Bei der Platzwahl lässt sich ein Foto hochladen oder mit der Kamera aufnehmen. Kamerazugriff braucht eine Freigabe und HTTPS oder localhost. Nur 48 × 48 Farbpixel werden für diesen Tisch gespeichert und geteilt. Unter **Tischregeln → Würfel** gibt es den optionalen Tempowürfel: 1/2/3 Zusatzfelder, zweimal Bus (nur der höhere Zahlenwürfel) oder Freifeld (ab dem normalen Ziel zum nächsten freien Besitz). Gibt es kein freies Besitzfeld, zählt die normale Summe.

- `game/`: Brett und Karteneffekte, ganzzahlige CHF-Rappen, gerundete Basispunkte, Zugmaschine, Wirtschaft, Blackjack, Empfängersichten. Nur der Regelkern entscheidet Ergebnisse. Zufall ist für Tests injizierbar.
- `server/`: Same-Origin-Worker, validierte Absichten, HttpOnly-/SameSite-Gastsitzung (über HTTPS zusätzlich Secure), pro Raum eine SQLite-backed Durable Object. Hibernierende native WebSockets, serialisierte Command-Verarbeitung, gespeicherte Aktions-IDs und Alarmzeitpunkte. Eine Zustandsänderung wird erst nach der Speichertransaktion verteilt. Raumcode-Kollisionen werden beim Anlegen behandelt.
- `bots/`: regelbasierte Entscheidungen ausschliesslich anhand der für den Bot zulässigen Sicht. Kein KI-Dienst.
- `ui/`, `three/`: deutscher React-Client, Spiellobby, Spielhandy, Brett und Casino. Geometrie, Kartenbilder und Beschriftungen entstehen lokal; Schriften werden mitgeliefert. Im Einstellungsmenü sind 2D-Modus, Effekte, Ton und Renderqualität verfügbar.
- `tests/`: wirtschaftliche Grenzfälle, verborgene Daten und Blackjack; echter Prozesswechsel mit persistierter Auktion. Browserprüfungen spielen mit zwei getrennten Gastsitzungen und einem Bot. Der gezielte Casino-Zustand existiert nur im lokalen Testprofil, nicht hinter einem Produktionsendpunkt.

Bei verborgenen Kontoständen fehlen fremde Guthaben und Vermögensverläufe im Payload. Aus öffentlichen Transaktionen können Mitspieler weiterhin Rückschlüsse ziehen. Der lokale Spielstand gehört dem Gerät und bietet absichtlich keinen Schutz vor Änderungen durch dessen Besitzer. Der Richemont-Startpreis von 69 Mio. ist ein vorläufiger Spielwert in `game/board.ts`.

## Cloudflare Free

1. Ein Cloudflare-Konto auf **Workers Free** verwenden. Manuelle Anmeldung einmal über `npx wrangler login` im eigenen Browser. Keine Schlüssel in das Projekt schreiben.
2. `npm run build` und `npx wrangler deploy --dry-run` prüfen. Die Konfiguration enthält `new_sqlite_classes`, `ROOMS` und `ASSETS`; keine kostenpflichtige Datenbank, externe API oder dauerhaft laufender Server ist nötig.
3. Erst bei gewollter Veröffentlichung `npm run deploy` ausführen. Die von Wrangler ausgegebene HTTPS-Adresse für Einladungen verwenden. Lokal wurde kein Cloud-Deployment ausgelöst.

Stand der geprüften Angaben: **19.11.2026**. [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) umfasst 100'000 dynamische Requests pro Tag und 10 ms CPU pro Aufruf. [SQLite Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/) umfasst 100'000 Requests und 13'000 GB-s pro Tag; 5 Mio. gelesene und 100'000 geschriebene Zeilen pro Tag, 5 GB Gesamtspeicher. Ein Alarm-Setzen zählt als Schreibvorgang. Worker- und DO-Kontingente sind getrennt. Direkt ausgelieferte [Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) sind kostenlos; hier läuft nur `/api/*` immer über den Worker.

Im Free-Plan bleiben, kein Upgrade oder kostenpflichtiges Zusatzprodukt aktivieren. Nutzung im Cloudflare-Dashboard beobachten: Insbesondere viele gleichzeitige Räume, Gebote und Nachrichten belasten Schreib- und Requestkontingente. Hibernation statt daueraktiver Sockets, Alarms statt Polling, gekappte Verläufe und Aufräumfristen reduzieren die Last, garantieren aber keine bestimmte Spielerzahl. Bei Überschreitung können Aktionen fehlschlagen; Tageskontingente werden um 00:00 UTC erneuert. Vor dem Deployment die verlinkten aktuellen Grenzen prüfen.