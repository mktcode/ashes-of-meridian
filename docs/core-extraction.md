# Mathematik und RNG: Referenzen und Auslagerung

## Zuerst: Referenztests vor der Auslagerung

Quelle der Core-Referenzen: `e0734ec:index.html`, Renderer-Block. Die Implementierung blieb bei Einführung der acht Tests in `tests/ashes-of-meridian-core.check.cjs` unverändert im HTML.

Die ersten sechs Ergebnisse von `seeded()` für die Seeds `0`, `1409`, `-1`, `2147483648` und `77` wurden einmalig direkt aus diesem Git-Stand erfasst. Im Test stehen sie als ganzzahlige Werte `random() * 4294967296`; diese Darstellung erhält die exakten 32-Bit-Ergebnisse ohne gerundete Dezimalwerte. Keine automatische Neugenerierung beim Testlauf. Zusätzliche Prüfungen erfassen die bestehende `seed | 0`-Konvertierung, unabhängige Generatorzustände und Werte in `[0, 1)`.

Mathematiktests verwenden einfache, unabhängig nachvollziehbare Referenzen für Vektorrechnung, Translation/Skalierung, Projektionsgrenzen und Kamerakoordinaten. Sie prüfen die spaltenweise Matrixablage, die Multiplikationsreihenfolge, fehlende implizite Division durch `w`, Eingabe-Isolation und Inversion mit Zeilentausch. Bestehende Sonderfälle bleiben ausdrücklich erhalten: Nullvektor-Normalisierung, Nullbasis bei identischer Kameraposition/Ziel sowie Identitätsmatrix als Fallback bei singulärer oder zu kleiner Pivotkomponente. Diese Tests sind kein Anlass für beiläufige mathematische „Korrekturen“.

Prüfung vor jeder Auslagerung: kompletter [Node-Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux, **52 bestanden, 0 fehlgeschlagen**. Spiel-HTML, CSS, Assets und vorhandene Erwartungen blieben unverändert. Für diesen reinen Testschritt wurde kein zusätzlicher Browserlauf ausgeführt. Commit: `5dc17f1`.

## Anschließend: reine Auslagerung

`core.js` enthält nur `M4`, `V` und `seeded`, einen Datei-Kommentar und die wie zuvor wirksame Strict-Mode-Direktive. Die Definitionen sind bis auf die entfernte vierstellige HTML-Einrückung bytegleich zum Ausgangsstand. Setzt man sie zurück an die alte Stelle und entfernt den neuen Skript-Tag, entsteht exakt das vorherige HTML. CSS und vier Assets sind bytegleich geblieben.

Einbindung unmittelbar vor `renderer`:

```html
<script data-meridian-script="core" src="./core.js"></script>
```

Kein `async`, `defer`, ES-Modul, Laufzeit-Import oder Build. Globale lexikalische Bindungen bleiben erhalten: `M4` und `V` sind keine Eigenschaften von `window`, die klassische Funktionsdeklaration `seeded` dagegen schon. Der neue Isolationstest lädt nur `core`, ohne Renderer oder Browserglobals. RNG-Aufrufstellen, Verfahren und Aufrufreihenfolge wurden nicht verändert.

### Gemeinsamer Testzugriff

Der bisherige Helper `tests/helpers/inline-scripts.cjs` heißt jetzt `tests/helpers/game-scripts.cjs`; `readInlineScripts()` wurde zu `readScripts()`. Alle Testaufrufer wurden angepasst, nicht über einen Kompatibilitätsalias weitergeführt. Modell-/Simulationstests wählen `core` ausdrücklich als zusätzliche Abhängigkeit aus.

Der Loader unterstützt bewusst nur den aktuellen Verpackungsvertrag:

- Benannte klassische Inline-Skripte oder lokale `.js`-Dateien, optional mit `./` und einfachen Unterverzeichnissen. Pfade sind relativ zum Quellverzeichnis, nicht zum Prozess-Arbeitsverzeichnis.
- Nur die Attribute `data-meridian-script` und optional `src`, mit quoted Werten. Mehrdeutige/doppelte Attribute, Module, asynchrone Ausführung, externe Tags mit Inline-Code und `<base>` werden abgelehnt.
- Keine Netzwerk-/Datei-URLs, absoluten Pfade, `..`-Segmente, Backslashes, URL-Encoding, Queries oder Fragmente. Symlinks außerhalb des realen Quellverzeichnisses werden abgelehnt.
- Fehlende Dateien führen zu einem benannten Fehler. Fehlermeldungen aus externem Code zeigen etwa `core.js`, Inline-Code weiterhin `index.html#renderer`.
- Alle Skriptquellen werden gelesen und im Syntaxcheck geparst. Ausgeführt werden nur explizit ausgewählte Namen, immer in Dokumentreihenfolge und gemeinsam in einer isolierten VM. Kein allgemeiner HTML-Parser oder Nachbau von Browser-Sicherheitsregeln.

Fünf zusätzliche Harness-Tests sichern Dateimischung/Reihenfolge, Pfad- und Attributgrenzen, fehlende Dateien/Symlinks und externe Fehlerquellen ab. Nach der Auslagerung: **58 Tests bestanden, 0 fehlgeschlagen**, mit unveränderten RNG-Folgen, Layout-Prüfsummen und Save-Fixture; Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit, ein Testworker. Der Gesamtlauf funktioniert auch aus `/tmp` mit absoluten Testpfaden. Lokale Dokumentationslinks/Anker und `git diff --check` wurden ebenfalls geprüft.

## Aktuelle Chromium-Prüfung über `file://`

Chromium `152.0.7977.75`, Linux, headless, separates temporäres Profil; keine fremden Spielstände, keine abgeschwächten Sicherheitsflags, Audioausgabe stumm. Die Probe aus der [CSS-Prüfung](css-extraction.md#browservergleich-über-file) wurde für den neuen Stand ausgeführt und erweitert. Im Netzwerkprotokoll wurde `core.js` erfolgreich geladen; der DOM-Skriptablauf bestätigt `core` vor den sieben Inline-Skripten, überall ohne `async`/`defer`.

- **Darstellung:** Hauptmenü, Kampagnenansicht, Settings und unmittelbar pausierter Missionsstart bei 1280×800 und 800×700. Alle acht erfassten Stil-/Abmessungssätze stimmen mit der bereits erfassten Browserreferenz des formatierten Ausgangsstands `e0734ec` überein. Diese ältere Referenz dient nur dem Vergleich; der Lauf mit `core.js` wurde neu ausgeführt.
- **Tatsächliche Eingabeereignisse via DevTools:** Pause-/Resume-Buttons und Kamera-Zoom angeklickt. Zeit läuft nach Resume weiter und bleibt während Pause stehen; Zoomänderung geprüft.
- **API-gesteuertes Integrationsszenario:** Held ausgewählt und Bewegungsbefehl erteilt, eine Rifle-Einheit rekrutiert, ein Depot an einer gültigen Stelle errichtet. Danach 1.000 feste Schritte mit `step(0.05)` und `tickEffects(0.05)` im Browser ausgeführt, HUD aktualisiert. Held bewegt, genau eine Rekrutierung und ein Bau fertig, Arbeiter liefern Alloy. Das ist keine Prüfung der Maus-Befehlszuweisung oder Bauvorschau.
- **Speichern:** Über `Meridian.ui.save(false)` gespeichert, Inhalt von `localStorage` kontrolliert, Seite vollständig neu geladen. Persistierter Operations-JSON bleibt identisch. Über `Meridian.ui.load()` wiederhergestellt und unmittelbar pausiert; Zeit und Rekrutierungsstatistik erhalten.
- **Backup:** Über `Meridian.ui.exportBackup()` tatsächlich eine JSON-Datei ins temporäre Profil heruntergeladen und Format/Operation geprüft. Danach Operation und Storage ausschließlich dieses Testprofils geleert. Datei über das echte `#importFile`-Eingabefeld mit `DOM.setFileInputFiles` importiert, Checkpoint geladen; Zeit und fertiges Depot erhalten. Kein Test des nativen Dateiauswahldialogs.
- **Fehler:** Nur die bekannte Skybox-`SecurityError`-Ausnahme, einmal je Seitenladung, keine neuen erfassten Laufzeitausnahmen, Konsolenfehler oder fehlgeschlagenen Ressourcenabrufe. Anwendung und WebGL bleiben aktiv, Ladebildschirm ausgeblendet.

Probe, Screenshots, Backupdatei und Rohprotokolle waren temporäre Prüfartefakte, keine neue eingecheckte Browser-Testsuite. Die Backupdatei und das Testprofil wurden nach dem Lauf entfernt.

**Offen:** HTTP-Start, Firefox-Prüfung durch den Assistenten, Audioausgabe, native Dateidialoge, vollständige Maus-/Tastaturbedienung einschließlich Bauvorschau, lange Kampagnenverläufe und Performance. Der Nutzerbericht zur Firefox-Skybox bleibt separat; die Skybox wird auf seinen Wunsch nicht in diesem Refactoring korrigiert. Exakte RNG-Fortsetzung nach Laden ist weiterhin nicht zugesichert.
