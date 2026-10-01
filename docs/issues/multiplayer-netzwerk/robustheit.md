# Multiplayer: Netzrobustheit und Kapazität

Menschliche Mobilfunktests brachen mehrfach ab; konkrete Ursache ohne Metriken unklar. Resume/Tokenrotation, Deduplizierung, Wiederwahl, Heartbeat/Backpressure, adaptive Rate und Kompression sind integriert. [Protokollvertrag](../../../server/README.md#ablauf-und-grenzen). WebSocket-Dropping beseitigt keine bereits blockierten TCP-Bytes; Clienttimer können suspendieren.

## Offene Messung und Abnahme

- [ ] `server/scripts/measure-network.mjs` reproduzierbar machen: feste Fixtures, tatsächlicher Kartenkatalog/Transport und verstrichene Zeit statt zufälliger Seeds, fehlendem Westmark und nominaler Rate. Roh-Deflate ist nicht der ausgehandelte WebSocket-Pfad.
- [ ] Zwei volle Räume auf Ziel-VM: Tick-p95/p99, verfehlte 50-ms-Intervalle, CPU/RSS, tatsächlicher Egress. Nutzbytes vor Kompression sind kein Egress. Grenze nicht nebenbei erhöhen.
- [ ] Netzprofile für Latenz/Jitter/Burst-Loss/Bandbreite/Unterbrechung nach eigener Freigabe.
- [ ] Zwei Geräte mit Mobilfunk/Wi-Fi-Wechsel: gleiche Partei wiederaufnehmen, keine doppelten Befehle, klare Ergebnisse/Fristenden und begrenzte Puffer; Server/Gegner laufen weiter.
- [ ] Delta-/Binärframes nur nach Mehrbedarfsnachweis; Basis/Sequenzen, Löschungen und Vollframes nach Lücke müssen explizit sein.

Kapazitätsgrundlage: lokaler Ryzen-7-5700G-Benchmark mit 20 Ticks/10 Frames je Sekunde, hoher Last (200 Einheiten/38 Gebäude zusätzlich) etwa 13–19 % eines Kerns und 1,4 MiB/s unkomprimierte Daten je Raum. Zwei Räume p99 29 ms/max 38 ms, vier p99 63 ms/max 80 ms pro 50-ms-Intervall. Kein Ziel-VM-Nachweis oder SLA; Kompression/adaptive Rate ändern den Transportvergleich.

Client-Lebenszyklus/Transportpolitik nur bei belegtem Bedarf strukturell trennen, kein breites Refactoring. Client-Simulation/Command-Log/Lockstep ist ein eigener nicht freigegebener Architekturauftrag; Snapshots, RNG-Zustände und plattformübergreifender Determinismus fehlen. Keine Prozesswiederherstellung, Zuschauer oder persistente Matches.
