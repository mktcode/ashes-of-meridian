# Multiplayer später neu bewerten

**Zurückgestellt, kein Implementierungsauftrag.** Das Spiel ist Singleplayer-only; Netzwerkclient, Protokoll und Server gehören nicht zum aktuellen Produkt. Erst stabile grundlegende Spielmechaniken rechtfertigen eine neue Entscheidung. Gemeinsame Parteizustände, validierte Aktionen, lokale Szenarien und die Trennung von Simulation/Darstellung bleiben sinnvoller [Unterbau](../architecture.md), keine Zusage eines Netzwerkmodus.

## Vor einer erneuten Freigabe

- [ ] Produktregeln bestimmen: Menschen/KI/Parteien, FFA oder andere Beziehungen, Sieg/Ausscheiden/Aufgabe, Pause/Tempo und Umgang mit fehlenden Spielern.
- [ ] Roguelite-Regeln klären: Run-Besitz, Vorteilswahl, persönliche Upgrades, Belohnungen, Speichern/Fortsetzen, Wiedereinstieg und Host-Ausfall. Lokales Profil/Checkpoint nicht vorsorglich verändern.
- [ ] Architektur anhand konkreter Anforderungen wählen: Autorität, synchronisierte Aktionen oder Ansichten, Content-Identität, Sicht-/Informationsgrenzen und gegebenenfalls Replay/Restore. Eine Parteiansicht ist kein vollständiger Snapshot.
- [ ] Betriebs- und Missbrauchsschutz planen: Authentifizierung, Origin-/Contentprüfung, Deduplizierung, Begrenzungen, Heartbeat, Backpressure, Wiederverbindung und klare Fehler-/Abbruchregeln.
- [ ] Performance auf Zielhardware messen: Tick-p95/p99, verfehlte Termine, CPU/RSS, tatsächlich übertragene Bytes, Client-Framezeiten und begrenzte Puffer. Binär-/Deltaformate, Kompression oder zusätzliche Räume nur bei gemessenem Bedarf.
- [ ] Zwei reale Geräte unter Latenz/Jitter/Burst-Loss, geringer Bandbreite und Mobilfunk/Wi-Fi-Wechsel abnehmen; Bedienung, Sicht, Bewegung, Audio und faire Kartenstarts beurteilen. Technische lokale Checks ersetzen keine Internet-/Geräteabnahme.

Frühere menschliche Mobilfunkproben brachen mehrfach ab; Ursache blieb ohne geeignete Metriken unklar. Alte lokale Kapazitätswerte sind weder Zielmaschinen-Nachweis noch Budget für einen zukünftigen Entwurf. Der frühere Prototyp bleibt bei Bedarf in Git nachlesbar, nicht als ruhende Laufzeitfunktion.

## Betrieb bereinigen

- [ ] Einen gegebenenfalls noch betriebenen separaten Multiplayerdienst und seinen öffentlichen Endpunkt außerhalb dieses Repositories abschalten. Keine automatische Deployment-/Infrastrukturänderung durch den Quellcodeumbau.

Singleplayer-Performance bleibt separat unter [Mobile Performance](mobile-performance.md); autonome Mehrparteien-KI-Prüfung unter [Simulation](mehrparteien-simulation.md). Neue umfangreiche Messungen nur nach [Freigabe](../testing.md).
