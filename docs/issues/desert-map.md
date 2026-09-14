# Desert: Materialabnahme und Felsverfeinerung

Gestaltungsziel bleibt die warme, trockene Wüste mit bodenfarbigen Felsen, nicht die dunkle Basaltlandschaft der KI-Referenz.

- Neue Boden-/Felsalbedos und Geröll-/Pflanzenatlanten menschlich abnehmen: Texturmaßstab, Kachelwiederholung, Dekordichte, Einheitenkontrast und Übergang von Felsen zu Boden. Die gelieferten Boden-/Felsquellen wurden vom Nutzer in GIMP als nahtlos bestätigt und werden ohne Spiegelung eingesetzt; Pflege unter [Grafik/Assets](../rendering.md).
- Felsformationen sind teilweise zu detailliert: Polygonzahl um etwa ein Drittel reduzieren. Farbangleichung nach Sichtung des neuen Felsmaterials beurteilen.
- Beleuchtung, Nebel/Postprocessing und weitere 3D-Geländedetails sind separate Folgeschritte; der Asset-Pass verändert weder Licht noch Geometrie.

Desert verwendet Ring-/Massivmeshes in `src/renderer/terrain-models.ts`; kleine Felsmeshes liegen in `src/renderer/geometry.ts`. Desert-spezifische Verfeinerungen dürfen Mothership oder die eigenständige Alien-Gestaltung nicht stillschweigend ändern. Bestehende Positionen, Kollisionsradien und Layout-RNG schützen.

Mothership besitzt eigene Hangarmodelle; seine [visuelle Abnahme](terrain.md) ist separat. Geräteprüfung unter [Playtest-Validierung](playtest-validation.md).
