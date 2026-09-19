# Multiplayer: Zwei-Spieler-Prototyp und nächste Grenzen

Der freigegebene vertikale Prototyp ist umgesetzt: separater autoritativer [Server](../../../server/README.md), Session-Code, Kartenauswahl für alle drei Karten, zwei menschliche Parteien, serverseitig gefilterte Ansichten und Wiederaufnahme kurzer Verbindungsabbrüche. Einzelspiel bleibt dienstfrei über `file://`. Keine KI, Expeditionen, Belohnungen oder Wiederherstellung nach Serverneustart; Erweiterungen erst nach eigenem Auftrag.

- [ ] Menschlichen Zwei-Geräte-Playtest mit echter Verbindung durchführen; Bedienbarkeit, Latenz, Bewegungsglättung und Kampf-/Audio-Rückmeldung abnehmen. Vorhandener technischer Browsercheck ersetzt das nicht.
- [ ] Öffentlichen Betrieb absichern: Content-Hash-Handshake, Metadaten-/ID-Seitenkanäle und Missbrauchsschutz prüfen.
- [ ] Zwei volle Räume reproduzierbar auf der Ziel-VM messen: Tick-p99, verfehlte 50-ms-Intervalle, CPU, RSS und Egress. Lokale Nutzlast-, Tick-, CPU- und RSS-Metriken sowie ein kurzes Öffnungsprofil sind vorhanden; Raumgrenze vorher nicht erhöhen.
- [x] WebSocket-Kompression und adaptive Zustandsrate vor Skalierung umsetzen und kurz messen. Delta-/Binärframes bleiben vom nachgewiesenen weiteren Bedarf abhängig; Vollzustände erzeugten lokal unter hoher Sichtlast vor diesen Maßnahmen ca. 1,4 MiB/s je Raum.
- [ ] Erst nach Abnahme auf drei/vier menschliche Parteien erweitern; FFA beibehalten. KI und die [offenen Unterbau-Befunde](../multiplayer-simulationsmodell.md#offene-befunde-im-gemeinsamen-unterbau) separat behandeln.
- [ ] Zustandsumfang für spätere Wiederherstellung/Replays bestimmen, einschließlich Befehlsqueue/RNG. Die übertragene Sicht ist kein Simulationssnapshot; der Expeditionscheckpoint ebenfalls nicht.

- [ ] [Reviewbefunde](robustheit.md#offene-befunde-aus-dem-kurzen-code-review) zu verlorener Tokenrotation, Resume/Ready-Rennen, veralteten Clientfortsetzungen, Replay-Limits und Logdatenschutz vor weiteren Netzwerkerweiterungen beheben. Kleine Strukturverbesserungen erst durch Regressionstests absichern.

## Mobilfunkrobustheit

Mehrere menschliche Tests über ein Mobilfunknetz endeten durch Verbindungsabbruch. Diagnose, automatische Wiederwahl, Resume-Schonfrist, toleranterer Heartbeat, Backpressure-Behandlung, adaptive Zustandsrate und Transportkompression sind inzwischen technisch umgesetzt; Ziel-VM-, Zielgeräte- und vollständige Netzprofilabnahme bleiben offen. Befund, Prioritäten und Umsetzungspakete stehen im [Robustheitsplan](robustheit.md).

Prüfkontext: Kurze echte WebSocket-Verbindungen decken alle Karten, Akteursbindung, verborgene Gegner, Queue-Ergebnisse, geschlossene Räume und Abbruch ab. Synthetische Projektionstests prüfen verborgene Ziel-/Queue-Daten und Ressourcen-Gedächtnis. Ein gezielter `file://`-Browsercheck mit zwei isolierten Chromium-Profilen auf Mothership/Performance prüft Join, HUD-Rekrutierung, Worker-Bewegung beider Parteien, weiterlaufenden Server bei lokalem Menü, Abbruch und unveränderte lokale Speicherung. Der Darstellungscheck ergänzt Zwischenpositionen, FPS-/NET-Anzeige und Audioaufrufe für echte Produktionsereignisse; Schuss-/Artillerie-/Explosionsdarstellung wurde im Browser gezielt eingespeist, ihr serverseitiger Ursprung/Sichtschutz separat geprüft. Das separate Containerimage besteht Build, Healthcheck, Zwei-Verbindungs-Start und autoritative Befehlsausführung. Keine visuelle/akustische, Ziel-VM-/Produktionslast-, Echtgeräte- oder vollständige Internetabnahme.

Die [Befehls-/Perspektivgrenzen](../../architecture.md#teamzustand-sicht-und-ki) unterscheiden Einreihung und Ausführung. `src/app.ts` taktet nur Offline-Gefechte; im Netzwerkmodus liefert der Server Zustände. Prototyp-Sitzungsregeln stehen maßgeblich in der [Serverdokumentation](../../../server/README.md#ablauf-und-grenzen), dauerhafte Spiel-/Expeditionsregeln bleiben im [Regelpaket](../multiplayer-expeditionen.md) offen.
