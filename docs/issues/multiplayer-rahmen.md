# Multiplayer: technische Vorbereitung und Reihenfolge

**Nur Vorbereitung; weitere Pakete erst nach eigenem Go.** Bestehendes Einzelspiel, Roguelite-Fortschritt, RNG-Verträge und direkte `file://`-Auslieferung bleiben erhalten. Keine neuen Spielmodi oder Netzwerkdienste in dieser Phase.

1. [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md): den [internen CPU-Szenariovertrag](../architecture.md#teamzustand-sicht-und-ki) gezielt abnehmen; kurze Start-/KI-Prüfungen separat freigeben, keine vollständigen Partien auf Vorrat.
2. [Perspektive und Karten](multiplayer-karten-und-darstellung.md): lokale Darstellung entkoppeln und technische Karten-/Lastgrenzen prüfen.
3. [Netzwerk-Vorbereitung](multiplayer-netzwerk.md): Befehls-, Tick- und Zustandsgrenzen klären; Transportprototyp erst mit separater Freigabe.
4. [Spielmechanik und Expeditionen](multiplayer-expeditionen.md): später gemeinsam definieren, bis dahin blockiert.

Technisches Ziel: bis zu vier Parteien, unabhängig von Fraktion und Controller. Vier Startbereiche bedeuten weder vier menschliche Spieler noch vier Menschen plus zusätzliche KI-Parteien. Allianzen, geteilte Kontrolle und Ergebnisse bleiben offene Spielregeln; Tests dürfen dafür explizite Szenariovorgaben nutzen, keine versteckten Produktentscheidungen.
