# Command-Fähigkeiten: Expeditionsloadout und Upgrades

## Ziel

Die vier bestehenden Command-Fähigkeiten **Orbital Strike**, **Repair Field**, **Recon Scan** und **Reinforcements** sollen durch echte Loadout-Entscheidungen und permanente Verbesserung mehr strategische Bedeutung erhalten. Das Paket erweitert den Pool auf acht Fähigkeiten. Vor einer neuen Expedition wählt der Spieler genau vier davon; Auswahl und Reihenfolge gelten bis zum Ende oder Abbruch des Runs.

Die Bedeutung soll aus Knappheit, Synergien und Spezialisierung entstehen, nicht aus einem pauschalen Buff aller Fähigkeiten. Gemeinsame Command Energy, individuelle Cooldowns sowie die heutigen Technologie-, Sicht-, Versorgungs- und Landebedingungen bleiben erhalten.

## Verbindliches Paket

### Fähigkeitenpool

Die heutigen Grundwirkungen und Kosten bleiben bestehen:

- **Orbital Strike:** Flächenschaden; benötigt eine fertige Fahrzeugfabrik und aktuelle Zielsicht.
- **Repair Field:** sofortige Hüllen-/Schildreparatur und Heilung über Zeit.
- **Recon Scan:** Fernaufklärung ohne Landepunkt für Reinforcements.
- **Reinforcements:** vier permanente Basiseinheiten; benötigt erkundeten Boden, einen nahen eigenen Anker und acht freie Versorgung.

Hinzu kommen:

| Fähigkeit | Grundwirkung | Energie | Cooldown |
| --- | --- | ---: | ---: |
| **Disruption Field** | Gegnerische Einheiten im Radius 11 bewegen sich 10 Sekunden lang 35 % langsamer. | 50 | 40 s |
| **Bulwark Field** | Eigene Einheiten und Gebäude im Radius 10 erleiden 10 Sekunden lang 30 % weniger Schaden. | 55 | 45 s |
| **Command Surge** | Eigene Kampfeinheiten im Radius 10 bewegen und feuern 10 Sekunden lang 20 % schneller. Keine Wirkung auf Worker, Gebäude, Produktion oder Heilung. | 60 | 45 s |
| **Emergency Recall** | Markiert eigene Bodenkampfeinheiten im Radius 9 und versetzt nach drei Sekunden höchstens 12 Versorgung zum nächsten fertigen eigenen HQ. Worker und Flugzeuge sind ausgeschlossen. | 50 | 60 s |

Gleiche zeitlich begrenzte Effekte stapeln nicht; eine erneute Anwendung verlängert höchstens den betroffenen Einzelzustand. Emergency Recall markiert beim Auslösen die nach Abstand zum Zielpunkt priorisierten Einheiten. Tote Einheiten werden nicht ersetzt. Ohne fertiges HQ oder passende Einheiten wird vor Energieabzug abgelehnt. Freie Zielpositionen am HQ werden vor dem Versetzen regelgerecht auf Gelände, Klippen und Einheitenkörper geprüft; nicht platzierbare Einheiten bleiben am Ursprungsort.

### Expeditionsloadout

- Nach der Fraktionswahl belegt der Spieler vier nummerierte Slots mit unterschiedlichen Fähigkeiten.
- Die Slotreihenfolge entspricht der Reihenfolge im HUD. Der Expeditionsstart bleibt bis zu einer vollständigen Auswahl gesperrt.
- Alle acht Grundfähigkeiten sind von Beginn an auswählbar; permanente Upgrades schalten keine Grundfunktion frei.
- Das Loadout wird im Expeditionscheckpoint gespeichert und bei jedem Gefechtsstart in den Parteienzustand kopiert. Es kann innerhalb des Runs nicht geändert werden, auch nicht an Übergängen.
- Die Simulation validiert die Ausstattung bei jeder Aktion. Das Ausblenden eines HUD-Knopfs allein ist keine Berechtigungsprüfung.
- Expeditionsbriefing und Vorteilsübersicht zeigen das aktive Loadout. Abbruch oder Niederlage verwirft es zusammen mit dem Run.
- Der geänderte Checkpoint erhält eine neue Version. Alte laufende Expeditionen werden gemäß Prototypregel verworfen, nicht migriert; das permanente Profil bleibt erhalten.

Das vorhandene Vierer-HUD zeigt ausschließlich die vier ausgewählten Fähigkeiten. Für direkte technische Starts ohne Expedition und für den bestehenden Multiplayer-Prototyp gilt vorerst das heutige Standardloadout aus den vier bestehenden Fähigkeiten; Multiplayer-Loadouts und permanente Profilupgrades sind nicht Teil dieses Pakets.

### Permanente Command-Module

Jede Fähigkeit besitzt drei permanente Ränge. Rang 0 ist die kostenlose Grundform. Die vorläufigen Kosten betragen pro Fähigkeit 250, 600 und 1.200 Aether. Käufe verwenden denselben Profil- und Anwendungszeitpunkt wie andere Fleet Upgrades: Sie wirken ab dem nächsten Gefechtsstart, ändern aber nie das gewählte Loadout.

| Fähigkeit | Rang 1 | Rang 2 | Rang 3 |
| --- | --- | --- | --- |
| **Orbital Strike** | +12 % Schaden | Einschlag nach 1,8 statt 2,2 Sekunden | Cooldown 48 → 40 s |
| **Repair Field** | Sofortheilung 180 → 230 und Schild 100 → 130 | Heilung über Zeit 10 → 15 pro Sekunde | Radius 12 → 14 |
| **Recon Scan** | Dauer 22 → 28 s | Radius 32 → 38 | Energie 25 → 18 |
| **Reinforcements** | 20 % Schadensreduktion für 12 Sekunden nach der Landung | zusätzlich ein fraktionsspezifischer Medic; benötigt zehn freie Versorgung | Cooldown 75 → 62 s |
| **Disruption Field** | Bewegungsverlangsamung 35 → 45 % | zusätzlich 25 % längere Waffenabklingzeit | Dauer 10 → 13 s |
| **Bulwark Field** | Radius 10 → 12 | Schadensreduktion 30 → 40 % | Dauer 10 → 13 s |
| **Command Surge** | Dauer 10 → 13 s | Bonus 20 → 30 % | Cooldown 45 → 36 s |
| **Emergency Recall** | Kapazität 12 → 16 Versorgung | Auslösung nach zwei statt drei Sekunden | Cooldown 60 → 48 s |

Die Armory trennt vorhandene **Fleet Systems** von **Command Modules**, damit acht zusätzliche Karten die Wirtschaftsupgrades nicht verdrängen. Karten zeigen Grundwirkung, Rang, nächsten Effekt und Preis. Die Fähigkeitseffekte lesen die beim Gefechtsstart kopierten Ränge, nicht das danach veränderliche Profil.

### Gegnerische Loadouts

KI-Parteien erhalten keine unsichtbare Nutzung aller acht Fähigkeiten. Ihr aktuelles Fraktionsloadout wird im Briefing angezeigt:

- **Free Marches:** Orbital Strike, Repair Field, Bulwark Field, Reinforcements
- **Verdant Choir:** Repair Field, Reinforcements, Disruption Field, Command Surge
- **Veiled Court:** Orbital Strike, Recon Scan, Disruption Field, Emergency Recall

Es folgt der aktuellen Gegnerfraktion und darf daher bei einem Fraktionswechsel am nächsten Übergang wechseln. Gegner verwenden Rang 0; ihre bereits implementierten Expeditionsvorteile bleiben der sichtbare gegnerische Fortschritt. Es gibt keine versteckten Fähigkeitsränge aus Expeditionstiefe oder KI-Druckstufe.

Die KI nutzt neue Fähigkeiten nur aus eigener verzögerter Beobachtung: Disruption gegen gegnerische Gruppen, Bulwark/Surge auf eigene bedrohte beziehungsweise angreifende Gruppen und Recall für eine gefährdete Bodengruppe. Prüfungen, Energie, Cooldown und Ziele laufen durch dieselbe Aktionsgrenze wie beim Spieler.

## Nicht-Ziele

- Keine Ressourcenfähigkeit mit Alloy oder Aether; insbesondere keine neue Schleife mit Aether-Evakuierung.
- Keine Änderung an Command-Energy-Regeneration, Command Capacitor oder bestehenden Expeditionsvorteilen.
- Keine Fähigkeitswahl oder permanente Metaprogression im Multiplayer-Prototyp.
- Keine Zufallseffekte, neuen Simulations-RNG-Aufrufe oder geänderten Terrain-/Start-RNG-Sequenzen.
- Keine Guardian Drone, Decoy Beacon oder weitere Fähigkeit im ersten Paket.
- Keine visuellen oder akustischen Assets als Voraussetzung; vorhandene Ring-, Feld- und Meldungsmittel genügen für den technischen ersten Stand.

## Abnahmekriterien

- Eine neue Expedition kann nur mit vier unterschiedlichen Fähigkeiten starten; Reihenfolge und Auswahl überleben Übergang und Reload.
- Nicht ausgerüstete Fähigkeiten fehlen im HUD und werden auch über direkte oder eingereihte Aktionen von der Simulation ohne Energie-/Cooldownverbrauch abgelehnt.
- Alle acht Fähigkeiten respektieren Kosten, Cooldown, Besitz, Sicht-/Erkundungs- und Zielbedingungen. Fehlschläge mutieren weder Energie noch Effekte.
- Jeder Command-Rang verändert ausschließlich seine dokumentierte Fähigkeit und wird beim Gefechtsstart kopiert. Profilkäufe ändern kein bereits laufendes Gefecht.
- Zeitfelder stapeln nicht multiplikativ. Bulwark wirkt auf Hülle und Schild, Surge ausschließlich auf Bewegung und Waffenabklingzeit, Disruption ausschließlich auf Gegner.
- Recall versetzt nur beim Auslösen markierte eigene Boden-Kampfeinheiten innerhalb der Versorgungskapazität und erzeugt keine überlappenden oder klippengetrennten Zielpositionen.
- KI-Parteien können ausschließlich ihr sichtbares Fraktionsloadout nutzen. Multiplayer behält das Standardloadout und übernimmt keine Profilränge.
- Checkpoint-Normalisierung verwirft unbekannte, doppelte, unvollständige oder alte Loadouts, ohne das permanente Profil zu verlieren.
- Die bisherigen Orbital-, Repair-, Scan- und Reinforcement-Regeln bleiben auf Rang 0 unverändert.

## Prüfplan

- Build und gezielte Persistenztests für Checkpointversion, Loadout-Normalisierung, Reload und Profilränge.
- Gezielte Command-/Queue-Tests für simulationsseitige Ausstattungssperre und mutierungsfreie Ablehnung.
- Kleine technische Fähigkeitsfälle für Kosten, Cooldowns, Rangkopie, zeitliche Effekte, Nichtstapeln und Recall-Platzierung. Keine Langläufe oder neue seedbasierte Referenzwerte.
- UI-Logiktests für genau vier unterschiedliche Slots, feste Reihenfolge und getrennte Armory-Bereiche; Darstellung und Touch-Bedienung bleiben menschliche Abnahme.
- Wegen des Eingriffs in gemeinsame Simulation, Parteienzustand, Persistenz und Ladeverträge abschließend `npm test`.
- Die umfangreichen KI- und Simulationsblöcke nur nach ausdrücklicher aktueller Freigabe ausführen. Menschlich bleiben Auswahlverständlichkeit, HUD auf schmalen Geräten, Balance der Kosten/Ränge und die neuen KI-Einsätze zu beurteilen.
