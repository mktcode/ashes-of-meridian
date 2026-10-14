# Gestaltungsziele

**Stilisiertes 3D-Sci-Fi mit atmosphärischem Miniatur-Diorama-Look.**
Modellhafte Gebäude und Einheiten, charaktervolle fremde Landschaften und gezielte
Lichtakzente: weder Fotorealismus noch Comic oder grobe Platzhalter.
Keine Freigabe für einen Grafikumbau; [Assetpflege](assets.md).

## Welt

- Große klare Silhouetten vermitteln Rolle und Fraktion im normalen Gefechtszoom;
  Detail unterstützt sie, nicht maximale realistische Abnutzung.
- Technische Kolonien verbinden modularen Metallbau mit cyanfarbenen und warmweißen
  Lichtdetails. Biologische Fraktionen behalten eigene Formen und Materialidentität.
- Gedämpfte Landschaften tragen technische/organische Akzente. Gemeinsame Stimmung
  verlangt keine uniforme Palette über alle Familien.
- Dunst, Licht und Schatten sind künstlerisch komponiert. Nacht darf ruhig, fremd und
  leicht melancholisch wirken; Gelände und relevante Objekte bleiben lesbar.
- Bloom und Tilt-Shift unterstützen die Miniaturwirkung, dürfen Formen nicht verwischen.
  Auch reduzierte Qualität muss dieselbe gestalterische Identität behalten.
- Atmosphäre, Vegetation und Effekte dürfen Ressourcen, Auswahl und Kampf nicht verdecken.

## UI

Vorlage: **OUTPOST / 02 — Licht, Kante, Tiefe**, eingebettete Materialschicht der
externen HTML-Demo `/home/mkt/Downloads/aom-moodboard/moodboard.html`, nicht deren ältere
separate CSS-/Tokenfassung. Keine Mockup-Inhalte, Steuerlogik oder Demo-Hintergründe übernehmen.

Dunkle Navy-Flächen, abgeschrägte Doppelkonturen und dezenter Glow. Cyan für Bedienbarkeit/
Auswahl, Bernstein für Kosten/Warnungen/Fortschritt, Rot für Verlust, Violett für Energie.
Keine dauernden Glanzläufe; reduced motion und forced colors bleiben bedienbar.

`styles/design-system.css` pflegt die gemeinsame Materialschicht nur auf UI-Wurzeln,
keine Theme-Tokens auf `:root` oder globalen Buttonregeln. Weltcanvas, Picking und
Diagnoseanzeigen gehören nicht dazu. Dekoration fängt keine Eingaben ab; Controls und
Text bleiben ungeclippt. Das HUD liegt über der fullscreen Welt, nicht in einem
verkleinerten Viewport. Layout, Zustände und Abmessungen sind ausschließlich im Code maßgeblich.

## Abnahme

Modelle/Materialien im Zusammenhang mit Welt, Fraktion und normalem Gefechtszoom
beurteilen, tags/nachts und auf Zielgeräten. Build oder Standbild bestätigt weder
Stimmung noch Touch-Ergonomie. [Offene Bildabnahme](issues/landschaften-und-taktische-darstellung.md).
