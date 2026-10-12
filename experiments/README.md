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

[Fluss-Prototyp öffnen](terrain-rivers/index.html). Separates, eigenständiges HTML-Experiment als Erweiterung der Topologieidee; der obige Ausgangsprototyp bleibt erhalten. Ebenfalls direkt per `file://` nutzbar, ohne Build, Server oder Installation; die 3D-Ansicht benötigt WebGL. Kamerabedienung und Spielraum-Markierung entsprechen dem Ausgangsprototyp. Eine zusätzliche Checkbox zeigt Basis- und duales Netz in der Planungskarte. „Geschwungene Verbindungen“ vergleicht verformte und gerade Kanten mit demselben Seed. „Flussrouten abrunden“ vergleicht gerundete und eckige Flussrouten unabhängig davon. Ein Startseed lässt sich über die URL angeben, etwa `terrain-rivers/index.html?seed=2`; danach erzeugt der Layout-Button wieder zufällige Seeds.

Wege verbinden im Basisnetz ausschließlich benachbarte Regionen. Das duale Netz verbindet die Zentren ihrer Dreiecksflächen über die Mittelpunkte der Nachbarverbindungen und wird bis zum Kartenrand fortgeführt. Ein gerichteter Fluss beginnt am Rand, darf sich höchstens zweimal aufteilen und endet mit jedem Ast wieder am Rand. Jeder Teilabschnitt folgt einer streng fallenden gemeinsamen Wasserhöhe; Abzweigungen haben keine Höhensprünge.

Zwischen Netzplanung und Höhenplanung werden zusammenhängende Flussrouten durch kubische Bézier-Kurven ersetzt. Normale duale Knoten sind keine festen Kurvenpunkte mehr; erhalten bleiben Wegkreuzungen, gemeinsame Verzweigungen und Randanschlüsse. Gemeinsame Tangenten glätten die Übergänge. Geordnete Projektionen der Kontrollpunkte sichern den Abwärtsfluss auch zwischen den Kurvenstützpunkten. Erst die fein abgetastete Kurve bestimmt Abstände, Höhenanker, Bett, Ufer, Navigation und die lokalen Brücken; sie ist keine nachträgliche Renderverzierung.

Das Wasser besitzt ein eigenes, am Kartenrand abgeschnittenes Kurvenband statt blau eingefärbter Geländedreiecke. Dessen Rand entspricht der Wasserlinie des flachen Bettprofils. Das Geländemesh wird nur in Flussnähe verfeinert; gemeinsame Kanten werden auch in Nachbardreiecken unterteilt, damit keine T-Verbindungen entstehen. Ein räumlicher Suchbaum begrenzt Abstandssuchen auf relevante Kurvenabschnitte.

Das regelmäßige Netz ist nur die topologische Basis. Wege, Flüsse und Randkanten werden in kurze Teilsegmente unterteilt und durch ein gemeinsames, seedabhängiges Verschiebungsfeld weich verformt. Kreuzungen bleiben gemeinsame Ankerpunkte; Regionenumrisse, Wegbreiten, lokale Brückendecks und das Geländemesh folgen derselben Abbildung. Das Netz ist nur auf Wunsch als Diagnose sichtbar.

Die Ableitung des Verschiebungsfelds ist global auf weniger als 0,32 begrenzt. Dadurch ist die Abbildung invertierbar, erzeugt keine Faltungen und erhält die Beziehungen des Basisnetzes; Längen und Breiten können sich dabei um bis zu 32 % verändern. Wasserhöhen werden mit den Kurven transportiert, nicht aus der neuen horizontalen Fließrichtung abgeleitet. Begehbarkeitsabfragen verwenden die inverse Abbildung, und die Steigungsprüfung misst die tatsächlich verformten Geländedreiecke. Planung und Höhenfeld bleiben in Referenzkoordinaten konsistent; die Darstellung ist keine unabhängig verzerrte Vorschau.

Der Fluss ist ein Höhenanker für die gemeinsame Geländeplanung. Nahe Regionshöhen werden vor dem Geländeaufbau begrenzt; das Bett liegt 2,5 Höheneinheiten unter dem Ufer statt in einer tief eingeschnittenen Schlucht. Noise bleibt außerhalb der geschützten Spielräume und des Flusskorridors.

An tatsächlichen Weg-/Flusskreuzungen entstehen separate Brückendecks. Nur Fluss, Uferbereich und ein kleiner Puffer werden orange markiert; die übrigen Wegabschnitte bleiben normales Gelände. Wasser außerhalb der Decks ist gesperrt. Der Prototyp prüft die Rasterverbindung mit Brücken, die Dreiecksneigung der begehbaren Oberflächen gegen die unabhängige 45-%-Grenze und die fallende Wasserhöhe auf jedem Flussabschnitt.

Die Darstellung ist eine vorläufige Vorschau: Steigungsüberschreitungen werden ausdrücklich angezeigt, verhindern aber nicht die Darstellung. Insbesondere lokale Übergangsdreiecke der verfeinerten Oberfläche können den Grenzwert überschreiten. Die CPU-Prüfung bleibt streng und weist solche Fälle zurück; eine sichtbare Landschaft ist keine Spielbarkeitsfreigabe.

Dies ist ein stilisiertes Verteilernetz, keine Wasserphysik oder Erosionssimulation. Durchflussmengen, Körperfreiraum, Navigation unter Brücken und RTS-Balance werden nicht geprüft. Der Spielgenerator, Spielprofile und reguläre Build bleiben davon unberührt.

Optionale CPU-Prüfung ohne Installation: `node experiments/terrain-rivers/check.mjs` im Repository-Root. Sie erzeugt vollständige Meshes und Raster, ist kein schneller Smoke-Test und sollte für die visuelle Vorschau nicht vorausgesetzt werden. Sie prüft gekrümmte Kanten, gemeinsame Kreuzungsanker, lokale Brücken, Randanschlüsse, inverse Abbildung, fallende Wasserhöhen, Rasterverbindung und tatsächliche Dreiecksneigung an vier festen Seeds. Sie ersetzt weder WebGL-/Bedienungsprüfung noch visuelle Abnahme.
