# Arbeitsprotokoll

Kompakter Übergabestand und letzte relevante Nachweise. Regeln und aktuelles Verhalten stehen in den Fachreferenzen; abgeschlossene Zwischenschritte, alte Messreihen und frühere Testzahlen bleiben in Git.

## Aktueller Übergabestand

- Der Core Loop aus Basisbau, Gefecht, Aether-Evakuierung, permanenten Upgrades und neuem Gefecht ist implementiert. Nur das Profil bleibt gespeichert; Runs sind flüchtig.
- Der Gegner ist ein deterministischer regelbasierter zweiter Akteur mit eigenem Konto, eigener Sicht und kopiertem Last-Seen-Gedächtnis. Er baut, sammelt, produziert, repariert, nutzt Fähigkeiten und greift ohne Wellen, Ressourcenboni oder versteckte Zustandsabfragen an. Spieler-Upgrades werden nicht gespiegelt.
- Teamfähige Konten, Aktionen, Sicht und Fähigkeiten bilden Architekturvorarbeit, aber kein Netzwerk-, Replay-, Lockstep- oder Rollbacksystem. Autonome Befehle verwenden dieselbe Validierung und Formation wie Spielerbefehle, erzeugen jedoch keine lokalen Eingabemarker oder Sounds.
- Alle 21 Gebäude und alle sieben Einheiten der Fraktion 0 besitzen einzeln registrierte prozedurale Modelle; deren 14 Aktionsporträts sind lokale WebPs. Kataloge, Modellverträge und aktuelle Budgets stehen in [Grafik und Assets](rendering.md).
- Die direkte `file://`-Auslieferung bleibt das Hauptziel. Das statische Dockerimage und die öffentliche Testinstanz benötigen weder Backend noch Laufzeitimporte; Profile bleiben pro Browser-Origin lokal.

## Letzte abgeschlossene Änderungen

- Der Battlefield-Katalog enthält nur noch **Desert**, **Alien Planet** und **Mothership**. Ash Wastes und Silent Necropolis samt ihren fünf Terrain-/Präsentationsreferenzen sind entfernt; die drei verbleibenden technischen IDs und deren RNG-Referenzen bleiben unverändert. Desert ist Vorschau und Standardgefecht. Die geplante Gestaltung der drei Karten bleibt im Issue offen.
- Der Upgrade-Dialog zeigt drei kompakte Karten auf breiten Ansichten und eine mobile Spalte, jeweils mit aktuellem Level und Evakuierungslimit. Überschrift ist **Upgrades**; dekorative Flotilla-/Reservezeile und allgemeiner Erklärungstext wurden entfernt. Preise, Reihenfolge, Kaufregeln und Persistenz blieben unverändert; das zugehörige Issue ist erledigt.
- `npm run simulate:visible` öffnet über die reale Wrapperdatei `visible-simulation.html` eine persönliche KI-gegen-KI-Zuschauerpartie im Standardbrowser. Jeder Run beginnt bei 1× und wechselt nach zehn Echtzeitsekunden auf 2×. Das flüchtige Profil berührt keine normalen Browserdaten; der Befehl gehört nicht zu Build oder Tests und wird von Agenten nicht automatisch ausgeführt.
- Die frühere Wellenlogik und ihre Anzeige wurden vollständig durch die faire RTS-KI ersetzt. Bekannte allgemeine Bauplatz- und Raffinerie-/Vent-Probleme wurden dabei nicht stillschweigend verändert.

## Letzter Prüfstand

- `npm test`: **304/304 bestanden** nach der Reduktion auf drei Battlefields; die 11 verbleibenden Terrain-Digests sowie Effekt- und Modelldigests blieben erhalten.
- Battle-Auswahl direkt unter Chromium `file://` geöffnet: ausschließlich Desert, Alien Planet und Mothership vorhanden.
- Upgrade-Layout zuvor direkt unter Chromium `file://` bei 1280×800 und emulierten 390×844 geprüft: alle drei Karten und **Return** ohne internes Dialogscrollen sichtbar, Kauf-Neudarstellung korrekt, keine Seiten-/Konsolenfehler. Die anschließenden reinen Textkürzungen erhielten einen Build beziehungsweise die vollständige Node-Suite, aber keinen weiteren Browserlauf.
- KI-Abnahme unter Chromium `file://`: alle Gegnerfraktionen und Qualitätsstufen mit echter Wirtschaft, Basis und Produktion; gegnerische Zustände bis zu regulärer Aufklärung verborgen, Ergebnis/Neustart sowie emulierte mobile Rekrutierung, Abbau und Gebäudeplatzierung geprüft. Neun deterministische KI-Paarungen erreichen innerhalb von maximal 20 Simulationsminuten ein Ergebnis.
- Der sichtbare Simulationswrapper wurde isoliert im Browser geprüft; insbesondere bleibt ein präpariertes persistentes Profil unverändert. Der persönliche sichtbare npm-Befehl selbst wird nicht automatisiert gestartet.

## Offene Grenzen

- Echte Mobilgeräte, reale GPUs, vollständige menschliche Runs und Schwierigkeit über Fraktionen sowie Upgrade-Stufen sind weiterhin nicht ausreichend validiert. Headless-Software-WebGL und emuliertes Touch ersetzen diese Nachweise nicht.
- Bekannte fachliche Arbeiten werden ausschließlich in `docs/issues/` geführt. Insbesondere bleiben die allgemeine Gebäudeplatzierung über Einheiten, direkte Raffinerieplatzierung auf Vents und die Überarbeitung der drei Battlefields offen.
- Breites Refactoring, weitere TypeScript-Migration, Multiplayertechnik und neue Systeme bleiben ohne eigenen Auftrag pausiert.

Aktuelle Referenzen: [Spiel und Bedienung](gameplay.md) · [Architektur](architecture.md) · [Grafik und Assets](rendering.md) · [Prüfungen](testing.md) · [Feste Testreferenzen](reference-tests.md)
