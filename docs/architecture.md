# Architektur

Entscheidungen und Änderungsrisiken; Implementierungsdetails stehen in Quellen und Tests.

## Auslieferung

Das Spiel muss nach `npm run build` direkt über `file://` funktionieren. Deshalb klassische, synchron in HTML-Reihenfolge geladene Skripte mit gemeinsamen globalen Bindungen: keine Laufzeit-Imports, CDN-Abhängigkeiten, `async` oder `defer`. TypeScript wird strikt geprüft; generierte Asset-Einbettungen bleiben Ausnahmen. `window.Meridian` bietet gezielte Runtime-Inspektion.

Neue Skripte in `index.html` und den betroffenen Gruppen von `tests/helpers/game-scripts.cjs` eintragen. Prototypfragmente erweitern Klassen über nicht aufzählbare Methoden und Declaration Merging. **Ladereihenfolge ist Vertrag**, ebenso die gesamte CSS-Kaskade. Quellen bearbeiten, nie `dist/` oder generierte Einbettungen von Hand.

[Webhosting](deployment.md) liefert denselben statischen Stand. Der [Multiplayerserver](../server/README.md) ist ein separater optionaler Dienst.

## Zustands- und Verantwortungsgrenzen

- **Simulation:** `MeridianGame` besitzt CPU-Welt und Effekte, keinen Renderer. Feste Simulationsticks sind von rAF-basierten UI-/Audio-/Netzwerkuhren und dem 60-FPS-Renderbudget getrennt. Verpasste Rendertermine werden nicht nachgeholt. Spieltempo skaliert Simulationszeit, nicht die Audio-Uhr.
- **UI:** orchestriert Expedition, Befehle, Dialoge und Profil. Templates erzeugen nur Markup; DOM, Speicherung und Zufall bleiben beim Controller. Ergebnisverarbeitung und Auszahlung müssen pro Gefecht genau einmal erfolgen.
- **Persistenz:** Profil und Expeditionscheckpoint werden unabhängig normalisiert; Regeln und Storage sind injiziert, keine UI-/Spielabhängigkeit. Der Checkpoint speichert das Startrezept samt Loadout und slotgebundenen Vorteilen, **keine Entitäten oder laufende Welt**. Alte Checkpointformate werden verworfen, nicht migriert. Storage-Ausfälle bieten nur flüchtigen Ersatz.
- **Lebenszyklus:** Gefechtsstart erzeugt Welt, Indizes, RNG und Sicht neu. `game.s`/`world` können fehlen; eine noch referenzierte Menüwelt ist kein aktives Gefecht. Reload, Menü oder Grafikverlust verwerfen das Gefecht; Tab-Rückkehr setzt eine Pause nicht automatisch fort. Kein Snapshot-/Restore-API.
- **Landschaftsarchiv:** separater visueller Datensatz aus Stage, Karte und Seed. Er muss eine lückenlose Folge bis zum exakt aktuellen Checkpoint bilden; sonst startet nur das Archiv dort neu. Schreibvorgänge sind nicht transaktional: höchstens Historie verlieren, niemals einen fremden Run zuordnen. Vorschauauswahl beeinflusst keinen Gefechtsstart und rekonstruiert keine unbekannten Seeds.

## Technische IDs und Anzeigenamen

Fraktion, Partei, Entitätstyp und Karte sind unabhängige technische Identitäten; Anzeigenamen sind Content. Gegner-Slots behalten ihre Identität und Vorteile über Fraktionswechsel hinweg. Modelle/Assets verwenden technische IDs, keine Namen oder numerischen Karten-Aliasse.

## Einzelspieler-Missionen

Missions-ID und Karte sind getrennte Teile des Encounter-Rezepts. Der Katalog legt erlaubte Paare fest; ungültige Kombinationen werden vor Weltaufbau/RNG abgewiesen. Encounter-Auswahl erhält die Reihenfolge Gegnerfraktionen → Karte/Mission → Seed, ohne zusätzliche Zufallsziehungen.

Die Simulation entscheidet das Ergebnis, nicht UI oder Kartenrezept. Missionszustand gehört ins laufende Gefecht, räumliche Anker ins Layout. Echo-Fracht und Lieferpunkte bleiben getrennt von Wirtschaftskonten. Lieferungen und Eliminierungen werden nach dem Simulationsschritt gemeinsam bewertet, nicht während der Entitätsiteration; gleichzeitige Ergebnisse dürfen keinen Entitätsreihenfolge-Vorteil geben. [Fachregeln](gameplay.md#echo-bergung-auf-aurelion).

## Teamzustand, Sicht und KI

Parteizustand bündelt Fraktion, Controller, Konten, Loadout und kopierte Upgrades/Vorteile. Permanente Profilupgrades gelten nur für den Spieler. Die KI verwendet dieselben bezahlten Wirtschafts-/Kampfaktionen wie Menschen; sie beobachtet verzögert kopierte Kontakte statt verborgene Live-Entitäten. Doktrin und Druck werden aus Fraktion/Tiefe abgeleitet, nicht zusätzlich gewürfelt. Entwicklerregler: `src/simulation/ai-rules.ts`; keine Balancegarantie durch technische Obergrenzen.

`submitAction` bindet den Akteur getrennt von der Nutzlast und validiert bekannte Felder. Fachregeln bleiben in der Simulation; HUD ist keine Berechtigungsgrenze. Im Einzelspiel erfolgt Ausführung unmittelbar. Szenarien reihen kopierte Aktionen für den nächsten Tick ein: Annahme ist **kein Erfolg**, Ressourcen werden nicht reserviert. Vor Ausführung werden Besitz, Sicht und aktuelle Regeln erneut geprüft.

Szenarioeingaben laufen in Annahmereihenfolge vor den übrigen Tickphasen; KI handelt unmittelbar in ihrer festen Phase. Rekursive Ticks sind gesperrt. Neustart ersetzt Queue/Tickets, Stopp verwirft Eingaben. Unerwartete Ausführungsfehler stoppen das Szenario ohne automatischen Retry oder zugesicherten Rollback. Die Queue ist keine Replay-Historie oder Netzwerkauthentifizierung.

Jede Partei besitzt eigene Sicht/Erkundung. Lokale Perspektivwechsel verwerfen Auswahl, Gesten und Effekte, verändern aber keine Simulation oder Zufallsströme. Einzelspiel bleibt auf Partei 0, Netzwerk auf die zugewiesene Partei beschränkt. Interne Szenarien haben begrenzte Dauer und keine Expeditionsauszahlung; Nichtfeindschaft bedeutet weder Allianz noch geteilte Kontrolle/Sicht.

## Netzwerkprototyp

Der Node-Host lädt dieselben kompilierten CPU-Skripte in einen VM-Kontext je Raum. Er ist autoritativ; der Browser simuliert nicht, sondern hält ein flüchtiges Bedien-/Renderabbild. Räume werden seriell verarbeitet, zusätzliche vCPUs sind keine zusätzlichen Simulationsworker. Die Zwei-Raum-Grenze darf ohne Zielmaschinen-Lastnachweis nicht erhöht werden.

Übertragung nutzt eine ausdrückliche Feldfreigabe: eigenes Konto/Queues, eigene Sicht und sichtbare Fremdentitäten; keine vollständigen Zustände mit bloß clientseitigem Fog. Ressourcen im Nebel behalten den zuletzt beobachteten Stand. Gelände-Seed ist öffentlich, Startzuordnung verwendet einen privaten Seed. Effekte werden **zum Ereigniszeitpunkt je Partei** gefiltert; Ereignisbündel sind begrenzt und keine verlässliche Historie.

Clientinterpolation verändert nur Renderkopien. Sichtverlust entfernt Kontakte sofort; keine Extrapolation, Vorhersage oder Wiedergabe alter Effektstapel. Netzwerkereignisse dürfen niemals Profil-/Ergebnisfortschritt auslösen. Verbindungsidentität, Resume, Deduplizierung, Backpressure und Betriebsparameter stehen ausschließlich im [Serververtrag](../server/README.md#ablauf-und-grenzen). Prozessneustarts sind nicht wiederherstellbar.

## Weltrezepte und feste Designs

Kartendefinitionen erzeugen instanzlokale Maße/Layout vor Welt- und Ressourcenaufbau. Alle Nutzer lesen dasselbe aufgelöste Layout. Katalog und Modusfreigaben: `src/battlefields/catalog.ts`.

Landschaftsseed, Gefechtsseed und Atmosphäre sind getrennt: ein festes Design fixiert Terrain/Dekor, nicht Startzuordnung oder Kampfzufall. Tageszeit ist eine einmalige Gestaltung, kein laufender Zyklus. Reproduzierbarer Gefechtsanfang braucht Rezept, Seed, Parteien und Loadouts; Seed allein konserviert keine Landschaft über Rezeptänderungen hinweg.

Reliefentwicklung erzeugt die CPU-Oberfläche **vor** kosmetischer Ökologie. Letztere darf weder Blocker, Ressourcen noch Navigation verändern. Unspielbare Konstruktionen scheitern, statt einen Ersatzseed zu würfeln. Gemeinsame CPU-Rezeptänderungen erfordern passenden Client-/Server-Rollout.

## Welt, Darstellung und Zufall

Eine statische triangulierte `BattlefieldSurface` liefert genau eine spielbare Bodenhöhe je `x/z`. Navigation, Picking, Meshes, Fundamente und Höhenposen verwenden dieselben Samples/Diagonalen; kein nachgebautes Renderer-Noise. Unterdeckstadt, Dächer und äußerer Dekor sind keine zweite Spielebene. Instanzmaße gelten auch für Sicht-/Minimap-Puffer; Größenwechsel darf keine alten Daten behalten.

Klippen und permanente Terrainbarrieren bleiben auch bei Recovery mit temporärem Belegungsraster wirksam. Baumaske und Bewegungssperre sind unabhängig, etwa auf Brücken. Fundamente benötigen ebene berührte Dreiecke. Bodengebundene Arbeit verlangt einen klippenfreien Zugang; ein nahes X/Z-Ziel ist nicht automatisch erreichbar.

Wegsuche unterscheidet vollständigen/Teilweg, unerreichbar und verbrauchtes Suchbudget. Nur vollständige Erreichbarkeit eines Arbeitsbereichs erlaubt eine Bauzusage vor Zahlung. Servicepunkte müssen innerhalb des Arbeitsradius liegen; ein Rückweg behält ein stabiles Ziel, sonst können Umwege endlos zwischen HQ-Zentrum und Servicepunkt wechseln. Direkte Live-Körper verwenden, wenn der Kampfhash innerhalb des Ticks veraltet sein kann.

Diskrete CPU-Sichtstufen sind unabhängig von Modellhöhen: Bodensicht reicht nur auf gleiche/niedrigere Stufen, Flugzeuge/Scans umgehen diese Grenze. Kein allgemeiner Gelände-Raytest. Lokale Flugfreiraumhüllen schützen den gesamten Fußabdruck vor CPU-Terrain, **nicht** vor beliebig hohem Dekor. Kampfentfernungen und Fernheilung bleiben planar; Hanglage/Flugpose sind abgeleitet, kein zusätzlicher autoritativer Zustand.

Öffentliche Startkandidaten entstehen unabhängig von privater Parteienzuordnung. Startsuche und Zuteilung haben eigene deterministische Regeln; zusätzliche Parteien dürfen Terrain-/Ressourcen-RNG nicht verschieben. Sichtbare Hindernisse und CPU-Umrisse müssen übereinstimmen.

**RNG ist Verhaltensvertrag:** Terrain, Dekor und Startzuteilung nutzen getrennte Quellen. Neue Kosmetik erhält einen eigenen stabilen Salt; reservierte Samples nicht als toten Code löschen. Einzelspieler-Effekte nutzen teilweise Simulations-RNG und dürfen bei Unsichtbarkeit nicht einfach entfallen. Szenarien besitzen einen getrennten Effektstream; reines Zeichnen verbraucht keinen RNG. [Referenzpflege](reference-tests.md).
