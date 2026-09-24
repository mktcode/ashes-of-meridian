# Begehbare Höhenstufen: erhöhte Basen, gemeinsames Tiefland

## Auftrag und Status

Der Mothership-Durchstich ist im aktuellen Stand integriert. Gewünschtes Leitbild bleiben erhöhte Basen außen und ein großes tieferes Schlachtfeld in der Mitte, angelehnt an StarCraft 2. Der gemeinsame Oberflächenvertrag ist für spätere Karten nutzbar; Alien Planet und Desert bleiben auf ausdrücklichen Wunsch vorerst unverändert. Weitere SC2-Regeln oder Höhenboni sind nicht beauftragt.

**Stand: technisch integriert, menschliche Gesamt- und Mobilabnahme offen.** Vier öffentliche 6-m-Basisdecks, breite Innen-/Flankenrampen und tiefes Zentrum sind umgesetzt. Hangars, Anlagen und einige Vorkommen wurden für freie Rampen und ebene Vent-Fundamente versetzt; Mengen und RNG-Ziehungsreihenfolge bleiben unverändert. CPU-Höhenfeld, Klippen-/Segmentprüfung, Bau-/Arbeitszugänge, Produktionsausgänge und reservierte Verstärkungslandungen sind integriert. Darstellung, Picking und Effekte nutzen dieselbe Oberfläche.

Die [höhenabhängige Sicht](04-hoehenabhaengige-sicht.md) ist autoritativ integriert: Tiefland-Bodensicht deckt kein Plateau auf, Hochsicht reicht innerhalb der bestehenden Reichweite nach unten. Flugzeuge und Recon scans überbrücken Sichtstufen. Weitere Kartenumbauten sind zurückgestellt, nicht automatisch der nächste Auftrag.

### Jetzt manuell testen

Im Haupt-Worktree `npm run build`, dann die lokale `index.html?experiment=height` öffnen. Der ausdrückliche Teststart verwendet Mothership/Seed 1409 mit zwei Startworkern. Profil und Checkpoint sind flüchtig; normales Savegame und Fortschritt werden weder gelesen noch geschrieben. Reload setzt diesen Test zurück.

1. Erkennbarkeit von hoher Basis, Rampen und tiefer Mitte bei normalem Zoom beurteilen; insbesondere verdeckte Einheiten am vorderen Plateaurand.
2. Worker auswählen, hinunter und wieder hinauf schicken; Klickziele, Auswahlrahmen, Kameraziehen und MiniMap prüfen.
3. Sternenschlacke abbauen/abliefern, Refinery setzen, auf beiden Ebenen bauen und Einheiten produzieren. Rampen-/Klippenbau muss abgelehnt werden, Ausfahrten müssen benutzbar bleiben.
4. Kleine Gruppen/Gegenverkehr und Gefechte an Rampen anschauen. Sichtverlust beidseits einer Klippe und beim Überqueren der Rampenmitte prüfen; andere Höhenvorteile bleiben ausgeschlossen.

Flugzeuge nutzen eine feste Reiseflughöhe über der höchsten spielbaren Ebene mit Übergang beim Produktionsstart; keine Höhensprünge an Klippen. Hohe Dekorhindernisse werden dadurch nicht automatisch umflogen.

Automatisierte Höhenprüfungen decken Oberfläche, Übergänge, Sichtstufen, Bedienprojektion, Modelle, Effekt-Y und interpolierte Netzwerkposen ab. Offen bleiben gezielte menschliche Abnahme, Zwei-Browser-Höhentest, Touch/Mobilkosten und länger laufende Crowd-/KI-Szenarien. `test:ai` und `test:simulation` benötigen weiterhin ausdrückliche Freigabe; feste Referenzwerte nicht zur Reparatur neu erzeugen.

## Ziel und vorgeschlagene Grenzen

- Auf Mothership besitzen alle **vier öffentlichen Startkandidaten** ein brauchbares Hochplateau, nicht nur die tatsächlich belegten Starts. Jede künftig adaptierte Karte muss denselben Schutz der geheimen Multiplayer-Startzuordnung einhalten.
- Das Plateau umfasst HQ, Anfangswirtschaft und ausreichend Bau-/Ausfahrtsfläche; nicht lediglich einen Sockel unter dem HQ. Die Mitte bietet eine große zusammenhängende Kampfzone. Seitliche Flankenwege bleiben möglich, ohne die zentrale Fläche durch ein enges Wegenetz zu ersetzen.
- Vorschlag für den ersten Versuch: Tiefland `0 m`, Plateaus `+6 m`, breite Rampen mit etwa `18–24 m` Laufstrecke. **Versuchsparameter, kein beschlossenes Balancing.** Plateaugrößen müssen je Karte aus Bauflächen und Ressourcenzugängen folgen.
- Vorschlag: zwei räumlich getrennte Ausgänge pro Basis, eine breite Hauptrampe zur Mitte und ein Flankenzugang. Ein einziger schmaler SC2-artiger Engpass wäre mit der heutigen Crowd-Navigation besonders riskant. Anzahl/Breite nach menschlichem Spieltest entscheiden.
- Zunächst statisches 2,5D-Gelände: genau eine begehbare Bodenhöhe je `x/z`, keine Brücken mit Unterführung, Tunnel, Aufzüge, Terrainverformung oder frei bewegliche Z-Achse.
- Keine neuen Ressourcenmengen, Einheitenwerte oder Höhenboni außer dem ausdrücklich beauftragten Sichtvorteil. Ein neuer Kartenaufbau verändert allerdings bewusst Laufwege und strategisches Balancing; das lässt sich nicht als verhaltensneutrale Grafikänderung behandeln.

## Verbleibende Pakete und Reihenfolge

Der technische Welt-, Navigations-, Darstellungs- und Bedienvertrag ist für Mothership umgesetzt und maßgeblich in der [Architektur](../../architecture.md#welt-darstellung-und-zufall) dokumentiert. Die abgeschlossenen Planungsissues wurden entfernt.

1. [Höhenabhängige Sicht](04-hoehenabhaengige-sicht.md): technisch umgesetzt; menschlicher Rampen-/Klippencheck bleibt offen.
2. [Karten und Abnahme](03-karten-und-abnahme.md): Mothership abnehmen; Alien Planet und Desert erst mit neuem Auftrag adaptieren.

Weitere Karten müssen denselben CPU-Oberflächenvertrag verwenden und dürfen keine inkompatiblen Höhenabfragen oder Renderer-Sonderlogik einführen.

## Entscheidungen vor spielbarer Abnahme

- **Sicht:** Von unten kein Aufdecken des höheren Plateaus, von oben Sicht ins Tiefland innerhalb bestehender Reichweiten. Die Rampenmitte trennt die logischen Stufen; Flugzeuge und Recon scans überbrücken sie. Keine allgemeine Gelände-Occlusion. **Kampf:** keine weiteren Höhenboni und keine neue physische Schussblockierung; bestehende Zielsichtanforderungen bleiben bestehen.
- **Luftfahrt:** feste Reiseflughöhe über der maximalen spielbaren Ebene; Produktionsausfahrt steigt von der lokalen Oberfläche dorthin an.
- **Bauen:** Empfehlung: nur ebene Flächen, Rampen und Klippenränder nicht bebaubar; kein automatisches Terraforming. Sollen weitere Gebäude auch im Tiefland erlaubt sein? Vorschlag: ja; die Höhenvorgabe betrifft die Startbasen.
- **Interaktion:** Bau, Abbau und Reparatur dürfen nicht durch Klippen hindurch erfolgen. Fernheilung/Fähigkeitsflächen zunächst wie Kampf behandeln; deren Höhenregeln ausdrücklich bestätigen.
- **Layout:** Anfangs-Sternenschlacke und zugehöriger Vent auf dem Plateau als Vorschlag; zusätzliche Vorkommen im Tiefland als umkämpfte Ziele. Bestehende Mengen erhalten, nötige Ortsänderungen sichtbar prüfen.

## Nächste Freigabe

Als nächstes steht die gezielte menschliche Mothership-Abnahme an. Alien Planet und Desert bleiben zurückgestellt; ihre mögliche spätere Adaption ist ein eigener Auftrag. Backlog-Einträge sind keine automatische Freigabe weiterer Karten oder zusätzlicher Langläufe.
