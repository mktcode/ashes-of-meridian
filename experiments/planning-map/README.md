# 3D-Planungskarte

`index.html` direkt im Browser öffnen, auch per `file://`. Kein Build, Server, Materialasset oder Parallelprojekt erforderlich. WebGL 2 ist nötig; es gibt keine 2D-Ansicht. Reproduzierbarer Einstieg: `index.html?seed=2`.

Die orthografische Kamera zeigt 19 zusammenhängende Waben als dreidimensionale Körper mit sichtbaren Seitenflächen. **Die ganze Wabe ist Spielfläche**, einschließlich ihrer Rampen. Keine zusätzlichen inneren Ovalflächen oder aufgemalten Wegkorridore. Horizontal mit linker Maustaste oder einem Finger ziehen dreht die Darstellung um die Hochachse. Kameraneigung, Maßstab und Bildmitte bleiben unverändert. Seeds und optionale Kartenkrümmung bleiben verfügbar.

## Waben und Höhen

`plan.cells` ist das einzige Flächenmodell. Die sechs Ecken jeder Wabe stammen aus dem regulären axialen Grid. Kartenkrümmung transportiert die gesamte Geometrie gemeinsam.

`offset` bestimmt die Höhe der ebenen Wabenplattform; nur an höhenwechselnden Verbindungen wird ihr Rand für eine Rampe eingeschnitten. `W1 +8.0` bedeutet acht Welteinheiten oberhalb einer gemeinsamen horizontalen Bezugsebene. Ein Sockel von 24 Einheiten macht auch negative Offsets als Körper darstellbar; er ändert weder die Werte noch die Höhenunterschiede. Horizontale und vertikale Geometrie verwenden denselben Maßstab. Beschriftungen sitzen am Wabenrand.

Ein unabhängiger Höhen-Seedstrom wählt einen eindeutigen Hochpunkt auf dem Außenring. Breitensuche auf der Wabennachbarschaft bestimmt `distanceToPeak`; die Höhe ist exakt `16 − distanceToPeak × 8`. Die fünf Terrassen haben Offsets −16, −8, 0, +8 und +16. Mehrere äußerste Waben dürfen die niedrigste Stufe teilen. Benachbarte Waben sind gleich hoch oder genau eine Stufe auseinander. `plan.heightSteps` benennt Stufenhöhe und Hochpunkt.

## Verbindungen und Rampen

`plan.edges` beschreibt das logische Verbindungsnetz direkt zwischen Waben, ohne eigene Flächengeometrie oder Wegmarkierungen. Jede Wabe außer dem Hochpunkt wählt seedabhängig einen Nachbarn genau eine Stufe höher. Diese 18 Verbindungen bilden einen zum Hochpunkt gerichteten Baum. Sechs zusätzliche Nachbarverbindungen ermöglichen Schleifen. Damit existiert **im tatsächlichen Rampennetz** von jeder Wabe, insbesondere von allen niedrigsten Waben, ein strikt steigender Weg zum Hochpunkt; nicht nur im abstrakten Grid.

Jede Verbindung zwischen unterschiedlich hohen Nachbarwaben bekommt eine Rampe ausschließlich in der höheren Wabe. Sie beginnt mittig an der gemeinsamen Kante exakt auf Höhe der unteren Plattform und erreicht auf halber Strecke zur höheren Wabenmitte die obere Plattformhöhe. Breite und Länge hängen nur von der Wabengeometrie ab. Gleich hohe verbundene Nachbarn brauchen keine Rampe.

Die Rampe steigt linear. Deckfläche und Kantenwand werden im Rampenkorridor tatsächlich ausgeschnitten; seitliche Wangen schließen den Körper. Die Schnitte überlappen nicht und lassen ein zusammenhängendes inneres Plateau frei. Rampen werden gemeinsam mit der Karte gekrümmt und beim Drehen nicht neu erzeugt. Außerhalb der Rampen bleiben Höhenstufen erhalten.

Kein Terrainraster, keine Landschaftsformen, Felsen, Vegetation, Materialien oder Spiel-/Profilanbindung. Keine Geländebegehbarkeitsfreigabe für das Spiel.

## Quellen und Prüfung

- `planning-core.js`: Waben, Höhen und aufsteigendes Verbindungsnetz.
- `planning-view.js`: Wabenkörper und Rampenausschnitte, WebGL-Tiefentest und 3D-Projektion. Drehungen verwenden das bestehende GPU-Mesh, ohne Neuplanung oder erneuten Upload.
- `planning-app.js`: Seed und Bedienung; nur Drehgesten, keine Zoom-/Neigungseingaben und kein permanenter Renderloop.
- `check.mjs`: begrenzte Determinismus-, Wabengeometrie-, Terrassen-, Rampennetz-, Ausschnitt- und Meshprüfung einschließlich aller zwölf möglichen Außenhochpunkte und Bildgrenzen bei Drehung; `node experiments/planning-map/check.mjs` vom Repository aus.
- `check-rotation.mjs`: Drehgesten und Pointer-Abbruch, mitdrehende Beschriftung sowie unveränderter Plan/GPU-Upload mit simuliertem DOM/WebGL; `node experiments/planning-map/check-rotation.mjs`.

Ursprünglich extrahiert aus `aom-map-generator`, Commit `77cf9b91fab3e027b88102d5d3ff91708725d7fc`, `src/terrain-core.js` und `src/terrain-planning-view.js`. Bewusst unabhängiges Experiment mit geändertem Höhenmodell, keine Laufzeitabhängigkeit und keine automatische Synchronisierung mit dem Terrainlabor. Keine zusätzliche Lizenz- oder Nutzungsfreigabe behauptet.
