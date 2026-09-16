# Worker bleibt vor frei zugänglichem Fundament stehen

Beim direkten Bau zweier benachbarter Logistics depots blieb der Worker des zweiten Auftrags stehen. Zuerst wurde das rechte Depot gebaut, unmittelbar danach das linke daneben. Der erste Worker baute regulär; der im Bild sichtbare zweite Worker erreichte das linke Fundament nicht, obwohl dessen Unterseite offen und augenscheinlich frei zugänglich war. Der Fall ließ sich bisher nicht reproduzieren; Karte, Seed, Koordinaten und Laufzeit-Zustand fehlen.

![Zwei benachbarte Logistics depots; der zweite Worker steht unterhalb des unfertigen linken Fundaments](benachbarte-logistikdepots.webp)

Der kleine Fortschrittsstand belegt für sich noch keine Bautätigkeit: Ein neues Fundament startet bereits mit `progress: 0.06`. Der Screenshot passt daher zu einem Auftrag, der nach dem Anlegen des Fundaments keinen Bautick erreicht hat.

## Zu klärender Systembefund

Die sichtbare freie Unterseite wirft eine grundsätzlichere Frage als nur die konkrete Rasterkante auf: Für einen Bauauftrag sollte es fachlich genügen, dass der Worker irgendeine erreichbare Position innerhalb des Arbeitsradius erreicht. Derzeit besitzt der Auftrag aber nur den Gebäudemittelpunkt als Ziel:

- `worker()` prüft zuerst den Abstand zum Mittelpunkt und ruft außerhalb von `building.size + 3.0` die allgemeine Bewegung zum Gebäude auf (`src/simulation/economy.ts`).
- Die allgemeine Bodennavigation kann den blockierten Mittelpunkt nicht betreten. `Battlefield.path()` ersetzt ihn deshalb über `nearest()` durch genau eine deterministisch gewählte freie Rasterposition (`src/world.ts`).
- `nearest()` bewertet die Nähe zum Mittelpunkt, aber weder Erreichbarkeit aus Richtung des Workers noch Eignung als Arbeitsposition. Es sucht auch nicht mehrere Punkte auf dem Arbeitsring.
- Lokales Steering und Neuplanung versuchen den vorhandenen Weg zu retten (`src/simulation/movement.ts`); sie wählen keine andere Arbeitsseite des Gebäudes als neues fachliches Ziel.
- Die Vorprüfung in `build()` berechnet einen Weg noch vor dem Spawn des neuen Fundaments und vor `world.rebuild()`. Sie belegt daher nicht, dass nach Einfügen des neuen Blockers eine geeignete Arbeitsposition erreichbar bleibt.
- Kann A* das gewählte Ziel nicht vollständig erreichen, darf `Battlefield.path()` unter bestimmten Bedingungen einen Teilweg zum besten erreichten Rasterpunkt zurückgeben. Bleibt dessen Ende außerhalb des Arbeitsradius, kann der Auftrag bestehen bleiben, ohne Fortschritt zu erzeugen.

Das Raster selbst ist für globale Wege um Terrain und Gebäude weiterhin sinnvoll. Fraglich ist die Kopplung des fachlichen Bauziels an eine einzelne, rein geometrisch nächste Rasterzelle. Nicht vorschnell das Raster oder die gemeinsamen Kollisionsregeln ersetzen; zuerst trennen zwischen:

1. **Arbeitsbedingung:** irgendeine körperlich gültige und erreichbare Position innerhalb des Bauradius,
2. **globalem Weg:** Rasterroute in die Nähe des Fundaments,
3. **lokalem Anmarsch:** Wahl bzw. Wechsel einer konkreten Arbeitsseite bei Gebäuden, Einheiten und Engstellen.

## Untersuchung und Akzeptanz

- Den gemeldeten Aufbau mit zwei unmittelbar nacheinander und minimal zulässig beabstandeten Depots auf unterschiedlichen Unterzellpositionen des 2,5-m-Navigationsrasters prüfen. Beide horizontalen Reihenfolgen und Anmarsch von oben/unten abdecken.
- Während des Fehlers Workerauftrag, Position, Distanz zum Fundament, `path`, `pi`, `pathGoal`, `pathVersion`, `stuck`, `steerSide` und `steerLocked` erfassen. Ebenso die von `nearest()` gewählte Zielzelle und ob sie vom Worker aus erreichbar ist.
- Dynamische Varianten mit dem ersten Builder beim Weggehen, einem kurzzeitig blockierenden Worker und angrenzendem Terrain getrennt prüfen. So lässt sich eine falsche Arbeitszielwahl von einem allgemeinen Crowd-/Steering-Stau unterscheiden.
- Prüfen, ob Bau- und Reparaturaufträge einen gemeinsamen Helfer für mehrere deterministische Servicepunkte oder einen erreichbaren Arbeitsring benötigen. Ein Kandidatenwechsel nach belegtem oder unerreichbarem Ziel darf keinen zusätzlichen Builder, keine Baugeschwindigkeit und keine Kostenänderung erzeugen.
- Ein gültig platziertes Fundament mit mindestens einer erreichbaren Seite muss von seinem zugewiesenen Worker ohne manuellen Neuauftrag begonnen und abgeschlossen werden.
- Ist tatsächlich keine Arbeitsseite erreichbar, muss der Auftrag kontrolliert reagieren; dauerhaftes regungsloses Wiederholen ohne Rückmeldung ist nicht akzeptabel. Erstattung, automatische Neuzuweisung oder UI-Meldung erst nach Klärung der gewünschten Spielregel festlegen.
- Gezielt gegen einzelne Gebäude, benachbarte Gebäude, Terrainkanten sowie Bau-/Reparaturaufträge prüfen. Bestehende Körperabstände, Platzierungsregeln, Produktionsausgänge, deterministische Reihenfolge und Simulations-RNG unverändert halten.

## Nicht vorweg entscheiden

Der einzelne Bericht belegt noch nicht, dass `nearest()` allein die Ursache ist oder dass die gesamte Navigation ersetzt werden muss. Möglich bleiben ein lokaler Steering-Deadlock, eine nach dem Fundamentbau veraltete bzw. ungeeignete Route, eine dynamische Einheitenblockade oder eine Kombination daraus. Die Überarbeitung soll deshalb vom reproduzierten Zustandsbefund ausgehen und nicht als breites Pathfinding-Refactoring beginnen.
