# Holdout: zurückgestellter Missionspilot

**Produktidee, kein Implementierungsauftrag.** Auf dedizierter Karte Wirtschaft/Basis aufbauen und HQ gegen angekündigte Wellen bis zum Einsatzende halten. Der vorhandene [Missionsvertrag](../architecture.md#einzelspieler-missionen) ist keine Wellenregie; ein bloßer Timer mit Standard-KI wäre nicht derselbe Spielmodus.

## Vor Umsetzung entscheiden

- [ ] Schutzobjekt, Dauer/Vorbereitungszeit, Wellentakt/-richtungen/-zusammensetzung und Schlusswelle.
- [ ] Gegnerökonomie: separater transparenter Wellenetat statt normaler Basisbau-KI? Bestehende Gegner-Vorteile brauchen sinnvolle explizite Wirkung; nicht ignorieren oder heimlich in Buffs umwandeln.
- [ ] Startwirtschaft, sichere/umkämpfte Ressourcen, Bauzone und Gegenregel für vollständig verbaute Eingänge.
- [ ] Eintrittstiefe, Auswahlgewicht, Belohnung/Progression und Gleichzeitigkeit von Timer/HQ-Verlust; Empfehlung: Niederlage hat Vorrang.

## Schutzverträge für einen späteren Auftrag

Missionszustand/Ergebnis/Wellenzeit gehören in Simulation, räumliche Anker ins Kartenrezept; UI liest nur. Encounter speichert den Anfang, niemals laufende Timer/Entitäten. Eigener seed-/missionsabgeleiteter Wellenstream erhält Terrain-/Kampf-RNG; Reload erzeugt denselben Plan. Spawnfehler brauchen begrenzte deterministische Behandlung, keine Teleports oder direkten Schadensskripte. Nach Ergebnis keine weiteren Wellen/Auszahlungen.

Pilot getrennt in Simulation, Karte und UI/Expedition umsetzen; keine generische Skriptsprache, Multiplayer-Mission oder beiläufige Änderung bestehender KI/Karten. Abnahme: reproduzierbare Wellen, reguläre Navigation/Kämpfe, eindeutiges Ergebnis und verständliche Warnungen; Spielspaß/Schwierigkeit menschlich. [Prüfwahl](../testing.md).
