# Worker-Navigation: offene Reproduktion und verbleibende Grenzen

## Nutzerberichte

Beim direkten Bau zweier benachbarter Logistics depots blieb der Worker des zweiten Auftrags stehen. Zuerst wurde das rechte Depot gebaut, unmittelbar danach das linke daneben. Der erste Worker baute regulär; der zweite Worker erreichte das linke Fundament nicht, obwohl dessen Unterseite augenscheinlich frei zugänglich war. Karte, Seed, Koordinaten und Laufzeit-Zustand des Originalfalls fehlen weiterhin.

![Zwei benachbarte Logistics depots; der zweite Worker steht unterhalb des unfertigen linken Fundaments](benachbarte-logistikdepots.webp)

Ein weiterer Nutzerbericht zeigt zwei dauerhaft stehende Prospector zwischen HQ und benachbartem Gebäude nahe einem Mineralfeld. Auch hierzu fehlt ein Laufzeitabzug; Auftrag, Ladung und Produktionsausgang lassen sich aus dem Bild nicht sicher bestimmen.

## Belastbarer Befund und Abgrenzung

Ein kleiner isolierter HQ-/Depot-Aufbau reproduziert eine Endlosschleife: Ein durch das Nachbargebäude verschobener Servicepunkt verlangt einen Umweg aus dem HQ-Nahbereich. Die bisherige entfernungsabhängige Umschaltung lenkte den Worker daraufhin wieder zum HQ-Mittelpunkt. Er machte Fortschritt zum jeweils aktuellen Wegpunkt und hielt deshalb `stuck` auf null, lieferte aber nicht ab. Eine weitere Falle ist das vorzeitige Überspringen des letzten Wegpunkts unmittelbar außerhalb des Arbeitsbereichs.

Die dauerhaften Regressionsfälle stehen in [den Navigationstests](../../../tests/ashes-of-meridian-navigation.check.cjs). Die laufende Navigation verwendet einen stabilen Rückwegauftrag, prüft Servicepunkte gegen den Arbeitsbereich und sucht bei Bedarf eine erreichbare Arbeitsseite. Pfadergebnisse unterscheiden vollständige und unvollständige Routen; Recovery erfasst auch leere oder verbrauchte Pfade. Vor einer Bauzusage wird das geplante Fundament bereits im temporären Navigationsraster berücksichtigt und der erste priorisierte Worker gewählt, der irgendeinen Punkt im später verwendeten Arbeitsradius vollständig erreichen kann; erst danach werden Ressourcen abgezogen und das Fundament erzeugt. Maßgeblicher Vertrag: [Architektur](../../architecture.md#welt-darstellung-und-zufall).

Diese Befunde erklären eine passende Fehlerklasse, beweisen aber nicht den exakten Zustand eines der Screenshots. Die isolierten Kurztests sind kein Ersatz für Crowd-Langläufe oder menschliche Abnahme.

Der vollständig freigegebene Simulationslauf auf `f0dba62` (Node v23.11.1) bestätigt den offenen Langlaufbefund: `worker traffic stays productive for six minutes: 1409/0/8, forced node true` scheitert mit `worker 64 stopped delivering in minute 1`. Die Variante ohne erzwungenen Knoten besteht. Ursache und Bezug zu den bisherigen Navigationseingriffen sind noch nicht eingegrenzt; keine Erwartungen, Radien oder Referenzen geändert.

## Noch offen

- Die gemeldeten Originalkonstellationen im Spiel nachprüfen. Bei erneutem Stillstand Auftrag, Position, Ladung, `returning`, `exit`, `yieldTo`, `path`, `pi`, `pathGoal`, `pathArea`, `pathResolvedGoal`, `pathStatus`, `pathVersion`, `stuck`, `recoveryAttempts` und Nachbargeometrie sichern. Nicht zuerst neu laden: laufende Gefechte besitzen kein Restore-API.
- Tatsächlich unerreichbare Aufträge behalten ihren Auftrag und versuchen es mit begrenzter Retry-Frequenz erneut. Ein sichtbarer Blockiert-Status bzw. eine abschließende Fehlerreaktion fehlt noch; temporäre Einheitenbelegung darf nicht als dauerhafte Unerreichbarkeit behandelt werden.
- Die Fortschrittsmessung ist weiterhin wegpunktbezogen, nicht auftragsweit. Wiederholte Yield-Manöver oder komplexe wechselnde Umwege können zusätzliche Liveness-Kontrolle benötigen. Servicepunkte sind bevorzugte Positionen, keine exklusiv reservierten Slots; eine allgemeine Fairness-/Gegenverkehrsgarantie besteht nicht.
- Größenabhängige Terrain-Clearance, durchgängige Segment-Kollisionsprüfung und ein globales Suchbudget sind separate Erweiterungen. Bestehende Körperradien, Hindernisverteilung und RNG-Verträge dabei schützen.
- Den oben genannten Minenverkehrsfall anhand von Auftrag, Ladung, Arbeitsbereich und Nachbargeometrie eingrenzen. Weitere Diagnose-Läufe gezielt freigeben lassen; keine breite Seed-/Kartenmatrix ohne konkreten Befund.

## Abhängigkeit: begehbare Höhenstufen

Der integrierte [Höhen- und Navigationsvertrag](../../architecture.md#welt-darstellung-und-zufall) ergänzt Rampen, Klippen und erhöhte Arbeitsflächen. Dabei müssen Segmentprüfung, Recovery-Platzsuche und Arbeitsreichweiten gemeinsam betrachtet werden: Eine nahe X/Z-Position auf der anderen Klippenseite ist kein erreichbarer Servicepunkt. Die hier dokumentierten Flachkarten-/Langlaufbefunde bleiben separat offen; das Höhenexperiment ist kein Auftrag zu ihrer beiläufigen Reparatur.

## Akzeptanz der offenen Arbeit

Ein gültig platziertes Fundament mit erreichbarer Arbeitsseite muss vom zugewiesenen Worker ohne manuellen Neuauftrag begonnen und abgeschlossen werden. Erreichbarer Minenverkehr muss pro Worker wiederholt liefern, nicht nur als Gruppe Gesamteinkommen erzeugen. Dauerhaft unerreichbare Ziele müssen nachvollziehbar behandelt werden, ohne Suchstürme, heimliche Erstattungen oder veränderte Arbeitsreichweiten. Darstellungs- und Crowd-Abnahme bleiben menschlich bzw. ausdrücklich beauftragten Läufen vorbehalten.
