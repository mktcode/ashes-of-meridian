# Neues Skybox-Motiv

Auf Nutzerwunsch nach `67a01d9` wurde das Eclipse-Motiv durch das bereitgestellte Weltraumbild ersetzt.

## Bilddaten

- Eingabe: `/tmp/pi-clipboard-14df4679-e942-4307-8d66-21234ddb192f.png`, 1774×887 Pixel; SHA-256 `819087352363e01418b6c84c3b1d7012a15cbf1007f8fcabe6816b0d617f385a`.
- Verlustfreie Konvertierung mit `magick INPUT.png -define webp:lossless=true -define webp:exact=true -quality 100 skybox.webp`.
- Neue `skybox.webp`: 1.553.814 Bytes; SHA-256 `1e083d62a27ad68a4b4979af4a4aa01027cd99cd580a54fcdeef945a49a4e56d`.
- `magick compare -metric AE INPUT.png skybox.webp null:` meldet **0** abweichende Pixel. Keine Skalierung oder verlustbehaftete Kompression. Die verlustfreie Datei ist deutlich größer als das alte, komprimierte Motiv (21.766 Bytes).
- `MERIDIAN_TEXTURES.sky` enthält die neuen WebP-Bytes als Base64. Nach Ausblenden genau dieses Literals ist `renderer.js` identisch zum vorherigen Stand. Kein geändertes Rendering, Sampling, Layout, RNG oder Save-Format; andere Assets und Testreferenzen unangetastet. Das temporäre Eingabe-PNG wird zur Laufzeit nicht benötigt.

## Ausgeführte Prüfungen

- Vollständiger [Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux: **111 bestanden**, keine Fehler, 128-MiB-Heaplimit, ein Worker. Bestehender Skybox-Test bestätigt Bytegleichheit zwischen Datei und Einbettung.
- Frischer Chromium `152.0.7977.75`, Linux/headless, `file://`, keine abgeschwächten Sicherheitsflags. `/tmp/meridian-skybox-browser.cjs`, Phase `skybox-replacement`: vier erfolgreiche Bild-Uploads, Skybox 1774×887, vollständiger temporärer Framebuffer, drei GPU-Pixel exakt gleich der dekodierten Quelle, Clamp-to-edge und `gl.getError()` jeweils 0.
- Acht Ansichten aufgenommen; Menü bei 1280×800 visuell geprüft: neues Motiv sichtbar. Erweiterter WASD-/Maus-/Bau-/Rekrutierungs-/Save-/Reload-/Backup-/Audio-API-Prüfablauf bestanden. Keine erfassten Laufzeit-/Konsolen-/Ressourcenfehler, kein externer Skybox-Request. Temporäre Browserprofile und heruntergeladene Backups entfernt.
- Dokumentationslinks/Anker und `git diff --check` geprüft.

Nicht geprüft: Firefox/andere Browser, HTTP, hörbares Audio, vollständige Kampagnen und umfassende Performanceprüfung. Insbesondere ist die größere Dateigröße kein Beleg für unveränderte Ladezeiten auf anderen Geräten.
