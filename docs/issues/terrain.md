# Terrain: verbleibende Mothership-Gestaltung

Mothership verwendet noch Gebirgsring und blockierende Felsmassive. Diese durch große Hangars mit passenden CPU-Umrissen und freien Basis-/Ressourcenzugängen ersetzen. Rezept: `src/battlefields/mothership.ts`, Bodenquelle: `assets/textures/texture-floor-mothership.webp`.

`BattlefieldBuilder.features` prüft Polygonumrisse und Zugänglichkeit, `TerrainModels` löst deklarierte Modelle auf. Größe, Layout und Renderprofil gehören ins Kartenrezept. Keine rein grafischen Hangars über unpassenden Bergblockern.

Desert teilt bisher die Felsmodelle; seine [Verfeinerung](desert-map.md) ist separat offen. Alien Planet besitzt eigene Pflanzenmodelle und Wurzelblocker. Beide Karten bei Mothership-Arbeiten unverändert lassen. Gemeinsame Materialtexturen nicht nebenbei austauschen: Mothership-/Alien-Floor-Dateien werden auch als Metall-/Bio-Material verwendet.

Visuelle und echte Geräte-/Langzeitabnahme bleibt unter [Playtest-Validierung](playtest-validation.md) offen.
