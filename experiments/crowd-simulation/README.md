# Crowd Simulation · Marines

`index.html` direkt im Browser öffnen (WebGL 2). Kein Build, Server, CDN oder
Laufzeit-Import nötig. Eigenständiges Experiment ohne Anbindung an das Spiel.

Ein prozeduraler Low-Poly-Marine aus hierarchisch verbundenen Teilen steht auf einer
128 × 128 großen, hügeligen Karte. Klick / Tippen setzt ein gemeinsames Ziel für alle
Marines, ohne Auswahl. Die Spawnbuttons fügen einzelne Einheiten oder größere Chargen
auf freien, begehbaren Plätzen hinzu; bei Kapazitätsmangel bleibt die erfolgreiche
Teilmenge erhalten. Neue Marines übernehmen den bestehenden Befehl. Spawnen und
Befehle funktionieren auch während der Pause; ein neuer Befehl ersetzt den alten.

Ziehen dreht / neigt die Kamera, das Mausrad zoomt. Mitteltaste oder
Umschalt + Ziehen verschiebt die Karte. „Crowd zentrieren“ passt Ausschnitt und Zoom
an die Einheiten an, „Kamera zurücksetzen“ zeigt wieder die Übersicht. Kameragesten
und Klicks außerhalb des Geländes erteilen keinen Laufbefehl. Tempo skaliert Bewegung
und Animation gemeinsam; Pause hält beides an.

## Bewegung und Ankunft

Ein gemeinsames Flow Field führt um die neun unveränderten Felsblöcke; steile, graue
Berghänge am Rand sind unbegehbar. Körpergröße, Navigationsauflösung und Hindernisorte
bleiben trotz größerer Karte gleich. Navigation prüft die tatsächlichen Geländedreiecke
und Körperfreiheit, nicht die geglätteten Beleuchtungsnormalen. Gesperrte oder nicht
erreichbare Ziele ändern den alten Befehl nicht.

Das statische Raster entsteht einmal. Dijkstra berechnet das gemeinsame Feld bei
einem neuen Ziel, nicht pro Marine oder Frame. Räumliche Nachbarsuche, lokale
Geschwindigkeitsproben und gleichzeitige Bewegung vermeiden globale Paarvergleiche.
Am Ziel erhält jeder einen eigenen Standplatz mit Durchgängen. Vordere Marines füllen
die gegenüberliegende Seite, Nachzügler die Ankunftsseite; seitliche Reihenfolge bleibt
möglichst erhalten. Bereits geparkte Marines und ihre Reservierungen bleiben fest.

Recovery erkennt fehlenden Fortschritt auch bei Bewegung im Kreis. Legitime Umwege
zählen als Fortschritt; erfolglose Rettungsversuche löschen den Stillstand nicht.
Seltene, budgetierte lokale Suchfelder berücksichtigen geparkte beziehungsweise
kurz wartende Körper. Ihr feines Raster erhält enge reale Durchgänge. Unfertige
Suchen werden fortgesetzt, statt durch entfernte Ankünfte ständig neu anzufangen;
Feldcache und Nachbarsuche bleiben begrenzt. Die Route führt zum tatsächlichen
Standplatz, nicht zurück zur Crowd-Mitte. Bewegliche Nachbarn können kurz nachgeben.

Ein unerreichbarer Standplatz darf durch einen freien, erreichbaren Platz derselben
Ankunftsreihe ersetzt werden; kein Reihentausch und kein Verdrängen geparkter Einheiten.
Ein erfolgloser Versuch wartet ruhig und versucht später erneut. Endgültiges Einparken
prüft auch den kleinen letzten Positionssprung auf Körperfreiheit. Die endliche Karte
begrenzt Spawn- und Zielkapazität; Leistung ersetzt keinen physischen Platz.

Dies ist **kein ORCA und keine Garantie für beliebige Stau- oder Blockadekonfigurationen**.
Die Bedienung bleibt bewusst ein gemeinsamer Befehl; Kampfregeln, Gegner-KI und mehrere
unabhängig befehligte Formationen sind noch nicht implementiert.

## Darstellung

Autoritative Bewegung, Navigation und Rig-Darstellung sind von WebGL getrennt.
Position, Blickrichtung und Animationszeit werden gemeinsam zwischen festen Ticks
interpoliert. Kurze Lücken beenden ein sicheres Ausweichmanöver nicht sofort; die
Blickrichtung dreht gleitend, ohne individuellen Positionsnachlauf.

Wiederverwendete Transformpuffer und WebGL-Instancing zeichnen Gelände und Boxmodell
mit zwei Draw Calls. Außerhalb des Ausschnitts werden keine Marine-Posen gesampelt;
unveränderte Pausenbilder benötigen keinen neuen Rig-Aufbau oder Bufferupload.
Sichtbare Marines behalten vollständige Fuß-IK, auch bei großen Crowds. Das Modell
bleibt Quellgeometrie, kein GLB und kein skinned Mesh. Ein extern zusammengesetzter
Pose-Datensatz kann an die Instanzierung übergeben werden, ohne Bewegungszustand zu
verändern; spätere Kampfanimationen benötigen nicht wieder Einzel-Draws pro Körperteil.

Darstellung, Geländehöhe und Picking verwenden dieselbe Oberfläche. Picking traversiert
den Geländeraster entlang des Strahls und wählt das vorderste Dreieck, auch nach Pan / Zoom.
Das Zielkreuz folgt der Neigung; Körper bleiben aufrecht, Füße passen sich einzeln an
Höhe und Neigung an, das Becken senkt sich bei Bedarf. Keine Treppen, kein Klettern und
keine persistente Fußverriegelung bei abrupten Richtungswechseln.

## Technische Prüfung und Messung

Gezielt aus dem Repository ausführen:

```sh
node experiments/crowd-simulation/check.mjs
node experiments/crowd-simulation/check-feet.mjs
node experiments/crowd-simulation/check-terrain.mjs
node experiments/crowd-simulation/check-navigation.mjs
node experiments/crowd-simulation/check-movement.mjs
node experiments/crowd-simulation/check-arrival.mjs
node experiments/crowd-simulation/check-smoothing.mjs
node experiments/crowd-simulation/check-recovery.mjs
node experiments/crowd-simulation/check-picking.mjs
node experiments/crowd-simulation/check-instances.mjs
node experiments/crowd-simulation/check-scale.mjs
node experiments/crowd-simulation/check-browser.mjs
```

Der Skalierungscheck prüft tatsächliche Ankünfte bis zweitausend Einheiten samt
Umleitung und spätem Spawn, Körperabstände, Begehbarkeit, Reservierungen und feste
geparkte Körper. Der Browsercheck prüft konkrete `file://`-, Shader-, Instancing-,
Interpolations-, Fuß- und Bedienverträge. Er benötigt das Repository-Paket
`playwright-core` und ein lokal installiertes Chromium; `CHROMIUM_PATH` überschreibt
den Standardpfad. Keine Browserdownloads oder gelockerte Datei-Sicherheit.

```sh
node experiments/crowd-simulation/measure.mjs
node experiments/crowd-simulation/measure-render.mjs
```

Optionale ganzzahlige Crowdgrößen als Argumente. Die Messskripte geben JSON-Zeilen aus
und nennen angeforderte / tatsächliche Mengen, Befehlserfolg und getrennte CPU-Kosten.
Der Rendervergleich hält die Simulation an, erzwingt aber vollständigen Poseaufbau für
sichtbare Einheiten; unveränderte Pausenbilder werden separat gemessen. Die UI zeigt
CPU-Mittelwerte für Simulation und Render-Submission, nicht GPU-Ausführungszeit.

**Keine FPS-, Mobilgeräte- oder universelle Deadlock-Abnahme.** Insbesondere
Software-WebGL ist kein Zielgeräte-Performancebeleg. Bildwirkung, Animationen und
Bedienung bleiben menschlich im Browser zu beurteilen; Kampfverhalten ist eigene Arbeit.
