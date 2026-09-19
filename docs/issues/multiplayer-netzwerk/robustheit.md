# Multiplayer: Robustheit bei Mobilfunk und Netzwechsel

## Befund und Ziel

Mehrere menschliche Tests über ein Mobilfunknetz endeten durch Verbindungsabbruch. Die konkrete Ursache ist ohne Verbindungsmetriken noch nicht unterscheidbar. Der aktuelle Prototyp verschärft jedoch typische Mobilfunkstörungen:

- Der Server beendet beim `close` eines WebSockets sofort den Raum für beide Parteien. Parteiidentität und ausstehende Befehle hängen an der konkreten Verbindung.
- Der Heartbeat terminiert nach einem unbeantworteten Ping-Intervall von ungefähr fünf Sekunden. Der Browser beendet bei `error`/`close` sofort und versucht keinen Neuaufbau.
- Vollständige sichtgefilterte Zustände werden unkomprimiert als JSON mit 10 Hz über einen geordneten WebSocket gesendet. Der vorhandene Hochlastbefund von etwa 1,4 MiB/s je Raum ist für Mobilfunk relevant. Ab 1 MiB ausgehendem WebSocket-Puffer terminiert der Server die Verbindung.
- Telemetrie und Prüfungen für Jitter, Burst-Loss, Bandbreitenengpässe, Hintergrundphasen und Wiederverbindung fehlen.

Ziel ist, kurze Funklöcher, App-Hintergrundphasen und Wi-Fi-/Mobilfunkwechsel zu überstehen, ohne Befehle doppelt auszuführen oder verborgenen Zustand offenzulegen. Server- oder Prozessneustarts bleiben zunächst ausdrücklich nicht wiederherstellbar.

## Architekturentscheidung für dieses Paket

Der bestehende autoritative Serverzustand bleibt maßgeblich. Bei Wiederverbindung erhält der Browser eine neue aktuelle, sichtgefilterte Vollansicht; dafür ist kein vollständiger Simulationssnapshot nötig. Die Ressourcen-Erinnerung einer Partei und ihre Befehlsbuchhaltung müssen dafür mit dem Spielerplatz statt mit dem Socket leben.

Die in der [Recherche](../../research/multiplayer-network.md) beschriebene serversequenzierte Command-/Client-Simulation ist ein eigener späterer Architekturauftrag. Der Browser simuliert heute ausdrücklich nicht; vollständige Snapshots, zugängliche RNG-Zustände, Command-Log, State-Hashes und plattformübergreifend abgesicherter Determinismus fehlen. Diese Umstellung nicht mit der Behebung aktueller Abbrüche vermischen.

## Umsetzungspakete

### P0 – Diagnose und messbare Verbindungszustände

- [x] Servermetriken für Verbindungsaufbau, Close-Code/-Grund, Heartbeat-Timeout, gesendete Bytes, `bufferedAmount` und Zustandsframes ergänzen. Strukturierte Ereignisse enthalten keine Raumcodes, Aktionsinhalte oder künftigen Resume-Tokens.
- [x] Clientseitige Verbindungsphasen und technische Gründe für Socketfehler/-Close und lokalen Timeout erfassen, ohne interne Details als Spielermeldung auszugeben.
- [x] Sendetakt, Heartbeat- und Zeitquellen so kapseln, dass kurze Integrationstests sie kontrollieren können.
- [ ] Reconnect-Versuche und Resume-Ablehnungen instrumentieren, sobald P1 diese Zustände einführt; `stateFramesSkipped` mit der P1-Backpressure-Logik hochzählen.

Die Diagnostikgrundlage ist umgesetzt. Serverseitig stehen Lebenszyklusereignisse, periodische Prozesszähler und eine abfragbare Momentaufnahme bereit; der Browser kennzeichnet Phasenwechsel unter `[multiplayer]` in der Entwicklerkonsole. Das ist noch kein persistentes Monitoring und ändert weder Heartbeat-Toleranz noch Abbruchverhalten.

**Herausforderung:** Browser, Reverse-Proxy und Server melden denselben Netzwechsel oft nur als generischen abnormalen Close. Telemetrie kann die Schicht eingrenzen, aber nicht jeden Funkfehler exakt beweisen.

### P1 – Spielerplatz, Resume-Protokoll und Befehlsintegrität

- Raumteilnehmer als langlebigen Spielerplatz modellieren; WebSocket, Onlinezustand und letzter Pong sind austauschbare Transportdaten.
- Beim Start pro Spieler ein kryptographisch zufälliges, mindestens 128 Bit starkes Resume-Token ausgeben. Der Raumcode bleibt nur Beitrittscode und darf keine Übernahme erlauben.
- Bei Transportverlust den Raum 30–60 Sekunden weiterlaufen lassen. Ein gültiges Resume ersetzt ausschließlich den Socket desselben Spielerplatzes; abgelaufene, falsche oder bereits ersetzte Tokens werden abgewiesen.
- `lastRequest`, Zuordnung von Simulationsticket zu Clientrequest, letzte Ergebnisse und Ressourcen-Erinnerung am Spielerplatz erhalten. Resume bestätigt den bekannten Befehlsstand, damit unklare Requests weder verloren noch blind doppelt ausgeführt werden.
- Nach erfolgreichem Resume eine frische Vollansicht senden, Interpolation und flüchtige Effekte clientseitig neu aufsetzen und alte Effekte nicht nachspielen.
- Ablauf der Schonfrist beendet die Sitzung wie bisher für beide. Absichtliches Verlassen umgeht die Wiederwahl und beendet unmittelbar.

**Herausforderungen:** Race zwischen altem und neuem Socket, Token-Diebstahl, ein Disconnect zwischen Annahme und Ergebnis eines Befehls sowie genau-einmalige Ausführung trotz Wiederholung. Der Server bleibt die einzige Instanz, die Befehle dedupliziert; Clientrequest-IDs müssen eine Wiederverbindung überleben.

### P1 – Automatische Wiederwahl und toleranter Heartbeat

- Client bei unerwartetem `error`/`close` im Gefecht halten, Eingaben sperren und mit begrenztem exponentiellem Backoff wiederverbinden. `online`, Sichtbarkeitswechsel und Nutzerrückkehr dürfen einen Versuch vorziehen, aber keine parallelen Sockets erzeugen.
- Reconnect nach Erfolg transparent auflösen; bei endgültiger Ablehnung oder abgelaufener Schonfrist kontrolliert ins Menü wechseln.
- Heartbeat anhand eines Zeitstempels statt eines einzelnen verpassten Pong bewerten. Timeout, Client-Watchdog und Resume-Schonfrist aufeinander abstimmen.
- Dem verbundenen Gegner den vorübergehend getrennten Status anzeigen, ohne Netzwerkdetails oder Token offenzulegen. Die Simulation pausiert nicht.

**Herausforderung:** Mobile Browser können JavaScript-Timer im Hintergrund stark drosseln oder die Seite vollständig suspendieren. Korrektheit darf deshalb nicht von pünktlichen Clienttimern abhängen.

### P1 – Backpressure ohne Sitzungsabbruch

- Ersetzbare Zustandsframes nicht erzeugen oder senden, solange der Socket einen definierten Rückstau hat; später reicht die neueste Vollansicht. Ein hoher Puffer darf nicht unmittelbar den ganzen Raum beenden.
- Kontrollnachrichten und Befehlsausgänge klein halten und vor weiterem Zustandstraffic schützen. WebSocket kann bereits eingereihte Bytes nicht priorisieren oder zurücknehmen, daher muss der Rückstau früh begrenzt werden.
- Ereignispuffer bewusst behandeln: flüchtige Audio-/Grafikeffekte dürfen bei Rückstau entfallen, Befehlsausgänge und Sitzungszustände nicht. Die Projektion darf Ereignisse erst dann unwiederbringlich leeren, wenn ihre Behandlung feststeht.
- Dauerhaft nicht lesende Verbindungen nach großzügigem Timeout in den normalen Resume-Pfad überführen; Speicher und Puffer bleiben strikt begrenzt.

**Herausforderung:** Alle Nachrichten teilen weiterhin den geordneten TCP/WebSocket-Strom. Frame-Dropping verhindert neuen Rückstau, beseitigt aber keine bereits blockierten Bytes.

### P2 – Bandbreite und Sendetakt

Erst nach P0 messen und dann die kleinste wirksame Variante wählen:

1. adaptive Zustandsrate bei Rückstau oder hoher RTT,
2. gemessene WebSocket-Kompression mit CPU-/Latenzgrenzen,
3. Deltaframes mit regelmäßigen Voll-Keyframes und expliziten Löschungen,
4. erst bei weiterem Bedarf ein kompaktes Binärformat.

Fog, Sichtkontakte, neutrale Ressourcen-Erinnerung und private Felder müssen bei jeder Variante unverändert geschützt bleiben. Deltaframes benötigen eine belastbare Basis-/Sequenzkennung; nach Lücke oder Resume folgt immer ein Voll-Keyframe. Eine Protokolländerung erhöht die Version und wird gemeinsam mit Client und Server ausgerollt.

**Herausforderungen:** JSON komprimiert gut, kann aber CPU-Spitzen auf dem seriellen Node-Prozess erhöhen. Deltaframes sparen Egress, erhöhen dagegen Zustands- und Fehlerkomplexität. Werte erst auf der Ziel-VM und unter realistischen Mobilfunkprofilen vergleichen.

### P2 – Netzwerksimulation und Abnahme

- Serverintegrationstests für Socketverlust und Resume beider Parteien, ungültige/abgelaufene Tokens, Ersetzen eines alten Sockets, weiterlaufende Simulation und Schonfristende ergänzen.
- Befehle rund um den Abbruch testen: vor Annahme verloren, angenommen ohne zugestelltes Ack, Ergebnis während Trennung und wiederholte Request-ID. Kein Fall darf eine Aktion doppelt ausführen.
- Backpressure mit kontrolliert langsamem Empfänger prüfen: Speicher bleibt begrenzt, Zustandsframes dürfen entfallen, Kontrollnachrichten und der andere Spieler bleiben funktionsfähig.
- Einen reproduzierbaren Netzwerktest für Latenz, Jitter, Burst-Loss, Bandbreitenlimit und kurze Unterbrechung vorsehen. Umfangreiche Last-/Simulationsläufe bleiben gesondert freigabepflichtig.
- Abschließend zwei echte Geräte über Mobilfunk beziehungsweise Wi-Fi-Wechsel prüfen. Automatische Tests ersetzen diese menschliche Geräteabnahme nicht.

## Abnahmekriterien des Robustheitspakets

- Eine kurze Unterbrechung innerhalb der Schonfrist führt zurück in dieselbe Partei und laufende Simulation.
- Kein Befehl wird durch Wiederwahl doppelt ausgeführt; bekannte Ergebnisse werden korrekt aufgelöst.
- Der Gegner und der Server laufen während der Schonfrist weiter; nach Fristablauf endet die Sitzung eindeutig.
- Rückstau erzeugt keine unbeschränkt wachsenden Puffer und beendet nicht allein wegen ersetzbarer Zustandsframes den Raum.
- Logs und Metriken unterscheiden mindestens normalen Leave, Transportverlust, Heartbeat-Timeout, Backpressure, erfolgreichen Resume und abgelaufene Schonfrist.
- Bandbreite, Tick-p95/p99, CPU und RSS werden auf der Zielklasse vor und nach P2 verglichen; die Raumgrenze wird dabei nicht nebenbei erhöht.

## Nicht-Ziele

- Wiederherstellung nach Serverprozess-, Container- oder Hostausfall,
- Replays, Zuschauer oder persistente Matchspeicherung,
- QUIC/WebTransport oder clientseitige deterministische Simulation,
- drei/vier menschliche Parteien, KI, Expeditionen, Belohnungen oder neue Siegbedingungen.
