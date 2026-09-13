Vorbereitung: Das eigene Rezept liegt in `src/battlefields/desert.ts`, Ring-/Massivmeshes in `src/renderer/terrain-models.js`, kleine Felsmeshes weiterhin in `src/renderer/geometry.js`. Die drei Karten verwenden diese Felsmodelle bisher gemeinsam. Desert-spezifische Verfeinerungen dürfen die anderen Rezepte nicht stillschweigend verändern; deren Gestaltung ist separat offen. Polygonzahl und Farben sind noch unverändert.

Alle Felsformationen in der Map heben sich gerade zu stark vom Boden ab und ihre Geometrie ist teilweise etwas zu detailliert.

Der Anzahl der Polygone kann um ca. ein Drittel reduziert werden und die Farbe muss der der Bodentexture entsprechen.