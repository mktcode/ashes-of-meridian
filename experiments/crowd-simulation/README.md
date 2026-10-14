# Crowd Simulation · Marine

`index.html` direkt im Browser öffnen (WebGL 2). Keine Installation, kein Build,
Server oder externe Bibliothek nötig. Eigenständiges Experiment ohne Spielanbindung.

Ein prozeduraler Low-Poly-Marine aus starren, hierarchisch verbundenen Teilen:
Helm, Visier, Brust- und Schulterpanzer, Rucksack und gegliederte Gliedmaßen.
Auf einem 24 × 24 großen, hügeligen Spielfeld setzt Klick / Tippen ein gemeinsames Ziel
für alle dargestellten Marines, ohne Auswahl. Anfangs steht ein Marine auf dem Feld;
„Marine spawnen“ fügt jeweils einen weiteren hinzu. Neue Marines starten verteilt
um die Feldmitte und übernehmen ein bereits gesetztes Ziel. Der Zähler zeigt die
aktuelle Anzahl. Spawnen ist auch während der Pause möglich, Bewegung beginnt erst
beim Fortsetzen. Ein neuer Befehl ersetzt den bisherigen. Die Marines drehen sich
in Laufrichtung, laufen geradlinig zum Zielkreuz und wechseln dort weich in Idle. Tempo skaliert Bewegung
und Animation gemeinsam; Pause hält beides an. Ziehen dreht die Kamera, das Mausrad
zoomt. Klicks außerhalb des Spielfelds und Kameraziehen erteilen keinen Laufbefehl.

Hügel und Mulden sind ein festes, prozedurales Dreiecks-Höhenfeld. Darstellung,
Klickziele und Bodenhöhe verwenden dieselbe Oberfläche; bei verdeckten Hängen
trifft ein Klick die vordere Fläche. Das Zielkreuz folgt der Neigung, der Marine
bleibt aufrecht. Seine Füße werden einzeln auf Höhe und Neigung ihres Untergrunds
angepasst. Das Becken senkt sich bei Bedarf, Standfüße halten Bodenkontakt und
Schwungfüße werden angehoben. Die normale Atmung und Laufbewegung bleiben erhalten.
Die Fußanpassung ist für sanfte Hänge ausgelegt, nicht für Treppen oder Klettern;
es gibt keine persistente Fußverriegelung bei abrupten Richtungswechseln.

Noch keine Hindernisse, Wegfindung, Formation oder Kollisionssimulation.
Alle laufen zum exakt gleichen Punkt und können dort überlappen.
Das Modell ist Quellgeometrie, kein exportiertes GLB und kein skinned Mesh.

Gezielte Prüfungen aus dem Repository:
`node experiments/crowd-simulation/check.mjs` (Modell),
`node experiments/crowd-simulation/check-movement.mjs` (Bewegung und Zielprojektion),
`node experiments/crowd-simulation/check-terrain.mjs` (Gelände und Bodenausrichtung),
`node experiments/crowd-simulation/check-feet.mjs` (Fußanpassung und aufrechter Körper).
Bildwirkung, Animationsqualität und Bedienung bitte im Browser beurteilen.
