# Multiplayer: Robustheit bei Mobilfunk und Netzwechsel

## Befund und Ziel

Mehrere menschliche Tests über Mobilfunk endeten durch Verbindungsabbruch; ohne Verbindungsmetriken war die konkrete Ursache nicht unterscheidbar. Ziel ist, kurze Funklöcher, Hintergrundphasen und Wi-Fi-/Mobilfunkwechsel zu überstehen, ohne doppelte Befehle oder Offenlegung verborgenen Zustands.

Resume mit langlebigem Spielerplatz, Tokenrotation, Befehlsdeduplizierung, Schonfrist, Wiederwahl, toleranter Heartbeat, begrenzte Backpressure sowie adaptive Zustandsrate und Transportkompression sind umgesetzt. Der maßgebliche Protokoll-/Betriebsvertrag steht in der [Serverdokumentation](../../../server/README.md#ablauf-und-grenzen). Kurze Integrationsfälle sind keine Mobilfunk-, Ziel-VM- oder Hochlastabnahme. Die Simulation läuft während der Schonfrist weiter; Server-/Prozessneustarts sind nicht wiederherstellbar.

## Architekturgrenze

Der Serverzustand bleibt autoritativ. Nach Resume erhält der Browser eine aktuelle sichtgefilterte Vollansicht; er simuliert nicht selbst. Serversequenzierte Command-/Client-Simulation bleibt ein separater, nicht freigegebener Architekturauftrag: vollständige Snapshots, zugängliche RNG-Zustände, Command-Log, State-Hashes und plattformübergreifend abgesicherter Determinismus fehlen. Diese Umstellung nicht mit der Behebung aktueller Abbrüche vermischen.

Fog, Sichtkontakte, Ressourcen-Erinnerung und private Felder schützen. Alle Nachrichten teilen weiterhin den geordneten TCP/WebSocket-Strom: Frame-Dropping verhindert neuen Rückstau, beseitigt keine bereits blockierten Bytes. Mobile Browser können Timer drosseln oder die Seite suspendieren; Korrektheit darf nicht von pünktlichen Clienttimern abhängen. Generische Close-Ursachen erlauben nicht die eindeutige Diagnose jedes Funkfehlers.

## Offene Messung und Abnahme

- [ ] **Messverfahren verbessern:** `server/scripts/measure-network.mjs` verwendet zufällige Seeds, lässt Westmark aus und multipliziert Framegrößen mit nominalen 10 Hz. Es misst synchrone Roh-Deflate-Kompression statt des ausgehandelten WebSocket-Pfads. Server-Kartenkatalog, feste Fixtures, verstrichene Zeit und tatsächlichen komprimierten Transport verwenden. Bisherige Werte sind nur Öffnungsprofil-Schätzungen, keine Hochlastfreigabe.
- [ ] Zwei volle Räume und belastete Gefechte auf der Ziel-VM messen: Tick-p95/p99, CPU, RSS und tatsächlichen Egress vergleichen. Prozessmetriken zählen Nutzbytes vor Kompression; Container-/Proxyzähler ergänzen. Raumgrenze nicht nebenbei erhöhen. [Kapazitätsgrenze und Prüfauftrag](../../testing.md#kapazitätsbefund).
- [ ] Reproduzierbare Profile für Latenz, Jitter, Burst-Loss, Bandbreitenlimit und kurze Unterbrechungen vorsehen. Kernel-/Proxy-Profile sowie umfangreiche Last-/Simulationsläufe benötigen gesonderte Freigabe.
- [ ] Zwei echte Geräte über Mobilfunk und Wi-Fi-Wechsel prüfen: Rückkehr in dieselbe Partei innerhalb der Schonfrist, keine doppelten Befehle, Auflösung bekannter Ergebnisse, eindeutiges Ende nach Fristablauf und begrenzte Puffer. Server/Gegner müssen während der Unterbrechung weiterlaufen.
- [ ] Deltaframes oder Binärformat nur bei nachgewiesenem weiterem Bedarf entscheiden. Deltaframes benötigen Basis-/Sequenzkennung, explizite Löschungen und Voll-Keyframes nach Lücke/Resume. Client/Server bei Protokolländerung gemeinsam ausrollen.

## Mögliche Strukturfolgearbeit

Client-Lebenszyklus (Phasen, Generationen, Timer) gegebenenfalls von Darstellung/UI trennen; serverseitig Transportpolitik/Metriken als eigene Besitzgrenze prüfen. Keine generische Netzwerkplattform, keine mechanische Dateizerlegung zusammen mit Verhaltenskorrekturen. Bestehende Trennung `Connection`/`Seat`/`Room`, gemeinsame Simulation und begrenzte Puffer erhalten.

## Nicht-Ziele

Wiederherstellung nach Prozess-/Hostausfall, Replays, Zuschauer, persistente Matches, QUIC/WebTransport, clientseitige Simulation oder zusätzliche Parteien/KI/Expeditionen. Diese benötigen eigene Aufträge.
