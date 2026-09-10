# Auslagerungsserie: Welt, Simulation, Audio, UI und Einstieg

Ausgangspunkt: `4eab547`. Ziel dieser Serie ist ausschließlich die Dateiaufteilung der fünf verbliebenen benannten Inline-Blöcke. Noch keine neuen Schnittstellen, Entkopplung, TypeScript, Build-Werkzeuge oder Änderung der Servervoraussetzungen.

## Abgeschlossene Schritte

Jede Tabellenzeile bezeichnet einen separat geprüften und committeten Schritt. Die Referenz ist jeweils der Stand unmittelbar vor der Auslagerung.

| Neue Datei | Referenz | Zeilen / Bytes | SHA-256 des übernommenen Skriptinhalts | Node / Browser |
| --- | --- | --- | --- | --- |
| `world.js` | `4eab547` | 1.293 / 45.460 | `7db75a630178d6a201517c2c4b8e45a4cfb956c7b9fd98d97f316da2359ada3c` | 59 bestanden / bestanden |
| `simulation.js` | `ba82437` | 1.934 / 73.726 | `9fe375033e16e5a014148d6dbfb80da552d3761aa38ca6157f61de192ab238ee` | 59 bestanden / bestanden |
| `audio.js` | `7bc55c6` | 169 / 6.889 | `9bb8b1b0fcba890263cb653c7646e05228a8bf62d3e99ca17edf561e339e5eca` | 59 bestanden / bestanden |

Noch ausstehend: `ui.js`, `app.js`.

## Vertrag und Inhaltsprüfung

- **Jeder komplette Skriptinhalt bleibt bytegleich**, einschließlich Kommentare, Einrückung, Strings und mehrzeiliger Templates. Die HTML-Einrückung wird bewusst nicht gleichzeitig bereinigt.
- Im HTML wird ausschließlich der jeweilige Inline-Block durch `<script data-meridian-script="NAME" src="./NAME.js"></script>` ersetzt. Reihenfolge bleibt `core → renderer → content → world → simulation → audio → ui → app`, synchron und klassisch, ohne `async`, `defer` oder Modul-Imports. Alle Dateien bleiben neben `index.html`.
- Je Schritt den neuen Dateiinhalt mit dem bisherigen Inline-Block verglichen und das vorherige HTML exakt rekonstruiert. Zusätzlich nach jedem Schritt alle bis dahin ausgelagerten Inhalte gegen `4eab547` verglichen und daraus dessen gesamtes HTML bytegleich rekonstruiert.
- Bereits vorhandene `core.js`, `renderer.js`, `content.js`, `styles.css`, die vier Bilddateien sowie Tests und Fixtures unverändert gegen `4eab547` geprüft. Keine neuen Layout-Prüfsummen, RNG-Erwartungen oder Save-Referenzen erzeugt.
- Die Zuständigkeitsgrenzen bleiben erhalten: `world` enthält auch `renderEntity`, `simulation` auch `formatTime`, `ui` auch Speicherung und Profilfunktionen, `app` auch Menüvorschau und Effektzeichnung. Breite Verantwortlichkeiten und globale lexikalische Bindungen werden nicht als bereits entkoppelte Module ausgegeben.

## Node- und Dokumentationsprüfung

Nach jedem Schritt den vollständigen [Testbefehl](testing.md#automatisierte-tests) unter Node.js `v23.11.1` / Linux ausgeführt, mit 128-MiB-Heaplimit und einem Testworker: jeweils **59 bestanden, 0 fehlgeschlagen**. Enthalten sind Syntaxprüfung aller Skripte, Geometrie, alle 16 festen Kampagnenlayout-Prüfsummen und die bisherigen Simulations-/Save-Referenzen. Tests und gemeinsamer Loader benötigen für diese reinen Verschiebungen keine Anpassung.

Lokale Dokumentationslinks und Anker sowie `git diff --check` vor jedem Commit geprüft.

## Frische Chromium-Prüfungen über `file://`

Ein neuer Ausgangslauf gegen `4eab547`, danach ein vollständiger Lauf nach jedem Schritt. Jede neue Ausgabe mit dem unmittelbar vorherigen Schritt **und** dem ursprünglichen Ausgangslauf verglichen. Chromium `152.0.7977.75`, Linux/headless, frisches temporäres Profil je Lauf, Audioausgabe stumm, keine abgeschwächten Sicherheitsflags. Keine echten Nutzerspielstände verwendet.

### Gemeinsamer Ablauf je bestandenem Lauf

- Erfolgreiches Laden **aller jeweils externen Skripte**, genaue `src`-Zuordnung und Dokumentreihenfolge geprüft. Ladebildschirm ausgeblendet und Anwendung verfügbar.
- Menü, Kampagnenansicht, Settings und unmittelbar pausierter Missionsstart bei 1280×800 und 800×700: acht Messsätze ausgewählter berechneter Stile und Abmessungen stimmen überein. Screenshots erzeugt; kein pixelweiser Vergleich animierter Szenen.
- Alle vier Shaderprogramme verlinkt, WebGL-Kontext nicht verloren, drei erfasste `texImage2D`-Bildaufrufe mit eingebetteten 512×512-Texturen ohne JavaScript-Ausnahme. Renderframes laufen bei allen drei Qualitätswerten weiter; Canvasgrößen und Draw-Call-Zahlen im pausierten Referenzszenario stimmen überein. Instrumentierung und Grenzen wie bei der [Renderer-Prüfung](renderer-extraction.md#aktueller-browservergleich-über-file).
- Erweiterter [Spiel-/Storage-Ablauf](core-extraction.md#aktuelle-chromium-prüfung-über-file): Pause/Fortsetzen und Zoom über Mausereignisse; Heldenbewegung, Rekrutierung, Depotbau und Lieferung von Alloy im API-Szenario mit 1.000 festen Simulations-/Effektschritten. Speichern, vollständiges Neuladen, Wiederherstellung, tatsächlicher Backup-Download und Import über `#importFile` bestanden. Der Checkpoint übersteht den Reload unverändert.

### Zusätzlicher Eingabe- und Audio-API-Ablauf

Nach dem Backup-Test jeweils eine neue erste Mission gestartet, damit dieser Test die gespeicherte API-Referenz nicht verändert:

- Heldenposition per Renderer-API auf Bildschirmkoordinaten abgebildet; anschließend **Mausereignisse auf dem Canvas** zum Auswählen und Rechtsklick-Bewegen. Auswahl und Auftrag geprüft.
- Kamera über gehaltene Pfeiltaste geschwenkt; Build-Tab über `B`, Depot-Button angeklickt, gültige Bildschirmposition per API gesucht. Maus dorthin bewegt, aktive Bauvorschau und laufende Darstellung geprüft und Screenshot erstellt; Bau durch Canvas-Klick bestätigt und neu angelegtes Depot geprüft.
- Rekrutierung über `N` und den Rifle-Button, Warteschlange geprüft. Pause über `Escape`, Speichern/Laden über `F5`/`F9`, Depot wieder vorhanden. Bei der Tastatur-Wiederherstellung werden höchstens 0,2 Sekunden möglicher Frame-Fortschritt vor der anschließenden Probe-Pause zugelassen; dies ist kein Nachweis identischer RNG-Fortsetzung.
- Audio nach eingespeistem Nutzerklick: `AudioContext.state === 'running'` und erfolgreiche Initialisierung geprüft. Sound-Button zweimal geklickt; Musik-/SFX-Einstellungen aus/an und die entsprechenden nativen `setTargetAtTime`-Aufrufe auf beiden Gain-Parametern geprüft (Zielwerte 0/1, Zeitkonstanten 0,15/0,05). Ein testseitiger Wrapper protokolliert und delegiert unverändert an die native Methode. **Kein Hörtest und keine Wellenformanalyse.**

Bei der Vorbereitung der zusätzlichen Probe scheiterte zunächst eine Annahme über den nach Wartezeit gelesenen `AudioParam.value` eines inaktiven Effektzweigs, bereits am unveränderten Ausgangsstand. Deshalb prüft die Probe die tatsächlich geplanten Gain-Aufrufe statt diesen ungeeigneten Messwert. Kein Spielcode wurde dafür geändert; erst danach bestand der vollständige Ausgangslauf.

### Fehlervergleich und Grenzen

In jedem bestandenen Lauf dieselben **drei bekannten Skybox-`SecurityError`-Ausnahmen**, eine pro Seitenladung. Verglichen wird die Fehlermeldung ohne durch Dateiauslagerung geänderte Stack-Pfade/Zeilennummern. Keine neuen erfassten Laufzeitausnahmen, Konsolenfehler oder fehlgeschlagenen Ressourcenabrufe. Die Skybox-Sperre bleibt ausdrücklich unbehoben.

Probe und Rohartefakte liegen temporär unter `/tmp` (`meridian-split-browser.cjs`, Phasen `split-baseline` und `split-NAME`). Sie sind keine eingecheckte Browser-Testsuite oder neue Projektabhängigkeit. Browserprofile und heruntergeladene Backups nach jedem Lauf entfernt.

**Weiterhin nicht geprüft:** HTTP, andere Browser, hörbare Audioausgabe, native Dateidialoge, umfassende Bedienung einschließlich Touch/Box-Auswahl und aller Einstellungen, verweigerter Storage, vollständige Kampagnen- oder Performanceprüfung. Die zusätzliche Eingabeprobe erweitert den Smoke-Test, erledigt aber nicht pauschal die gesamte Browser-Checkliste.
