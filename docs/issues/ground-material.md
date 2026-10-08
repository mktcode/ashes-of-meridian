# Bodenmaterial: nasse Lichtakzente

Darstellungsgrenzen und Qualitätsstufen: [Rendering](../rendering.md#lichtanimation-und-kampfakzente). Keine allgemeine Neugestaltung von Beleuchtung, Bloom, Modellen oder Terrainverteilung.

- [ ] Nasse Böden bei normalem Gefechtszoom in High/Balanced menschlich abnehmen: farbige Glanzspuren statt flächiger Aufhellung, keine auffälligen Texturkacheln oder flimmernden Glanzpunkte bei Kamerabewegung. Regnerische Myzel-/Graswelten, Wege und signierte nasse Ufer sowie trockene/Fels-/Schneeflächen als Gegenproben. Schein ist schattenlos wie das vorhandene lokale Licht; Lichtdurchtritt bleibt dessen bekannte Grenze.
Gerätekosten dichter beleuchteter Basen und nasser Materialien werden zentral unter [Performance/Renderer](performance/README.md#renderer-und-gpu) geführt. Kostenneutralität auf integrierten GPUs und Mobilgeräten ist nicht nachgewiesen; die visuelle Abnahme hier bleibt davon getrennt.

Prüfgrenze: Der bestehende Rendererfall `diagnostic hooks bracket real render passes` erwartet zwei Vollbilddreiecke, zählt aber eines. Mit ursprünglichem Szenenshader gleicher Fehler; für diesen Bodenauftrag unverändert gelassen. Keine KI-/Simulationstests ausgeführt.
