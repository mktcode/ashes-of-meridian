# Modellkacheln · Abnahme

Codex-Übersicht und Bau-/Rekrutierungsmenü verwenden die aktuellen Modelle statt Portraitdateien. Technischer Vertrag und Kostenbegrenzung: [Rendering](../rendering.md#modellkacheln).

## Performancebefund

Der Nutzer meldet nach Einführung der Modellkacheln einen Einbruch von zuvor 60 auf 30 FPS oder weniger beim Öffnen der Codex-Übersicht und des Baumenüs. Gerät, Browser und Diagnosebericht liegen noch nicht vor; die Zuordnung einzelner Kosten ist daher nicht gemessen.

Die kleinen Vorschauen sind jetzt auf ausdrücklichen Nutzerauftrag nicht animiert und verwenden einen begrenzten flüchtigen Standbildcache. Dadurch entfällt der kontinuierliche WebGL-zu-2D-Kopierpfad. Beim erstmaligen Erzeugen eines noch nicht vorhandenen Bildes bleibt eine solche Kopie nötig; erneutes Öffnen nutzt vorhandene Bilder. Die große Detailansicht bleibt live. Quellen-/Regressionstests für ausbleibende Zeichnungen und Kopien im eingeschwungenen Zustand ersetzen keine erneute FPS-Abnahme auf dem betroffenen Gerät.

Die vom Nutzer vorgelegten Desktop-/Mobilansichten zeigten außerdem zu kleine beziehungsweise kaum erkennbare Gebäudemodelle. Engere kameraseitige Teilmesh-Bounds und eine höhere, nicht von Text/Verlauf überlagerte Modellfläche im Aktionsmenü vergrößern die Darstellung. Deaktivierte Aktionen behalten eine gedämpfte, aber weniger dunkle Vorschau.

## Offen

- Menschliche Sichtprüfung aller Fraktionen im Codex und bei normalen HUD-Größen: Bildausschnitt, Teamfarben, Kontrast und Lesbarkeit von Namen/Kosten über dem Modell, auch bei deaktivierten Aktionen.
- Erneute FPS-Abnahme beim Erstöffnen und Wiederöffnen auf dem betroffenen Desktop und Mobilgerät. Smartphone-Abnahme außerdem für Scrollen der Codex-/Aktionsliste und Tippen auf Kacheln; einmalige Cache-Misses können weiterhin CPU-/GPU-Synchronisation verursachen. Eingeschwungener Cache und geteilte Geometrie sind kein Echtgeräte-/Thermiknachweis.
- Bei auffälligen Kosten mit [Diagnoseberichten](../testing.md#lokale-performancediagnose) vergleichen; der zusätzliche Pass heißt `thumbnails`. Statische Portraitquellen bleiben erhalten, ihre Löschung ist nicht beauftragt.
