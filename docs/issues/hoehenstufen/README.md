# Begehbare Höhenstufen: erhöhte Basen, gemeinsames Tiefland

## Auftrag und Status

Freigegeben sind Detailplanung und Experimente in einem separaten Branch. Gewünschtes Kartenleitbild: **mindestens zwei bespielbare Höhenlagen auf jeder Karte; erhöhte Basen außen, ein großes tieferes Schlachtfeld in der Mitte**, angelehnt an StarCraft 2. Das ist keine Freigabe, dessen Sicht-, Treffer- oder Wirtschaftsregeln zu übernehmen.

Experimentier-Branch: `experiment/hoehenstufen`, angelegt von `main` bei `1b2d160`. Eigener Worktree: `.tmp/hoehenstufen-planung/worktree/` im Hauptrepository. Die Issues bleiben maßgeblich auf `main`. Bisher nur Quellenanalyse und Planung, kein spielbarer Höhenprototyp und keine gemessene Aufwandsschätzung. Keine Änderungen an Spielquellen oder Referenzwerten.

## Ziel und vorgeschlagene Grenzen

- Alle **vier öffentlichen Startkandidaten** jeder Karte erhalten ein brauchbares Hochplateau, nicht nur die zwei tatsächlich belegten Starts. Gelände darf die geheime Multiplayer-Startzuordnung nicht verraten.
- Das Plateau umfasst HQ, Anfangswirtschaft und ausreichend Bau-/Ausfahrtsfläche; nicht lediglich einen Sockel unter dem HQ. Die Mitte bietet eine große zusammenhängende Kampfzone. Seitliche Flankenwege bleiben möglich, ohne die zentrale Fläche durch ein enges Wegenetz zu ersetzen.
- Vorschlag für den ersten Versuch: Tiefland `0 m`, Plateaus `+6 m`, breite Rampen mit etwa `18–24 m` Laufstrecke. **Versuchsparameter, kein beschlossenes Balancing.** Plateaugrößen müssen je Karte aus Bauflächen und Ressourcenzugängen folgen.
- Vorschlag: zwei räumlich getrennte Ausgänge pro Basis, eine breite Hauptrampe zur Mitte und ein Flankenzugang. Ein einziger schmaler SC2-artiger Engpass wäre mit der heutigen Crowd-Navigation besonders riskant. Anzahl/Breite nach menschlichem Spieltest entscheiden.
- Zunächst statisches 2,5D-Gelände: genau eine begehbare Bodenhöhe je `x/z`, keine Brücken mit Unterführung, Tunnel, Aufzüge, Terrainverformung oder frei bewegliche Z-Achse.
- Keine neuen Ressourcenmengen, Einheitenwerte oder automatischen Höhenboni. Ein neuer Kartenaufbau verändert allerdings bewusst Laufwege und strategisches Balancing; das lässt sich nicht als verhaltensneutrale Grafikänderung behandeln.

## Umsetzungspakete und Reihenfolge

1. [Weltvertrag und Navigation](01-welt-und-navigation.md): CPU-Oberfläche, begehbare Übergänge, Bau-/Arbeitszugänge; kleine synthetische Zwei-Ebenen-Fixture.
2. [Darstellung und Bedienung](02-darstellung-und-bedienung.md): dieselbe Oberfläche zeichnen und treffen, Modelle/Effekte erden; mit Paket 1 einen vertikalen Prototyp fertigstellen.
3. [Karten, Integration und Abnahme](03-karten-und-abnahme.md): zuerst kontrollierter Mothership-Versuch, anschließend Alien Planet und Desert; Netzwerk und kombinierte Prüfungen.

Paket 1 und 2 teilen den Oberflächenvertrag und dürfen nicht unabhängig inkompatible Höhenabfragen einführen. Zuerst einen kleinen vollständigen Durchstich auf dem Experimentier-Branch schaffen: Plateau auswählen → Worker über Rampe bewegen → Gebäude errichten → Einheit produzieren → sichtbares Gefecht auf beiden Ebenen. Kein halb umgestellter Stand auf `main`.

## Entscheidungen vor spielbarer Abnahme

- **Kampf/Sicht:** Empfehlung für den ersten Versuch: bisherige planare Reichweiten und Sichtkreise, keine Höhenboni. Dann bleiben Schüsse durch Gelände regeltechnisch möglich; angepasste Effekthöhen lösen keine Schussblockierung. Vor einer Übernahme klären, ob das akzeptabel ist oder Terrain-Sicht-/Schussprüfung zur ersten Version gehören muss. Das wäre ein eigenes größeres Paket einschließlich KI und Multiplayer-Sichtfilter.
- **Luftfahrt:** globale Flughöhe über der maximalen spielbaren Ebene oder begrenztes Terrain-Following? Einfaches `heightAt + 3.8` erzeugt an Klippen Höhensprünge. Nicht stillschweigend als Fertiglösung einsetzen.
- **Bauen:** Empfehlung: nur ebene Flächen, Rampen und Klippenränder nicht bebaubar; kein automatisches Terraforming. Sollen weitere Gebäude auch im Tiefland erlaubt sein? Vorschlag: ja; die Höhenvorgabe betrifft die Startbasen.
- **Interaktion:** Bau, Abbau und Reparatur dürfen nicht durch Klippen hindurch erfolgen. Fernheilung/Fähigkeitsflächen zunächst wie Kampf behandeln; deren Höhenregeln ausdrücklich bestätigen.
- **Layout:** Anfangs-Alloy und zugehöriger Vent auf dem Plateau als Vorschlag; zusätzliche Vorkommen im Tiefland als umkämpfte Ziele. Bestehende Mengen erhalten, nötige Ortsänderungen sichtbar prüfen.

## Aufwand und nächste Freigabe

Vorläufige Größenordnung für eine integrierte Version ohne neue Sicht-/Kampfregeln: **15–30 Personentage**, einschließlich technischer Prüfungen, nicht menschlicher Abnahme. Der Auftrag für drei unterschiedlich gestaltete Karten kann die obere Hälfte erreichen; Crowd-Probleme und echte Sichtlinien sind Zusatzrisiken. Der erste Durchstich soll Aufwand und Grenzen konkretisieren, keine feste Terminzusage ersetzen.

Die nächste sinnvolle Umsetzung ist die synthetische Fixture plus Mothership-Prototyp aus den Paketen 1/2. Die übrigen Karten erst nach Begutachtung der Höhenwirkung und Rampenbedienung umbauen. Backlog-Einträge sind keine automatische Freigabe aller Pakete oder zusätzlicher Langläufe.
