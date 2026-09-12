# Arbeitsprotokoll

Kompakter Übergabestand und letzte Prüfnachweise. Ältere Implementierungs-, Diagnose- und Refactoringprotokolle liegen in Git. Neue Einträge kurz halten; Regeln und offene Prioritäten direkt in den Referenzdokumenten pflegen.

## Eine zusätzliche Nahzoomstufe

- Untere Kameragrenze für Plus-Button und Pinch von 32 auf 27,2 gesenkt: eine weitere Stufe mit Faktor 0,85, rund 18 % größere Darstellung. Herauszoomgrenze 115 und Schrittweiten unverändert; bestehende Grenzwert-Erwartungen und Bedienreferenz nachgeführt.
- Auf Wunsch kein Test- oder Browserlauf; Build und `git diff --check` erfolgreich. Die neuen Test-Erwartungen wurden nicht ausgeführt.

## Detaillierte Free-Marches-Worker

- Prospector als kleines Kettenfahrzeug beibehalten: abgeschrägtes Gehäuse/Sensorkopf, Kühler, sechs Laufrollen, 48 einzelne Kettenglieder, Scheinwerfer, Signallichtfassung und geriffelter Bohrkopf. Zwei einmalig hochgeladene Meshes mit 1.452/120 Dreiecken; keine neuen Assets/Shader, RNG-Aufrufe oder Bewegungsanimationen. Spielgröße, Tempo, Sammel-/Bauregeln und bestehende Frachtanzeige unverändert.
- **Neu: `npm test` einschließlich Build, 242/242 bestanden** (rund 60 s). Deterministische Meshgrenzen/Normalen, nicht degenerierte Flächen, Wiederverwendung ohne Frame-Erzeugung, Ausrichtung, Fracht-, Team-/Vorschaufarben und unveränderte Entitäten abgesichert. Bestehende Fixtures unverändert; 94 unbetroffene Modell-/Teamvarianten lieferten identische Zeichenaufrufe zum Vorgänger. Diff und lokale Dokumentationslinks geprüft.
- **Chromium `file://`:** 1280×800 und 390×844, Nah-/Spielansicht, alle Qualitätsstufen sowie kontrollierte Front-/Fracht-/Gegner-/Vorschauvarianten gesichtet. Regulär rekrutierter Worker sammelte und lieferte in 45 s kontrollierter Simulation 90 Alloy. GL 0, keine Console-/Laufzeitfehler. Software-WebGL, kein Echtgeräte-, Massenworker-Leistungs- oder neuer Bauablaufnachweis.

## Free-Marches-HQ verfeinert

- Vorlagennahe Detailüberarbeitung ohne neue Grundsilhouette: abgeschrägte Rumpf-/Dachplatten, kräftigere Seitenrippen und Eingangspfeiler, Trittstufe, Türfuge, Dachmarkierungen, Lüftungsgitter und zwei zusätzliche Antennen. Ein gemeinsames `commandHull`-Metallmesh mit 1.152 Dreiecken; Fundament, Radarrotation, Bau-/Teamdarstellung und sämtliche Spielregeln/Radien unverändert. Keine neuen Assets, Shader oder RNG-Aufrufe.
- **Neu: `npm test` einschließlich Build, 240/240 bestanden** (rund 60 s). Meshgrenzen, geschlossene konvexe Panzerteile/Normalen, Fraktionsbegrenzung, Baufortschritt, Vorschaufarbe/-transparenz und Zeichenisolation ergänzt. Bestehende Fixtures unverändert; zusätzlicher Vorher-/Nachher-Vergleich von 94 unbetroffenen Modell-/Teamvarianten lieferte identische Zeichenaufrufe. Diff und lokale Dokumentationslinks geprüft.
- **Chromium `file://`:** 1280×800 und 390×844, Nah-/Spielansicht und alle drei Qualitätsstufen gesichtet; zusätzlich kontrollierte Zeichenvarianten für Baustelle, Gegnerausrichtung und transparente Vorschau. GL 0, keine Console-/Laufzeitfehler. Software-WebGL, kein Echtgeräte-/Leistungs- oder neuer vollständiger Bauablaufnachweis.

## Detaillierter Aether Vent

- Bildvorlage als flache industrielle Panzerplattform umgesetzt: abgeschrägte achteckige Deckplatten, 16 Sockelsegmente, vier Halteklammern, Kristallfassung, zwei cyanfarbene Leuchtringe und rotierender Kristall mit sichtbaren Lichtfacetten. Ein gemeinsames Metallmesh mit 1.152 Dreiecken statt pro Frame zusammengesetzter Detailteile; keine neuen Texturen/Shader. Dampfeffekte, Ressourcenwerte/-positionen, Kollisionsradien, Raffinerieregeln und RNG bleiben unverändert.
- **Neu: `npm test` einschließlich Build, 238/238 bestanden** (rund 60 s). Ergänzte Tests sichern Meshgrenzen, nicht degenerierte Flächen/Normalen, Material-/Animationszeichnung und unveränderte Ressourcen/Dampfeffekte; bestehende Layout-/Navigations-/RNG-Fixtures unverändert bestanden. Diff und lokale Dokumentationslinks geprüft.
- **Chromium `file://`:** Nahansicht und normale Spielentfernung bei 1280×800 und 390×844 gesichtet, alle drei Qualitätsstufen geprüft; GL 0, keine Console-/Laufzeitfehler. Software-WebGL, kein Echtgeräte-/Leistungsnachweis.

## Englische HUD-Kategorien

- Verbliebene deutsche Laufzeittexte vereinheitlicht: **Buildings**, **Infantry**, **Vehicles**, **Aircraft** und **Back** erscheinen nun in Kategorien, Untermenüs, Startmeldung und Feldhandbuch. Dokumentierte UI-Bezeichnungen entsprechend aktualisiert; die deutschsprachige Projektdokumentation bleibt deutsch.
- Auf ausdrücklichen Wunsch keine Tests und kein Browserlauf. `git diff --check`, lokale Markdown-Links und Quellsuche nach den ersetzten deutschen Laufzeitbegriffen geprüft.

## Startmenü freigestellt und neu angeordnet

- **Fleet upgrades** aus der kleinen Unternavigation als zweite große, sekundäre Startaktion direkt unter **New battle** angeordnet; darunter verbleiben nur **Field Manual** und **Settings**. Der Titelblock steht oben, der Aktionsblock unten; beide liegen ohne eigenen Panelhintergrund, Außenrahmen oder Box-Shadow direkt über der Weltvorschau. Die Eyebrow und Zierlinien entfallen, **ASHES OF** steht in einer Zeile über **MERIDIAN**, die Tagline lautet **A roguelite RTS.**
- Für Fenster bis 500 px Höhe verdichtet eine reine CSS-Variante Titel, Abstände und Schaltflächen und blendet den nicht interaktiven Fuß aus; dadurch bleiben alle vier Aktionen auch bei 932×430 ohne Scrollen sichtbar.
- **Neu: `npm test` einschließlich Build, 237/237 bestanden** (rund 60 s). **Chromium `file://`:** 375×667, 390×844, 1280×800 und 932×430 geprüft; Aktionsreihenfolge korrekt, Panelstil rechnerisch `background: none`, Rahmen 0 und Schatten `none`, keine Überlappungen oder unerwarteten Scrollbereiche, GL 0, keine Console-/Laufzeitfehler. Kein Echtgerätetest.

## Permanentes Start-Alloy

- Neues erstes Fleet-Upgrade `startingAlloy`: Stufen 0–5 starten mit 250 / 300 / 350 / 400 / 450 / 500 Alloy; Einzelkosten 100 / 200 / 300 / 450 / 650 Aether. Start-Aether bleibt 0. Der beim Gefechtsstart normalisierte Profilwert wird in `game.s.meta` eingefroren, verbraucht keinen RNG und wirkt deshalb weder rückwirkend auf laufende Runs noch auf deren Layout.
- Waffenkammer-Reihenfolge, Gefechtsnotiz, Feldhandbuch, README, Gameplay und Architektur aktualisiert. Persistenz verwirft unbekannte Schlüssel weiterhin und begrenzt auch `startingAlloy` auf ganzzahlige Stufen 0–5.
- **Neu: `npm test` einschließlich Build, 237/237 bestanden** (rund 67 s). **Chromium `file://`, 430×932:** Upgrade als erste Karte mit Einstiegspreis 100 Aether gesichtet; Stufe 1 startete mit 300 Alloy, Kauf von Stufe 2 ließ den aktiven Run bei 300 und Neustart setzte 350; Profil-Reload zeigte weiterhin Stufe 2/350, GL 0, keine Console-/Laufzeitfehler. Kein vollständiger manuell gespielter Sieg oder Echtgerätetest.

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
