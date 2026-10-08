# Unique Points of Interest

Jede Karte soll genau einen zufällig ausgewählten und platzierten, einzigartigen atmosphärischen Blickfang als 3D-Modell erhalten. Das gewählte Motiv kommt auf dieser Karte nur einmal vor; es dient der Atmosphäre, nicht als benanntes Spielziel. „Unique Point of Interest“ ist lediglich der interne Arbeitsbegriff und wird im Spiel nicht angezeigt.

Erste unverbindliche Motivideen, noch keine festgelegte Auswahl:

- Ein riesiges Vorkommen von Echo-Kristallen.
- Ein kleiner Vulkan.
- Ein gigantisches, halb im Boden versunkenes Skelett eines außerirdischen Wesens. Seine Rippen ragen wie gewaltige Torbögen aus der Landschaft; zwischen den Knochen glimmen vereinzelte Echo-Kristalle. Was es war und wie lange es dort liegt, bleibt unerklärt.
- Ein zerbrochenes Sternentor, dessen gewaltiger Ring schräg aus dem Boden ragt. Zwischen den Bruchstücken flackert gelegentlich für einen Augenblick ein fremder Sternenhimmel auf; danach ist wieder nur die Landschaft dahinter zu sehen.
- Ein gestrandetes Forschungsschiff, das von einem riesigen Baum durchwachsen ist. Wurzeln haben den Rumpf aufgesprengt, die Krone ragt weit über die Landschaft. Im Inneren blinkt noch eine einzelne Positionsleuchte.

## Offen

- [ ] Motivauswahl und gestalterischen Charakter weiter definieren; weitere Ideen sammeln und passende Modelle ausarbeiten.
- [ ] Zufällige Auswahl und Platzierung pro Karte konkretisieren, einschließlich Eignung für unterschiedliche Landschaften und Platzbedarf.
- [ ] Atmosphärische Wirkung bei normalem Gefechtszoom abnehmen; technische Kosten neuer Geometrie bei späterer Freigabe gemäß der zentralen [Performanceübersicht](performance/README.md#renderer-und-gpu) beurteilen.

Kein zusätzlicher Ressourcen-, Missions- oder Belohnungsmechanismus vorgesehen; das Echo-Kristall-Beispiel ist zunächst ein atmosphärisches Motiv. Bei späterer Umsetzung bestehende Startflächen, Zugänge, Hindernisverteilung und RNG-Verträge schützen ([Architektur](../architecture.md)); Modellpflege gemäß [Rendering](../rendering.md#einzeln-wartbare-modelle). Umsetzung und endgültige Motivauswahl sind noch nicht freigegeben.
