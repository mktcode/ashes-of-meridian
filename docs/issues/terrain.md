# Terrain: verbleibende Mothership-Gestaltung

Mothership verwendet weiterhin den Gebirgsring und meist zwei blockierende Felsmassive. Diese sollen durch große Hangars mit passenden CPU-Umrissen und freien Basis-/Ressourcenzugängen ersetzt werden. Das eigene Rezept liegt in `src/battlefields/mothership.ts`; die Bodenquelle ist `assets/textures/texture-floor-mothership.webp`.

Alien Planet ist inzwischen eigenständig gestaltet: 270 × 270 m (+125 % Fläche), organischer Boden, zwei vergrößerte blockierende Pilz-/Wurzelhaine, kleinere Kolonien, einzelne Jungpilze am inneren Kartenrand, niedrige Dekoration und äußerer Vegetationsgürtel. Seine Meshfabriken liegen getrennt in `src/renderer/alien-terrain.js` und sollen durch Mothership-Arbeiten nicht verändert werden. Menschliche Langzeit- und Echtgerätetests bleiben offen.

Die bewusst umbenannten Floor-Texturen sind im Einbettungsskript und Bytevergleich synchronisiert. Die Bildbytes der bisherigen `metal`-/`bio`-Materialien sind identisch geblieben; Alien verwendet `bio` zusätzlich als Boden. Für Mothership Bodenauswahl und Modelle bewusst gestalten, ohne gemeinsame Materialtexturen oder Desert nebenbei zu verändern.

Gemeinsame Infrastruktur: `BattlefieldBuilder.features` prüft Polygonumrisse und Zugänglichkeit; `TerrainModels` löst deklarierte Modelle auf. Größen, Layouts und Renderprofile gehören in die jeweilige Kartendefinition. Keine rein grafischen Hangars über unpassenden Bergblockern.
