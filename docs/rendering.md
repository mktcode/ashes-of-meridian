# Grafik und Assets

Darstellungs- und Pflegeverträge; Formen, Budgets, Shaderwerte und CSS-Maße stehen im Code.

## Texturen und Portraits

Rasterquellen ausschließlich WebP, Qualität 80; benötigten Alphakanal erhalten. Nach Texturänderungen `npm run embed:textures`, nach GLB-Änderungen `npm run embed:models`, danach Build. Generierte Einbettungen niemals direkt bearbeiten. Eingebettete Data-URLs erhalten `file://`; CSS-Vorschaubilder bleiben zusätzliche lokale Laufzeitassets.

Alte Portrait-/Albedoquellen nicht wegen fehlender aktueller WebGL-Nutzung löschen. Neue Bildassets brauchen einen konkreten Bedarf; Codex-/Aktionskacheln verwenden Modelle. Assetnamen folgen [technischen IDs](architecture.md#technische-ids-und-anzeigenamen).

## Prozedurale Oberflächen

`src/renderer/materials.ts` ist die Quelle für opake Materialien. Albedo und Mikrohöhe werden einmal bei fehlender Residenz gebacken; der Alphakanal trägt dort Höhe, **nicht Transparenz**. Foliage/Dekor behalten ihren eigenen Alphavertrag. Keine Pixelarchive je Seed oder Materialuploads pro Frame.

Materialvariation ist kosmetisch und RNG-neutral. Mikrorelief verändert weder Silhouette, Picking noch Kollision. Weltprojektion, lokale Modellprojektion und physischer Kachelmaßstab sind getrennte Verträge. Gemeinsame Materialien nicht für ein einzelnes Modell unbemerkt ändern.

## Landschaftszonen und Wetter

Habitat, Dekor und Wetter folgen eigenen Landschaftsseed-Quellen nach dem [CPU-Weltaufbau](architecture.md#weltrezepte-und-feste-designs). Große Dekorumrisse einschließlich Windreserve bleiben in gesperrten Bereichen; niedriger Bodendekor darf befahrbar sein. Platzierungsbudgets skalieren nicht automatisch mit Kartengröße.

Windfunktion/Uhr müssen in Szenen- und Schattenpass übereinstimmen; Culling-Bounds enthalten Bewegung. Wetter verwendet begrenzte View-Instanzen, keine Simulationspartikel. Seine Uhr hält bei Pause; im Netzwerk gilt die Interpolationsuhr. Performance darf kosmetische Arbeit auslassen, niemals CPU-Layout verändern.

## Einzeln wartbare Modelle

Modelle registrieren technische ID, synchrone Meshfabriken und `render(context)` ohne GPU-Zugriff oder frühe Contentauswertung. Neue Dateien gemäß [Ladevertrag](architecture.md#auslieferung) einbinden. Geometrie entsteht einmal, nicht im Frame; Modellcode zeichnet über den Kontext, nicht über direkten Simulationszugriff.

Gemeinsamer Adapter besitzt Welt-/Bauhöhe, Team-/Ghost-/Previewtönung und Standardfundamente; modelllokale Fundamente dürfen nicht zusätzlich die Standardplatte bekommen. Feste Farbflächen ebenfalls über `surfaceColor` führen. Gebäudegrundrotation und Turmkopfwinkel nicht vermischen. Hanglage und Flugpose lesen die CPU-Oberfläche, keine eigene Fahrphysik/IK.

Schwere Luftzerstörer verwenden autorisierte GLBs. Der Importer ist **kein allgemeiner glTF-Loader**; nur seine unterstützten Mesh-/Farb-/Knotenverträge gelten. Neutralmeshes für Vorschauen erhöhen zusätzlich die Residenzkosten. Originalquellen nicht stillschweigend vereinfachen oder ersetzen.

## Modellkacheln

Kleine Kacheln sind zwischengespeicherte Standbilder; nur die Codex-Detailansicht bleibt live. Sie leihen den vorhandenen WebGL-Kontext und Modellmeshes, ohne zweite Welt/GPU-Geometrie. Der begrenzte flüchtige Cache berücksichtigt Modell, Qualität, Pixelgröße und Materialbereitschaft.

Cache-Misses erzeugen höchstens ein sichtbares Modell je Renderframe und kopieren synchron aus dem Hauptcanvas; danach überschreibt die Szene das Scratch-Rechteck. **Nur innerhalb des Rendercallbacks aufnehmen.** Unterstütztes 2× MSAA wird separat aufgelöst; kein direkter MSAA-Blit in einen möglicherweise anders formatierten Hauptcanvas. Der Subpixel-Fallback braucht zwei Kopien derselben eingefrorenen Pose, keine Animation. Fehlgeschlagene Allokation nicht jeden Frame wiederholen.

Verdrängte Bilder und endgültig verlassene Vorschauen geben eigene Ressourcen frei. Cache-Hits zeichnen/kopieren nicht erneut aus WebGL; Cache-Misses können trotzdem synchronisieren. [Offene Abnahme](issues/modell-kacheln.md).

## Terrain und Renderpässe

Ein gemeinsamer Renderer bedient alle Modi/Karten. `BattlefieldView` übernimmt CPU-`renderData` ohne Mutation und besitzt erzeugte Weltmeshes. Karten-/Scenerywechsel gibt deren VBOs/VAOs frei; gleiche Scenery darf wiederverwenden. Fog-Revision ist keine Geometrierevision. Meshnamen dürfen nicht mit gemeinsamen Primitiven/Modellen kollidieren.

Komponierte Umgebungen besitzen nur eigene Programme/Texturen/Tiefenziele/Fences. Registrierung allokiert nichts; Wechsel, Resize und Seitenende geben jeweils betroffene Ressourcen frei, niemals gemeinsam geliehene Programme. Neue Terrainmodelle deklarativ registrieren statt Karten-Sonderzweige im GPU-Adapter einzubauen.

- GPU-Boden folgt CPU-Dreiecken; Dekorauflage niemals aus unabhängigem Noise/bilinearen Samples ableiten. Außenkulisse und dekorativer Flussgrund dürfen abweichen, sind aber kein spielbarer Boden.
- Vertex-Tint ist bei Spezialmaterialien **kein gewöhnliches RGB**: Landschaftsgewichte, Foliage-UV/Helligkeit und Wasser-Tiefe/Flussrichtung haben eigene Belegungen. Alpha-Cutoff in Schatten/Szene identisch halten.
- Wasser zeichnet ein überlappungsfreies Feld ohne Tiefenschreiben nach opaker Szene, vor Effekten. Reflexion ist analytisch, kein zusätzlicher Szenenpass.
- Chunk-/Instanzculling muss vollständige transformierte Bounds einschließlich hoher Geometrie und außerhalb der Kamera liegender Schatten-Caster erhalten. Draw Calls allein sind kein Optimierungsmaß.
- Szenenziel → optional MSAA-Resolve → Bloom → Postprocessing; Schatten separat. Allokationsfehler brauchen saubere Fallbacks, Resize gibt alte Ziele frei. Aurelions Tiefenresolve verlangt passende Maße/Format und `NEAREST`.
- Texturwechsel lädt neue Ressourcen vor Freigabe alter kartenspezifischer Bestände. Bereitschaft nicht durch feste Wartezeit oder `gl.finish()` ersetzen.

High/Balanced teilen Modelle, Schatten/MSAA/Bloom; High ergänzt den ausdrücklich gewünschten Tilt-Shift-Look. Performance reduziert Auflösung und kosmetische Arbeit. HUD bleibt ungefiltert. Atmosphäre wird einmal pro Welt aufgelöst; gemeinsame Licht-/Schattenrichtung bleibt künstlerisch, nicht astronomisch. RGBA8 ist kein HDR.

## Kontursilhouetten bei Verdeckung

Nur beobachtete Entitäten und erkundete Ressourcen dürfen hinter opaker **statischer** Geometrie erscheinen. Silhouetten verleihen keine Sicht/Befehlsrechte; Intro, Fog, Ghosts und Vorschauen dürfen nicht optieren. Netzwerk nutzt nur sichtgefilterte Renderposen. Dynamische Armeen/Gebäude und nicht tiefenschreibende Transparenz sind keine Auslöser.

Bereits aufgebaute Modelltransforms werden nach statischer Szene, vor normalen Entitäten mit invertiertem Tiefentest gezeichnet; kein erneuter Animationsaufbau. GL-Zustand anschließend vollständig wiederherstellen, einschließlich gecachter Stadtbindungen. Zusätzliche Geometriedurchläufe sind reale Kosten.

## Lichtanimation und Kampfakzente

Kosmetische Akzente folgen Simulations-/Interpolationszeit und eigenen begrenzten View-Budgets, ohne neue Spielzustände oder Simulations-RNG. Sichtverlust/Welt-/Perspektivwechsel darf keine alten Spuren oder Effektstapel nachspielen. CPU-Effekte weiterhin gemäß ihrem [RNG-Vertrag](architecture.md#welt-darstellung-und-zufall) erzeugen/ticken.

Effektculling enthält ganze Strahlen, Radien und Höhenhüllen, nicht nur Zentren; dynamische Schatten-Caster bleiben erhalten. Gepoolte Partikelreferenzen gelten nur bis Ablauf/Verdrängung/Reset. In-place-Verdichtung muss Zeichenreihenfolge und RNG-Aufrufe erhalten.

## Menü-Landschaftswechsel

Ein Stage-Wechsel kopiert das fertig gerenderte Canvas **einmal im Rendercallback** in ein temporäres 2D-Canvas. Kein `preserveDrawingBuffer`, kontinuierliches Readback oder zweite live Welt. Das Standbild überbrückt Welt-/Texturladen; erst der erste fertige neue Frame startet die Compositor-Überblendung.

Ersetzende Vorschau/Gefechtsstart verwirft Animation/Bildspeicher und entwertet alte asynchrone Ergebnisse. Reduced motion überspringt Animation, nicht Bereitschaft. [Archivzustand](architecture.md#zustands--und-verantwortungsgrenzen).

## Viewport und HUD

Projektion, Picking und Overlay lesen dieselben gemessenen CSS-Clientgrenzen von `#worldViewport`, einschließlich Offset. Resize/Moduswechsel synchronisieren sie; kein DOM-Messen je Einheit. Orthografischer Zoom bleibt an Fensterhöhe gebunden. Gesamte CSS-Kaskade prüfen; UI-Fortschritt folgt Simulation, keiner zweiten Queue/CSS-Uhr.

Bauflächenfarben sind abgetastete Orientierung, kein Ersatz für den Validator am tatsächlichen Klick. Nie ungesehene Einheiten über Farbe offenlegen. [Prüfwahl](testing.md) · [Darstellungsabnahme](issues/project-tomorrow.md) · [Audio und Sprachpflege](audio.md).
