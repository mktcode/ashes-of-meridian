# Modellkacheln · Abnahme

Codex-Übersicht und Bau-/Rekrutierungsmenü verwenden die aktuellen Modelle statt Portraitdateien. Technischer Vertrag und Kostenbegrenzung: [Rendering](../rendering.md#modellkacheln).

## Offen

- Menschliche Sichtprüfung aller Fraktionen im Codex und bei normalen HUD-Größen: Bildausschnitt, Teamfarben, Kontrast und Lesbarkeit von Namen/Kosten über dem Modell, auch bei deaktivierten Aktionen.
- Smartphone-Abnahme: Scrollen der Codex-/Aktionsliste, Tippen auf Kacheln und Geräteperformance. Canvas-Kopien können CPU-/GPU-Synchronisation verursachen; maximal eine Kachel pro Frame und geteilte Geometrie sind kein FPS-/Thermiknachweis.
- Bei auffälligen Kosten mit [Diagnoseberichten](../testing.md#lokale-performancediagnose) vergleichen; der zusätzliche Pass heißt `thumbnails`. Statische Portraitquellen bleiben erhalten, ihre Löschung ist nicht beauftragt.
