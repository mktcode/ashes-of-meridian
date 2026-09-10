# Skybox ohne Server

Gezielte Korrektur nach `2b124d6`: Die externe `file://`-Bildquelle wurde bisher vom Browser für WebGL als nicht origin-clean behandelt; `texImage2D` warf einen `SecurityError`. Die dunkle Ersatztextur blieb sichtbar.

## Änderung

`MERIDIAN_TEXTURES.sky` in `renderer.js` enthält jetzt `data:image/webp;base64,...` mit exakt den Bytes aus `skybox.webp`. Der vorhandene asynchrone `loadTexture`-Aufruf verwendet diese URL statt des Dateipfads. Filterung, Mipmaps, Clamp-to-edge, Cover-Shader und Ersatztextur bleiben unverändert. Kein Fetch, Server, neues Skript, Build oder Sicherheitsflag.

- Original: 21.766 Bytes, 1774×887 Pixel, SHA-256 `121ef0cd3f73debe5a62be5b5928076478731b578243d58e9ccdc68c85daf706`.
- Base64 repräsentiert die Originalbytes, keine erneute Bildkompression und kein Qualitätsverlust.
- Originaldatei und drei externe Boden-PNGs bleiben bytegleich erhalten. Bestehende Einbettungen und restlicher Renderer sind unverändert; durch Rücknahme ausschließlich der neuen Eigenschaft und des URL-Verweises wurde exakte Gleichheit mit dem vorherigen Renderer geprüft.
- Bei einem späteren absichtlichen Austausch der Skybox auch die Base64-Einbettung aktualisieren. Der neue Test erzwingt Bytegleichheit, es gibt keinen automatischen Build-/Synchronisierungsschritt. Für die Bodentexturen wurde kein solcher neuer Abgleich eingeführt.

## Ausgeführte Prüfungen

- Vollständiger [Testbefehl](testing.md#automatisierte-tests): **111 bestanden**, keine Fehler, Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit und ein Worker. Neuer Terrain-Test prüft MIME/Base64, WebP-Signatur, Bytegleichheit zur Originaldatei und die Quellverdrahtung des nicht wiederholenden Skybox-Aufrufs. Keine Änderung an bestehenden Layout-/Simulations-/Effekt-Fixtures.
- Frischer Chromium `152.0.7977.75`, Linux/headless, `file://`, temporäres Browserprofil, keine abgeschwächten Sicherheitsflags. Temporäre Probe `/tmp/meridian-skybox-browser.cjs`, Phase `skybox`, auf Basis der erweiterten WASD-Probe.
- Vier erfolgreiche eingebettete Bild-Uploads: drei 512×512 und die Skybox 1774×887. Vier verlinkte Shaderprogramme, kein verlorener WebGL-Kontext, laufende Frames und Draw-Calls in allen drei Qualitätsstufen.
- Skybox-Textur an einen temporären Framebuffer gebunden: vollständig; drei `readPixels`-Stichproben stimmen bytegenau mit derselben im 2D-Canvas dekodierten Bildquelle überein. Keine dunkle Ersatztextur, beide Wrap-Richtungen Clamp-to-edge und drei `gl.getError()`-Abfragen jeweils 0. GPU-Bindungen anschließend wiederhergestellt.
- Acht Ansichten bei 1280×800 und 800×700 aufgenommen. Menü bei 1280×800 und Spiel bei 800×700 visuell geprüft; der Eclipse-Himmel ist im Menü deutlich sichtbar. Kein Gleichheitsvergleich der bisherigen dunklen Hintergrund-Screenshots beabsichtigt.
- Erweiterter Maus-/WASD-/F-/Pfeiltasten-/Bau-/Rekrutierungs-/Save-/Reload-/Backup-Download-/Import-Ablauf sowie Audio-Kontext-/Gain-API-Prüfungen bestanden. Keine hörbare Audio-Prüfung.
- **Keine** erfassten Laufzeit-/Konsolen-/Ressourcenfehler und kein externer Request nach `skybox.webp`. Insbesondere entfallen die bisher drei Skybox-SecurityErrors der drei Seitenladungen.
- Die erste Probe identifizierte fälschlich das erste WebP als Skybox; auch die bestehenden eingebetteten Bodentexturen sind WebP. Die Probe identifiziert den Upload nun zusätzlich über die Skybox-Abmessungen. Kein Spielcode für diese Prüfkorrektur verändert.
- Temporäre Browserprofile und heruntergeladene Backups entfernt; Dokumentationslinks/Anker und `git diff --check` geprüft.

Nicht geprüft: Firefox und andere Browser, HTTP, hörbare Audioausgabe, vollständige Kampagnen und umfassende Performance-/Browser-Checkliste. Die historische Firefox-Sperrmeldung ist kein Nachtest dieser Änderung.
