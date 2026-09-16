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
- Statischer Boden, Relief, Felsen, Bäume und Dekoration werden nicht räumlich gecullt. Die vollständigen statischen Batches laufen bei High/Balanced durch Schatten- und Szenenpass (`src/world-view.ts`, `src/renderer/runtime.ts`). Die GPU clippt außerhalb liegende Geometrie erst nach der Einreichung.
- Desert zählt im dokumentierten Galerie-Stand rund 1,32 Millionen statische Dreiecke je Pass und 78,5 MiB aktive Terrain-Vertexdaten; diese Werte sind keine aktuelle Pixel-7-Messung.
- High rendert bis zu 1,6× CSS-Auflösung je Achse, versucht bis zu 4× MSAA, nutzt eine 1536²-Schattenkarte, drei Bloom-Pässe und High-spezifisches Tilt-Shift. Der Renderloop besitzt kein eigenes Framelimit; auf Displays über 60 Hz können deshalb mehr Frames angefordert werden, obwohl die Simulation in 20-Hz-Schritten läuft und keine Renderinterpolation besitzt.
- Alle eingebetteten Welt-/Materialtexturen werden beim Rendererstart auf die GPU geladen. Ihre etwa 11 Millionen Ausgangspixel benötigen als RGBA-Texturen mit Mipmaps größenordnungsmäßig rund 56 MiB vor Treiber-Overhead, auch wenn kartenspezifische Texturen im aktuellen Gefecht nicht gebraucht werden.
- Viele Kampfeffekte werden nach Sicht, aber nicht allgemein nach Kameraausschnitt gefiltert. Bewegungsstaub besitzt bereits enges Viewport-Culling.
- Bewegung/Kollision besitzt bekannte skalierende CPU-Kosten durch wiederholte Live-Entitätsscans; das ist getrennt von der konkret beobachteten GPU-Störung zu messen und darf nicht auf den innerhalb eines Simulationsschritts veralteten Kampfhash umgestellt werden.

## Kleine qualitätsneutrale Kandidaten

Zwei lokale Pakete sind umgesetzt: dauerhaft leere Instanzbuckets verursachen keine wiederholten Null-Uploads mehr, der Übergang belegt → leer wird weiterhin einmal hochgeladen; der periodische HUD-Pfad dupliziert die ohnehin frameweise Queue-Aktualisierung nicht mehr; bereits typisierte Geometriedaten werden ohne vollständige zweite CPU-Kopie an WebGL übergeben. Auswahlprüfungen in 3D- und Overlaydurchlauf verwenden je Frame ein Set, Floating Text außerhalb eines sicheren Randpuffers wird nicht gezeichnet, und der flache Grundboden bleibt im Szenenpass, wird aber nicht mehr als wirkungsloser Schatten-Caster eingereicht. Renderer-/UI-Regressionen sichern diese Verträge ab. Die verbleibenden Kandidaten sind keine pauschale Implementierungsfreigabe:

1. **Ruhende Ansichten:** vollständiges Battlefield-Rendering bei Pause, Settings, Ergebnis und verborgenem Tab aussetzen bzw. ereignisgesteuert neu zeichnen. Aktives Gameplay bleibt unverändert.
2. **Effekt-Culling:** weitere Offscreen-Effekte anhand ihrer tatsächlichen Segment-/Radius-/Höhenbounds verwerfen; große Ringe, Strahlen und Schatteneinfluss dürfen nicht sichtbar aufpoppen.
3. **Redundante Schattenframes:** die Schattenkarte wiederverwenden, solange Casterzustand, Karte, Qualität und Kamera-/Lichtprojektion unverändert sind. Vollständige Invalidierung ist Voraussetzung.
4. **Texturresidenz:** kartenspezifische Texturen erst für die aktuelle Karte hochladen und bei Kartenwechsel kontrolliert freigeben. Entitätsmaterialien, `file://` und ein artefaktfreier synchronisierter Übergang bleiben Pflicht.

## Größere qualitätsneutrale Richtung

Statische Weltgeometrie und Platzierungen räumlich chunken. Szenenpass und Schattenpass wählen getrennt nur überlappende Chunks mit passenden Höhen- und Casterreserven. Das ist voraussichtlich der größte Hebel ohne reduzierte Modelle oder Dekoration, aber kein Kleinstumbau: Reliefnormalen und Übergänge müssen nahtlos bleiben, Draw-Call-Zahl und Chunkgröße gegeneinander gemessen werden, und außerhalb des Bildes liegende sichtbare Schatten dürfen nicht verschwinden.

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
- Desert gegenüber Alien Planet und Mothership bei vergleichbarer Kamera und Armee.

Desktop-, Software-WebGL- und Node-Prüfungen ersetzen diese Echtgerätemessung nicht. Ein 60-FPS-Limit oder automatische Qualitätswahl nicht vorab als qualitätsneutral ausgeben.
