# Expeditionen als Free-for-all

## Freigegebener Auftrag

Expeditionen auf echte Mehrparteiengefechte erweitern: Alle Parteien sind untereinander feindlich, unabhängig von ihrer Fraktion. Der Spieler muss als letzte Partei übrig bleiben. Zum direkten Testen gilt zunächst: Stage 1 ein Gegner, ab Stage 2 zwei, ab Stage 3 drei. Stage ist die nullbasierte gespeicherte Tiefe plus eins. Die ursprünglich genannten Schwellen 5/15 sind aktuell nicht aktiv; eine spätere Umstellung braucht einen neuen Auftrag.

Jeder Gegner-Slot behält innerhalb des Runs eigene Expeditionsvorteile, auch bei Fraktionswechsel. Fraktionen werden weiterhin pro Gefecht zufällig bestimmt, auch gleiche Fraktionen sind erlaubt. Neu hinzukommende Slots beginnen ohne Vorteile; bestehende Slots erhalten nach jedem Spielersieg je einen eigenen Vorteil. Permanente Flottenupgrades bleiben ausschließlich beim Spieler. Die KI-Druckstufe folgt weiterhin der globalen Expeditionstiefe, nicht dem Eintrittsalter des Slots.

## Umsetzung

- Mehrparteien-Startrezept und symmetrische FFA-Feindschaft im Einzelspiel; vorhandene Karten-/Sicht-/KI-Infrastruktur nutzen, keine neue KI und keine koordinierten Allianzen.
- Verlust des letzten HQs scheidet eine Partei aus; ihre verbleibenden Truppen/Gebäude werden entfernt und Aktionen/Fähigkeiten beendet. Bereits ausgelöste Geschosse dürfen einschlagen. Bei gleichzeitigem Verlust des letzten eigenen HQs hat die Spielerniederlage weiterhin Vorrang. Szenarien und Netzwerkprototyp behalten ihre bisherigen Regeln.
- Getrennte persistente Vorteilsstapel, deterministische unabhängige Vorteilswahl pro Slot, abgesicherte Übergänge ohne erneutes Würfeln bei Reload oder Ergebniswiederanzeige. Neues Checkpointformat ohne Migration; permanentes Profil bleibt erhalten.
- Briefing und Ergebnisvorschau für alle Gegner; Killstatistik nur für dem Spieler zurechenbare Abschüsse, keine Punkte durch gegnerische Kämpfe oder Ausscheidungsbereinigung.
- Betroffene Spielregeln, Architektur und Einstieg aktualisieren. Geschützte Gelände-/Ressourcen-RNG-Reihenfolge erhalten.

## Prüfungen und Übergabe

Neue kleine Vertragstests für Stagestufen, Vorteile/Reload, FFA und Ausscheiden; bestehende betroffene Fixtures anpassen. Ein gebündelter Standardlauf am Schluss, keine optionalen KI-/Simulationslangläufe ohne zusätzliche Freigabe und keine automatischen Browser-/Screenshotserien. Balance, Darstellung und mobile Mehrparteienperformance bleiben menschliche Abnahme und werden im bestehenden Validierungsissue geführt.

Geplante Commits: Auftrag; Gefechtsregeln/Startvertrag; Expeditionsprogression/Persistenz/UI; abschließende Prüfungen/Dokumentation. Keine unzusammenhängenden Umbauten.
