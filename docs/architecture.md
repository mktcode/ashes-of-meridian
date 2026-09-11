# Architektur

## Auslieferung

`index.html`, `styles.css` und die lokalen JavaScript-Dateien sind handgepflegte Quellen und werden direkt ausgeliefert. Keine generierten Dateien, npm-Abhängigkeiten, Laufzeit-Imports oder Build-/Serverpflicht. Die Skripte teilen globale lexikalische Bindungen und laufen synchron in HTML-Reihenfolge, ohne `async`, `defer` oder ES-Module. Inline-Styles in UI-Templates bestehen weiterhin.

## Codekarte

Die Reihenfolge entspricht den `data-meridian-script`-Tags in `index.html`:

| Datei | Zuständigkeit / Einstieg |
| --- | --- |
| `core.js` | Matrizen, Vektoren und Seed-RNG: `M4`, `V`, `seeded` |
| `renderer.js` | WebGL 2, Meshes, Materialien, eingebettete Texturen und Renderpässe: `MeridianRenderer` |
| `content.js` | `FACTIONS`, `UNITS`, `BUILDINGS`, `ABILITIES`, `META`, `BIOMES`, Icons und Namenshelfer |
| `world.js` | CPU-Terrain, Hindernisraster, Navigation und Sichtbarkeit: `Battlefield` |
| `world-view.js` | GPU-Terrain/Fog und Entitätsmodelle: `BattlefieldView`, `renderEntity` |
| `effects.js` | Synchrone Effekterzeugung, Lebensdauer und Schadenszahlen: `MeridianEffects` |
| `effects-view.js` | Reine Effektzeichnung: `renderBattlefieldEffects`, `drawEffectRing` |
| `simulation.js` | Gefechtsstart, Entitäten, Wirtschaft, Kampf, KI und Ziele: `MeridianGame` |
| `audio.js` | Prozedurales Web Audio: `MeridianAudio` |
| `persistence.js` | Permanentes Profil, Normalisierung und Storage-Ersatz: `createMeridianPersistence` |
| `ui.js` | Menüs, HUD, Pointer-Eingabe, Kamera, Overlays und Profileinstellungen: `MeridianUI` |
| `app.js` | Verdrahtung, Spielschleife, Vorschau und Szenendarstellung; stellt `window.Meridian` bereit |

## Schnittstellen und Zustände

- `Battlefield(seed, biome)` benötigt keinen Renderer. `renderData` enthält Layout-/Farbdaten; seine Objektidentität dient als Layout-Revision, `fogVersion` als Sicht-Revision. `BattlefieldView.sync(world)` lädt Änderungen in die GPU, ohne die Welt zu mutieren.
- `MeridianGame(profile, emit, createEffects)` besitzt Welt und Effekte, keinen Renderer. `app` synchronisiert die Welt vor dem Start-Ereignis an die UI und vor dem Zeichnen. Simulation und Effekte laufen in festen 0,05-s-Schritten, UI/Rendering pro Frame.
- `game.s` enthält den ausschließlich flüchtigen Run-Zustand mit Entitäten, Ressourcen, Kamera und `seed`, `biome`, `faction`, `enemy`, `meta`. `start(opts = {})` startet ohne Missionsdefinition mit einem eigenen HQ und 0–5 Workern aus `meta.startingWorkers`. Nur bekannte Upgrade-Stufen werden als begrenzte Ganzzahlen aus dem Profil kopiert; Änderungen wirken erst beim nächsten Start. 24 reservierte RNG-Samples erhalten den bisherigen Standard-Einstieg für Ressourcenmengen und Gegneraufstellung. Bonusworker werden erst nach der ursprünglichen Gegnerplatzierung per `spawnUnit` nahe dem HQ auf freien Plätzen ergänzt: ein zusätzlicher regulärer Spawn-RNG-Aufruf je Worker, kein neuer Platzierungs-RNG. Der Startbestand ist fest 250 Alloy / 0 Aether; Worker kosten bei allen Fraktionen 50 Alloy. Das HQ erzeugt keine passiven Rohstoffe, reguläres Alloy-/Aether-Einkommen liefern nur Worker beziehungsweise Raffinerien. Einheiten besitzen genau einen aktuellen `order`; Produktionsgebäude eigene `queue`s. `availableProducers(buildingType)` liefert Simulation und HUD dieselben verfügbaren Produktionsgebäude in Entitätsreihenfolge. `train(type)` verteilt globale Rekrutierungsaufträge auf die kürzeste passende Queue (Gleichstand: Gebäude-ID), unabhängig von der Auswahl. Aufträge bleiben bis Spawn/Abbruch am zugewiesenen Gebäude.
- `unitFits` prüft lebende Körper und reservierte Ausgänge direkt (der Kampf-Hash ist innerhalb eines Schritts veraltet), mit Radius `size × 1.4` und getrennten Boden-/Luftebenen. Terrain-/Trefferradien bleiben unverändert. `unitPosition` sucht deterministisch freie Plätze bis 24 m.
- Bewegung hält eine Ausweichseite, bevorzugt beladene Worker und lässt bewegliche Verbündete mit stabiler Priorität in kurzen Ketten Platz machen. `yieldTo` hält ein seitliches Zwischenziel; Bewegung/Drehung laufen mit normaler Geschwindigkeit, der eigentliche Auftrag bleibt erhalten. `yieldUntil` begrenzt erneute Ausweichaufträge und blockierte Manöver, sperrt aber nicht mehr die normale Bewegung. Eigenes Umgehen hat Vorrang; ein wartender Verfolger läuft nicht in das laufende Ausweichmanöver hinein. Bei fehlendem Vorankommen nutzt die vorhandene Wegsuche ein temporäres Hindernisraster mit Einheiten; das eigentliche Raster wird auch bei Fehlern wiederhergestellt. Kein zusätzlicher RNG oder externe Physik-/Navigationsbibliothek; keine allgemeine Engstellen-/Crowd-Garantie.
- Produktion erzeugt Einheiten im Gebäude mit einer kurzen `exit`-Phase (Quell-ID, reserviertes Ziel, Weglänge). Nur das eigene Produktionsgebäude ist währenddessen passierbar; normale Befehle/Arbeit/Kampf warten bis zum Ausgang. `exit`, `yieldTo` und `yieldUntil` liegen nur an der Laufzeitentität. `BUILDING_YAW` liegt gemeinsam für Simulation und Darstellung in `content.js`; Flugzeuge steigen während der Ausfahrt sichtbar auf.
- Teams: 0 Spieler, 1 Gegner, −1 neutral. Die drei Fraktionen sind unabhängig davon; Fraktion 2 ist weiterhin gültig.
- Welt-/Suchindizes, RNG-Closure und kurzlebige Effekte liegen außerhalb von `game.s`. Jeder Start erzeugt eine neue Welt samt Indizes und Sichtbarkeit; es gibt kein Snapshot-/Restore-API.
- `game.effects` hält `fx` und `floats`. Erzeugung/Tick verwenden synchron den Simulations-RNG, Zeichnen keinen RNG. Gameplayrelevante Strikes, Heilfelder und Scans bleiben in der Simulation. Effekte nicht wegen unsichtbarer Grafik überspringen.
- `ABILITIES` in `content.js` hält Energiekosten und Cooldowns; Simulation und HUD lesen die Kosten aus derselben Definition. Zielprüfung und Fähigkeitseffekte bleiben in der Simulation.
- Gebäudeaktionen prüfen Zulässigkeit, Arbeiterauftrag und Erstattung in der Simulation. Die UI zeigt sie im festen rechten Portrait-Menü und hält die bestätigte Verkaufs-Ziel-ID; kein projiziertes Gebäude-Panel. Menüzustand, Tap-Folge und offene Dialoge sind flüchtig.
- Die Queue-Leiste aggregiert vorhandene Gebäude-Queues je Einheitentyp. Stabile DOM-Buttons erhalten pro Frame den aus der Simulation abgeleiteten Winkel, Zähler und Restzeit. Keine zweite Warteschlange oder CSS-Zeitbasis. Bau-/Rekrutierungstempo und Restzeitanzeige verwenden die Basiszeiten ohne permanente Tempoboni.
- `MeridianUI(game, renderer, audio, profile, persistence)` orchestriert Bedienung und permanente Profileinstellungen. `showHome()`-Styles sind auf `.home-screen`/`.home-layout` begrenzt. `window.Meridian` bietet Runtime-Inspektion; globale `const`-/`class`-Bindungen sind nicht automatisch `window`-Eigenschaften.

## Speicherung

- `createMeridianPersistence({ getStorage, clamp, upgrades, warn })` kennt keine UI-/Spielinstanz oder Browserglobals. `app` injiziert den verzögerten Storage-Zugriff und Upgrade-Grenzen aus `META`.
- API: `loadProfile`, `saveProfile`, `available`. Schreiben meldet dauerhaften Speichererfolg als Boolean. Ausschließlich das Profil wird gelesen/geschrieben, keine Runs oder Backups.
- Profil Version 1 / `meridian.profile.v1`: einziges permanentes Upgrade `startingWorkers` (Stufe 0–5) und bekannte Einstellungen `volume`, `music`, `sfx`, `quality`, `healthbars`. Unbekannte/entfernte Upgrade-Schlüssel werden beim Laden verworfen, gültige Stufen abgerundet und begrenzt. Keine Migration, Kampagne, Credits oder Schwierigkeit.
- Runs haben kein Speicherformat mehr. Manuelles Speichern/Laden, Autosave, Home-Resume, Import/Export sowie Unload-/Grafikfehler-Sicherung sind entfernt. Alte Checkpoint-Daten werden nicht gelesen oder migriert.
- Der private Store fängt Zugriffsfehler ab und hält einen flüchtigen Ersatz. Dieser überlebt keinen Reload. Ein erfolgreicher Storage-Lesezugriff bevorzugt weiterhin den Browserwert, auch nach fehlgeschlagenem Schreiben.
- `ui.paused` stoppt die Simulation samt Effektticks. `visibilitychange` pausiert beim Verbergen der Seite, ohne zu speichern; sichtbar werden setzt nicht automatisch fort. `showHome()` verwirft `game.s`, Reload startet im Hauptmenü. Grafikverlust erfordert weiterhin Reload und verliert damit den Run.

## Schutzgrenzen und offene Architekturfragen

- Terrain-RNG wird auch für kosmetische Platzierungen verwendet; Effekte verbrauchen teilweise den Simulations-RNG. Reihenfolge, Kollisionsradien und [feste Referenzen](reference-tests.md) schützen, nicht beiläufig korrigieren.
- UI und Einstiegspunkt haben weiterhin breite Aufgaben; Entitäten/Ereignisse sind untypisiert und Skriptreihenfolge ist Teil des Vertrags. Weitere Entkopplung, TypeScript oder Build-Werkzeuge sind **nicht beauftragt** und keine Voraussetzung für neue Spielfunktionen.
- Aktuelle Spielregeln und zurückgestellte Entscheidungen: [Spiel und Bedienung](gameplay.md). Renderer-/Asset-Verträge: [Grafik](rendering.md). Prüfverfahren: [Tests](testing.md).
