# Test- und Werkzeugpflege

## Fachlich veraltete Fixtures

- [ ] Verbliebene Start-/Terrain-/Entitätszahlannahmen gegen den aktuellen Worker→bezahltes
  HQ-Ablauf prüfen: Profil-Upgrades, vorgefertigte HQs und automatisch minende Worker
  insbesondere in Langtests berichtigen. Lokale flache Regelarenen von echten
  Landschafts-/Deploymentprüfungen trennen. Keine Referenzen zum Grünmachen regenerieren.
- [ ] Westmark-KI-/Simulationsfixtures und echte FFA-Fälle erst danach gezielt mit eigener
  Freigabe prüfen. Keine kartenspezifische Patt-Ausnahme; Dispatchtests beweisen keine
  Erntezyklen, Gaszugänge oder autonomen Partien. [Workerbefunde](navigation-worker-und-gruppenankunft.md).

## Bekannte Kurzprüfungsblocker

Historisch auf `2038076` festgestellt, nicht durch diese Dokumentationspflege neu ausgeführt:

- [ ] `tests/ashes-of-meridian-capture.check.cjs`: Formatabweichung stoppt `check:quality`
  in `check:format`; übrige kurze Prüfungen lassen sich unabhängig ausführen.
- [ ] Harnessfall `fragment groups completely mirror their index directories…`:
  `UI_SCRIPTS` enthält `capture`, Datei liegt aber unter `dist/src/capture.js`, nicht `dist/src/ui/`.
  Verzeichniserwartung mit tatsächlichem Ladevertrag abgleichen.

## Materialfehler im Browser

- [ ] Ein begrenzter Chromium-Check über `file://`: gezielt fehlgeschlagene Erzeugung/
  Upload eines Pflichtmaterials muss Gefechtsstart/Vorschau blockieren und Fehler
  sichtbar melden. Keine fehlende Rasterdatei simulieren; Materialien sind prozedural.
  Node-Fehler-/Residencyverträge sind geprüft, Browsernachweis offen. Historischer
  Browserstart scheiterte an `Socket path too long` im lokalen Scratch; Isolation
  oder Browsersicherheit nicht lockern. Kein belegter Bezug zu mobilen Abbrüchen.

## Pflege bei konkretem Bedarf

- [ ] Gemischte teure/kurze Testdateien und Modell-/Präsentationsüberschneidungen nach
  Vertragsvergleich aufteilen; Laufzeiten aus bestehenden Ergebnissen berücksichtigen.
  Keine Testabschwächung, geteilten mutablen VM-Kontexte oder Massenformatierung.
- [ ] Ältere Werkzeuge auf gemeinsamen Browser-Harness und expliziten Scratch-Besitz prüfen.
  Persönliche Profile/Saves und Backups nicht bereinigen.
- [ ] Diagnose-Start/Stopp/Ressourcenfreigabe und VAO-Besitz dauerhaft gezielt absichern;
  alte Scratch-Orakel nicht ungeprüft als aktuelle Sollregel übernehmen.
- [ ] Bei Baugrid-Messbedarf begrenzten JSON-Benchmark erwägen, ohne zeitabhängiges
  Pass/Fail in Logiktests. Nur bei Bedarf einen versionierten itch-Beschreibungstext entscheiden.

[Befehle](../testing.md), [Freigaben](../../AGENTS.md#prüfungen),
[Messfragen](performance-und-mobilstabilitaet.md).
