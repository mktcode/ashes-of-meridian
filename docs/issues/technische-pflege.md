# Kleine technische Pflegekandidaten

Der frühere lesende Audit ist abgeschlossen; Laufdetails und erledigte Befunde bleiben in Git. Es ist kein breiter Strukturumbau belegt. Zwei kleine, voneinander trennbare Pflegeaufgaben sind noch offen.

## Ladegruppen vollständig absichern

`tests/ashes-of-meridian-harness.check.cjs` prüft Reihenfolge und Dateien der bereits bekannten Skriptgruppen. Ein neues, nur in `index.html` ergänztes Fragment kann dadurch unbemerkt außerhalb der passenden VM-Gruppe in `tests/helpers/game-scripts.cjs` bleiben.

Kleinste Maßnahme: Für die nach Pfad- und Namenskonvention gruppierten Battlefield-, Renderer-, Simulations-, Multiplayer-, Diagnose- und UI-Skripte vollständige Gruppenzugehörigkeit und Dokumentreihenfolge prüfen. Keine automatische Ableitung der Laufzeitladung und keine Umstellung der klassischen Skripte. Prüfung: gezielter Harness-Test, Build und wegen des gemeinsamen Ladevertrags abschließend die Standardtestsuite.

## Toten UI-Ereigniszweig entfernen

`select` in der Ereignisbehandlung von `src/ui/core.ts` ist kein Mitglied von `GameEventMap` und wird nicht emittiert. Der Zweig kann als getrennte mechanische Kleinständerung entfernt werden.

`queued` und `build` sind dagegen aktive Simulationssignale und bleiben erhalten. Aus einem fehlenden eigenen Sound- oder UI-Effekt folgt keine Freigabe, Ereignisse oder Fachverhalten zu ändern.

## Nicht Teil dieser Pflege

`hold`, `stop` und `guard` besitzen weiterhin Simulations- oder Testnutzer. Klassische globale Skripte, Prototyperweiterungen, optionale Test-Doubles und reservierte RNG-Aufrufe sind aktive Verträge, keine pauschalen Altlasten. Performancearbeit wird ausschließlich anhand des aktuellen [Mobile-Performance-Issues](mobile-performance.md) und konkreter Messungen ausgewählt.
