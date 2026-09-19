# Höhenstufen 1: CPU-Oberfläche, Übergänge und Bauzugänge

Abhängigkeit: [Ziel und offene Regelentscheidungen](README.md). Dieses Paket definiert den gemeinsamen Vertrag für Darstellung und Karten, keine vollständige 3D-Simulation.

## Prototypstand

Der Mothership-Durchstich auf `experiment/hoehenstufen` integriert den Oberflächen-/Segmentvertrag, radiusabhängige Klippenfreiräume, Arbeitszugänge, ebene Fundamente und sichere Produktions-/Verstärkungsplätze. Synthetische Geometrie- und kurze Mothership-Verhaltenstests liegen im Branch. Die Aufgaben unten bleiben kartenübergreifende Abnahmeziele; kein Nachweis für Großgruppen, alle Spawnkontexte oder die noch nicht umgebauten Karten. [Teststart und offene Grenzen](README.md#jetzt-manuell-testen).

## Ausgangsbefund vor dem Experiment

`Position` enthält nur `x/z`. `Battlefield.path`, `lineFree` und `blockedAt` in `src/world.ts` arbeiten mit einem Belegungsraster; Bewegung, Yield und Recovery in `src/simulation/movement.ts` prüfen überwiegend Zielpositionen. `distance` ist planar. Desert besitzt schon `WorldRelief` und dreiecksgenaue Interpolation, markiert erhöhte Samples aber als Hindernisse. Das ist kein bereits begehbares Höhenfeld.

Wichtig: **Zwei freie Rasterzellen können durch eine Klippe getrennt sein.** Nur neue Y-Werte oder ein Steigungstest in A* verhindern weder direkte Abkürzungen noch seitliches Steering über die Kante.

## Vorgeschlagener Vertrag

- Die CPU-Welt besitzt eine unveränderliche, spielbare Oberfläche; Renderdaten leiten sich daraus ab, nicht umgekehrt aus beliebigen sichtbaren Felsen/Hangardächern. Die obere Fläche eines Dekorhindernisses wird dadurch nicht begehbar.
- Höhe und Dreieckstopologie sind gemeinsam definiert. `heightAt(x,z)` verwendet exakt die gezeichneten Dreiecke, nicht bilineare Näherung oder ein zweites Noise-Feld. Normalen/Steigung, Bauflächen und Übergangsmasken stammen aus derselben Quelle.
- Für den ersten Versuch reguläres Höhengitter mit ausreichend steilen, gesperrten Klippenbändern und expliziten Rampen; keine vertikal übereinanderliegenden Bodenflächen. Logische Ebene und kontinuierliche Rampenhöhe unterscheiden.
- `Position` und Befehle bleiben `x/z`. Bodenhöhe ist aus der statischen Karte ableitbar; keine redundante mutable `entity.y` ohne fachlichen Grund. Die bestehende 2D-Raumsuche kann bleiben.
- Begehbarkeit braucht neben Zellbelegung eine gemeinsame **Übergangs-/Segmentprüfung**: Start, Ende, durchlaufene Kanten und Körperfreiraum. Oberfläche und statische Hindernisse getrennt halten; Gebäude-/Recovery-Raster dürfen die Terrainregeln nicht überschreiben.
- Flache Karten/Fixtures erhalten denselben Vertrag mit konstanter Höhe. Keine Legacy-Adapter oder dauerhafte parallele Navigationsimplementierung.
- Keine zusätzliche Simulation-RNG-Nutzung. Experimentelle Layoutvariation bekommt einen eigenen stabilen Seed-Stream. Bestehende Ressourcen-/Startauswahlströme nicht durch zusätzliche Ziehungen verschieben.

## Aufgaben

- [ ] Synthetische Fixture mit zwei ebenen Flächen, einer Rampe und gesperrter Klippe aufsetzen; Höhe außerhalb der Kartengrenzen ausdrücklich behandeln.
- [ ] A*-Nachbarn, diagonale Übergänge, `lineFree`, Pfadglättung und Direktweg müssen dieselbe Übergangsregel verwenden. Eine gültige Route darf durch Glättung nicht quer über die Klippe laufen.
- [ ] Bewegungsschritte, Steering, Sliding, Yield und Recovery gegen dieselbe Regel prüfen; nicht nur den Endpunkt. Größenabhängiger Randabstand muss zum vorhandenen Körpermaß passen, ohne Kollisionsradien zu verändern. Maximale Schrittweite/Tempo dürfen Kanten nicht überspringen.
- [ ] `nearest`, `unitPosition`, Spawn-/Reinforcement-Plätze und Ausfahrtsuche dürfen Bodenobjekte nicht auf ein nahegelegenes, aber unerreichbares anderes Plateau versetzen. Suche nach räumlicher Nähe allein genügt nicht. Produktionsstart und reservierter Ausgang brauchen einen gültigen verbindenden Weg.
- [ ] Stopp-/Arbeitsbedingungen höhen- und zugangstauglich machen: bestehende `distance <= radius`-Prüfungen für Abbau/Bau/Reparatur können sonst Arbeit über die Klippe erlauben. Arbeitsseiten statt nur Zielzentrum prüfen, ohne Reichweiten zu erhöhen.
- [ ] `canBuild`/`foundationPosition` in `src/simulation/economy.ts`: gesamte Baufläche ausreichend eben und mit Klippenabstand, Rampen ausgeschlossen. Nicht nur Mittelpunkt und zwölf Umfangssamples vergleichen. Refinery-Snapping und tatsächliches Fundament nutzen dieselbe Fläche/Höhe; KI verwendet denselben Validator.
- [ ] Startplatzsuche erst auf dem fertigen Plateau-/Blockerlayout ausführen; Suchradius darf HQs nicht ins Tiefland ausweichen lassen. Vor Teamauslosung alle vier Kandidaten samt Ressourcen und Baureserve validieren.
- [ ] `NavigationArea` und Teilwegstatus erhalten: ähnliche X/Z-Distanz auf anderer Höhe ist weder Ankunft noch erreichbare Arbeitsseite. Suchbudget erschöpft bleibt verschieden von unerreichbar.

## Prüfungen und Akzeptanz

Gezielte neue Kurztests in Terrain-/Navigations-/Ökonomiekontexten: Rampen in beiden Richtungen, diagonale Kanten, geglättete Pfade, Yield/Steering, Recovery, große Körper, Gebäude am Rand, Refinery-Snapping und Produktionsausgänge. Kein monatelanger Simulationszustand für einen lokalen Übergangsvertrag.

Akzeptanz: Bodenobjekte wechseln Höhe ausschließlich über passierbare Übergänge, arbeiten nicht über eine Klippe und erhalten keine Teleport-Recovery. Eine legal bebaubare Plateaufläche bleibt inklusive Ausfahrt benutzbar. RNG- und ungeänderte Flachkartenregeln bleiben geschützt. Testsollwerte nicht zum Grünmachen neu erzeugen.

Die vorhandenen [Worker-Navigationsprobleme](../worker-bauwegfindung/issue.md) sind eine separate Baseline, kein automatischer Reparaturauftrag. Zusätzliche Rampen-/Gegenverkehrs-Langläufe benötigen ausdrückliche Freigabe; Standardtests erst nach Integration durch den Hauptagenten gemäß [Prüfverfahren](../../testing.md).
