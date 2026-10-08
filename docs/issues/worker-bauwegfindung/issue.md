# Navigation: Worker, Gruppenankunft und Liveness

## Nutzerberichte

Beim nacheinander gesetzten rechten/linken Logistics depot blieb der zweite Worker stehen; Karte/Seed/Position fehlen. Zweiter Bericht: zwei stehende Prospector zwischen HQ/Gebäude nahe Mineralfeld, ohne Zustandsabzug.

![Zweiter Worker unter unfertigem linkem Depot](benachbarte-logistikdepots.webp)

Isolierte HQ-/Depot-Prüfung belegte eine passende Fehlerklasse: wechselndes HQ-/Servicepunktziel und vorzeitig übersprungener Arbeitswegpunkt. Korrektur integriert, Originalscreenshots nicht exakt reproduziert. [Navigationsregressionen](../../../tests/ashes-of-meridian-navigation.check.cjs), [dauerhafter Vertrag](../../architecture.md#welt-darstellung-und-zufall).

## Noch offen

- [ ] Lokalen HQ-Fall `service tolerance does not extend the existing outer HQ delivery range` prüfen: Die erwartete Ablieferung im zweiten Worker-Aufruf bleibt aus (Ladung 18 statt 0), auch im isoliert gebauten unveränderten Stand `1e1d24a` vor der umlaufenden Forum-Regel. Ursache beziehungsweise Tickannahme offen; kein Nachweis einer durch das Forum eingeführten HQ-Regression und kein allgemeiner Langlaufbefund.
- [ ] Originalfälle bei erneutem Stillstand sichern: Karte/Seed, Workerposition/-auftrag/-fracht, Exit/Yield, kompletter Pfad samt Ziel/Status/Version, Stuck-/Recoverywerte und Nachbargeometrie. Vor Reload sichern; kein laufendes Restore.
- [ ] Sichtbarer Blockiert-/Ausgangswarten-Status oder abschließende Fehlerreaktion. Temporäre Belegung nicht als dauerhaft unerreichbar behandeln; keine heimlichen Erstattungen/Teleports.
- [ ] Auftragsweite Liveness statt nur Wegpunktfortschritt, Yield-/Umwegzyklen und Servicepunkt-Fairness/Gegenverkehr beurteilen.
- [ ] Größenabhängige Clearance, allgemeine Segmentkollision und globales Suchbudget nur als separate Erweiterung. Bestehende Radien/RNG schützen. Kosten von Wegsuche und Live-Körperprüfungen stehen zentral unter [Performance](../performance/README.md#bewegte-armeen-und-navigation); reine Beschleunigung ersetzt keine Liveness-Abnahme.

Akzeptanz: erreichbarer Bau wird ohne Neuauftrag abgeschlossen, jeder erreichbare Minenworker liefert wiederholt; unerreichbare Ziele sind nachvollziehbar ohne Suchstürme. Höhenzugang darf Arbeit durch Klippen nicht erlauben.

Bestehende Langlauf-Ausnahme für künstlich gebündelte Startworker: erste Anlaufminute nur mit Abbaufortschritt, danach weiterhin Lieferung je Worker/Minute. Keine allgemeine Stillstandstoleranz. Crowd-/Originalfallabnahme bleibt offen; [Prüffreigaben](../../testing.md).

## Gruppenankunft und Ausweichwackeln

Der Nutzer meldete sehr lange Gruppenankunft, fortgesetztes Hin-und-her-Bewegen vieler Einheiten und eine bis zum Aufnahmeende bewegte Einheit. Annähernd 60 FPS in derselben Chromium-Aufnahme belegen keine korrekte Zielankunft. Die aggregierte Performanceaufnahme enthält keine Einzelpositionen, Befehls-/Zielmarker oder Recoveryzustände; konkrete Ursache und betroffene Einheit bleiben offen. Die jüngste positive FPS-Rückmeldung ist keine bestätigte Behebung dieses Verhaltens.

- [ ] Bei erneutem Auftreten Spielstand/Karte/Seed, Einheiten-IDs, ursprünglichen Gruppenbefehl und Formationsziele sichern. Je betroffener Einheit Position, Auftrag, Pfad/Ziel/Status/Version, Wegpunkt, Stuck-/Recovery-/Yieldzustand und nahe Körper/Ausgänge vor Reload erfassen.
- [ ] Einzel- gegen Gruppenankunft, freies gegen belegtes Ziel sowie tatsächlich blockierte Engstelle unterscheiden; Ankunftstoleranz, Formationsplatz und wiederholtes Ausweichen/Neuplanen getrennt beurteilen.

Keine vorsorgliche Änderung an Radien, Zielabständen, Formation, Yield-Prioritäten oder Recovery. Reproduktion und begrenzte Verhaltensregression benötigen einen eigenen Auftrag; schnelleres Rendering oder ein Körperindex ist kein Nachweis einer Behebung.
