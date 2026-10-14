# Natürliches Terrain – Höhenfeld-Skizze

`index.html` direkt öffnen, auch per `file://`; kein Build, Server oder CDN.
WebGL 2 erforderlich. Einstieg: `index.html?seed=12`.

Eigenständiges Experiment; die Planungskarte und das Spiel bleiben unverändert.
Ein mathematisches Höhenfeld verbindet eine untere und eine obere Ebene.
Domain-Warping, überlagerte Noise-Frequenzen, Höhenzüge und eingeschnittene Rinnen
formen den Zwischenbereich ohne einzeln ausgestanzte Plattformen.
Shader liefern zurückhaltende Beleuchtung, Höhenlinien und Wege-Markierungen.
Keine Detailgeometrie, Wegabflachung, maximale Neigung oder Spielbarkeitsprüfung.
„Dynamisch“ bezeichnet die Landschaftsform, nicht eine laufende Terrainanimation.

Ziehen dreht/neigt, Rechtsziehen oder Shift+Ziehen verschiebt, Mausrad zoomt.
Touch: ein Finger dreht/neigt; zwei Finger verschieben, drehen und zoomen.
Seed, Reliefstärke, Höhenlinien und Wege-Markierungen sind einstellbar.
