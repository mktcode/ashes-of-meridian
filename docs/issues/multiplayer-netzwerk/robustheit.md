# Multiplayer: Robustheit bei Mobilfunk und Netzwechsel

## Befund und Ziel

Mehrere menschliche Tests über ein Mobilfunknetz endeten durch Verbindungsabbruch. Die konkrete Ursache war ohne Verbindungsmetriken nicht unterscheidbar. Die Ausgangslage verschärfte typische Mobilfunkstörungen:

- Jeder WebSocket-`close` beendete sofort den Raum für beide Parteien; Parteiidentität und ausstehende Befehle hingen an der konkreten Verbindung.
- Der Heartbeat terminierte nach einem unbeantworteten Ping-Intervall von ungefähr fünf Sekunden. Der Browser beendete bei `error`/`close` sofort und versuchte keinen Neuaufbau.
- Vollständige sichtgefilterte Zustände wurden unkomprimiert als JSON mit 10 Hz über einen geordneten WebSocket gesendet. Der vorhandene Hochlastbefund von etwa 1,4 MiB/s je Raum bleibt für Mobilfunk relevant; P1/P2 ergänzen inzwischen Frame-Dropping, adaptive Rate und Transportkompression.
- Telemetrie und Prüfungen für Jitter, Burst-Loss, Bandbreitenengpässe, Hintergrundphasen und Wiederverbindung fehlten.

Ziel ist, kurze Funklöcher, App-Hintergrundphasen und Wi-Fi-/Mobilfunkwechsel zu überstehen, ohne Befehle doppelt auszuführen oder verborgenen Zustand offenzulegen. Server- oder Prozessneustarts bleiben zunächst ausdrücklich nicht wiederherstellbar.

## Architekturentscheidung für dieses Paket

Der bestehende autoritative Serverzustand bleibt maßgeblich. Bei Wiederverbindung erhält der Browser eine neue aktuelle, sichtgefilterte Vollansicht; dafür ist kein vollständiger Simulationssnapshot nötig. Die Ressourcen-Erinnerung einer Partei und ihre Befehlsbuchhaltung müssen dafür mit dem Spielerplatz statt mit dem Socket leben.

Die in der [Recherche](../../research/multiplayer-network.md) beschriebene serversequenzierte Command-/Client-Simulation ist ein eigener späterer Architekturauftrag. Der Browser simuliert heute ausdrücklich nicht; vollständige Snapshots, zugängliche RNG-Zustände, Command-Log, State-Hashes und plattformübergreifend abgesicherter Determinismus fehlen. Diese Umstellung nicht mit der Behebung aktueller Abbrüche vermischen.

## Umsetzungspakete

### P0 – Diagnose und messbare Verbindungszustände

- [x] Servermetriken für Verbindungsaufbau, Close-Code/-Grund, Heartbeat-Timeout, gesendete Bytes, `bufferedAmount` und Zustandsframes ergänzen. Strukturierte Ereignisse enthalten keine Raumcodes, Aktionsinhalte oder künftigen Resume-Tokens.
- [x] Clientseitige Verbindungsphasen und technische Gründe für Socketfehler/-Close und lokalen Timeout erfassen, ohne interne Details als Spielermeldung auszugeben.
- [x] Sendetakt, Heartbeat- und Zeitquellen so kapseln, dass kurze Integrationstests sie kontrollieren können.
- [x] Reconnect-Versuche und Resume-Ablehnungen instrumentieren; `stateFramesSkipped` mit der P1-Backpressure-Logik hochzählen.

Die Diagnostikgrundlage ist umgesetzt. Serverseitig stehen Lebenszyklusereignisse, periodische Prozesszähler und eine abfragbare Momentaufnahme bereit; der Browser kennzeichnet Phasenwechsel unter `[multiplayer]` in der Entwicklerkonsole. Das ist noch kein persistentes Monitoring.

**Herausforderung:** Browser, Reverse-Proxy und Server melden denselben Netzwechsel oft nur als generischen abnormalen Close. Telemetrie kann die Schicht eingrenzen, aber nicht jeden Funkfehler exakt beweisen.

### P1 – Spielerplatz, Resume-Protokoll und Befehlsintegrität

- [x] Raumteilnehmer als langlebigen Spielerplatz modellieren; WebSocket, Onlinezustand und letzter Pong sind austauschbare Transportdaten.
- [x] Beim Start pro Spieler ein kryptographisch zufälliges, mindestens 128 Bit starkes Resume-Token ausgeben. Der Raumcode bleibt nur Beitrittscode und darf keine Übernahme erlauben.
- [x] Bei Transportverlust den Raum 30–60 Sekunden weiterlaufen lassen. Ein gültiges Resume ersetzt ausschließlich den Socket desselben Spielerplatzes; abgelaufene, falsche oder nach bestätigter Rotation ersetzte Tokens werden abgewiesen.
- [x] `lastRequest`, Zuordnung von Simulationsticket zu Clientrequest, letzte Ergebnisse und Ressourcen-Erinnerung am Spielerplatz erhalten. Resume bestätigt den bekannten Befehlsstand, damit unklare Requests weder verloren noch blind doppelt ausgeführt werden.
- [x] Nach erfolgreichem Resume eine frische Vollansicht senden, Interpolation und flüchtige Effekte clientseitig neu aufsetzen und alte Effekte nicht nachspielen.
- [x] Ablauf der Schonfrist beendet die Sitzung wie bisher für beide. Absichtliches Verlassen umgeht die Wiederwahl und beendet unmittelbar.

**Herausforderungen:** Race zwischen altem und neuem Socket, Token-Diebstahl, ein Disconnect zwischen Annahme und Ergebnis eines Befehls sowie genau-einmalige Ausführung trotz Wiederholung. Der Server bleibt die einzige Instanz, die Befehle dedupliziert; Clientrequest-IDs müssen eine Wiederverbindung überleben.

### P1 – Automatische Wiederwahl und toleranter Heartbeat

- [x] Client bei unerwartetem `error`/`close` im Gefecht halten, Eingaben sperren und mit begrenztem exponentiellem Backoff wiederverbinden. `online`, Sichtbarkeitswechsel und Nutzerrückkehr dürfen einen Versuch vorziehen, aber keine parallelen Sockets erzeugen.
- [x] Reconnect nach Erfolg transparent auflösen; bei endgültiger Ablehnung oder abgelaufener Schonfrist kontrolliert ins Menü wechseln.
- [x] Heartbeat anhand eines Zeitstempels statt eines einzelnen verpassten Pong bewerten. Timeout, Client-Watchdog und Resume-Schonfrist aufeinander abstimmen.
- [x] Dem verbundenen Gegner den vorübergehend getrennten Status anzeigen, ohne Netzwerkdetails oder Token offenzulegen. Die Simulation pausiert nicht.

**Herausforderung:** Mobile Browser können JavaScript-Timer im Hintergrund stark drosseln oder die Seite vollständig suspendieren. Korrektheit darf deshalb nicht von pünktlichen Clienttimern abhängen.

### P1 – Backpressure ohne Sitzungsabbruch

- [x] Ersetzbare Zustandsframes nicht erzeugen oder senden, solange der Socket einen definierten Rückstau hat; später reicht die neueste Vollansicht. Ein hoher Puffer darf nicht unmittelbar den ganzen Raum beenden.
- [x] Kontrollnachrichten und Befehlsausgänge klein halten und vor weiterem Zustandstraffic schützen. WebSocket kann bereits eingereihte Bytes nicht priorisieren oder zurücknehmen, daher muss der Rückstau früh begrenzt werden.
- [x] Ereignispuffer bewusst behandeln: flüchtige Audio-/Grafikeffekte dürfen bei Rückstau entfallen, Befehlsausgänge und Sitzungszustände nicht. Die Projektion darf Ereignisse erst dann unwiederbringlich leeren, wenn ihre Behandlung feststeht.
- [x] Dauerhaft nicht lesende Verbindungen nach großzügigem Timeout in den normalen Resume-Pfad überführen; Speicher und Puffer bleiben strikt begrenzt.

**Herausforderung:** Alle Nachrichten teilen weiterhin den geordneten TCP/WebSocket-Strom. Frame-Dropping verhindert neuen Rückstau, beseitigt aber keine bereits blockierten Bytes.

### P2 – Bandbreite und Sendetakt

Die kleinsten Varianten sind umgesetzt und messbar:

1. [x] Zustandsrate bei geglätteter RTT ab 400/800 ms von 10 auf 5/2,5 Hz reduzieren; Backpressure lässt Frames weiterhin vor Projektion und Serialisierung aus.
2. [x] WebSocket-Deflate Level 3 ab 1 KiB ohne Kontextübernahme aushandeln. Der kurze reproduzierbare Öffnungsprofil-Lauf zeigt lokal je nach Karte ungefähr 25–35 % der unkomprimierten Nutzlast bei Kompressions-p95 unter 0,3 ms; das ist kein Hochlast- oder Ziel-VM-Nachweis.
3. [ ] Deltaframes mit regelmäßigen Voll-Keyframes und expliziten Löschungen nur bei nachgewiesenem weiterem Bedarf entwickeln.
4. [ ] Ein kompaktes Binärformat ebenfalls nur bei weiterem Bedarf erwägen.

`npm run measure:network --prefix server` misst das kurze, ruhende Öffnungsprofil derzeit auf Desert, Alien Planet und Mothership; Westmark fehlt im manuell gepflegten Messkatalog. Die Betriebsmetriken trennen logische Kontroll-/Zustandsbytes und ergänzen Frame-Maximum, Tick-p95/p99, CPU und RSS. Für den tatsächlichen Egress müssen Container- oder Proxyzähler verwendet werden, da die Prozessmetriken bewusst Nutzbytes vor Kompression zählen. Zwei volle Räume und belastete Gefechte auf der Ziel-VM bleiben offen.

Fog, Sichtkontakte, neutrale Ressourcen-Erinnerung und private Felder bleiben unverändert geschützt. Deltaframes würden eine belastbare Basis-/Sequenzkennung benötigen; nach Lücke oder Resume müsste immer ein Voll-Keyframe folgen. Eine spätere Protokolländerung erhöht die Version und wird gemeinsam mit Client und Server ausgerollt.

**Herausforderungen:** JSON komprimiert gut, kann aber CPU-Spitzen auf dem seriellen Node-Prozess erhöhen. Deltaframes sparen weiteren Egress, erhöhen dagegen Zustands- und Fehlerkomplexität. Ziel-VM und realistische Mobilfunkprofile bleiben maßgeblich.

### P2 – Netzwerksimulation und Abnahme

Kurze Server- und Clientintegrationstests decken Socketverlust, Resume und Tokenrotation, Schonfristende, Befehlswiederholung, verzögerte Heartbeats und synthetischen Rückstau ab. Die Empfangsreihenfolge des Clients ist auch während asynchroner Kartenaufbereitung abgesichert; aufgestaute ersetzbare Vollansichten werden zusammengefasst. Diese technischen Fälle ersetzen die folgenden offenen Prüfungen nicht:

- [ ] Einen vollständigen reproduzierbaren Netzwerktest für Latenz, Jitter, Burst-Loss, Bandbreitenlimit und kurze Unterbrechung vorsehen. Kernel-/Proxy-Netzprofile sowie umfangreiche Last-/Simulationsläufe bleiben gesondert freigabepflichtig.
- [ ] Zwei echte Geräte über Mobilfunk beziehungsweise Wi-Fi-Wechsel prüfen. Automatische Tests ersetzen diese menschliche Geräteabnahme nicht.

## Offene Befunde aus dem kurzen Code-Review

Die Lebenszyklus- und Datenschutzbefunde des Reviews sind behoben: bestätigte, befristet wiederholbare Tokenrotation, idempotentes `ready`, expliziter Abbruch veralteter Clientvorbereitungen, getaktete Request-Wiederholung und ausschließlich klassifizierte Close-Ursachen. Der Protokollvertrag steht maßgeblich in der [Serverdokumentation](../../../server/README.md#ablauf-und-grenzen). Folgende Folgearbeit bleibt offen:

- [ ] **Messgrenze präzisieren:** `server/scripts/measure-network.mjs` nutzt zufällige Karten-/Startseeds, lässt Westmark aus und multipliziert Framegrößen mit nominalen 10 Hz. Es misst synchrone Roh-Deflate-Kompression statt des ausgehandelten WebSocket-Pfads. Für belastbare Vorher-/Nachhervergleiche den Server-Kartenkatalog, feste Testfixtures, tatsächlich verstrichene Zeit und einen komprimierten Transportvergleich verwenden. Die bisherigen Werte sind nur eine Öffnungsprofil-Schätzung; keine Freigabe für Hochlast.

Wartbarkeit: Die Trennung `Connection`/`Seat`/`Room`, eine gemeinsame Simulationsquelle und begrenzte Puffer sind sinnvolle Grundlagen. Der nächste kleine Strukturauftrag sollte nach den Regressionstests den Client-Lebenszyklus (Phasen, Generationen, Timer) von Darstellung/UI trennen. Serverseitig sind Transportpolitik/Metriken eine mögliche zweite Grenze; keine generische Netzwerkplattform bauen und keine mechanische Dateizerlegung mit Verhaltenskorrekturen vermischen.

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
