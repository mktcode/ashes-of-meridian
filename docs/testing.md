# Prüfungen

## Automatisierte Tests

Aus dem Projektverzeichnis mit Node.js ausführen; weder npm-Pakete noch Browser oder Build sind erforderlich:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs tests/ashes-of-meridian-harness.check.cjs tests/ashes-of-meridian-simulation.check.cjs tests/ashes-of-meridian-core.check.cjs
```

Die expliziten Dateinamen funktionieren ohne Bash-Brace-Expansion. Das Heaplimit gilt für den JavaScript-Heap, nicht als Obergrenze für den gesamten Prozessspeicher. Die Testdateien werden nacheinander ausgeführt.

### Tatsächliche Abdeckung

| Testdatei | Prüfungen |
| --- | --- |
| `tests/ashes-of-meridian-core.check.cjs` | 9 Tests: isoliertes Laden von `core.js`; feste RNG-Folgen, Seed-Konvertierung und unabhängige Generatoren; Vektorrechnung; Matrizenidentität, homogene Koordinaten, Multiplikationsreihenfolge, Projektion, Kamera und Inversion einschließlich bestehender Sonderfälle |
| `tests/ashes-of-meridian-terrain.check.cjs` | 19 Tests: Syntax aller benannten klassischen Skripte (Inline und lokal); deterministische, endliche und begrenzte Felsgeometrie samt Normalen und Dreiecksbudget; Layout-Prüfsummen aller 16 Kampagnenkarten und variierte Felsdarstellung; reproduzierbare Renderplatzierungen eines Gefechts-Seeds |
| `tests/ashes-of-meridian-crystals.check.cjs` | 5 Tests: Kristallgeometrie mit 36 Dreiecken und Einheitsnormalen; 80 zeitstabile Vorkommensmodelle; Größenänderung beim Abbau ohne Mutation der Entität; Vorschauparameter; bestehende Aether-Formen und Animation |
| `tests/ashes-of-meridian-harness.check.cjs` | 10 Tests: explizite Skriptauswahl und Dokumentreihenfolge bei Inline-/Dateimischung; fehlende/doppelte Namen und unerwartete Verpackung; lokale Pfade und fehlende Dateien; Ablehnung von URL-/Traversal-/Symlink-Ausbrüchen und mehrdeutigen Attributen; VM-Isolation; benannte Fehlerquellen; Renderer-Stub |
| `tests/ashes-of-meridian-simulation.check.cjs` | 15 Tests: fester Missionsstart, Seed-Reproduzierbarkeit, Befehle/Rally, Produktionskosten und Erstattung aller drei Fraktionen, abgelehnte Rekrutierung, Fertigstellung und Einkommen/Alloy-Lieferungen, Fünf-Sekunden-Referenzzustand, Snapshot-Isolation, Wiederherstellung und Weiterlaufen eines Version-1-Fixtures, zwei ungültige Save-Fälle |

`tests/helpers/game-scripts.cjs` liest benannte klassische Skripte aus `index.html` und lokale `src`-Dateien relativ zum Quellverzeichnis, unabhängig vom Arbeitsverzeichnis des Testprozesses. Die Core-Tests laden nur `core`, die Modelltests zusätzlich `renderer`, `content` und `world`, die Simulationstests außerdem `simulation`. Abhängigkeiten werden explizit ausgewählt, aber wie im Browser in Dokumentreihenfolge ausgeführt. Alle gefundenen Skripte werden auf Syntax geprüft, ohne ihre Anzahl festzuschreiben. Fehlende oder doppelte Namen werden nicht stillschweigend übergangen. Module, `async`/`defer` und nicht unterstützte Pfad-/Attributformen werden bewusst abgelehnt; Details: [Core-Auslagerung](core-extraction.md).

Der gemeinsame Renderer-Stub unter `tests/helpers/renderer-stub.cjs` ersetzt GPU-Zugriffe; nur Modelltests zeichnen Renderplatzierungen auf. Simulationstests erhalten frische VM-Kontexte mit `structuredClone`, aber ohne DOM/Storage/Audio und mit absichtlich fehlschlagendem `Math.random()`. Die fest gesetzten Seeds müssen genügen. Es wird kein WebGL-Kontext erstellt.

Die Layout-Prüfsummen erfassen `staticGrid`, `terrainColors` und `rocks`. Sie sind eine feste Referenz aus der Zeit vor der visuellen Terrainänderung. Bei einem reinen Refactoring müssen sie unverändert bestehen bleiben; bei Abweichungen zuerst die Ursache untersuchen, nicht neue Sollwerte übernehmen.

### Nicht abgedeckt

- Tatsächliches Shader-Kompilieren, Texturladen, GPU-Ausgabe und Performance.
- Browserstart über `file://` oder HTTP, DOM, Eingabe, Audio und responsive Darstellung.
- Vollständige Missionsverläufe, weitere Wegfindungsfälle, Bau-/Kampfregeln, Forschung und Sieg/Niederlage. Produktions-/Wirtschaftstests erfassen nur ausgewählte kurze Szenarien.
- Storage-Verhalten, UI-Backup-Import/Export, breite Save-Kompatibilität und identische Fortsetzung nach Laden. Das Fixture deckt nur eine Kampagnenoperation mit Formatversion 1 ab, keinen vollständigen Backup-Container.

Der Kristall-Abbautest prüft die **Darstellung bei vorgegebenen Mengen**; tatsächlich angeliefertes Alloy wird separat im kurzen Simulationstest erfasst. Die UI und der Anwendungseinstieg werden nicht ausgeführt. Ein grüner Syntaxcheck kompiliert keine GLSL-Shader.

## Manuelle Browser-Prüfung

Diese Liste ist eine Prüfanleitung, kein Nachweis bereits bestandener Prüfungen. Ein separates Browserprofil ohne wichtige Spielstände verwenden; vor Importtests vorhandene Daten exportieren. Keine Tests durchführen, die ungesicherte echte Spielstände überschreiben.

Den kurzen Ablauf sowohl mit direkt geöffneter `index.html` (`file://`) als auch über den optionalen lokalen HTTP-Server aus der [README](../README.md#spielen) prüfen. Ergebnisse für beide Startarten getrennt erfassen. Browser-/Versionsnummer, Betriebssystem, Fenstergröße und Grafikqualität notieren; beim Dateistart sind Browser-Sicherheitsregeln ausdrücklich Teil der Prüfung. Keine Sicherheitsbeschränkungen per Browserflag abschalten.

- [ ] Menü erscheint; Ladebildschirm verschwindet; Himmel und Bodentexturen sind sichtbar. Konsole auf Ladefehler, SecurityErrors und WebGL-Ausnahmen prüfen; ein dunkler Ersatzhimmel ist kein Nachweis erfolgreichen Skybox-Ladens.
- [ ] Erste Kampagnenmission auf Standard starten. HUD, Terrain, Kristalle und Einheiten plausibel; keine JavaScript-Ausnahme.
- [ ] Einheit auswählen, bewegen, Kamera schwenken/zoomen und Pause/Fortsetzen auslösen. Während der Pause steht die Simulationszeit still.
- [ ] Bauvorschau anzeigen und ein Gebäude an gültiger Position errichten. Eine Einheit rekrutieren; Kosten, Warteschlange und Fertigstellung beobachten. Arbeiter liefern Alloy ab.
- [ ] Audio nach Nutzerinteraktion sowie Ton aus/an prüfen. Menü und HUD bei normaler Desktopgröße und schmalerem Fenster auf abgeschnittene Bedienelemente prüfen.
- [ ] Checkpoint speichern (`F5`), neu laden und Operation fortsetzen. Ressourcen, Gebäude, Aufträge und erkundete Karte auf offensichtlichen Verlust prüfen; ein exakt identischer weiterer Zufallsverlauf wird derzeit nicht zugesichert.
- [ ] Über **Settings → Export Backup** sichern, in ein frisches Testprofil importieren und den Checkpoint laden. Fortschritt und Operation vorhanden; Konsole ohne Import-/Restore-Ausnahme.
- [ ] Beim Wechsel zwischen `file://` und HTTP nicht denselben Browserspeicher erwarten. Verweigerte Speicherung und erforderlichen Backup-Transfer im Ergebnis vermerken.

Für reine Dokumentationsänderungen ist kein neuer Browserlauf erforderlich. Bei Änderungen an Spielcode, Assets oder Verpackung die relevanten Punkte ausführen; bei strukturellem Umbau mindestens den gesamten kurzen Ablauf. Ein solcher Smoke-Test ersetzt keinen vollständigen Kampagnen-/E2E-Test.

## Aktueller Prüfstand: Core-Auslagerung

- `core.js` enthält `M4`, `V` und `seeded` unverändert bis auf entfernte HTML-Einrückung; klassisches synchrones Skript vor `renderer`. Kein Build oder Serverwechsel.
- Testloader für lokale klassische Skripte erweitert; **58 Tests bestanden, 0 fehlgeschlagen** unter Node.js `v23.11.1` / Linux. Feste RNG-/Layout-/Save-Referenzen unverändert.
- Chromium `152.0.7977.75`, Linux, temporäres Profil, `file://`, keine abgeschwächten Sicherheitsflags: Laden von `core.js`, acht Layoutansichten und erweiterter Spiel-/Save-/Backup-Smoke-Test geprüft. Nur die bestehende Skybox-Ausnahme erfasst.
- Eingabeprüfungen und API-gesteuerte Szenarien sowie offene Bereiche werden im [Prüfbericht](core-extraction.md) getrennt ausgewiesen. Die vollständige Browser-Checkliste ist dadurch nicht pauschal erledigt.

## Vorheriger Prüfstand: Mathematik-/RNG-Referenzen

- Acht neue Core-Tests gegen die unveränderte Implementierung aus `e0734ec`, noch vor einer Auslagerung. Insgesamt **52 Tests bestanden, 0 fehlgeschlagen** unter Node.js `v23.11.1` / Linux.
- Herkunft der festen Zufallsfolgen und geprüfte Grenzen: [Core-Referenzen](core-extraction.md).
- Keine Spielcode-/Verpackungsänderung in diesem Testschritt; kein zusätzlicher Browserlauf.

## Vorheriger Prüfstand: JavaScript-Formatierung

- Alle sieben Inline-Skripte wurden separat formatiert, ohne Auslagerung oder absichtliche Verhaltensänderung.
- Normalisierte Babel-Syntaxbäume vor/nach der Formatierung sind identisch. Die 246 erfassten Template-Segmente und eingebetteten Bildliterale sind zusätzlich im Rohtext unverändert. Sonstiges HTML, CSS, Assets, Tests und Fixtures wurden nicht verändert.
- **44 Tests bestanden, 0 fehlgeschlagen** unter Node.js `v23.11.1` / Linux; bestehende Layout-Prüfsummen und Save-Referenz bleiben unverändert.
- Chromium-`file://`-Vergleich vor/nach der Formatierung wiederholt: acht Ansichten bei zwei Fenstergrößen, gleiche erfasste Stile/Abmessungen und keine neuen erfassten Fehler. Die bekannte Skybox-Ausnahme bleibt bestehen.
- Der Nutzer berichtet zusätzlich, dass Firefox die Skybox ebenfalls blockiert; Version und Prüfumgebung wurden nicht angegeben. Eine Korrektur wurde ausdrücklich zurückgestellt.
- Werkzeugversionen, Vorgehen und Grenzen: [JavaScript-Formatierung](javascript-formatting.md). Kein vollständiger interaktiver Browser-/Kampagnentest.

## Vorheriger Prüfstand: CSS-Auslagerung

- Die 2.276 CSS-Zeilen liegen unverändert in `styles.css`; `index.html` bindet die Datei über einen relativen Stylesheet-Link ein. Skripte, Inline-Styles und Assets sind unverändert.
- **44 Tests bestanden, 0 fehlgeschlagen** unter Node.js `v23.11.1` / Linux. Der Bytevergleich mit `ca2c04b` bestätigt die reine Auslagerung.
- Chromium `152.0.7977.75`, Linux, headless, separates Testprofil, `file://`, ohne abschwächende Sicherheitsflags: Stylesheet geladen, Menü/Kampagnenansicht/Settings/pausierter Missionsstart bei 1280×800 und 800×700 geprüft. Ausgewählte berechnete Stile und Elementabmessungen stimmen vor und nach der Auslagerung überein.
- **Bestehende Einschränkung bestätigt:** Skybox-Upload wird in diesem Chromium-Test unter `file://` mit einem `SecurityError` blockiert, bereits vor der Auslagerung. Keine neuen erfassten Laufzeit-/Ladefehler nach der CSS-Änderung.
- Ablauf, genaue Grenzen und offene Browserprüfungen: [CSS-Auslagerung](css-extraction.md). Die vollständige Checkliste oben bleibt offen.

## Vorheriger Prüfstand: Testzugriff und Referenztests

- Obiger Befehl unter Node.js `v23.11.1` / Linux: **44 Tests bestanden, 0 fehlgeschlagen**.
- Die ursprünglichen 24 Modell-/Terrainprüfungen bestehen weiterhin, insbesondere alle 16 unveränderten Layout-Prüfsummen.
- Im HTML wurden ausschließlich sieben `data-meridian-script`-Attribute ergänzt; Skriptinhalte, CSS, sonstiges HTML und Assets wurden mit dem Ausgangsstand verglichen und sind unverändert.
- Herkunft des festen Fixtures und weitere Prüfergebnisse: [Referenztests](reference-tests.md).
- Bei der Testerweiterung kein Browserlauf durch den Assistenten: Die Attribute ändern weder Script-Typ, Reihenfolge noch Inhalt.

### Nachträglicher Nutzerbericht zum Dateistart

Nach Commit `a4421dd` hat der Nutzer das Spiel kurz direkt über `file://` im Browser angetestet und berichtet: „Scheint in Ordnung zu sein.“ Das ist ein positiver, vom Nutzer gemeldeter Smoke-Test, keine durch den Assistenten ausgeführte Prüfung.

Browser/Version, Betriebssystem und einzelne geprüfte Funktionen wurden nicht angegeben. Die vollständige Browser-Checkliste bleibt daher offen; insbesondere sind Skybox-Upload, dauerhafte Speicherung, Backup-Transfer und HTTP-Start damit nicht gezielt bestätigt.

## Historischer Prüfstand: Dokumentationsbereinigung

- Referenz: formatierter Ausgangscommit `ab92a12`.
- Umgebung: Node.js `v23.11.1` unter Linux; das ist die tatsächlich geprüfte Version, keine ermittelte Mindestversion.
- Damaligen Terrain-/Kristalltestbefehl ausgeführt: **24 Tests bestanden, 0 fehlgeschlagen**.
- `index.html`, die vier Bilddateien und beide Testdateien wurden byteweise mit `HEAD` verglichen: unverändert.
- Lokale Markdown-Links samt Abschnittsankern in README, AGENTS und den drei Dokumenten unter `docs/` geprüft; `git diff --check` ohne Beanstandung.
- **Nicht ausgeführt:** Browser-Sichtprüfung, `file://`-/HTTP-Kompatibilitätsprüfung und vollständiger Spiel-/E2E-Lauf. Ein Build existiert derzeit nicht.
- Die früheren Chromium- und Modellprüfungen im [historischen Bericht](bisheriger-pruefstand.md) wurden für diesen Stand nicht wiederholt und sind kein aktueller Browsernachweis.

Künftige Prüfnotizen unter `docs/` ablegen und mit Commit/Änderungsumfang, Umgebung, Befehl beziehungsweise Ablauf, Ergebnis und nicht geprüften Bereichen versehen. Historische Ergebnisse nicht stillschweigend als aktuelle übernehmen.

## Nächste Erweiterung des Sicherheitsnetzes

Vor Änderungen an weiteren Bereichen passende Szenarien ergänzen, nicht aus den vorhandenen Prüfungen eine umfassende Spielabdeckung ableiten. Vor einer neuen Verpackung steht insbesondere die systematische Browserprüfung aus. Weitere Schritte und die bekannten RNG-Grenzen stehen in der [Architektur](architecture.md#nächste-schritte-und-späteres-zielbild).
