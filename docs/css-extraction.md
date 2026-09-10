# CSS-Auslagerung ohne Darstellungsänderung

## Änderung

Referenz vor der Auslagerung: Commit `ca2c04b`.

Die 2.276 Zeilen zwischen den bisherigen `<style>`-Tagzeilen wurden bytegleich nach `styles.css` verschoben, einschließlich Einrückung und Regelreihenfolge. An derselben Stelle im `<head>` steht jetzt:

```html
<link rel="stylesheet" href="./styles.css">
```

Keine Bereinigung, Umformatierung, Selektorumbenennung oder Aufteilung in weitere Stylesheets. Inline-Styles im HTML und in JS-Templates bleiben bestehen. Sämtliche JavaScript-Blöcke, sonstiges HTML und Assets sind unverändert. Es gibt weiterhin keinen Build und keine Paketabhängigkeiten; `styles.css` muss beim Weitergeben neben `index.html` bleiben.

## Inhalts- und Modellprüfungen

- Der Inhalt von `styles.css` stimmt byteweise mit den CSS-Zeilen aus `ca2c04b:index.html` überein.
- Ersetzt man den neuen Link durch die alten Tagzeilen samt ausgelagertem CSS, entsteht bytegleich das vorherige HTML. Damit sind auch Skriptinhalte und Inline-Styles unverändert.
- Die vier Assets wurden byteweise mit der Referenz verglichen und sind unverändert.
- Der vollständige [Node-Testbefehl](testing.md#automatisierte-tests) unter Node.js `v23.11.1` / Linux: **44 bestanden, 0 fehlgeschlagen**, einschließlich der unveränderten 16 Layout-Prüfsummen.
- Lokale Dokumentationslinks/Anker sowie `git diff --check` geprüft.

## Browservergleich über `file://`

Umgebung: Chromium `152.0.7977.75` auf Linux (Debian-Paket), headless, Device Scale Factor 1, unveränderte Standard-Grafikeinstellung „High“. Vor und nach der Auslagerung wurde dieselbe `index.html` über ihre lokale Datei-URL geladen, jeweils in einem separaten temporären Browserprofil ohne echte Spielstände.

Chromium-Startoptionen: `--headless --remote-debugging-port=0 --user-data-dir=<temporäres Profil> --no-first-run --no-default-browser-check --mute-audio`. Keine deaktivierte Sandbox, keine freigegebenen Datei-Ursprünge und keine abgeschwächten Web-Sicherheitsregeln. Steuerung erfolgte mit einem temporären Node-Skript über das Chrome DevTools Protocol, ohne neue Projektabhängigkeit.

Geprüft bei **1280×800** und **800×700**:

1. Hauptmenü.
2. Kampagnenansicht für Mission 0.
3. Settings-Dialog.
4. Mission 0 auf Standard mit Seed 1409 und Fraktion 0, unmittelbar nach dem Start pausiert.

Die Ansichten wurden über die vorhandenen `Meridian.ui`-Methoden geöffnet, die Mission über `Meridian.game.start()` gestartet. Das ist ein Darstellungs-/Integrationscheck, kein Nachweis für tatsächliche Maus- oder Tastaturbedienung. Vor jedem Seitenladen wurde nur der Storage des temporären Profils geleert.

Ergebnis:

- `window.Meridian` und ein WebGL-Kontext sind vorhanden; der Ladebildschirm ist in allen acht geprüften Ansichten ausgeblendet.
- `document.styleSheets` enthält nach der Änderung die lokale `styles.css`-URL.
- Für Menücontainer, Überschriften, Menübuttons, Kampagnenlayout, HUD/HUD-Buttons und Modal/Modal-Buttons wurden berechnete Stile und Bounding-Rects erfasst. Je Ansicht waren das 21, 37, 41 beziehungsweise 54 Elemente. Die erfassten Werte stimmen vor und nach der Auslagerung exakt überein.
- Verglichene CSS-Eigenschaften: `display`, `position`, `width`, `height`, `padding`, `margin`, `font`, `color`, `background`, `border`, `grid-template-columns`, `gap`, `overflow`, `visibility`.
- Screenshots aller acht Ansichten wurden vor und nach der Änderung erstellt. Nachher wurden Hauptmenü und HUD bei 1280×800 sowie Settings und HUD bei 800×700 zusätzlich gesichtet. Kein pixelweiser Screenshotvergleich: Die animierte 3D-Menüvorschau läuft weiter.
- Protokollierte Laufzeitausnahmen, Konsolenfehler und fehlgeschlagene Ressourcenabrufe wurden verglichen. Keine neuen erfassten Fehler durch die Auslagerung; die unten beschriebene Skybox-Ausnahme bleibt bestehen.

Browserprobe, Screenshots und Rohprotokolle waren temporäre Prüfartefakte unter `/tmp/`, keine eingecheckte Browser-Testsuite.

## Bestehende Einschränkung: Skybox

**Bereits vor der CSS-Auslagerung** trat bei jedem Dateistart in diesem Chromium folgender Fehler in `img.onload` auf:

```text
SecurityError: Failed to execute 'texImage2D' on 'WebGL2RenderingContext':
The image element contains cross-origin data, and may not be loaded.
```

Die externe Skybox kann dabei nicht als WebGL-Textur hochgeladen werden; der dunkle Ersatzhimmel bleibt bestehen. Menü und Spielfeld werden trotzdem dargestellt. Nach der Auslagerung trat derselbe Fehler auf, ohne weitere erfasste Laufzeit-/Ladefehler. Das zuvor dokumentierte `file://`-Risiko ist damit für diese Umgebung bestätigt, nicht für alle Browser pauschal nachgewiesen. Keine beiläufige Renderer-Korrektur in diesem CSS-Commit.

## Nicht geprüft

HTTP-Start, andere Browser, Audioausgabe, interaktive Befehle/Bauvorschau/Produktion im Browser, vollständiger Pause-/Resume-Ablauf, dauerhaftes Save/Load, Backup-Import/Export, Performance und vollständiger Kampagnenlauf. Die [vollständige Browser-Checkliste](testing.md#manuelle-browser-prüfung) bleibt offen; der frühere positive Nutzer-Smoke-Test bezog sich auf den Stand vor dieser Auslagerung.
