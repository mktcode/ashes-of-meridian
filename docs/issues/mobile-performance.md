# Mobile GPU-Last und WebGL-Kontextverlust

Auf einem Google Pixel 7 unter Chrome wurde erstmals ein konkretes mobiles Lastproblem beobachtet. Dieses Issue bündelt Befund, statische Codeanalyse und nächste Mess-/Optimierungsschritte; allgemeine Geräteabnahme bleibt unter [Playtest-Validierung](playtest-validation.md), die bekannte Desert-Last unter [Desert](desert-map.md).

## Beobachteter Befund

- Qualität: **High**.
- Das Gerät wurde relativ schnell warm.
- Nach längerer Spielzeit fror das Spiel ein; anschließend erschien die vorhandene Meldung zum Verlust der Grafikverbindung.
- Ein unmittelbarer Reload endete mit „WebGL 2 is unavailable“. Nach einer Wartezeit ließ sich das Spiel wieder starten.
- Karte, Spielsituation, Laufdauer, Entitätszahl, Framerate, Chrome-Version und Akkuzustand wurden nicht protokolliert.

Die erste Meldung entspricht dem `webglcontextlost`-Pfad in `src/app.ts`; beim Reload lieferte `canvas.getContext('webgl2', …)` vorübergehend keinen Kontext. Das passt zu einem GPU-/Treiber-Reset unter Last oder Speicher-/Thermikdruck, beweist dessen genaue Ursache aber nicht. Ein fortlaufender WebGL-Ressourcen-Leak ist in der statischen Prüfung nicht belegt.

## Relevante Kostenformen im aktuellen Renderer

- Dynamische Entitäten werden in `src/app.ts` bereits nach Sicht und projiziertem Viewport plus großem Puffer gefiltert. Die CPU durchläuft dafür weiterhin die gesamte Entitätsliste.
- Im Ausgangsstand wurden statischer Boden, Relief, Felsen, Bäume und Dekoration nicht räumlich gecullt. Der Renderer teilt nun große statische Dreiecksmeshes und gruppiert Platzierungen in 32-Welteinheiten-Chunks; Szenen- und Schattenpass prüfen deren vollständige Welt-Bounds getrennt gegen Kamera- beziehungsweise Licht-Clipvolumen (`src/world-view.ts`, `src/renderer/runtime.ts`).
- Desert zählt im dokumentierten Galerie-Stand rund 1,32 Millionen statische Dreiecke je Pass und 78,5 MiB aktive Terrain-Vertexdaten; diese Werte sind keine aktuelle Pixel-7-Messung.
- High rendert bis zu 1,6× CSS-Auflösung je Achse, versucht bis zu 4× MSAA, nutzt eine 1536²-Schattenkarte, drei Bloom-Pässe und High-spezifisches Tilt-Shift. Der Renderloop besitzt kein eigenes Framelimit; auf Displays über 60 Hz können deshalb mehr Frames angefordert werden, obwohl die Simulation in 20-Hz-Schritten läuft und keine Renderinterpolation besitzt.
- Im Ausgangsstand wurden alle eingebetteten Welt-/Materialtexturen beim Rendererstart auf die GPU geladen: etwa 11 Millionen Ausgangspixel beziehungsweise größenordnungsmäßig rund 56 MiB als RGBA mit Mipmaps vor Treiber-Overhead. Nun bleiben Himmel und die von Entitätsmodellen benötigten Metall-/Bio-Texturen gemeinsam resident; die vier Desert-spezifischen Texturen werden nur für dessen Vorschau oder Gefecht geladen und beim Wechsel auf Alien Planet beziehungsweise Mothership samt Mipmaps freigegeben.
- Viele Kampfeffekte werden nach Sicht, aber nicht allgemein nach Kameraausschnitt gefiltert. Bewegungsstaub besitzt bereits enges Viewport-Culling.
- Bewegung/Kollision besitzt bekannte skalierende CPU-Kosten durch wiederholte Live-Entitätsscans; das ist getrennt von der konkret beobachteten GPU-Störung zu messen und darf nicht auf den innerhalb eines Simulationsschritts veralteten Kampfhash umgestellt werden.

## Kleine qualitätsneutrale Kandidaten

Drei lokale Pakete sind umgesetzt: dauerhaft leere Instanzbuckets verursachen keine wiederholten Null-Uploads mehr, der Übergang belegt → leer wird weiterhin einmal hochgeladen; der periodische HUD-Pfad dupliziert die ohnehin frameweise Queue-Aktualisierung nicht mehr; bereits typisierte Geometriedaten werden ohne vollständige zweite CPU-Kopie an WebGL übergeben. Auswahlprüfungen in 3D- und Overlaydurchlauf verwenden je Frame ein Set, Floating Text außerhalb eines sicheren Randpuffers wird nicht gezeichnet, und der flache Grundboden bleibt im Szenenpass, wird aber nicht mehr als wirkungsloser Schatten-Caster eingereicht. Kartenspezifische Texturresidenz bereitet bekannte nächste Gefechte im Menühintergrund vor und hält die Simulation bei einem ungecachten Start bis zum asynchronen Decode/Upload an. Renderer-/UI-Regressionen sichern diese Verträge ab. Die verbleibenden Kandidaten sind keine pauschale Implementierungsfreigabe:

1. **Ruhende Ansichten:** vollständiges Battlefield-Rendering bei Pause, Settings, Ergebnis und verborgenem Tab aussetzen bzw. ereignisgesteuert neu zeichnen. Aktives Gameplay bleibt unverändert.
2. **Effekt-Culling:** weitere Offscreen-Effekte anhand ihrer tatsächlichen Segment-/Radius-/Höhenbounds verwerfen; große Ringe, Strahlen und Schatteneinfluss dürfen nicht sichtbar aufpoppen.
3. **Redundante Schattenframes:** die Schattenkarte wiederverwenden, solange Casterzustand, Karte, Qualität und Kamera-/Lichtprojektion unverändert sind. Vollständige Invalidierung ist Voraussetzung.

## Größere qualitätsneutrale Richtung

Statische Weltgeometrie und Platzierungen sind ohne Änderung der Quelldreiecke räumlich gechunkt: große Meshes werden entlang vollständiger Dreiecke aufgeteilt, platzierte Meshes nach Weltbereich gruppiert und beide über transformierte AABBs konservativ gecullt. Szenenpass und Schattenpass verwenden getrennt Kamera- und Licht-Clipvolumen. Die erste manuelle Sichtprüfung zeigte keine Auffälligkeiten; Draw Calls und Stabilität auf dem Pixel 7 bleiben Teil der ausstehenden Vergleichsmessung.

## Stärkere Hebel mit Qualitätsabwägung

Erst nach den qualitätsneutralen Maßnahmen und Messungen entscheiden:

- aktives Rendering auf 60 FPS begrenzen,
- MSAA auf mobilen High-Profilen höchstens 2× verwenden oder gegen die erhöhte Renderauflösung abwägen,
- High-Auflösung unter 1,6× senken,
- Schattenauflösung/-filter oder Aktualisierungsrate reduzieren,
- Tilt-Shift/Bloom günstiger ausführen,
- zuletzt Relief-/Dekorationsgeometrie reduzieren; dies benötigt gesonderte visuelle Freigabe.

## Nächste Diagnose

Auf dem Pixel 7 zunächst denselben reproduzierbaren Abschnitt getrennt mit High, Balanced und Performance prüfen und mindestens Karte, Laufdauer, Entitätszahl, FPS-Verlauf sowie Zeitpunkt von Wärme, Einfrieren oder Kontextverlust notieren. High gegen Balanced trennt vor allem erhöhte Renderauflösung und Tilt-Shift; Performance entfernt zusätzlich Schatten, MSAA, Bloom und mehrere Ergänzungseffekte. Danach gezielt erfassen:

- tatsächliche rAF-Rate und CPU-Zeit von Simulation, Renderaufbau und UI,
- GPU-Zeit von Schatten-, Szenen-, Bloom- und Postpass, soweit `EXT_disjoint_timer_query_webgl2` verfügbar ist,
- eingereichte statische Dreiecke/Instanzen je Pass, sichtbare dynamische Instanzen und Uploadbytes,
- Renderzielgröße, gewählte MSAA-Samplezahl und Kontextverlustereignis,
- Desert gegenüber Alien Planet und Mothership bei vergleichbarer Kamera und Armee,
- mehrere sichtbare Veiled-Court-Processional-Gates: das neue Portalmaterial berechnet verzerrtes Rauschen pro Fragment (auch eingefroren in Performance). Der lokale Chromium-Check bestätigt Shaderkompilierung und zeitabhängige Pixel ohne WebGL-Fehler, nicht die GPU-Kosten auf dem Pixel 7.

Desktop-, Software-WebGL- und Node-Prüfungen ersetzen diese Echtgerätemessung nicht. Ein 60-FPS-Limit oder automatische Qualitätswahl nicht vorab als qualitätsneutral ausgeben.
