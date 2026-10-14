# 3D-Planungskarte

`index.html` direkt öffnen, auch per `file://`; kein Build oder Server. WebGL 2 erforderlich.
Reproduzierbarer Einstieg: `index.html?seed=2`.

Links-/Ein-Fingerziehen dreht; Mausrad oder Regler zoomt, „Zoom zurücksetzen“ zeigt die
Gesamtansicht. Kein Pan oder Neigen. Seed und Kartenkrümmung sind einstellbar.

Unabhängiges Waben-/Rampenexperiment ohne Terrain, Materialien oder Spiel-/Profilanbindung.
Geometrie und Höhenregeln stehen in `planning-core.js`, Darstellung in `planning-view.js`;
keine automatische Synchronisierung mit dem Terrainlabor.

Begrenzte lokale Prüfungen vom Repository aus:

```bash
node experiments/planning-map/check.mjs
node experiments/planning-map/check-rotation.mjs
```

Ursprünglich aus `aom-map-generator`, Commit `77cf9b91fab3e027b88102d5d3ff91708725d7fc`,
`src/terrain-core.js` und `src/terrain-planning-view.js` extrahiert, inzwischen eigenes Höhenmodell.
Keine zusätzliche Lizenz-/Nutzungsfreigabe und keine Spielterrain-Abnahme behauptet.
