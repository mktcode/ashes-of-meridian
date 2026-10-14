# Crowd Simulation · Marines

`index.html` direkt im Browser öffnen (WebGL 2). Keine Installation, kein Build,
Server oder externe Bibliothek nötig. Eigenständiges Experiment ohne Spielanbindung.

Ein prozeduraler Low-Poly-Marine aus starren, hierarchisch verbundenen Teilen:
Helm, Visier, Brust- und Schulterpanzer, Rucksack und gegliederte Gliedmaßen.
Auf einem hügeligen Spielfeld setzt Klick / Tippen ein gemeinsames Ziel für alle
Marines, ohne Auswahl. „Marine spawnen“ fügt jeweils einen weiteren auf einem freien,
begehbaren Platz hinzu; der Zähler zeigt die Anzahl. Neue Marines übernehmen auch ein
bereits gesetztes Ziel. Spawnen und Befehle sind während der Pause möglich, Bewegung
beginnt erst beim Fortsetzen. Ein neuer Befehl ersetzt den bisherigen.

Ein gemeinsames Flow Field führt die Crowd um den Felsblock. Die steilen, grau
gefärbten Berghänge an allen Kartenrändern sind unbegehbar. Navigation verwendet die
Neigung der tatsächlichen Geländedreiecke und berücksichtigt den Körperradius,
nicht nur die geglätteten Beleuchtungsnormalen. Klicks auf gesperrte Flächen, den
sichtbaren Felsblock oder nicht erreichbare Ziele ändern den bestehenden Befehl nicht.

Das statische Navigationsraster entsteht einmal; Dijkstra berechnet das gemeinsame
Flow Field bei einem neuen Ziel, nicht pro Marine oder Frame. Bewegliche Marines
werden nicht ins Feld geschrieben. Lokale Geschwindigkeitsproben und kurze
Überlappungskorrekturen behandeln Nachbarn aus einem räumlichen Raster. Am Ziel
reserviert jeder einen eigenen Standplatz mit freien Durchgängen, auch neben Wänden
und Hängen. Stockt die Ankunft, können noch laufende Marines ihre Reservierungen
tauschen; bereits besetzte Standplätze bleiben erhalten. Dies ist einfache lokale
Crowd-Steuerung, kein ORCA und keine zugesicherte Lösung beliebiger dichter Staus.
Die endliche Karte begrenzt Spawn- und Standplätze; bei Platzmangel meldet die UI dies.

Tempo skaliert Bewegung und Animation gemeinsam; Pause hält beides an. Ziehen dreht
die Kamera, das Mausrad zoomt. Kameraziehen und Klicks außerhalb des Geländes erteilen
keinen Laufbefehl. Darstellung, Geländehöhe und Picking verwenden dieselbe Oberfläche.
Das Zielkreuz folgt der Neigung, die Marines bleiben aufrecht. Füße werden einzeln
auf Höhe und Neigung ihres Untergrunds angepasst, das Becken senkt sich bei Bedarf.
Standfüße halten Bodenkontakt, Schwungfüße werden angehoben. Keine Treppen, kein
Klettern und keine persistente Fußverriegelung bei abrupten Richtungswechseln.

Das Modell ist Quellgeometrie, kein exportiertes GLB und kein skinned Mesh.
Gezielte Prüfungen aus dem Repository:
`node experiments/crowd-simulation/check.mjs` (Modell),
`node experiments/crowd-simulation/check-movement.mjs` (Crowd-Bewegung und Bedienverträge),
`node experiments/crowd-simulation/check-navigation.mjs` (Flow Field und Begehbarkeit),
`node experiments/crowd-simulation/check-terrain.mjs` (Dreiecksoberfläche und Picking),
`node experiments/crowd-simulation/check-feet.mjs` (Fußanpassung und aufrechter Körper).
Bildwirkung, Animationsqualität und Bedienung bitte im Browser beurteilen;
technische Checks sind kein Zielgeräte-Performancebeleg.
