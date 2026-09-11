# Architektur

## Auslieferung

`index.html`, `styles.css` und die lokalen JavaScript-Dateien sind handgepflegte Quellen und werden direkt ausgeliefert. Keine generierten Dateien, npm-Abhängigkeiten, Laufzeit-Imports oder Build-/Serverpflicht. Die Skripte teilen globale lexikalische Bindungen und laufen synchron in HTML-Reihenfolge, ohne `async`, `defer` oder ES-Module. Inline-Styles in UI-Templates bestehen weiterhin.

## Codekarte

Die Reihenfolge entspricht den `data-meridian-script`-Tags in `index.html`:

| Datei | Zuständigkeit / Einstieg |
| --- | --- |
| `core.js` | Matrizen, Vektoren und Seed-RNG: `M4`, `V`, `seeded` |
| `renderer.js` | WebGL 2, Meshes, Materialien, eingebettete Texturen und Renderpässe: `MeridianRenderer` |
| `content.js` | `FACTIONS`, `UNITS`, `BUILDINGS`, `META`, `BIOMES`, Icons und Namenshelfer |
| `world.js` | CPU-Terrain, Hindernisraster, Navigation und Sichtbarkeit: `Battlefield` |
| `world-view.js` | GPU-Terrain/Fog und Entitätsmodelle: `BattlefieldView`, `renderEntity` |
| `effects.js` | Synchrone Effekterzeugung, Lebensdauer und Schadenszahlen: `MeridianEffects` |
| `effects-view.js` | Reine Effektzeichnung: `renderBattlefieldEffects`, `drawEffectRing` |
| `simulation.js` | Gefechtsstart, Entitäten, Wirtschaft, Kampf, KI, Ziele und Snapshot/Restore: `MeridianGame` |
| `audio.js` | Prozedurales Web Audio: `MeridianAudio` |
| `persistence.js` | Profilnormalisierung, Storage-Ersatz und Backup-Codec: `createMeridianPersistence` |
| `ui.js` | Menüs, HUD, Pointer-Eingabe, Kamera, Overlays und Datei-/Speicherabläufe: `MeridianUI` |
| `app.js` | Verdrahtung, Spielschleife, Vorschau und Szenendarstellung; stellt `window.Meridian` bereit |

## Schnittstellen und Zustände

- `Battlefield(seed, biome)` benötigt keinen Renderer. `renderData` enthält Layout-/Farbdaten; seine Objektidentität dient als Layout-Revision, `fogVersion` als Sicht-Revision. `BattlefieldView.sync(world)` lädt Änderungen in die GPU, ohne die Welt zu mutieren.
- `MeridianGame(profile, emit, createEffects)` besitzt Welt und Effekte, keinen Renderer. `app` synchronisiert die Welt vor dem Start-Ereignis an die UI und vor dem Zeichnen. Simulation und Effekte laufen in festen 0,05-s-Schritten, UI/Rendering pro Frame.
- `game.s` enthält den serialisierbaren Zustand mit Entitäten, Ressourcen, Kamera und `seed`, `biome`, `faction`, `enemy`, `meta`. `start(opts = {})` startet ohne Missionsdefinition. Einheiten besitzen genau einen aktuellen `order`; Produktionsgebäude eigene `queue`s. `train(type)` verteilt globale Rekrutierungsaufträge auf die kürzeste passende Queue (Gleichstand: Gebäude-ID), unabhängig von der Auswahl. Aufträge bleiben bis Spawn/Abbruch am zugewiesenen Gebäude.
- `unitFits` prüft Terrain/Map-Grenzen und lebende Einheitenpositionen direkt (der Kampf-Hash ist innerhalb eines Schritts veraltet). Körper-Abstandsradius `size × 1.4`, getrennte Boden-/Luftebenen; keine Änderung an Treffer-/Reichweiten- oder Terrainradien. `unitPosition` sucht deterministisch in Ringen bis 24 m für Spawn, Start und Restore; keine RNG-Aufrufe, Save-Felder oder Physikbibliothek. Bewegung prüft den nächsten Schritt und seitliche Alternativen; untätige Verbündete können ausschließlich in freien Raum ausweichen. Keine vollständige Crowd-Wegplanung; enge oder überfüllte Passagen können weiterhin blockieren.
- Teams: 0 Spieler, 1 Gegner, −1 neutral. Die drei Fraktionen sind unabhängig davon; Fraktion 2 ist weiterhin gültig.
- Welt-/Suchindizes, RNG-Closure und kurzlebige Effekte liegen außerhalb von `game.s`. `snapshot()` ergänzt erkundete Felder; `restore()` prüft Daten und baut Welt/Indizes neu auf.
- `game.effects` hält `fx` und `floats`. Erzeugung/Tick verwenden synchron den Simulations-RNG, Zeichnen keinen RNG. Gameplayrelevante Strikes, Heilfelder und Scans bleiben in der Simulation. Effekte nicht wegen unsichtbarer Grafik überspringen.
- Gebäudeaktionen prüfen Zulässigkeit, Arbeiterauftrag und Erstattung in der Simulation. Die UI zeigt sie im festen rechten Portrait-Menü und hält die bestätigte Verkaufs-Ziel-ID; kein projiziertes Gebäude-Panel. Menüzustand, Tap-Folge und offene Dialoge sind flüchtig.
- Die Queue-Leiste aggregiert vorhandene Gebäude-Queues je Einheitentyp. Stabile DOM-Buttons erhalten pro Frame den aus der Simulation abgeleiteten Winkel, Zähler und Restzeit. Keine zweite Warteschlange, CSS-Zeitbasis oder zusätzliche Save-Felder.
- `MeridianUI(game, renderer, audio, profile, persistence)` orchestriert Bedienung und Speicheraktionen. `showHome()`-Styles sind auf `.home-screen`/`.home-layout` begrenzt. `window.Meridian` bietet Runtime-Inspektion; globale `const`-/`class`-Bindungen sind nicht automatisch `window`-Eigenschaften.

## Speicherung

- `createMeridianPersistence({ getStorage, clamp, upgrades, warn })` kennt keine UI-/Spielinstanz oder Browserglobals. `app` injiziert den verzögerten Storage-Zugriff und Upgrade-Grenzen aus `META`.
- API: `loadProfile`, `saveProfile`, `hasCheckpoint`, `readCheckpoint`, `saveCheckpoint`, `removeCheckpoint`, `serializeBackup`, `parseBackup`, `available`. `hasCheckpoint` prüft nur Vorhandensein, nicht das gesamte Format. Schreibmethoden melden dauerhaften Speichererfolg als Boolean.
- Profil Version 1 / `meridian.profile.v1`: permanente Upgrades und bekannte Einstellungen `volume`, `music`, `sfx`, `quality`, `healthbars`. Keine Kampagne, Credits oder Schwierigkeit.
- Checkpoint Version 3 / `meridian.operation.v3`. Backup: `format: 'ashes-of-meridian'`, Umschlag Version 1, Profil und optionale Operation Version 3. Keine Migration alter Checkpoints; unbekannte Einheitentypen einschließlich Aufklärer werden auch in Produktionsqueues abgewiesen.
- Der private Store fängt Zugriffsfehler ab und hält einen flüchtigen Ersatz. Dieser überlebt keinen Reload. Ein erfolgreicher Storage-Lesezugriff bevorzugt weiterhin den Browserwert, auch nach fehlgeschlagenem Schreiben.
- Backup-Import (maximal 4.000.000 Bytes, Operation maximal 1.500 Entitäten) ist **nicht transaktional**: Profil speichern/normalisieren, Audio/Renderer anwenden, dann gegebenenfalls Checkpoint übernehmen. Teiländerungen bei Fehlern sind möglich; Profil-only-Import lässt den bisherigen Checkpoint stehen. Codec und Restore sind keine vollständige Schemavalidierung.

## Schutzgrenzen und offene Architekturfragen

- Terrain-RNG wird auch für kosmetische Platzierungen verwendet; Effekte verbrauchen teilweise den Simulations-RNG. Reihenfolge, Kollisionsradien und [feste Referenzen](reference-tests.md) schützen, nicht beiläufig korrigieren.
- Laden garantiert keine exakte RNG-Fortsetzung: Start verwendet `seed + 77`, Restore `seed + floor(time × 50)`, nicht den gespeicherten Generatorzustand.
- UI und Einstiegspunkt haben weiterhin breite Aufgaben; Entitäten/Ereignisse sind untypisiert und Skriptreihenfolge ist Teil des Vertrags. Weitere Entkopplung, TypeScript oder Build-Werkzeuge sind **nicht beauftragt** und keine Voraussetzung für neue Spielfunktionen.
- Aktuelle Spielregeln und zurückgestellte Entscheidungen: [Spiel und Bedienung](gameplay.md). Renderer-/Asset-Verträge: [Grafik](rendering.md). Prüfverfahren: [Tests](testing.md).
