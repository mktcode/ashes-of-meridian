# Texturvorbereitung: Browserabnahme offen

Die Vorbereitung prüft jetzt erfolgreiche Materialrückgaben und die tatsächliche Residency aller Pflichtmaterialien, bevor sie Erfolg meldet oder alte Materialien freigibt. Aktuelle Fehler erreichen den vorhandenen App-Fehlerpfad; überholte Anfragen liefern auch bei fehlgeschlagenen gemeinsam genutzten Loads nur `false` und melden keinen Fehler über eine neuere Szene.

Der historische `Image.onerror`-Befund gilt nicht mehr: Materialien werden inzwischen prozedural erzeugt und hochgeladen. Keine Assetersetzung oder allgemeine Rendererbereinigung; kein belegter Zusammenhang mit [mobilen Grafikabbrüchen](performance/README.md#mobilstabilität-und-speicher).

Build und gezielte Node-Regressionen für Erfolg, fehlgeschlagene Rückgaben/Uploads, fehlende Residency, Fortschritt, konkurrierende Anfragen, geteilte Loads samt Retry sowie App-Start-/Vorschaufehler bestanden. Keine KI-/Simulations- oder Vollsuiten ausgeführt.

## Verbleibende Abnahme

- [ ] Ein gezielter Chromium-Check über `file://`: absichtlich fehlgeschlagenes Pflichtmaterial muss Gefechtsstart und Vorschau blockieren und den Fehler sichtbar melden. Da keine Bilder mehr geladen werden, Materialerzeugung/-upload beziehungsweise dessen Rückgabe gezielt scheitern lassen; kein fehlendes Rasterasset simulieren. Keine Screenshotserie oder Performanceabnahme.

Der Browserversuch im isolierten Worktree scheiterte bereits beim Chromium-Start: `Socket path too long` für den Singleton-Socket unter dem vorgeschriebenen worktree-lokalen temporären Verzeichnis. Kein Browsernachweis; Isolation und Browsersicherheit wurden nicht gelockert. [Prüfwahl](../testing.md).
