Hängt ab von: docs/issues/3-maps.md

Architekturvorbereitung umgesetzt: eigene Rezepte unter `src/battlefields/`, generische Polygonprüfung über `BattlefieldBuilder.features` und Modell-Dispatch über `TerrainModels`. Die Darstellung und bisherigen Umrisse bleiben unverändert. Für neue Modelle passende CPU-Umrisse mitgestalten; Zugangs-/Kollisionstests erhalten.

Das Terrain einer Map ist außen von Gebirgen begrenzt. Innerhalb der Karte gibt es (meistens?) zwei größere blockierende Felsformationen, die den Charakter der Map maßgeblich bestimmen.

Für die Desert-Karte passt das. Für Alien Planet und Mothership sollten das keine Felsformationen sein sondern andere Models.

Alien Planet: Große, dichte Alienfauna. Kreative Gestaltung freigegeben; Zielgröße ausdrücklich **1,5× Breite und Tiefe von Desert**, also 270 × 270 m und **125 % mehr Fläche**. Die Größeninfrastruktur ist vorbereitet und bei `extent: 135`, `cellSize: 2.5` geprüft. Aktivierung, passende Start-/Ressourcenorte und Dichte folgen erst mit der Gestaltung; derzeit weiterhin 180 × 180 m.

Mothership: Große Hangars.

Vor dem Textureinsatz die bewusst umbenannten Quellen `texture-floor-alien-planet.webp` und `texture-floor-mothership.webp` in Einbettungsskript und Bytevergleich zuordnen und einbetten. Aktuell bleiben alte `bio`-/`metal`-Einbettungen aktiv; der Texturtest scheitert an den entfernten Quelldateinamen. Kartenboden und bestehende Materialtexturen für Modelle getrennt betrachten. Im Größenrefactoring keine Assets geändert.