# Multiplayer: Prototyp und nächste Freigaben

**Zwei-Spieler-Netzwerkprototyp mit Kartenauswahl freigegeben und umgesetzt; weitere Pakete erst nach eigenem Go.** Bestehendes Einzelspiel, Roguelite-Fortschritt, RNG-Verträge und direkte `file://`-Auslieferung bleiben erhalten. Betrieb und bewusste Grenzen: [Serverdokumentation](../../server/README.md).

1. [Netzwerkprototyp](multiplayer-netzwerk/README.md): zwei echte Geräte, öffentlichen Betrieb und zwei volle Räume auf der Ziel-VM abnehmen.
2. [Perspektive und Karten](multiplayer-karten-und-darstellung.md): Zwei-Client-Darstellung, Höhen/Brücken und Mehrparteienlast gezielt prüfen.
3. [Mehrparteien-Prüfungen](multiplayer-simulationsmodell.md): echte FFA-KI-Fälle nur nach gesonderter Freigabe eingrenzen; der technische CPU-Szenariovertrag ist integriert.
4. Drei oder vier menschliche Parteien erst nach diesen Abnahmen eigens freigeben.
5. [Spielmechanik und Expeditionen](multiplayer-expeditionen.md): später gemeinsam definieren, bis dahin blockiert.

Technisches Ziel: bis zu vier Parteien, unabhängig von Fraktion und Controller. Vier Startbereiche bedeuten weder vier menschliche Spieler noch vier Menschen plus zusätzliche KI-Parteien. Aktueller Umfang ist ausschließlich jeder gegen jeden (FFA); 2on2-KI, Allianzen und geteilte Kontrolle bleiben außen vor. Ergebnisse und Expeditionsregeln sind weiterhin offen; die technischen Testvorgaben ersetzen keine Produktregeln.
