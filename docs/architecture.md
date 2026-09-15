# Architektur

Diese Referenz hält technische Entscheidungen und Änderungsrisiken fest. Dateiaufteilung, Methoden und aktuelle Werte direkt in Quellen und Tests erkunden.

## Auslieferung

`index.html`, `styles/` und `src/` sind Quellen; Ausnahme ist die [generierte Textur-Einbettung](rendering.md#texturen-und-portraits). `npm run build` leert `dist/` und kompiliert nach `dist/src/`. Handgeschriebener Laufzeitcode ist TypeScript und wird einschließlich der Deklarationsverträge strikt geprüft. `allowJs` bleibt ausschließlich für die generierte Textur-Einbettung nötig; `checkJs` ist ebenfalls aktiv.

Die Anwendung muss nach dem Build direkt über `file://` funktionieren. Deshalb klassische, synchron in HTML-Reihenfolge geladene Skripte mit gemeinsamen globalen lexikalischen Bindungen, keine Laufzeit-Imports, CDN-Abhängigkeiten, `async` oder `defer`. Globale `const`-/`class`-Bindungen sind nicht automatisch `window`-Eigenschaften; `window.Meridian` bietet gezielte Runtime-Inspektion.

Neue Skripte explizit in `index.html` und in den betroffenen Skriptgruppen des VM-Harnesses (`tests/helpers/game-scripts.cjs`) ergänzen. Die Methodenfragmente von Simulation und UI erweitern ihre Klassen weiterhin über nicht aufzählbare Prototypmethoden; Declaration Merging bildet denselben Vertrag im Typsystem ab. Die Ladereihenfolge ist Teil des Vertrags. Auch bei Styles zählt die gesamte Kaskade, einschließlich verteilter responsiver Regeln.

Das [Webdeployment](deployment.md) liefert denselben Stand statisch aus, ohne Backend oder serverseitige Persistenz.

## Zustands- und Verantwortungsgrenzen

- `MeridianGame` besitzt CPU-Welt und Effekte, keinen Renderer. Simulation und Effektticks laufen in festen Zeitschritten, UI/Rendering pro Frame. Die Spielschleife skaliert die Simulationszeit, nicht die Audio-Uhr.
- `game.s` und `game.world` können `null` sein; nach der Rückkehr ins Menü kann die vorherige Welt noch referenziert sein, ohne ein aktives Gefecht darzustellen. Jeder Gefechtsstart erzeugt eine neue Welt samt Suchindizes, RNG und Sicht; es gibt kein Snapshot-/Restore-API. Der Expeditionscheckpoint enthält ausschließlich Fraktion, Tiefe, Vorteilsstapel beider Seiten, Spielerangebote und das nächste Gefechtsrezept, niemals Entitäten oder laufenden Simulationszustand.
- Die UI orchestriert Expedition, Auswahl, Dialoge und Profilfortschritt. Sie verarbeitet Auszahlung, Tiefenfortschritt und Fraktionsfreischaltung einmal pro Gefecht; erneutes Anzeigen des Ergebnisses darf weder erneut fortschreiben noch erneut den Ergebnis-Sound auslösen. Upgrade-Stufen und die getrennten Expeditionsvorteile beider Seiten werden beim Start in das Gefecht kopiert; spätere Änderungen wirken erst beim nächsten Start.
- Reine Bildschirm-Templates erzeugen nur Markup aus übergebenem Zustand; DOM, Speicherung und Zufall bleiben beim Controller. Simulationsereignisse haben einen gemeinsamen diskriminierten Typvertrag für Ereignisname und Nutzlast.
- Persistenz erhält Storage-Zugriff sowie Upgrade-, Vorteils- und Kartenregeln injiziert, ohne UI-/Spielabhängigkeit. Permanentes Profil und Expeditionscheckpoint besitzen getrennte Schlüssel und werden unabhängig normalisiert. Zugriffsausfälle führen zu flüchtigem Ersatz, nicht zu zugesicherter Speicherung; erfolgreiche spätere Lesezugriffe bevorzugen den Browserwert. Das permanente Profil bleibt bei Version 1; der Expeditionscheckpoint nutzt Version 2 mit eigenem Storage-Schlüssel. Alte Expeditionen werden nicht geladen oder migriert. Es gibt keine Profilmigration und keine Speicherung laufender Gefechte.
- Menüzustand, Befehlsmodus und Tempo sind keine Profileinstellungen. Tab-Verbergen pausiert, Rückkehr setzt nicht automatisch fort. Reload sowie Browser-/Grafikverlust verwerfen das aktuelle Gefecht und kehren höchstens zum davor gesicherten Expeditionsübergang zurück.

## Technische IDs und Anzeigenamen

Fraktionsnummern und Entitätstypen sind stabile technische Kennungen; Spielernamen sind veränderlicher Content. `FACTION_ID` definiert die nullbasierten Fraktionen. Modelle und Portraits verwenden Fraktionsnummer plus Art/Typ, etwa `faction-0/building/barracks`, nicht den Anzeigenamen. Reihenfolge und numerischer Freischaltungsstand sind kein bloßes Benennungsdetail.

Teams sind davon unabhängig: 0 ist lokaler Spieler, 1 Gegner, −1 neutral. Karten verwenden sprechende IDs aus dem Kartenkatalog; keine Logik anhand von Anzeigenamen, Fraktionsnamen oder numerischen Karten-Aliassen.

## Teamzustand, Sicht und KI

Die KI ist ein weiterer Akteur derselben Simulation, keine zweite Wirtschafts-/Kampflogik. Aktionen erhalten das ausführende Team und prüfen Konten, Eigentum, Kosten, Voraussetzungen und Ziele gemeinsam. UI und Ergebnisstatistik bleiben auf Team 0 ausgerichtet; autonome Befehle erzeugen keine lokalen Eingabemarker oder Befehlstöne.

Beide Teams haben eigene Sicht/Erkundung. Die KI speichert nur kopierte beobachtete Kontakte, keine Referenzen auf verborgene Live-Entitäten. Auch Zielerfassung, direkte Angriffe und Effektmarker müssen Sichtgrenzen beachten. Abgesehen von ihren ausdrücklich angekündigten Expeditions-Startvorteilen erhält die KI keine freien Ressourcen/Armeen; strategische Abfragen verbrauchen keinen Simulations-RNG, reguläre Aktionen und Effekte dagegen gegebenenfalls schon. Doktrin und Druckstufe werden aus der Akteursfraktion und der beim Gefechtsstart normalisierten Expeditionstiefe abgeleitet. Sie werden weder zusätzlich gewürfelt noch redundant im Checkpoint gespeichert; direkte Starts ohne Tiefe verwenden 0.

Die gegnerische Vorteilswahl findet ausschließlich beim einmaligen Fortschreiben eines Sieges statt, nachdem der nächste Gegner feststeht. Ein separater, aus Gefechtsseed und Tiefe abgeleiteter Stream erzeugt bis zu drei Angebote und die fraktionsgewichtete Wahl. Gespeichert werden nur kumulierte Stapel, weder Wahlhistorie noch ein zusätzlicher Doktrin-Modifikator. Rendern, Reload, Wiederanzeigen des Ergebnisses und die Spielerwahl würfeln nicht erneut. Reine Vorteilseffekte teilen ihre Regeln zwischen den Teams; insbesondere hat jedes Team seinen eigenen Workshop-Verbrauch, ohne permanente Spieler-Bauprotokolle auf den Gegner zu übertragen.

Fähigkeitsvoraussetzungen gelten für beide Teams. Orbital-Technologie wird bei jeder Nutzung am lebenden, fertiggestellten eigenen Gebäudebestand geprüft, die Zielsicht direkt im Sichtgitter des Akteurs. Reinforcements prüfen lebende eigene Einheiten bzw. fertige Gebäude als räumliche Anker. Alle Prüfungen erfolgen vor Energieabzug, Cooldown und Effekterzeugung.

Bauplanung hat ein gemeinsames Retry-Fenster mit höchstens einer Platzsuche je Kandidatentyp: Ein nicht platzierbarer Vorrangbau darf bezahlbare Alternativen nicht aussperren. Strategische Moduswechsel führen Angriffs- und Erholungsbeginn getrennt; Zielbestätigung startet die Angriffsuhr nicht neu. Nach einem abgebrochenen Angriff wird das gescheiterte Ziel vorübergehend niedriger priorisiert, damit dieselbe Front nicht sofort wieder gewählt wird.

Die KI prüft die vollständige Baufläche zusätzlich auf aktuelle Sicht, bevor der gemeinsame Validator Live-Einheitenkörper und reservierte Produktionsausgänge prüft; dadurch verrät eine Ablehnung keine ungesehene Einheit. Raffineriekandidaten sind die Zentren beobachteter Vents. Spieler dürfen innerhalb des Fangradius ansetzen, aber Vorschau, Validierung und Fundament verwenden dieselbe auf das erkundete Vent eingerastete Position. Dafür stets direkte Entitätspositionen verwenden: Der Kampf-Hash kann innerhalb eines Schritts veraltet sein.

Diese Akteursgrenzen ermöglichen weitere Controller, sind aber kein Netzwerk-, Replay- oder Lockstep-Nachweis. Multiplayertechnik ist nicht vorweg entschieden.

## Welt, Darstellung und Zufall

Kartenrezepte besitzen Größe, Layout, Renderprofil und explizite Bauphasen. Gemeinsame CPU-Helfer und der GPU-Adapter sollen keine Karten-Sonderzweige benötigen. Navigation, Sicht, Bau-/Bewegungsgrenzen und Minimap lesen Instanzmaße; eine größere Karte skaliert nicht automatisch Positionen, Körper, Reichweiten oder Dekoranzahl. Lokales Steering bevorzugt eine stabile Passierseite. Kampfgruppen und Worker mit Bau-/Reparaturauftrag dürfen bei einer versperrten Seite deterministisch auf die Gegenseite wechseln und halten diese Wahl bis zu geradlinigem Fortschritt oder Neuplanung; regulärer Minenverkehr behält seine strengere Jitter-Vermeidung. Yield prüft weiterhin direkte Live-Körper statt des nur einmal je Schritt erneuerten Kampf-Hashs.

Die vier öffentlichen Eckkandidaten (`layout.startSites`) sind von den Terrain-Ankern `playerStart`/`enemySites` getrennt; deren alte Namen bezeichnen keine Teamzuordnung mehr. Freie HQ-Plätze werden vor der Teamauswahl deterministisch im jeweiligen Eckbereich gesucht, mit Abstand zu Blockern/Ressourcen und nahen Anfangsmineralien. Die Auswahl zweier verschiedener Plätze nutzt einen eigenen seedbasierten RNG und wird aus dem Gefechtsseed rekonstruiert, nicht zusätzlich gespeichert. Die KI durchsucht unerkundete Kandidaten, ohne die ausgeloste Gegnerposition auszulesen.

Desert formt Relief und seedabhängige Korridore gemeinsam; Startflächen, Ressourcen und Vents werden durch ein zusammenhängendes Talnetz verbunden. Das Rezept erzeugt dafür eine instanzlokale Layoutkopie, ohne die Kartendefinition zu mutieren. Alien Planet verteilt die beiden früher weit von den zusätzlichen Ecken entfernten Ressourcenfelder an diese Startbereiche, ohne Ressourcenanzahl oder -mengen zu erhöhen.

Die CPU-Welt beschreibt Terrain über `renderData`; `BattlefieldView` übernimmt es ohne Mutation und löst deklarierte Geometrien auf. Die Objektidentität von `renderData` ist die Layout-Revision, `fogVersion` die Sicht-Revision. Reine Erkundung über `Battlefield.explore` aktualisiert Erkundung und lokale Fog-Darstellung, aber weder aktuelle Sicht noch KI-Kontakte. Fog-/Minimap-Puffer müssen bei Größenwechsel wachsen und schrumpfen, ohne Daten der vorherigen Welt zu übernehmen. Sichtbare Blocker und CPU-Umrisse müssen zusammenpassen; Basis-/Ressourcenzugänge bleiben erreichbar. Bei Reliefdeskriptoren stammen Kollisionsraster und GPU-Oberfläche aus denselben CPU-Höhensamples; der Renderer erzeugt keine zweite Landschaft aus einem nachgebauten Noise-Rezept.

**RNG ist eine Verhaltensgrenze:** Geländerelief, feste Felsen und Dekoration auf Desert besitzen getrennte seedbasierte Zufallsquellen. Kosmetische Platzierungen dürfen keine begehbaren Flächen verändern. Neue Dekoration nutzt `builder.cosmeticRandom(salt)` mit eigener stabiler Kennung; bestehende Ströme anderer Rezepte nicht nebenbei umstellen. Reservierte Startsamples erhalten nach entfernten Systemen weiterhin die RNG-Position und dürfen nicht als toter Code entfallen.

Auch Erzeugung und Tick kosmetischer Effekte nutzen teilweise den Simulations-RNG; unsichtbare Effekte deshalb nicht einfach überspringen. Reines Zeichnen verbraucht keinen RNG. Vorschauen verwenden einen schmalen visuellen Entitätsvertrag statt künstlicher Simulationsentitäten; Bauvorschauen haben eine feste kosmetische ID für deterministische Animationsphasen, ohne IDs der Simulation zu belegen. Geometrieverfeinerung, Kollisionsänderung und Layoutänderung getrennt behandeln und gegen [feste Referenzen](reference-tests.md) prüfen.

Viewport-/Modellverträge und Assetpflege: [Grafik](rendering.md). Fachregeln: [Gameplay](gameplay.md). Prüfwahl: [Tests](testing.md).
