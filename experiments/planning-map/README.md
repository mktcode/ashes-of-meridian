# Planungskarte

`index.html` direkt im Browser öffnen, auch per `file://`. Kein Build, Server, WebGL, Materialasset oder Parallelprojekt erforderlich. Reproduzierbarer Einstieg: `index.html?seed=2`.

Enthält ausschließlich die Planung: 19 polygonale Regionen, Verbindungsbaum mit sechs Zusatzwegen, duales abwärts gerichtetes Flussnetz, gerundete Flüsse, zusammenhängend ausgedünnte Brücken, verträgliche Höhenoffsets und optionale Kartenkrümmung. Die 2D-Darstellung liest den Plan, ohne ihn zu verändern. Anzeigeoptionen erzeugen keinen neuen Plan.

Nicht enthalten: Terrainraster, Landschaftsformen, Felsen, Vegetation, Materialien, 3D und Spiel-/Profilanbindung. Die Planverbindungen sind kein Nachweis tatsächlicher Geländebegehbarkeit.

## Quellen und Prüfung

- `planning-core.js`: reine Planungslogik.
- `planning-view.js`: Canvas-Darstellung.
- `planning-app.js`: Seed und Bedienung.
- `check.mjs`: begrenzte Determinismus-, Verbindungs-, Fluss- und Zeichenaufrufprüfung; `node experiments/planning-map/check.mjs` vom Repository aus.

Extrahiert aus `aom-map-generator`, Commit `77cf9b91fab3e027b88102d5d3ff91708725d7fc`, `src/terrain-core.js` und `src/terrain-planning-view.js`. Die Morphologiephase und reine Terrainhilfen wurden weggelassen; die Planungsalgorithmen bleiben unverändert. Bewusst unabhängige Kopie, keine Laufzeitabhängigkeit und keine automatische Synchronisierung mit dem Terrainlabor. Keine zusätzliche Lizenz- oder Nutzungsfreigabe behauptet.
