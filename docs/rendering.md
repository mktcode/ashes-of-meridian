# Grafik und Assets

Diese Referenz beschreibt Pflegeverfahren und Darstellungsgrenzen. Meshbudgets, Bounds, Shaderwerte und CSS-Maße stehen modellnah in Quellen/Tests, nicht in einem zweiten Markdown-Katalog.

## Texturen und Portraits

- Gepflegte Rasterbilder sind WebP mit Qualität 80; bei Dekoratlanten den Alphakanal erhalten.
- Kanonische WebGL-Texturen liegen unter `assets/textures/`. Nach Änderungen `npm run embed:textures` und anschließend `npm run build` ausführen. Das Skript übernimmt die Bildbytes unverändert in `src/renderer/assets.js`; diese Datei nicht direkt bearbeiten. Einbettung ist bewusst kein stiller Build-Schritt, der Bytevergleich liegt in den Terrain-Tests.
- WebGL lädt diese Texturen aus eingebetteten Data-URLs, damit Uploads auch über `file://` ohne gelockerte Sicherheitsflags funktionieren. Boden und Felsen sind weltprojiziert; Metall/Bio an Entitäten verwenden lokale Meshkoordinaten. Materialbilder können mehrere Modelle und Karten betreffen: nicht für eine einzelne Gestaltung unbemerkt gemeinsam austauschen.
- HUD-Portraits sind dagegen lokale HTML-Bilder unter `assets/portraits/` und müssen mit ausgeliefert werden. Dateinamen verwenden [technische IDs](architecture.md#technische-ids-und-anzeigenamen), nicht Spielernamen.
- Nach einer Modelländerung das zugehörige Portrait bei Bedarf **manuell** aus dem tatsächlichen Modell erneuern: fertiges/unbeladenes Modell, eigene Teamfarben, Balanced, ohne Welt/Himmel, 320×320, WebP-Qualität 80. Kein automatischer Portraitgenerator oder Build-Synchronisationszwang.

## Einzeln wartbare Modelle

Modellaufträge benennen Fraktion, Art/Typ, Silhouettenziel, Bounds, erlaubte Animation, Geometriebudget und Portrait. Die Assemblierung gehört in ihre eigene Datei unter `src/renderer/models/`; lokale Meshfabriken/Helfer bleiben gekapselt. Nicht beteiligte Modelle nicht vorsorglich migrieren.

`registerEntityModel` registriert stabile ID, synchrone Meshfabriken und `render(context)`. Registrierung erfolgt vor Content und ohne GPU-Zugriff; dort noch keine Fraktionskataloge auswerten. Neue Dateien gemäß [Ladevertrag](architecture.md#auslieferung) einbinden. Fabriken liefern Position, Normale und relativen RGB-Tint, einmalig beim Rendererstart; keine Geometrieerzeugung oder Zufallsaufrufe im Frame.

Welttransformation, Bauhöhe, Team-/Ghost-/Previewdarstellung sowie Fundament und Baugerüst bleiben im gemeinsamen Adapter. Das Modell zeichnet über den bereitgestellten Kontext, nicht über direkten Simulations-/Rendererzugriff. Bei Einheiten löst `surfaceColor` Sonderlackierungen zentral auf; bei Gebäuden hält `baseRotation` Fundamentausrichtung und unabhängigen Turmkopfwinkel auseinander.

Modelltests und gemeinsame Helfer unter `tests/models/` bzw. `tests/helpers/` prüfen Geometrie, Varianten und Isolation. Beabsichtigte Verfeinerungen dürfen keine Kollisionsradien, Ausfahrten, Animationen oder unbeteiligten [Zeichenreferenzen](reference-tests.md) nebenbei ändern. Teilinstanzen sind nicht Draw Calls: eigene Meshchargen und zusätzliche Dreiecke getrennt bewerten, einschließlich Schattenwiederholung.

## Terrain und Renderpässe

- Kartenrezepte wählen Boden, Palette, Renderprofil und deklarierte Terrainmodelle. Neue Modelle über `TerrainModels` anbinden, nicht als Karten-Sonderfall im GPU-Adapter. Weltgeometrie nur beim Weltwechsel erzeugen/hochladen.
- Dekoration und blockierende Geometrie unterscheiden; sichtbare Hindernisse und CPU-Kollision gemeinsam gestalten. Layoutmaße, geschützte Zugänge und RNG-Trennung folgen dem [Weltvertrag](architecture.md#welt-darstellung-und-zufall).
- Bodenatlanten verteilen ihre Details mit eigenem Weltkoordinaten-/Seed-Hash, nicht dem Simulations-RNG. Atlasrechtecke und Mip-Sampling müssen Nachbarmotive fernhalten; flache Details erzeugen keine Kollisionskörper oder eigenen Schatten.
- Szenenziel → gegebenenfalls MSAA-Resolve → Postprocessing; Schatten bleiben ein separater Pass. Alle Qualitätsstufen verwenden dieselben Modelle. High/Balanced bieten MSAA mit Allokationsfallback, Schatten und Bloom; High ergänzt Tilt-Shift. Performance reduziert Renderauflösung und verzichtet auf diese Effekte. HUD/2D-Overlays werden nicht durch Postprocessing gefiltert.
- Zusätzliche Geometrie und Texturspeicher sind trotz Instanzierung Kosten, keine Performanceverbesserung an sich. Hohe Berge/Baumkronen können Einheiten verdecken; es gibt keine dynamische Ausblendung. Technische Checks ersetzen keine visuelle oder Echtgeräteabnahme.

## Viewport und HUD

`#worldViewport` begrenzt Canvas, Overlay und Vignette. Im Gefecht reicht er von der Topbar bis zum mittleren Werkzeugblock; höhere Seitenpanels überdecken die unteren Weltecken und fangen dort DOM-Eingaben ab. Menüvorschauen nutzen den ganzen Bildschirm.

Projektion und Picking verwenden dieselben gemessenen CSS-Client-Grenzen; das Overlay berücksichtigt deren Offset, die Minimap die tatsächlichen Viewportecken. Menüwechsel, Container-/Fenster-Resize und Kartenwechsel müssen diese Grenzen synchronisieren. Kein DOM-Messen pro Einheit. Die orthografische Zoomeinheit bleibt an die Fensterhöhe gebunden; Viewportänderung ist deshalb nicht automatisch eine Zoomänderung.

UI-Fortschritt folgt Simulationswerten, nicht einer zweiten Queue oder unabhängigen CSS-Uhr. Für Layoutpflege die gesamte Stylesheet-Kaskade prüfen; erreichbare Aktionen und Scrollflächen sind wichtiger als feste Pixelwerte in Dokumentation.

Audioquellen und Freigabeverfahren: [Musikpflege](../music-drafts/README.md#herstellung-und-grenzen).

[Prüfwahl und menschliche Abnahme](testing.md) · [offene Geräte-/Run-Validierung](issues/playtest-validation.md)
