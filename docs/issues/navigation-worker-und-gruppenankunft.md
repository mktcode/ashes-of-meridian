# Navigation und Liveness

## Workerstillstände

Berichte: zweiter Worker beim nacheinander gesetzten rechten/linken Depot; zwei
stehende Prospectors zwischen HQ/Gebäude am Mineralfeld. Karte/Seed/Zustandsabzug fehlen.

![Worker unter unfertigem linkem Depot](worker-bauwegfindung/benachbarte-logistikdepots.webp)

Wechselndes HQ-/Servicepunktziel und übersprungener Arbeitswegpunkt sind korrigiert;
Originalfälle nicht exakt reproduziert.

- [ ] Vier historische `worker traffic stays productive for six minutes`-Fälle klären:
  1409/0 mit acht Workern (frei/erzwungene Knotenzuweisung), 7012/1 und 9017/2 mit zwölf.
  Einzelne Worker ohne Abbaufortschritt in der ersten Minute. Gegenprobe 1409/0,
  erzwungener Knoten: Worker 63 bei `(90.035,112.291)`, Ressource 24, Fracht 0,
  leerer Pfad, Stuck 3.05. Fixturebelegung und Navigation getrennt untersuchen.
- [ ] Originalstillstand vor Reload sichern: Karte/Seed, ID, Position, Auftrag/Fracht,
  kompletter Pfad/Ziel/Status/Version, Exit, Stuck/Recovery/Yield und Nachbarn.
- [ ] Auftragsweite Liveness, Umweg-/Yieldzyklen und Servicepunkt-Fairness im Gegenverkehr.
  Blockiert-/Ausgangswarten nachvollziehbar anzeigen; temporäre Belegung nicht als
  endgültig unerreichbar behandeln, keine Teleports/heimlichen Erstattungen.

Akzeptanz: erreichbarer Bau endet ohne Neuauftrag, jeder erreichbare Minenworker liefert
wiederholt; unerreichbare Ziele warten verständlich ohne Suchstürme, keine Arbeit durch Klippen.
Bestehende Langlauf-Ausnahme bei künstlich gebündelten Startworkern: erste Minute
Abbaufortschritt, danach Lieferung je Worker/Minute; keine allgemeine Stillstandstoleranz.

## Gruppenankunft und Ausweichwackeln

Lange Ankunft, dauerhaftes Hin-und-her vieler Einheiten und eine bis Aufnahmeende bewegte
Einheit trotz annähernd 60 FPS gemeldet. Aufnahme enthält keine individuellen Ziel-/
Recoveryzustände; Ursache offen. Lokale Gruppenzielkorrektur und bessere FPS belegen keine Behebung.

- [ ] Spielstand, ursprünglichen Gruppenbefehl und Formationsziele sowie obige Einzelzustände sichern.
- [ ] Einzel/Gruppe, freies/belegtes Ziel und Engstelle getrennt beurteilen; Ankunftstoleranz,
  Formationsplatz, wiederholtes Ausweichen und Neuplanen unterscheiden.

Radien, Formation, Prioritäten oder Recovery erst mit eigenem Auftrag/Reproduktion ändern.
Such-/Kollisionskosten unter [Performance](performance-und-mobilstabilitaet.md),
Langläufe nur mit [Freigabe](../../AGENTS.md#prüfungen).
