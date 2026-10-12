# Neue Map-Generierung

[Map-Generierung öffnen](map-generation/index.html). Der eigenständige Prototyp unter `experiments/map-generation/` ist die Grundlage für die neue Map-Generierung. Er ist vom Spielcode, Spielprofilen und regulären Build getrennt und ersetzt den produktiven Generator noch nicht. Die einzelne HTML-Datei enthält JavaScript und CSS und lässt sich direkt per `file://` öffnen: kein Build, Server, Installation oder CDN erforderlich. Die 3D-Ansicht benötigt WebGL.

## Bedienung

- **Neues Layout:** sechseckige Karte mit 19 unregelmäßigen polygonalen Regionen, verbindenden Wegen, gerundeten Flüssen und lokalen Brücken.
- **Planungskarte:** Regionen, Verbindungen, Regionsnummern und Höhenversätze; „Netze“ zeigt zusätzlich Basis- und duales Netz.
- **3D-Ansicht:** Ziehen dreht/neigt, Mausrad oder Regler zoomt, Doppelklick setzt die Kamera zurück. „Spielräume“ markiert geschützte Flächen. Das Gelände wird einmal pro Layout zur GPU übertragen; Kamerabewegungen benötigen keine erneute Generierung.

„Verformung“ vergleicht verformte und gerade Kanten mit demselben Seed. „Runde Flüsse“ vergleicht gerundete und eckige Flussrouten unabhängig davon. Ein Startseed lässt sich über die URL angeben, etwa `map-generation/index.html?seed=2`; danach erzeugt der Layout-Button wieder zufällige Seeds. Gleiche Seeds ergeben bei unverändertem Rezept dasselbe Layout; es gibt keine Speicherung.

Die 3D-Karte füllt das Browserfenster unter einer schmalen Steuer- und Statusleiste. Die einklappbare Planungskarte liegt klein unten links; Erklärungen, Legende und Bedienhinweise stehen im Info-Modal (Schließen per Button, Escape oder Hintergrundklick). Auf schmalen Bildschirmen ist die Steuerleiste horizontal scrollbar. Der Vollbild-Button blendet zusätzlich die Browserleisten aus. Größenänderungen zeichnen nur die vorhandenen GPU-Daten mit korrigiertem Seitenverhältnis neu; sie erzeugen kein neues Gelände. Die Zeichenauflösung ist auf vier Millionen Pixel und höchstens zweifache Pixeldichte begrenzt.

## Topologie vor Gelände

Zuerst Spielräume, Wege, Flussrouten und Kreuzungen planen, anschließend kompatible Regionshöhen wählen und die Landschaft darum aufbauen. Polygonabstände begrenzen die Höhenversätze; ein gemeinsames distanzbasiertes Höhenfeld gibt auch Wegkreuzungen eine eindeutige Höhe. Noise bleibt außerhalb geschützter Flächen und ihrer Sicherheitszone.

Wege verbinden im Basisnetz ausschließlich benachbarte Regionen. Das duale Netz verbindet die Zentren ihrer Dreiecksflächen über die Mittelpunkte der Nachbarverbindungen und wird bis zum Kartenrand fortgeführt. Ein gerichteter Fluss beginnt am Rand, darf sich höchstens zweimal aufteilen und endet mit jedem Ast wieder am Rand. Jeder Teilabschnitt folgt einer streng fallenden gemeinsamen Wasserhöhe; Abzweigungen haben keine Höhensprünge.

Zwischen Netzplanung und Höhenplanung werden zusammenhängende Flussrouten durch kubische Bézier-Kurven ersetzt. Normale duale Knoten sind keine festen Kurvenpunkte mehr; erhalten bleiben Wegkreuzungen, gemeinsame Verzweigungen und Randanschlüsse. Gemeinsame Tangenten glätten die Übergänge. Geordnete Projektionen der Kontrollpunkte sichern den Abwärtsfluss auch zwischen den Kurvenstützpunkten. Erst die fein abgetastete Kurve bestimmt Abstände, Höhenanker, Bett, Ufer, Navigation und die lokalen Brücken; sie ist keine nachträgliche Renderverzierung.

Das Wasser besitzt ein eigenes, am Kartenrand abgeschnittenes Kurvenband statt blau eingefärbter Geländedreiecke. Dessen Rand entspricht der Wasserlinie des flachen Bettprofils. Das Geländemesh wird nur in Flussnähe verfeinert; gemeinsame Kanten werden auch in Nachbardreiecken unterteilt, damit keine T-Verbindungen entstehen. Ein räumlicher Suchbaum begrenzt Abstandssuchen auf relevante Kurvenabschnitte.

Das regelmäßige Netz ist nur die topologische Basis. Wege, Flüsse und Randkanten werden in kurze Teilsegmente unterteilt und durch ein gemeinsames, seedabhängiges Verschiebungsfeld weich verformt. Kreuzungen bleiben gemeinsame Ankerpunkte; Regionenumrisse, Wegbreiten, lokale Brückendecks und das Geländemesh folgen derselben Abbildung. Das Netz ist nur auf Wunsch als Diagnose sichtbar.

Die Ableitung des Verschiebungsfelds ist global auf weniger als 0,32 begrenzt. Dadurch ist die Abbildung invertierbar, erzeugt keine Faltungen und erhält die Beziehungen des Basisnetzes; Längen und Breiten können sich dabei um bis zu 32 % verändern. Wasserhöhen werden mit den Kurven transportiert, nicht aus der neuen horizontalen Fließrichtung abgeleitet. Begehbarkeitsabfragen verwenden die inverse Abbildung, und die Steigungsprüfung misst die tatsächlich verformten Geländedreiecke. Planung und Höhenfeld bleiben in Referenzkoordinaten konsistent; die Darstellung ist keine unabhängig verzerrte Vorschau.

Der Fluss ist ein Höhenanker für die gemeinsame Geländeplanung. Nahe Regionshöhen werden vor dem Geländeaufbau begrenzt; das Bett liegt 2,5 Höheneinheiten unter dem Ufer statt in einer tief eingeschnittenen Schlucht. Noise bleibt außerhalb der geschützten Spielräume und des Flusskorridors.

An tatsächlichen Weg-/Flusskreuzungen entstehen separate Brückendecks. Nur Fluss, Uferbereich und ein kleiner Puffer werden orange markiert; die übrigen Wegabschnitte bleiben normales Gelände. Wasser außerhalb der Decks ist gesperrt. Der Prototyp prüft die Rasterverbindung mit Brücken, die Dreiecksneigung der begehbaren Oberflächen gegen die unabhängige 45-%-Grenze und die fallende Wasserhöhe auf jedem Flussabschnitt.

## Grenzen und Prüfungen

Die Darstellung ist eine vorläufige Vorschau: Steigungsüberschreitungen werden ausdrücklich angezeigt, verhindern aber nicht die Darstellung. Insbesondere lokale Übergangsdreiecke der verfeinerten Oberfläche können den Grenzwert überschreiten. Die CPU-Prüfung bleibt streng und weist solche Fälle zurück; eine sichtbare Landschaft ist keine Spielbarkeitsfreigabe.

Dies ist ein stilisiertes Verteilernetz, keine Wasserphysik oder Erosionssimulation. Durchflussmengen, Körperfreiraum, Navigation unter Brücken und RTS-Balance werden nicht geprüft. Der Spielgenerator, Spielprofile und reguläre Build bleiben davon unberührt.

Optionale CPU-Prüfung ohne Installation: `node experiments/map-generation/check.mjs` im Repository-Root. Sie erzeugt vollständige Meshes und Raster, ist kein schneller Smoke-Test und sollte für die visuelle Vorschau nicht vorausgesetzt werden. Sie prüft gekrümmte Kanten, gemeinsame Kreuzungsanker, lokale Brücken, Randanschlüsse, inverse Abbildung, fallende Wasserhöhen, Rasterverbindung und tatsächliche Dreiecksneigung an vier festen Seeds. Sie ersetzt weder WebGL-/Bedienungsprüfung noch visuelle Abnahme.
