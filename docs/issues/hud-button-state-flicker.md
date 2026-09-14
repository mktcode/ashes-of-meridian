# HUD-Schaltflächen flackern beim Menü-/Moduswechsel

## Befund

In Chromium über `file://` bei 375×667 reproduziert: Nach Klick auf Infantry werden alle vier Fähigkeitsschaltflächen durch neue, zunächst aktivierte DOM-Elemente ohne Kosten-/TECH-Badges ersetzt. Mit gezielt zurückgesetztem HUD-Timer besteht der falsche Zustand nach 240 ms UI-Tick noch; nach insgesamt 260 ms sind Sperren und Badges wieder korrekt. Diagnoseauftrag, noch keine Reparaturfreigabe.

## Ursache und Ansatz

`setTab()` und `setMode()` in `src/ui/actions.ts` rufen direkt `renderActions()` auf. Dieses ersetzt sowohl Aktionen als auch Fähigkeiten per `innerHTML`, erstellt Bau-/Rekrutierungs-/Fähigkeitsschaltflächen jedoch zunächst ohne Verfügbarkeitsprüfung. Erst die nachgelagerte Schleife in `updateHUD()` setzt `disabled`, CSS-Klasse und Fähigkeitsbadges. Der reguläre Aufruf aus `src/ui/presentation.ts` erfolgt erst nach mehr als 0,25 Sekunden HUD-Zeit und wird während `domPressed` ausgesetzt. Kein Seitenreload; getrennte DOM-Erzeugung und Zustandsaktualisierung.

Für eine Reparatur neue Schaltflächen noch im selben synchronen Renderdurchlauf mit korrekten Verfügbarkeiten und Badges versehen. Unveränderte Fähigkeitsleisten bei reinen Tabwechseln möglichst nicht ersetzen; kein breites UI-Refactoring nötig. Regression: Unmittelbar nach Tab-/Zielmoduswechsel müssen gesperrte Aktionen gesperrt und Badges korrekt bleiben, ohne auf den nächsten HUD-Tick zu warten.
