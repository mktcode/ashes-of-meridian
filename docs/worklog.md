# Arbeitsprotokoll

Kompakter Übergabestand und letzte relevante Nachweise. Regeln und aktuelles Verhalten stehen in den Fachreferenzen; abgeschlossene Zwischenschritte, alte Messreihen und frühere Testzahlen bleiben in Git.

## Aktueller Übergabestand

- Der Core Loop aus Basisbau, Gefecht, Aether-Evakuierung, permanenten Upgrades und neuem Gefecht ist implementiert. Nur das Profil bleibt gespeichert; Runs sind flüchtig.
- Der Gegner ist ein deterministischer regelbasierter zweiter Akteur mit eigenem Konto, eigener Sicht und kopiertem Last-Seen-Gedächtnis. Er baut, sammelt, produziert, repariert, nutzt Fähigkeiten und greift ohne Wellen, Ressourcenboni oder versteckte Zustandsabfragen an. Spieler-Upgrades werden nicht gespiegelt.
- Teamfähige Konten, Aktionen, Sicht und Fähigkeiten bilden Architekturvorarbeit, aber kein Netzwerk-, Replay-, Lockstep- oder Rollbacksystem. Autonome Befehle verwenden dieselbe Validierung und Formation wie Spielerbefehle, erzeugen jedoch keine lokalen Eingabemarker oder Sounds.
- Alle 21 Gebäude und alle sieben Einheiten der Fraktion 0 besitzen einzeln registrierte prozedurale Modelle; deren 14 Aktionsporträts sind lokale WebPs. Kataloge, Modellverträge und aktuelle Budgets stehen in [Grafik und Assets](rendering.md).
- Die direkte `file://`-Auslieferung bleibt das Hauptziel. Das statische Dockerimage und die öffentliche Testinstanz benötigen weder Backend noch Laufzeitimporte; Profile bleiben pro Browser-Origin lokal.

## Letzte abgeschlossene Änderungen

- Kartenrefactoring abgeschlossen: eigene CPU-Rezepte für **Desert**, **Alien Planet** und **Mothership** unter `src/battlefields/`; IDs ausschließlich `desert`, `alien-planet`, `mothership`, ohne Alt-Aliase. Layoutdaten versorgen Spawn, Ressourcen, Kamera und KI. Renderprofile, deklarative Terrain-Meshes und generische Polygonprüfung erlauben getrennte Gestaltung; Weltereignisse bleiben Simulation. Bestehende Platzierungen, Kollision und RNG-Referenzen sind unverändert. Neue kosmetische Generatoren besitzen einen privaten RNG-Zugang; die alten interleavten Phasen wurden nicht neu geseedet. Die gestalterischen Issues bleiben offen.
- Der Upgrade-Dialog zeigt drei kompakte Karten auf breiten Ansichten und eine mobile Spalte, jeweils mit aktuellem Level und Evakuierungslimit. Überschrift ist **Upgrades**; dekorative Flotilla-/Reservezeile und allgemeiner Erklärungstext wurden entfernt. Preise, Reihenfolge, Kaufregeln und Persistenz blieben unverändert; das zugehörige Issue ist erledigt.
- `npm run simulate:visible` öffnet über die reale Wrapperdatei `visible-simulation.html` eine persönliche KI-gegen-KI-Zuschauerpartie im Standardbrowser. Jeder Run beginnt bei 1× und wechselt nach zehn Echtzeitsekunden auf 2×. Das flüchtige Profil berührt keine normalen Browserdaten; der Befehl gehört nicht zu Build oder Tests und wird von Agenten nicht automatisch ausgeführt.
- Die frühere Wellenlogik und ihre Anzeige wurden vollständig durch die faire RTS-KI ersetzt. Bekannte allgemeine Bauplatz- und Raffinerie-/Vent-Probleme wurden dabei nicht stillschweigend verändert.

## Letzter Prüfstand

- `npm test`: **311/311 bestanden** nach dem Kartenrefactoring, einschließlich neun KI-Langläufen. Die 11 Terrain-/Platzierungs-/Navigationsreferenzen sowie Effekt-/RNG-/Modelldigests bleiben unverändert; nur Karten-Eingabelabels der Fixture sind umbenannt. Neue Tests sichern Rezept-/Layoutisolation, private kosmetische Samples, Nicht-Berg-Polygone, deklarativen Modell-/Ereignisdispatch und Renderprofil-Textur-/Uniformwechsel.
- Chromium/Software-WebGL direkt unter `file://`: alle drei Karten bei Seed 43015 in Balanced (960×720) vor/nach dem Umbau verglichen, jeweils **identische Weltpixel**, Screenshots gesichtet. Mobile Emulation 390×844: Auswahl, Start und Pause → Bestätigung → Neustart jeder Karte, verteilt über alle drei Qualitätsstufen; ID bleibt erhalten. Kontrollierter Boden-/Dekorprofilwechsel verändert die tatsächlichen Shaderpixel und stellt sie nach Rückwechsel exakt wieder her. Keine Seiten-/Konsolen-/WebGL-Fehler im abschließenden Lauf.
- `git diff --check`, Prüfung der lokalen Dokumentationslinks und Suche nach alten numerischen Karten-IDs bestanden. Keine neuen Texturassets, keine Fixture-Neuerzeugung, kein automatischer Aufruf von `simulate:visible`. Frühere UI-/Audio-/KI-Browserabnahmen stehen in Git.

## Offene Grenzen

- Echte Mobilgeräte, reale GPUs, vollständige menschliche Runs und Schwierigkeit über Fraktionen sowie Upgrade-Stufen sind weiterhin nicht ausreichend validiert. Headless-Software-WebGL und emuliertes Touch ersetzen diese Nachweise nicht.
- Bekannte fachliche Arbeiten werden ausschließlich in `docs/issues/` geführt. Insbesondere bleiben die allgemeine Gebäudeplatzierung über Einheiten, direkte Raffinerieplatzierung auf Vents und die Überarbeitung der drei Battlefields offen.
- Breites Refactoring, weitere TypeScript-Migration, Multiplayertechnik und neue Systeme bleiben ohne eigenen Auftrag pausiert.

Aktuelle Referenzen: [Spiel und Bedienung](gameplay.md) · [Architektur](architecture.md) · [Grafik und Assets](rendering.md) · [Prüfungen](testing.md) · [Feste Testreferenzen](reference-tests.md)
