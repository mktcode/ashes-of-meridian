# Ashes of Meridian

Statischer Echtzeitstrategie-Prototyp auf dem Weg zum Mobile-Roguelite: drei Fraktionen und wiederholbare Gefechte mit einem Ziel – das gegnerische Hauptquartier zerstören. Kampagne und alternative Missionsmodi sind entfernt. `index.html` enthält das statische HTML und die Dateieinbindungen, `styles.css` das Stylesheet. Das JavaScript liegt in klassischen lokalen Skripten; Zuständigkeiten und Reihenfolge beschreibt die [Codekarte](docs/architecture.md#codekarte). Alle Quellen werden direkt ausgeliefert, ohne npm-Abhängigkeiten oder Build-Schritt.

## Spielen

`index.html` direkt in einem aktuellen Browser mit WebGL 2 und aktivierter Hardwarebeschleunigung öffnen. Alle im HTML über `<script src>` eingebundenen lokalen `.js`-Dateien und `styles.css` müssen neben der HTML-Datei bleiben. Die Skybox ist wie die Bodentexturen direkt in `renderer.js` eingebettet; die separaten Bilddateien bleiben als Quellen im Repository erhalten. Beim Weitergeben diese Dateien zusammenhalten; das Spiel ist kein autarkes Ein-Datei-Paket.

Der direkte Start über `file://` bleibt erhalten und wurde einschließlich des Skybox-WebGL-Uploads mit Chromium geprüft. Die frühere Sperre der extern geladenen Skybox wird durch eingebettete Bilddaten vermieden. Browser können weiterhin dauerhafte Speicherung einschränken. Details und offene Prüfungen stehen im [Prüfstand](docs/testing.md). Alternativ aus dem Projektverzeichnis einen lokalen Server starten (Python 3 erforderlich):

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Dann [http://127.0.0.1:8080/](http://127.0.0.1:8080/) öffnen. Der Server ist ein optionales Hilfsmittel, keine vorgesehene Spielvoraussetzung.

Kamera: **mit einem Finger ziehen**, **Pinch-to-Zoom** oder die Zoomschaltflächen verwenden. **⌂ / Command view** führt zur Basis zurück; die Minimap lässt sich antippen und ziehen. Desktop-Kamerasteuerung per WASD, Leertaste/Home, Mausrad, mittlerem Maustasten-Ziehen im Spielfeld und Edge Scrolling ist entfernt. Antippen wählt aus; Doppeltippen wählt sichtbare Einheiten desselben Typs. Dreifachtippen auf dieselbe eigene Einheit wählt alle sichtbaren eigenen Einheiten außer Workern (auch Sanitäter, Scouts und Kommandant); jeweils weniger als 330 ms zwischen den Taps. [Tap-Auswahl und Prüfungen](docs/mobile-triple-tap.md). Maus-Rechteckauswahl, Shift-Auswahl, Kontrollgruppen und Befehls-Auftragsketten sind entfernt. Neue Befehle ersetzen den aktuellen Auftrag; Produktionswarteschlangen bleiben erhalten. Spiel-Hotkeys sind entfernt; Befehle, Fähigkeiten, Pause, Speichern/Laden und Handbuch werden über die vorhandenen Schaltflächen bedient. **Cancel** neben dem Zielhinweis bricht Bauplatzierung oder Zielauswahl ab. Bauhilfe durch weitere Arbeiter entfällt; regulärer Bau und Reparatur fertiger Gebäude/Einheiten bleiben erhalten. Rechtsklick-Befehle bestehen vorerst weiter. [Kamera-Bereinigung](docs/mobile-camera-cleanup.md) · [Auswahl-/Befehlsbereinigung](docs/mobile-selection-cleanup.md) · [Touch-Befehle, Abbrechen und Bauhilfe-Entfernung](docs/mobile-touch-controls.md).

Fertige eigene Gebäude zeigen **Repair / Stop repair** und **Sell** direkt am Gebäude. Reparatur schickt den nächsten eigenen Arbeiter; ohne Arbeiter geht es nicht. Verkauf nach Bestätigung erstattet 50 % des Gebäudepreises und offene Rekrutierung vollständig. Das letzte fertige Hauptquartier bleibt geschützt. [Gebäudeaktionen und Prüfungen](docs/mobile-building-actions.md).

Beschreibungs- und Browser-Tooltips sind entfernt; sichtbare Kosten, Rückmeldungen und das Handbuch bleiben erhalten. [Tooltip-Bereinigung](docs/tooltip-removal.md).

**New battle** öffnet die Wahl von Fraktion, Gegner, Landschaft, Schwierigkeit und Seed. Das eigene letzte HQ darf nicht fallen. Für Tests steht das bisherige volle Arsenal bereit; noch keine Gebäude-Freischaltungen oder absichtlich nahezu unbesiegbare Gegnerbasis.

Ingame-Forschung und Forschungsgebäude sind entfernt. **Fleet Upgrades** sind im Testmodus **kostenlos** bis zur bisherigen Höchststufe 3 kaufbar und werden gespeichert; alle sechs wirken ab dem nächsten Gefecht. Die Upgrade-Ressource ist für Tests unbegrenzt verfügbar, ohne Verbrauch oder Sammelsystem. Alloy/Aether im Gefecht bleiben begrenzt. Die spätere separate Fortschrittsressource und deren Gewinnung sind noch nicht implementiert. [Kampagnenentfernung und Prüfungen](docs/campaign-removal.md).

Unter **Settings → Render quality** verwenden **High** und **Balanced** bis zu **4× MSAA** für glattere Modellkanten, sofern die Grafikhardware es unterstützt. **Performance** verzichtet darauf. Es ist kein zusätzlicher Antialiasing-Schalter nötig.

## Spielstände sichern

Permanente Upgrades, Einstellungen und Checkpoints werden im Browserspeicher abgelegt. Gefechts-Checkpoints verwenden jetzt Version 2; alte Kampagnen-/Skirmish-Spielstände werden nicht übernommen. Vorhandene permanente Upgrade-Stufen bleiben erhalten. Unter **Settings → Export Backup** lässt sich ein JSON-Backup sichern; **Import Backup** liest es wieder ein und ersetzt dabei gespeicherte Profildaten, bei enthaltenem Checkpoint auch diesen.

Vor Browserwechsel, Verschieben der Spieldatei oder Wechsel zwischen `file://` und HTTP ein Backup exportieren: Browserspeicher wird dabei nicht automatisch übertragen. Ohne verfügbaren dauerhaften Speicher ist der In-Memory-Ersatz nach dem Schließen verloren.

## Entwickeln und prüfen

Die vorhandenen Tests benötigen Node.js, aber keine Installation von Paketen. Aus dem Projektverzeichnis:

```bash
node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs tests/ashes-of-meridian-harness.check.cjs tests/ashes-of-meridian-simulation.check.cjs tests/ashes-of-meridian-core.check.cjs tests/ashes-of-meridian-persistence.check.cjs tests/ashes-of-meridian-presentation.check.cjs tests/ashes-of-meridian-controls.check.cjs tests/ashes-of-meridian-renderer.check.cjs
```

- [Architektur](docs/architecture.md): aktueller Aufbau, Risiken und nächste Schritte.
- [Prüfungen](docs/testing.md): Testabdeckung, Browser-Checkliste und belegter Prüfstand.
- [Arbeitsregeln für KI-Assistenten](AGENTS.md).
- [Historischer Prüfbericht](docs/bisheriger-pruefstand.md): übernommene Notizen, kein aktueller Testnachweis.
