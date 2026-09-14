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

Welttransformation, Bauhöhe, Team-/Ghost-/Previewdarstellung sowie die Wahl des Standardfundaments und das Baugerüst bleiben im gemeinsamen Adapter. Gewöhnliche Choir-Gebäude erhalten dort einen flachen Erdhügel statt Platte und fester Leuchtumrandung. Ausnahme ist die Bloom queen: Ihre fünfblättrige Blüte gehört zum HQ-Modell; der Adapter zeichnet darunter kein zusätzliches Fundament. Taktische Markierungen bleiben davon unabhängig. Das Modell zeichnet über den bereitgestellten Kontext, nicht über direkten Simulations-/Rendererzugriff. Bei Einheiten löst `surfaceColor` Sonderlackierungen zentral auf; bei Gebäuden hält `baseRotation` Fundamentausrichtung und unabhängigen Turmkopfwinkel auseinander.

Modelltests und gemeinsame Helfer unter `tests/models/` bzw. `tests/helpers/` prüfen Geometrie, Varianten und Isolation. Beabsichtigte Verfeinerungen dürfen keine Kollisionsradien, Ausfahrten, Animationen oder unbeteiligten [Zeichenreferenzen](reference-tests.md) nebenbei ändern. Teilinstanzen sind nicht Draw Calls: eigene Meshchargen und zusätzliche Dreiecke getrennt bewerten, einschließlich Schattenwiederholung.

## Terrain und Renderpässe

- Kartenrezepte wählen Boden, Palette, Renderprofil und deklarierte Terrainmodelle. Neue Modelle über `TerrainModels` anbinden, nicht als Karten-Sonderfall im GPU-Adapter. Weltgeometrie nur beim Weltwechsel erzeugen/hochladen.
- Dekoration und blockierende Geometrie unterscheiden; sichtbare Hindernisse und CPU-Kollision gemeinsam gestalten. Layoutmaße, geschützte Zugänge und RNG-Trennung folgen dem [Weltvertrag](architecture.md#welt-darstellung-und-zufall).
- Bodenatlanten verteilen ihre Details mit eigenem Weltkoordinaten-/Seed-Hash, nicht dem Simulations-RNG. Atlasrechtecke und Mip-Sampling müssen Nachbarmotive fernhalten; flache Details erzeugen keine Kollisionskörper oder eigenen Schatten. Bei Atlaswechseln Motivgrenzen und transparente Ränder neu prüfen, nicht nur die Bilddatei ersetzen.
- Desert verwendet regulär wiederholte Boden- und Felsalbedos, ohne Spiegelung oder Kantenbearbeitung der Quellen. Das optionale `rockSurface` im Renderprofil trennt das Felsmaterial vom Boden; senkrechte Projektionen halten die Gesteinsschichten horizontal, der Fuß geht in den örtlichen Boden über. Ohne diese Option bleibt das bodenbasierte Felsmaterial erhalten.
- Lichtfarben für Sonne, Himmel und Bodenreflexion kommen aus dem Karten-Renderprofil; Vorschauen nutzen ein neutrales Standardlicht. Material-IDs steuern Glanz und eine analytische Umgebungsreflexion ohne zusätzliche Texturen. Helle Werte werden bereits im Szenenshader vor Fog und RGBA8-Ausgabe weich komprimiert: Das ist kein HDR-Framebuffer und kein nachträgliches Wiederherstellen abgeschnittener Highlights.
- Die Shadowmap folgt dem sichtbaren Ausschnitt in einer festen Lichtbasis, mit quantisierten Ausmaßen und texelgerastertem Zentrum gegen Flimmern beim Schwenken. Größere Modelle bzw. höheres Terrain erfordern eine Neubewertung der Receiver-Höhengrenze und Caster-Reserve. Licht- und Schattenrichtung müssen übereinstimmen. Performance überspringt auch diese Anpassung.
- Weiche Bodenkontaktschatten sind untexturierte Effekt-Quads, keine SSAO: eine gemeinsame Charge, zwei Dreiecke je sichtbarer Einheit/Gebäude, keine Schattenwiederholung. Sie berücksichtigen Fog und Tiefentest; erhöhte Geometrie kann sie verdecken. Performance, Menüs und Bauvorschauen erhalten keine Quads.
- Szenenziel → gegebenenfalls MSAA-Resolve → Bloom-Extraktion und separable Unschärfe → Postprocessing; Schatten bleiben ein separater Pass. Bloom nutzt zwei RGBA8-Ziele mit je einem Viertel der Szenenbreite/-höhe, ohne Tiefe/MSAA. Die Extraktion gewichtet Spitzenhelligkeit und Luminanz vor dem Mitteln, damit kleine Lampen erhalten bleiben und normaler Boden nicht flächig aufhellt; sehr helle Reflexe können ebenfalls beitragen. Das ist keine separate Emissionsmaske. Drei kleine Pässe ersetzen die vielen Vollauflösungs-Bloom-Samples; die Komposition nutzt einen zusätzlichen Sample. Allokationsfehler schalten Bloom ab; Resize und Performance geben seine Ziele frei.
- Alle Qualitätsstufen verwenden dieselben Modelle. High/Balanced bieten MSAA mit Allokationsfallback, Schatten und Bloom; High ergänzt Tilt-Shift als ausdrücklich gewünschten Miniaturlook; nicht als vermeintlichen Schärfefehler entfernen oder abschwächen. Performance reduziert Renderauflösung und verzichtet auf diese Effekte. HUD/2D-Overlays werden nicht durch Postprocessing gefiltert.
- Zusätzliche Geometrie und Texturspeicher sind trotz Instanzierung Kosten, keine Performanceverbesserung an sich. Hohe Berge/Baumkronen können Einheiten verdecken; es gibt keine dynamische Ausblendung. Technische Checks ersetzen keine visuelle oder Echtgeräteabnahme.

## Lichtanimation und Kampfakzente

Leuchtende Modellteile variieren ihre vorhandene Glühstärke über Simulationszeit, stabile Entitäts-ID und lokale Teilepositionen: langsame Statuslichter, organisches Pulsieren bzw. räumlich versetzte Energieimpulse. Geometrie und Teamfarben bleiben gleich. Schwach glimmende Teile bleiben statisch, damit die Animation nicht die Textur-Schaltschwelle im Szenenshader überquert. Ressourcen, taktische Ringe, Menü-/Bauvorschauen und Performance sind davon ausgenommen.

Neue Bewegungs- und Kampfakzente besitzen feste Qualitätsbudgets, keine zusätzlichen Echtzeitlichter und keine Simulations-RNG-Aufrufe. Performance lässt nur diese Ergänzungen weg, nicht die bisherigen CPU-Effekte. Schussstrahlen erhalten schwach referenzierte, nicht serialisierte Metadaten zur Unterscheidung von Arbeits-/Heilstrahlen und für eine angenäherte Auftrefffläche. Funken beachten zusätzlich die Sicht am Ziel; Artillerieblitze enden kurz nach dem Start, nicht erst beim Einschlag.

Staub bei schweren Bodeneinheiten wird ausschließlich im View aus tatsächlich beobachteter Bewegung abgeleitet. Die kurzlebigen Wolken bleiben nach dem Ausstoß an ihrer Weltposition und altern mit Simulationszeit. Pro Renderer/Welt begrenzter Zustand wird bei Sichtverlust, Verlassen des Ausschnitts, Wechsel zu Performance oder Weltwechsel verworfen; es gibt kein Nachspielen unsichtbarer Bewegung und keine dauerhaften Bodenspuren. Bestehende CPU-Effekte weiterhin unverändert erzeugen/ticken: deren [RNG-Vertrag](architecture.md#welt-darstellung-und-zufall) ist davon unabhängig.

## Viewport und HUD

`#worldViewport` begrenzt Canvas, Overlay und Vignette. Im Gefecht reicht er von der Topbar bis zum mittleren Werkzeugblock; höhere Seitenpanels überdecken die unteren Weltecken und fangen dort DOM-Eingaben ab. Menüvorschauen nutzen den ganzen Bildschirm.

Projektion und Picking verwenden dieselben gemessenen CSS-Client-Grenzen; das Overlay berücksichtigt deren Offset, die Minimap die tatsächlichen Viewportecken. Menüwechsel, Container-/Fenster-Resize und Kartenwechsel müssen diese Grenzen synchronisieren. Kein DOM-Messen pro Einheit. Die orthografische Zoomeinheit bleibt an die Fensterhöhe gebunden; Viewportänderung ist deshalb nicht automatisch eine Zoomänderung.

UI-Fortschritt folgt Simulationswerten, nicht einer zweiten Queue oder unabhängigen CSS-Uhr. Für Layoutpflege die gesamte Stylesheet-Kaskade prüfen; erreichbare Aktionen und Scrollflächen sind wichtiger als feste Pixelwerte in Dokumentation.

Audioquellen und Freigabeverfahren: [Musikpflege](../music-drafts/README.md#herstellung-und-grenzen).

[Prüfwahl und menschliche Abnahme](testing.md) · [offene Geräte-/Run-Validierung](issues/playtest-validation.md)
