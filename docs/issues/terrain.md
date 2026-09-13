Hängt ab von: docs/issues/3-maps.md

Architekturvorbereitung umgesetzt: eigene Rezepte unter `src/battlefields/`, generische Polygonprüfung über `BattlefieldBuilder.features` und Modell-Dispatch über `TerrainModels`. Die Darstellung und bisherigen Umrisse bleiben unverändert. Für neue Modelle passende CPU-Umrisse mitgestalten; Zugangs-/Kollisionstests erhalten.

Das Terrain einer Map ist außen von Gebirgen begrenzt. Innerhalb der Karte gibt es (meistens?) zwei größere blockierende Felsformationen, die den Charakter der Map maßgeblich bestimmen.

Für die Desert-Karte passt das. Für Alien Planet und Mothership sollten das keine Felsformationen sein sondern andere Models.

Alien Planet: Große, dichte Alienfauna
Mothership: Große Hangars