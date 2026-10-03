# Orbital Platform vollständig zurückbauen

Zielentscheidung: nur noch eine gemeinsame landschaftliche Kartenerzeugung pflegen; `platform-deck` / **ORBITAL PLATFORM** entfällt vollständig, nicht nur aus der Auswahl. Vorbereitung, noch keine Umsetzung. Plattform-Ausbau und -Abnahme sind aufgehoben. Maßgeblich für die verbleibenden Landschaften: [Landschaftsabnahme](procedural-battlefields.md) und [Darstellung](project-tomorrow.md).

## Umfang und Grenzen

- Die sechs Familien `desert`, `alien-planet`, `mothership`, `westmark`, `frontier`, `haven` bleiben. Sie verwenden bereits alle `createDynamicBattlefield`; sechs Varianten sind keine sechs Generatorarchitekturen.
- `mothership` ist trotz Name/Metalloptik eine Familie des gemeinsamen Höhenfeldgenerators. Ihre Entfernung oder Umgestaltung wäre ein zusätzlicher Contentauftrag, nicht notwendiger Plattformrückbau.
- Keine neue Kartenarchitektur, Ersatzkarte, Migration oder versteckte Legacy-Plattform. Kein beiläufiges Balancing oder Landschafts-/Asset-Redesign.
- Terrain, Hindernisse, Körperradien, Landschafts-Fundbudget und Seedströme der verbleibenden Familien schützen. Der kleinere Auswahlpool ändert zwangsläufig künftig gezogene Karten; Reihenfolge und Anzahl der Encounter-Ziehungen nicht zusätzlich verändern.

## Notwendiger Rückbau

- [ ] **Katalog und Mission:** Eintrag in `src/battlefields/catalog.ts` und Kartenfreigabe in `src/content.ts` entfernen. `BattlefieldId` schrumpft dadurch automatisch; `availableBattlefields()` und Encounter-Auswahl in `src/ui/screens.ts` bleiben katalogbasiert. Keine neue Auswahl-Sonderregel für den einen Generator einführen.
- [ ] **Generator:** `src/battlefields/platforms.ts` einschließlich Plan-/Rampentypen, Raumaufteilung, Höhen-/Konturfunktionen, Wirtschaftsauswahl und Stations-/Dock-/Skyline-Dekoration löschen.
- [ ] **Exklusive Darstellung:** `src/renderer/platform-terrain.ts`, `src/renderer/platform-dockyard.ts`, `src/renderer/platform-skyline.ts` löschen. Zugehörige klassische Skripteinträge in `index.html` und Gruppen in `tests/helpers/game-scripts.cjs` entfernen; direkte `file://`-Auslieferung erhalten.
- [ ] **Geometrievertrag:** Plattform-`plan`-Alternative aus `WorldGeometry` in `src/contracts.d.ts`, Factory-Signatur in `src/renderer/contracts.d.ts` und Dispatchzweig in `src/renderer/terrain-models.ts` entfernen. Relief-, Feature- und übrige Deskriptoren bleiben.
- [ ] **Sonderverhalten:** Plattform-spezifische Menüinszenierung in `src/app.ts` entfernen. Fundbudget in `src/battlefields/deployment.ts` auf die bestehende Landschaftsformel vereinfachen; Platzierung/Bergung/Seed-Salt unverändert lassen.
- [ ] **Technikmaterial:** `TECHNICAL` samt `technicalHash`/`technicalSurface`, Material- und Mikrohöhenzweigen in `src/renderer/shaders.ts` entfernen. Alle aktuellen Produzenten gehören zur Plattform. Die Materialdefinition in `scripts/embed-textures.mjs` ändern und die Einbettung über den Generator aktualisieren, nie `src/renderer/assets.js` von Hand. `METAL` bleibt für Mothership, Einheiten und Gebäude; keine übrigen Material-IDs umnummerieren. Rasterassets nicht löschen/ersetzen.
- [ ] **Speichergrenzen:** Bestehende Katalogvalidierung in `src/persistence.ts` nutzen: alte Plattform-Rezepte/Snapshots sind inkompatibel, keine Umleitung auf Desert. Profilupgrades, Reserve und Einstellungen erhalten. Bestehenden Fehler-/Verwerfenpfad und Archivvalidierung gezielt prüfen; keinen pauschalen Rezeptversionssprung vornehmen, solange die sechs verbleibenden Rezepte unverändert sind.
- [ ] **Dokumentation:** Aktuelle Plattformbeschreibung in `README.md`, `docs/architecture.md`, `docs/gameplay.md`, `docs/rendering.md`, `docs/testing.md` entfernen/anpassen. Laufzeitdokumentation bis zum tatsächlichen Rückbau nicht als bereits umgesetzt formulieren. Nach Abschluss dieses Issue löschen und verbleibende Verweise entfernen.

## Refactoring nach dem exklusiven Rückbau

Diese Vereinfachungen getrennt von der Entfernung prüfen und umsetzen, damit gemeinsame Verhaltensänderungen im Diff erkennbar bleiben:

- [ ] **Dekor-Fernebene:** `sceneryBounds` in `BattlefieldRenderProfile` (`src/contracts.d.ts`) und zugehörige Erweiterung in `src/renderer/runtime.ts` können entfallen: aktueller Profilproduzent ist nur die Plattform. Normale kamera-/terrainabhängige Fernebene und allgemeine Mesh-/Bucket-Bounds bleiben; keine pauschale Culling-Vereinfachung.
- [ ] **Zusätzliche Baumaske:** `BattlefieldSurface.buildBlocked` samt Fundamentzweig in `src/battlefields/surface.ts` hat nach Wegfall der temporären Plattform-Wirtschaftsprobe keinen Produktionsnutzer. Entfernen statt vorsorglich für mögliche Brücken behalten; betroffene Maskentests in `ashes-of-meridian-westmark.check.cjs` und `ashes-of-meridian-terrain.check.cjs` entsprechend bereinigen. Klippen-, Belegungs- und Fundamentprüfungen bleiben vollständig erhalten.
- [ ] **Gemeinsam genutzte Schiffskulisse:** `src/renderer/mothership-terrain.ts` nicht komplett löschen: `shipHangar` und `shipPlant` werden weiterhin von `src/battlefields/variations.ts` verwendet. Nach Plattformrückbau übrige Modelregistrierungen auf tatsächliche Nutzer in Quellen/Tests prüfen; nur nachweislich unbenutzte Plattform-Zulieferer entfernen. Keine unbeauftragte Neugestaltung der Mothership-Familie.

**Nicht vereinfachen:** CPU-Höhenfeld, Sichtstufen, Rampen-/Klippenfähigkeit, Flugfreiraum, Picking, Hangfundamente, getrennte Terrain-/Darstellungsgrenzen und RNG-Quellen. Die Landschaften verwenden ebenfalls Höhen-Sichtstufen (`floor(h / 6)`) und benötigen diese Systeme. Ökologie-/Materialoptionen nicht pauschal verpflichtend machen: Familien und interne Szenarien besitzen weiterhin unterschiedliche Profile. Allgemeine `BattlefieldDefinition`-/Design-/Szenariogrenzen nicht nur deshalb einreißen, weil der Expeditionskatalog einen Generator nutzt. Orbital Strike, Fraktionsmodelle und allgemeines Metall sind kein Bestandteil der entfernten Kartenart.

## Tests und Abnahme

Betroffene Dateien, keine Freigabe für ganze Gruppen:

- `tests/ashes-of-meridian-world-designs.check.cjs`: ausschließlich Plattformfälle und exportierte Planhelfer entfernen; Landschafts-, Design-, Atmosphären- und Reliefverträge behalten.
- `tests/ashes-of-meridian-harness.check.cjs`: sechs Katalogeinträge und Anzeigenamen; Skriptgruppen-/Ladevertrag.
- `tests/ashes-of-meridian-controls.check.cjs`: Pool und Keine-Wiederholung-Erwartungen anpassen; plattformspezifischen positiven Fortsetzungsfall durch eine verbleibende Landschaft abdecken. Vorschau/Archiv erhalten.
- `tests/ashes-of-meridian-persistence.check.cjs`: positiven Plattformfall durch Landschaft ersetzen; Inkompatibilität entfernter Karten für Rezept und laufenden Snapshot bei unverändertem Profil absichern. Fremde/entfernte Archivkarten verwerfen, nicht umbiegen.
- `tests/ashes-of-meridian-supply-caches.check.cjs`: Plattformbudget entfernen; Landschaftsplatzierung und bestehende Auszahlungen behalten.
- `tests/ashes-of-meridian-presentation.check.cjs`: exklusiven technischen Material-/Fundamentfall entfernen, gemeinsame Landschafts-/Metallverträge behalten.
- `tests/ashes-of-meridian-renderer.check.cjs`: Profilwechsel ohne Plattform weiter prüfen; gemeinsame Terrain-/Dekor-Fernebenenprüfung bei Entfernung von `sceneryBounds` erhalten.
- Masken-/Kulissenrefactoring zusätzlich mit den jeweils betroffenen Terrain-/Westmark-/Variationsfällen prüfen. Keine Referenzen zum Grünmachen regenerieren.

Vorgeschlagene Reihenfolge: zusammenhängenden exklusiven Rückbau einschließlich Tests/Ladeeinträgen und Dokumentation integrieren → Build → kurze betroffene Fälle nach [Prüfwahl](../testing.md) → getrennte kleine Vereinfachungen. Gezielt einen Browsercheck über `file://` für entfernten GLSL-Materialzweig und vollständige Skriptladung vorsehen; keine Screenshotserie. Vor Lauf Dauer/Umfang eingrenzen. Breite Tests sowie KI-/Simulationsläufe brauchen separate aktuelle Freigabe.

Abschlusskriterien: sechs Familien im normalen Pool; keine Plattformimplementierung, Planverträge, Materialzweige oder Ladeeinträge mehr; verbleibende Landschaften unverändert generiert; inkompatible alte Plattform-Saves ohne Verlust permanenter Profilwerte behandelt. Zielgeräteperformance und menschliche Landschaftsabnahme bleiben offen.

Prüfkontext dieser Planung: lesende Suche in Quellen, Skriptmanifesten, Tests und Dokumentation. Keine Builds, Browser-, KI- oder Simulationsläufe; kein gemessener Performancegewinn behauptet.
