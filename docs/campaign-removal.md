# Kampagne entfernen, Gefechte und kostenlose Test-Upgrades

## Umgesetzt

- Kampagnendaten/Acts, Missionsauswahl, Briefings, Story-Funk, Ausgänge/Endenwahl, Tutorial-Tipps, Medaillen/Sterne, Missionsfreischaltung, Bestleistungen und Commendation-Credits entfernt. Kein versteckter Kampagnenpfad oder Ersatz-Missionskatalog.
- Alternative Modi einschließlich Endloskrieg/Extraktion, Überleben, Eskorte und Gebietskontrolle entfernt. **New battle** bietet nur Fraktion, Gegner, Biom, Schwierigkeit und Seed; diese Optionen sind Testvarianten desselben Gefechtsziels.
- **Sieg:** gegnerisches HQ zerstört. Andere gegnerische Gebäude/Truppen müssen nicht vernichtet werden. **Niederlage:** kein eigenes lebendes HQ mehr. Kommandantenverlust beendet das Gefecht nicht. Wenn beide Seiten gleichzeitig ihr letztes HQ verlieren, hat Niederlage Vorrang.
- Entfernte Sonderobjekte/Modelle: Konvois, Starbound Avatar, Schutzgeneratoren (`ward`), Relais/Anker und Caches/Erinnerungsfragmente. Entfernt sind auch Erzeugen, Abholung/Einnahme, Eskorte/Evakuierung, Eskorte-Wege, Eskorte-/Kontroll-/Zeitziele, Generator-/Boss-Unverwundbarkeit, Avatar-Waffe, Spezial-HUD/Minimap-Markierungen und Einnahmegeräusch.
- Das nur für Missionsverbündete verwendete **Team 2** samt Allianzsicht/-darstellung/-Zielbehandlung entfällt. Das ist nicht Fraktion 2: **alle drei Fraktionen bleiben**. Normale Einheiten, Gebäude, Fraktionsboni/-schilde, Landschaft, Ressourcen, Kampf, Gegnerproduktion und Angriffswellen bleiben erhalten. Auch die bisherige biomabhängige Sterneneruption bleibt eine Umgebungsregel, kein Sonderziel.
- Ergebnis zeigt Statistik/Score, erneutes Gefecht, Hauptmenü und Upgrades, aber keine Fortschrittsbelohnung. Score ist keine Währung. Neustart verwendet dieselben Gefechtsoptionen und die dann aktuellen permanenten Upgrades.

## Provisorisches Testgefecht, kein fertiges Roguelite-Balancing

`MeridianGame.start(opts = {})` ersetzt den Start per Missionsindex. Standardmäßig: eigene Fraktion 0, Gegner 2, Ash-Biom, Standard-Schwierigkeit und zufälliger Seed.

Das bisherige Vollarsenal-Aufgebot dient als Testbasis: HQ, Kaserne, Raffinerie, Fabrik, zwei Depots; Kommandant, fünf Arbeiter, sieben Infanteristen, zwei Sanitäter, zwei Panzer und Scout. Startressourcen: 1100 Alloy / 400 Aether vor Schwierigkeits- und Upgrade-Boni. Sieben normale Gebäude und acht Einheitentypen sind verfügbar, ohne Missionstier-Sperren; bestehende Produktions-/Bauvoraussetzungen bleiben bestehen.

Eine Gegnerbasis am bisherigen ersten Standort: HQ, zwei Türme, Kaserne, Fabrik, fünf Infanteristen, Artillerie und Panzer. Die normalen Angriffe gehen von diesem HQ aus; die bisherige Vollarsenal-Wellenformel ersetzt Missionstier-Skalierung. Kein neues KI-/Balancing-System und noch keine absichtlich nahezu unbesiegbare Basis. Weniger Gegnerbasen und das einheitliche Aufgebot sind bewusste Folgen des neuen Gefechtsaufbaus, kein verhaltensneutrales Refactoring.

## Unbegrenzte Upgrade-Ressourcen zum Testen

**Fleet Upgrades** zeigt ausdrücklich `∞ UPGRADE RESOURCES / TEST MODE`. Die sechs vorhandenen Upgrades kosten nichts; beliebig viele Käufe bis zum unveränderten Maximum **Stufe 3** sind möglich. Kostenfelder und Credit-Abbuchung sind entfernt, nicht durch `Infinity` im JSON-Profil ersetzt. Stufen werden dauerhaft gespeichert und in jedes **neue** Gefecht als `game.s.meta` kopiert; ein laufendes oder geladenes Gefecht wird nicht nachträglich aufgewertet.

- Veterans: zusätzliche Infanterie.
- Stores: zusätzliches Start-Alloy.
- Logistics: zusätzliche Arbeiter.
- Command: schnellere Energieregeneration.
- Resolve: zusätzliche Kommandantenhülle.
- Industry: schnellere Rekrutierung.

Alloy und Aether im Gefecht bleiben normale, begrenzte Ressourcen. Es gibt noch **keine neue Fortschrittsressource, Sammel-/Auszahlungslogik, Gebäude-Freischaltungen oder Übertragung der gelöschten Forschungsboni**. Diese folgen separat; der Gratis-Testmodus ersetzt sie nicht dauerhaft.

## Speicherung und Quellen

Gefechtszustand **Version 2** enthält flache Optionen statt `m`, Missionsindex oder Practice-Modus. Nur `unit`, `building` und `resource` sind gültige Entitätsarten; entfernte Typen und das Allianzteam werden beim Restore abgelehnt. Checkpoints liegen unter `meridian.operation.v2`. Alte Kampagnen-/Skirmish-Checkpoints werden weder gelesen noch migriert; Backups mit Operation Version 1 werden abgelehnt.

Das Profil bleibt unter `meridian.profile.v1` mit Einstellungen und permanenten Upgrade-Stufen, aber ohne Kampagnenfortschritt/Credits. Bestehende Upgrade-Stufen werden wie bisher geladen. Der Backup-Umschlag behält Version 1, seine enthaltene Operation muss Version 2 haben. Speicherersatz und bisherige nicht transaktionale Importabläufe bleiben unverändert.

Betroffen: `content.js`, `simulation.js`, `world.js`, `world-view.js`, `effects.js`, `audio.js`, `ui.js`, `persistence.js`, `app.js`, `index.html`, `styles.css` und passende Tests. Keine Bilddateien gelöscht oder neu kodiert, keine Abhängigkeit/Serverpflicht eingeführt.

Die früher nach Sonderzielen benannten Gelände-Freiräume und Korridore heißen jetzt neutral `CENTRAL_CLEARINGS`, `OUTER_CLEARINGS`, `TERRAIN_CORRIDORS`. Ihre Koordinaten, Hindernisradien und Terrain-RNG-Reihenfolge bleiben unverändert: Sie gehören zum geschützten Kartenlayout, nicht mehr zu Missionsobjekten. Ein bereits vorhandenes reserviertes Spawn-RNG-Sample bleibt für Kristallmengen erhalten. Entfernte Entitäten und der neue Gefechtsaufbau ändern IDs und den späteren Simulationsverlauf absichtlich. Keine alten Gesamtstart-/Missions-RNG-Verträge behauptet.

## Ausgeführt

- Vollständiger [Node-Testbefehl](testing.md#automatisierte-tests): **163 bestanden**, keine Fehler/übersprungenen Tests. Log: `/tmp/meridian-campaign-tests.log`.
- Alle festen Terrain-/Welt-/Effekt-Zeichen-Fixtures unverändert. Die 16 alten Terrain-Seed-/Biom-Paare sind nun unabhängige Testeingaben. Fünf verbleibende Effektfälle behalten ihre ursprünglichen Hashes/Folge-RNG-Samples über einen expliziten Test-Einstieg. Nur der kombinierte Waffenfall mit entferntem Avatar ist außer Betrieb; normale Waffen werden separat geprüft. Keine Sollwerte neu erzeugt. [Referenzabgrenzung](reference-tests.md).
- Neue/angepasste Tests: einheitlicher Start, alle Fraktionen/Biome, HQ-Sieg/Niederlage, reguläre Wellen, keine Missionszustände/Typen, alle kostenlosen Upgrade-Stufen/Maximalgrenzen/Speicherung ohne laufende Gefechtsmutation, Neustartoptionen, aktueller Checkpoint sowie Ablehnung alter Versionen/entfernter Entitäten. Bestehende Touch-, Bau-, Reparatur-, Verkaufs-, Queue- und Speichertests bestanden.
- Chromium 152.0.7977.75, frisches Profil, direkt **`file://`**, Headless/CDP-Touch, Performance, keine abgeschwächten Sicherheitsflags: Hauptmenü ohne Kampagnen-/Moduspfade, alle **18 Upgrade-Käufe per Touch**, Maximalstufen, Profilpersistenz, Gefechtswahl/Start, ein HQ-Ziel, sieben Bauaktionen/Cancel, Arbeiter-Reparaturauftrag und × ohne Reparaturabbruch, zwei Rekrutierungen, aktuelles Save/Load, bestätigter Verkauf/Erstattung, Sieg ohne Sterne/Währungsgewinn, Neustart mit gleichen Optionen, Niederlage und Checkpoint-Retry bestanden.
- Gefechtsstart und Rückkehr zum Hauptmenü zusätzlich bei **844×390** und **390×844**; Hauptablauf **960×600**. Screenshots von Home, Gratis-Upgrades, Setup, Portrait-HUD und Sieg betrachtet. Keine erfassten Laufzeit-/Ressourcen-/Log-Fehler; abschließend `gl.getError() === 0`.
- Temporäre Browserprobe: `/tmp/meridian-campaign-check.cjs`, Log `/tmp/meridian-campaign-browser.log`, Bilder `/tmp/buildings-{campaign-removed-home,free-upgrades,battle-setup,battle-390,single-goal-victory}.png`. Keine erforderlichen Projektwerkzeuge.
- `git diff --check` bestanden.

## Grenzen / noch offen

Der Browserablauf verwendet kontrollierte Kamera/Auswahl, pausierte Simulationsgeschwindigkeit und direkten HQ-Schaden für Ergebnisprüfungen. Select-Werte werden per DOM gesetzt; lange Modal-/Menübereiche per `scrollIntoView` erreicht. Dies sind Testhilfen, kein Nachweis nativer Dropdown-/Scroll-Bedienung oder erspielter Siege. Der neue Browserlauf prüft Reparaturauftrag/-Persistenz, nicht nochmals den vollständigen Anmarsch-/Heilablauf oder alle Panel-Ränder; diese haben frühere eigene Nachweise.

Keine echten Mobilgeräte, anderen Browser, High/Balanced, langen Gefechte, systematischen Performance-/Balancingtests, Screenreader-/Hörtests oder nativen Backup-Import/Export geprüft. Frühere Berichte zu Belagerungen oder Kampagnennavigation sind historisch, keine aktuellen Prüfschritte. Touch-Kamera, Auswahl und Doppeltippen bleiben erhalten; die frühere High-Doppeltipp-Zeitgrenze und kleine bestehende HUD-Buttons sind nicht behoben. Einheitenreparatur per Touch/Rechtsklick-Entfernung und weitere Mobile-HUD-Arbeiten bleiben separat offen.
