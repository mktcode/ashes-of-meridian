# Zivilisationsupgrades: Abnahme und Balance

Verbindliche Regeln für feste Dreierangebote, permanentes Aktivieren im Modal, HUD-Ränge und Hilfe im laufenden Gefecht stehen in [Gameplay](../gameplay.md#wirtschaft-bau-und-produktion). Keine Migration alter Upgrade-Saves.

## Technische Restarbeit

- [ ] Optionale Langtest-Fixtures in `tests/ashes-of-meridian-simulation.check.cjs` auf verbliebene Annahmen etablierter Basen, frühere Startversorgung und automatisch minende Worker prüfen. Feste RNG-/Terrainreferenzen nicht zum Grünmachen regenerieren. Ausführung dieser Simulationsblöcke separat freigeben.
- [ ] Breite Integrationsprüfung nach gesonderter Freigabe: bisher nur begrenzte Upgrade-, Persistenz-, HUD- und Weltbesuchsverträge. Das ist keine vollständige Spielabnahme.
- [ ] Langfristige Kosten großer Weltarchive, wiederholter Aggregation und Speicherung gemäß [Performance](performance/README.md#verbleibende-cpu-spitzen) messen. Welt-Save-Ziele gemäß [Spielstandsabnahme](expeditions-spielstand.md) abnehmen.

## Menschliche Abnahme und Balance

- [ ] Drei Angebote nebeneinander auf schmalen/niedrigen Echtgeräten abnehmen: lesbare Namen, Touch-Ziele, keine Überlagerung von Minimap oder Auswahlzeile. Kompakte aktivierte HUD-Ansicht mit Ausbau und i-Button prüfen; Beschreibung und Aktivierung bleiben im pausierten Modal. Kein Screenshotvergleich ersetzt die Abnahme.
- [ ] Modal-Lesbarkeit, Abbrechen ohne Kauf, Aktivieren mit lokalem Echo, Rückkehr zur Auswahl und erneutes Öffnen über i abnehmen. Command-Ausbau beschreibt die individuellen Ränge der vier ausgerüsteten Fähigkeiten.
- [ ] Rettungsfunktion mit echten Runs testen: laufendes Gefecht verlassen, Bauwelt entwickeln, zurückkehren. Sofortige Dauerboni und einmalige Ressourcen-/Workerlieferungen sollen helfen, aber nicht jeden verlorenen Kampf garantieren. Ohne Ankunftsort wartet die Lieferung; Niederlage wird nicht rückgängig gemacht.
- [ ] Stärken der neuen Waffentechnik, Schutzsysteme und Feldmedizin sowie des gemeinsamen Command-Ausbaus abstimmen. Die ersten Werte sind Prototypparameter, keine vollständige Run-Balance.
- [ ] Echo-Kosten, endliche Vents, Rangcaps und feste zufällige Angebote abstimmen. Gebäudeverkauf kann neue Angebote ermöglichen, kostet aber Ausbau und Fläche; keine zusätzliche Reroll-Währung oder Anti-Reroll-Regel ohne Auftrag.
- [ ] Höchststand der bereits gewährten Lieferungen verständlich machen: Verlust und Wiederaufbau von Beitragsgebäuden zahlen dieselben Ränge nicht erneut aus. Gefallene Bonusworker und Commander werden nicht durch einen Weltbesuch ersetzt.
- [ ] Forum-Lieferungen, ausreichend Siedlungsfläche und Wirtschaft nach knappen Siegen mit echten Runs prüfen. Keine automatische Ressourcenrettung, garantierte maximale Gebäudezahl oder Offline-Fortschritt.

KI-Partien, visuelle/akustische und vollständige Echtgeräteabnahme bleiben offen. Diese Liste ist keine Freigabe für autonome Langtests oder weitere Balancekorrekturen.
