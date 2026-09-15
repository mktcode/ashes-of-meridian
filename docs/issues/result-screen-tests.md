# Ergebnisbildschirm: Controls-Tests gegen aktuellen UI-Vertrag abgleichen

## Befund

Bei der gezielten Prüfung der Profilnormalisierung schlagen zwei bereits vorher vorhandene Controls-Tests fehl:

- `victory offers expedition benefits while defeat offers a fresh expedition` (`tests/ashes-of-meridian-controls.check.cjs:770`)
- `result upgrades return to the same ended battle without replaying the result sound` (`:828`)

Beide Fehler sind mit einem separat unter `.tmp/profile-settings-01/baseline/` gebauten Quellabzug des unveränderten Commits `1b120a7` reproduziert, ohne Profilpatch. Die Controls-Testwelt lädt das Persistenzmodul nicht. Im kombinierten gezielten Lauf bestehen Persistenz und Renderer; nur diese beiden Controls-Fälle scheitern (Logs im Hauptcheckout `.tmp/profile-settings-01/`).

Die Tests lesen den alten Modal-Stub `ui.html`. `showResult()` schreibt dagegen direkt nach `document.getElementById('result').innerHTML` (`src/ui/screens.ts:211–232`). Der Upgrade-Knopf ist auch bei offenen Vorteilsangeboten vorhanden: im `benefitPanel` (`:229`) statt in der allgemeinen unteren Knopfleiste (`:231`). Die zunächst gemeldete Abweichung über einen fehlenden Knopf war eine unvollständige Quellenprüfung, kein Produktkonflikt.

## Entscheidung und nächste Prüfung

Keine Produktentscheidung zum Upgrade-Knopf nötig. Die betroffenen Tests auf den vorhandenen Ergebnis-DOM ausrichten und ihre Testdaten gegen den aktuellen Expeditionsvertrag prüfen, ohne Behauptungen nur zum Grünmachen zu entfernen. Insbesondere Upgrade-Zugang mit Vorteilsangeboten, Rückkehr zum selben Ergebnis, unveränderte Spielzustände und einmaligen Ergebnis-Sound weiter prüfen.

Keine Änderung der Ergebnis-UI erforderlich. Die einmalige abschließende Gesamtsuite steht noch aus; sie folgt nach Integration der Testkorrekturen beim Hauptagenten. Kein Browser-/Sound-/Darstellungsnachweis durch die Node-Prüfung.
