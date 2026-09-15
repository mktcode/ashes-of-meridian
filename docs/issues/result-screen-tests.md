# Ergebnisbildschirm: Controls-Tests gegen aktuellen UI-Vertrag abgleichen

## Befund

Bei der gezielten Prüfung der Profilnormalisierung schlagen zwei bereits vorher vorhandene Controls-Tests fehl:

- `victory offers expedition benefits while defeat offers a fresh expedition` (`tests/ashes-of-meridian-controls.check.cjs:770`)
- `result upgrades return to the same ended battle without replaying the result sound` (`:828`)

Beide Fehler sind mit einem separat unter `.tmp/profile-settings-01/baseline/` gebauten Quellabzug des unveränderten Commits `1b120a7` reproduziert, ohne Profilpatch. Die Controls-Testwelt lädt das Persistenzmodul nicht. Im kombinierten gezielten Lauf bestehen Persistenz und Renderer; nur diese beiden Controls-Fälle scheitern (Logs im Hauptcheckout `.tmp/profile-settings-01/`).

Die Tests lesen den alten Modal-Stub `ui.html`. `showResult()` schreibt dagegen direkt nach `document.getElementById('result').innerHTML` (`src/ui/screens.ts:211–231`). Zusätzlich erwartet der erste Test den Armory-Knopf auch bei offenen Vorteilsangeboten, während das aktuelle Markup ihn dort ausblendet. Eine reine Umstellung der abgefragten DOM-Stelle genügt deshalb nicht für die gesamte Vertragsklärung.

## Entscheidung und nächste Prüfung

Mit dem Nutzer bestätigen, ob das aktuelle Verhalten gelten soll: Bei offenen Vorteilsangeboten kein Upgrade-Knopf; danach bzw. bei Niederlage vorhanden. Anschließend die betroffenen Tests auf den vereinbarten Vertrag ausrichten, ohne Behauptungen nur zum Grünmachen zu entfernen. Insbesondere Rückkehr zum selben Ergebnis, unveränderte Spielzustände und einmaligen Ergebnis-Sound weiter prüfen.

Bis zur Klärung keine Änderung an Ergebnis-UI oder bestehenden Tests. Die einmalige abschließende Gesamtsuite steht noch aus; sie folgt nach Integration des geklärten Umfangs beim Hauptagenten. Kein Browser-/Sound-/Darstellungsnachweis durch die Node-Prüfung.
