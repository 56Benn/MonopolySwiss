# Copilot-Auftrag: SWISS MARKET – Schweizer Firmen und internationale Schlussreihe als 3D-Brettspiel

Du arbeitest als erfahrener Fullstack-Entwickler, Game-Designer und UI-Designer direkt in meinem Projekt. Entwickle eine tatsächlich spielbare Webapp: ein Monopoly-inspiriertes Wirtschaftsspiel mit Schweizer Unternehmen und einer internationalen letzten Brettseite, dynamischen Unternehmenswerten, privaten Online-Lobbys, Bots, Handel, Chat und einem Blackjack-Casino.

Lies diesen Auftrag vollständig. Untersuche zuerst die vorhandene Projektstruktur und respektiere bestehende sinnvolle Konventionen. In einem leeren Repository initialisierst du das Projekt. Stelle nur Fragen, wenn du wirklich blockiert bist. Die folgenden Regeln sind bewusste Produktentscheidungen und gelten als Arbeitsgrundlage. Implementiere in Etappen, mit einem durchgängig lauffähigen Projekt. Liefere Code und verbinde sämtliche Funktionen; eine hübsche Demo mit funktionslosen Schaltflächen reicht nicht.

## 1. Ergebnis und technische Grundlage

- Arbeitstitel: **SWISS MARKET**. Eigene visuelle Identität, eigene Spielfiguren und selbst gestaltetes Brett. Die Fotos sind Referenzen für Firmen, Spielwerte und das Prinzip der Wertpapierkarten. Die Umsetzung soll zeitgemäss und eigenständig aussehen.
- UI auf Deutsch mit Schweizer Schreibweise, `de-CH`, Währung CHF. Alle Beträge sind fiktive Spielwerte, keine realen Unternehmensbewertungen.
- 2–6 Spielerplätze, Menschen und Bots beliebig gemischt. Solo gegen Bots muss ohne Online-Konfiguration funktionieren.
- Frontend: React, TypeScript strict, Vite, Tailwind CSS, Three.js über React Three Fiber und Drei. Für UI-Bewegungen Motion oder eine vergleichbare schlanke Bibliothek. Keine kostenpflichtigen Assets oder APIs. Versionskompatibilität prüfen und Lockfile verwenden.
- Kein eigener dauerhaft laufender Express-Server. Für Online-Multiplayer ein kleines TypeScript-Backend auf **Cloudflare Workers mit SQLite-backed Durable Objects und WebSockets**. Frontend im selben Projekt über Workers Static Assets ausliefern. Pro Spielraum ein autoritatives Durable Object. Native WebSockets verwenden, kein Socket.IO voraussetzen.
- Ausschliesslich den Cloudflare-Free-Tier voraussetzen. SQLite-Durable-Object-Migrationen korrekt konfigurieren. Hibernation WebSocket API und persistente Alarms für Fristen verwenden. Kein permanentes Polling, keine pro Sekunde gespeicherten Timer, keine Server-Animationsframes.
- Gratis gilt innerhalb der jeweils aktuellen Kontingente. Deployment-Anleitung soll die aktuellen offiziellen Limits verlinken und erklären, wie man im Free-Plan bleibt. Keine kostenpflichtigen Dienste automatisch aktivieren.
- Optionaler vollständig lokaler Modus: derselbe Spielkern mit lokalem Transport und Speicherung in IndexedDB. Er funktioniert statisch gehostet gegen Bots. Online-Lobby und lokales Spiel müssen in der UI eindeutig unterscheidbar sein.
- Keine Registrierung erforderlich: Gastname, Spielfigur und sichere wiederverwendbare Gastsitzung. Eine sechsstellige Raumnummer ersetzt keine Spieleridentität.

## 2. Architektur und verlässlicher Spielablauf

Trenne die Spiellogik strikt von Darstellung, Netzwerk und Animationen. Vorgeschlagene Bereiche: `game/` für Regeln und Daten, `server/` für Raum und Kommunikation, `ui/`, `three/`, `bots/`, `tests/`. Passe das an eine vorhandene Struktur an.

- Modell mit typisierten Commands und Domain-Events, beispielsweise `ROLL_DICE`, `BUY_COMPANY`, `BID`, `PROPOSE_TRADE`, `ACCEPT_TRADE`, `PLACE_CASINO_BET`, `BLACKJACK_HIT`, `BLACKJACK_STAND`, `END_TURN`.
- Explizite Zustandsmaschine für Lobby, Zugbeginn, Würfeln, Bewegung, Feldauflösung, Kauf/Auktion, Schuldenklärung, Verwaltung, Casino und Spielende. Jede Aktion ist nur in passenden Zuständen erlaubt.
- Geld intern als sichere ganze Zahl in CHF-Rappen verarbeiten. Prozentwerte als Integer-Basispunkte. Keine Gleitkomma-Geldbuchungen; an Buchungsgrenzen einheitlich runden und Integer-Grenzen prüfen.
- Online entscheidet ausschliesslich der Server über Würfel, Karten, Kurse, Kontostände, Eigentum, Bot-Aktionen und Blackjack. Clients senden Absichten, niemals neue Kontostände oder fertige Würfelergebnisse.
- Zufall aus serverseitigem kryptografischem RNG; für Tests eine deterministische RNG-Schnittstelle injizieren. Verborgene Kartenfolgen und Zufallszustände nie übertragen.
- Commands pro Raum seriell und atomar verarbeiten, auch über asynchrone Operationen hinweg. `actionId`, Zustandsversion und Deduplizierung schützen vor Doppelbuchungen und wiederholten Requests. Persistieren, bevor bestätigte Änderungen veröffentlicht werden.
- Bei veralteten Entscheidungen gezielt den betroffenen Zustand prüfen. Chat darf beispielsweise keinen gültigen Spielzug nur wegen eines neuen globalen Versionszählers ungültig machen.
- Nach einem Refresh Snapshot und seitdem relevante Ereignisse synchronisieren. Ein Reconnect löst keine Zahlung, Karte oder Würfelaktion erneut aus.
- Fristen sind serverseitige Zeitpunkte; lokale Countdown-Anzeigen dienen nur der Darstellung. Eine kurzzeitige Verbindungsstörung darf keine Partie zerstören.
- Client-Ansichten pro Empfänger erzeugen. Verborgene Kontostände, Handkarten, private Trades und die verdeckte Dealerkarte dürfen nicht im allgemeinen Snapshot oder Eventstream liegen.
- 3D-Animationen visualisieren bereits entschiedene Ergebnisse. Sie beeinflussen keine Spielregeln, blockieren den Server nicht und dürfen beim Reconnect übersprungen werden.

## 3. Lobby und Einstellungen

Startansicht mit drei klaren Aktionen: `Lobby erstellen`, `Mit Code beitreten`, `Lokal gegen Bots`.

- Einladung über **genau sechs Ziffern**, inklusive möglicher führender Nullen; Code als String behandeln. Dazu kopierbarer Einladungslink. Kollisionen bei der Erstellung serverseitig behandeln.
- Beitritt über Name und freie Figur. Ready-Anzeige, Host-Kennzeichnung, Bots hinzufügen/entfernen und Schwierigkeitsgrad je Bot. Start nur mit mindestens zwei Plätzen und allen Menschen bereit.
- Host kann Einstellungen vor dem Start ändern. Änderungen setzen die Ready-Bestätigung zurück. Nach Spielstart sind Regeln gesperrt; weitere Personen können keine belegten Plätze übernehmen.
- Host darf vor dem Start Personen entfernen und die Lobby sperren. Hostrolle gibt während der Partie keine Rechte, Geld oder Würfel zu manipulieren.
- Verlässt der Host den Raum, übernimmt ein anderer verbundener Mensch die organisatorische Rolle; das Spiel läuft auf dem Server weiter.

| Einstellung | Auswahl und Standard |
|---|---|
| Startguthaben | 250 / **500** / 750 / 1'000 Mio. CHF pro Spieler |
| Würfel | **2** oder 3 sechsseitige Würfel |
| Siegbedingung | **Alle anderen bankrott** / erster Konkurs / Nettovermögensziel |
| Nettovermögensziel, nur im entsprechenden Modus | 1'000 / 1'500 / **2'000** / 3'000 / 5'000 Mio. CHF / eigener Betrag; zwingend höher als das Startguthaben |
| Fremde Kontostände | **Sichtbar** / verborgen |
| Marktvolatilität | Ruhig / **Normal** / Wild |
| Automatische kleine Marktschwankung je Spielrunde | **Aus** / an |
| Auktionen nach abgelehntem Kauf | **An** / aus |
| Zuglimit | **90 Sekunden** / 120 Sekunden / ohne Limit |
| Mietniveau | Entspannt 0.75× / **Normal 1×** / hart 1.25× |
| Vollständige Branche zum Investieren nötig | **Ja** / nein |
| Verbindungsabbruch | **Bot übernimmt nach 90 Sekunden bis zur Rückkehr** / automatisch passen |
| Wettbewerbsmodus | **Aus** / an: Mehrheit über Pause und Aufgabe, keine Regeländerungen |

Zusätzlich drei verständliche Presets: `Entspannt`, `Börsenabend`, `Chaos an der Börse`. Sie ändern nur die oben definierten Einstellungen und zeigen ihre Werte offen. Erweiterte Optionen hinter einem aufklappbaren Bereich. Keine zwanzig unverständlichen Schalter direkt auf der ersten Seite.

Die Siegbedingung ist eine eigene zentrale Lobby-Auswahl und gilt nach Spielstart unveränderlich. Ungültige Nettovermögensziele ausblenden bzw. mit verständlicher Meldung ablehnen. Für diese Version keinen zusätzlichen Zeit-Siegmodus einbauen. Eine freiwillige Spieldaueranzeige ist lediglich Information und beendet die Partie nicht.

Eine **Spielrunde** bedeutet: Jeder noch aktive Platz hat einmal seinen regulären Zug erhalten, auch wenn er im Gefängnis aussetzt. Ein **Zug** gehört genau einem Spieler und kann mehrere Würfe enthalten. Zusatzwürfe starten keine neue Spielrunde. Verwende diese Begriffe konsistent in UI und Regeln.

## 4. Spielbrett und Startwerte

Ein quadratisches 40-Felder-Brett mit vier grossen Ecken. Die Reihenfolge unten ist verbindlich und datengetrieben. Alle Preise stehen in **Mio. CHF**.

Die aus den Fotos erkennbaren Schweizer Firmen und ihre Startwerte werden übernommen. Die letzte Brettseite zwischen `Gehe ins Gefängnis` und `START`, also Felder 31–39, enthält bewusst die ausländischen Firmen aus der Vorlage: General Motors, Volkswagen, Toyota, Microsoft und Apple sowie den Flughafen Los Angeles. Schweizer und internationale ICT bilden getrennte vollständige Branchen. Alle Preise bleiben fiktive Spielwerte, keine Rangliste realer Unternehmensbewertungen. Die Fotos müssen für die Umsetzung nicht verfügbar sein, da alle notwendigen Daten hier stehen.

| Feld | Name | Typ / Branche | Startwert | Herkunft |
|---|---|---|---:|---|
| 0 | START | Ecke | – | Startbonus 60 Mio. aus Foto |
| 1 | Logitech International | ICT (CH) | 28 | Foto |
| 2 | Ereignis | Karte | – | – |
| 3 | Swisscom | ICT (CH) | 118 | Foto |
| 4 | Einkommenssteuer | Steuer | 65 | Foto |
| 5 | Flughafen Genf | Flughafen | 63 | Foto |
| 6 | Swatch Group | Uhren & Luxus | 30 | Foto |
| 7 | Chance | Karte | – | – |
| 8 | Richemont | Uhren & Luxus | 69 | Foto, unscharfe Preiszeile; vorläufiger Spielwert |
| 9 | Rolex | Uhren & Luxus | 25 | Foto |
| 10 | Gefängnis / Nur zu Besuch | Ecke | – | – |
| 11 | Bell Food Group | Lebensmittel | 23 | Foto |
| 12 | VC Fintech | Beteiligung | 55 | Foto |
| 13 | Barry Callebaut | Lebensmittel | 28 | Foto |
| 14 | Nestlé | Lebensmittel | 125 | Foto |
| 15 | Flughafen Basel-Mulhouse | Flughafen | 65 | Foto |
| 16 | Georg Fischer | Industrie | 20 | Foto |
| 17 | Ereignis | Karte | – | – |
| 18 | Schindler | Industrie | 25 | Foto |
| 19 | ABB | Industrie | 75 | Foto |
| 20 | Casino | Ecke | – | ersetzt Wall Street |
| 21 | UBS | Banken & Versicherungen | 80 | Foto |
| 22 | VC Climate Tech | Beteiligung | 55 | Foto |
| 23 | Zurich Insurance | Banken & Versicherungen | 72 | Foto |
| 24 | Swiss Re | Banken & Versicherungen | 43 | Foto |
| 25 | Flughafen Zürich | Flughafen | 65 | Foto |
| 26 | Novartis | Life Sciences | 100 | Foto |
| 27 | Roche | Life Sciences | 98 | Foto |
| 28 | Chance | Karte | – | – |
| 29 | Syngenta | Life Sciences | 62 | Foto |
| 30 | Gehe ins Gefängnis | Ecke | – | – |
| 31 | General Motors | Automobilindustrie (international) | 50 | Foto |
| 32 | Volkswagen Group | Automobilindustrie (international) | 70 | Foto |
| 33 | Ereignis | Karte | – | – |
| 34 | Toyota Motor Corporation | Automobilindustrie (international) | 122 | Foto |
| 35 | Los Angeles International Airport | Flughafen | 55 | Foto |
| 36 | Chance | Karte | – | – |
| 37 | Microsoft | ICT (international) | 140 | Foto |
| 38 | Vermögenssteuer | Steuer | 35 | Foto |
| 39 | Apple | ICT (international) | 135 | Foto |

Die acht Branchen sind `ICT (CH)`, `Uhren & Luxus`, `Lebensmittel`, `Industrie`, `Banken & Versicherungen`, `Life Sciences`, `Automobilindustrie (international)` und `ICT (international)`. Branchen sind Spielgruppen; insbesondere `Life Sciences` ist bewusst breit gefasst. Flughäfen bilden eine eigene Sondergruppe und VC-Projekte eine weitere. Keine echten Börsenkurse oder externen Finanz-APIs einbauen. Die unscharfe Preiszeile von Richemont wird mit 69 Mio. als vorläufigem Spielwert verwendet; diesen Eintrag bei einem späteren besseren Referenzfoto einfach in der Datendatei anpassen können.

Für Flughäfen und VC gelten die im Abschnitt Wirtschaft beschriebenen Sonderregeln. Sie zählen nicht als normale Industrieunternehmen. Jedes kaufbare Feld zeigt Name, Farbe/Symbol der Gruppe, aktuellen Wert und Besitzer.

## 5. Grundregeln, Eigentum und Wirtschaft

- Alle starten auf START. Reihenfolge einmal zufällig festlegen, danach stabil im Uhrzeigersinn.
- Beim Vorwärtsüberqueren oder regulären Erreichen von START einmal **60 Mio. CHF** erhalten, niemals doppelt. Kein Bonus beim direkten Transport ins Gefängnis oder bei Rückwärtsbewegung. Karten müssen ausdrücklich festlegen, ob START-Bonus gilt.
- Die Summe aller aktivierten Würfel ist die Bewegung. Bei drei Würfeln zählen für die Paschregel **nur die ersten beiden Würfel**; der dritte erhöht nur die Bewegung. Damit bleibt die Paschwahrscheinlichkeit vergleichbar.
- Ein Pasch erlaubt nach vollständiger Feldauflösung einen weiteren Wurf. Drei aufeinanderfolgende Pasche im selben Zug führen sofort ins Gefängnis; beim dritten Pasch nicht mehr regulär ziehen. Ein Gefängnisaufenthalt beendet Zusatzwürfe.
- Unbesetzte Firma: zum aktuellen Wert kaufen oder ablehnen. Bei eingeschalteten Auktionen folgt sofort eine offene Auktion für alle zahlungsfähigen Spieler, auch den ablehnenden Spieler. Startgebot 1 Mio., Mindestschritt 1 Mio., 15 Sekunden mit Verlängerung um 5 Sekunden bei späten Geboten, maximal 45 Sekunden. Kein Gebot: bleibt bei der Bank. Gebote reservieren Geld; Abbruch oder Konkurs korrekt auflösen.
- Auf fremder Firma wird automatisch die berechnete Miete an den Besitzer fällig. Eigene Firma: keine Zahlung. Belehnte Firmen erzielen keine Miete. Gefangene Besitzer erhalten weiterhin Miete.
- Auf eigenen Firmen kann man in einer Verwaltungsphase investieren, belehnen, zurückzahlen oder verkaufen; dieselben Regeln gelten für Bots.
- Vollständige Branche bedeutet: alle normalen Firmen dieser Gruppe gehören demselben Spieler und keine davon ist belehnt.
- Bis zu vier **Investitionsstufen** je Firma, sichtbar als hochwertige 3D-Geldstapel oder kleine Firmengebäude. Standardmässig erfordert Investieren die vollständige Branche. Gleichmässig bauen und abbauen: Unterschied innerhalb der Gruppe maximal eine Stufe; diese Regel entfällt bei deaktivierter Branchenpflicht.
- Jede Stufe kostet **15 % des aktuellen Firmenwerts** beim Kauf, entsprechend dem Prinzip der fotografierten Karte. Tatsächlich gezahlte Kosten je Stufe speichern.
- Normale Miete: 4 % des aktuellen Firmenwerts. Bei vollständiger Branche ohne Ausbau: 8 %. Bei 1/2/3/4 Investitionsstufen: 12 % / 18 % / 28 % / 42 %. Branchenbonus nicht zusätzlich auf diese Ausbauwerte multiplizieren. Anschliessend globalen Mietfaktor anwenden.
- Dies ist eine bewusst gemässigtere Web-Spiel-Rendite als die sehr hohen Ausbaurenditen der fotografierten Rolex-Karte. Im Regelheft transparent erklären; keine realistische Dividende behaupten.
- Investitionsstufe verkaufen: 50 % ihrer tatsächlich gezahlten Baukosten zurück. Kein Erstattungsgewinn durch spätere Kurssteigerung.
- Beleihen nur ohne Ausbau in der gesamten eigenen Gruppe: Auszahlung 50 % des aktuellen Firmenwerts. Darlehensbetrag wird bei Aufnahme festgeschrieben. Rückzahlung kostet diesen Betrag plus einmalig 10 %. Kursänderungen verändern eine bereits bestehende Schuld nicht.
- Freiwilliger Firmenverkauf an die Bank nach Rückbau: 60 % des aktuellen Firmenwerts; ein bestehendes Darlehen wird zuerst abgezogen. Eine ungedeckte Restschuld muss der Spieler bezahlen. Vorher klare Vorschau zeigen. Verkauf kann keine Schulden verschwinden lassen.
- Flughafen: Kauf zum eigenen Startwert; Miete bei 1/2/3/4 gleichzeitig besessenen, unbeliehenen Flughäfen beträgt 5/10/20/40 Mio. CHF. Keine Ausbaustufen. Beleihung und Bankverkauf wie oben.
- VC-Projekt: keine Ausbaustufen. Miete = Bewegungs-Würfelsumme × 1 Mio. bei einem besessenen unbeliehenen VC-Projekt bzw. × 2.5 Mio. bei beiden. Wenn eine Bewegungskarte auf ein VC-Feld führt, erzeugt der Server dafür einen separaten Mietwurf mit der eingestellten Würfelanzahl; dieser bewegt niemanden und erzeugt keinen Zusatzwurf.
- Mietfaktor gilt auch für Flughäfen und VC. Markt-Ereignisse verändern standardmässig die 22 Branchenfirmen, nicht die festen Flughafen-/VC-Sondermieten.
- Schulden lösen zuerst einen eigenen Schuldenzustand aus: andere freiwillige Geldaktionen sperren, erlaubte Liquidation anbieten, Zahlung nach Deckung abschliessen. Keine negativen frei verfügbaren Kontostände und keine Käufe auf Kredit.
- Für Schuldenklärung eine eigene Frist von 90 Sekunden verwenden, auch bei Zügen ohne Limit. Bei Ablauf automatisch regelkonform Ausbaustufen liquidieren, Firmen belehnen und nötigenfalls verkaufen. Reicht das gesamte verwertbare Vermögen nicht, folgt Konkurs.
- Konkurs gegenüber einem Mitspieler: verbleibendes Geld und Eigentum inklusive bestehender Darlehen gehen an den Gläubiger, Ausbau wurde zuvor liquidiert. Konkurs gegenüber der Bank: Eigentum geht unbelastet zurück an die Bank. Danach zuerst die Siegbedingung prüfen; nur bei weiterlaufender Partie nacheinander versteigern, sofern Auktionen aktiv sind. Ausstehende Trades, Gebote und Casino-Reservierungen vorher konsistent freigeben; kein Vermögen doppelt verteilen. Gebotene Beträge dürfen nicht mehr anderweitig ausgegeben werden.

### Sieg und Spielende

Die Lobby wählt genau einen von drei Modi:

1. **Alle anderen bankrott:** Der letzte nicht bankrotte Spieler gewinnt. Gemeint ist, dass alle seine Gegner ausgeschieden sind, nicht dass sämtliche Spieler inklusive Sieger bankrott sein müssen.
2. **Erster Konkurs:** Sobald der erste Konkurs vollständig abgewickelt ist, endet die Partie. Von den verbleibenden Spielern gewinnt der mit dem höchsten Nettovermögen. Es wird nicht bis zum Ende der Spielrunde weitergespielt; nach dem entscheidenden Konkurs keine neuen Bank-Auktionen oder freiwilligen Aktionen starten.
3. **Nettovermögensziel:** Wer zuerst das in der Lobby gewählte Nettovermögen erreicht oder überschreitet, gewinnt. Standardziel 2'000 Mio. CHF, im Lobby-Dropdown oder über eigenen Betrag änderbar. Ziel muss oberhalb des gewählten Startguthabens liegen, damit das Spiel nicht sofort endet.

**Nettovermögen** = eigenes Bargeld einschliesslich einmalig gezählter reservierter eigener Geldbeträge + aktuelle Firmen-/Sonderfeldwerte + 50 % tatsächlich gezahlter verbleibender Ausbaukosten − offene Darlehensbeträge. Ein noch nicht ausgespielter Casino-Gratisbetrag ist kein Bargeld und zählt nicht zum Nettovermögen. In der eigenen Portfolioansicht den Rechenweg und bei Zielmodus den eigenen Fortschritt anzeigen. Verborgene fremde Kontostände nicht über fremde Fortschrittsbalken verraten.

Sieg serverseitig nach jeder vollständig abgeschlossenen wirtschaftlichen Aktion prüfen, beispielsweise Kauf, Zahlung, Handel oder Markt-Ereignis. Alle Firmenänderungen derselben Marktkarte atomar behandeln. Bei einer Casino-Runde erst alle Hände regulär abrechnen und danach die komplette Abrechnung einmal auf Sieg prüfen; keine halbfertige Auszahlung als Siegzustand verwenden. Erreichen mehrere Spieler durch dasselbe atomare Ereignis gleichzeitig das Ziel, entscheidet das höhere Nettovermögen, dann das höhere Bargeld, danach geteilter Sieg. Das gleiche Tie-Breaking gilt beim ersten Konkurs. Scheiden alle verbliebenen Spieler im selben atomaren Ereignis aus, endet die Partie unentschieden; keine nicht vorhandene Siegerperson erzeugen. In den Modi erster Konkurs und Nettovermögensziel endet die Partie gegebenenfalls ebenfalls, wenn zuvor nur noch ein zahlungsfähiger Spieler übrig ist.

Abschlussansicht mit Vermögensverlauf, grösstem Deal, stärkster Branche und grösstem Casino-Gewinn. Bei verborgenen Kontoständen erst jetzt vollständige Zahlen offenlegen. Neuauflage als neue Lobby anbieten.

## 6. Dynamische Unternehmenswerte

Kein Excel nötig. Beim Ziehen einer Ereigniskarte bestimmt der Server transparent einen Prozentwert und wendet ihn für alle betroffenen Firmen gleichzeitig an.

- Ruhig: Betrag 3–10 %, Normal: 8–20 %, Wild: 15–35 %; gleichverteilte ganze Prozentwerte. Richtung und Zielgruppe stehen auf der Karte. Karten mit ausdrücklich festem Prozentwert überschreiben den Bereich.
- Beispiel: `Netzausbau-Boom – ICT (CH) steigt um 14 %`. Swisscom und Logitech steigen beide um 14 %, Microsoft und Apple bleiben bei dieser Karte unverändert. Eine Karte für `ICT (international)` betrifft dagegen nur Microsoft und Apple. Betroffen sind auch ungekaufte und belehnte Firmen.
- Formel: `neuerWert = bisherigerWert × (1 + prozent/100)`, anschliessend einheitlich runden und auf **40–250 % des ursprünglichen Startwerts** begrenzen. Tatsächliche Änderung nach Begrenzung anzeigen.
- Der Wert verändert Kaufpreis, normale Firmenmiete, nächste Investitionskosten, Beleihungsbasis und Bankverkaufswert. Bereits bezahlte Baukosten und laufende Darlehensbeträge bleiben unverändert. Ein Kursgewinn bucht kein Bargeld.
- Pro Firma Verlauf und letzte Änderungen speichern; im UI als Sparkline und klare Zahl anzeigen. Unternehmenskarte zeigt Startwert und aktuellen Wert getrennt.
- Optionaler automatischer Marktmodus: am Ende jeder Spielrunde genau eine kleine Änderung je Branche zwischen −2 und +2 %. Ein Branchenwert gilt dabei für alle Firmen dieser Branche. Dieselben Grenzen anwenden. Standard aus, damit Karten der zentrale Auslöser bleiben.
- Alle Veränderungen als kurze Börsennachricht mit Grund, betroffener Gruppe und Vorher/Nachher darstellen. Keine hektischen Hintergrundticker ohne spielerischen Nutzen.

## 7. Ereignis- und Chancekarten

Zwei getrennte serverseitig gemischte Decks. Ohne Zurücklegen ziehen; leeres Deck aus Ablagestapel neu mischen. Karten im Besitz eines Spielers sind bis zur Verwendung oder Rückgabe nicht im Deck. Jede Karte hat stabile ID, verständlichen Text, Icon, typisierten Effekt, Ziel, Dauer und gegebenenfalls Betrag. Sofortkarten sind nicht handelbar. Dauerhafte Besitzkarten dürfen gehandelt werden.

Implementiere mindestens die folgenden **24 Ereigniskarten**. `Bereich` bedeutet Zufallsbetrag aus der eingestellten Volatilität. Sämtliche Schlagzeilen sind fiktive Spielereignisse.

| Karte | Effekt |
|---|---|
| Netzausbau-Boom | ICT (CH) +Bereich |
| Digitale Durststrecke | ICT (CH) −Bereich |
| Luxus ausverkauft | Uhren & Luxus +Bereich |
| Luxusflaute | Uhren & Luxus −Bereich |
| Schweizer Produkte gefragt | Lebensmittel +Bereich |
| Rohstoffe werden teurer | Lebensmittel −Bereich |
| Volle Auftragsbücher | Industrie +Bereich |
| Lieferketten unter Druck | Industrie −Bereich |
| Vertrauen kehrt zurück | Banken & Versicherungen +Bereich |
| Turbulenzen am Finanzplatz | Banken & Versicherungen −Bereich |
| Forschungserfolg | Life Sciences +Bereich |
| Forschung verzögert sich | Life Sciences −Bereich |
| Cloud-Boom | ICT (international) +Bereich |
| Chip-Lieferengpass | ICT (international) −Bereich |
| Autos weltweit gefragt | Automobilindustrie (international) +Bereich |
| Absatzflaute auf dem Automarkt | Automobilindustrie (international) −Bereich |
| Börsenfrühling | Alle acht Branchen +8 % |
| Schwarzer Handelstag | Alle acht Branchen −10 % |
| Starker Franken | Industrie −10 %, Banken & Versicherungen +8 % |
| Elektromobilitäts-Offensive | Automobilindustrie (international) +15 %, Industrie +5 % |
| KI-Offensive | ICT (CH) und ICT (international) +12 % |
| Konsum zieht an | Lebensmittel und Uhren & Luxus +12 % |
| Kapitalrotation | Zufällige Branche +15 %, andere zufällige Branche −12 % |
| Überraschende Marktreaktion | Zufällige Branche; Richtung 50/50, Betrag aus Bereich |

Implementiere mindestens die folgenden **24 Chancekarten**:

| Karte | Effekt |
|---|---|
| Dein Start-up geht an die Börse | +60 Mio. |
| Strafe für Steuerhinterziehung | −20 Mio. |
| Erfolgreiche Beratung | +15 Mio. |
| Patent verkauft | +25 Mio. |
| Betriebskosten explodieren | −15 Mio. |
| Steuerrückerstattung | +12 Mio. |
| Verpasste Frist | −8 Mio. |
| Investorenpreis | +20 Mio. |
| Falsch geparkte Firmenflotte | −5 Mio. |
| Erfolgreicher Messeauftritt | +10 Mio. |
| Cybervorfall im eigenen Portfolio | −18 Mio. |
| Förderbeitrag | +18 Mio. |
| Portfolioausschüttung | 2 % der aktuellen eigenen normalen Firmenwerte, maximal +30 Mio.; Zahlung von Bank |
| Vermögensabgabe | 2 % der aktuellen eigenen normalen Firmenwerte, maximal −25 Mio.; Zahlung an Bank |
| Vorstand auf Geschäftsreise | Vorwärts zu START, einmal Startbonus |
| Sitzung in Zürich | Vorwärts zum Flughafen Zürich; START-Bonus falls überquert; reguläres Feld auflösen |
| Quartalsbesuch | Vorwärts zur nächsten normalen Firma; START-Bonus falls überquert; reguläres Feld auflösen |
| Falsche Abzweigung | Drei Felder zurück, ohne START-Bonus; Zielfeld vollständig auflösen |
| Untersuchungshaft | Direkt ins Gefängnis, kein START-Bonus |
| Anwalt regelt das | Eine handelbare Gefängnis-frei-Karte behalten; einmalig verwendbar |
| Zweiter Anwaltstermin | Eine zweite eigenständige Gefängnis-frei-Karte; gleiche Regeln |
| Betriebsausfallversicherung | Handelbare Besitzkarte: bei einer späteren negativen Chance-Geldkarte freiwillig einsetzen; erstattet bis 30 Mio., danach verbraucht |
| Übernahmegutschein | Handelbare Besitzkarte: beim nächsten direkten Firmenkauf von Bank 15 % Rabatt, maximal 10 Mio.; nicht bei Auktion, Trade oder Bankverkauf; danach verbraucht |
| Risikokapital-Wette | Wahl: sicher +5 Mio. oder einmal 50/50 +35 Mio. bzw. −20 Mio.; vor Entscheidung beide Ergebnisse zeigen |

Besitzkarten mit klaren Einsatzfenstern und serverseitiger Frist implementieren. Versicherungen gelten nicht für Miete, Steuern, Casino oder Gefängnisgebühr. Ein Gutschein beeinflusst nicht den anschliessenden Marktwert. Nach Verwendung wandert die Karte in ihren Ablagestapel.

Bewegungskarten können weitere Kartenfelder treffen. Ketten korrekt auflösen, aber mit einer defensiven Begrenzung von 20 automatischen Feldauflösungen je Wurf gegen fehlerhafte Endlosschleifen schützen; bei Erreichen den Zug sicher pausieren und Diagnose anzeigen.

## 8. Casino: exakt eine gemeinsame Blackjack-Runde

Das frühere Wall-Street-Feld wird durch ein Casino ersetzt. Es öffnet sich nur beim tatsächlichen Landen, niemals beim Vorbeiziehen oder durch einen frei zugänglichen Wiederholen-Button. Der normale Brettspielzug wartet, bis genau diese Casino-Runde abgeschlossen ist.

### Einsatz

- Spieler auf dem Casino erhält einen einmaligen, von der Spielbank finanzierten **Gratis-Einsatz von 10 Mio. CHF** für diese Runde. Vor dem Ausspielen kann er diesen Betrag weder auf sein Konto überweisen noch handeln. Betrag bleibt während der gesamten Partie fix, unabhängig von Startguthaben, Vermögen und Kursen.
- Dieser Spieler kann ablehnen, nur den Gratisbetrag spielen oder zusätzlich eigenes frei verfügbares Bargeld einsetzen, bis maximal zu seinem verfügbaren Kontostand. Er darf dafür keine neuen Schulden aufnehmen.
- Alle anderen aktiven Spieler, auch Gefangene, bekommen einmalig die Möglichkeit mitzumachen. Sie bezahlen selbst und dürfen jeweils höchstens **10 Mio. CHF** einsetzen. Sie erhalten keinen Gratisbetrag. Der Zusatzbetrag des auslösenden Spielers erhöht diese Obergrenze nicht.
- Alle Einsätze vor der ersten Karte verbindlich festlegen und eigenes Geld atomar abbuchen/reservieren. Nach Kartenausgabe keine Erhöhung. Minimum für eigene Einsätze 0.5 Mio., Schritte 0.5 Mio. Der Gratisbetrag ist immer ganz oder gar nicht verwendbar.
- 15 Sekunden Beitrittsfenster; explizit `Passen` möglich. Auch wenn der auslösende Spieler passt, dürfen die anderen ihre bezahlte Hand spielen. Wenn niemand teilnimmt, sofort zum Brett zurückkehren.
- Nur fiktives Spielgeld ohne Echtgeld-Funktionen.

### Regeln

- Ein gemeinsamer Dealer, ein frisch gemischter Sechs-Deck-Schuh je Casino-Besuch, jeder Teilnehmer genau eine Hand. Auslösender Spieler zuerst, danach übrige Plätze im Uhrzeigersinn.
- Blackjack = Ass plus 10-Wert-Karte mit den ersten zwei Karten. Natürlicher Blackjack schlägt eine spätere 21. Zwei natürliche Blackjacks sind Gleichstand.
- Asse korrekt als 1 oder 11 bewerten. Dealer bleibt auf jeder 17 stehen, auch Soft 17. Bei Ass oder 10 als offener Dealerkarte nach initialer Ausgabe auf Dealer-Blackjack prüfen, ohne die verdeckte Karte vorher an Clients zu senden.
- Aktionen `Karte` und `Bleiben`. Kein Split, Double Down, Insurance, Side Bet oder erneuter Einsatz. So bleibt es sicher bei genau einer Runde je Casino-Besuch.
- Pro Entscheidung 20 Sekunden; Timeout bedeutet automatisch `Bleiben`. Spieler mit Blackjack oder Bust sind fertig. Falls alle bust sind, keine unnötigen Dealer-Ziehaktionen.
- Normale Gewinnquote **1:1**, natürlicher Blackjack **3:2**. Inklusive zurückgezahltem Einsatz sind das **2×** bzw. **2.5×** des gespielten Betrags; nicht 3× beim Blackjack. Bei Gleichstand Einsatz zurück. Dealer-Bust gewinnt gegen jede nicht überkaufte Hand.

### Verbindliche Abrechnung inklusive Gratis-Einsatz

Für alle tatsächlich gespielten Chips gelten dieselben normalen Blackjack-Auszahlungen. Der Gratis-Einsatz wird wie ein von der Spielbank bezahlter Einsatz behandelt, nicht wie ein Gutschein mit Sonderregel nur auf den Gewinn. Das ist eine bewusste Spielregel für diese Webapp; Bonusbedingungen realer Casinos werden nicht übernommen. Definiere `F = 10 Mio.` für den auslösenden Teilnehmer bei Teilnahme, sonst 0; `A = bereits abgebuchter eigener Einsatz`; `S = F + A` als gesamte gespielte Summe. Vorher nur `A` vom eigenen Konto abbuchen. `F` nicht zusätzlich als Bargeld vorab gutschreiben, sonst würde es doppelt gezählt.

| Ergebnis | Nach der Hand aufs Konto zurückbuchen |
|---|---:|
| Verloren / Bust | 0 |
| Gleichstand | S |
| Normaler Sieg | 2 × S |
| Natürlicher Blackjack-Sieg | 2.5 × S |

Beispiele: 10 Mio. eigenes Geld ohne Gratisbetrag → zuerst −10 Mio., bei normalem Sieg 20 Mio. zurück, bei Blackjack 25 Mio., bei Gleichstand 10 Mio., bei Niederlage 0. Nur 10 Mio. Gratis-Einsatz → vorher keine Abbuchung, bei Sieg +20 Mio., bei Blackjack +25 Mio., bei Gleichstand +10 Mio., bei Niederlage 0 CHF Kontoveränderung. Mit Gratisbetrag plus 5 Mio. eigenem Zusatz → zuerst −5 Mio., gespielte Summe 15 Mio.; bei normalem Sieg 30 Mio. zurück, insgesamt +25 Mio. netto. Diese Regeln vor dem Einsatz kurz erklären. Den temporären Gratisbetrag nach der Hand in jedem Fall entfernen. Danach Ergebnisse pro Hand zeigen und alle Buchungen exakt einmal durchführen. Nach Prüfung der Siegbedingung denselben Brettspielzug fortsetzen, falls die Partie nicht beendet ist, inklusive eines eventuell noch offenen Pasch-Zusatzwurfs.

## 9. Gefängnis

- Nur ein Besuch auf Feld 10 löst keine Haft aus. Haft entsteht durch Feld 30, passende Karte oder drei Pasche im selben Zug.
- Freikaufen kostet **50 Mio. CHF**; bewusst spürbar bei 500 Mio. Startgeld. Alternativen: eine Gefängnis-frei-Karte oder maximal drei eigene Haftzüge abwarten.
- Zu Beginn jedes Haftzugs kann man zahlen, eine Karte einsetzen oder einmal auf Pasch würfeln. Nur die ersten zwei Würfel entscheiden über Pasch, auch bei drei aktiven Würfeln.
- Pasch: sofort frei, mit der gesamten gewürfelten Summe vorwärts, Zielfeld auflösen, kein zusätzlicher Pasch-Wurf.
- Kein Pasch: dieser eigene Zug wird ausgesetzt, keine Bewegung. Nach drei erfolglosen/abgewarteten Haftzügen ist man frei und startet im vierten eigenen Zug regulär, ohne zusätzliche Pflichtgebühr.
- Zahlen oder Karte vor dem Haftwurf erlaubt danach einen normalen Zug; nach einem bereits fehlgeschlagenen Haftwurf darf man nicht noch im gleichen Zug Geld zahlen und sich bewegen.
- Während der Haft bleiben Mieteinnahmen, berechtigte Trades und angebotene Casino-Teilnahme möglich. Restliche Haftzüge immer sichtbar anzeigen.

## 10. Handel

Handeln über Kontakte im Spielhandy und über Firmenkarten ermöglichen.

- Angebote dürfen Geld auf beiden Seiten, mehrere vollständige Unternehmen/Sonderfelder und handelbare Besitzkarten enthalten. Keine Bruchteile, Versprechen, zukünftigen Zahlungen oder noch nicht besessenen Gegenstände.
- Bewusste Grenze: Ein Spieler darf pro Empfänger und **globaler Spielrunde höchstens zwei Angebote insgesamt senden**. Nach einer Ablehnung bleibt höchstens der zweite Versuch. Gegenangebote zählen für den jeweils sendenden Spieler. Widerrufen und erneut senden umgeht die Grenze nicht.
- Maximal ein offenes Angebot je Richtung zwischen zwei Spielern; bei neuer Version das alte ersetzen, ohne den Sendezähler zu umgehen. Status `Offen`, `Angenommen`, `Abgelehnt`, `Zurückgezogen`, `Abgelaufen`.
- Angebote bis Ende der aktuellen Spielrunde gültig. Klar zeigen: `Noch 1 Angebot an Lara in dieser Runde`.
- Beim Angebot aktuellen Marktwert, Darlehen, Ausbau, Angebotszeitpunkt und gegebenenfalls fehlenden Branchenbaustein anzeigen. Keine Garantie, dass sich Marktwerte bis zur Annahme nicht ändern.
- Annahme nur an einem sicheren Verwaltungspunkt: keine offene Miete, Auktion, Casino-Hand, Kartenreaktion oder Schuldenklärung. Ausserhalb davon darf man Entwürfe vorbereiten und Nachrichten senden; für die Annahme zeigt die UI den nächsten möglichen Zeitpunkt.
- Bei Annahme Eigentum, tatsächlich verfügbare Geldbeträge, Kartenbesitz und Bedingungen erneut atomar prüfen. Beide Seiten vollständig übertragen oder gar nichts. Keine zwei Trades können dieselbe Firma oder Karte doppelt ausgeben.
- Firmen einer ausgebauten Branche erst handeln, wenn die gesamte Branche zurückgebaut wurde. Belehnte Firmen sind handelbar; die festgeschriebene Schuld geht sichtbar mit. Keine zusätzliche automatische Gebühr bei Trade, um negative Überraschungen zu vermeiden.
- Angebotene Assets nicht automatisch unbegrenzt sperren: sie können anderweitig verwendet werden, wodurch das Angebot ungültig werden muss. Geldreservierungen aus Auktion/Casino bei Verfügbarkeit abziehen.
- Vor endgültiger Annahme die beiden Seiten übersichtlich nebeneinander zeigen. Bei Änderungen am Inhalt ist eine neue Zustimmung nötig.

## 11. Bots und Chat

Bots verwenden die normale Command-Schnittstelle und exakt dieselben Regeln. Online laufen sie auf dem Server, lokal im lokalen Spielkern. Keine externen KI-API-Aufrufe und keine laufenden Kosten.

- Einfach: konservativ, hält viel Bargeld, erkennt grob sinnvolle Käufe, macht gelegentlich suboptimale Entscheidungen.
- Mittel: beachtet Branchen, Ausbau, verfügbare Liquidität, Mieten und faire Trades.
- Schwer: bewertet Branchenvollständigkeit, aktuelle Unternehmenswerte, Risiko, erwartete Belastungen und die eigene Reserve. Kann sinnvoll Gegenangebote machen.
- Keine Schwierigkeit darf Würfel manipulieren oder versteckte Kontostände, fremde private Angebote, Kartenfolgen und die verdeckte Dealerkarte lesen. Übergib Bots eine erlaubte Spieleransicht; die strategische Bewertung darf keinen direkten Vollzugriff auf den Serverzustand verwenden.
- Blackjack anhand sichtbarer Hand und Dealerkarte regelbasiert spielen. Bei eigenem Einsatz höchstens 10 Mio. und konservative Reserve beachten; Gratis-Einsatz nutzen. Plausible kurze Bedenkzeit per geplanter Aktion statt blockierender Warte-Schleife.
- Öffentlicher Lobby-/Spielchat, getrennt von Systemmeldungen. Kurze Nachrichten, maximal 300 Zeichen, Rate-Limit, Zeit und Absender. Text als Text rendern, kein HTML oder ausführbares Markdown.
- Chat einklappbar; ungelesene Nachrichten anzeigen. Menschen können andere lokal stummschalten. Bots schicken höchstens gelegentlich kurze passende Spielkommentare, keine Spam-Nachrichten.

## 12. Design: ein hochwertiges Spiel mit echter 3D-Inszenierung

Die visuelle Qualität ist ein Kernziel. Gestalte eine moderne Schweizer Wirtschaftsspielwelt, keine generische Dashboard-Vorlage. Eine einfache, lesbare Bedienung ist wichtiger als maximal viele Effekte gleichzeitig.

### Art Direction

- Stil: hochwertiger physischer Spieletisch in einem modernen Schweizer Finanzclub. Mattes Dunkelblau/Anthrazit, warmes gebrochenes Weiss auf Brettfeldern, Smaragdgrün, dezentes Schweizer Rot und sparsame Messingdetails. Klare selbst gehostete Open-Source-Typografie, präzise Zahlen, viel visuelle Ruhe.
- Eigenständige Formensprache mit Materialtiefe, angenehmen Schatten und konsistenten Proportionen. Keine allgegenwärtigen violetten Verläufe, Neon-Glows, Glas-Kacheln oder Emoji als Hauptillustration. Farbgruppen zusätzlich mit Symbol/Text markieren.
- Selbst erstellte 3D-Figuren, etwa Berg, Zug, Uhr, Koffer und abstrahierter Steinbock. Namen und Farben unterscheidbar. Firmennamen und eigene einfache Wortmarken genügen; das Spiel darf nicht von extern geladenen Logos oder Bildern abhängen.

### Brett und Kamera

- Das Brett nimmt den grössten sichtbaren Bereich ein. Echte 3D-Geometrie für Brett, Figuren, Würfel und Ausbau. Leichte isometrische Perspektive mit weicher Beleuchtung, brauchbaren Schatten und zurückhaltenden Reflexionen.
- Kamera kontrolliert drehen/zoomen; schnell auf `Übersicht`, `Aktiver Spieler` und `Draufsicht` zurückkehren. Keine erzwungenen Kamerafahrten bei jedem kleinen Ereignis.
- Spielfiguren bewegen sich nachvollziehbar Feld für Feld und bleiben bei mehreren Spielern auf einem Feld unterscheidbar. Aktives Feld und aktiver Spieler klar markieren.
- Namen, Preise und Aktionen müssen lesbar bleiben: ausgewählte Felder als HTML-Detailansicht ergänzen. Keine winzigen in die Perspektive gepressten Pflichttexte.
- Oberhalb des Bretts nur Zugstatus, kurze Handlungsaufforderung und aktuelle Phase. Kontextbezogene Hauptaktion, beispielsweise `Würfeln`, `Kaufen`, `Karte ziehen`, `Zug beenden`. Immer erklären, wenn eine Aktion gerade gesperrt ist.

### Spielhandy unten rechts

- Ein überzeugend gestaltetes Smartphone als ausklappbares HUD unten rechts, mit leichter 3D-Tiefe. Es ist das persönliche Cockpit, keine zusätzliche komplizierte Spielmechanik.
- Minimiert zeigt es immer den eigenen Kontostand, wichtige Benachrichtigungen und einen klaren Öffnen-Button.
- Apps/Tabs: `Bank`, `Kontakte`, `Portfolio`, `Trades`, `Chat`, optional `Markt`.
- Bank: eigener Kontostand, gebundene Einsätze, Verlauf und verständliche Buchungsgründe.
- Kontakte: andere Spieler mit Avatar, Status, gegebenenfalls sichtbarem Bargeld und Button `Handel anbieten`.
- Portfolio: eigene Firmen, Branchenfortschritt, Ausbau, Darlehen und Marktverlauf.
- Handelsanfragen erscheinen wie eine dezente Nachricht; beim Öffnen übersichtliche Gegenüberstellung.
- Bei `Kontostände verborgen` zeigt nur der Besitzer den eigenen Betrag. Andere Kontakte zeigen `Verborgen`. Auch Rankings, Tooltips, Logs, Charts, Fehlermeldungen und Bot-Erklärungen dürfen fremdes Bargeld/Nettovermögen nicht verraten. Öffentliche Transaktionen können naturgemäss Rückschlüsse erlauben; keine vollständige Geheimhaltung versprechen.
- Smartphone-Optik kann 3D sein; interaktive Inhalte als gut bedienbares HTML mit richtigen Fokuszuständen umsetzen.

### Animationen

- Würfeln: echte rotierende 3D-Würfel, kurzer physisch plausibler Aufprall, kontrolliertes Auslaufen auf den serverseitig bestimmten Zahlen. Kein flackernder Zufallszahlwechsel als Ersatz. Etwa 1–1.5 Sekunden.
- Geld erhalten: grüne Zahl `+12 Mio.`, wenige stilisierte 3D-Banknoten fliegen zum Konto, Kontostand zählt auf. Geld verlieren: rote Zahl, Banknoten bewegen sich vom Handy weg. Buchungsgrund direkt dabei. Mehrere Zahlungen bündeln und getrennt nachvollziehbar halten.
- Firmenkauf: Karte hebt sich leicht, Besitzmarkierung setzt sich auf das Feld, kurze dezente Bestätigung.
- Ausbau: Geldstapel/Gebäude wächst sauber in die jeweilige Stufe.
- Ereignis: Karte dreht sich auf, Branchenfarben reagieren, Vorher-/Nachher-Werte zählen nachvollziehbar um.
- Blackjack: zeitlich begrenzter Wechsel an einen echten 3D-Casinotisch mit Filz, Karten aus einem Schuh, Kartenstärke, Rückseite, Flip, Chips und Dealerposition. HTML-Hit/Stand-Buttons bleiben gut lesbar. Nach einer Hand klare Ergebnisansicht und Rückkehr aufs Brett.
- Wenige gut inszenierte Effekte statt dauerndem Konfetti. Sounds separat regelbar und standardmässig zurückhaltend; Browser-Audio erst nach Nutzerinteraktion starten.
- `prefers-reduced-motion`, Effekte aus, Ton aus und mehrere Qualitätsstufen unterstützen. Mobile Version reduziert Schatten/Partikel, behält aber den Spielcharakter. Bei fehlendem WebGL einen voll spielbaren übersichtlichen 2D-Modus liefern.
- Möglichst ein gemeinsamer WebGL-Canvas mit wechselnden Szenen; grosse Szenen/Assets lazy laden. Geometrien und Materialien wiederverwenden, Partikel instanzieren, Auflösung begrenzen, Animationen bei verstecktem Tab stoppen.

### Responsive Bedienung

Desktop zuerst hochwertig gestalten, danach Tablet und Smartphone vollständig spielbar machen. Auf kleinen Screens HUD als Bottom-Sheet, grosses Brett mit kontrolliertem Zoom, zentrale Aktionen in Daumenreichweite. Keine Hover-Pflicht, keine überlappenden Modals, keine im Handy abgeschnittenen Schaltflächen. Tastaturbedienung, Fokus, Kontrast und sinnvolle Screenreader-Beschriftungen umsetzen.

## 13. Sicherheit, Unterbrechungen und Betrieb

- Sichere zufällige Gastsitzungen, vorzugsweise HttpOnly/Secure/SameSite-Cookies bei gemeinsamer Origin. WebSocket-Origin prüfen. Keine dauerhaften Identitätstoken in Einladungslinks oder öffentlich sichtbaren Query-Strings.
- Raumcode dient dem Beitritt, persönliche Sitzung dem Besitz eines Platzes. Ein anderer Gast darf sich nicht durch gleichen Namen als bestehender Spieler anmelden. Sitzungsgeheimnisse nie an andere Spieler übertragen.
- Eingaben serverseitig validieren; Beträge ganzzahlig, endlich, im erlaubten Bereich; Eigentum und Phase immer erneut prüfen. Rate-Limits für Erstellung, Codeversuche, Chat und Commands.
- Fehlversuche beim Code geben keine privaten Raumdaten preis. Nach Start nur bestehende Mitglieder mit ihrer Sitzung wieder zulassen.
- Bei Verbindungsausfall kurze Statusanzeige und Wiederverbindung mit Backoff. Nach 90 Sekunden übernimmt je Einstellung ein Bot bis zur Rückkehr. Übergabe an Menschen am nächsten sicheren Entscheidungspunkt; eine laufende Aktion nicht zweimal ausführen.
- Ohne Bot-Übernahme wählen Timeouts sichere Aktionen: Kauf ablehnen, nicht bieten, optionalen Trade nicht annehmen, beim Blackjack bleiben, offene Schulden regelkonform abwickeln. Fällige Pflichtaktionen wie Würfeln nach Timeout serverseitig ausführen.
- Ist kein Mensch mehr verbunden, Partie nach der Rückkehrfrist pausieren und verbleibende Entscheidungszeiten sichern. Bei Rückkehr Fristen entsprechend fortsetzen, statt im Hintergrund endlos weiterzuspielen. Lokales absichtliches Bot-Testspiel ist davon ausgenommen.
- Leere Lobbys nach 24 Stunden, vollständig verlassene pausierte Partien nach 72 Stunden, abgeschlossene Partien nach sieben Tagen bereinigen. Persistierte Zustände, Sitzungen und Eventverlauf begrenzen. Alte Raumcodes dürfen keine alte Sitzung in eine neu erstellte Partie führen; interne unverwechselbare Spiel-ID verwenden.
- Host kann eine Pause anfragen; im Standardmodus müssen alle verbundenen Menschen zustimmen, im Wettbewerbsmodus genügt Mehrheit. Keine dauerhafte Pause durch einen abwesenden Host.
- Regelheft in der App: vor dem Start verständliche Kurzfassung und während des Spiels kontextbezogene Erklärung. Bei Zahlungen immer den Rechenweg anzeigen.

## 14. Umsetzung in Etappen und Abnahme

Arbeite in folgenden zusammenhängenden Etappen. Nach jeder Etappe muss der implementierte Teil startbar sein. Halte den Fortschritt in einer knappen Projektdatei fest, sodass du nach einer Unterbrechung fortsetzen kannst. Verwandle das Projekt nicht nach der ersten Etappe in eine Liste späterer Aufgaben.

1. **Grundlage und Design:** vorhandenes Projekt prüfen, Architektur/Regeldaten und Designsystem anlegen; Startseite, Lobby und ein überzeugendes navigierbares 3D-Brett mit Handy-HUD implementieren. Den visuellen Qualitätsmassstab früh festlegen.
2. **Vollständig lokaler Spielkern:** Würfel/Züge, Eigentum, Mietzahlung, Ausbau, Märkte, Karten, Gefängnis, Auktionen, Konkurs, Spielende und Bots mit realer UI verbinden.
3. **Online-Spiel:** Durable Objects, Gastsitzung, sechsstellige Lobbys, per Spieler gefilterter Zustand, Persistenz, Reconnect, Chat und Zeitlimits umsetzen. Zwei unabhängige Browserkontexte müssen dieselbe echte Partie spielen können.
4. **Handel und Casino:** atomare Trades mit Limits, Sonderkarten und vollständige einmalige Blackjack-Runde inklusive Gratis-Einsatz-Abrechnung, Dealerlogik und Timeout-Verhalten anschliessen.
5. **Polish und Betrieb:** 3D-Animationen, Geldfluss-HUD, Sound, mobile Ansichten, reduzierter Bewegungsmodus, Fehlerfälle und dokumentiertes Free-Tier-Deployment fertigstellen.

### Gezielte Prüfungen

Verwende Unit-/Integrationstests für die fehleranfällige Spiellogik und wenige aussagekräftige Browser-Tests. Keine nutzlosen Tests, die nur dieselben Konstanten abschreiben.

- Zwei und drei Würfel, Pasch nur auf den ersten beiden, drei Pasche, START-Bonus und Kartenbewegungen.
- Kursgrenzen, dynamische Miete, feste Darlehensschuld, korrektes Geldrunden und keine Gewinne durch Ausbau-Rückerstattung nach Kursanstieg.
- Schulden, Konkurs, Reservierungen, vollständige Eigentumsübertragung und alle drei Siegmodi: letzter Überlebender, sofortiges Ende nach erstem Konkurs mit Wertung der verbleibenden Spieler, Nettovermögensziel inklusive gültiger Lobby-Ziele und gleichzeitiger Zielüberschreitung nach Markt-Ereignis. Keine Siegprüfung mitten in einer atomaren Mehrfachbuchung.
- Acht vollständige Branchen, internationale Firmen ausschliesslich auf der letzten Brettseite, getrennte ICT-Branchen und deren gezielte Kartenwirkung.
- Blackjack-Asse, Dealer Soft 17, natürlicher Blackjack gegen spätere 21, Dealer-Blackjack, Bust, Gleichstand und die vier Abrechnungsfälle jeweils mit/ohne Gratisbetrag und eigenem Zusatz; eigener Einsatz 10 Mio. ergibt bei Sieg 20 Mio. und bei Blackjack 25 Mio. Rückbuchung. Gratisbetrag nicht vorab als Bargeld doppelt gutschreiben.
- Andere Casino-Teilnehmer können nie mehr als 10 Mio. setzen; keine zweite Hand; ein wiederholtes Settlement zahlt nichts doppelt.
- Trade-Zähler je gerichtetem Spielerpaar und globaler Runde; gleichzeitige Annahmen derselben Assets und veraltete Angebote werden sicher verhindert.
- Verborgene Daten sind im tatsächlichen Netzwerkpayload nicht vorhanden; blosses CSS-Verstecken erfüllt das nicht. Bots bekommen ebenfalls nur ihre erlaubte Ansicht.
- Raumcode mit führender Null, keine Übernahme fremder Plätze, Reconnect/Server-Neustart/Hibernation ohne Doppelbuchung, zuverlässiger Wiederanlauf persistierter Fristen.
- Mindestens ein Browser-Test: zwei Menschen plus Bot treten bei, kaufen Firmen, handeln, erhalten eine Marktänderung und verbinden sich neu. Casino gezielt über einen lokalen Testzustand prüfen; keine geheimen Cheat-Endpunkte im Produktionsbuild.
- Typecheck, sinnvoller Lint, Tests und Produktionsbuild müssen für die tatsächlich implementierte Version laufen. Abschliessend Desktop und Mobile visuell prüfen.

### Lieferung

Liefere lauffähigen Code, Brett-/Karten-Daten, Konfiguration inklusive SQLite-Durable-Object-Migration, lokale Startbefehle, Tests und eine kurze README. Dokumentiere `install`, `dev`, `test`, `build` und den Cloudflare-Deploy-Vorgang, erforderliche manuelle Anmeldung und aktuelle Free-Tier-Grenzen. Der lokale Modus muss ohne Cloud-Zugang nutzbar sein.

Keine API-Schlüssel oder Zugangsdaten erfinden. Wo Anmeldung nötig ist, erst die technische Umsetzung und überprüfbare Konfiguration fertigstellen und dann konkret den einen notwendigen manuellen Schritt nennen. Nicht eigenmächtig kostenpflichtige Ressourcen aktivieren.

Wenn ein Arbeitsschritt die verfügbare Ausführungszeit übersteigt, sichere den lauffähigen Zwischenstand mit genauer nächster Aufgabe und setze danach dort fort. Behaupte keine vollständige Fertigstellung oder bestandenen Tests, wenn etwas fehlt. Keine als Multiplayer ausgegebene lokale Simulation, keine Dummy-Trades und kein Casino, das lediglich animierte Zufallsgewinne verteilt.

**Beginne jetzt mit der Projektprüfung und der Implementierung. Gib zuerst einen kurzen konkreten Arbeitsplan und arbeite dann direkt am Code.**

## Technische Referenzen

Die folgende Auswahl wurde am 19.11.2026 geprüft; vor dem Deployment erneut die aktuellen Angaben lesen:

- [Cloudflare Durable Objects: Preise und Free-Tier](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Workers: Preise und Limits](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers Static Assets: kostenlose statische Auslieferung und Grenzen](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Durable Objects: WebSockets und Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Grand Casino Baden: regulärer Gewinn 1:1 und natürlicher Blackjack 3:2](https://clubjoy.grandcasinobaden.ch/spiele/blackjack)
