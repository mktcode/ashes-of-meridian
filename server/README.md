# Multiplayer-Prototyp

Separater autoritativer Node-Server für zwei menschliche Parteien. Er verwendet dieselben Simulationsquellen wie das Offline-Spiel; keine kopierte Spielimplementierung. Die freigegebenen Karten aus `src/battlefields/catalog.ts` und alle drei Fraktionen sind beim Erstellen bzw. Beitreten verfügbar. Client und Server gemeinsam aus demselben Stand bauen und ausrollen. Keine Konten, KI, Expeditionen, Belohnungen oder Speicherung. Kurze Verbindungsabbrüche können innerhalb derselben Serverprozess-Laufzeit wiederaufgenommen werden.

## Lokal starten

Im Repository-Root (Node 22 oder neuer):

```sh
npm ci
npm run build
npm ci --prefix server
npm run build --prefix server
npm start --prefix server
```

`index.html` in zwei Browsern direkt über `file://` öffnen. **Multiplayer · prototype** wählen. Die Oberfläche schlägt den öffentlichen Server `wss://aoms.markus-kottlaender.de` vor; für einen lokalen Test auf beiden Clients `ws://localhost:8787` eintragen. Anschließend wählt der Ersteller Karte/Fraktion und teilt den angezeigten Code, der andere wählt seine Fraktion und tritt bei. Der Server startet erst, wenn beide Clients die Karte geladen haben. Beide Parteien starten mit einem Worker ohne HQ und erkunden vor dem bezahlten Basisbau.

Für ein zweites Gerät den Server ausdrücklich an das LAN binden (`HOST=0.0.0.0 npm start --prefix server`), den Port gezielt in der Firewall freigeben und auf beiden Clients `ws://<Server-LAN-IP>:8787` eintragen. `localhost` bezeichnet immer das jeweilige Gerät. Der Raumcode allein genügt nicht: beide benötigen auch die Serveradresse und denselben Client-/Serverstand.

## Separat deployen

Nach dem Build werden nur `server/dist/`, `server/package.json` und `server/package-lock.json` benötigt. In diesem Paket `npm ci --omit=dev` und `npm start` ausführen. Der Browser-Build wird unabhängig statisch ausgeliefert; das Offline-Spiel benötigt den Dienst weiterhin nicht.

Alternativ aus dem Repository-Root:

```sh
docker build -f server/Dockerfile -t meridian-server .
docker run --rm -p 8787:8787 -e ALLOWED_ORIGINS=https://your-client.example meridian-server
```

- `HOST` ist standardmäßig `127.0.0.1`, im Container `0.0.0.0`; `PORT` standardmäßig `8787`.
- Es gelten absolut höchstens zwei Räume einschließlich wartender Sessions. `MAX_ROOMS=1` kann die Grenze reduzieren; Werte über zwei werden auf zwei begrenzt.
- `ALLOWED_ORIGINS` ist eine kommagetrennte exakte Liste. Standard `null` erlaubt direkte `file://`-Clients; für eine gehostete Spielseite deren HTTPS-Origin ergänzen. Keine Wildcard. `null` ist keine Identitätsprüfung und kann auch von anderen opaken Origins stammen.
- Öffentliche Nutzung nur hinter TLS-Reverse-Proxy mit WebSocket-Upgrade; HTTPS-Clients benötigen `wss://`. Pfad `/` ist der WebSocket-Endpunkt, `GET /health` der Healthcheck. Originprüfung ist kein Ersatz für Netzwerk-/Zugriffsschutz.
- Buildstände gemeinsam ausrollen: Server nach Neubau neu starten und Browser neu laden. Der Darstellungsstream nutzt Protokollversion 5; alte Clients/Server werden abgewiesen. Die Protokollversion prüft die Nachrichtenform, ist noch kein Content-Hash-Handshake.
- Kein Produktionsbetrieb unter beliebiger öffentlicher Last zugesichert: maximal zwei Räume/24 kurzzeitig angenommene Verbindungen pro Prozess, begrenzte Nachrichten, Warteschlangen und ausgehende Puffer; keine horizontale Verteilung oder DDoS-Abwehr.

## Betriebsdiagnose

Der Server schreibt Verbindungs- und Raumeignisse als einzeilige JSON-Objekte nach Standardausgabe. Zufällige interne `connectionId`/`roomId` dienen nur zur Zuordnung innerhalb eines Prozesses; Raumcodes, Nachrichteninhalte und spätere Resume-Tokens werden nicht protokolliert. `connection_close` enthält Close-Code, interne Ursache, Dauer, gesendete Bytes/Zustandsframes und den größten beobachteten `bufferedAmount`. Fremde Close-Texte werden weder im Server noch im Client protokolliert, weil sie sensible Daten enthalten können. Eigene Ereignisse unterscheiden insbesondere Transportfehler, Heartbeat-Timeout und Backpressure-Abbruch.

Das periodische Ereignis `metrics` enthält aktive Verbindungen/Räume und kumulierte Zähler für Verbindungen, logische Nutzbytes getrennt nach Kontrollnachrichten und Zustandsframes, ausgelassene beziehungsweise RTT-gedrosselte Zustandsframes, Backpressure, Heartbeat und Resume. Hinzu kommen RTT/Jitter, Zustandsframe-Maximum, Tick-p95/p99/Maximum sowie Prozess-CPU und RSS. Die Nutzbytes werden vor WebSocket-Kompression gezählt und sind daher kein Egress-Zähler. Werte gelten pro Prozess seit Start und sind kein dauerhaftes Monitoring. Die Erzeugerfunktion erlaubt Tests, Zeitquelle, Tick-/Sendetakt, Heartbeat, Schonfrist, Puffergrenzen, Kompression und Metrikintervall kontrolliert zu ersetzen; der Produktionsstart verwendet die dokumentierten Standardwerte.

Für eine kurze reproduzierbare Nutzlastmessung auf den derzeit im Messskript geführten Karten:

```sh
npm run measure:network --prefix server
```

Der Lauf erfasst 30 Öffnungsframes einer ruhenden Partei für Desert, Alien Planet und Mothership und schätzt Rohdatenrate, Deflate-Level-3-Rate, Framegrößen sowie lokale Kompressions-p95/p99. Westmark fehlt derzeit im manuell gepflegten Messkatalog; dieser Lauf ist daher kein vollständiger Kartenvergleich. `SAMPLE_FRAMES=100` erhöht die Stichprobe bis höchstens 300. Das Profil ist absichtlich kurz und ersetzt weder ein belastetes Gefecht noch Egress-, Proxy- oder Ziel-VM-Messung; WebSocket-/TCP-/TLS-Rahmen sind nicht enthalten. Für echte Bandbreite ist zusätzlich der Netzwerkzähler am Container beziehungsweise Reverse-Proxy maßgeblich.

Der Browser protokolliert Phasenwechsel, Socketfehler/-Close, Wiederwahl und lokale Timeouts unter dem Präfix `[multiplayer]` in der Entwicklerkonsole. Dabei werden keine Aktionen oder Resume-Tokens protokolliert.

## Ablauf und Grenzen

Der Raumcode ist eine zufällige Beitrittsberechtigung, nicht die Parteiidentität. Nach Erstellen beziehungsweise Beitritt erhält jede Partei zusätzlich ein zufälliges Resume-Token. Der Server hält es nur im Arbeitsspeicher; der Browser speichert Token, Serveradresse, Raumcode und Requestzähler höchstens für das laufend erneuerte 45-Sekunden-Fenster in `localStorage`, damit ein Reload fortgesetzt werden kann. Bewusstes Verlassen, Sitzungsende, ungültige Daten oder lokaler Fristablauf entfernen diese Resume-Daten; der unkritische letzte Raumcode bleibt separat zum Vorausfüllen erhalten. Das Token wird nach erfolgreicher Wiederaufnahme rotiert. Client-Parteiangaben werden nicht übernommen. Nach Beitritt ist der Raum für neue Parteien geschlossen. Ein gültiges Token darf innerhalb von 45 Sekunden den Socket seines Spielerplatzes ersetzen. Die Rotation wird mit `resume_ack` bestätigt: Bis zur Bestätigung oder spätestens 45 Sekunden nach dem ersten Rotationsvorschlag darf das vorherige Token genau denselben Vorschlag erneut abrufen. Wiederholungen verlängern diese Frist nicht. Nach Bestätigung werden alte Tokens sofort abgewiesen; das neue Token bleibt auch bei verlorenem Ack verwendbar. Verlassen über die Oberfläche beendet sofort, ein Transportverlust erst nach Ablauf der Schonfrist. Währenddessen laufen Server und Gegner weiter. Prozess-/Containerneustarts bleiben nicht wiederherstellbar.

Die Simulation läuft mit 50-ms-Schritten bei 1×, die Ansichten werden regulär mit 10 Hz übertragen. Kein Lockstep, keine Client-Simulation oder Vorhersage; der Browser interpoliert nur seine Darstellung. Langsame Server laufen entsprechend langsamer statt unbeschränkt nachzuholen. Zustandsframes ab 1 KiB werden mit WebSocket-Deflate Level 3 und ohne kontextübergreifendes Wörterbuch komprimiert. Bei geglätteter RTT ab 400 ms sinkt die Zustandsrate auf 5 Hz, ab 800 ms auf 2,5 Hz. Bei Rückstau werden ersetzbare Zustandsframes oberhalb der weichen Puffergrenze ausgelassen; Kontrollnachrichten bleiben erhalten, solange nicht auch deren harte Grenze überschritten wird. Menüs, Verkaufsdialoge und versteckte Tabs pausieren nur lokale Eingaben, **nicht** die Partie. Warten auf Mitspieler ist auf zwei Minuten, Kartenladen auf eine Minute und eine laufende Testsession auf eine Stunde begrenzt. Es gibt noch keine Sieger-/Eliminationsregeln; HQ-Verlust erzeugt keine Expeditionsauszahlung.

Nur eigene Konten/Queues und sichtbare fremde Entitäten werden übertragen. Ressourcen im Nebel behalten den letzten beobachteten Stand. Gelände ist öffentlich aus dem Karten-Seed rekonstruierbar; die Startzuordnung verwendet einen separaten privaten Server-Seed. Die Ansichten sind Render-/Bedienzustände, keine vollständigen Gefechtssnapshots. Sicht-/parteigefilterte Ereignisse ergänzen Schüsse, Artillerie, Explosionen, Treffer-, Arbeits-/Heileffekte und Audio. Darstellung und Ereignisse sind gepuffert und begrenzt; Einzelheiten zum Sichtschutz und zur Interpolation stehen in der [Architektur](../docs/architecture.md#netzwerkprototyp).

Prüfungen nach [Risiko und Zeitbudget](../docs/testing.md): nach Serverbuild `npm test --prefix server` für kurze Verbindungs-/Befehlsfälle. Breite Root-Suite und KI-/Simulations-Langläufe nur im ausdrücklich freigegebenen Umfang; keine automatische Abschlussprüfung. Browsertechnik, visuelle/akustische Abnahme und Echtgeräte-Performance nicht gleichsetzen.
