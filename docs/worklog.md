# Arbeitsprotokoll

Kompakter Übergabestand und letzte relevante Nachweise. Regeln und aktuelles Verhalten stehen in den Fachreferenzen; abgeschlossene Zwischenschritte, alte Messreihen und frühere Testzahlen bleiben in Git.

## Aktueller Übergabestand

- Der Core Loop aus Basisbau, Gefecht, Aether-Evakuierung, permanenten Upgrades und neuem Gefecht ist implementiert. Nur das Profil bleibt gespeichert; Runs sind flüchtig.
- Der Gegner ist ein deterministischer regelbasierter zweiter Akteur mit eigenem Konto, eigener Sicht und kopiertem Last-Seen-Gedächtnis. Er baut, sammelt, produziert, repariert, nutzt Fähigkeiten und greift ohne Wellen, Ressourcenboni oder versteckte Zustandsabfragen an. Spieler-Upgrades werden nicht gespiegelt.
- Teamfähige Konten, Aktionen, Sicht und Fähigkeiten bilden Architekturvorarbeit, aber kein Netzwerk-, Replay-, Lockstep- oder Rollbacksystem. Autonome Befehle verwenden dieselbe Validierung und Formation wie Spielerbefehle, erzeugen jedoch keine lokalen Eingabemarker oder Sounds.
- Alle 21 Gebäude und alle sieben Einheiten der Fraktion 0 besitzen einzeln registrierte prozedurale Modelle; deren 14 Aktionsporträts sind lokale WebPs. Kataloge, Modellverträge und aktuelle Budgets stehen in [Grafik und Assets](rendering.md).
- Die direkte `file://`-Auslieferung bleibt das Hauptziel. Das statische Dockerimage und die öffentliche Testinstanz benötigen weder Backend noch Laufzeitimporte; Profile bleiben pro Browser-Origin lokal.

## Letzte abgeschlossene Änderungen

- Alien-Nachverdichtung: Hainbreite und -tiefe jeweils +20 % (rund +44 % Fläche), dazu proportional mehr Pilzkronen und Unterwuchs. Bis zu 56 einzelne Jungpilze mit Begleitfarnen säumen den inneren Kartenrand; ihre kleinen Stämme blockieren tatsächlich. Eigener Rand-RNG, geschützte Flanken-/Ressourcenabstände, kein Eingriff in Desert/Mothership oder gemeinsame Renderer-/Spielregeln.
- Alien Planet gestaltet und auf 270 × 270 m aktiviert (+125 % Fläche): diagonale Hauptfront, zwei Flanken, acht Ressourcenbereiche, zwei wirklich blockierende Pilz-/Wurzelhaine, kleine Kolonien, Farne/Sporen und äußerer Vegetationsgürtel. Eigene gebackene Terrain-Fabriken und private Zufallsströme; keine neuen Simulationsregeln oder Frame-Effekte. Details in der Grafikreferenz.
- Die vorgegebene Alien-Bodentextur wird gespiegelt wiederholt. Die bewusst umbenannten Floor-Dateien sind bytegleich zu den vorherigen `metal`-/`bio`-Quellen; Einbettung und Tests sind synchronisiert. Nur die neue Materialkennung `ALIEN` ergänzt das generierte Assetskript. Desert/Mothership, Fraktionsmodelle und bestehende Bildbytes bleiben unverändert.
- Das abgeschlossene Größenrefactoring trägt weltlokale Navigation, Bau-/Bewegungsgrenzen, Sicht, räumliche Abfragen, Darstellung und Eingabe. Fog-/Minimap-Puffer wachsen und schrumpfen bei Kartenwechsel.
- Die drei eigenständigen Rezepte liegen unter `src/battlefields/`, mit sprechenden IDs, Layout, Palette, Renderprofil, Bauphasen und Ereigniszuordnung. Neue kosmetische Generatoren können einen privaten RNG nutzen; bestehende interleavte RNG-Phasen bleiben geschützt.
- Der Upgrade-Dialog zeigt drei kompakte Karten auf breiten Ansichten und eine mobile Spalte, jeweils mit aktuellem Level und Evakuierungslimit. Überschrift ist **Upgrades**; dekorative Flotilla-/Reservezeile und allgemeiner Erklärungstext wurden entfernt. Preise, Reihenfolge, Kaufregeln und Persistenz blieben unverändert; das zugehörige Issue ist erledigt.
- `npm run simulate:visible` öffnet über die reale Wrapperdatei `visible-simulation.html` eine persönliche KI-gegen-KI-Zuschauerpartie im Standardbrowser. Jeder Run beginnt bei 1× und wechselt nach zehn Echtzeitsekunden auf 2×. Das flüchtige Profil berührt keine normalen Browserdaten; der Befehl gehört nicht zu Build oder Tests und wird von Agenten nicht automatisch ausgeführt.
- Die frühere Wellenlogik und ihre Anzeige wurden vollständig durch die faire RTS-KI ersetzt. Bekannte allgemeine Bauplatz- und Raffinerie-/Vent-Probleme wurden dabei nicht stillschweigend verändert.

## Letzter Prüfstand

- `npm test`: **322/322 bestanden** nach der Nachverdichtung, einschließlich neun bisherigen und drei Alien-KI-gegen-KI-Gefechten bis zum Ergebnis. Terrainzugänge über 46 Seeds, zusätzlich vergrößerte Hainflächen und einzeln blockierende Randpilze auf allen vier Seiten samt Korridorabständen geprüft. Wiederholbarkeit, angepasste Meshbudgets und Größenregressionen bestanden; keine Fixtureänderungen. Desert-/Mothership-/Effekt-/RNG-/Modelldigests bleiben unverändert.
- Chromium/Software-WebGL direkt unter `file://`, Seed 43015: Start, größere Haine, offene Mitte und mehrere Innenränder bei 1280×900 Balanced; zusätzlich Hain auf Low und Rand auf High bei emulierten 390×844. Screenshots gesichtet, keine Seiten-/Konsolen-/WebGL-Fehler. 47–50 Draw Calls mit Schatten, 26 im Low-Hainbild. Der temporäre Harness berücksichtigt den Seitenreload beim Wechsel der Mobile-Emulation; kein Spielcodeeingriff.
- Build, `git diff --check` und lokale Dokumentationslinks geprüft. Kein automatischer Aufruf von `simulate:visible`. Vorherige Pixel-, Fog-Readback- und Touch-Spielablaufnachweise stehen in Git; keine erneute vollständige Eingabeprüfung für diese reine Terrainergänzung. Echtgeräte-Performance und menschliche Langzeitabnahme bleiben offen.

## Offene Grenzen

- Echte Mobilgeräte, reale GPUs, vollständige menschliche Runs und Schwierigkeit über Fraktionen sowie Upgrade-Stufen sind weiterhin nicht ausreichend validiert. Headless-Software-WebGL und emuliertes Touch ersetzen diese Nachweise nicht.
- Bekannte fachliche Arbeiten werden ausschließlich in `docs/issues/` geführt. Insbesondere bleiben die allgemeine Gebäudeplatzierung über Einheiten, direkte Raffinerieplatzierung auf Vents sowie die verbleibende Desert-/Mothership-Gestaltung offen.
- Breites Refactoring, weitere TypeScript-Migration, Multiplayertechnik und neue Systeme bleiben ohne eigenen Auftrag pausiert.

Aktuelle Referenzen: [Spiel und Bedienung](gameplay.md) · [Architektur](architecture.md) · [Grafik und Assets](rendering.md) · [Prüfungen](testing.md) · [Feste Testreferenzen](reference-tests.md)
