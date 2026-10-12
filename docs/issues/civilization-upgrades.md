# Zivilisationsupgrades: Abnahme und Balance

Verbindliche Regeln für feste Dreierangebote, permanentes Aktivieren im Modal, HUD-Ränge und Hilfe im laufenden Gefecht stehen in [Gameplay](../gameplay.md#wirtschaft-bau-und-produktion). Keine Migration alter Upgrade-Saves.

Alle zwölf eigenen Gebäudestile mit jeweils drei Ausbaustufen sind integriert; verbleibende Darstellung-/Kostenabnahme im [Modell-Issue](civilization-upgrade-models.md).

## Technische Restarbeit

Verbliebene Langtest-Fixtures zentral unter [Testpflege](teststrategie-review.md#vorrang-fachlich-veraltete-startannahmen), Welt-Save-Ziele unter [Spielstandsabnahme](expeditions-spielstand.md) und Archiv-/Aggregationskosten unter [Performance](performance/README.md#verbleibende-cpu-spitzen). Keine zusätzlichen Prüfrunden aus dieser Liste.

- [ ] Breite Integrationsprüfung nach gesonderter Freigabe: bisher nur begrenzte Upgrade-, Persistenz-, HUD- und Weltbesuchsverträge. Das ist keine vollständige Spielabnahme.

## Menschliche Abnahme und Balance

- [ ] [Außenposten-Wellen und Evakuierung](../gameplay.md#außenposten-verteidigung-und-evakuierung) mit echten Runs abstimmen: Vorwarnzeit, Druckanstieg, endliche Vorräte und Rettungsfenster. Command-Center-Button, Dreierauswahl, Countdown und subtilen gelben Puls auf schmalen/niedrigen Echtgeräten sowie bei reduzierter Bewegung abnehmen. Armeewege zum HQ, HQ-Verlust während Rettung, blockierte Ankunft und Rückkehr ins laufende höchste Gefecht prüfen; technische lokale Verträge sind keine Run-/Balanceabnahme.

- [ ] Drei Angebote nebeneinander auf schmalen/niedrigen Echtgeräten abnehmen: lesbare Namen, Touch-Ziele, keine Überlagerung von Minimap oder Auswahlzeile. Kompakte aktivierte HUD-Ansicht mit Ausbau und i-Button prüfen; Beschreibung und Aktivierung bleiben im pausierten Modal. Kein Screenshotvergleich ersetzt die Abnahme.
- [ ] Modal-Lesbarkeit, Abbrechen ohne Kauf, Aktivieren mit lokalem Echo, Rückkehr zur Auswahl und erneutes Öffnen über i abnehmen. Command-Ausbau beschreibt die individuellen Ränge der vier ausgerüsteten Fähigkeiten.
- [ ] Rettungsfunktion mit echten Runs testen: laufendes Gefecht verlassen, Bauwelt entwickeln, zurückkehren. Sofortige Dauerboni und einmalige Ressourcen-/Workerlieferungen sollen helfen, aber nicht jeden verlorenen Kampf garantieren. Ohne Ankunftsort wartet die Lieferung; Niederlage wird nicht rückgängig gemacht.
- [ ] Stärken der neuen Waffentechnik, Schutzsysteme und Feldmedizin sowie des gemeinsamen Command-Ausbaus abstimmen. Die ersten Werte sind Prototypparameter, keine vollständige Run-Balance.
- [ ] Echo-Kosten, endliche Vents, Rangcaps und feste zufällige Angebote abstimmen. Gebäudeverkauf kann neue Angebote ermöglichen, kostet aber Ausbau und Fläche; keine zusätzliche Reroll-Währung oder Anti-Reroll-Regel ohne Auftrag.
- [ ] Höchststand der bereits gewährten Lieferungen verständlich machen: Verlust und Wiederaufbau von Beitragsgebäuden zahlen dieselben Ränge nicht erneut aus. Gefallene Bonusworker und Commander werden nicht durch einen Weltbesuch ersetzt.
- [ ] Forum-Lieferungen, ausreichend Siedlungsfläche und Wirtschaft nach knappen Siegen mit echten Runs prüfen. Keine automatische Ressourcenrettung, garantierte maximale Gebäudezahl oder Offline-Fortschritt.

KI-Partien, visuelle/akustische und vollständige Echtgeräteabnahme bleiben offen. Diese Liste ist keine Freigabe für autonome Langtests oder weitere Balancekorrekturen.
