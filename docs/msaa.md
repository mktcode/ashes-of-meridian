# MSAA im bestehenden WebGL-2-Renderer

Gezielte Darstellungsänderung nach `00cce29`, kein Wechsel des Technologiestacks. Der bisherige `antialias:true`-Canvas glättete nicht die zuvor in ein eigenes Single-Sample-Renderziel gezeichneten Modellkanten.

## Renderpfad und Rückfall

- **High und Balanced:** größtmögliche gemeinsame Samplezahl für `RGBA8` und `DEPTH_COMPONENT24`, maximal 4, über `getInternalformatParameter(..., SAMPLES)` ermittelt. Eigene Farb-/Tiefenrenderbuffer mit `renderbufferStorageMultisample` und vollständigem Framebuffer. Unvollständige Ziele werden freigegeben und die nächste unterstützte kleinere Samplezahl versucht; auch null-Ressourcen werden aufgeräumt.
- **Performance:** kein MSAA. Auflösungsskalierung und Pixel-Ratio-Limit aller Qualitätsstufen bleiben unverändert.
- Skybox, Terrain, Modelle und anschließend geblendete Effekte werden in das aktive Szenenziel gezeichnet. Bei MSAA erfolgt genau ein gleich großer, ausschließlich farblicher `NEAREST`-Blit vom Multisample-Ziel in den bisherigen Szenen-Framebuffer. Erst danach folgen unveränderte Bloom-/Vignetten-/Grain-Shader und Bildschirmausgabe. Der separate Schattenpass bleibt unverändert.
- Das Canvas selbst fordert kein zusätzliches Antialiasing mehr an: Es zeigt nur das fertige Vollbildrechteck. Die relevanten Samples liegen nun im Szenenziel.
- `sceneSamples` zeigt die aktive Zahl, 0 bedeutet kein MSAA. Über `Meridian.renderer.sceneSamples` im Browser inspizierbar. Kein neuer Storage-Schlüssel oder Einstellungswert; bestehende Profile bleiben kompatibel.
- `releaseSceneMSAA()` entsorgt alte Farb-/Tiefenbuffer und Framebuffer. `resize()` erstellt sie passend zu Auflösung und Qualität erneut. Der bisherige Single-Sample-Framebuffer samt Tiefenbuffer bleibt als Resolve-Ziel bzw. Rückfall erhalten.
- Keine Änderungen an Assets, Shadern, Simulation, RNG, Szenenaufbau, UI oder Test-Fixtures. MSAA glättet Geometrieabdeckung, nicht die gewollte Low-Poly-Form oder jede shader-/texturinterne Kante.

MSAA kostet zusätzliche GPU-Zeit und Speicher. Beispielsweise benötigen vier Farb- und Tiefensamples grob 32 Bytes pro Renderpixel zusätzlich (treiberabhängig). Vollständiger Kontextverlust oder allgemeiner Speichermangel wird damit nicht grundsätzlich behoben; eine neue Context-Restore-Implementierung ist nicht Teil dieser Änderung.

## Ausgeführte Prüfungen

- Vollständiger [Testbefehl](testing.md#automatisierte-tests): **119 bestanden**, 0 fehlgeschlagen, Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit und ein Worker. Sieben neue Renderer-Tests verwenden echte Renderer-Methoden mit einem WebGL-API-Testdouble, keine echte GPU. Abgedeckt sind 4×-Auswahl, gemeinsame kleinere Samplezahl, fehlende Unterstützung, unvollständige und null-Allokationen, Freigabe/Neuaufbau, unveränderte Auflösungsskalierung sowie Reihenfolge von Geometrie, Effekten, Resolve und Postprocessing.
- Frischer Chromium `152.0.7977.75`, Linux/headless, `file://`, temporäres Profil, keine abgeschwächten Sicherheitsflags. Probe `/tmp/meridian-msaa-browser.cjs`, Phase `msaa`, erweitert die bisherige Skybox-/WASD-Probe. Kein Hörtest.
- GPU-Abfragen bestätigen **4 Samples** für beide 1280×800-Renderbuffer, tatsächlich ausgeführte Blits und `gl.getError() === 0`. High/Balanced jeweils 4, Performance 0; vorhandene Prüfungen für Canvasgrößen und laufende Frames in allen Qualitätsstufen bestanden. Echter 2×-Betrieb auf anderer Hardware ist nicht nachgewiesen; 2×-Auswahl/-Rückfall ist im Node-Testdouble geprüft.
- Temporär injizierte leere Format-Samplelisten und ein unvollständiger MSAA-Framebuffer führen zum Single-Sample-Pfad. Alte Objekte sind laut `isFramebuffer`/`isRenderbuffer` freigegeben; nach Entfernen der Injektion ist 4× wieder aktiv. Keine natürlich auftretende GPU-Allokations-/OOM-Störung simuliert oder behauptet.
- Deterministischer GPU-Abdeckungstest: weißes schräges Dreieck auf schwarzem Grund in denselben Szenenzielen, 64×64-Pixelausschnitt. Ohne MSAA nur Werte 0/255 und **0** teilweise bedeckte Pixel; mit MSAA Werte 0/64/128/192/255 und **129** teilweise bedeckte Pixel. Beide Läufe ohne GL-Fehler. Die Anzahl ist ein gemessenes Ergebnis, keine neue plattformübergreifende Fixture.
- Gleiche eingefrorene Spielgeometrie/Kamera und identischer Shader-Zeitwert 123 mit/ohne MSAA als Canvas-PNG aufgenommen und visuell verglichen: deutlich glattere Gebäude-, Ring- und Einheitenkanten. Dateien `/tmp/meridian-msaa-off.png` und `/tmp/meridian-msaa-on.png`; keine HUD-Screenshots. Der Probe stoppt dazu am Ende die weitere RAF-Planung, nicht der Spielcode.
- Erweiterter Klick-/WASD-/Pfeiltasten-/Bau-/Rekrutierungs-/Save-/Reload-/Backup-Download-/Import-/Audio-API-Ablauf bestanden. Vier Shaderprogramme verlinkt, vier eingebettete Bild-Uploads erfolgreich, kein verlorener Kontext und keine erfassten Laufzeit-/Konsolen-/Ressourcenfehler. Die erste Probe nahm für eine Buffergrößen-Abfrage noch 800×700 an, obwohl der vorhandene Ablauf bereits auf 1280×800 gewechselt hatte; nur die Probe korrigiert.
- Browserprofile und heruntergeladene Backups entfernt. Dokumentationslinks/Anker und `git diff --check` geprüft.

Offen: Firefox/andere Browser und GPUs, HTTP, natürliche Speicherknappheit/Kontextverlust, hörbares Audio, vollständige Kampagnen sowie systematische GPU-Speicher-/FPS-Messungen. Die erfolgreiche Headless-Probe ist kein Performanceversprechen für alle Geräte.
