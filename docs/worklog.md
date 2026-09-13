# Arbeitsprotokoll

Kompakter Übergabestand und letzte relevante Nachweise. Regeln und aktuelles Verhalten stehen in den Fachreferenzen; abgeschlossene Zwischenschritte, alte Messreihen und frühere Testzahlen bleiben in Git.

## Aktueller Übergabestand

- Der Core Loop aus Basisbau, Gefecht, Aether-Evakuierung, permanenten Upgrades und neuem Gefecht ist implementiert. Nur das Profil bleibt gespeichert; Runs sind flüchtig.
- Der Gegner ist ein deterministischer regelbasierter zweiter Akteur mit eigenem Konto, eigener Sicht und kopiertem Last-Seen-Gedächtnis. Er baut, sammelt, produziert, repariert, nutzt Fähigkeiten und greift ohne Wellen, Ressourcenboni oder versteckte Zustandsabfragen an. Spieler-Upgrades werden nicht gespiegelt.
- Teamfähige Konten, Aktionen, Sicht und Fähigkeiten bilden Architekturvorarbeit, aber kein Netzwerk-, Replay-, Lockstep- oder Rollbacksystem. Autonome Befehle verwenden dieselbe Validierung und Formation wie Spielerbefehle, erzeugen jedoch keine lokalen Eingabemarker oder Sounds.
- Alle 21 Gebäude und alle sieben Einheiten der Fraktion 0 besitzen einzeln registrierte prozedurale Modelle; deren 14 Aktionsporträts sind lokale WebPs. Kataloge, Modellverträge und aktuelle Budgets stehen in [Grafik und Assets](rendering.md).
- Die direkte `file://`-Auslieferung bleibt das Hauptziel. Das statische Dockerimage und die öffentliche Testinstanz benötigen weder Backend noch Laufzeitimporte; Profile bleiben pro Browser-Origin lokal.

## Letzte abgeschlossene Änderungen

- Größenrefactoring abgeschlossen: Kartenrezepte besitzen `size`, Welten eigene Ausdehnung/Zellbreite/Rastergröße. Navigation, Baulimits, Spawn/Bewegung, Sicht, Kampf-Hash, Gebirgsrand, Rendering, Minimap und Kameragrenzen folgen der aktiven Welt. GPU-/Minimap-Puffer wachsen und schrumpfen bei Kartenwechsel. Bestehende Maße, Darstellung und Referenzen bleiben unverändert. Nächster Schritt ist Alien Planet: 270 × 270 m (1,5× je Achse, +125 % Fläche) aktivieren und gestalten, ohne Desert/Mothership mitzuverändern. Neue Größen sind bereits in Testkonfigurationen geprüft.
- Die drei eigenständigen Rezepte liegen unter `src/battlefields/`, mit sprechenden IDs, Layout, Palette, Renderprofil, Bauphasen und Ereigniszuordnung. Neue kosmetische Generatoren können einen privaten RNG nutzen; bestehende interleavte RNG-Phasen bleiben geschützt.
- Der Upgrade-Dialog zeigt drei kompakte Karten auf breiten Ansichten und eine mobile Spalte, jeweils mit aktuellem Level und Evakuierungslimit. Überschrift ist **Upgrades**; dekorative Flotilla-/Reservezeile und allgemeiner Erklärungstext wurden entfernt. Preise, Reihenfolge, Kaufregeln und Persistenz blieben unverändert; das zugehörige Issue ist erledigt.
- `npm run simulate:visible` öffnet über die reale Wrapperdatei `visible-simulation.html` eine persönliche KI-gegen-KI-Zuschauerpartie im Standardbrowser. Jeder Run beginnt bei 1× und wechselt nach zehn Echtzeitsekunden auf 2×. Das flüchtige Profil berührt keine normalen Browserdaten; der Befehl gehört nicht zu Build oder Tests und wird von Agenten nicht automatisch ausgeführt.
- Die frühere Wellenlogik und ihre Anzeige wurden vollständig durch die faire RTS-KI ersetzt. Bekannte allgemeine Bauplatz- und Raffinerie-/Vent-Probleme wurden dabei nicht stillschweigend verändert.

## Letzter Prüfstand

- `npm test`: **320/321 bestanden**, inklusive aller zehn neuen Größentests, aller festen Terrain-/Platzierungs-/Navigations-/Effekt-/RNG-/Modelldigests und neun KI-Langläufe. Der einzige Fehler betrifft die bereits vor diesem Refactoring entfernten Texturquellnamen `texture-floor-metal.webp` / `texture-floor-bio.webp`; ihre bewusste Umbenennung wurde vom Nutzer bestätigt. Einbettung und Zuordnung bleiben für den Gestaltungsschritt offen, nicht durch neue Fixtures oder Assetänderungen übergangen.
- Neue Größenprüfungen: 108²/109²-Felder und alternative Zellbreite, Instanzisolation/Validierung, beide Teams jenseits der alten Weltkante, Umwege und ein A*-Korridor mit mehr als 5600 Feldern, bezahltes Bauen/Produktion/Move/Flug/Neustart im äußeren Bereich, große räumliche Abfragen ohne Hash-Aliase, Terrain-/Fog-/Minimap-Wechsel und Eingabegrenzen.
- Chromium/Software-WebGL direkt unter `file://`: alle drei unveränderten Karten bei Seed 43015 und 960×720 Balanced vor/nach dem Umbau **pixelidentisch**. Testkonfigurationen mit 270 × 270 m auf Desktop und emulierten 390×844 über alle Qualitätsstufen, zusätzlich ungerade 109er-Rasterbreite und Rückwechsel auf 72²: Minimap-Touch, Kamerakanten und Rechtsklickbefehle geprüft, Screenshots gesichtet. Fog-Texturen per GPU-Readback vollständig bytegleich zu den CPU-Puffern, keine Seiten-/Konsolen-/WebGL-Fehler. Keine Echtgeräte-/größere-Karten-Langzeitabnahme.
- Build, `git diff --check` und lokale Dokumentationslinks geprüft. Keine Änderungen an Assets oder Fixtures, kein automatischer Aufruf von `simulate:visible`. Frühere UI-/Audio-/KI-Browserabnahmen stehen in Git.

## Offene Grenzen

- Echte Mobilgeräte, reale GPUs, vollständige menschliche Runs und Schwierigkeit über Fraktionen sowie Upgrade-Stufen sind weiterhin nicht ausreichend validiert. Headless-Software-WebGL und emuliertes Touch ersetzen diese Nachweise nicht.
- Bekannte fachliche Arbeiten werden ausschließlich in `docs/issues/` geführt. Insbesondere bleiben die allgemeine Gebäudeplatzierung über Einheiten, direkte Raffinerieplatzierung auf Vents und die Überarbeitung der drei Battlefields offen.
- Breites Refactoring, weitere TypeScript-Migration, Multiplayertechnik und neue Systeme bleiben ohne eigenen Auftrag pausiert.

Aktuelle Referenzen: [Spiel und Bedienung](gameplay.md) · [Architektur](architecture.md) · [Grafik und Assets](rendering.md) · [Prüfungen](testing.md) · [Feste Testreferenzen](reference-tests.md)
