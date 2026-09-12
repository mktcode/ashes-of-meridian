# Arbeitsprotokoll

Kompakter Übergabestand und letzte Prüfnachweise. Ältere Implementierungs-, Diagnose- und Refactoringprotokolle liegen in Git. Neue Einträge kurz halten; Regeln und offene Prioritäten direkt in den Referenzdokumenten pflegen.

## Sequenzielle Fraktionsfreischaltung

- Fortschritt von einem gemeinsamen Boolean auf `factionUnlockLevel` (0–2) umgestellt: Free-Marches-Sieg öffnet nur Verdant Choir, erst ein Choir-Sieg die Veiled Court. Ergebnis meldet jeweils genau die neu geöffnete Fraktion. Gesperrte Karten und manipulierte Startauswahl bleiben abgesichert; falsche, verlorene und wiederholte Siege überspringen keine Stufe und speichern nicht erneut.
- Profil bleibt unter `meridian.profile.v1`; das alte Feld `factionsUnlocked` wird gemäß Prototypregel nicht migriert und als unbekannt verworfen, andere gültige Profilwerte bleiben beim Laden erhalten. README, Gameplay und Architektur aktualisiert.
- **Neu: `npm test` einschließlich Build, 235/235 bestanden** (rund 65 s). **Chromium `file://`, 430×932:** initial 1/3, nach erstem Sieg 2/3 und nach zweitem Sieg sowie Reload 3/3 Fraktionen aktiv; beide Ergebnisnachrichten gesichtet, GL 0, keine Console-/Laufzeitfehler. Kein vollständiger manuell gespielter Sieg oder Echtgerätetest.

## Außenring detailliert

- Gesamter Gebirgsstand samt Testbereinigung und Android-Vorüberlegung nach Nutzerfreigabe gemeinsam zum Commit abgeschlossen. Abschließend nur Dokumentationsstatus und Diff geprüft; die folgenden Spiel-/Browsernachweise stammen aus dem unmittelbar vorherigen Prüflauf.
- Nur die äußere Mapbegrenzung verfeinert: 36.480 statt 640 Dreiecke, breite unregelmäßige Gipfel, Schultern, Rinnen, raue Hänge und eingebettetes Geröll. Dasselbe streifenfreie Material wie die Innenmassive; weiterhin ein Mesh/eine statische Charge je aktivem Pass. Fuß und Außengrenze bleiben bei ±87/±123. Innenmassive und deren Geometrie unverändert.
- **Neu: `npm test` einschließlich Build, 235/235 bestanden**, reine Testlaufzeit rund 63 s. Erweiterter Ringtest prüft auch vollständige Dreiecke an Ecken/Geröll, Nahtschluss und Polygonbudget. Abgleich aller 16 CPU-Welten: ausschließlich Ring-Materialkennung geändert, dafür gezielt 16 Platzierungsdigests angepasst; Navigation, Terrain, übrige Platzierungen und Massiv-Deskriptoren gleich. Lokale Math-Bindung reduziert VM-Mehrkosten bei identischen Meshdaten. Diff und lokale Dokumentationslinks geprüft.
- **Neu: Chromium `file://`, Rust/43015**, 430×932 und 1280×1000: Vorschau, Start, alle Randseiten, Übersicht und Nahansichten, Portrait-Ring in High/Performance; GL 0, keine Console-/Laufzeitfehler. Übersicht zusätzlich mit diagnostischer Kamera/Aufklärung. Einzelmessung der Ring-Erzeugung im lokalen Browser rund 100 ms; kein Echtgeräte-/GPU-Leistungsnachweis. Größeres Polygonbudget und Sichtverdeckung bleiben relevante Grenzen.

## Android-/Werbeoption festgehalten

- `docs/android.md` dokumentiert Capacitor/AdMob als zurückgestellte Option, Geräteprüfungen, Datenschutz und den groben Play-Ablauf; aus der Architektur verlinkt. Zuerst weitere Spielarbeit, keine Implementierung oder Monetarisierungsentscheidung.
- Nur Dokumentation: Diff und lokale Links geprüft, keine erneuten Spiel-/Browsertests. Aktuelle Store-/SDK-Vorgaben sind bei Umsetzung nachzuschlagen.

## Breite Gebirge und gezielte Testbereinigung

- Gebirgsstand abgeschlossen: geschlossener Außenring (640 Dreiecke, Gipfel bis 50 m), höhere kleine Innenfelsen und höchstens zwei breite Gebirgszüge statt der verworfenen Felsnadel. Je Massiv 11.712 Dreiecke mit verbundenen Gipfeln, Rinnen, rauen Hängen und Geröll; eigenes streifenfreies Felsmaterial aus bestehenden Texturen. CPU-Umrisse blockieren tatsächlich und erscheinen auf der Minimap. Basis-/Ressourcenabstände und verbundene Zugänge geprüft, keine Änderungen an Rohstoffmengen oder Simulations-RNG.
- Die breiten Massive dürfen Laufwege bewusst ändern. Vorher/Nachher-Abgleich aller 16 Referenzwelten bestätigt: alte kleine Felsblocker, Terrainfarben und übrige Platzierungen unverändert, zusätzliche Sperrzellen ausschließlich aus `massifGrid`. Entsprechende Platzierungs-/Deskriptor- und Navigationshashes angepasst; ursprüngliche Kleinblocker-Hashes und aktive Terrain-/Effekt-/RNG-Referenzen erhalten.
- **Neu: Chromium `file://`, Rust/43015**, 430×932 und 1280×1000: Start/Vorschau, Gesamtübersicht und Massiv-Nahansicht, High/Performance sowie Minimap gesichtet; GL 0, keine Console-/Laufzeitfehler. Gesamtübersicht diagnostisch aufgeklärt und mit weiterer Kamera, normale Kamera separat geprüft. Sichtverdeckung bleibt beabsichtigte offene Grenze; kein Echtgeräte-/Langzeitnachweis.
- Anschließend nur Tests/Dokumentation bereinigt, keine weitere Spielcode- oder Grafikänderung: CPU-Simulation ohne Renderer/Mesh-Erzeugung; Worker-Matrix von 105 auf 21 Starts reduziert (alle Stufen für jede Fraktion), Biomabdeckung separat mit fünf statt 15 Kombinationen. Terrainprüfungen ohne redundanten GPU-Adapter; vollständiger Raster-/Umrissabgleich einmal statt 16-mal. Alle 16 festen Layout-/Navigationsreferenzen, Zugangsprüfungen, echte Umwege und durchgehende Simulationsszenarien bleiben. Fog-Uploadvertrag gezielt im View-Test statt in Simulationstests.
- **Neu: `npm test` inklusive Build, 235/235 bestanden.** Reine Testlaufzeit gegenüber dem vollständigen Gebirgsstand von rund 151 auf 50 s reduziert (etwa 67 %). Keine erhöhten Zeitlimits im Projekt, keine übersprungenen Tests, keine Fixtureänderung durch die Bereinigung. Spielcode-/Fixture-Prüfsummen, Diff und lokale Dokumentationslinks geprüft. Der Versuch blieb bis zur abschließenden Nutzerfreigabe uncommittet.

## Dokumentations- und Testbereinigung

- AGENTS.md als Wegweiser mit Lesereihenfolge, Quellen/Befehlen, Schutzregeln und pausiertem Refactoring neu gefasst. README gekürzt; Gameplay-/Architektur-/Grafikreferenzen auf aktuellen HUD-, Menü- und Aether-Stand gebracht. Validierungsprioritäten statt veralteter Featurewünsche dokumentiert. Doppelte allgemeine Wegfindungsrecherche gelöscht, ausführliche Arbeitshistorie durch diesen Übergabestand ersetzt.
- Tests gezielt entschlackt: drei redundante bzw. reine Altfunktionsfälle entfernt (alte Startboni, separate Kontrollgruppen-Tastenprüfung, Kampagnen-API-Abwesenheit mit bereits abgedecktem Neustart). Starre Prototyp-Methodenzahlen durch relevante API-Prüfungen ersetzt bzw. gestrichen. Ungültige Bau-/Rekrutierungseingaben und aktuelle Grundraten weiterhin geprüft, ohne historische Typ-/Upgrade-Namen als Vertrag. Ungenutzte Effektfall-Liste und übersprungenen Boss-Waffen-Fixture-Eintrag entfernt; alle aktiven Referenzwerte unverändert.
- **Neu ausgeführt: `npm test`, 231/231 bestanden**, inklusive Build (rund 38 s). Diff, lokale Markdown-Links und gezielter Fixture-Vergleich geprüft. Kein Browserlauf: keine Spielcode-, Eingabe-, Layout-, Rendering- oder Auslieferungsänderung.

## Vorhandener, nicht erneut erhobener Nachweis

- `688b4bf`: Menügestaltung, damals 234 Tests und Chromium `file://` bei 390×844, 1280×800, 932×430 und 320×740; unter anderem Menüwechsel, Settings-Checkbox, Scrollen, Pause/Bestätigung und Ergebnis → Upgrades → Ergebnis.
- `2a2a08d`: kompaktes Dreier-HUD, damals 234 Tests und `file://` in fünf Fenstergrößen, einschließlich DPR 2; Touch für Kategorien, Workerrekrutierung/Queue-Abbruch, Rally/Scan, Tempo/Attack-move sowie Kamera- und Pausebedienung.
- Diese Nachweise stammen aus Headless-Chromium, nicht von echten Mobilgeräten. Sie belegen weder Langzeitbalancing noch GPU-Speicherbedarf, Akkulast, Tap-Timing unter Last oder allgemeine Crowd-Stabilität.

## Übergabe

Core Loop und Aether-Progression sind implementiert. Als Nächstes echte Mobilgeräte, vollständige Runs und Upgradeökonomie validieren; konkrete Reihenfolge und Grenzen unter [Gameplay](gameplay.md#nächste-schritte-und-grenzen). Breites Refactoring und weitere TypeScript-Migration bleiben pausiert. Keine neuen Systeme oder Balancingänderungen pauschal freigegeben.
