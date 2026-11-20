# Umsetzungsstand

1. Grundlage: React/Vite/TypeScript, Tailwind, selbst gehostete Schriften, 40 Brettpositionen, 3D-Tisch und bedienbares 2D-Raster vorhanden. Desktop- und Mobile-Screenshots geprüft; der vordere Brettrand wurde nachjustiert.
2. Lokales Spiel: Zugmaschine, Sonderfelder, beide Decks, Markt, Investitionen, Darlehen, Schulden, Konkurs, drei Siegmodi und Bots über IndexedDB verbunden.
3. Private Räume: SQLite-Durable-Object-Migration, Gastcookie, native WebSockets, Empfängerprojektion, Chat, Wiederverbindung, Übernahmefristen, Abstimmungen und Bereinigung implementiert. Zwei Browserprofile und ein Bot haben im lokalen Worker gekauft, gehandelt, einen Marktschluss erlebt und sich wiederverbunden.
4. Handel und Casino: gerichtete Angebotslimits, Darlehensprüfung, Gegenangebote, Besitzkarten und gemeinsame Blackjack-Abrechnung. Lokaler Casino-Browsertest und separater workerd-Neustart mit gespeichertem Auktionsalarm bestanden.
5. Betrieb: README mit Start-, Prüf- und Deploybefehlen, Grenzen des Gratisplans und manueller Anmeldung. Kein Cloud-Konto verbunden; Dry-Run ohne Veröffentlichung durchgeführt.

## Lokale Abnahme am 19.11.2026

- 21 Regel-, Protokoll- und Worker-Integrationstests bestanden. Darunter: Bus/Freifeld bei vollem Brett, Auktionsmindestabstand, bindendes Passen, Botreserve, automatischer Zugabschluss und einmaliger Zuschlag nach Neustart mit demselben SQLite-Verzeichnis.
- 5 Playwright-Abläufe bestanden: Desktop/Mobile mit Kamerainteraktion und Feldwahl, Gratis-Blackjack mit automatischem Zusatzwurf, Wurf vor Bewegung mit brettlokaler Ereigniskarte und Rückkehr zur Startansicht, Kaufblatt mit freiem Gebot sowie zwei unabhängige Gäste mit Fotokopf, Bot, Handel vor dem Wurf und Reconnect. Desktop 1440 × 940, Mobile 390 × 844 und die mobile Ereigniskarte visuell kontrolliert.
- Strict-Typecheck, ESLint und Produktionsbuild bestanden. Vite meldet für das separat geladene 3D-Paket eine Grössenwarnung, keinen Buildfehler.
- Wrangler-Dry-Run bestanden: Worker-Bundle rund 140 KiB gzip, 24 statische Dateien, Bindings `ROOMS` und `ASSETS` aufgelöst. Wrangler ist nicht angemeldet. Nicht öffentlich veröffentlicht, keine kostenpflichtigen Ressourcen aktiviert. Eine echte öffentliche Cloud-Partie, reale Mobilgeräte sowie Last- und Langzeittests sind nicht Teil der lokal bestätigten Nachweise.

Nächster Betriebsschritt nur bei gewünschter Veröffentlichung: im eigenen Workers-Free-Konto anmelden, deployen und über die ausgegebene HTTPS-Adresse eine private Partie mit zwei Geräten prüfen. Anleitung in der README.

Nachtrag Spielhandy und Mitteilungen: Private Zustellung im Worker, getrennte Unterhaltungen mit Lesestand, gebündelte Kursmeldungen und nichtmodales Handy implementiert. Die aktuelle lokale Abnahme umfasst **23 Regel-/Integrationstests und 6 Browsertests**. Die beiden Browsergäste haben Direktnachricht und Tischchat ausgetauscht; die mobile Prüfung kontrolliert auch Meldungen bei weggescrolltem Tisch. Handy- und Spielflächen wurden bei 390 × 844 und 1440 × 940 auf Überschneidungen geprüft. Lint und Produktionsbuild bestanden, keine Veröffentlichung ausgeführt.