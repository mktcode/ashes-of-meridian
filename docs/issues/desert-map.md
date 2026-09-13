# Desert: Felsen an den Boden angleichen

Felsformationen heben sich zu stark vom Boden ab und sind teilweise zu detailliert. Polygonzahl um etwa ein Drittel reduzieren und Farbe an die Bodentextur angleichen.

Desert und Mothership teilen Ring-/Massivmeshes in `src/renderer/terrain-models.js`; kleine Felsmeshes liegen in `src/renderer/geometry.js`. Desert-spezifische Verfeinerungen dürfen Mothership oder die eigenständige Alien-Gestaltung nicht stillschweigend ändern. Bestehende Positionen, Kollisionsradien und Layout-RNG schützen.

[Mothership-Gestaltung](terrain.md) bleibt ein separater Auftrag; visuelle Abnahme durch den Menschen, Geräteprüfung unter [Playtest-Validierung](playtest-validation.md).
