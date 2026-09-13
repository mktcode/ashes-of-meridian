# Detailpass aller übrigen Gebäude

Beauftragt: alle 21 Gebäude (sieben Typen × drei Fraktionen) auf vergleichbare Detailqualität bringen. Die freigegebenen Fraktion-0-Barracks/Factory/Hangar bleiben unverändert; Einheiten und Ressourcen sind ausgeschlossen. HQ/Turret von Fraktion 0 haben bereits detaillierte Geometrie, erhalten eine eigene Assemblierungsdatei und nur ergänzende Details.

## Vorgehen und Grenzen

1. Restliche 18 Assemblierungen zeichenidentisch auslagern, pro Modell eigene Datei; nur Basisrotation und parametrisierter Effektring ergänzen den zentralen Kontext. Keine GPU-/Katalogzugriffe beim Registrieren.
2. Getrennter visueller Commit. Silhouetten, Materialien/Farbfamilien, Höhen, Produktionsrichtung +Z, Effektringe, Kristallschweben/-rotation und Turmzielwinkel erhalten. Kein neuer RNG, Rauch, Animation, Kollisionskörper oder Gameplayeingriff.
3. Fraktion 0: HQ-Servicepanzerung, Depot als zwei gerippte Frachtcontainer, Raffinerie mit zwei unterschiedlich hohen gebänderten Drucktürmen/Leitungen, Turret mit ergänzten Sockel-/Kopfdetails. Vorhandene vier Aktionsporträts erneuern (320×320, WebP Q80). Keine neue Portrait-UI für andere Fraktionen.
4. Fraktion 1: weicher Knollenkörper, dunkle Mittelkristalle und sechs Wurzeln/Leuchtknospen bleiben. Gerippte Schalen, Wurzelmanschetten und individuelle Organe: HQ-Krone, Barracks-Brutkammern, Depot-Speicherkapseln, Raffinerie-Filterorgane, Factory-Rückenpanzer, Hangar-Flugkranz, Turret-Stachelkragen.
5. Fraktion 2: gestufter Obelisk und vier Pfeiler bleiben; Sockelfugen, eingefasste Pfeiler, Facettenrippen und Funktionsdetails: HQ-Krone, Barracks-Portal, Depot-Siegelkammern, Raffinerie-Kollektoren, Factory-Montagerahmen, Hangar-Fokuskranz, Turret-Linsenkrone. Bestehende Orbitale nicht durch neue Animation ersetzen.

## Budgets und Prüfung

- Neu gebackene Meshes insgesamt typischerweise 800–2.200 Dreiecke pro Modell; höchstens 3.000 pro fertigem Gebäude (bereits detailliertes HQ gesondert bis 3.200). Maximal 36 Teilinstanzen, beim bestehenden HQ höchstens bisher +4. X/Z nahe der bisherigen Ausdehnung, Höhe höchstens bisher +0,3; keine pauschale Silhouettenvergrößerung.
- Einzeltests: deterministische nichtdegenerierte Geometrie, Bounds/Normalen/Tints, Registrierungsisolation, unveränderte Entitäten, Bauzustände, beide Teams, Ghost/Preview, Layer/Material/Alpha, Altanimationen und gezielte Erkennbarkeitsmerkmale.
- 756 Vorher-Zeichenvarianten und kontrollierte Fraktionsruns/RNG/Schüsse temporär sichern. Nach Auslagerung alle identisch; nach Detailpass nur die 324 Varianten der 18 beauftragten Modelle unterschiedlich. Alte Fixtures und übrige Meshes unangetastet.
- Gebündelt am Ende `npm test`, Chromium `file://`-Sichtung aller Gebäude/Qualitäten/Zustände, normale Basisansichten, neue Portraits/erreichbare Bauaktionen im mobilen Layout. Keine Containeränderung, deshalb kein Docker-Neubau. Headless-Messwerte ersetzen keine reale Mobil-GPU-/Langzeitprüfung.
