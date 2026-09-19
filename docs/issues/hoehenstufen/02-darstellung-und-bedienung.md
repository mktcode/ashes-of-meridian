# Höhenstufen 2: Oberfläche zeichnen, auswählen und Effekte erden

Abhängigkeiten: [Ziel/Regelentscheidungen](README.md), [gemeinsamer CPU-Vertrag](01-welt-und-navigation.md). Kein separater GPU-Höhengenerator, keine neuen Texturen als Voraussetzung.

## Prototypstand

Mothership auf `experiment/hoehenstufen` nutzt triangulierten Spielboden, Terrain-Picking, geerdete Modelle/Dekoration und absolute Effekt-Y-Werte. Auswahl/Overlays, Gerüste, Kontaktflächen und Ringe folgen der Oberfläche; Kameraziehen behält bewusst seine flache Gestenebene. CPU-Tests und ein `file://`-Browserstart ersetzen nicht die ausstehenden Darstellungs-, Touch- und Mehrclientprüfungen. Die Aufgaben unten bleiben Abnahmeziele. [Teststart und offene Grenzen](README.md#jetzt-manuell-testen).

## Ausgangsbefund vor dem Experiment

`BattlefieldView.sync` baut den Boden in `src/world-view.ts` auf einer festen Ebene auf. `renderEntity` besitzt relative Schwebe-/Flughöhen, aber keine Terrainhöhe. Einzelne Elemente umgehen sogar diesen gemeinsamen Offset: Ventdampf, Baugerüst und Kontaktschatten. `MeridianRenderer.ground` in `src/renderer/runtime.ts` schneidet bei `y=0`; App-Culling, UI-Picking, Lebensbalken, Marker und Rally-Linien verwenden ebenfalls feste Höhen. Nur das Modell anzuheben reicht daher nicht.

## Aufgaben

- [ ] Spielbare Bodenmeshes aus Paket 1 mit geeigneten Bodenmaterialien zeichnen. Bisherigen Flachboden dort ersetzen, nicht durch neue Flächen überdecken. Dekor-/Hindernismeshes bleiben getrennt; Modelle müssen nicht einzeln auf Weltkoordinaten umgebaut werden.
- [ ] Gemeinsame Pose aus Bodenhöhe plus modellrelativem Offset: Ressourcen, Einheiten, Gebäude, Fundamente, Ghosts und Bauvorschauen. Menüs/Portraitvorschauen ohne Welt bleiben definiert. Für den ersten Versuch aufrecht stehende Einheiten; Hangneigung/Bein-IK ist kein Muss.
- [ ] Alle direkt platzierten Zusätze auf dieselbe Oberfläche bringen: Gerüste, Gasdampf, Ringe, Schilde, Spawn-/Befehls-/Fähigkeitsmarker, Staub, Kontaktschatten und Rally-Linien. Große Kreise auf Rampen benötigen segmentierte Bodenanpassung statt nur einer höher gesetzten flachen Scheibe.
- [ ] Effektursprünge und Ziele konsistent behandeln: Mündung/Heil-/Arbeitsstrahl, Artilleriebogen, Einschläge, Explosionen, Partikel-Boden und Schadenstexte. Beim Artilleriebogen beide Endhöhen berücksichtigen, nicht nur `startY`. Bestehende kosmetische Einzelspiel-RNG-Aufrufe erhalten.
- [ ] Boden-Picking als Strahl gegen die gemeinsame Terrainoberfläche; vordersten gültigen Treffer wählen, Klippenflächen/Terrainrand ausdrücklich behandeln. Strahl traversal/begrenzte Suche statt alle Dreiecke bei jeder Fingerbewegung zu prüfen. Befehle auf nicht begehbare Treffer nachvollziehbar behandeln, keine versteckte Auswahl des Bodens hinter einer Wand.
- [ ] Eingabezwecke trennen: Objekt-/Bau-/Boden-Picking trifft Terrain, Kameraziehen kann eine stabile Gestenebene verwenden. Gemeinsames Ersetzen jedes `ground()`-Aufrufs könnte beim Überfahren einer Klippe Kamerasprünge auslösen. Pinch-Anker und Minimap-Viewport gesondert prüfen.
- [ ] Auswahl, Lebensbalken, Bildschirmmarker und grobes App-Culling aus derselben sichtbaren Pose projizieren. Verdeckte Einheiten nicht nur wegen Terrainhöhe außerhalb des falschen Bildbereichs ausblenden.
- [ ] Minimap unterscheidet begehbare Hochflächen von Blockern; Rampen müssen erkennbar sein. `terrainFeatureGrid` darf nicht pauschal jede Erhöhung als unpassierbar einfärben.
- [ ] Kamera, Tiefenbereich und Schattenreceiver umfassen Hochplateau plus höchste Gebäude; Randblicke und beide Basisrichtungen prüfen. Keine automatische dynamische Terrain-Ausblendung voraussetzen.

## Multiplayer-Vertrag

Statische Bodenhöhe kann aus öffentlicher Karte/Seed rekonstruiert werden. Das ist eine zu prüfende Designannahme, keine Zusage, dass alle Netzwerkfelder unverändert bleiben: Effektfelder in `src/multiplayer/state.ts` und `src/multiplayer/presentation.ts` enthalten teilweise explizite Y-Werte und brauchen eine eindeutige Semantik für absolute bzw. relative Höhe.

- [ ] Pose auf der Darstellungsuhr aus interpoliertem `x/z` auf dem Terrain ableiten. Nur die Y-Endpunkte zu interpolieren kann an Rampenknicken in den Boden schneiden.
- [ ] Terrainhöhe selbst ist öffentlich, verborgene Feindpositionen bleiben es nicht. Keine zusätzlichen Kontakte/Ziele für die Höhenkorrektur übertragen.
- [ ] Zeitversetzte Schussereignisse und interpolierte Modelle kohärent darstellen; Server-Sichtfilter zum Ereigniszeitpunkt erhalten. Kein clientseitiges Nachsimulieren von Sicht oder Kampf.
- [ ] Luftfahrtregel aus dem Überblick entscheiden und für Modell, Picking, Effekte und Netzwerk gemeinsam anwenden. An Klippen darf ein Flugzeug weder springen noch im Hochplateau verschwinden; Ausfahrt aus erhöhtem Hangar eingeschlossen.

## Akzeptanz und Prüfung

Technische Kurztests: dreiecksgenaue Oberfläche, Projektion/Picking auf Plateau und Rampe, Rand-/Mehrfachtreffer, konstante Flachfläche, gemeinsame Effektendpunkte und Netzwerk-Renderpose. Gezielter `file://`-Browsercheck erst bei konkreter Frage zu echter GPU-Darstellung/Eingabe; Build und Stubs führen kein GLSL aus.

Menschliche Abnahme: erkennbare Höhenstufen, lesbare Rampen, erreichbare Einheiten hinter Klippen, Touch-Picking und stabile Kamera. Mobile Kosten separat prüfen; bestehendes Desert-Relief nicht pauschal auf alle Karten vervielfachen. [Grafikvertrag](../../rendering.md) und [Prüfgrenzen](../../testing.md) bleiben gültig.
