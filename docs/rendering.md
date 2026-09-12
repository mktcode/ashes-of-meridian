# Grafik und Assets

## Texturen und `file://`

- `src/renderer/assets.js` enthält `MERIDIAN_TEXTURES` mit drei Bodentexturen und der Skybox als Data-URLs. `geometry.js`, `shaders.js` und `runtime.js` ergänzen den Renderer in synchroner HTML-Reihenfolge. Kein externer Bildabruf zum Spielen nötig; lokale WebGL-Uploads dürfen keine gelockerten Sicherheitsflags erfordern.
- `skybox.webp` und `texture-floor-*.png` bleiben gepflegte Bildquellen. Skybox und Dirt-Einbettung müssen bytegleich zu ihren Bildquellen sein (Terrain-Tests). Nach Änderung von `texture-floor-dirt.png`: `node scripts/embed-ground-texture.mjs`, danach `npm run build`. Der explizite Aktualisierer bettet die PNG unverändert ein; kein Resizing, keine Neukodierung und keine stillschweigende Build-Synchronisation. Metall/Bio bleiben bestehende WebP-Einbettungen ohne automatischen PNG-Abgleich. Keine scheinbar redundanten Assets löschen.
- Dirt wird nicht farbgetreu auf den Boden gelegt: `world.ts` liefert variierte Biom-Grundfarben; `detail()` im Fragmentshader nutzt vor allem die Texturhelligkeit, auf dem Boden nur rund 6 % direkten Farbanteil. Die Bodenkachelung wiederholt das Bild alle rund 5,3 Weltmeter, weshalb sehr feine PNG-Muster beim normalen Zoom stark verkleinert werden. Warmes gerichtetes Licht, kühles Umgebungslicht, Schatten, Sichtnebel und Entfernungsdunst verändern das Ergebnis zusätzlich; Postprocessing ergänzt Vignette und Tonwertanpassung. Dieselbe Dirt-Textur liefert auch Felsdetails. Eine Texturaktualisierung ändert weder diese Regeln noch die Weltverteilung.
- Skybox: nicht wiederholt, seitenverhältnistreuer Cover-Shader, Clamp-to-edge, dunkler Ersatz bis zum asynchronen Upload. Kein Server als Ausweichlösung für fehlgeschlagene `file://`-Uploads.
- Metall/Bio verwenden skalierte Mesh-Lokalkoordinaten und lokale Textur-Normalen. Muster folgen Translation/Drehung; echte Skalierung erhält die Detaildichte. Bezug pro Mesh-Teil, keine garantierte Nahtlosigkeit zwischen Teilen. Boden und Felsen bleiben weltprojiziert.
- Fels- und Kristallgeometrie sind deterministisch variiert. Kosmetische Modelländerungen nicht mit Hindernisradien, Ressourcenmengen oder Terrain-Platzierung vermischen.

## Qualitätsstufen

- **High / Balanced:** größte gemeinsame Samplezahl für `RGBA8` und `DEPTH_COMPONENT24`, maximal 4× MSAA. Fehlerhafte Allokationen werden freigegeben; kleinere Samplezahl bzw. Single-Sample-Pfad als Rückfall.
- **High:** zusätzlich dezenter Screen-Space-Tilt-Shift im vorhandenen Postshader. Die mittleren 40 % der Bildhöhe bleiben scharf; oben/unten steigt der 3×3-Filterradius weich bis auf 0,6 % der kürzeren Renderdimension. Maximal acht zusätzliche Texturzugriffe pro unscharfem Pixel, kein zusätzlicher Pass, Renderpuffer oder Tiefentextur. Radius skaliert mit Auflösung/DPR; HUD und 2D-Overlays werden nicht gefiltert. Es ist eine feste Bildschirm-Schärfezone, keine physikalische Tiefenschärfe oder Reflexionsberechnung. Auch die High-Menüvorschau nutzt denselben Postshader.
- **Balanced:** Schatten/Bloom/MSAA bleiben, kein Tilt-Shift. **Performance:** kein MSAA, kein Schattenpass/Bloom/Tilt-Shift, geringere Renderauflösung. Kein zusätzlicher Antialiasing-/Unschärfeschalter im Profil. High wird in Settings als **High · tilt-shift** bezeichnet.
- Die neue Dirt-PNG benötigt unabhängig von der Qualitätsstufe mehr Lade-/Texturspeicher als die frühere kleine WebP-Kopie. High-Effekt und Texturgröße getrennt bewerten; keine Einschränkung des Gerätesupports beschlossen. Flüssigkeit, Akkulast und Speicherdruck müssen auf echten Zielgeräten gemessen werden.
- Skybox, Terrain, Modelle und transparente Effekte gehen ins Szenenziel. Danach bei MSAA genau ein Farb-Resolve mit `blitFramebuffer`, anschließend Postprocessing. Schattenpass bleibt separat, Canvas-eigenes Antialiasing ist aus.
- `resize()` erneuert die Renderziele; `Meridian.renderer.sceneSamples` zeigt die aktive Samplezahl (0 = kein MSAA). Das ist keine allgemeine Context-Restore-/Speichermangelbehandlung und kein Performanceversprechen.

## HUD

Die taktischen und responsiven HUD-Regeln liegen in `styles/hud.css`; gemeinsame Grundlagen und Menüoberflächen stehen davor in `styles/base.css` und `styles/screens.css`. Das Portrait-Deck liegt randbündig ohne Rahmen/Spaltentrennlinien. Die Minimap (210×210 Zeichenpuffer) füllt die linke Bildschirmhälfte, rechts liegen scrollbare Menüs. Deckhöhe: `min(50vw, 36dvh)`; darüber die 76 px hohe Fähigkeitenleiste. Kamera-/Radiopositionen berücksichtigen beide Leisten. Der dunkle Minimap-Hintergrund bleibt auf der Spalte statt dem Canvas, um die beobachtete Chromium-Fehlfläche zu vermeiden.

Links neben dem Basiskameraknopf sitzt der Attack-move-Umschalter mit lokalem Schwerter-SVG. Goldene Füllung und `aria-pressed="true"` markieren aktiv; ein erneuter Tap schaltet zurück auf normale Bewegung. Er verwendet die bestehenden Kameraknopfgrößen.

Links auf Höhe der Kameraknöpfe sitzt der 54 px breite Tempo-Button. Er zeigt den aktuellen Wert einschließlich 0,75× ohne Umbruch; die separate Tempozeile unter der Uhr ist entfernt. Die Höhe entspricht den Kameraknöpfen (30 px, bis 850 px Fensterbreite 27 px).

Queue-Symbole stehen links oberhalb des Tempo-Buttons mit freiem Abstand; ihre maximale Scrollhöhe berücksichtigt den reservierten Platz. Sie tragen Zähler und ein helles `conic-gradient`-Overlay. Dessen Winkel folgt dem Produktionsfortschritt, nicht einer unabhängig laufenden CSS-Animation. Buttons bleiben währenddessen stabil; native Touch-Scrollflächen und `touch-action: manipulation` verhindern unnötige Browser-Tap-Gesten. Regeln: [Spiel und Bedienung](gameplay.md).

[Prüfverfahren](testing.md) · [zentrales Arbeitsprotokoll](worklog.md)
