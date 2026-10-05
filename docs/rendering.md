# Grafik und Assets

Darstellungs- und Pflegeverträge; Formen, Budgets, Shaderwerte und CSS-Maße stehen im Code.

## Texturen und Portraits

Rasterquellen ausschließlich WebP, Qualität 80; benötigten Alphakanal erhalten. Nach Texturänderungen `npm run embed:textures`, nach GLB-Änderungen `npm run embed:models`, danach Build. Generierte Einbettungen niemals direkt bearbeiten. Eingebettete Data-URLs erhalten `file://`; CSS-Vorschaubilder bleiben zusätzliche lokale Laufzeitassets.

Alte Portrait-/Albedoquellen nicht wegen fehlender aktueller WebGL-Nutzung löschen. Neue Bildassets brauchen einen konkreten Bedarf; Codex-/Aktionskacheln verwenden Modelle. Assetnamen folgen [technischen IDs](architecture.md#technische-ids-und-anzeigenamen).

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

Der gemeinsame Szenenshader hat zwei kontextlebenslange Spezialisierungen für Landschaft und opakes Blattwerk. Nur die Material-ID wird zur Compilezeit festgelegt; Material-/Lichtformeln einschließlich Nachtlampen, Fog, Wind und Relief bleiben dieselbe Quelle. Beim Instanzupload wird die Homogenität eines Batches geprüft; gemischte oder andere Materialien verwenden den allgemeinen Shader. Auswahl erfolgt nur im normalen Szenenpass, nach dem Culling und ohne Umordnung der Draws. Schatten, Verdeckungskonturen und eigene Landschaftsumgebungen behalten ihre Programme. Keine Shaderkompilierung pro Frame/Materialwechsel, zusätzlichen Texturen oder Renderpässe.

## Landschaftszonen und Wetter

Habitat, Dekor und Wetter folgen eigenen Landschaftsseed-Quellen nach dem [CPU-Weltaufbau](architecture.md#weltrezepte-und-feste-designs). Große Dekorumrisse einschließlich Windreserve bleiben in gesperrten Bereichen; niedriger Bodendekor darf befahrbar sein. Eine unabhängige Seedquelle variiert die Vegetationsdichte mit erhöhtem Mindestbudget für Kronen und befahrbaren Bodendekor. Schmalere, enger gestaffelte Kronen und gezielte Platzierungsproben verdichten vorhandene Sperrbänder. Niedrige, befahrbare Büsche ergänzen den Bodendekor auch verstreut in weniger üppigen offenen Habitatbereichen; Fahrwegzentren und Wirtschaftsflächen bleiben frei. Büsche sind wie kleine Pflanzen als Detailgeometrie im Performance-Modus ausblendbar. Die Dichte verändert weder Habitat-/Wetterdraws noch Terrain, Navigation oder Wirtschaft; sichere Ressourcen-/Routenabstände bleiben erhalten. Platzierungsbudgets bleiben begrenzt und skalieren nicht automatisch mit Kartengröße; große Pflanzen können nur vorhandene Sperrflächen nutzen, der Mindestwert ist deshalb kein erzwungener Baumcount auf freien Bauflächen.

Windfunktion/Uhr müssen in Szenen- und Schattenpass übereinstimmen; Culling-Bounds enthalten Bewegung. Wetter verwendet begrenzte View-Instanzen, keine Simulationspartikel. Seine lokale View-Uhr hält bei Pause. Performance darf kosmetische Arbeit auslassen, niemals CPU-Layout verändern.

## Einzeln wartbare Modelle

Modelle registrieren technische ID, synchrone Meshfabriken und `render(context)` ohne GPU-Zugriff oder frühe Contentauswertung. Neue Dateien gemäß [Ladevertrag](architecture.md#auslieferung) einbinden. Geometrie entsteht einmal, nicht im Frame; Modellcode zeichnet über den Kontext, nicht über direkten Simulationszugriff. `nightPart` verstärkt ausschließlich bereits emissive Teile in der Dämmerung; `part` erlaubt gezielte modellspezifische Lichtdetails. Lokale Lampen über `pointLight` melden, nicht mit zusätzlicher Halo-Geometrie nachbauen.

Gemeinsamer Adapter besitzt Welt-/Bauhöhe, Team-/Ghost-/Previewtönung und Standardfundamente. Standardgebäude und ihre Bauvorschauen teilen eine aus dem Fußabdruck abgeleitete Stützebene: kleine Hänge werden direkt übernommen, stärkere auf eine dezente Neigung begrenzt. Alle Modellteile folgen derselben starren Pose; modelllokale Fundamente dürfen nicht zusätzlich die Standardplatte bekommen. Feste Farbflächen ebenfalls über `surfaceColor` führen. Gebäudegrundrotation und Turmkopfwinkel nicht vermischen. Hanglage und Flugpose lesen die CPU-Oberfläche, keine eigene Fahrphysik/IK.

Die gemeinsamen [Zivilisationsgebäude](gameplay.md#wirtschaft-bau-und-produktion) verwenden dagegen eine waagerechte Stützebene knapp oberhalb ihrer tatsächlichen, gedrehten Deckflächen. Deren Umrisse und Terrassenhöhen sind gemeinsames CPU-/Modelldatum: Gelände außerhalb der Decks hebt das Haus nicht an, unter einer erhöhten Terrasse wird deren eigener Höhenversatz berücksichtigt. Maxima werden an Terrainvertices und Deck-/Dreieckskantenschnitten bestimmt, ohne zusätzliche pauschale Pfahlhöhe. Der Modellkontext liefert lokale CPU-Bodenhöhen relativ zu diesem Datum; die separate Unterkonstruktion passt Fußhöhen, lokal geneigte Auflageplatten, Stützenlängen und Eingangstreppen daran an, während die gecachten Laborhüllen unverändert bleiben. Keine Fraktionsmounds, Standardplatten oder Geländeauffüllung zusätzlich zeichnen. Fertige Modelle und Ghosts verwenden dasselbe Datum; Picking und Effekte ebenfalls. Die Modellvariante ist für alle Fraktionen gleich und nutzt Metall statt des Manyroot-Biomaterials.

`BattlefieldView` ergänzt bei Standardgebäuden nur den verbleibenden Höhenunterschied als lokale Bodenhaut, nicht als Extratextur-Podest. Raster, Diagonalen, Weltprojektion, Material und Vertex-Farb-/Materialgewichte stammen vom jeweiligen Terrain. Die notwendige Auffüllung läuft weich auf den unveränderten Boden aus; ihre Höhe außerhalb des Fußabdrucks bleibt begrenzt, damit sie keine benachbarte Klippe auffüllt. Flache und ausreichend sanfte ebene Flächen benötigen keine zusätzliche Geometrie. Patches entstehen einmal pro Gebäudeplatz, werden nur für sichtbare Gebäude gezeichnet und bei Verkauf/Zerstörung/Platz- oder Weltwechsel freigegeben. Baughosts verändern die Bodenhaut nicht.

Die Auffüllung ist bewusst **visuell**, keine dauerhafte Terraforming-Spielregel: Navigation, Gelände-Picking, Bauprüfung und diskrete Sichtstufen bleiben auf der ursprünglichen CPU-Oberfläche. Gebäude-Picking und Effekte verwenden dagegen dasselbe Stützdatum wie das Modell. Echte spielbare Geländeänderungen würden eine gesonderte Aktualisierung der Oberflächen-, Flug- und Navigationsverträge benötigen.

Schwere Luftzerstörer verwenden autorisierte GLBs. Der Importer ist **kein allgemeiner glTF-Loader**; nur seine unterstützten Mesh-/Farb-/Knotenverträge gelten. Neutralmeshes für Vorschauen erhöhen zusätzlich die Residenzkosten. Originalquellen nicht stillschweigend vereinfachen oder ersetzen.

## Modellkacheln

Kleine Kacheln sind zwischengespeicherte Standbilder; nur die Codex-Detailansicht bleibt live. Sie leihen den vorhandenen WebGL-Kontext und Modellmeshes, ohne zweite Welt/GPU-Geometrie. Der begrenzte flüchtige Cache berücksichtigt Modell, Qualität, Pixelgröße und Materialbereitschaft.

Cache-Misses erzeugen höchstens ein sichtbares Modell je Renderframe und kopieren synchron aus dem Hauptcanvas; danach überschreibt die Szene das Scratch-Rechteck. **Nur innerhalb des Rendercallbacks aufnehmen.** Unterstütztes 2× MSAA wird separat aufgelöst; kein direkter MSAA-Blit in einen möglicherweise anders formatierten Hauptcanvas. Der Subpixel-Fallback braucht zwei Kopien derselben eingefrorenen Pose, keine Animation. Fehlgeschlagene Allokation nicht jeden Frame wiederholen.

Verdrängte Bilder und endgültig verlassene Vorschauen geben eigene Ressourcen frei. Cache-Hits zeichnen/kopieren nicht erneut aus WebGL; Cache-Misses können trotzdem synchronisieren. [Offene Abnahme](issues/modell-kacheln.md).

## Terrain und Renderpässe

Ein gemeinsamer Renderer bedient alle Modi/Karten. `BattlefieldView` übernimmt CPU-`renderData` ohne Mutation und besitzt erzeugte Weltmeshes. Karten-/Scenerywechsel gibt deren VBOs/VAOs frei; gleiche Scenery darf wiederverwenden. Fog-Revision ist keine Geometrierevision. Meshnamen dürfen nicht mit gemeinsamen Primitiven/Modellen kollidieren.

Komponierte Umgebungen besitzen nur eigene Programme/Texturen/Tiefenziele/Fences. Registrierung allokiert nichts; Wechsel, Resize und Seitenende geben jeweils betroffene Ressourcen frei, niemals gemeinsam geliehene Programme. Neue Terrainmodelle deklarativ registrieren statt Karten-Sonderzweige im GPU-Adapter einzubauen.

- GPU-Grundterrain folgt CPU-Dreiecken; Dekorauflage niemals aus unabhängigem Noise/bilinearen Samples ableiten. Außenkulisse, dekorativer Flussgrund und die oben beschriebene lokale Gebäude-Bodenhaut dürfen abweichen, sind aber keine zusätzliche spielbare Bodenebene. Ein schmaler Anschlussstreifen verbindet jede Randprobe der feinen Landschaftshaut direkt mit der gröberen Außenkulisse. Gemeinsame Kanten übernehmen Höhe, Normale und Materialgewichte exakt; bloße senkrechte Abschlusswände würden Höhen-/Schattierungsnähte nur abdunkeln. Der Unterseitenabschluss bleibt verdeckt. Kosmetische Bodenposen und äußere Sichtstufen lesen dieselben Anschlussdreiecke; die spielbare Oberfläche bleibt unverändert. Ihr äußerer Abschluss reicht für das aktuelle Sichtfenster bei maximalem Zoom und allen Kamerawinkeln plus wenige Meter Reserve. Nur zusätzliche Randdreiecke führen vorhandene Höhen/Materialien fort, kein größeres Terrainraster oder flächenabhängig erhöhtes Dekorbudget. Ein schmaler Deko-Saum übernimmt wenige vollständige Vegetations-/Steingruppen des vorhandenen Randbestands mit festem Budget, ohne zusätzliche RNG-Ziehungen, Assets oder CPU-Hindernisse. Resize passt den Abschluss auch nach unten an; Pan/Zoom erzeugen keine neuen Meshes.
- Metallhaut verwendet RGB-Vertex-Tint. Bei Spezialmaterialien ist Vertex-Tint **kein gewöhnliches RGB**: Landschaftsgewichte, Foliage-UV/Helligkeit und Wasser-Tiefe/Flussrichtung haben eigene Belegungen. Alpha-Cutoff in Schatten/Szene identisch halten.
- Wasser zeichnet ein überlappungsfreies Feld ohne Tiefenschreiben nach opaker Szene, vor Effekten. Reflexion ist analytisch, kein zusätzlicher Szenenpass.
- Chunk-/Instanzculling muss vollständige transformierte Bounds einschließlich hoher Geometrie und außerhalb der Kamera liegender Schatten-Caster erhalten. Draw Calls allein sind kein Optimierungsmaß.
- Szenenziel → optional MSAA-Resolve → Bloom → Postprocessing; Schatten separat. Allokationsfehler brauchen saubere Fallbacks, Resize gibt alte Ziele frei. Resolve-Pfade benötigen passende Maße und Formate.
- CPU-Fog und Spielsicht bleiben auf die spielbare Karte begrenzt. Die bestehende GPU-Fogtextur erhält für Kulisse und lokale Beleuchtung einen kleinen visuellen Saum aus den tatsächlichen lokalen Sicht-/Scan-Kreisen einschließlich der Bodensichtstufen, nicht aus gestreckten Randtexeln. Ihr spielbarer Teil übernimmt CPU-Fog unverändert; Bauguide und explizit sichtgesteuerte Effekte bleiben außen unsichtbar. Der Saum gewährt keine Spielsicht/Baurechte und darf keine Scan-Korridore bilden. Seine rein kosmetische Erkundung ist flüchtig und wird bei Welt-/Perspektivwechsel verworfen; nach Laden verbindet eine schmale erkundete Randzelle die gespeicherte Bodenhaut. Erweiterte Fog-Maße sind von Karten-/Lichtgittermaßen getrennt.
- Texturwechsel lädt neue Ressourcen vor Freigabe alter kartenspezifischer Bestände. Bereitschaft nicht durch feste Wartezeit oder `gl.finish()` ersetzen.

High/Balanced teilen Modelle, Schatten/MSAA/Bloom; High ergänzt den ausdrücklich gewünschten Tilt-Shift-Look. Performance reduziert Auflösung und kosmetische Arbeit. HUD bleibt ungefiltert. Die Startatmosphäre wird pro Welt aufgelöst. Im Gefecht wechseln Lichtfarben/-stärke und Dunst kontinuierlich mit dem [simulationszeitgebundenen Tageszyklus](architecture.md#weltrezepte-und-feste-designs). Kühles Nachtfülllicht hält Gelände und Modelle lesbar; gemeinsame Licht-/Schattenrichtung bleibt künstlerisch, nicht astronomisch. RGBA8 ist kein HDR.

## Kontursilhouetten bei Verdeckung

Nur beobachtete Entitäten und erkundete Ressourcen dürfen hinter opaker **statischer** Geometrie erscheinen. Silhouetten verleihen keine Sicht/Befehlsrechte; Intro, Fog, Ghosts und Vorschauen dürfen nicht optieren. Dynamische Armeen/Gebäude und nicht tiefenschreibende Transparenz sind keine Auslöser.

Bereits aufgebaute Modelltransforms werden nach statischer Szene, vor normalen Entitäten mit invertiertem Tiefentest gezeichnet; kein erneuter Animationsaufbau. GL-Zustand anschließend vollständig wiederherstellen, einschließlich gecachter Programmbindungen. Zusätzliche Geometriedurchläufe sind reale Kosten.

## Lichtanimation und Kampfakzente

Prospector-Frontlampen und die Nachtverstärkung ausgewählter Lichtdetails der Infanterie (Schützen, Medics und Commander aller Fraktionen) folgen der Welt-Tageszeit, nicht einer eigenen Uhr. Infanterie nutzt vorhandene Visiere, biologische Kerne und Optiken/Stabspitzen; deren Tagesdarstellung bleibt erhalten. Weltkulissen einschließlich Startbildschirm und Kinokamera nutzen dieselbe Nachtblendung; eigenständige Modellkacheln ohne Weltatmosphäre erhalten keine Nachtverstärkung. Der kurze kosmetische Bodenschein nutzt den vorhandenen Lichtpool-Pass und folgt einer lokal aus der CPU-Oberfläche abgeleiteten geneigten Ebene. Kleine Geländeabweichungen werden durch begrenztes Anheben überbrückt; scharfe Kanten oder starke Krümmung blenden den Schein weiterhin aus. Im Performance-Modus entfällt er. Er ist keine echte Lichtquelle für benachbarte Geometrie oder Sichtregeln.

Fertige Gebäude und Einheiten aller Fraktionen verstärken nachts vorhandene Lichtdetails: technische Leisten/Optiken, lebende Kerne und Membranen oder Kristalle und Portalzierleisten. Cinder-Pact-Gebäude behalten ihre gezielt ausgewählten cyan-/orangefarbenen Lichtleisten, Dachinlays und Markierungen; Infanterie behält ihre ausgewählten Nachtakzente. Die Breakwater nutzt ihre separate Teamdetailfläche, nicht den autorisierten GLB-Rumpf. Rüstung, Fundamente und strukturelle Kranteile bleiben nichtemissiv, Auswahlringe unverändert. Tagesdarstellung, Geometrie und Instanzzahl bleiben erhalten; Bauzustände und Platzierungsgeister erhalten keine Nachtverstärkung.

Alle Gebäude- und Einheitenmodelle melden zusätzlich lokale, schattenlose diffuse Lampen für tatsächliche Oberflächen im vorhandenen Szenenpass. Die Positionen gehören zum Modell; der Adapter übernimmt Fundament-/Fahrzeugpose, Flug-/Schwebehöhe und Nachtblendung. Drehbare Turmlampen folgen dem Waffenwinkel. Der Renderer verwirft nur vollständig außerhalb des Bildes liegende Einflussbereiche. Ein konservatives X/Z-Raster ordnet alle übrigen Lampen den berührten Weltzellen zu; jede Oberfläche prüft nur die Lampen ihrer Zelle und deren exakten 3D-Radius. Weder ein globales noch ein zellenlokales Auswahlbudget darf Gebäude oder Einheiten dunkel lassen; das gilt auch für Performance und Kinokamera. Zwei nächstgefilterte Float-Datentexturen speichern Zellbereiche und Lampen, ohne zusätzlichen Renderpass. Sie werden je Szenenaufbau einmal aktualisiert und bei Shaderwechseln wiederverwendet; Seitenende gibt sie frei. GPU-Texturkapazität und Allokationsfehler bleiben explizite technische Grenzen statt stiller Lichtauswahl.

Lichtlisten werden je Szenenaufbau/Weltwechsel geleert, Modellkacheln besitzen getrennte CPU-Puffer. Nur für die Darstellung sichtbarkeitsgeprüfte Entitäten dürfen Lampen melden; der diffuse Lichtbeitrag wird zusätzlich an aktuellen Fog-Sichtgrenzen maskiert. Spielsicht, RNG und Simulation bleiben unberührt. Ohne lokale Schatten kann Licht durch Wände oder Geländekanten scheinen; das ist eine bewusste Grenze, keine physikalische Beleuchtung. Dichte Ansammlungen erhöhen die lokale Fragmentarbeit; die räumliche Zuordnung ersetzt keine Zielgeräteabnahme.

High/Balanced nutzen den bestehenden viertelaufgelösten Bloom-Pass. Dessen Einblendstärke folgt nachts derselben Dämmerungs-/Morgenüberblendung; die Verstärkung gilt für alle ausreichend hellen Bildanteile, auch Ressourcen und Kampfeffekte. Bei aktiven lokalen Lampen nutzt die Extraktion eine vollständig abgetastete Downsample-Fläche mit begrenzter Spitzenerhaltung, damit dünne Leuchtstreifen bei Gefechtszoom weniger leicht verschwinden. Ohne lokale Lampen bleibt die bisherige Extraktion erhalten. Tageslicht und Modellkacheln ohne Weltatmosphäre behalten die normale Bloom-Stärke; Weltkulissen nutzen auch im Kino die Nachtverstärkung. Performance behält helle Leuchtflächen ohne Bloom. Keine weiteren Instanzen, Bloom-Targets oder Schattenpässe; RGBA8 bleibt bestehen. Zusätzliche CPU-/Fragmentarbeit und Zielgeräteperformance müssen dennoch beurteilt werden.

Kosmetische Akzente folgen Simulations-/Interpolationszeit und eigenen begrenzten View-Budgets, ohne neue Spielzustände oder Simulations-RNG. Sichtverlust/Welt-/Perspektivwechsel darf keine alten Spuren oder Effektstapel nachspielen. CPU-Effekte weiterhin gemäß ihrem [RNG-Vertrag](architecture.md#welt-darstellung-und-zufall) erzeugen/ticken.

Effektculling enthält ganze Strahlen, Radien und Höhenhüllen, nicht nur Zentren; dynamische Schatten-Caster bleiben erhalten. Gepoolte Partikelreferenzen gelten nur bis Ablauf/Verdrängung/Reset. In-place-Verdichtung muss Zeichenreihenfolge und RNG-Aufrufe erhalten.

## Menü-Landschaftswechsel

Menügebäude suchen deterministisch nahe ihren Kompositionsankern baubares, hindernisfreies Gelände mit Abstand zu anderen Gebäuden. Es gilt derselbe Fundamentvalidator wie im Gefecht; ohne geeigneten nahen Platz entfällt das dekorative Gebäude. Weder Terrain noch Simulations-RNG werden verändert.

Nur auf `home` ersetzt ein eigener seedbasierter Hintergrund den normalen Himmel: farbige Atmosphären oder wolkenloser Sternraum, mit wenigen perspektivischen Planetenkugeln und optionaler Sonne. Diese Gestaltung ist unabhängig von der physikalischen Weltatmosphäre und der Gefechtstageszeit. Eigene Seedquelle, kein Simulations-/Terrain-RNG; keine Weltinstanzen, Schatten, Sicht- oder Navigationswirkung. Ein gemeinsam genutztes Kugelmesh und eigene Programme werden erst bei Bedarf angelegt, bei Menüausstieg/Seitenende freigegeben. Himmelskörper zeichnen vor dem Terrain mit isolierter Tiefe. Orthografische Gefechts- und Modellansichten zeichnen keinen Himmel; die Gefechtskulisse deckt das Sichtfenster vollständig ab. Keine neuen Rasterassets.

Der zeit- und kameraunabhängige Himmel samt Planeten wird als ein einziges GPU-Bild in voller Szenenauflösung (`RGBA8`, etwa vier Bytes je Pixel) wiederverwendet. Der erste Frame zeichnet in das vorhandene Szenenziel und kopiert nur dessen Farbe vor Terrain/Bloom/Post; dadurch bleibt die vorhandene MSAA-Kantenglättung im gespeicherten Hintergrund enthalten, ohne zusätzliche MSAA-/Tiefenziele. Folgebilder kopieren exakte Texel per Vollbildshader, da WebGL 2 keinen Single-Sample-zu-MSAA-Blit erlaubt. Weltkamera, Landschaft, Modelle und Postprocessing bleiben live. Seed/Familie erneuern den Inhalt; Größe, Qualität oder Samplezahl ersetzen das Ziel. Menüausstieg/Seitenende geben es frei. Bei fehlgeschlagener Cacheallokation bleibt die direkte Darstellung erhalten; erst eine geänderte Zielkonfiguration erlaubt einen neuen Allokationsversuch. Keine CPU-Bildkopie und keine Laufzeit-Rasterassets.

Die bewegte Landschaftskulisse hinter `home` und den anderen Menüs verwendet zusätzlich einen Tiefencache nur für **statische** Schattenwerfer. Die feste Kino-Lichtprojektion erlaubt Wiederverwendung trotz Kameraorbit; dynamische Gebäude-/Einheitenschatten werden nach jeder Tiefenkopie frisch eingezeichnet. Ein zusätzliches `DEPTH_COMPONENT24`-Ziel gleicher Schattenauflösung kostet geschätzt vier Bytes je Texel. Lichtmatrix, Modellzeit, statische Buckets, Mesh- und Profiländerungen entwerten den Inhalt; Schattenauflösung/Qualität ersetzen den Speicher. Verlassen der Kinokamera, Performance-Qualität und Seitenende geben ihn frei. Fehlgeschlagene Allokation fällt ohne Frame-für-Frame-Retry auf direktes Zeichnen zurück. Kein Schattenqualitätsverlust und kein Einfrieren der sichtbaren Szene.

Die Menükamera richtet ihr Ziel an der CPU-Geländehöhe aus und hält den Orbit oberhalb des Bodens am Kamerastandort. Erhöhte Landschaften dürfen nicht die alte Nullhöhen-Kulisse voraussetzen; das Schattenvolumen folgt dem gleichen Ziel-Datum. Die Gefechtskamera bleibt davon getrennt.

Ein Stage-Wechsel kopiert das fertig gerenderte Canvas **einmal im Rendercallback** in ein temporäres 2D-Canvas. Kein `preserveDrawingBuffer`, kontinuierliches Readback oder zweite live Welt. Das Standbild überbrückt Welt-/Texturladen; erst der erste fertige neue Frame startet die Compositor-Überblendung.

Ersetzende Vorschau/Gefechtsstart verwirft Animation/Bildspeicher und entwertet alte asynchrone Ergebnisse. Reduced motion überspringt Animation, nicht Bereitschaft. [Archivzustand](architecture.md#zustands--und-verantwortungsgrenzen).

## Ergebnisdarstellung

Sieg/Niederlage stoppen bereits die Simulation. Bei unverändertem Ergebniszustand und unveränderter Kamera bleiben deshalb die vorhandenen Szenen-/Bloomziele und das passende Overlay erhalten: keine erneuten Modellinstanzen, Uploads, Schatten-, Szenen- oder Bloomdurchläufe und kein zusätzlicher Bildspeicher. Der Post-Pass zeichnet weiter in das nicht dauerhaft erhaltene Hauptcanvas; Filmkorn, Tilt-Shift, Bloomwirkung, CSS-Filter und DOM-Animationen bleiben bestehen. Größen-/Qualitäts-, Welt-/Zustands-, Kamera-, Perspektiv-/Fog- und Auswahländerungen erzwingen eine frische Darstellung. Intros, aktive Modi und auslaufende Pings verhindern Wiederverwendung. Echtzeit-Fließwasser und eigene Renderumgebungen bleiben mangels Stillstandsvertrag vollständig live; gewöhnliche Pause bleibt unverändert.

Das unsichtbare Ergebnis-HUD aktualisiert weder Queues noch Minimap. UI-/Audio- und Meldungsuhren laufen weiter; Auflösung, Simulations-/Ergebnisverarbeitung und Eingaben bleiben davon unabhängig.

## Viewport und HUD

Projektion, Picking und Overlay lesen dieselben gemessenen CSS-Clientgrenzen von `#worldViewport`, einschließlich Offset. Resize/Moduswechsel synchronisieren sie; kein DOM-Messen je Einheit. Orthografischer Zoom bleibt an Fensterhöhe gebunden und steuert den Bildausschnitt, nicht die physische Nähe zum Boden. Die Gefechtskamera hält entlang derselben Blickachse Abstand zur höchsten CPU-Terrainhöhe einschließlich Dekorreserve; der Tiefenbereich wächst bei Bedarf mit. Pivot, Bildmaßstab und Picking bleiben dadurch unverändert, ohne bei engem Zoom Gelände an der Nahfläche abzuschneiden. Die Pan-Grenzen beziehen sich auf den sichtbaren Ausschnitt innerhalb der projizierten Terrainausdehnung, nicht auf die höchste Geländehöhe als pauschalen Pivotversatz. Terrainextrema werden pro Welt und Blickrichtung wiederverwendet; Zoom und Resize passen die Ausschnittgrenzen an. Bei gedrehten Karten bleibt zusätzlich der zentrale Geländeanker auf der Karte. Eine kleine Bildschirmrandreserve hält Randziele erreichbar. Gesamte CSS-Kaskade prüfen; UI-Fortschritt folgt Simulation, keiner zweiten Queue/CSS-Uhr.

Bauflächenfarben sind abgetastete Orientierung, kein Ersatz für den Validator am tatsächlichen Klick. Nie ungesehene Einheiten oder Produktionsausgänge über Farbe offenlegen. Der Terraincache gilt für Welt, Partei und Gebäudetyp; bei Bildausschnittwechsel bleiben geprüfte Positionen im überlappenden Bereich erhalten. Positionen außerhalb des neuen Ausschnitts werden verworfen, bei Raffinerien mit Reserve für das Snapping auf nahe Vorkommen. Bauvoraussetzungen und räumliche Belegung werden je Abtastung frisch gelesen. Erstprüfungen sind pro Renderframe begrenzt; bis alle benötigten Terrainproben vorliegen, bleibt das Raster ausgeblendet, während die genaue Vorschau-/Klickprüfung weiter gilt. Dies kann nach Öffnen, Kamera- oder Sichtwechsel kurz verzögertes Erscheinen bewirken. CPU-Abtastdichte, Geländeform und Farbklassifikation bleiben davon unabhängig. Die sichtbaren Linien sind weltverankert und pixelbasiert kantengeglättet. Beim Reinzoomen werden Zwischenlinien weich eingeblendet, bis der Abstand am nahen Zoomende halb so groß ist wie am fernen. Beide Liniendichten werden unabhängig ausgeblendet, wenn ihre Abstände nicht zuverlässig auflösbar sind. Dies verändert weder Abtastdichte noch Meshgeometrie.

CPU-Meshspeicher und GPU-Puffer bleiben bei gleichem Bildausschnitt erhalten; unveränderte Proben brauchen keinen Upload. Das viewportbegrenzte Overlay wird nicht wie statisches Weltterrain erneut in Chunks zerlegt. Bildausschnittwechsel ersetzen die Geometrie, erhalten aber den überlappenden Terraincache. Welt-/Partei-/Typwechsel und Verlassen des Baumodus verwerfen auch diesen Cache. Keine Simulationsmutation oder RNG-Ziehung durch den Rastercache.

[Prüfwahl](testing.md) · [Darstellungsabnahme](issues/project-tomorrow.md) · [Audio und Sprachpflege](audio.md).
