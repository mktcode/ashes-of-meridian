# Architektur

Diese Referenz hält technische Entscheidungen und Änderungsrisiken fest. Dateiaufteilung, Methoden und aktuelle Werte direkt in Quellen und Tests erkunden.

## Auslieferung

`index.html`, `styles/` und `src/` sind Quellen; Ausnahme ist die [generierte Textur-Einbettung](rendering.md#texturen-und-portraits). `npm run build` leert `dist/` und kompiliert nach `dist/src/`. Die noch nicht migrierten JavaScript-Quellen werden ausgegeben, aber nicht mit `checkJs` geprüft: ein erfolgreicher Build ist für sie kein Typnachweis.

Die Anwendung muss nach dem Build direkt über `file://` funktionieren. Deshalb klassische, synchron in HTML-Reihenfolge geladene Skripte mit gemeinsamen globalen lexikalischen Bindungen, keine Laufzeit-Imports, CDN-Abhängigkeiten, `async` oder `defer`. Globale `const`-/`class`-Bindungen sind nicht automatisch `window`-Eigenschaften; `window.Meridian` bietet gezielte Runtime-Inspektion.

Neue Skripte explizit in `index.html` und in den betroffenen Skriptgruppen des VM-Harnesses (`tests/helpers/game-scripts.cjs`) ergänzen. Die Methodenfragmente von Simulation und UI erweitern ihre Klassen weiterhin über nicht aufzählbare Prototypmethoden; die Ladereihenfolge ist Teil des Vertrags. Auch bei Styles zählt die gesamte Kaskade, einschließlich verteilter responsiver Regeln.

Das [Webdeployment](deployment.md) liefert denselben Stand statisch aus, ohne Backend oder serverseitige Persistenz.

## Zustands- und Verantwortungsgrenzen

- `MeridianGame` besitzt CPU-Welt und Effekte, keinen Renderer. Simulation und Effektticks laufen in festen Zeitschritten, UI/Rendering pro Frame. Die Spielschleife skaliert die Simulationszeit, nicht die Audio-Uhr.
- `game.s` und `game.world` sind außerhalb eines Gefechts `null`. Der Run ist ausschließlich flüchtig; Start erzeugt eine neue Welt samt Suchindizes, RNG und Sicht. Es gibt kein Snapshot-/Restore-API.
- Die UI orchestriert Auswahl, Dialoge und Profilfortschritt. Sie verarbeitet Ergebnis-Auszahlung und Fraktionsfreischaltung einmal pro Run; erneutes Anzeigen des Ergebnisses darf weder erneut auszahlen noch erneut den Ergebnis-Sound auslösen. Upgrade-Stufen werden beim Start in den Run kopiert; Käufe wirken erst beim nächsten Start.
- Persistenz erhält Storage-Zugriff und Upgrade-Grenzen injiziert, ohne UI-/Spielabhängigkeit. Nur das permanente Profil wird normalisiert und gespeichert. Zugriffsausfälle führen zu flüchtigem Ersatz, nicht zu zugesicherter Speicherung; erfolgreiche spätere Lesezugriffe bevorzugen den Browserwert. Keine Run-Speicherung oder Migration ohne Auftrag.
- Menüzustand, Befehlsmodus und Tempo sind keine Profileinstellungen. Tab-Verbergen pausiert, Rückkehr setzt nicht automatisch fort. Browser-/Grafikverlust kann den Run verwerfen.

## Technische IDs und Anzeigenamen

Fraktionsnummern und Entitätstypen sind stabile technische Kennungen; Spielernamen sind veränderlicher Content. `FACTION_ID` definiert die nullbasierten Fraktionen. Modelle und Portraits verwenden Fraktionsnummer plus Art/Typ, etwa `faction-0/building/barracks`, nicht den Anzeigenamen. Reihenfolge und numerischer Freischaltungsstand sind kein bloßes Benennungsdetail.

Teams sind davon unabhängig: 0 ist lokaler Spieler, 1 Gegner, −1 neutral. Karten verwenden sprechende IDs aus dem Kartenkatalog; keine Logik anhand von Anzeigenamen, Fraktionsnamen oder numerischen Karten-Aliassen.

## Teamzustand, Sicht und KI

Die KI ist ein weiterer Akteur derselben Simulation, keine zweite Wirtschafts-/Kampflogik. Aktionen erhalten das ausführende Team und prüfen Konten, Eigentum, Kosten, Voraussetzungen und Ziele gemeinsam. UI und Ergebnisstatistik bleiben auf Team 0 ausgerichtet; autonome Befehle erzeugen keine lokalen Eingabemarker oder Befehlstöne.

Beide Teams haben eigene Sicht/Erkundung. Die KI speichert nur kopierte beobachtete Kontakte, keine Referenzen auf verborgene Live-Entitäten. Auch Zielerfassung, direkte Angriffe und Effektmarker müssen Sichtgrenzen beachten. Die KI erhält keine freien Ressourcen/Armeen; strategische Abfragen verbrauchen keinen RNG, reguläre Aktionen und Effekte dagegen gegebenenfalls schon.

Die KI prüft ihre Baukandidaten zusätzlich auf sichtbare, freie Flächen und reservierte Ausgänge. Das behebt nicht den [allgemeinen Bauplatzfehler](issues/bug-building-placement-in-einheiten.md). Einheitenkörper und Ausfahrtsreservierungen direkt prüfen: der Kampf-Hash kann innerhalb eines Schritts veraltet sein.

Diese Akteursgrenzen ermöglichen weitere Controller, sind aber kein Netzwerk-, Replay- oder Lockstep-Nachweis. Multiplayertechnik ist nicht vorweg entschieden.

## Welt, Darstellung und Zufall

Kartenrezepte besitzen Größe, Layout, Renderprofil und explizite Bauphasen. Gemeinsame CPU-Helfer und der GPU-Adapter sollen keine Karten-Sonderzweige benötigen. Navigation, Sicht, Bau-/Bewegungsgrenzen und Minimap lesen Instanzmaße; eine größere Karte skaliert nicht automatisch Positionen, Körper, Reichweiten oder Dekoranzahl.

Die CPU-Welt beschreibt Terrain über `renderData`; `BattlefieldView` übernimmt es ohne Mutation und löst deklarierte Geometrien auf. Die Objektidentität von `renderData` ist die Layout-Revision, `fogVersion` die Sicht-Revision. Fog-/Minimap-Puffer müssen bei Größenwechsel wachsen und schrumpfen, ohne Daten der vorherigen Welt zu übernehmen. Sichtbare Blocker und CPU-Umrisse müssen zusammenpassen; Basis-/Ressourcenzugänge bleiben erreichbar.

**RNG ist eine Verhaltensgrenze:** Bestehende Terrainphasen auf Desert/Mothership verschachteln Hindernis- und Dekorzufall. Zusätzliche kosmetische Samples können damit Spielwege ändern. Neue Dekoration nutzt `builder.cosmeticRandom(salt)` mit eigener stabiler Kennung; bestehende Ströme nicht nebenbei umstellen. Reservierte Startsamples erhalten nach entfernten Systemen weiterhin die RNG-Position und dürfen nicht als toter Code entfallen.

Auch Erzeugung und Tick kosmetischer Effekte nutzen teilweise den Simulations-RNG; unsichtbare Effekte deshalb nicht einfach überspringen. Reines Zeichnen verbraucht keinen RNG. Geometrieverfeinerung, Kollisionsänderung und Layoutänderung getrennt behandeln und gegen [feste Referenzen](reference-tests.md) prüfen.

Viewport-/Modellverträge und Assetpflege: [Grafik](rendering.md). Fachregeln: [Gameplay](gameplay.md). Prüfwahl: [Tests](testing.md).
