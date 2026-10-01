# Eigene 3D-Karten importieren und später teilen

**Produktziel, kein Implementierungsauftrag.** Zuerst lokaler Dateiimport im profilfreien Skirmish/Test, keine Plattform, Uploadfunktion oder Ingame-Editor. [Skirmish-Regeln](new-battle-screen.md) vorher festlegen.

Eigene Geometrie/Oberflächen/statische Objekte plus Starts/Ressourcen/Sperren müssen möglich sein, nicht nur Koordinaten auf bestehendem Terrain. Nur validierte Daten, kein fremder JS-/Shadercode. CPU-Höhe und Kollisions-/Baumasken sind autoritativ; dekoratives GLB definiert keine Spielbarkeit. Genau eine Bodenhöhe je X/Z bleibt die [Systemgrenze](../architecture.md#welt-darstellung-und-zufall).

## Vor Umsetzung entscheiden

- [ ] Versioniertes Schema/Beispielpaket: ZIP mit `map.json`, begrenztem `scenery.glb`, WebP-Texturen/Qualität 80 und optionaler Vorschau. Numerische Höhen/Masken, keine verlustbehafteten Bilddaten oder erforderlichen `.bin`-Dateien.
- [ ] Koordinaten, Raster/Diagonale, Materialien/Transforms, einzelne Ressourcen/Vents versus bestehende Ankergruppen, Parteien/Starts und Fehlerbehandlung spezifizieren. Heutiger Einheiten-GLB-Importer ist kein allgemeiner Kartenloader.
- [ ] Grenzen für entpackte Daten, GPU-Texturen/-Geometrie und Instanzen am Prototyp festlegen; ZIP-Bomben/Pfadtraversal/externe URIs/unbekannte Erweiterungen abweisen.
- [ ] Validierung von Starts, Bauflächen, Fahrzeugwegen/Ressourcen und CPU-/GPU-Übereinstimmung; Fairness zusätzlich menschlich abnehmen. Keine automatische Expedition-/Multiplayeraufnahme.
- [ ] Späteres Teilen separat: Rechte, Versionierung, Moderation und identische vom Server akzeptierte Multiplayerfassung.

Noch kein lauffähiges `.aommap.zip`-Format. KI-Generierung erst mit maschinenlesbarem Schema und gültiger Beispielkarte beauftragen; ohne diese nur Konzept, keine Importierbarkeitsbehauptung.
