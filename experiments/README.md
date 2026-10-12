# Eigenständige Experimente

Explorative Prototypen, getrennt von Spielcode, Profilen und regulärem Build. Ein Experiment ist keine produktive Implementierung und kein Nachweis für die Spielbarkeit des bestehenden Generators. HTML-Einstiege direkt per `file://` öffnen; notwendige Laufzeitvoraussetzungen stehen beim jeweiligen Experiment. Keine CDN-Abhängigkeiten oder gemeinsam beschreibbaren Buildverzeichnisse.

## Topologiegeleitetes Terrain-Layout

[Prototyp öffnen](terrain-layout/index.html). Eine einzelne HTML-Datei mit eingebettetem JavaScript und CSS; kein Build, Server oder Installation erforderlich. Die 3D-Ansicht benötigt WebGL.

- **Neues zufälliges Layout:** sechseckige Karte, 19 unregelmäßige polygonale Regionen, verbindender Baum und sechs zusätzliche Wege.
- **Planungskarte:** Regionen, Verbindungen, Regionsnummern und Höhenversätze.
- **3D-Ansicht:** Ziehen dreht/neigt, Mausrad oder Regler zoomt, Doppelklick setzt die Kamera zurück. Die Checkbox markiert geschützte Spielräume. Das Gelände wird einmal pro Layout zur GPU übertragen; Kamerabewegungen benötigen keine erneute Generierung.

### Idee und Grenzen

Zuerst Spielräume und Verbindungen planen, anschließend kompatible zufällige Regionshöhen wählen und die Landschaft darum aufbauen. Polygonabstände begrenzen die Höhenversätze; ein gemeinsames distanzbasiertes Höhenfeld gibt auch Wegkreuzungen eine eindeutige Höhe. Landschafts-Noise bleibt außerhalb der geschützten Flächen und ihrer Sicherheitszone.

Die **fiktive Steigungsgrenze von 45 %** ist unabhängig vom Spiel. Der Prototyp prüft die Neigung der triangulierten Oberfläche entlang der Spielräume und zeigt deren Rasterverbindung an. Diese Prüfungen ersetzen weder Körperfreiraum, Hindernisse, Ressourcen-/Gebäudeplatzierung, KI-Abnahme noch RTS-Balance. Außerhalb der Spielräume dürfen steile Hänge entstehen. Das Experiment verwendet keine Spielskripte, Spielstände oder Profile und verändert den produktiven Terrain-Generator nicht.

Der angezeigte Seed dient der Diagnose; gleiche Seeds erzeugen bei unverändertem Rezept dasselbe Layout. Der Prototyp bietet noch keine Seed-Eingabe oder Speicherung.
