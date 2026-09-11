# Schwierigkeitseinstellung entfernt

## Änderung

Keine Auswahl, versteckte Einstellung oder Schwierigkeitsstufen mehr. Entfernt aus `simulation.js`, `ui.js`, `persistence.js` und `app.js`: `DIFFICULTY`, alle zugehörigen Multiplikatoren, `difficultyOptions()`, Gefechtsauswahl, HUD-Bezeichnung, Start-/Neustartoption und Profil-/Gefechtsfeld.

Die bisherigen **Standard-Werte** sind jetzt feste Regeln:

- 1100 Alloy / 400 Aether zu Beginn, zuzüglich unveränderter permanenter Upgrade-Boni.
- Normale gegnerische Hülle und normaler Schaden, auch für Gebäude.
- Erste Angriffswelle nach 95 Sekunden.
- Wellenzielgröße `min(24, ceil(6.75 + wave × 0.65))`, weiterhin durch Budget und Einheitenlimit begrenzt.
- Folgender Wellenabstand `80 × max(0.68, 1 − wave × 0.01)` Sekunden.

Die Wellen werden also weiterhin im Verlauf größer und häufiger. Fraktionsboni/-schilde, Veteranenstatus nach fünf Abschüssen, permanente Upgrades, KI, Startaufgebot und Karten bleiben unverändert. Der Einheiten-Veteranenstatus ist nicht die entfernte Schwierigkeitsstufe „Veteran“. Die HUD-Geschwindigkeitsanzeige bleibt ohne Schwierigkeitszusatz bestehen.

## Speicherung

Aktuelle Checkpoints verwenden **Version 3**, Schlüssel `meridian.operation.v3`. Ältere Checkpoints werden nicht übernommen: Sie könnten bereits mit anderen Hüllenwerten und Wellenparametern erzeugte Entitäten/Zustände enthalten. Keine Migration oder Korrektur alter Spielstände. Backup-Umschlag und Profil bleiben Version 1; enthaltene Operationen müssen Version 3 haben.

Permanente Upgrade-Stufen bleiben erhalten. Beim Lesen der Profileinstellungen werden nur die bekannten Schlüssel `volume`, `music`, `sfx`, `quality`, `healthbars` übernommen. Damit gelangen entfernte oder beliebige unbekannte Einstellungen nicht mehr in das aktive Profil; kein spezieller Legacy-Difficulty-Adapter. Bisherige Wertnormalisierung und sonstige Speicher-/Importabläufe bleiben bestehen.

## Ausgeführt

- Vollständiger [Node-Testbefehl](testing.md): **168 Tests bestanden**. Angepasste Tests für feste Start-/Hüllen-/Schadens-/Wellenwerte, Gefechtswahl/Start/Neustart ohne Schwierigkeit, Profilnormalisierung und aktuelle Checkpoints/Backups. Ältere Versionen werden abgelehnt. Terrain-/Effekt-Fixtures nicht geändert. Log: `/tmp/meridian-difficulty-tests.log`.
- Vorher-/Nachhervergleich der bisherigen Standard-Simulation: Seed 1409, Rust, alle drei eigenen/Gegner-Fraktionen, Upgrades Stores 2 / Logistics 1 / Veterans 1; jeweils 2400 Schritte à 0,05 s inklusive Effekt-Ticks. Nach Entfernen ausschließlich von Schema-Version und altem Schwierigkeitsfeld sind **Snapshot, Effektdaten und fünf anschließende RNG-Samples identisch**. Vorherige Hashes: `/tmp/meridian-standard-baseline.json`; keine neu erzeugten Projekt-Fixtures.
- Chromium 152, direkt **`file://`**, frisches Profil, Headless/CDP-Touch, Performance, keine abgeschwächten Sicherheitsflags: Gefechtswahl ohne Dropdown/Optionsmethode, Start ohne Profil-/Simulationsfeld, HUD ohne Schwierigkeitstext; alle 18 Gratis-Upgrades, Bau-Cancel, Arbeiter-Reparaturauftrag/×, Produktionsqueue, Version-3-Save/Load, Verkauf/Erstattung, Sieg, Neustart, Niederlage und Checkpoint-Retry bestanden.
- Hauptablauf 960×600; Gefechtsstart/Home zusätzlich 844×390 und 390×844. Setup-Screenshot betrachtet. Keine erfassten Laufzeit-/Ressourcen-/Log-Fehler, abschließend `gl.getError() === 0`. Temporäre Probe `/tmp/meridian-no-difficulty-check.cjs`, Log `/tmp/meridian-no-difficulty-browser.log`.
- `git diff --check` bestanden.

Nicht geprüft: echte Mobilgeräte, andere Browser, High/Balanced, lange erspielte Gefechte/Balancing, Hör-/Screenreaderprüfung oder nativer Backup-Import/Export. Browserprobe mit kontrolliertem Setup, pausierter Simulation und direktem HQ-Schaden für Ergebnisprüfungen; Select-Werte und Scrollpositionen teilweise per DOM gesetzt. Dreifachtap und vollständiger Reparaturanlauf/Randpositionen nicht erneut im Browser geprüft; deren Node-Tests bestehen, frühere Browsernachweise bleiben historisch.
