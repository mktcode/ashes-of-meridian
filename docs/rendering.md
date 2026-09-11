# Grafik und Assets

## Texturen und `file://`

- `src/renderer/assets.js` enthält `MERIDIAN_TEXTURES` mit drei Bodentexturen und der Skybox als Data-URLs. `geometry.js`, `shaders.js` und `runtime.js` ergänzen den Renderer in synchroner HTML-Reihenfolge. Kein externer Bildabruf zum Spielen nötig; lokale WebGL-Uploads dürfen keine gelockerten Sicherheitsflags erfordern.
- `skybox.webp` und `texture-floor-*.png` bleiben gepflegte Bildquellen. Die Skybox-Einbettung muss bytegleich zur WebP-Datei sein (Terrain-Test). Für Boden-PNGs gibt es keinen automatischen Abgleich. Bildänderungen und Einbettungen bewusst gemeinsam pflegen, keine scheinbar redundanten Assets löschen.
- Skybox: nicht wiederholt, seitenverhältnistreuer Cover-Shader, Clamp-to-edge, dunkler Ersatz bis zum asynchronen Upload. Kein Server als Ausweichlösung für fehlgeschlagene `file://`-Uploads.
- Metall/Bio verwenden skalierte Mesh-Lokalkoordinaten und lokale Textur-Normalen. Muster folgen Translation/Drehung; echte Skalierung erhält die Detaildichte. Bezug pro Mesh-Teil, keine garantierte Nahtlosigkeit zwischen Teilen. Boden und Felsen bleiben weltprojiziert.
- Fels- und Kristallgeometrie sind deterministisch variiert. Kosmetische Modelländerungen nicht mit Hindernisradien, Ressourcenmengen oder Terrain-Platzierung vermischen.

## Qualitätsstufen

- **High / Balanced:** größte gemeinsame Samplezahl für `RGBA8` und `DEPTH_COMPONENT24`, maximal 4× MSAA. Fehlerhafte Allokationen werden freigegeben; kleinere Samplezahl bzw. Single-Sample-Pfad als Rückfall.
- **Performance:** kein MSAA, geringere Renderauflösung. Kein zusätzlicher Antialiasing-Schalter im Profil.
- Skybox, Terrain, Modelle und transparente Effekte gehen ins Szenenziel. Danach bei MSAA genau ein Farb-Resolve mit `blitFramebuffer`, anschließend Postprocessing. Schattenpass bleibt separat, Canvas-eigenes Antialiasing ist aus.
- `resize()` erneuert die Renderziele; `Meridian.renderer.sceneSamples` zeigt die aktive Samplezahl (0 = kein MSAA). Das ist keine allgemeine Context-Restore-/Speichermangelbehandlung und kein Performanceversprechen.

## HUD

Das Portrait-Deck liegt randbündig ohne Rahmen/Spaltentrennlinien. Die Minimap (210×210 Zeichenpuffer) füllt die linke Bildschirmhälfte, rechts liegen scrollbare Menüs. Deckhöhe: `min(50vw, 36dvh)`; darüber die 76 px hohe Fähigkeitenleiste. Kamera-/Radiopositionen berücksichtigen beide Leisten. Der dunkle Minimap-Hintergrund bleibt auf der Spalte statt dem Canvas, um die beobachtete Chromium-Fehlfläche zu vermeiden.

Queue-Symbole stehen links darüber, mit Zähler und hellem `conic-gradient`-Overlay. Dessen Winkel folgt dem Produktionsfortschritt, nicht einer unabhängig laufenden CSS-Animation. Buttons bleiben währenddessen stabil; native Touch-Scrollflächen und `touch-action: manipulation` verhindern unnötige Browser-Tap-Gesten. Regeln: [Spiel und Bedienung](gameplay.md).

[Prüfverfahren](testing.md) · [zentrales Arbeitsprotokoll](worklog.md)
