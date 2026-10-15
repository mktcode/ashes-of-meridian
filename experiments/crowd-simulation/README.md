# Crowd Simulation · Marines

`index.html` direkt im Browser öffnen (WebGL 2). Kein Build, Server, CDN oder
Laufzeit-Import nötig. Eigenständiges Experiment ohne Anbindung an das Spiel.

Prozedurale Low-Poly-Marines stehen auf einer 128 × 128 großen, hügeligen Karte.
Gruppe A trägt Grün, B Orange. Die aktive Gruppe erhält Klick- / Tippziele, Spawns
und Haltbefehle, ohne einzelne Einheiten auszuwählen. Beide Gruppen behalten eigene
Befehle und Navigationsfelder. Die Spawnbuttons fügen einzelne Einheiten oder größere
Chargen auf freien, begehbaren Plätzen hinzu; bei Kapazitätsmangel bleibt die erfolgreiche
Teilmenge erhalten. Neue Marines übernehmen nur den Befehl ihrer Gruppe. Spawnen und
Befehle funktionieren auch während der Pause; sie lassen die Simulationszeit nicht laufen.

Die Szenen für Gegenverkehr im Felsengpass, kreuzende Wege, eine stehende Gruppe und
frontalen Gegnerkontakt setzen beide Gruppen neu auf. Die Anzahl gilt je Gruppe.
Die Gegner-Checkbox ändert die Beziehung, nicht die Gruppenfarben oder Laufziele.

Ziehen dreht / neigt die Kamera, das Mausrad zoomt. Mitteltaste oder
Umschalt + Ziehen verschiebt die Karte. „Crowd zentrieren“ passt Ausschnitt und Zoom
an die Einheiten an, „Kamera zurücksetzen“ zeigt wieder die Übersicht. Kameragesten
und Klicks außerhalb des Geländes erteilen keinen Laufbefehl. Tempo skaliert Bewegung
und Animation gemeinsam; Pause hält beides an.

## Bewegung und Ankunft

Ein gemeinsames Flow Field je Gruppenziel führt um die neun unveränderten Felsblöcke; steile, graue
Berghänge am Rand sind unbegehbar. Körpergröße, Navigationsauflösung und Hindernisorte
bleiben trotz größerer Karte gleich. Navigation prüft die tatsächlichen Geländedreiecke
und Körperfreiheit, nicht die geglätteten Beleuchtungsnormalen. Gesperrte oder nicht
erreichbare Ziele ändern den alten Befehl nicht.

Das statische Raster entsteht einmal. Dijkstra berechnet das Feld bei einem neuen
Gruppenziel, nicht pro Marine oder Frame; andere Gruppenfelder bleiben unverändert.
Räumliche Nachbarsuche, lokale
Geschwindigkeitsproben und gleichzeitige Bewegung vermeiden globale Paarvergleiche.
Am Ziel erhält jeder einen eigenen Standplatz mit Durchgängen. Die Fläche wächst nach
begehbarer Wegdistanz, auch hinter Hindernissen, statt auf freie Geraden zum Klickpunkt
beschränkt zu bleiben. Vordere Marines füllen die gegenüberliegende Seite, Nachzügler
die Ankunftsseite; seitliche Reihenfolge bleibt möglichst erhalten. Bereits geparkte
Marines und ihre Reservierungen bleiben fest. Auch verschiedene Gruppen dürfen keine
überlappenden Standplätze reservieren; die Abstände für Durchgänge bleiben erhalten.
Spawns und spätere Wiederaufnahmen prüfen die inzwischen belegten Plätze erneut.

Die Anfahrt zum eigenen Standplatz nutzt bei Bedarf umgekehrte Zweige desselben
Dijkstra-Wegebaums. Sie werden einmal pro Reservierung abgeleitet und mit geprüften
Geraden verdichtet, nicht durch eine weitere globale Suche pro Einheit berechnet.
Einheiten können sichtbare spätere Wegpunkte direkt anfahren; ihr Fortschritt zählt
auch dann, wenn der nötige Weg vom gemeinsamen Klickpunkt wegführt.

Recovery erkennt fehlenden Fortschritt auch bei Bewegung im Kreis. Legitime Umwege
zählen als Fortschritt; erfolglose Rettungsversuche löschen den Stillstand nicht.
Seltene, budgetierte lokale Suchfelder berücksichtigen geparkte beziehungsweise
kurz wartende Körper. Ihr feines Raster erhält enge reale Durchgänge. Unfertige
Suchen werden fortgesetzt, statt durch entfernte Ankünfte ständig neu anzufangen.
Der Cache hält höchstens acht Felder je Gruppe; das Suchbudget und die Aufrufrate
bleiben gemeinsam für die Welt begrenzt. Die Route führt zum tatsächlichen
Standplatz, nicht zurück zur Crowd-Mitte. Bewegliche Nachbarn können kurz nachgeben.

Ein unerreichbarer Standplatz darf durch einen freien, erreichbaren Platz derselben
Ankunftsreihe ersetzt werden; kein Reihentausch und kein Verdrängen geparkter Einheiten.
Ein erfolgloser Versuch bleibt bis zum nächsten budgetierten Versuch ruhig. Die Warteschlange
bedient länger nicht versuchte Marines zuerst, damit ein unmöglicher Platz andere nicht
verhungern lässt. Ein erneuter Laufbefehl kann das Warten ausdrücklich lösen, ohne das
unveränderte Hauptfeld neu zu bauen. Endgültiges Einparken
prüft auch den kleinen letzten Positionssprung auf Körperfreiheit. Die endliche Karte
begrenzt Spawn- und Zielkapazität; Leistung ersetzt keinen physischen Platz.

Dies ist **kein ORCA und keine Garantie für beliebige Stau- oder Blockadekonfigurationen**.
Gegenverkehr kann lange warten; eine abgeschlossene Ankunft ist kein Durchsatzversprechen.
Ein Halt mitten in einer bereits vermischten Crowd kann Durchgänge tatsächlich verschließen.
Die lokale Recovery findet nicht jede weiträumige Umfahrung. Dann muss eine Gruppe wieder
Platz machen; blockierte Marines sind nicht angekommen.

## Halten und Gegnerkontakt

Ein Haltbefehl verwirft den Gruppenlaufbefehl und gibt seine Reservierungen frei.
Die Marines halten ihre tatsächlichen Positionen und bleiben körperliche Hindernisse,
auch ohne Zielreservierung. Bewegte Einheiten weichen aus, statt sie wegzuschieben.

Feindliche Marines reagieren nur auf nahe, direkt erreichbare Gegner. Die Suche bleibt
räumlich lokal und liest einen gemeinsamen Tick-Snapshot. Kontakt stoppt die Bewegung,
dreht den Marine zum Gegner und blendet zu Idle; er gilt **nicht** als Ankunft am Laufziel.
Die frühere Standplatzreservierung wird freigegeben. Eine größere Freigabedistanz als
Eintrittsdistanz verhindert Flattern an der Kontaktgrenze. Bewusstes Halten löst keine
Stau-Recovery aus.

Ein neuer Laufbefehl vom Gegner weg ermöglicht Rückzug. Ein Befehl durch den Gegner
hindurch hebt den Kontaktabstand nicht auf. Endet der Kontakt oder werden die Gruppen
befreundet, dürfen Marines ihren noch aktiven Laufbefehl mit neu reservierten Plätzen
fortsetzen. Bereits angekommene Marines werden dabei nicht umgestellt. Falls kein Platz
verfügbar ist, warten Nachzügler, statt eine Ankunft vorzutäuschen.

Gruppenauftrag, individueller Bewegungszustand und Animationspose sind getrennt.
Es gibt noch keine Verfolgung, Waffen, Schaden, taktisches Flankieren oder Fahrzeugphysik.
Die Demonstration ist keine Kampfabnahme.

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
node experiments/crowd-simulation/check-occluded.mjs
node experiments/crowd-simulation/check-smoothing.mjs
node experiments/crowd-simulation/check-recovery.mjs
node experiments/crowd-simulation/check-picking.mjs
node experiments/crowd-simulation/check-instances.mjs
node experiments/crowd-simulation/check-scale.mjs
node experiments/crowd-simulation/check-contact.mjs
node experiments/crowd-simulation/check-browser.mjs
```

Der Skalierungscheck prüft tatsächliche Ankünfte bis zweitausend Einheiten samt
zentraler Verteilung hinter Hindernissen, Umleitung und spätem Spawn, Körperabstände,
Begehbarkeit, Reservierungen und feste geparkte Körper. Der Gruppencheck prüft tatsächliche
Ankünfte im Gegenverkehr bis tausend Marines, Kreuzungen, feste Haltpositionen, getrennte
Befehle, gemeinsame Zielbereiche, späte Spawns, Kontakt und Rückzug. Sein kurzer
Tausend-Marines-Kontaktlauf ist ausdrücklich ein Messfenster, kein Ankunftstest.
Der Browsercheck prüft konkrete `file://`-, Shader-, Instancing-, Paletten-,
Interpolations-, Fuß- und Gruppen-Bedienverträge. Er benötigt das Repository-Paket
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
