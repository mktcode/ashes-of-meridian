# Arbeitsprotokoll

Einzige fortlaufende Änderungshistorie unter `docs/`. Neue Einträge kurz nach oben setzen: Änderung, tatsächlich ausgeführte Prüfung und relevante Grenzen. Kleine zusammengehörige Schritte bündeln; ältere Einträge regelmäßig verdichten. Referenzdokumente beschreiben den Ist-Zustand, Details früherer Berichte bleiben in Git.

## Dokumentation und Arbeitsregeln

- Einzelberichte und veraltete Zwischenstände durch aktuelle Referenzen zu Architektur, Spiel, Grafik und Tests ersetzt; README und Links nachgeführt. Keine Spielcode-/Asset-/Teständerungen.
- `AGENTS.md`: risikogerechte Prüfungen, keine zusätzlichen Browsertests für minimale Kosmetik, nur dieses zentrale Protokoll und regelmäßige Bereinigung.
- Geprüft: lokale Dokumentationslinks/Anker und `git diff --check`. Keine erneuten Node-/Browserläufe für die reine Dokumentationsänderung.

## Mobile-Deck vereinfacht (`e11bfa9` bis `565b108`)

- Dekorative Texte und sechs Befehlsbuttons entfernt; Boden-Tap nutzt Attack-move, Worker normale Bewegung. Deck randbündig und rahmenlos, Minimap flächenfüllend. Rekrutierung und weitere UI-Neugestaltung bleiben zurückgestellt.
- Letzter Spielcode-Prüfnachweis bei `565b108`: **170 Node-Tests bestanden**. Chromium 152, Headless/CDP-Touch, Performance, direkt `file://`: fünf Größen von 390×844 bis 1700×960, Deck-/Minimap-Abmessungen, Navigation, Befehle, Ziel-Cancel und Rekrutierung geprüft; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Portrait-Screenshot betrachtet.
- Grenzen: angehaltene Simulation und programmatische Auswahl; Queue-Abbruch im Portrait nur per API, da dort ausgeblendet. Kein Echtgerät-, andere Qualitätsstufen-/Browser- oder Langzeitnachweis. Diese älteren Läufe wurden bei der Dokumentationsbereinigung nicht wiederholt.

## Zusammengefasste frühere Entwicklung

- Klassische lokale Skripte statt Inline-Monolith; Speicherung, CPU-Welt und kosmetische Effekte getrennt. Referenztests sichern Terrain-/RNG-/Zeichenverhalten. Skybox eingebettet, MSAA und modellfeste Texturen umgesetzt; damalige Chromium-GPU-Prüfungen waren positiv, keine aktuelle vollständige Grafikfreigabe.
- Desktop-Kamera, Hotkeys, Rechteck-/Shift-Auswahl, Kontrollgruppen, Befehls-Auftragsketten, Bauhilfe, Forschung und Tooltips entfernt. Arbeitergestützte Gebäude-Reparatur, bestätigter Verkauf und dauerhaftes Panel-Schließen ergänzt.
- `cbd37f2`: Kampagne/Sondermodi durch wiederholbare HQ-Gefechte ersetzt; permanente Upgrades kostenlos zum Testen. `3e7705d`: Dreifachtap für sichtbare Nicht-Worker; Browser-Timing nur in kontrollierter Performance-Probe, nicht auf Echtgeräten belegt.
- `71952f3`: Schwierigkeit entfernt, frühere Standard-Regeln fest, Checkpoints Version 3. Drei 120-s-Simulationsvergleiche entsprachen nach Normalisierung der entfernten Felder dem vorherigen Standard-Zustand einschließlich Effekten/Folge-RNG. `7f81c48`: untere Steuerungshinweisleiste entfernt.

Offene Entscheidungen und bekannte Bedienungsgrenzen stehen aktuell in [Spiel und Bedienung](gameplay.md#offen-nicht-zur-umsetzung-freigegeben), technische Risiken in [Architektur](architecture.md#schutzgrenzen-und-offene-architekturfragen).
