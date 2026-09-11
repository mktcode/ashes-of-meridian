# Arbeitsprotokoll

Einzige fortlaufende Änderungshistorie unter `docs/`. Neue Einträge kurz nach oben setzen: Änderung, tatsächlich ausgeführte Prüfung und relevante Grenzen. Kleine zusammengehörige Schritte bündeln; ältere Einträge regelmäßig verdichten. Referenzen beschreiben den Ist-Zustand, frühere Details bleiben in Git.

## Rallypoint nur über das Aktionsmenü

- Automatische Rally-Zuweisung durch Bewegungs-/Kontextbefehle entfernt. Normale Boden-Taps/-Klicks und Minimap-Rechtsklick wählen Gebäude ab; Kamera-Gesten und explizite Rally-Zielauswahl bleiben erhalten.
- **175 Node-Tests bestanden**, feste Referenzen unverändert; `git diff --check` sauber. Gezielter `file://`-Check in Chromium, 390×844/Performance: native Gebäudeauswahl, Touch-/Maus-Abwahl, Rally-Button/Zielbestätigung und Minimap-Rechtsklick bestanden, keine erfassten Fehler. Kontrollierte angehaltene Simulation, kein Echtgerätetest.

## Portrait-Deck und globale Rekrutierung

- Aufklärer aus Katalog, Fraktionsnamen/Icon, Modell, Startaufgebot, Vorschau und Wellen entfernt. Sein Wellenanteil wird Rifle, Startversorgung −2; ein reserviertes Spawn-RNG-Sample erhält Kristallmengen. Alte Aufklärer in Entitäten oder Queues werden beim Laden abgewiesen, keine Migration.
- Minimap links auf halber Bildschirmbreite, rechts scrollbare Kategorien/Untermenüs mit Zurück. Infanterie enthält Worker und Kommandant. Fähigkeitenleiste dauerhaft darüber; Sell/Repair/Rally im festen Gebäudemenü, Fundamente mit Bauabbruch. Welt-Panel, Auswahlspalte und Command view entfernt; Gruppenauswahl berücksichtigt die tatsächlichen HUD-Kanten.
- Rekrutierung verteilt auf passende Gebäude-Queues, parallel mit gebundenem Spawn-Ort. Links aggregierte Typ-Symbole mit Zähler und kreisförmigem Fortschritt der nächsten Fertigstellung; Tap storniert einen Auftrag, wartende zuerst. Keine neue persistente Queue-Struktur.
- **172 Node-Tests bestanden**, einschließlich Verteilung/Spawn/Restore, Kategorien/Gebäudeaktionen, Queue-Aggregation/-Abbruch, HUD-Sperren und Gesten. Terrain-/Kristall-/Effekt-/RNG-Referenzen unverändert. `git diff --check` und Dokumentationslinks geprüft.
- Gezielt `file://` in Chromium 152, Headless/CDP-Touch, Performance: **390×844, 320×568, 430×932**. Native Menü-/Zurück-/Scroll-/Minimap-Aktionen und Fähigkeits-Cancel; bei 390×844 außerdem Gebäudeauswahl, Rally, Repair/Stop, Sell/Bestätigung, parallele Rekrutierung, alle sieben Queue-Typen samt Scrollen/Abbruch, Fortschritt, Pause, kontrollierter Restore und Bauabbruch. Screenshots angesehen; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler.
- Grenzen: kontrolliertes Setup, teils angehaltene Simulation/manuelle Schritte; kein Echtgerät-, Langzeit-, andere Browser-/Qualitätsstufen- oder Screenreader-Nachweis. Querformat/Desktop nicht optimiert. Kleine unveränderte Topbar-/Kameraknöpfe bleiben offen.

## Dokumentation und Arbeitsregeln (`664c2fb`)

Einzelberichte durch aktuelle Referenzen und dieses Protokoll ersetzt; `AGENTS.md` verlangt risikogerechte Prüfungen ohne zusätzliche Browserläufe für minimale Kosmetik sowie regelmäßige Bereinigung. Lokale Links/Anker und Diff geprüft, keine Spieltests für die reine Dokumentationsänderung.

## Zusammengefasste frühere Entwicklung

- Klassische lokale Skripte statt Inline-Monolith; Speicherung, CPU-Welt und kosmetische Effekte getrennt. Feste Referenzen schützen Terrain/RNG/Zeichenverhalten. Skybox-Einbettung, MSAA und modellfeste Texturen umgesetzt; damalige Chromium-GPU-Prüfungen waren positiv, keine aktuelle vollständige Grafikfreigabe.
- Desktop-Kamera, Hotkeys, Rechteck-/Shift-Auswahl, Kontrollgruppen, Befehls-Auftragsketten, Bauhilfe, Forschung und Tooltips entfernt. Arbeitergestützte Gebäude-Reparatur und bestätigter Verkauf ergänzt.
- `cbd37f2`: wiederholbare HQ-Gefechte statt Kampagne/Sondermodi; kostenlose permanente Test-Upgrades. `3e7705d`: Dreifachtap für sichtbare Nicht-Worker, Timing nur kontrolliert geprüft.
- `71952f3`: Schwierigkeit entfernt, frühere Standard-Regeln fest, Checkpoints v3. Drei 120-s-Vergleiche entsprachen nach Normalisierung der entfernten Felder dem vorherigen Standard-Zustand samt Effekten/Folge-RNG.
- `7f81c48` bis `565b108`: Hinweisleiste, Dekoration und sechs Befehlsbuttons entfernt; Boden-Tap auf Attack-move (Worker: move), Deck randbündig/rahmenlos. Damals 170 Node-Tests und fünf Chromium-Viewportchecks bestanden; durch den Portrait-Umbau als UI-Nachweis überholt.

Offene Punkte: [Spiel und Bedienung](gameplay.md#offen-nicht-zur-umsetzung-freigegeben) · [technische Risiken](architecture.md#schutzgrenzen-und-offene-architekturfragen).
