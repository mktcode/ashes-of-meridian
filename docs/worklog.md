# Arbeitsprotokoll

Kompakter Übergabestand und letzte relevante Nachweise. Regeln und aktuelles Verhalten stehen in den Fachreferenzen; abgeschlossene Zwischenschritte, alte Messreihen und frühere Testzahlen bleiben in Git.

## Aktueller Übergabestand

- Der Core Loop aus Basisbau, Gefecht, Aether-Evakuierung, permanenten Upgrades und neuem Gefecht ist implementiert. Nur das Profil bleibt gespeichert; Runs sind flüchtig.
- Der Gegner ist ein deterministischer regelbasierter zweiter Akteur mit eigenem Konto, eigener Sicht und kopiertem Last-Seen-Gedächtnis. Er baut, sammelt, produziert, repariert, nutzt Fähigkeiten und greift ohne Wellen, Ressourcenboni oder versteckte Zustandsabfragen an. Spieler-Upgrades werden nicht gespiegelt.
- Teamfähige Konten, Aktionen, Sicht und Fähigkeiten bilden Architekturvorarbeit, aber kein Netzwerk-, Replay-, Lockstep- oder Rollbacksystem. Autonome Befehle verwenden dieselbe Validierung und Formation wie Spielerbefehle, erzeugen jedoch keine lokalen Eingabemarker oder Sounds.
- Alle 21 Gebäude und alle sieben Einheiten der Fraktion 0 besitzen einzeln registrierte prozedurale Modelle; deren 14 Aktionsporträts sind lokale WebPs. Kataloge, Modellverträge und aktuelle Budgets stehen in [Grafik und Assets](rendering.md).
- Die direkte `file://`-Auslieferung bleibt das Hauptziel. Das statische Dockerimage und die öffentliche Testinstanz benötigen weder Backend noch Laufzeitimporte; Profile bleiben pro Browser-Origin lokal.

## Letzte abgeschlossene Änderungen

- Alien Planet als Waldlichtung überarbeitet: dicht bewachsener Außenbereich auf eben fortgesetztem Boden statt gestreifter Böschung; weich und unregelmäßig auslaufender Saum, kleinere innere Baumgruppen und Lichtungen statt zweier gestempelter Waldinseln. Drei wiederverwendbare große Einzelpflanzen aus den vorhandenen Pilzbausteinen, Jungpilze, Farne und Sporen. Nur einzelne innere Wurzelfüße blockieren; die Minimap zeigt diese statt großer Hainmasken. Außenwald und Unterwuchs haben isolierte kosmetische RNGs. Keine Änderung gemeinsamer Renderer-/Simulationsregeln, Texturen oder der anderen Karten.
- Alien Planet bleibt 270 × 270 m groß (+125 % Fläche) mit denselben Starts, acht Ressourcenbereichen und geschützten Haupt-/Flankenrouten. Das Entfernen der großen Flächenblocker verändert bewusst innere Laufwege und Begegnungen. Details in der Grafikreferenz.
- Die vorgegebene Alien-Bodentextur wird gespiegelt wiederholt. Die bewusst umbenannten Floor-Dateien sind bytegleich zu den vorherigen `metal`-/`bio`-Quellen; Einbettung und Tests sind synchronisiert. Nur die neue Materialkennung `ALIEN` ergänzt das generierte Assetskript. Desert/Mothership, Fraktionsmodelle und bestehende Bildbytes bleiben unverändert.
- Das abgeschlossene Größenrefactoring trägt weltlokale Navigation, Bau-/Bewegungsgrenzen, Sicht, räumliche Abfragen, Darstellung und Eingabe. Fog-/Minimap-Puffer wachsen und schrumpfen bei Kartenwechsel.
- Die drei eigenständigen Rezepte liegen unter `src/battlefields/`, mit sprechenden IDs, Layout, Palette, Renderprofil, Bauphasen und Ereigniszuordnung. Neue kosmetische Generatoren können einen privaten RNG nutzen; bestehende interleavte RNG-Phasen bleiben geschützt.
- Der Upgrade-Dialog zeigt drei kompakte Karten auf breiten Ansichten und eine mobile Spalte, jeweils mit aktuellem Level und Evakuierungslimit. Überschrift ist **Upgrades**; dekorative Flotilla-/Reservezeile und allgemeiner Erklärungstext wurden entfernt. Preise, Reihenfolge, Kaufregeln und Persistenz blieben unverändert; das zugehörige Issue ist erledigt.
- `npm run simulate:visible` öffnet über die reale Wrapperdatei `visible-simulation.html` eine persönliche KI-gegen-KI-Zuschauerpartie im Standardbrowser. Jeder Run beginnt bei 1× und wechselt nach zehn Echtzeitsekunden auf 2×. Das flüchtige Profil berührt keine normalen Browserdaten; der Befehl gehört nicht zu Build oder Tests und wird von Agenten nicht automatisch ausgeführt.
- Die frühere Wellenlogik und ihre Anzeige wurden vollständig durch die faire RTS-KI ersetzt. Bekannte allgemeine Bauplatz- und Raffinerie-/Vent-Probleme wurden dabei nicht stillschweigend verändert.

## Letzter Prüfstand

- `npm test`: **323/323 bestanden**, einschließlich neun bisherigen und drei Alien-KI-gegen-KI-Gefechten bis zum Ergebnis. Terrainzugänge über 46 Seeds; Außenwaldbedeckung aller vier Seiten, lichterer Innenbereich, exakte individuelle Blocker/Minimapfarben, RNG-Isolation, flacher Bodenanschluss und instanzgewichtetes Meshbudget geprüft. Keine Fixtureänderungen; Desert-/Mothership-/Effekt-/RNG-/Modelldigests bleiben unverändert.
- Beim ersten Gesamtlauf überschritt Alien-Seed 43112 (Choir/Court) die bisherige 20-Minuten-Testgrenze. Ein separater längerer Lauf zeigte laufende Produktion/Kämpfe und regulären HQ-Fall nach **24:31**, keine dauerhafte Wegeblockade. Nur die drei Alien-Abnahmeläufe erhalten deshalb 30 Minuten Spielzeitbudget; Ergebnisprüfung, Seeds und übrige neun 20-Minuten-Fälle bleiben erhalten. Kein KI-/Kosten-/Einheiten-Tuning für einen früheren Testsieg.
- Chromium/Software-WebGL direkt unter `file://`: Start, innere Gruppen, offene Mitte und mehrere Waldränder bei 1280×900 Balanced, zusätzlich gedämpfte Fogansicht sowie Low/High bei emulierten 390×844. Screenshots gesichtet, keine Seiten-/Konsolen-/WebGL-Fehler; 45–48 Draw Calls mit Schatten, 25 auf Low. Desert und Mothership weiterhin pixelidentisch zu den alten 960×720-Balanced-Aufnahmen bei Seed 43015. Beispiel Alien 43015: 548 Außen- und 183 Innenbäume, 2.591 Terrainplatzierungen, 468.454 Dreiecke für Vegetation/Boden vor Schattenwiederholung; kein Echtgeräte-Performancenachweis.
- Build, `git diff --check` und lokale Dokumentationslinks geprüft. Kein automatischer Aufruf von `simulate:visible`, keine erneute vollständige Eingabeprüfung. Frühere Fog-Readback-/Touch-Spielablaufnachweise bleiben in Git; Echtgeräte-Performance und menschliche Langzeitabnahme offen.

## Offene Grenzen

- Echte Mobilgeräte, reale GPUs, vollständige menschliche Runs und Schwierigkeit über Fraktionen sowie Upgrade-Stufen sind weiterhin nicht ausreichend validiert. Headless-Software-WebGL und emuliertes Touch ersetzen diese Nachweise nicht.
- Bekannte fachliche Arbeiten werden ausschließlich in `docs/issues/` geführt. Insbesondere bleiben die allgemeine Gebäudeplatzierung über Einheiten, direkte Raffinerieplatzierung auf Vents sowie die verbleibende Desert-/Mothership-Gestaltung offen.
- Breites Refactoring, weitere TypeScript-Migration, Multiplayertechnik und neue Systeme bleiben ohne eigenen Auftrag pausiert.

Aktuelle Referenzen: [Spiel und Bedienung](gameplay.md) · [Architektur](architecture.md) · [Grafik und Assets](rendering.md) · [Prüfungen](testing.md) · [Feste Testreferenzen](reference-tests.md)
