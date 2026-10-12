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

## Flüsse und lokale Brücken auf dem dualen Netz

[Fluss-Prototyp öffnen](terrain-rivers/index.html). Separates, eigenständiges HTML-Experiment als Erweiterung der Topologieidee; der obige Ausgangsprototyp bleibt erhalten. Ebenfalls direkt per `file://` nutzbar, ohne Build, Server oder Installation; die 3D-Ansicht benötigt WebGL. Kamerabedienung und Spielraum-Markierung entsprechen dem Ausgangsprototyp. Eine zusätzliche Checkbox zeigt das duale Netz in der Planungskarte.

Wege verbinden ausschließlich benachbarte Regionen. Das duale Netz verbindet die Zentren ihrer Dreiecksflächen über die Mittelpunkte der Nachbarverbindungen und wird bis zum Kartenrand fortgeführt. Ein gerichteter Fluss beginnt am Rand, darf sich höchstens zweimal aufteilen und endet mit jedem Ast wieder am Rand. Jeder Teilabschnitt folgt einer streng fallenden gemeinsamen Wasserhöhe; Abzweigungen haben keine Höhensprünge.

Der Fluss ist ein Höhenanker für die gemeinsame Geländeplanung. Nahe Regionshöhen werden vor dem Geländeaufbau begrenzt; das Bett liegt 2,5 Höheneinheiten unter dem Ufer statt in einer tief eingeschnittenen Schlucht. Noise bleibt außerhalb der geschützten Spielräume und des Flusskorridors.

An tatsächlichen Weg-/Flusskreuzungen entstehen separate Brückendecks. Nur Fluss, Uferbereich und ein kleiner Puffer werden orange markiert; die übrigen Wegabschnitte bleiben normales Gelände. Wasser außerhalb der Decks ist gesperrt. Der Prototyp prüft die Rasterverbindung mit Brücken, die Dreiecksneigung der begehbaren Oberflächen gegen die unabhängige 45-%-Grenze und die fallende Wasserhöhe auf jedem Flussabschnitt.

Dies ist ein stilisiertes Verteilernetz, keine Wasserphysik oder Erosionssimulation. Durchflussmengen, Körperfreiraum, Navigation unter Brücken und RTS-Balance werden nicht geprüft. Der Spielgenerator, Spielprofile und reguläre Build bleiben davon unberührt.
