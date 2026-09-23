# Höhenstufen 4: Sichtvorteil für Hochplateaus

## Auftrag und Reihenfolge

Die Höhenregel ist für Mothership im aktuellen Stand technisch umgesetzt. Weitere Kartenumbauten und andere Höhenvorteile bleiben zurückgestellt. Offen ist die gezielte menschliche Abnahme an Klippe und Rampe. [Gesamtstand und Teststart](README.md).

## Festgelegte Regel

- Bodengebundene Sichtquellen im Tiefland dürfen ein höheres Plateau nicht aufdecken.
- Vom Plateau darf das tiefere Gelände innerhalb der bestehenden Sichtreichweite aufgedeckt werden. Keine zusätzliche Sichtreichweite als Bonus.
- Die Regel gilt für beide Parteien gleichermaßen. Sie muss tatsächliche Sicht und Aufdeckung begrenzen, nicht nur die Nebeldarstellung.
- Kein zusätzlicher Schaden, keine Treffer-/Ausweichboni, keine Reichweitenänderung und keine neue physische Schussblockierung. Bestehende Abhängigkeiten von Zielsicht bleiben erhalten; sie sind kein neuer Kampfbonus.
- Keine vollständige Übernahme der StarCraft-Regeln: Nur der ausdrücklich gewünschte asymmetrische Sichtvorteil ist entschieden.

## Konkretisierte Grenzen

- Die Mothership-Rampenmitte trennt Tiefland und Plateau als zwei diskrete logische Sichtstufen; kleine Dreiecksunterschiede erzeugen keine weiteren Stufen.
- Es gibt keine allgemeine Gelände-Sichtlinie: Entscheidend sind Quellen- und Zielstufe, nicht dazwischenliegende Gipfel.
- Flugzeuge und Recon scans beobachten unabhängig von Bodenstufen. Andere Quellen bleiben bodengebunden, bis ihr Vertrag ausdrücklich geändert wird.
- Gebäudehöhe und kosmetische Schwebe-/Modelloffsets verändern die Sichtstufe nicht.

## Umsetzung und Akzeptanz

- [x] Gemeinsame autoritative Sichtberechnung um den Höhenvertrag ergänzen; vorhandene CPU-Oberfläche verwenden, keine unabhängige Renderer-Höhenlogik.
- [x] Aktuelle Sicht von dauerhaft erkundetem Terrain unterscheiden: Ein noch unbekanntes Plateau darf von unten nicht erkundet werden. Bereits erkundetes Gelände bleibt bekannt, ohne dadurch aktuelle Feindpositionen preiszugeben.
- [x] Sichtquellen derselben Partei korrekt vereinigen: Ein eigener Beobachter oben kann Sicht liefern, auch wenn eine andere eigene Einheit unten steht. Nach Wegfall der oberen Quelle keine veraltete Sicht behalten.
- [x] Fog, Minimap, Auswahl/Zielzugriff und KI verwenden den gleichen resultierenden Sichtzustand. Multiplayer-Entitäten und Ereignisse bleiben serverseitig über diesen Zustand gefiltert.
- [x] Deterministische Kurztests für beide Richtungen, gleiche Ebene, Rampenschwelle, Quellenvereinigung, Sichtverlust, Erkundungsspeicher sowie Luft-/Scan-Regeln.
- [x] Unveränderte Flachkarten und Server-Sichtfilter über die gemeinsamen Prüfungen absichern.
- [ ] Menschlicher Test an beiden Seiten derselben Klippe und an einer Rampe, bevor weitere Karten adaptiert werden.

Die technische Prüfung ersetzt keine visuelle oder spielerische Abnahme.
