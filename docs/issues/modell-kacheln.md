# Modellkacheln · Abnahme

Codex-Übersicht und Bau-/Rekrutierungsmenü verwenden die aktuellen Modelle statt Portraitdateien. Technischer Vertrag und Kostenbegrenzung: [Rendering](../rendering.md#modellkacheln).

## Performancebefund

Der Nutzer meldet nach Einführung der Modellkacheln einen Einbruch von zuvor 60 auf 30 FPS oder weniger beim Öffnen der Codex-Übersicht und des Baumenüs. Gerät, Browser und Diagnosebericht liegen noch nicht vor; die Zuordnung einzelner Kosten ist daher nicht gemessen.

Quellenprüfung: Jede aktualisierte Kachel wird separat gezeichnet und synchron per `CanvasRenderingContext2D.drawImage` vom WebGL-Hauptcanvas in ihren 2D-Canvas kopiert. Diese Kontextgrenze kann GPU-/CPU-Synchronisation und zusätzliche Kopier-/Compositingkosten verursachen. Die Begrenzung gilt pro Kachel (bis zu sechs Updates/s), nicht global auf sechs Updates/s: Bei mehreren sichtbaren Kacheln ist bis zu eine Kopie in jedem gerenderten Frame möglich. Der vorherige technische Browsercheck bestätigt keine Geräteperformance.

Vor einer weiteren Freigabe den kontinuierlichen Kopierpfad vermeiden: entweder zur Laufzeit erzeugte und wiederverwendete Standbildkacheln (ohne manuelle Assetpflege) oder echte GPU-seitige Live-Kacheln ohne WebGL-zu-2D-Kopie. Die interaktive große Detailansicht kann weiterhin live bleiben. Umsetzung und gegebenenfalls Messläufe separat freigeben.

## Offen

- Menschliche Sichtprüfung aller Fraktionen im Codex und bei normalen HUD-Größen: Bildausschnitt, Teamfarben, Kontrast und Lesbarkeit von Namen/Kosten über dem Modell, auch bei deaktivierten Aktionen.
- Smartphone-Abnahme: Scrollen der Codex-/Aktionsliste, Tippen auf Kacheln und Geräteperformance. Canvas-Kopien können CPU-/GPU-Synchronisation verursachen; maximal eine Kachel pro Frame und geteilte Geometrie sind kein FPS-/Thermiknachweis.
- Bei auffälligen Kosten mit [Diagnoseberichten](../testing.md#lokale-performancediagnose) vergleichen; der zusätzliche Pass heißt `thumbnails`. Statische Portraitquellen bleiben erhalten, ihre Löschung ist nicht beauftragt.
