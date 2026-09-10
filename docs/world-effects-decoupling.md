# Welt und kosmetische Effekte entkoppeln

Späterer Prüfhinweis: Seit der [Kristall-Platzierungskorrektur](crystal-spacing.md) stellt der Effektszenario-Helfer die ursprünglichen Ressourcenpositionen explizit als Eingabe her. Die hier dokumentierten festen Effekt-/Snapshot-/RNG-Referenzen und Welt-Prüfsummen bleiben unverändert; neue Ressourcenplatzierung und Altstandmigration werden separat geprüft.

## Referenzen vor dem Umbau

Ausgangspunkt `97bfda6`. Vor Änderungen an Spielquellen 22 Charakterisierungen ergänzt und separat committet. `tests/fixtures/presentation-v1.json` wurde einmalig aus diesem Stand erzeugt, nicht während der Tests und nicht zur Reparatur fehlgeschlagener Prüfungen.

- Alle 16 Kampagnenkarten: SHA-256 der vollständigen Terrain-Vertexdaten (JSON-Zahlendarstellung), sämtlicher statischer Renderer-Platzierungen in Aufrufreihenfolge sowie eines Navigations-/Fog-Szenarios. Dieses umfasst Gebäudefußabdruck, drei Wege, nächste freie Position, Sichtbarkeit, Scan und dauerhaft erkundete Felder. Die älteren Layout-Prüfsummen bleiben zusätzlich bestehen.
- Sechs Effektszenarien: unterschiedlich große Explosionen; 500-Effekt-Grenze und Partikel-Bodenreaktion; Schadenszahlen einschließlich 35er-Grenze; Rifle/Tank/Artillerie/Avatar verschiedener Fraktionen; Reparatur-/Abbauarbeiter; Heilung und Verstärkung. Geprüft werden Effektdaten vor/nach Tick, Ablauf nach fünf Sekunden, vollständiger Snapshot-Hash und fünf folgende RNG-Werte. Keine Zusicherung identischer RNG-Fortsetzung nach Laden.
- `tests/helpers/presentation-scenario.cjs` beschreibt die festen Szenarien; nach dem Umbau darf nur deren Verdrahtung angepasst werden. Erwartungen bleiben fest. Node-Testdoubles sind kein WebGL-Nachweis.

Vollständiger [Testbefehl](testing.md#automatisierte-tests): **98 bestanden, 0 fehlgeschlagen**, Node.js `v23.11.1` / Linux. Frischer Chromium-`file://`-Ausgangslauf, Phase `presentation-before`, mit der erweiterten Probe der [Speicher-Entkopplung](persistence-decoupling.md): bestanden, nur die drei bekannten Skybox-Ausnahmen bei drei Seitenladungen. Temporäres Profil, keine abgeschwächten Sicherheitsflags, keine Nutzerdaten. Hörtest, HTTP, andere Browser, vollständige Kampagnen und Performance bleiben offen.

## Schritt 1: CPU-Welt und Renderer

`Battlefield(seed, biome)` erzeugt Raster, Navigation, Sichtbarkeit sowie `renderData`, ohne `MeridianRenderer`, `geom` oder `MAT`. Die Farbwerte der Biome sind weiterhin numerische RGB-Werte. `renderData.groundColors` enthält zwei RGB-Tripel je Zelle; `placements` enthält benannte Mesh-, Positions-, Skalen-, Rotations-, Farb-, Glow-, Alpha-, Layer- und optionale symbolische Materialwerte. Der Algorithmus zieht kosmetische Zufallswerte weiterhin zwischen Hindernisentscheidungen; nur deren GPU-Verarbeitung ist abgetrennt.

`world-view.js` übersetzt diese Daten mit `BattlefieldView.sync(world, fogOn = true)` in die bisherigen Vertexdaten und Aufrufe. Die Identität von `renderData` dient als Layout-Revision: neue Layouts erhalten ein neues Objekt, keine unbemerkten In-place-Änderungen. Unveränderte Layoutdaten werden nicht erneut hochgeladen; `fogVersion` signalisiert eine erneute Sichtberechnung. `renderEntity` und sein Yaw-Helfer wurden bytegleich aus `world.js` übernommen. Die CPU-Welt wird beim Synchronisieren nicht mutiert.

`MeridianGame(profile, emit)` besitzt keinen Renderer mehr. `app` synchronisiert beim Start/Restore vor der UI-Benachrichtigung sowie vor jedem Spiel-Renderdurchlauf; die Menüvorschau nutzt eine eigene CPU-Welt. Fog wird damit an der Präsentationsgrenze hochgeladen, nicht mehr mitten im Simulationsschritt. Mehrere Sichtberechnungen vor einem Frame dürfen zu einem einzigen Upload des letzten Rasters zusammenfallen.

Nach dem Umbau **100 Tests bestanden**, darunter zwei neue Prüfungen für vollständig rendererfreies Starten/Simulieren/Laden und Layout-/Fog-Invalidierung des Adapters. Alle alten Layout-, neuen Präsentations-/Effekt- und Save-Referenzen unverändert. Bestehende Modell-/Simulationsprüfungen ändern nur die Konstruktion und Adapterverdrahtung, nicht die Sollwerte.

Frischer Chromium-`file://`-Lauf `world-boundary`: erweiterter Ablauf bestanden; acht Layout-Messsätze, GPU-/Qualitätsresultate (ohne variable Frame-Nummern) und drei bekannte Skybox-Ausnahmen stimmen mit `presentation-before` überein. Keine neuen erfassten Fehler. Probe unter `/tmp/meridian-world-effects-browser.cjs`; weiterhin kein Hörtest, HTTP- oder vollständiger Kampagnennachweis.

## Schritt 2: synchrone Effekte und reine Zeichnung

Nach `b9f0026` übernimmt `MeridianEffects(random)` in `effects.js` die Erzeugung und Lebensdauer aller kurzlebigen Effekte und Schadenszahlen. Die fachlichen Aufrufe sind `explosion`, `damageNumber`, `shell`, `shot`, `construction`, `mining`, `healing` und `drop`; `reset` leert den flüchtigen Zustand, `tick(dt)` aktualisiert ihn. Entitätsdaten werden nur synchron gelesen, nicht geändert oder als spätere Aufgaben gespeichert.

`MeridianGame(profile, emit, createEffects)` erhält optional eine Factory, standardmäßig für `MeridianEffects`. Der übergebene Provider `() => this.random()` folgt auch einem beim Start/Restore neu gesetzten RNG. Die Komponente wird nicht auf den Renderer-Frame verschoben und bei ausgeblendeter Grafik nicht deaktiviert: Explosionen und Arbeitereffekte verbrauchen weiterhin denselben Simulations-RNG. Auch die Mining-Reihenfolge `Zufall → bei Erfolg Sichtabfrage` bleibt erhalten. Gameplayrelevante Strikes/Felder/Scans, Schaden, Heilung, Cooldowns und Sichtentscheidungen bleiben in der Simulation.

`game.effects` besitzt `fx` und `floats`. Bisherige Lesezugriffe `game.fx`/`game.floats` sowie `game.explosion()`/`game.tickEffects()` delegieren zur Komponente; die Anwendung tickt ausdrücklich `game.effects`. Der Zustand gehört weiterhin nicht zum Save. Kein unabhängiger neuer RNG und keine Garantie exakter Fortsetzung nach Laden.

`effects-view.js` erhält über `renderBattlefieldEffects(R, effects, world, state, pings, time)` ausschließlich die benötigten Daten und den Renderer. Zeichnen verändert sie nicht, führt keine Simulation aus und verwendet keinen RNG. `drawEffectRing` wird auch für Auswahl-/Bauvorschauringe verwendet. Die UI liest Schadenszahlen aus `game.effects.floats`. Die Einrückung übernommener Blöcke wurde nicht nebenbei durch einen Formatter bereinigt.

Drei zusätzliche Tests prüfen die eigenständige Effektkomponente, synchrone RNG-Aufrufe und Short-Circuiting, dynamischen RNG nach Restore sowie reine Effektzeichnung mit tief eingefrorenen Daten und verbotenem `Math.random`. Die Zeichenreferenz `tests/fixtures/effects-view-v1.json` wurde ergänzend aus den unveränderten `ring`-/`effects`-Funktionen von `b9f0026:app.js` in einer isolierten VM ermittelt. Sie umfasst alle sechs Effektarten, unsichtbare Beam-/Drop-Fälle, Pings, aktive/abgelaufene Felder und Scans sowie Strike-Markierungen. Der Test vergleicht Anzahl und Hash aller `add`-/`beam`-Argumente; er ersetzt keine GPU-Prüfung.

**Endstand: 103 Tests bestanden, 0 fehlgeschlagen**, vollständiger Testbefehl mit 128-MiB-Heaplimit und einem Worker. Die 22 ursprünglichen Präsentationsreferenzen, ältere Layout-Prüfsummen und Version-1-Operation bleiben unverändert. Sechs nur testseitig eingesetzte Mutationen wurden erkannt: übersprungene Welt-RNG-Samples, falsches Felsmaterial, fehlende Fog-Invalidierung, ausgelassener Partikel-RNG-Aufruf, veränderte Schwerkraft und falsche Beam-Breite. Kein mutierter Spielcode auf Platte oder eingecheckt.

Frischer Chromium-`file://`-Lauf `effects-boundary`: erweiterter Spiel-/Eingabe-/Save-/Reload-/Backup-Ablauf bestanden. Acht Layout-Messsätze, Shader-/Textur-/Qualitätsresultate und genau drei bekannte Skybox-Ausnahmen stimmen sowohl mit `world-boundary` als auch `presentation-before` überein. Menü und Bauvorschau bei 1280×800 zusätzlich gesichtet; kein Pixelvergleich animierter Szenen. Audio nur Kontext-/Gain-API-Prüfung, kein Hörtest. Temporäre Profile/Backups entfernt. Browserproben bleiben unter `/tmp`, keine neuen Projektabhängigkeiten.

Core, Renderer, Content, Audio, Persistence, Stylesheet und alle vier Bilddateien bleiben bytegleich zum Ausgangspunkt. Dokumentationslinks/Anker und `git diff --check` vor den Commits geprüft. HTTP, andere Browser, vollständige Kampagnen/Bedienung und Performance bleiben offen; die bekannte Skybox-Sperre bleibt unbehoben.

## Abschluss und weitere Spielentwicklung

Beide vereinbarten Strukturänderungen sind abgeschlossen. Weitere Entkopplung, TypeScript, Build- oder Serverumstieg sind keine Vorbedingung für neue Spielfunktionen. Bei neuen Features die passende Grenze verwenden und deren Referenztests ergänzen; RNG-/Balancing-/Save-Änderungen bewusst separat behandeln.

## Umfang

Zwei begrenzte Strukturänderungen: Weltberechnung unabhängig vom Renderer, danach eine eigenständige kosmetische Effektkomponente. Kosmetische Zufallsaufrufe müssen weiterhin synchron und in bisheriger Reihenfolge stattfinden; Ausblenden der Grafik darf sie nicht überspringen. Keine neuen Spielregeln, Save-Formate, Assets, Build-Werkzeuge oder Servervoraussetzungen. Danach weitere Strukturarbeit nur bei konkretem Featurebedarf.
