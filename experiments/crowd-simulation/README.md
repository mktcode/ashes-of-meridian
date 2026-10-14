# Crowd Simulation · Marine

`index.html` direkt im Browser öffnen (WebGL 2). Keine Installation, kein Build,
Server oder externe Bibliothek nötig. Eigenständiges Experiment ohne Spielanbindung.

Ein prozeduraler Low-Poly-Marine aus starren, hierarchisch verbundenen Teilen:
Helm, Visier, Brust- und Schulterpanzer, Rucksack und gegliederte Gliedmaßen.
Auf einem 24 × 24 großen, hügeligen Spielfeld setzt Klick / Tippen ein gemeinsames Ziel
für alle dargestellten Marines, ohne Auswahl (aktuell ein Marine). Ein neuer
Befehl ersetzt den bisherigen. Die Marines drehen sich in Laufrichtung, laufen
geradlinig zum Zielkreuz und wechseln dort weich in Idle. Tempo skaliert Bewegung
und Animation gemeinsam; Pause hält beides an. Ziehen dreht die Kamera, das Mausrad
zoomt. Klicks außerhalb des Spielfelds und Kameraziehen erteilen keinen Laufbefehl.

Hügel und Mulden sind ein festes, prozedurales Dreiecks-Höhenfeld. Darstellung,
Klickziele und Bodenhöhe verwenden dieselbe Oberfläche. Marines und Zielkreuz
folgen Höhe und Neigung; bei verdeckten Hängen trifft ein Klick die vordere Fläche.
Dies ist eine einfache Geländeausrichtung, noch keine individuelle Fußanpassung.

Noch keine Hindernisse, Wegfindung, Formation oder Kollisionssimulation.
Das Modell ist Quellgeometrie, kein exportiertes GLB und kein skinned Mesh.

Gezielte Prüfungen aus dem Repository:
`node experiments/crowd-simulation/check.mjs` (Modell),
`node experiments/crowd-simulation/check-movement.mjs` (Bewegung und Zielprojektion),
`node experiments/crowd-simulation/check-terrain.mjs` (Gelände und Bodenausrichtung).
Bildwirkung, Animationsqualität und Bedienung bitte im Browser beurteilen.
