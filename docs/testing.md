# Prüfungen

## Automatisierte Tests

Aus dem Projektverzeichnis mit Node.js ausführen; weder npm-Pakete noch Browser oder Build sind erforderlich:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs tests/ashes-of-meridian-harness.check.cjs tests/ashes-of-meridian-simulation.check.cjs tests/ashes-of-meridian-core.check.cjs tests/ashes-of-meridian-persistence.check.cjs tests/ashes-of-meridian-presentation.check.cjs tests/ashes-of-meridian-controls.check.cjs tests/ashes-of-meridian-renderer.check.cjs
```

Die expliziten Dateinamen funktionieren ohne Bash-Brace-Expansion. Das Heaplimit gilt für den JavaScript-Heap, nicht als Obergrenze für den gesamten Prozessspeicher. Die Testdateien werden nacheinander ausgeführt.

### Tatsächliche Abdeckung

| Testdatei | Prüfungen |
| --- | --- |
| `tests/ashes-of-meridian-core.check.cjs` | 9 Tests: isoliertes Laden von `core.js`; feste RNG-Folgen, Seed-Konvertierung und unabhängige Generatoren; Vektorrechnung; Matrizenidentität, homogene Koordinaten, Multiplikationsreihenfolge, Projektion, Kamera und Inversion einschließlich bestehender Sonderfälle |
| `tests/ashes-of-meridian-terrain.check.cjs` | 20 Tests: bytegleiche Skybox-Einbettung und Quellverdrahtung; Syntax aller benannten klassischen Skripte (Inline und lokal); deterministische, endliche und begrenzte Felsgeometrie samt Normalen und Dreiecksbudget; Layout-Prüfsummen aller 16 Kampagnenkarten und variierte Felsdarstellung; reproduzierbare Renderplatzierungen eines Gefechts-Seeds |
| `tests/ashes-of-meridian-crystals.check.cjs` | 5 Tests: Kristallgeometrie mit 36 Dreiecken und Einheitsnormalen; 80 zeitstabile Vorkommensmodelle; Größenänderung beim Abbau ohne Mutation der Entität; Vorschauparameter; bestehende Aether-Formen und Animation |
| `tests/ashes-of-meridian-harness.check.cjs` | 11 Tests: isoliertes Laden von `content` samt Katalog-/Kampagnenreihenfolge und Namens-/Icon-Hilfsfunktionen; explizite Skriptauswahl und Dokumentreihenfolge bei Inline-/Dateimischung; fehlende/doppelte Namen und unerwartete Verpackung; lokale Pfade und fehlende Dateien; Ablehnung von URL-/Traversal-/Symlink-Ausbrüchen und mehrdeutigen Attributen; VM-Isolation; benannte Fehlerquellen; Renderer-Stub |
| `tests/ashes-of-meridian-renderer.check.cjs` | 7 Tests mit WebGL-API-Testdouble: gemeinsame Samplezahlen/4×-Obergrenze, Auflösung, unvollständige/null-Allokationen, Ressourcenfreigabe bei Resize/Qualitätswechsel, Resolve-Reihenfolge einschließlich Effekten und Single-Sample-Rückfall; kein echter GPU-Nachweis |
| `tests/ashes-of-meridian-controls.check.cjs` | 7 Tests: dynamische Startscreen-Aktionen/Checkpoints/Fortschrittsanzeige; WASD-Richtungen, Wiederholung/Freigabe des gehaltenen Zustands, wirkungslose Pfeiltasten, festes F unabhängig vom Altprofil, Modifier-/Fokus-/Pause-Verhalten, übrige Hotkeys und sichtbare Steuerungshinweise; UI-Methoden mit Testdoubles, keine nativen Tastaturereignisse |
| `tests/ashes-of-meridian-presentation.check.cjs` | 27 Tests: 16 feste Terrain-/Platzierungs-/Navigationsreferenzen, sechs Effekt-/Snapshot-/Folge-RNG-Szenarien, rendererfreie Simulation, Adapterinvalidierung, isolierte synchrone Effekte, RNG nach Reset/Restore und Effekt-Zeichenreferenz mit eingefrorenen Eingabedaten |
| `tests/ashes-of-meridian-simulation.check.cjs` | 15 Tests: fester Missionsstart, Seed-Reproduzierbarkeit, Befehle/Rally, Produktionskosten und Erstattung aller drei Fraktionen, abgelehnte Rekrutierung, Fertigstellung und Einkommen/Alloy-Lieferungen, Fünf-Sekunden-Referenzzustand, Snapshot-Isolation, Wiederherstellung und Weiterlaufen eines Version-1-Fixtures, zwei ungültige Save-Fälle |

Zusätzlich: `tests/ashes-of-meridian-persistence.check.cjs` mit 18 Tests: 13 Charakterisierungen für Profil-Normalisierung, Checkpoints, Storage-Ausfälle und UI-Backup-Abläufe sowie vier Schnittstellen-/Isolationstests und ein Kompatibilitätstest für den entfernten WASD-Schalter. Die betroffenen UI-Methoden werden ohne Konstruktor mit gezielten Testdoubles ausgeführt, nicht mit einem Browser-DOM. [Details](persistence-decoupling.md).

`tests/helpers/game-scripts.cjs` liest benannte klassische Skripte aus `index.html` und lokale `src`-Dateien relativ zum Quellverzeichnis, unabhängig vom Arbeitsverzeichnis des Testprozesses. Die Speicherkomponente wird zusätzlich isoliert nur mit ausdrücklich übergebenen Regeln und Storage getestet; die UI-Schnittstelle separat mit einem Fake-Dienst. Die Core-Tests laden nur `core`, ein Harness-Test nur `content`, die Modelltests zusätzlich `world-view`. Die bisherigen Simulationsprüfungen verdrahten den Welt-Adapter beim Start wie die Anwendung; ein weiterer Test startet, simuliert und lädt ausschließlich mit `core`, `content`, `world`, `effects` und `simulation`, ohne Renderer oder dessen Stub. Abhängigkeiten werden explizit ausgewählt, aber wie im Browser in Dokumentreihenfolge ausgeführt. Alle gefundenen Skripte werden auf Syntax geprüft, ohne ihre Anzahl festzuschreiben. Fehlende oder doppelte Namen werden nicht stillschweigend übergangen. Module, `async`/`defer` und nicht unterstützte Pfad-/Attributformen werden bewusst abgelehnt; Details: [Core-Auslagerung](core-extraction.md).

Der gemeinsame Renderer-Stub unter `tests/helpers/renderer-stub.cjs` ersetzt GPU-Zugriffe; nur Modelltests zeichnen Renderplatzierungen auf. Simulationstests erhalten frische VM-Kontexte mit `structuredClone`, aber ohne DOM/Storage/Audio und mit absichtlich fehlschlagendem `Math.random()`. Die fest gesetzten Seeds müssen genügen. Es wird kein WebGL-Kontext erstellt.

Die Layout-Prüfsummen erfassen `staticGrid`, `terrainColors` und `rocks`. Sie sind eine feste Referenz aus der Zeit vor der visuellen Terrainänderung. Bei einem reinen Refactoring müssen sie unverändert bestehen bleiben; bei Abweichungen zuerst die Ursache untersuchen, nicht neue Sollwerte übernehmen.

### Nicht abgedeckt

- Tatsächliches Shader-Kompilieren, Texturladen, GPU-Ausgabe und Performance.
- Browserstart über `file://` oder HTTP, DOM, Eingabe, Audio und responsive Darstellung.
- Vollständige Missionsverläufe, weitere Wegfindungsfälle, Bau-/Kampfregeln, Forschung und Sieg/Niederlage. Produktions-/Wirtschaftstests erfassen nur ausgewählte kurze Szenarien.
- Echtes Browser-Storage und Datei-/Download-Dialoge, breite Save-Kompatibilität und identische Fortsetzung nach Laden. Das Fixture deckt nur eine Kampagnenoperation mit Formatversion 1 ab, keinen vollständigen Backup-Container.

Der Kristall-Abbautest prüft die **Darstellung bei vorgegebenen Mengen**; tatsächlich angeliefertes Alloy wird separat im kurzen Simulationstest erfasst. Nur ausgewählte Speicher-/Backup-Methoden der UI werden mit Testdoubles ausgeführt; UI-Konstruktion und Anwendungseinstieg bleiben außerhalb der Node-Tests. Ein grüner Syntaxcheck kompiliert keine GLSL-Shader.

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

## Aktueller Prüfstand: Szenen-MSAA

- High/Balanced rendern die Szene mit bis zu 4× MSAA und lösen vor dem bestehenden Postprocessing in die Szenentextur auf. Performance bleibt ohne MSAA; unterstützte kleinere Samplezahlen bzw. der bisherige Single-Sample-Pfad dienen als Rückfall.
- **119 Tests bestanden**, vollständiger obiger Befehl, Node.js `v23.11.1` / Linux. Keine veränderten Layout-/Simulations-/Effekt-Fixtures.
- Chromium `152.0.7977.75`, `file://`: tatsächlich 4 Samples für Farb-/Tiefenbuffer, ausgeführte Resolves, alle Qualitätsstufen und Resize sowie injizierte Fallback-Fälle geprüft. Keine erfassten Fehler. Weißes Testdreieck liefert nur mit MSAA Zwischenwerte an Kanten; gleiche eingefrorene Spielszene mit/ohne MSAA visuell verglichen.
- Erweiterter Spiel-/WASD-/Bau-/Save-/Reload-/Backup-Ablauf bestanden. Details und offene Hardware-/Browser-/Performanceprüfungen: [MSAA](msaa.md).

## Vorheriger Prüfstand: Startscreen-Redesign

- Nur Home-Template und Home-Styles nach Nutzervorlage überarbeitet. Bestehende Navigation, Fortschrittsanzeige und Checkpoint-Priorität bleiben erhalten; Renderer, Bilddaten und Spielregeln unverändert.
- **112 Tests bestanden**, vollständiger obiger Befehl. Chromium-152-`file://`-Probe mit erweitertem Spiel-/Save-/Backup-Ablauf ohne erfasste Fehler.
- Acht zusätzliche Startscreen-Fälle (320–1774 Pixel breit, mit/ohne Checkpoint und Fortschritt): kein horizontaler Überlauf, alle Buttons erreichbar, bei sehr geringer Höhe scrollbar. Sechs Nicht-Home-Layout-/Style-Messsätze unverändert zum vorherigen Stand. Alle sechs Menüziele per Klick sowie Tab/Fokus/Enter geprüft.
- Details und Grenzen: [Startscreen-Redesign](home-redesign.md).

## Vorheriger Prüfstand: neues Skybox-Bild

- Nutzer-PNG verlustfrei nach `skybox.webp` konvertiert und Einbettung aktualisiert; 1774×887 Pixel, keine abweichenden Pixel im ImageMagick-Vergleich.
- **111 Tests bestanden** mit dem vollständigen obigen Befehl. Frische Chromium-152-`file://`-Probe einschließlich GPU-Pixelvergleich und erweitertem Spiel-/Eingabe-/Save-/Backup-Ablauf bestanden; keine erfassten Fehler. Neues Motiv im Menü-Screenshot visuell geprüft.
- Nur Bilddaten geändert, keine Renderer-Logik oder Testreferenzen. Firefox, HTTP und umfassende Performanceprüfung weiterhin offen. Details: [Skybox-Bildaustausch](skybox-replacement.md).

## Vorheriger Prüfstand: Skybox über `file://`

- Skybox als Data-URL in `renderer.js`, unveränderte WebP-Bytes und Originaldatei. Keine Serverpflicht oder Sicherheitsflags.
- **111 Tests bestanden**, vollständiger obiger Befehl, Node.js `v23.11.1` / Linux. Keine geänderten Layout-/Simulations-/Effektreferenzen.
- Chromium `152.0.7977.75`, `file://`: vier erfolgreiche Bild-Uploads, Skybox mit 1774×887 Pixeln; drei GPU-Pixel stimmen exakt mit dem dekodierten Bild überein, Framebuffer vollständig und `gl.getError()` ohne Fehler. Himmel im Menü-Screenshot sichtbar; kein externer Skybox-Request und keine erfassten Laufzeit-/Konsolen-/Ladefehler mehr.
- Erweiterter WASD-/Spiel-/Save-/Reload-/Backup-Ablauf bestanden. Andere Browser und die vollständige Browser-Checkliste bleiben offen. Details: [Skybox-Einbettung](skybox-embedding.md).

## Vorheriger Prüfstand: feste WASD-Steuerung

- Tastaturkamera ausschließlich WASD, Attack-Move fest F; Option entfernt, Altprofile/-backups weiterhin Version 1. Hilfe, HUD und Tutorial angepasst.
- **110 Tests bestanden**, vollständiger obiger Befehl, Node.js `v23.11.1` / Linux. Spiel-/Layout-/Effektreferenzen unverändert; absichtlich geändertes Standardprofil ohne `wasd`.
- Chromium-`file://`-Probe bestanden: tatsächliche Tastaturereignisse für alle vier WASD-Richtungen und Loslassen, wirkungslose Pfeiltasten, Ctrl+A ohne Kameraschwenk, F/Escape, Field Manual und übriger erweiterter Spiel-/Save-/Backup-Ablauf. Start mit Altprofil `wasd:false`; keine Umschaltoption mehr. Nur bekannte Skybox-Ausnahmen.
- Details und Grenzen: [WASD-Steuerung](wasd-controls.md).

## Vorheriger Prüfstand: Welt- und Effektgrenzen abgeschlossen

- CPU-Welt, GPU-Adapter, kosmetische Effektkomponente und reines Effektzeichnen getrennt. Die kosmetische RNG-Nutzung bleibt synchron und in bisheriger Reihenfolge.
- **103 Tests bestanden**, vollständiger obiger Befehl, Node.js `v23.11.1` / Linux. Keine geänderten Layout-/Save-/Effekt-Sollwerte. Sechs gezielte Mutationen in Welt-RNG, Material, Fog, Effekt-RNG, Partikelphysik und Zeichnung wurden erkannt.
- Je ein frischer Chromium-`file://`-Lauf vor dem Umbau und nach beiden Schritten. Acht Layout-Messsätze, GPU-/Qualitätswerte und die bekannten Skybox-Ausnahmen stimmen überein; erweiterter Spiel-/Eingabe-/Save-/Reload-/Backup-Ablauf bestanden.
- Prüfumfang, Schnittstellen und weiterhin offene Bereiche: [Welt und Effekte](world-effects-decoupling.md). Kein Hörtest, HTTP-, vollständiger Kampagnen- oder Performance-Nachweis.

## Vorheriger Prüfstand: Welt-/Renderer-Grenze

- Welt und Simulation ohne Renderer ausführbar; `world-view.js` übernimmt GPU-Übersetzung und unveränderte Entitätsmodelle. Zwei zusätzliche Isolation-/Adaptertests; **100 Tests bestanden**.
- Frischer Chromium-`file://`-Nachher-Lauf und Vergleich zum Ausgangslauf bestanden: acht Layout-Messsätze, GPU-/Qualitätswerte, Spiel-/Eingabe-/Save-/Backup-Ablauf unverändert; nur bestehende Skybox-Ausnahmen.
- Referenzen und Schnittstellen: [Welt und Effekte](world-effects-decoupling.md).

## Vorheriger Prüfstand: Welt-/Effektreferenzen

- 22 zusätzliche Referenztests vor dem Umbau gegen `97bfda6`: Terrain-Geometrie, sämtliche statischen Platzierungen und ausgewählte Navigations-/Sichtbarkeitsfälle aller 16 Karten sowie sechs Effektszenarien einschließlich Folge-RNG und Operationszustand.
- Vollständiger obiger Befehl: **98 bestanden**, Node.js `v23.11.1` / Linux. Frischer erweiterter Chromium-`file://`-Ausgangslauf bestanden; bestehende Skybox-Ausnahme unverändert.
- Herkunft, Umfang und weitere Schritte: [Welt und Effekte](world-effects-decoupling.md).

## Vorheriger Prüfstand: Speicher-Entkopplung

- `persistence.js` übernimmt Storage, Profilnormalisierung, Checkpoint-JSON und Backup-Codec. `app.js` übergibt Abhängigkeiten und verdrahtet den Dienst mit `MeridianUI`. Formatversionen, Schlüssel und bisheriges Fehlerverhalten der geprüften Abläufe bleiben erhalten.
- **76 Tests bestanden, 0 fehlgeschlagen**, vollständiger obiger Befehl unter Node.js `v23.11.1` / Linux. Vier gezielte Mutationen wurden erkannt; bisherige Layout-/Save-Referenzen unverändert.
- Frischer Chromium-`file://`-Vorher-/Nachher-Vergleich bestanden: acht identische Layout-Messsätze, GPU-/Qualitätsprüfungen und erweiterter Eingabe-/Save-/Reload-/Backup-Ablauf. Nur die bestehende Skybox-Ausnahme.
- Zusätzliche Browserprobe mit testseitig werfendem Storage-Getter: Start, flüchtiges Speichern/Laden, API-Dateiimport und Verlust des flüchtigen Zustands nach Reload geprüft. Keine natürliche Browser-Storage-Sperre nachgewiesen.
- Schnittstelle, Prüfungen und Grenzen: [Speicher-Entkopplung](persistence-decoupling.md).

## Vorheriger Prüfstand: Speicher-Charakterisierung

- 13 neue Tests gegen den unveränderten Spielcode aus `b09717e`; insgesamt **72 bestanden, 0 fehlgeschlagen**, Node.js `v23.11.1` / Linux, vollständiger obiger Befehl.
- Frischer Chromium-`file://`-Ausgangslauf mit der erweiterten Probe aus der Auslagerungsserie bestanden; weiterhin nur die bekannte Skybox-Ausnahme. Noch kein Nachher-Nachweis einer Entkopplung.
- Verhalten, Grenzen und nächste Schnittstelle: [Speicher-Entkopplung](persistence-decoupling.md).

## Vorheriger Prüfstand: weitere Skriptauslagerungen

- `world.js`, `simulation.js`, `audio.js`, `ui.js` und `app.js` jeweils separat vollständig bytegleich ausgelagert; übrige Skriptdateien, Styles, Assets, Tests und Referenzen unverändert. Keine gleichzeitige Entkopplung oder Formatierung.
- Nach jedem abgeschlossenen Schritt **59 Tests bestanden, 0 fehlgeschlagen**, vollständiger obiger Befehl unter Node.js `v23.11.1` / Linux.
- Frischer Chromium-`file://`-Vergleich mit dem Ausgangsstand und dem vorherigen Schritt: acht identische Layout-Messsätze, Shader-/Textur-/Qualitätsprüfungen, erweiterter Spiel-/Save-/Backup-Ablauf und zusätzliche Maus-/Tastaturprüfungen bestanden. Nur die bestehende Skybox-Ausnahme erfasst.
- Einzelne Schritte, Bytevergleiche, zusätzliche Audio-API-Prüfung und weiterhin offene Bereiche: [Auslagerungsserie](script-extraction.md). Kein Hörtest, HTTP- oder vollständiger Kampagnentest.

## Vorheriger Prüfstand: Renderer-Auslagerung

- Der komplette Renderer-Block liegt bytegleich in `renderer.js`, einschließlich Einrückung, Shadern und eingebetteten Texturen. Klassische Einbindung weiterhin zwischen `core` und `content`; alle anderen Spielquellen, Assets und Tests unverändert.
- **59 Tests bestanden, 0 fehlgeschlagen** unter Node.js `v23.11.1` / Linux, einschließlich unveränderter Layout-Prüfsummen und Save-Referenz.
- Frische Chromium-`file://`-Läufe vor/nach der Änderung: acht Layoutansichten unverändert, vier verlinkte Shaderprogramme, drei aufgezeichnete Bild-Uploads und laufende Renderframes bei allen drei Grafikqualitäten. Erweiterter Spiel-/Save-/Backup-Smoke-Test ebenfalls bestanden; nur die bestehende Skybox-Ausnahme erfasst.
- Umgebung, Instrumentierung und Grenzen: [Renderer-Auslagerung](renderer-extraction.md). Kein vollständiger Kampagnen-/Interaktionstest.

## Vorheriger Prüfstand: Content-Auslagerung

- Der komplette `content`-Block liegt in `content.js`, unverändert bis auf entfernte HTML-Einrückung. Einbindung weiterhin nach `renderer` und vor `world`; keine neuen Module oder Build-Abhängigkeiten.
- **59 Tests bestanden, 0 fehlgeschlagen** unter Node.js `v23.11.1` / Linux. Neuer Isolationstest bereits vor dem Verschieben gegen den Inline-Block geprüft; bisherige Referenzen unverändert.
- Chromium `152.0.7977.75`, Linux, `file://`, temporäre Profile ohne abgeschwächte Sicherheitsflags: Vorher-/Nachher-Läufe mit acht Layoutansichten und erweitertem Spiel-/Save-/Backup-Smoke-Test. `content.js` erfolgreich geladen; erfasste Stile und Abmessungen identisch, keine neuen erfassten Fehler. Bestehende Skybox-Ausnahme unverändert.
- Umfang und nicht geprüfte Bereiche: [Content-Auslagerung](content-extraction.md). Kein vollständiger interaktiver Kampagnentest.

## Vorheriger Prüfstand: Core-Auslagerung

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
