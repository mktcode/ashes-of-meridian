# Multiplayer: Spielmechanik und Expeditionen später definieren

**Blockiert bis zur gemeinsamen Regelplanung; nicht Teil der technischen Vorbereitung.** Roguelite-Charakter und Expeditionen im Multiplayer sind das Ziel. Vorerst gilt ausschließlich jeder gegen jeden gemäß [Rahmen](multiplayer-rahmen.md); der technische Prototyp nutzt zwei menschliche Parteien, die spätere Zusammensetzung und Expeditionsregeln bleiben offen.

- [ ] Verhältnis menschlicher Spieler, Parteien und KI für jeder gegen jeden bestimmen; keine 2on2-/Allianzplanung im aktuellen Umfang.
- [ ] Sieg, Ausscheiden, Niederlage, Aufgabe, Pause/Tempo und Umgang mit fehlenden Spielern dauerhaft definieren. Die begrenzten [Prototyp-Sitzungsregeln](../../server/README.md#ablauf-und-grenzen) ersetzen diese Produktentscheidungen nicht.
- [ ] Gemeinsamen Run, Vorteilswahl, persönliche Flottenupgrades, Nachhall-Auszahlung und Freischaltungen gestalten; Gegneraufstellung und Progression entscheiden.
- [ ] Run-Besitz, Speichern/Fortsetzen, Wiedereinstieg und Host-Ausfall regeln; erst danach Checkpoint und Ergebnisfluss verändern.
- [ ] Karten-/Ressourcenbalance und Schwierigkeit später mit menschlichen Runs bewerten, nicht aus der Zahl der Startpunkte ableiten.

Heute schreibt `src/ui/core.ts` ein lokales Profil und einen Einzelspieler-Run fort. Diese Regeln und Speicherformate bleiben während der [Vorbereitung](multiplayer-rahmen.md) unverändert; keine Migrationen oder vorgezogenen Multiplayerbelohnungen.
