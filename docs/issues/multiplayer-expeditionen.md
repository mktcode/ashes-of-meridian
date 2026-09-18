# Multiplayer: Spielmechanik und Expeditionen später definieren

**Blockiert bis zur gemeinsamen Regelplanung; nicht Teil der technischen Vorbereitung.** Roguelite-Charakter und Expeditionen im Multiplayer sind das Ziel, Koop/PvP und Spielerzahl noch nicht festgelegt.

- [ ] Verhältnis menschlicher Spieler, Parteien, KI und Allianzen bestimmen; eigene/geteilte Kontrolle und Sicht klären.
- [ ] Sieg, Ausscheiden, Niederlage, Aufgabe, Pause/Tempo und Umgang mit fehlenden Spielern definieren.
- [ ] Gemeinsamen Run, Vorteilswahl, persönliche Flottenupgrades, Aether-Auszahlung und Freischaltungen gestalten; Gegneraufstellung und Progression entscheiden.
- [ ] Run-Besitz, Speichern/Fortsetzen, Wiedereinstieg und Host-Ausfall regeln; erst danach Checkpoint und Ergebnisfluss verändern.
- [ ] Karten-/Ressourcenbalance und Schwierigkeit später mit menschlichen Runs bewerten, nicht aus der Zahl der Startpunkte ableiten.

Heute schreibt `src/ui/core.ts` ein lokales Profil und einen Einzelspieler-Run fort. Diese Regeln und Speicherformate bleiben während der [Vorbereitung](multiplayer-rahmen.md) unverändert; keine Migrationen oder vorgezogenen Multiplayerbelohnungen.
