# Multiplayer-Prototyp

Separater autoritativer Node-Server für zwei menschliche Parteien. Er verwendet dieselben Simulationsquellen wie das Offline-Spiel; keine kopierte Spielimplementierung. Alle drei Karten und Fraktionen sind beim Erstellen bzw. Beitreten verfügbar. Keine Konten, KI, Expeditionen, Belohnungen, Wiederverbindung oder Speicherung.

## Lokal starten

Im Repository-Root (Node 22 oder neuer):

```sh
npm ci
npm run build
npm ci --prefix server
npm run build --prefix server
npm start --prefix server
```

`index.html` in zwei Browsern direkt über `file://` öffnen. **Multiplayer · prototype** wählen. Beide verwenden `ws://localhost:8787`; der Ersteller wählt Karte/Fraktion und teilt den angezeigten Code, der andere wählt seine Fraktion und tritt bei. Der Server startet erst, wenn beide Clients die Karte geladen haben. Ohne Startworker zunächst einen Worker rekrutieren.

Für ein zweites Gerät den Server ausdrücklich an das LAN binden (`HOST=0.0.0.0 npm start --prefix server`), den Port gezielt in der Firewall freigeben und auf beiden Clients `ws://<Server-LAN-IP>:8787` eintragen. `localhost` bezeichnet immer das jeweilige Gerät. Der Raumcode allein genügt nicht: beide benötigen auch die Serveradresse und denselben Client-/Serverstand.

## Separat deployen

Nach dem Build werden nur `server/dist/`, `server/package.json` und `server/package-lock.json` benötigt. In diesem Paket `npm ci --omit=dev` und `npm start` ausführen. Der Browser-Build wird unabhängig statisch ausgeliefert; das Offline-Spiel benötigt den Dienst weiterhin nicht.

Alternativ aus dem Repository-Root:

```sh
docker build -f server/Dockerfile -t meridian-server .
docker run --rm -p 8787:8787 -e ALLOWED_ORIGINS=https://your-client.example meridian-server
```

- `HOST` ist standardmäßig `127.0.0.1`, im Container `0.0.0.0`; `PORT` standardmäßig `8787`.
- `ALLOWED_ORIGINS` ist eine kommagetrennte exakte Liste. Standard `null` erlaubt direkte `file://`-Clients; für eine gehostete Spielseite deren HTTPS-Origin ergänzen. Keine Wildcard. `null` ist keine Identitätsprüfung und kann auch von anderen opaken Origins stammen.
- Öffentliche Nutzung nur hinter TLS-Reverse-Proxy mit WebSocket-Upgrade; HTTPS-Clients benötigen `wss://`. Pfad `/` ist der WebSocket-Endpunkt, `GET /health` der Healthcheck. Originprüfung ist kein Ersatz für Netzwerk-/Zugriffsschutz.
- Buildstände gemeinsam ausrollen. Die Protokollversion prüft die Nachrichtenform, ist noch kein Content-Hash-Handshake.
- Kein Produktionsbetrieb unter beliebiger öffentlicher Last zugesichert: maximal acht Räume/24 Verbindungen pro Prozess, begrenzte Nachrichten, Warteschlangen und ausgehende Puffer; keine horizontale Verteilung oder DDoS-Abwehr.

## Ablauf und Grenzen

Der Raumcode ist eine zufällige Beitrittsberechtigung, nicht die Parteiidentität. Die Identität bindet der Server an die konkrete Verbindung; Client-Parteiangaben werden nicht übernommen. Nach Beitritt ist der Raum geschlossen. Nach Verbindungsabbruch endet die Sitzung für beide; ein neuer Code/Beitritt ersetzt keine verlorene Verbindung.

Die Simulation läuft mit 50-ms-Schritten bei 1×, die Ansichten werden mit 10 Hz übertragen. Kein Lockstep, keine Client-Simulation, Vorhersage oder Interpolation. Langsame Server laufen entsprechend langsamer statt unbeschränkt nachzuholen. Menüs, Verkaufsdialoge und versteckte Tabs pausieren nur lokale Eingaben, **nicht** die Partie. Warten auf Mitspieler ist auf zwei Minuten, Kartenladen auf eine Minute und eine laufende Testsession auf eine Stunde begrenzt. Es gibt noch keine Sieger-/Eliminationsregeln; HQ-Verlust erzeugt keine Expeditionsauszahlung.

Nur eigene Konten/Queues und sichtbare fremde Entitäten werden übertragen. Ressourcen im Nebel behalten den letzten beobachteten Stand. Gelände ist öffentlich aus dem Karten-Seed rekonstruierbar; die Startzuordnung verwendet einen separaten privaten Server-Seed. Die Ansichten sind Render-/Bedienzustände, keine vollständigen Gefechtssnapshots. Projektile, Explosions-/Treffereffekte und Kampf-Audio werden noch nicht über das Netz repliziert; Einheiten, Gesundheit, Produktion, Bau und lokale Befehlsmarker werden angezeigt.

Prüfungen nach Build: `npm test --prefix server` für kurze Verbindungs-/Befehlsfälle auf allen Karten; `npm test` im Root für die Standardtests. Die gesonderten KI-/Simulations-Langläufe bleiben gemäß [Projektregeln](../AGENTS.md#risikobasiert-prüfen) freigabepflichtig. Browsertechnik, visuelle/akustische Abnahme und Echtgeräte-Performance nicht gleichsetzen.
