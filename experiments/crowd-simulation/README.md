# Crowd Simulation · Marine

`index.html` direkt im Browser öffnen (WebGL 2). Keine Installation, kein Build,
Server oder externe Bibliothek nötig. Eigenständiges Experiment ohne Spielanbindung.

Ein prozeduraler Low-Poly-Marine aus starren, hierarchisch verbundenen Teilen:
Helm, Visier, Brust- und Schulterpanzer, Rucksack und gegliederte Gliedmaßen.
Idle zeigt Atmung und leichte Kopfbewegung; Run läuft auf der Stelle mit
gegenläufigen Armen/Beinen und gebeugten Knien. Zustände werden weich überblendet.
Animation, Tempo und Pause lassen sich einstellen. Ziehen dreht die Kamera,
das Mausrad zoomt.

Dies ist nur der erste Modellbaustein, noch keine Crowd- oder Kollisionssimulation.
Das Modell ist Quellgeometrie, kein exportiertes GLB und kein skinned Mesh.

Gezielte Modellprüfung: `node experiments/crowd-simulation/check.mjs` aus dem
Repository. Bildwirkung und Animationsqualität bitte im Browser beurteilen.
