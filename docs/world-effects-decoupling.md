# Welt und kosmetische Effekte entkoppeln

## Referenzen vor dem Umbau

Ausgangspunkt `97bfda6`. Vor Änderungen an Spielquellen 22 Charakterisierungen ergänzt und separat committet. `tests/fixtures/presentation-v1.json` wurde einmalig aus diesem Stand erzeugt, nicht während der Tests und nicht zur Reparatur fehlgeschlagener Prüfungen.

- Alle 16 Kampagnenkarten: SHA-256 der vollständigen Terrain-Vertexdaten (JSON-Zahlendarstellung), sämtlicher statischer Renderer-Platzierungen in Aufrufreihenfolge sowie eines Navigations-/Fog-Szenarios. Dieses umfasst Gebäudefußabdruck, drei Wege, nächste freie Position, Sichtbarkeit, Scan und dauerhaft erkundete Felder. Die älteren Layout-Prüfsummen bleiben zusätzlich bestehen.
- Sechs Effektszenarien: unterschiedlich große Explosionen; 500-Effekt-Grenze und Partikel-Bodenreaktion; Schadenszahlen einschließlich 35er-Grenze; Rifle/Tank/Artillerie/Avatar verschiedener Fraktionen; Reparatur-/Abbauarbeiter; Heilung und Verstärkung. Geprüft werden Effektdaten vor/nach Tick, Ablauf nach fünf Sekunden, vollständiger Snapshot-Hash und fünf folgende RNG-Werte. Keine Zusicherung identischer RNG-Fortsetzung nach Laden.
- `tests/helpers/presentation-scenario.cjs` beschreibt die festen Szenarien; nach dem Umbau darf nur deren Verdrahtung angepasst werden. Erwartungen bleiben fest. Node-Testdoubles sind kein WebGL-Nachweis.

Vollständiger [Testbefehl](testing.md#automatisierte-tests): **98 bestanden, 0 fehlgeschlagen**, Node.js `v23.11.1` / Linux. Frischer Chromium-`file://`-Ausgangslauf, Phase `presentation-before`, mit der erweiterten Probe der [Speicher-Entkopplung](persistence-decoupling.md): bestanden, nur die drei bekannten Skybox-Ausnahmen bei drei Seitenladungen. Temporäres Profil, keine abgeschwächten Sicherheitsflags, keine Nutzerdaten. Hörtest, HTTP, andere Browser, vollständige Kampagnen und Performance bleiben offen.

## Schritt 1: CPU-Welt und Renderer

`Battlefield(seed, biome)` erzeugt Raster, Navigation, Sichtbarkeit sowie `renderData`, ohne `MeridianRenderer`, `geom` oder `MAT`. Die Farbwerte der Biome sind weiterhin numerische RGB-Werte. `renderData.groundColors` enthält zwei RGB-Tripel je Zelle; `placements` enthält benannte Mesh-, Positions-, Skalen-, Rotations-, Farb-, Glow-, Alpha-, Layer- und optionale symbolische Materialwerte. Der Algorithmus zieht kosmetische Zufallswerte weiterhin zwischen Hindernisentscheidungen; nur deren GPU-Verarbeitung ist abgetrennt.

`world-view.js` übersetzt diese Daten mit `BattlefieldView.sync(world, fogOn = true)` in die bisherigen Vertexdaten und Aufrufe. Unveränderte Layoutdaten werden nicht erneut hochgeladen; `fogVersion` signalisiert eine erneute Sichtberechnung. `renderEntity` und sein Yaw-Helfer wurden bytegleich aus `world.js` übernommen. Die CPU-Welt wird beim Synchronisieren nicht mutiert.

`MeridianGame(profile, emit)` besitzt keinen Renderer mehr. `app` synchronisiert beim Start/Restore vor der UI-Benachrichtigung sowie vor jedem Spiel-Renderdurchlauf; die Menüvorschau nutzt eine eigene CPU-Welt. Fog wird damit an der Präsentationsgrenze hochgeladen, nicht mehr mitten im Simulationsschritt. Mehrere Sichtberechnungen vor einem Frame dürfen zu einem einzigen Upload des letzten Rasters zusammenfallen.

Nach dem Umbau **100 Tests bestanden**, darunter zwei neue Prüfungen für vollständig rendererfreies Starten/Simulieren/Laden und Layout-/Fog-Invalidierung des Adapters. Alle alten Layout-, neuen Präsentations-/Effekt- und Save-Referenzen unverändert. Bestehende Modell-/Simulationsprüfungen ändern nur die Konstruktion und Adapterverdrahtung, nicht die Sollwerte.

Frischer Chromium-`file://`-Lauf `world-boundary`: erweiterter Ablauf bestanden; acht Layout-Messsätze, GPU-/Qualitätsresultate (ohne variable Frame-Nummern) und drei bekannte Skybox-Ausnahmen stimmen mit `presentation-before` überein. Keine neuen erfassten Fehler. Probe unter `/tmp/meridian-world-effects-browser.cjs`; weiterhin kein Hörtest, HTTP- oder vollständiger Kampagnennachweis.

## Umfang

Zwei begrenzte Strukturänderungen: Weltberechnung unabhängig vom Renderer, danach eine eigenständige kosmetische Effektkomponente. Kosmetische Zufallsaufrufe müssen weiterhin synchron und in bisheriger Reihenfolge stattfinden; Ausblenden der Grafik darf sie nicht überspringen. Keine neuen Spielregeln, Save-Formate, Assets, Build-Werkzeuge oder Servervoraussetzungen. Danach weitere Strukturarbeit nur bei konkretem Featurebedarf.
