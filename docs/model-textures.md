# Modellfeste Metall- und Bio-Texturen

Gezielte Shader-Korrektur nach `8a68c2c`: Die bisherige triplanare Projektion verwendete auch auf beweglichen Modellen Weltposition/-normale. Modelle bewegten und drehten sich dadurch durch ein weltfestes Texturmuster.

## Änderung

- Zwei zusätzliche Varyings in `renderer.js`: skalierte Mesh-Lokalposition und lokale Textur-Normale. Die Achsenlängen der vorhandenen Modellmatrix liefern die Skalierung ohne Welttranslation/-rotation; ein Minimum von 0,00001 vermeidet neue Divisionen durch null in der Textur-Normalen.
- `v_modelPos = a_pos * textureScale`, `v_modelN = a_normal / textureScale`. Metall und Bio verwenden diese Koordinaten samt normalisierter lokaler Normale für die triplanaren Gewichte. Die Faktoren 0,33/0,17, Texturdateien, Mischstärken und Glow-/Alpha-Bedingungen bleiben unverändert.
- Translation, Drehung, bewegte Gliedmaßen und schwebende Modellteile nehmen ihre Texturen mit. Verschieden große Teile behalten die bisherige Größenordnung der Texturdetails. Auch Gebäude mit Metall-/Bio-Material verwenden nun diesen Bezug; Lage und Ausrichtung ihres Musters ändern sich dadurch absichtlich.
- Der Bezug ist pro Mesh-Instanz/Modellteil. Es entsteht kein gemeinsames UV-Netz mit garantierter Nahtlosigkeit zwischen Bauteilen. Bei echter Skalierungsanimation (z. B. wachsendem Gebäude während des Aufbaus) wird weiterhin die Detaildichte erhalten, nicht ein unveränderliches Muster aufgedehnt.
- Boden, Felsen und Fels-Schichtung bleiben weltbezogen. Bestehende Weltposition/-normale für Beleuchtung, Reflexe, Schatten und Sicht-/Entfernungsnebel bleiben unverändert; keine beiläufige Korrektur ihrer bisherigen Normalenbehandlung. Licht und Reflexe dürfen sich bei Bewegung weiterhin verändern.
- Keine Änderungen an Meshes, Instanzlayout, Materialkennungen, Assets, MSAA, Spiel-/Save-Daten oder RNG. Kein Build, Server oder zusätzliche Laufzeitabhängigkeit.

## Ausgeführte Prüfungen

- Vollständiger [Testbefehl](testing.md#automatisierte-tests): **120 bestanden**, 0 fehlgeschlagen, Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit, ein Worker. Ein zusätzlicher Renderer-Test prüft die Shader-Quellverdrahtung von Skalierung, Varyings, Material-Sampling und beibehaltenen Weltkoordinaten. Node führt kein GLSL aus. Bestehende Layout-/Simulations-/Effekt-Fixtures unverändert.
- Frischer Chromium `152.0.7977.75`, Linux/headless, `file://`, temporäres Profil und keine abgeschwächten Sicherheitsflags. `/tmp/meridian-texture-browser.cjs`, Phase `model-textures`, erweitert die vorherige MSAA-Probe.
- GPU-Materialdiagnose vergleicht Shader aus `8a68c2c` mit den neuen Shadern. Nur Rasterposition und Ausgabe werden in diagnostischen Shaderkopien fixiert: Gezeigt wird Material-Grundfarbe ohne Beleuchtung/Schatten/Nebel. Produktions-Koordinatenrechnung, Materialzweige, Triplanar-Funktion und echte Texturen bleiben darin erhalten. Eine gemeinsame Rasterfläche erlaubt den direkten Pixelvergleich ohne veränderten Blickwinkel als Störfaktor.
- Modellmatrizen kommen aus dem unveränderten `MeridianRenderer.add()`: nicht uniforme Skalierung 1,7/2,3/0,8, Ausgangspose, reine Translation, Translation plus Y-Drehung und kombinierte Drehung um drei Achsen. Je ein 50×50-Innenausschnitt aus 64×64 GPU-Pixeln geprüft.
- Vorher änderten sich bei Metall/Bio je Pose Tausende RGB-Kanalwerte, maximal 16–32 Stufen. Nachher **0** veränderte Kanalwerte in allen drei Vergleichen für beide Materialien. Die Probe erlaubt bei Rotation höchstens eine Stufe Rundungsdifferenz; gemessen wurde keine. Die Muster sind nicht konstant (69/68 unterschiedliche Bytewerte).
- Boden- und Fels-Grundfarben bleiben für jede der vier Posen zwischen altem und neuem Shader exakt gleich. Sie dürfen bei Bewegung der Testfläche weiterhin weltbezogen variieren. GPU-Ergebnis: `/tmp/meridian-texture-motion.json`, `gl.getError() === 0`.
- Zwölf zusätzliche Canvas-Aufnahmen mit echtem `renderEntity`: je drei Positions-/Dreh-/Animationsposen für Rifle-Einheiten aller drei Fraktionen und ein Flugmodell der Free Marches. Repräsentative Rifle-Aufnahmen aller drei Fraktionen visuell geprüft. Statische Welt für diese isolierten Modellbilder nur im Probe entfernt; keine Behauptung eines visuellen Echtzeit-/Videovergleichs. Dateien `/tmp/meridian-texture-f<Fraktion>-<Typ>-<Pose>.png`.
- Vollständige bisherige MSAA-Probe weiterhin bestanden: tatsächliche 4 Samples, Resolve, Qualitätsstufen, Resize, injizierte Fallbacks und GPU-Kantenabdeckung. Ebenso erweiterter Spiel-/WASD-/Maus-/Bau-/Rekrutierungs-/Save-/Reload-/Backup-/Audio-API-Ablauf. Vier reguläre Shaderprogramme verlinkt, vier eingebettete Bild-Uploads erfolgreich, keine erfassten Laufzeit-/Konsolen-/Ressourcenfehler.
- Temporäre Browserprofile und heruntergeladene Backups entfernt. Dokumentationslinks/Anker und `git diff --check` geprüft.

Offen: Firefox/andere Browser und GPUs, HTTP, alle Einheiten-/Bauzustände, kontinuierlicher visueller Bewegungsvergleich, hörbares Audio, umfassende Performanceprüfung und vollständige Kampagnen. Die GPU-Pixelprobe belegt das Materialverhalten unter kontrollierten Transformationen, nicht die gesamte Spielgrafik.
