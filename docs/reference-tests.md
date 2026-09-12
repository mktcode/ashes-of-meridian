# Feste Testreferenzen

Terrain-, Zeichen-, Effekt- und RNG-Erwartungen schützen vor unbeabsichtigten Änderungen. Sollwerte nicht zum Beheben fehlgeschlagener Tests neu erzeugen; beabsichtigte Änderungen isolieren und begründen.

## Aktive Fixtures

- `tests/fixtures/presentation-v1.json`: 16 Seed-/Biom-Paare für Terrain, Platzierungen, Navigation und Sichtbarkeit sowie fünf Effektfälle für Payload, Lebensdauer und RNG-Folgesamples. Die Seeds sind Testdaten, keine Missionen. Herkunft: `97bfda6`; ausschließlich Platzierungshashes wurden mit `05daefc` für die gezielt entfernten 45 Straßenflächen/-markierungen angepasst. Der Gebirgsstand ergänzt Ring und höhere kleine Felsen sowie maximal zwei breite, tatsächlich blockierende Innenmassive. Dafür sind alle 16 Platzierungs- und Navigationsreferenzen gezielt angepasst; der Platzierungsdigest enthält nun Zeichenaufrufe **und Massiv-Deskriptoren**. Vorher/Nachher-Abgleich schützt die übrigen Platzierungen, kleinen Hindernisradien und Terrainfarben: zusätzliche Sperrzellen entsprechen ausschließlich `massifGrid`. Die alten `originalLayouts`-Hashes bleiben unverändert und prüfen das aus kleinen Felsblockern rekonstruierte Raster. Aktive Terrain-/Effekt-/RNG-Sollwerte bleiben erhalten. Die reine Verfeinerung des Außenrings ändert danach nur seine Materialkennung von `ROCK` auf `MASSIF` in den 16 Platzierungsdigests; Innenmassiv-Deskriptoren, übrige CPU-Welt und Navigationshashes bleiben gleich. Ring-Meshdetails werden separat auf Determinismus, Polygonbudget, Normale, geschlossene Seitennähte und vollständig außerhalb liegende Dreiecke geprüft, nicht durch den Platzierungsdigest. Das ist relevante Referenzprovenienz, kein Regenerierungsauftrag.
- `tests/fixtures/effects-view-v1.json`: reine Zeichenaufrufe aus `b9f0026`, keine GPU-Pixel. Frozen-Data- und RNG-Verbote prüfen, dass Zeichnen die Simulation nicht verändert.
- Terrain-, Kristall-, Mathematik- und RNG-Tests enthalten weitere feste, unabhängig nachvollziehbare Erwartungen im Testcode.

## Szenariohelfer

- `tests/helpers/populated-battle.cjs` erzeugt eine ausgebaute Basis für Produktion, Reparatur, Verkehr und Effekte, ohne den Test-RNG weiterzuschalten. Kein ausgelieferter Startmodus; eigene Starttests decken HQ/Worker-Stufen 0–5, Ressourcen, Fraktionen und Biome ab.
- `tests/helpers/presentation-scenario.cjs` setzt den Effekt-RNG auf `seeded(1486)` nach 104 Samples. Feste Emitterpositionen machen Effekte unabhängig vom Startaufgebot und von separat getesteter Spawn-Kollisionsvermeidung. Diesen Einstieg nicht als vermeintliches Legacy-Verhalten entfernen.
- `tests/helpers/game-scripts.cjs` lädt nach dem Build die benannten klassischen Skripte aus `dist/src/` gemäß `index.html` in Dokumentreihenfolge in eine isolierte VM. Ausführung nur explizit gewählter Namen. Pfadprüfung, Fehlerdiagnosen und Renderer-Testdouble bleiben aktive Testinfrastruktur.

## Grenzen

Keine Fixture beweist Browser-/WebGL-Darstellung, echte Touchbedienung oder allgemeine Crowd-Stabilität. Durchgehende Simulationsszenarien ergänzen die Referenzen um Worker-Verkehr, Produktion, Kampf und Neustart; UI-/Profiltests decken den Core Loop und die einmalige Aether-Evakuierung ab. Historische Gesamtspielstand- oder entfernte Boss-Waffenreferenzen sind kein Vertrag.

[Testbefehl und Prüfverfahren](testing.md).
