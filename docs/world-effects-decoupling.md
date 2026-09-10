# Welt und kosmetische Effekte entkoppeln

## Referenzen vor dem Umbau

Ausgangspunkt `97bfda6`. Vor Änderungen an Spielquellen 22 Charakterisierungen ergänzt und separat committet. `tests/fixtures/presentation-v1.json` wurde einmalig aus diesem Stand erzeugt, nicht während der Tests und nicht zur Reparatur fehlgeschlagener Prüfungen.

- Alle 16 Kampagnenkarten: SHA-256 der vollständigen Terrain-Vertexdaten (JSON-Zahlendarstellung), sämtlicher statischer Renderer-Platzierungen in Aufrufreihenfolge sowie eines Navigations-/Fog-Szenarios. Dieses umfasst Gebäudefußabdruck, drei Wege, nächste freie Position, Sichtbarkeit, Scan und dauerhaft erkundete Felder. Die älteren Layout-Prüfsummen bleiben zusätzlich bestehen.
- Sechs Effektszenarien: unterschiedlich große Explosionen; 500-Effekt-Grenze und Partikel-Bodenreaktion; Schadenszahlen einschließlich 35er-Grenze; Rifle/Tank/Artillerie/Avatar verschiedener Fraktionen; Reparatur-/Abbauarbeiter; Heilung und Verstärkung. Geprüft werden Effektdaten vor/nach Tick, Ablauf nach fünf Sekunden, vollständiger Snapshot-Hash und fünf folgende RNG-Werte. Keine Zusicherung identischer RNG-Fortsetzung nach Laden.
- `tests/helpers/presentation-scenario.cjs` beschreibt die festen Szenarien; nach dem Umbau darf nur deren Verdrahtung angepasst werden. Erwartungen bleiben fest. Node-Testdoubles sind kein WebGL-Nachweis.

Vollständiger [Testbefehl](testing.md#automatisierte-tests): **98 bestanden, 0 fehlgeschlagen**, Node.js `v23.11.1` / Linux. Frischer Chromium-`file://`-Ausgangslauf, Phase `presentation-before`, mit der erweiterten Probe der [Speicher-Entkopplung](persistence-decoupling.md): bestanden, nur die drei bekannten Skybox-Ausnahmen bei drei Seitenladungen. Temporäres Profil, keine abgeschwächten Sicherheitsflags, keine Nutzerdaten. Hörtest, HTTP, andere Browser, vollständige Kampagnen und Performance bleiben offen.

## Umfang

Zwei begrenzte Strukturänderungen: Weltberechnung unabhängig vom Renderer, danach eine eigenständige kosmetische Effektkomponente. Kosmetische Zufallsaufrufe müssen weiterhin synchron und in bisheriger Reihenfolge stattfinden; Ausblenden der Grafik darf sie nicht überspringen. Keine neuen Spielregeln, Save-Formate, Assets, Build-Werkzeuge oder Servervoraussetzungen. Danach weitere Strukturarbeit nur bei konkretem Featurebedarf.
