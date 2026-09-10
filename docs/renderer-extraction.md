# Renderer-Auslagerung ohne Code- oder Assetänderung

Referenz vor der Änderung: Commit `4b3b4f0`.

## Umfang und Inhaltsprüfung

Der komplette bisherige Renderer-Block wurde nach `renderer.js` verschoben: **775 Zeilen, 351.637 Bytes**, einschließlich Kommentar, Strict-Mode-Direktive, `MAT`, `MERIDIAN_TEXTURES`, `geom`, sieben Shaderkonstanten und `MeridianRenderer`.

**Der Skriptinhalt ist vollständig bytegleich geblieben.** Anders als bei den kleineren Auslagerungen wurde auch die vierstellige HTML-Einrückung bewusst beibehalten. Keine Umformatierung mehrzeiliger Shaderliterale, keine Änderungen oder Neucodierung der eingebetteten Bilddaten. Eine spätere Einrückungsbereinigung wäre ein separater Formatierungsschritt.

SHA-256 des übernommenen Blocks und der neuen Datei: `3d32b81c370b58ba3c45ce003c25a555e674ea7d8cd081796fc66b2d6e48a117`.

An derselben Stelle zwischen `core` und `content` steht nun:

```html
<script data-meridian-script="renderer" src="./renderer.js"></script>
```

Ersetzt man diesen Tag durch den alten Block, entsteht exakt `4b3b4f0:index.html`. `core.js`, `content.js`, `styles.css` und die vier Bilddateien sind ebenfalls bytegleich zur Referenz. Tests, Loader, Layout-Prüfsummen und Save-Fixture wurden nicht geändert.

Weiterhin synchrone klassische Skripte, kein `async`, `defer`, ES-Modul, Build oder Serverwechsel. `renderer.js` muss neben dem HTML mit ausgeliefert werden. Relative `Image.src`-Pfade werden weiterhin gegen das HTML-Dokument aufgelöst; insbesondere wurde `skybox.webp` nicht umadressiert oder eingebettet.

## Node-Prüfung

Vollständiger [Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit, ein Testworker: **59 bestanden, 0 fehlgeschlagen**. Das umfasst Syntaxprüfung aller klassischen Skripte, Terrain-/Kristallgeometrie, alle 16 unveränderten Layout-Prüfsummen und die Simulations-/Save-Referenzen. Keine Erwartungen neu erzeugt.

Lokale Dokumentationslinks/Anker und `git diff --check` wurden ebenfalls geprüft.

## Aktueller Browservergleich über `file://`

Unmittelbar vor und nach der Auslagerung wurde die erweiterte [Core-Browserprobe](core-extraction.md#aktuelle-chromium-prüfung-über-file) ausgeführt: Chromium `152.0.7977.75`, Linux, headless, jeweils separates temporäres Profil, Audio stumm, keine abgeschwächten Sicherheitsflags. Kein Zugriff auf echte Nutzerspielstände.

- **Einbindung:** `renderer.js` wird erfolgreich geladen. Reihenfolge `core → renderer → content → world → simulation → audio → ui → app` unverändert, ohne `async`/`defer`.
- **Layout:** Menü, Kampagnenansicht, Settings und unmittelbar pausierter Missionsstart bei 1280×800 und 800×700. Alle acht erfassten Stil-/Abmessungssätze identisch. Screenshots erzeugt; nachher Menü und HUD bei 1280×800 sowie HUD bei 800×700 zusätzlich gesichtet. Kein pixelweiser Vergleich der animierten Szene.
- **Shaderprogramme:** `LINK_STATUS` von Haupt-, Tiefen-, Skybox- und Postprocessing-Programm ist vor/nach der Änderung jeweils `true`; WebGL-Kontext nicht verloren.
- **Bild-Uploads:** In beiden Testläufen kehren drei `texImage2D`-Aufrufe mit eingebetteten 512×512-Bildern ohne JavaScript-Ausnahme zurück. Dafür delegiert ein ausschließlich in der Browserprobe eingesetzter Wrapper unverändert an die native Methode und protokolliert anschließend Bildgröße und Data-URL-Eigenschaft. Ausnahmen werden nicht abgefangen. Keine vollständige Pixel- oder WebGL-Fehlerzustandsprüfung jedes Uploads.
- **Grafikqualität:** Bei 800×700 die Qualitätswerte 0, 1 und 2 über die Renderer-API gesetzt und `resize()` aufgerufen. Frames laufen weiter, Ladebildschirm bleibt ausgeblendet. Vor/nach der Änderung gleiche Canvasgrößen 600×525 / 800×700 / 800×700 und 20 / 39 / 39 Draw Calls im pausierten Referenzszenario. Das ist kein Performancebenchmark oder Test der Settings-Bedienung.
- **Spiel/Storage:** Pause/Fortsetzen und Zoom mit eingespeisten Mausereignissen; Bewegung, Rekrutierung, Depotbau und Ressourcenlieferung über das vorhandene API-Szenario mit 1.000 festen Schritten geprüft. Speichern, vollständiges Neuladen, Wiederherstellung sowie tatsächlicher Backup-Download und Import über `#importFile` bestehen in beiden Läufen. Der genaue Ablauf und die Trennung von Eingabe- und API-Prüfungen stehen im verlinkten Core-Bericht.
- **Bekannte Ausnahme:** Dieselben drei Skybox-`SecurityError`-Ausnahmen pro Lauf, eine pro Seitenladung. Vergleich ohne durch die Auslagerung veränderte Quellpfade/Zeilennummern. Keine neuen erfassten Laufzeitausnahmen, Konsolenfehler oder fehlgeschlagenen Ressourcenabrufe. Die Skybox-Sperre bleibt ausdrücklich unbehoben.

Probe, Screenshots und Rohprotokolle waren temporäre Prüfartefakte unter `/tmp`, keine neue eingecheckte Testsuite oder Projektabhängigkeit. Temporäre Browserprofile und heruntergeladene Backups wurden entfernt.

**Nicht geprüft:** HTTP-Start, andere Browser, Audioausgabe, vollständige Maus-/Tastaturbedienung einschließlich Bauvorschau und nativer Dateidialoge, vollständige Kampagnenverläufe und Performance. Die vollständige Browser-Checkliste bleibt offen; exakte RNG-Fortsetzung nach Laden ist weiterhin nicht zugesichert.
