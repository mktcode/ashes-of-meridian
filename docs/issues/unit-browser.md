Wir sollte auf dem Startbildschirm einen Button hinzufügen "Units and Buildings". Dann öffnet sich eine Übersicht aller Einheiten und gebäude mit deren Vorschaubild aus dem Baumenü.
Dort könnten später auch Einheiten freigeschaltet oder verstärkt werden oder so. Raum für weitere Features. Das sollte in der ersten Implementierung aber erstmal außen vor sein.
Nur eine reine Übersicht aller Einheiten, nach Fraktion.

## Modell-/Assetstand

- Alle 21 Gebäude und die sieben Fraktion-0-Einheiten haben eigene Modelldateien; aktueller Katalog und Pflegevertrag in [Grafik und Assets](../rendering.md#einzeln-wartbare-modelle).
- Alle 14 Fraktion-0-Aktionsportraits bilden die verfeinerten Modelle ab (320×320 WebP Q80, `assets/portraits/faction-0-<unit|building>-<type>.webp`). Die Übersicht kann diese lokalen Bilder und die bestehende Zuordnung in `src/ui/actions.js` wiederverwenden; kein zusätzliches WebGL-Rendering für Vorschaubilder nötig.
- Fraktion 1/2 verwenden im Aktionsmenü weiterhin Icons, keine eigenen Portraitdateien. Die Modellarbeit implementiert weder die Übersicht noch Freischaltungen/Verstärkungen.