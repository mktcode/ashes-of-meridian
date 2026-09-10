# Ashes of Meridian

Statischer Echtzeitstrategie-Prototyp mit 16 Kampagnenmissionen und drei Fraktionen. `index.html` enthält das statische HTML und die Dateieinbindungen, `styles.css` das Stylesheet. Das JavaScript liegt in klassischen lokalen Skripten; Zuständigkeiten und Reihenfolge beschreibt die [Codekarte](docs/architecture.md#codekarte). Alle Quellen werden direkt ausgeliefert, ohne npm-Abhängigkeiten oder Build-Schritt.

## Spielen

`index.html` direkt in einem aktuellen Desktop-Browser mit WebGL 2 und aktivierter Hardwarebeschleunigung öffnen. Alle im HTML über `<script src>` eingebundenen lokalen `.js`-Dateien und `styles.css` müssen für das Spiel und `skybox.webp` für den vorgesehenen Himmel neben der HTML-Datei bleiben. Beim Weitergeben diese Dateien zusammenhalten; das Spiel ist kein autarkes Ein-Datei-Paket.

Der direkte Start über `file://` soll erhalten bleiben. Das externe CSS und die lokalen klassischen Skripte wurden mit Chromium über `file://` geprüft. Browser können jedoch lokale WebGL-Texturen oder dauerhafte Speicherung einschränken: Beim Chromium-Test wurde der Skybox-Upload bereits vor der CSS-Auslagerung blockiert. Details und offene Prüfungen stehen im [Prüfstand](docs/testing.md). Alternativ aus dem Projektverzeichnis einen lokalen Server starten (Python 3 erforderlich):

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Dann [http://127.0.0.1:8080/](http://127.0.0.1:8080/) öffnen. Der Server ist ein optionales Hilfsmittel, keine vorgesehene Spielvoraussetzung.

Die Steuerung erklärt das **Field Manual** im Spiel (`F1`).

## Spielstände sichern

Fortschritt und Checkpoints werden im Browserspeicher abgelegt. Unter **Settings → Export Backup** lässt sich ein JSON-Backup sichern; **Import Backup** liest es wieder ein und ersetzt dabei gespeicherte Profildaten, bei enthaltenem Checkpoint auch diesen.

Vor Browserwechsel, Verschieben der Spieldatei oder Wechsel zwischen `file://` und HTTP ein Backup exportieren: Browserspeicher wird dabei nicht automatisch übertragen. Ohne verfügbaren dauerhaften Speicher ist der In-Memory-Ersatz nach dem Schließen verloren.

## Entwickeln und prüfen

Die vorhandenen Tests benötigen Node.js, aber keine Installation von Paketen. Aus dem Projektverzeichnis:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs tests/ashes-of-meridian-harness.check.cjs tests/ashes-of-meridian-simulation.check.cjs tests/ashes-of-meridian-core.check.cjs tests/ashes-of-meridian-persistence.check.cjs tests/ashes-of-meridian-presentation.check.cjs
```

- [Architektur](docs/architecture.md): aktueller Aufbau, Risiken und nächste Schritte.
- [Prüfungen](docs/testing.md): Testabdeckung, Browser-Checkliste und belegter Prüfstand.
- [Arbeitsregeln für KI-Assistenten](AGENTS.md).
- [Historischer Prüfbericht](docs/bisheriger-pruefstand.md): übernommene Notizen, kein aktueller Testnachweis.
