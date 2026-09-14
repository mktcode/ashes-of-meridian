# Desert: Felsen an den Boden angleichen

Felsformationen heben sich zu stark vom Boden ab und sind teilweise zu detailliert. Polygonzahl um etwa ein Drittel reduzieren und Farbe an die Bodentextur angleichen.

Desert verwendet Ring-/Massivmeshes in `src/renderer/terrain-models.ts`; kleine Felsmeshes liegen in `src/renderer/geometry.ts`. Desert-spezifische Verfeinerungen dürfen Mothership oder die eigenständige Alien-Gestaltung nicht stillschweigend ändern. Bestehende Positionen, Kollisionsradien und Layout-RNG schützen.

Mothership besitzt eigene Hangarmodelle; seine [visuelle Abnahme](terrain.md) ist separat. Geräteprüfung unter [Playtest-Validierung](playtest-validation.md).
