# 3D-Planungskarte

`index.html` direkt im Browser öffnen, auch per `file://`. Kein Build, Server, Materialasset oder Parallelprojekt erforderlich. WebGL 2 ist nötig; es gibt keine 2D-Ansicht. Reproduzierbarer Einstieg: `index.html?seed=2`.

Die orthografische Kamera zeigt 19 zusammenhängende Grid-Waben als dreidimensionale Körper mit sichtbaren Seitenflächen. Horizontal mit linker Maustaste oder einem Finger ziehen dreht die Darstellung um die Hochachse. Kameraneigung, Maßstab und Bildmitte bleiben dabei unverändert. Kein Verschieben oder Zoomen; vertikales Ziehen hat keine Wirkung. Seeds und die bisherigen Karten-/Flusskrümmungsoptionen bleiben verfügbar.

## Höhen gehören den Waben

Jede Wabe besitzt `plan.cells[i].offset`, unabhängig von der kleineren grünen Spielfläche. Ihre sechs Ecken stammen aus dem regulären axialen Grid, nicht aus den zufällig leicht versetzten Spielflächenzentren. Kartenkrümmung transportiert anschließend Waben und Planmarkierungen gemeinsam.

Der Offset verschiebt die **gesamte ebene Wabenoberseite**. `W1 +3.0` bedeutet drei Welteinheiten oberhalb einer gemeinsamen horizontalen Bezugsebene. Es gibt kein örtliches Flussdatum mehr für diese Zuordnung. Ein Sockel von 24 Einheiten macht auch negative Offsets als Körper darstellbar; er ändert weder die Werte noch die Höhenunterschiede. Horizontale und vertikale Geometrie verwenden denselben Maßstab. Die Beschriftung sitzt am Wabenrand, nicht auf der grünen Spielfläche. Grüne Spielflächen besitzen keinen eigenen Offset und liegen auf ihrer Wabe.

Die bisherigen Höhenbegrenzungen anhand grüner Polygonabstände und eines Flussankers entfallen bewusst: Der unabhängige Höhen-Seedstrom liefert nun Wabenoffsets zwischen −16 und +16. Wege, Flüsse und Brücken sind auf die jeweiligen Wabenoberseiten geklippte Planmarkierungen. An Zellgrenzen entstehen Höhenstufen, **noch keine Rampen oder physikalisch abwärts fließende Wasseroberflächen**. Das bestehende Flussnetz bleibt topologisch gerichtet; sein ursprüngliches Höhenprofil ist nicht die neue sichtbare Zellhöhe.

Die 19 Waben bilden den Grid-Ausschnitt; außerhalb davon liegende Teile der bisherigen hexagonalen Planungsgrenze/Flusswege werden nicht dargestellt. Kein Terrainraster, keine Landschaftsformen, Felsen, Vegetation, Materialien oder Spiel-/Profilanbindung. Keine Geländebegehbarkeitsfreigabe.

## Quellen und Prüfung

- `planning-core.js`: Planungslogik und Waben mit eigenem Offset.
- `planning-view.js`: Wabenkörper, geklippte Planmarkierungen, WebGL-Tiefentest und 3D-Projektion mit ausschließlich horizontaler Drehung. Drehungen verwenden das bestehende GPU-Mesh, ohne Neuplanung oder erneuten Upload.
- `planning-app.js`: Seed und Bedienung; nur Drehgesten, keine Zoom-/Neigungseingaben und kein permanenter Renderloop.
- `check.mjs`: begrenzte Determinismus-, Wabengeometrie-, Offset-, Topologie- und 3D-Meshprüfung einschließlich Bildgrenzen bei Drehung; `node experiments/planning-map/check.mjs` vom Repository aus.
- `check-rotation.mjs`: Drehgesten und Pointer-Abbruch, mitdrehende Beschriftung sowie unveränderter Plan/GPU-Upload mit simuliertem DOM/WebGL; `node experiments/planning-map/check-rotation.mjs`. Die Flussprofilprüfung betrifft nur das ursprüngliche Planungsprofil, nicht die abgestufte Darstellung.

Ursprünglich extrahiert aus `aom-map-generator`, Commit `77cf9b91fab3e027b88102d5d3ff91708725d7fc`, `src/terrain-core.js` und `src/terrain-planning-view.js`. Bewusst unabhängiges Experiment mit geändertem Höhenmodell, keine Laufzeitabhängigkeit und keine automatische Synchronisierung mit dem Terrainlabor. Keine zusätzliche Lizenz- oder Nutzungsfreigabe behauptet.
