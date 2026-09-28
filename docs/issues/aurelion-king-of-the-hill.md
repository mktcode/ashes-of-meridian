# Aurelion: spielbare Karte und King of the Hill

## Auftrag und verbindliche Haltepunkte

Umsetzung in drei Paketen. **Nach Paket 1 und Paket 2 jeweils Zwischenstand melden und auf menschliches Feedback warten; nicht selbstständig weiterarbeiten.** Die Spielintegration ist mit diesem Auftrag freigegeben; offene Darstellungsbefunde der [Visualstudie](aurelion-map.md) bleiben bestehen.

1. Aurelion spielbar machen: CPU-Oberfläche, Navigation, Hindernisse, Bauflächen, Ressourcen, Startplätze und technischer Kartenkatalog. Zunächst isolierter Probelauf, noch keine zufällige Expedition oder Multiplayer-Auswahl.
2. Kleinen allgemeinen Missionsvertrag einführen, ohne die bisherigen HQ-FFA-Regeln oder deren RNG zu verändern. Anschließend erneut Halt.
3. King of the Hill mit zielorientierter KI, HUD, Briefing, Checkpoint und Expeditionsauswahl integrieren. Kein Holdout-/Wellenmodus und keine Multiplayer-Erweiterung.

## Bestätigte Spielregeln

- Jede Partei spielt gegen jede andere, auch bei gleicher Fraktion.
- Wer innerhalb des zentralen Radius allein die größte Einheitenzahl besitzt, kontrolliert das Zentrum. Alle lebenden Einheiten zählen gleich, einschließlich Worker, Commander und Flugzeuge; Gebäude zählen nicht als Einheiten.
- Sieg nach **60 Sekunden ununterbrochener Kontrolle in Simulationszeit**. Gleichstand, leeres Zentrum oder Führungswechsel beendet die Halteserie; kein Aufsummieren und kein Pausieren alter Fortschritte.
- Verlust des HQs allein scheidet keine Partei aus. Solange sie Einheiten hat, spielt sie weiter.
- Sind alle anderen Parteien vollständig besiegt, entfällt das Abwarten des Timers.
- Bestehende Standardmissionen behalten ihre bisherigen HQ-Regeln.

## Haltepunkt nach Paket 1: spielbare Karte

**Technisch umgesetzt. Menschliches Feedback erlaubt Paket 2; Detailverbesserungen der Karte sind ausdrücklich auf später verschoben.** Das ist noch keine abschließende Karten-/Darstellungsabnahme.

Nach dem Build `index.html?experiment=aurelion-playable` öffnen. Der isolierte Probelauf startet vier Parteien auf Stage 8 mit je zwei Workern und ohne permanente Upgrades. Profil und Checkpoint bleiben flüchtig. Noch gilt bewusst die bestehende HQ-Siegbedingung; kein Halte-Timer, keine neue Ausscheidungsregel und keine zielorientierte Hügel-KI. Die separate Visualstudie unter `experiment=aurelion` bleibt erhalten.

- Die erhaltene Stadtgeometrie besitzt jetzt eine CPU-Oberfläche mit erhöhten Basisplattformen, drei Zugängen je Plattform und der zentralen Plaza. Geländer, Dachaufbauten, Schluchten und der reale Hologlobus-Sockel sind gesperrt; Verkehr unter den Decks ist ausschließlich Dekor.
- Bauen ist auf den oberen Plattformen möglich. Brücken, Zwischenlandungen und zentrale Plaza bleiben ohne Fundamente, damit die Zugänge nicht zugebaut werden. Zwei Ressourcenfelder je Plattform behalten die üblichen Ressourcenmengen und Vent-Regeln.
- Spielerische Höhenstufen verwenden den bestehenden Mothership-Vertrag. Keine Änderung an Einheitspreisen, Kollisionsradien oder den bisherigen Karten-/Simulations-RNG-Folgen. Aurelion ist technisch registriert, aber noch nicht in normaler Expedition oder Multiplayer auswählbar.
- Stadtmaterialien und Atmosphäre bleiben getrennt von den normalen Einheiten-/Ressourcen-/Effektmaterialien. Der Spieladapter berücksichtigt Fog; Performance lässt Tiefenwolken/SSAO aus. Normale Karten behalten ihre bisherigen Programme.

**Prüfkontext:** Build und Standardtestsuite bestanden. Die neuen begrenzten Kartenprüfungen decken vier Startplätze, Fahrzeugwege, alle drei Plattformzugänge, Worker-Hin-/Rückwege, Raffinerieflächen, Bauraum und wiederholbare Initialisierung ab. Ein Abgleich sämtlicher freier Rasterzellzentren mit den tatsächlichen Stadt-Dreiecken prüft Bodenhöhe und übersehene Aufbauten; er ersetzt keine kontinuierliche Kollisions- oder Spielabnahme. Rendererprüfungen erfassen Materialtrennung und Meshfreigabe beim Kartenwechsel. Serverbuild und die kurzen Netzwerkprüfungen bestanden; das öffentliche Netzwerkangebot bleibt auf den bisherigen vier Karten.

Technischer Chromium-Check über `file://` bei 1280 × 900: vier Parteien/acht Worker, Terrain-Picking, High/Balanced/Performance und Rückwechsel zum normalen Kartenrenderer ohne JavaScript-/WebGL-Fehler. Keine HTTP(S)-Anfragen oder Profilzugriffe. Die KI wurde für diesen Darstellungscheck deaktiviert und die Simulation pausiert; keine autonome Gefechtsabnahme. Diagnosebilder liegen lokal unter `.tmp/aurelion-playable/`. Keine Freigabe/Abnahme der Darstellung oder Echtgeräteperformance daraus ableiten.

**Bitte menschlich prüfen:** Lesbarkeit und Bedienbarkeit der Nachtkarte; Bewegung über diagonale und seitliche Brücken, Gegenverkehr, Basisbau und Ressourcenzugang an den vier Starts. Der Hologlobus-Sockel bleibt ein physisches Hindernis; das spätere Zielgebiet muss die begehbare Plaza darum umfassen. Die bekannte [offene Rotation des Liniengerüsts](aurelion-hologlobus-rotation.md) ist nicht nebenbei behoben. Das hohe Grafikbudget und die bereits allgemein fehlende Hindernisvermeidung für Flugzeuge an hohen Dekorbauten bleiben Grenzen; kein neues Luftkollisionssystem in diesem Paket.

## Haltepunkt nach Paket 2: allgemeiner Missionsvertrag

**Technisch umgesetzt; vor Paket 3 auf erneutes menschliches Feedback warten.** Der [Missionsvertrag](../architecture.md#einzelspieler-missionen) trennt Missionskennung und Landschaft. Alle Encounters einschließlich der isolierten Kartenstarts verwenden weiterhin die unveränderte HQ-FFA-Mission. Keine Hügelregeln, kein Timer, keine neue KI und keine Erweiterung der zufälligen Kartenauswahl.

Der Expeditionscheckpoint verwendet Version 5 und validiert Missionskennung sowie zulässige Karte. Alte Expeditionen werden nicht übernommen; das permanente Profil bleibt erhalten. Gesichert wird weiterhin nur der Gefechtsanfang, kein laufender Missionszustand. Zieltexte und Ergebnisgründe stammen aus Missionsmetadaten.

**Prüfkontext:** Build, alle 476 Standardtests sowie Serverbuild und 15 kurze Servertests bestanden. Gezielte HQ-/Persistenz-/UI-Prüfungen decken Missionsübergabe, ungültige Kombinationen, unveränderte Zufallsziehungen und die bisherigen Ergebnisregeln ab. Ein Vorher-nachher-Abgleich mit Seed 1409 auf allen fünf Karten bestätigt identische Startzustände (bis auf die neue Missionskennung), Terrainraster und die nächsten acht Simulations-RNG-Ziehungen. Die menschliche Prüfung von Briefing und Wiederaufnahme bleibt offen; keine autonome KI-/Simulationsabnahme.

## Vor Paket 3 noch präzisieren

- Radius anhand des spielbaren Zentrums festlegen.
- „Vollständig besiegt“ bei verbliebenen Gebäuden, aber momentan keinen Einheiten: Produktionsfähigkeit berücksichtigen; kein Ausscheiden direkt beim üblichen HQ-Start ohne Worker. Gleichzeitige vollständige Vernichtung deterministisch behandeln.
- Aufnahme in die Expedition: Eintrittstiefe und Auswahlhäufigkeit sowie bestehende tiefenabhängige Parteienzahl.

## Prüfgrenzen

Build, gezielte Karten-/Navigations-/Rendererprüfungen und am Ende des integrierten Pakets die Standardtestsuite. Keine umfangreichen KI-/Simulationsläufe ohne zusätzlichen ausdrücklichen Auftrag. Technische Prüfungen ersetzen weder menschliche Karten-/Darstellungsabnahme noch Echtgeräteperformance.
