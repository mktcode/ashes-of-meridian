# Landschaftsgerüst – Tal, Schlucht & Pass

`index.html` direkt öffnen, auch per `file://`; kein Build, Server, CDN oder Import.
WebGL 2 erforderlich. Einstieg: `index.html?seed=7&branches=6`.

Eigenständiger Entwurf, unabhängig vom Spiel und von den bisherigen Experimenten.
Die Großform entsteht aus einem seedabhängigen Landschaftsplan, nicht aus globalem Noise:
Eine gewundene Aufstiegskette verbindet offenes Tal und Hochfläche über mehrere Talräume.
Ein versetztes, unregelmäßiges Nachbarschaftsgerüst liefert Kandidaten für Seitenäste und
Rundwege; nur gewählte Verbindungen formen das Gelände. Gebirgsriegel gliedern den Innenraum,
statt ihn als großes Mitteltal offen zu lassen. Breiten, Engstellen und Flanken wechseln.
Kämme vereinigen sich ohne additive Bergstapel, Täler teilen sich ein kontinuierliches Höhenfeld.

„Zusätzliche Äste“ ergänzt 0–12 Landschaftsorte samt Anschluss; mit höherer Astanzahl kommen,
wo das Gerüst es erlaubt, auch Rundwege hinzu. Der Regler erzeugt beim Loslassen neu.
Bei gleichem Seed bleiben die Hauptroute und das Gebirgsgerüst unabhängig von der Astanzahl.
Die vollständige Aufstiegskette wird zuerst angelegt und niemals entfernt. Jede ihrer Kurven
formt einen Geländekorridor; angrenzende Abschnitte teilen Position und Zielhöhe am Anschluss.

„Nur Großformen“ und „Ausläufer & Flanken“ verwenden denselben Plan mit allen gewählten Ästen.
Die zweite Stufe ergänzt verbundene Gebirgsausläufer und schwache, großwellige Flankenvariation.
Keine Erosionssimulation, Detailgeometrie, Höhlen oder Überhänge. Die Verbindung ist konstruktiv
im Landschaftsgerüst vorhanden, aber maximale Neigungen und echte Spielnavigation sind ungeprüft.
Das bleibt ein kompositorisches Rezept, kein universeller Landschaftsgenerator.

Landschaftsgerüst zeigt Kamm- und Talachsen. Die helle Erkundungsroute markiert den vollständigen
Aufstieg, gedämpfte Linien die zusätzlichen Äste und Rundwege. Alle Linien liegen auf dem
tatsächlich dargestellten Mesh. Beleuchtung mit festen Geländeschatten; Ortsnamen markieren
ausgewählte Landschaftsorte ohne Sichtbarkeitsprüfung hinter Bergen.

Ziehen dreht/neigt, Rechtsziehen oder Shift+Ziehen verschiebt, Mausrad zoomt.
Touch: ein Finger dreht/neigt; zwei Finger verschieben, drehen und zoomen.
„Draufsicht“ macht die Komposition lesbar; „Kamera zurücksetzen“ stellt die Schrägansicht her.

Die Trennung von Plan und Darstellung greift die Idee des bestehenden
[Planungskarten-Experiments](../planning-map/README.md) auf, ohne dessen Waben- und Plattformmodell.
