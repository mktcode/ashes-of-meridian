# Prüfungen

## Automatisierte Tests

Aus dem Projektverzeichnis mit Node.js ausführen; weder npm-Pakete noch Browser oder Build sind erforderlich:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs
```

Die expliziten Dateinamen funktionieren ohne Bash-Brace-Expansion. Das Heaplimit gilt für den JavaScript-Heap, nicht als Obergrenze für den gesamten Prozessspeicher. Die Testdateien werden nacheinander ausgeführt.

### Tatsächliche Abdeckung

| Testdatei | Prüfungen |
| --- | --- |
| `tests/ashes-of-meridian-terrain.check.cjs` | 19 Tests: Syntax aller sieben Inline-Skripte; deterministische, endliche und begrenzte Felsgeometrie samt Normalen und Dreiecksbudget; Layout-Prüfsummen aller 16 Kampagnenkarten und variierte Felsdarstellung; reproduzierbare Renderplatzierungen eines Gefechts-Seeds |
| `tests/ashes-of-meridian-crystals.check.cjs` | 5 Tests: Kristallgeometrie mit 36 Dreiecken und Einheitsnormalen; 80 zeitstabile Vorkommensmodelle; Größenänderung beim Abbau ohne Mutation der Entität; Vorschauparameter; bestehende Aether-Formen und Animation |

Beide Dateien lesen JavaScript aus `index.html` und führen die ersten drei Skriptblöcke in einer Node-VM aus. Renderer-Aufrufe werden durch Teststubs ersetzt. Es wird kein WebGL-Kontext erstellt.

Die Layout-Prüfsummen erfassen `staticGrid`, `terrainColors` und `rocks`. Sie sind eine feste Referenz aus der Zeit vor der visuellen Terrainänderung. Bei einem reinen Refactoring müssen sie unverändert bestehen bleiben; bei Abweichungen zuerst die Ursache untersuchen, nicht neue Sollwerte übernehmen.

### Nicht abgedeckt

- Tatsächliches Shader-Kompilieren, Texturladen, GPU-Ausgabe und Performance.
- Browserstart über `file://` oder HTTP, DOM, Eingabe, Audio und responsive Darstellung.
- Missionsverlauf, Wegfindungsfälle, Kampf, Produktion, Wirtschaft und Sieg/Niederlage.
- Storage-Verhalten, Backup-Import/Export, Save-Kompatibilität und identische Fortsetzung nach Laden.

Insbesondere prüft der Kristall-Abbautest die **Darstellung bei vorgegebenen Mengen**, nicht den Abbau durch Arbeiter. Ein grüner Syntaxcheck führt die UI- und Simulationsskripte nicht aus und kompiliert keine GLSL-Shader.

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

## Belegter Prüfstand dieser Bestandsaufnahme

- Referenz: formatierter Ausgangscommit `ab92a12`.
- Umgebung: Node.js `v23.11.1` unter Linux; das ist die tatsächlich geprüfte Version, keine ermittelte Mindestversion.
- Obiger Testbefehl ausgeführt: **24 Tests bestanden, 0 fehlgeschlagen**.
- `index.html`, die vier Bilddateien und beide Testdateien wurden byteweise mit `HEAD` verglichen: unverändert.
- Lokale Markdown-Links samt Abschnittsankern in README, AGENTS und den drei Dokumenten unter `docs/` geprüft; `git diff --check` ohne Beanstandung.
- **Nicht ausgeführt:** Browser-Sichtprüfung, `file://`-/HTTP-Kompatibilitätsprüfung und vollständiger Spiel-/E2E-Lauf. Ein Build existiert derzeit nicht.
- Die früheren Chromium- und Modellprüfungen im [historischen Bericht](bisheriger-pruefstand.md) wurden für diesen Stand nicht wiederholt und sind kein aktueller Browsernachweis.

Künftige Prüfnotizen unter `docs/` ablegen und mit Commit/Änderungsumfang, Umgebung, Befehl beziehungsweise Ablauf, Ergebnis und nicht geprüften Bereichen versehen. Historische Ergebnisse nicht stillschweigend als aktuelle übernehmen.

## Nächste Erweiterung des Sicherheitsnetzes

Vor einer Modulaufteilung Testloader und Renderer-Stubs gemeinsam nutzen und den positionalen Zugriff auf Skriptblöcke ersetzen. Anschließend Missionsstart, Produktions-/Ressourcenverhalten, Befehle und ein bestehendes Save-Fixture absichern. Details und die bekannten RNG-Grenzen stehen in der [Architektur](architecture.md#nächste-schritte-und-späteres-zielbild).
