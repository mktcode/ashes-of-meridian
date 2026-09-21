# Upgrade-Ideen

Offene Ideen für Expeditionsvorteile. Werte, Kosten, Angebotsgewichtungen und Balancing erst nach einer Spielprobe festlegen.

## Commander: Schutzeskorte

Der Commander absorbiert innerhalb eines Radius einen Anteil des Schadens befreundeter Einheiten. Der umgeleitete Schaden darf den Commander zerstören; für Schilde, Flächenschaden und Umweltschaden ist die genaue Reihenfolge vor der Umsetzung festzulegen. Die Schadensumleitung braucht einen Rekursionsschutz, damit Schaden am Commander nicht erneut umgeleitet wird.

## Commander: Veteran

Der Commander erhält dauerhaft 10 % mehr maximales Leben. Der Bonus muss sowohl beim Start als auch bei einer Rekonstruktion im HQ gelten. Sollte mehrfach in der Expedition vorkommen können und stacken.

## Commander: Feldlogistik

Worker innerhalb eines Commander-Radius gewinnen beim Abbau mehr Alloy. Der Bonus soll beim tatsächlichen Abbau gelten, nicht beim Abliefern am HQ; damit bleibt die räumliche Positionierung des Commanders relevant.

## Bewegungsgeschwindigkeit

Kampfeinheiten erhalten erhöhte Bewegungsgeschwindigkeit +1%, sollte mehrfach vorkommen können und stacken.

## Erstes Turret kostenlos

Das erste erfolgreich platzierte Turret jedes Gefechts kostet keine Ressourcen. Abbruch, fehlgeschlagene Platzierung und Verkauf müssen vorab eindeutig behandeln, damit der Vorteil nicht mehrfach nutzbar wird.

## Gemeinsame Commander-Effekte in 2vs2

In einem späteren 2vs2 sollen Commander-Auren auch den jeweiligen Teamkollegen begünstigen. Die Implementierung darf deshalb nicht auf die heutige Zweiparteienannahme oder auf feste Parteien-IDs bauen:

- Ein Effekt sucht alle lebenden Commander der eigenen expliziten Allianz und wirkt auf alle Einheiten dieser Allianz, nicht nur auf die Einheiten des Commander-Besitzers.
- Nicht-Feindschaft allein genügt dafür nicht: Sie kann in Szenarien auch neutral bedeuten. Das 2vs2-Modell braucht einen ausdrücklichen Allianz-/Teamvertrag.
- Mehrere Commander im Radius brauchen eine festgelegte Stapelregel. Vorgeschlagen: identische Auren stapeln nicht; unterschiedliche Effekte können gleichzeitig gelten.
- Start-, Rekonstruktions- und Todesfälle müssen den Effekt sofort aktualisieren. Ein zerstörter Commander hinterlässt keine Aura.
- Bestehende Expeditionsvorteile liegen derzeit pro Partei vor. Vor 2vs2 ist zu entscheiden, ob ein Vorteil nur den Commander seines Besitzers verbessert, aber dessen Aura dem ganzen Team zugutekommt, oder ob Vorteile direkt teamweit geführt werden.

Für mehrere Radiusvorteile ist ein gemeinsamer Simulationshelfer sinnvoll, der lebende Commander einer Allianz und deren Reichweite bestimmt. Ein allgemeines neues Fähigkeiten- oder Stat-Modifikatorsystem ist dafür zunächst nicht erforderlich.
