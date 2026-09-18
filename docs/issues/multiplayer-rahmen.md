# Multiplayer: technische Vorbereitung und Reihenfolge

**Nur Vorbereitung; Umsetzung erst nach ausdrücklichem Go.** Bestehendes Einzelspiel, Roguelite-Fortschritt, RNG-Verträge und direkte `file://`-Auslieferung bleiben erhalten. Keine neuen Spielmodi oder Netzwerkdienste in dieser Phase.

1. [Simulationsmodell](multiplayer-simulationsmodell.md): Parteien/Controller trennen, zunächst bei unverändertem Zwei-Parteien-Spiel.
2. Ebendort: interne 3–4-Parteien-Szenarien und technische Start-/Sicht-/Aktionsprüfungen ergänzen; kein öffentlich spielbarer Modus.
3. [Perspektive und Karten](multiplayer-karten-und-darstellung.md): lokale Darstellung entkoppeln und technische Karten-/Lastgrenzen prüfen.
4. [Netzwerk-Vorbereitung](multiplayer-netzwerk.md): Befehls-, Tick- und Zustandsgrenzen klären; Transportprototyp erst mit separater Freigabe.
5. [Spielmechanik und Expeditionen](multiplayer-expeditionen.md): später gemeinsam definieren, bis dahin blockiert.

Technisches Ziel: bis zu vier Parteien, unabhängig von Fraktion und Controller. Vier Startbereiche bedeuten weder vier menschliche Spieler noch vier Menschen plus zusätzliche KI-Parteien. Allianzen, geteilte Kontrolle und Ergebnisse bleiben offene Spielregeln; Tests dürfen dafür explizite Szenariovorgaben nutzen, keine versteckten Produktentscheidungen.
