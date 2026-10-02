# Grafik und Assets

Darstellungs- und Pflegeverträge; Formen, Budgets, Shaderwerte und CSS-Maße stehen im Code.

## Texturen und Portraits

Rasterquellen ausschließlich WebP, Qualität 80; benötigten Alphakanal erhalten. Nach Texturänderungen `npm run embed:textures`, nach GLB-Änderungen `npm run embed:models`, danach Build. Generierte Einbettungen niemals direkt bearbeiten. Eingebettete Data-URLs erhalten `file://`; CSS-Vorschaubilder bleiben zusätzliche lokale Laufzeitassets.

Alte Portrait-/Albedoquellen nicht wegen fehlender aktueller WebGL-Nutzung löschen. Neue Bildassets brauchen einen konkreten Bedarf; Codex-/Aktionskacheln verwenden Modelle. Assetnamen folgen [technischen IDs](architecture.md#technische-ids-und-anzeigenamen).

Technische Plattformkarten besitzen einen eigenen Plan-Meshpfad statt des geglätteten Landschaftsskins: ebene polygonale Deckoberseiten mit seedabhängigen, polygonal angenäherten Rundungen oder geraden Eckschrägen, harte Wandnormalen und geneigte Rampen aus dem CPU-Konstruktionsplan. Kontur und CPU-Flächenprüfung verwenden dieselben Eckabschnitte; gemalte Plattenfugen bleiben innerhalb der Kontur. Das gerundete obere Kantenprofil und die umlaufende Hohlkehl-Sockelleiste am Wandfuß sind rein kosmetisch innerhalb des konservativen CPU-Klippenrands. Eigener Detailseed variiert Deckfarbtöne, Wandpaneele/Lamellen und bündige Serviceabdeckungen; separate kleine Signalleuchten tragen Emission. Paneele und Lamellen skalieren vertikal mit der Wandhöhe, statt bei niedrigeren Stufen über die Deckoberseite hinauszuragen. Wandhardware bleibt im gesperrten Rand, Serviceabdeckungen sind begehbar und meiden Rampenvorflächen. Keine impliziten Maschinenhindernisse auf Bau-/Bewegungsflächen. Kleine Kabinen, Versorgungseinheiten und Lagerkörper besetzen ausschließlich bereits gesperrte, ebene Randzellen mit sichtbarem Sockel; größere Dock-/Werkstattgebäude stehen außerhalb des Spielrechtecks. Eigene Dekor-RNG und begrenzte, leicht seedabhängige Budgets für Randmodule/Kleinteile statt natürlicher Vegetation; weder Navigations-/Bausperren noch Ressourcen oder Encounter-RNG werden ergänzt. Randgeländer lassen großzügige Lücken an Rampenmündungen. Eine eigene Dekor-Seedquelle erzeugt die umlaufende äußere Skyline mit gestaffelten Docktürmen, Reaktorstapeln, Kommunikationsspitzen und Terrassenblöcken sowie getrennt gebackenen Leuchtbändern. Ecklandmarken schließen diagonale Panoramalücken. Zusammenhängende, gestaffelte Dockmodule bilden eine zweite Massierungsebene vor den hinteren Türmen: offene Hangars mit je zwei gebackenen Jägern, Innenstegen und Deckenstreben, Geschützbatterien, Parabolantennen, Lastkräne und Versorgungshallen. Die Türme stehen hinter den Modul-Fußabdrücken und dürfen Hangarbuchten nicht durchstoßen. Ein dicker äußerer Trägerrumpf schließt an das innere Vorfeld an; beide Flächen überlappen nicht koplanar. Schiffe, Waffen und Außenstege sind rein inertes Renderdekor, keine Entitäten, Partikeleffekte oder weitere Spielebene. Zusätzliche Kisten, Leitungen, Terminals und kleine Antennen nutzen ausschließlich vorhandene flache CPU-Sperrzellen. Größere Schienengeschütze verlangen einen durchgehend gesperrten, ebenen Klippenstreifen über ihren gesamten Umriss; keine neue Maske oder versperrte Rampe. Nur die technische Menüvorschau ergänzt ihre arrangierte Fahrzeug-/Gebäudebelegung, nicht ein Gefecht. Alle Body-/Lichtteile entstehen einmalig als getrennte gebackene Geometrie mit eigenständigen Dekor-Salts. Feste Instanz-/Meshbudgets und Abstand nach Gebäudehöhe verhindern, dass vordere Silhouetten über die Spielfläche ragen. Die Kamera-Fernebene berücksichtigt das optische `sceneryBounds`-Profil, ohne Kamera/Picking-Projektion zu versetzen; sonst würden entfernte Türme im Panorama abgeschnitten. Keine zusätzlichen Rasterassets, Shader oder GPU-Kontexte. Eine separate statische Bodendetailschicht ergänzt großflächige Materialübergänge, Austauschplatten, bündige Leitungskanäle/Gitter und Gebrauchsspuren. Ihr eigener Seed verändert weder Weltplan noch andere Dekordraws. Wartungswege werden einmal über ein grobes Raster ebener Bodenflächen zwischen Rampenzugängen gezeichnet; sie sind keine Navigationsvorgabe oder Geschwindigkeitszone. Materialfelder blenden in das fortgesetzte Außendeck aus, statt die Spielgrenze zu markieren. Stahlmaterial, bündige Plattenfugen und Rampenmarkierungen sind von Naturmaterialien getrennt; keine neuen Rasterassets. Senkrechte Wände sind Darstellung innerhalb konservativer CPU-Klippenränder, keine separat pickbare/begehbare Oberfläche. Ein fortgesetztes Außendeck hält die spielbare Grenze aus dem normalen Kamerabild. [Weltvertrag](architecture.md#weltrezepte-und-feste-designs).

## UI-Branding

UI-Motive liegen als WebP mit Alpha unter `assets/ui/`; Aldrich samt SIL-OFL-Lizenz
unter `assets/fonts/aldrich/`. Die UI referenziert sie lokal per CSS oder dekorativem
Bild. Das ZIP übernimmt das UI-Assetverzeichnis, CSS-Assets und die Fontlizenz;
keine Renderer-Einbettung nötig. Der Präsentationshelfer `uiIcon()` ordnet Motive nach
Bedeutung zu, bei Vorteilen und Upgrades auch nach Kontext. Fehlende Entsprechungen
bleiben SVG; die gemeinsame Contentfunktion `icon()` und Modellkacheln bleiben
unverändert. Keine Kategorieicons als Ersatz für Einheiten-/Gebäudemodelle.

Gezielter Neuimport aus dem externen UI-Paket (Python mit Pillow):
`python3 scripts/import-menu-assets.py <pfad>/Ashes-of-Meridian-Demo.html`.
Der Importer liest nur explizit ausgewählte Einzelmotive aus `window.AOM_ASSETS`
und kopiert den benachbarten Font samt Lizenz. Demo-Hintergründe, alte Fraktions-Crops,
Audio und Mockup-Logik werden nicht importiert. Originalquellen bleiben unberührt; weitere Motive brauchen
eine explizite semantische Zuordnung statt eines vollständigen Atlasimports.

## Prozedurale Oberflächen

`src/renderer/materials.ts` enthält die gemeinsamen opaken Materialrezepte. Bei den Rastermaterialien werden Albedo und Mikrohöhe einmal bei fehlender Residenz gebacken; der Alphakanal trägt dort Höhe, **nicht Transparenz**. Foliage/Dekor behalten ihren eigenen Alphavertrag. Keine Pixelarchive je Seed oder Materialuploads pro Frame.

Materialvariation ist kosmetisch und RNG-neutral. Mikrorelief verändert weder Silhouette, Picking noch Kollision. Weltprojektion, lokale Modellprojektion und physischer Kachelmaßstab sind getrennte Verträge. Gemeinsame Materialien nicht für ein einzelnes Modell unbemerkt ändern.

`TECHNICAL` ist ausschließlich für technische Kartenböden/-wände und ihre Bodenauffüllungen bestimmt; geteiltes `METAL` an Einheiten, Gebäuden und bisherigen Karten bleibt unverändert. Der Szenenshader erzeugt dafür weltverankerte, landschaftsseedabhängige Materialfelder aus großen versetzten Stahlblechen, Riffelblech, bündigen Gitterrosten, gerippten Matten und bearbeitetem Gussdeck. Strukturen, Fugen, Befestigungen, Schrammen und Ablagerungen sind echte Albedo-/Mikrohöhenvariation, keine veränderte Kollision; auch dunkel gezeichnete Gitteröffnungen bleiben tragender Boden. Subpixeldetail wird nach Bildschirmmaßstab gedämpft; Performance behält Albedo, aber kein Mikrorelief. Diese analytische Shaderoberfläche benötigt keine zusätzlichen Rasterassets/Uploads, kostet jedoch Fragmentarbeit und ist auf Zielgeräten gesondert abzunehmen.

## Landschaftszonen und Wetter

Habitat, Dekor und Wetter folgen eigenen Landschaftsseed-Quellen nach dem [CPU-Weltaufbau](architecture.md#weltrezepte-und-feste-designs). Große Dekorumrisse einschließlich Windreserve bleiben in gesperrten Bereichen; niedriger Bodendekor darf befahrbar sein. Eine unabhängige Seedquelle variiert die Vegetationsdichte mit erhöhtem Mindestbudget für Kronen und befahrbaren Bodendekor. Schmalere, enger gestaffelte Kronen und gezielte Platzierungsproben verdichten vorhandene Sperrbänder. Niedrige, befahrbare Büsche ergänzen den Bodendekor auch verstreut in weniger üppigen offenen Habitatbereichen; Fahrwegzentren und Wirtschaftsflächen bleiben frei. Büsche sind wie kleine Pflanzen als Detailgeometrie im Performance-Modus ausblendbar. Die Dichte verändert weder Habitat-/Wetterdraws noch Terrain, Navigation oder Wirtschaft; sichere Ressourcen-/Routenabstände bleiben erhalten. Platzierungsbudgets bleiben begrenzt und skalieren nicht automatisch mit Kartengröße; große Pflanzen können nur vorhandene Sperrflächen nutzen, der Mindestwert ist deshalb kein erzwungener Baumcount auf freien Bauflächen.

Windfunktion/Uhr müssen in Szenen- und Schattenpass übereinstimmen; Culling-Bounds enthalten Bewegung. Wetter verwendet begrenzte View-Instanzen, keine Simulationspartikel. Seine lokale View-Uhr hält bei Pause. Performance darf kosmetische Arbeit auslassen, niemals CPU-Layout verändern.

## Einzeln wartbare Modelle

Modelle registrieren technische ID, synchrone Meshfabriken und `render(context)` ohne GPU-Zugriff oder frühe Contentauswertung. Neue Dateien gemäß [Ladevertrag](architecture.md#auslieferung) einbinden. Geometrie entsteht einmal, nicht im Frame; Modellcode zeichnet über den Kontext, nicht über direkten Simulationszugriff.

Gemeinsamer Adapter besitzt Welt-/Bauhöhe, Team-/Ghost-/Previewtönung und Standardfundamente. Gebäude und Bauvorschauen teilen eine aus dem Fußabdruck abgeleitete Stützebene: kleine Hänge werden direkt übernommen, stärkere auf eine dezente Neigung begrenzt. Alle Modellteile folgen derselben starren Pose; modelllokale Fundamente dürfen nicht zusätzlich die Standardplatte bekommen. Feste Farbflächen ebenfalls über `surfaceColor` führen. Gebäudegrundrotation und Turmkopfwinkel nicht vermischen. Hanglage und Flugpose lesen die CPU-Oberfläche, keine eigene Fahrphysik/IK.

`BattlefieldView` ergänzt nur den verbleibenden Höhenunterschied als lokale Bodenhaut, nicht als Extratextur-Podest. Raster, Diagonalen, Weltprojektion, Material und Vertex-Farb-/Materialgewichte stammen vom jeweiligen Terrain. Die notwendige Auffüllung läuft weich auf den unveränderten Boden aus; ihre Höhe außerhalb des Fußabdrucks bleibt begrenzt, damit sie keine benachbarte Klippe auffüllt. Flache und ausreichend sanfte ebene Flächen benötigen keine zusätzliche Geometrie. Patches entstehen einmal pro Gebäudeplatz, werden nur für sichtbare Gebäude gezeichnet und bei Verkauf/Zerstörung/Platz- oder Weltwechsel freigegeben. Baughosts verändern die Bodenhaut nicht.

Die Auffüllung ist bewusst **visuell**, keine dauerhafte Terraforming-Spielregel: Navigation, Gelände-Picking, Bauprüfung und diskrete Sichtstufen bleiben auf der ursprünglichen CPU-Oberfläche. Gebäude-Picking und Effekte verwenden dagegen dasselbe Stützdatum wie das Modell. Echte spielbare Geländeänderungen würden eine gesonderte Aktualisierung der Oberflächen-, Flug- und Navigationsverträge benötigen.

Schwere Luftzerstörer verwenden autorisierte GLBs. Der Importer ist **kein allgemeiner glTF-Loader**; nur seine unterstützten Mesh-/Farb-/Knotenverträge gelten. Neutralmeshes für Vorschauen erhöhen zusätzlich die Residenzkosten. Originalquellen nicht stillschweigend vereinfachen oder ersetzen.

## Modellkacheln

Kleine Kacheln sind zwischengespeicherte Standbilder; nur die Codex-Detailansicht bleibt live. Sie leihen den vorhandenen WebGL-Kontext und Modellmeshes, ohne zweite Welt/GPU-Geometrie. Der begrenzte flüchtige Cache berücksichtigt Modell, Qualität, Pixelgröße und Materialbereitschaft.

Cache-Misses erzeugen höchstens ein sichtbares Modell je Renderframe und kopieren synchron aus dem Hauptcanvas; danach überschreibt die Szene das Scratch-Rechteck. **Nur innerhalb des Rendercallbacks aufnehmen.** Unterstütztes 2× MSAA wird separat aufgelöst; kein direkter MSAA-Blit in einen möglicherweise anders formatierten Hauptcanvas. Der Subpixel-Fallback braucht zwei Kopien derselben eingefrorenen Pose, keine Animation. Fehlgeschlagene Allokation nicht jeden Frame wiederholen.

Verdrängte Bilder und endgültig verlassene Vorschauen geben eigene Ressourcen frei. Cache-Hits zeichnen/kopieren nicht erneut aus WebGL; Cache-Misses können trotzdem synchronisieren. [Offene Abnahme](issues/modell-kacheln.md).

## Terrain und Renderpässe

Ein gemeinsamer Renderer bedient alle Modi/Karten. `BattlefieldView` übernimmt CPU-`renderData` ohne Mutation und besitzt erzeugte Weltmeshes. Karten-/Scenerywechsel gibt deren VBOs/VAOs frei; gleiche Scenery darf wiederverwenden. Fog-Revision ist keine Geometrierevision. Meshnamen dürfen nicht mit gemeinsamen Primitiven/Modellen kollidieren.

Komponierte Umgebungen besitzen nur eigene Programme/Texturen/Tiefenziele/Fences. Registrierung allokiert nichts; Wechsel, Resize und Seitenende geben jeweils betroffene Ressourcen frei, niemals gemeinsam geliehene Programme. Neue Terrainmodelle deklarativ registrieren statt Karten-Sonderzweige im GPU-Adapter einzubauen.

- GPU-Grundterrain folgt CPU-Dreiecken; Dekorauflage niemals aus unabhängigem Noise/bilinearen Samples ableiten. Außenkulisse, dekorativer Flussgrund und die oben beschriebene lokale Gebäude-Bodenhaut dürfen abweichen, sind aber keine zusätzliche spielbare Bodenebene.
- Metallhaut verwendet RGB-Vertex-Tint. Bei Spezialmaterialien ist Vertex-Tint **kein gewöhnliches RGB**: Landschaftsgewichte, Foliage-UV/Helligkeit und Wasser-Tiefe/Flussrichtung haben eigene Belegungen. Alpha-Cutoff in Schatten/Szene identisch halten.
- Wasser zeichnet ein überlappungsfreies Feld ohne Tiefenschreiben nach opaker Szene, vor Effekten. Reflexion ist analytisch, kein zusätzlicher Szenenpass.
- Chunk-/Instanzculling muss vollständige transformierte Bounds einschließlich hoher Geometrie und außerhalb der Kamera liegender Schatten-Caster erhalten. Draw Calls allein sind kein Optimierungsmaß.
- Szenenziel → optional MSAA-Resolve → Bloom → Postprocessing; Schatten separat. Allokationsfehler brauchen saubere Fallbacks, Resize gibt alte Ziele frei. Resolve-Pfade benötigen passende Maße und Formate.
- Texturwechsel lädt neue Ressourcen vor Freigabe alter kartenspezifischer Bestände. Bereitschaft nicht durch feste Wartezeit oder `gl.finish()` ersetzen.

High/Balanced teilen Modelle, Schatten/MSAA/Bloom; High ergänzt den ausdrücklich gewünschten Tilt-Shift-Look. Performance reduziert Auflösung und kosmetische Arbeit. HUD bleibt ungefiltert. Die Startatmosphäre wird pro Welt aufgelöst. Im Gefecht wechseln Lichtfarben/-stärke, Himmel und Dunst kontinuierlich mit dem [simulationszeitgebundenen Tageszyklus](architecture.md#weltrezepte-und-feste-designs). Kühles Nachtfülllicht hält Gelände und Modelle lesbar; gemeinsame Licht-/Schattenrichtung bleibt künstlerisch, nicht astronomisch. RGBA8 ist kein HDR.

## Kontursilhouetten bei Verdeckung

Nur beobachtete Entitäten und erkundete Ressourcen dürfen hinter opaker **statischer** Geometrie erscheinen. Silhouetten verleihen keine Sicht/Befehlsrechte; Intro, Fog, Ghosts und Vorschauen dürfen nicht optieren. Dynamische Armeen/Gebäude und nicht tiefenschreibende Transparenz sind keine Auslöser.

Bereits aufgebaute Modelltransforms werden nach statischer Szene, vor normalen Entitäten mit invertiertem Tiefentest gezeichnet; kein erneuter Animationsaufbau. GL-Zustand anschließend vollständig wiederherstellen, einschließlich gecachter Programmbindungen. Zusätzliche Geometriedurchläufe sind reale Kosten.

## Lichtanimation und Kampfakzente

Kosmetische Akzente folgen Simulations-/Interpolationszeit und eigenen begrenzten View-Budgets, ohne neue Spielzustände oder Simulations-RNG. Sichtverlust/Welt-/Perspektivwechsel darf keine alten Spuren oder Effektstapel nachspielen. CPU-Effekte weiterhin gemäß ihrem [RNG-Vertrag](architecture.md#welt-darstellung-und-zufall) erzeugen/ticken.

Effektculling enthält ganze Strahlen, Radien und Höhenhüllen, nicht nur Zentren; dynamische Schatten-Caster bleiben erhalten. Gepoolte Partikelreferenzen gelten nur bis Ablauf/Verdrängung/Reset. In-place-Verdichtung muss Zeichenreihenfolge und RNG-Aufrufe erhalten.

## Menü-Landschaftswechsel

Menügebäude suchen deterministisch nahe ihren Kompositionsankern baubares, hindernisfreies Gelände mit Abstand zu anderen Gebäuden. Es gilt derselbe Fundamentvalidator wie im Gefecht; ohne geeigneten nahen Platz entfällt das dekorative Gebäude. Weder Terrain noch Simulations-RNG werden verändert.

Nur auf `home` ersetzt ein eigener seedbasierter Hintergrund den normalen Himmel: farbige Atmosphären oder wolkenloser Sternraum, mit wenigen perspektivischen Planetenkugeln und optionaler Sonne. Diese Gestaltung ist unabhängig von der physikalischen Weltatmosphäre und der Gefechtstageszeit. Eigene Seedquelle, kein Simulations-/Terrain-RNG; keine Weltinstanzen, Schatten, Sicht- oder Navigationswirkung. Ein gemeinsam genutztes Kugelmesh und eigene Programme werden erst bei Bedarf angelegt, bei Menüausstieg/Seitenende freigegeben. Himmelskörper zeichnen vor dem Terrain mit isolierter Tiefe; Codex und Gefecht behalten ihre bisherigen Hintergründe. Keine neuen Rasterassets.

Die Menükamera richtet ihr Ziel an der CPU-Geländehöhe aus und hält den Orbit oberhalb des Bodens am Kamerastandort. Erhöhte Landschaften dürfen nicht die alte Nullhöhen-Kulisse voraussetzen; das Schattenvolumen folgt dem gleichen Ziel-Datum. Die Gefechtskamera bleibt davon getrennt.

Ein Stage-Wechsel kopiert das fertig gerenderte Canvas **einmal im Rendercallback** in ein temporäres 2D-Canvas. Kein `preserveDrawingBuffer`, kontinuierliches Readback oder zweite live Welt. Das Standbild überbrückt Welt-/Texturladen; erst der erste fertige neue Frame startet die Compositor-Überblendung.

Ersetzende Vorschau/Gefechtsstart verwirft Animation/Bildspeicher und entwertet alte asynchrone Ergebnisse. Reduced motion überspringt Animation, nicht Bereitschaft. [Archivzustand](architecture.md#zustands--und-verantwortungsgrenzen).

## Viewport und HUD

Projektion, Picking und Overlay lesen dieselben gemessenen CSS-Clientgrenzen von `#worldViewport`, einschließlich Offset. Resize/Moduswechsel synchronisieren sie; kein DOM-Messen je Einheit. Orthografischer Zoom bleibt an Fensterhöhe gebunden und steuert den Bildausschnitt, nicht die physische Nähe zum Boden. Die Gefechtskamera hält entlang derselben Blickachse Abstand zur höchsten CPU-Terrainhöhe einschließlich Dekorreserve; der Tiefenbereich wächst bei Bedarf mit. Pivot, Bildmaßstab und Picking bleiben dadurch unverändert, ohne bei engem Zoom Gelände an der Nahfläche abzuschneiden. Gesamte CSS-Kaskade prüfen; UI-Fortschritt folgt Simulation, keiner zweiten Queue/CSS-Uhr.

Bauflächenfarben sind abgetastete Orientierung, kein Ersatz für den Validator am tatsächlichen Klick. Nie ungesehene Einheiten über Farbe offenlegen. [Prüfwahl](testing.md) · [Darstellungsabnahme](issues/project-tomorrow.md) · [Audio und Sprachpflege](audio.md).
