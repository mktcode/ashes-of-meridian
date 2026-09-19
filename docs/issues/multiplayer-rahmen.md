# Multiplayer: Prototyp und nächste Freigaben

**Zwei-Spieler-Netzwerkprototyp mit Kartenauswahl freigegeben und umgesetzt; weitere Pakete erst nach eigenem Go.** Bestehendes Einzelspiel, Roguelite-Fortschritt, RNG-Verträge und direkte `file://`-Auslieferung bleiben erhalten. Betrieb und bewusste Grenzen: [Serverdokumentation](../../server/README.md).

1. [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md): den [internen CPU-Szenariovertrag](../architecture.md#teamzustand-sicht-und-ki) gezielt abnehmen; kurze Start-/KI-Prüfungen separat freigeben, keine vollständigen Partien auf Vorrat.
2. [Perspektive und Karten](multiplayer-karten-und-darstellung.md): lokale Darstellung entkoppeln und technische Karten-/Lastgrenzen prüfen.
3. [Netzwerkprototyp](multiplayer-netzwerk.md): zwei menschliche Parteien abnehmen; anschließend gezielt Rückmeldung, Betrieb und Erweiterung auf vier Parteien freigeben.
4. [Spielmechanik und Expeditionen](multiplayer-expeditionen.md): später gemeinsam definieren, bis dahin blockiert.

Technisches Ziel: bis zu vier Parteien, unabhängig von Fraktion und Controller. Vier Startbereiche bedeuten weder vier menschliche Spieler noch vier Menschen plus zusätzliche KI-Parteien. Aktueller Umfang ist ausschließlich jeder gegen jeden (FFA); 2on2-KI, Allianzen und geteilte Kontrolle bleiben außen vor. Ergebnisse und Expeditionsregeln sind weiterhin offen; die technischen Testvorgaben ersetzen keine Produktregeln.
