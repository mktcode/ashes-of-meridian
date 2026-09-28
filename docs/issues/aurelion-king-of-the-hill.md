# Aurelion / King of the Hill: offene Spiel- und Kartenabnahme

## Stand und Grenze

Die drei Umsetzungspakete sind integriert; beide vereinbarten Zwischenabnahmen erlaubten jeweils das Weiterarbeiten. Die technische Finalisierung ist beauftragt. Detailverbesserungen der Karte bleiben auf später verschoben; weder die Integration noch technische Prüfungen ersetzen menschliche Spiel-, Darstellungs- oder Echtgeräteabnahme.

Maßgebliche Regeln: [King of the Hill](../gameplay.md#king-of-the-hill-auf-aurelion). Technischer Vertrag: [Einzelspieler-Missionen](../architecture.md#einzelspieler-missionen). Kein Holdout-/Wellenmodus und keine Multiplayer-Erweiterung.

Nach dem Build startet `index.html?experiment=aurelion-playable` einen flüchtigen Probelauf auf Stage 4 mit drei Parteien und je zwei Workern, ohne das normale Profil oder den Expeditionscheckpoint zu verändern. Die unabhängige Visualstudie bleibt unter `experiment=aurelion` erreichbar. Ihr [Gestaltungsauftrag](aurelion-map.md) bleibt separat.

## Menschlich zu prüfen

- [ ] Die erste Einführung zeigt und erklärt die zentrale Zone statt eines Gegners. Regeltext, 20,5-m-Markierung, öffentliche Zählstände und Timer sind verständlich; die Kamera fährt anschließend zur eigenen Basis. Erneute Hügelmissionen überspringen die abgeschlossene Einführung.
- [ ] Zone praktisch betreten und verteidigen: alle Einheitenarten, FFA mit gleichen Fraktionen, Gleichstände/Führungswechsel und HQ-Verlust. Die zielorientierte KI und 60-Sekunden-Serie benötigen menschliche Spiel-/Balancebewertung, keine bloße technische Timerbestätigung.
- [ ] Bewegung über diagonale und seitliche Brücken, Gegenverkehr, Basisbau und Ressourcenzugang an den vier Starts prüfen. Vier zuvor diagonale Lampenpodeste wurden für die Fahrzeugzugänge zur inneren Zone auf den äußeren Kardinalrand versetzt; alle zwölf Lampen und der physische Hologlobus-Sockel bleiben erhalten.
- [ ] Normaler Expeditionsverlauf ab Stage 4: Briefing, Hügeleinführung, Reload desselben Gefechtsanfangs, Ergebnis und Vorteilswahl. Ein Reload übernimmt keinen alten Haltestand.
- [ ] Nachtlesbarkeit, Bedienbarkeit und Kosten auf Zielgeräten prüfen. Das hohe Stadt-Grafikbudget bleibt offen; ebenso die fehlende Hindernisvermeidung für Flugzeuge an hohen Dekorbauten. Die [Hologlobus-Rotation](aurelion-hologlobus-rotation.md) ist nicht Teil dieser Finalisierung.

## Prüfkontext

Build, alle 490 Standardtests sowie Serverbuild und 15 kurze Servertests bestanden. Das Netzwerkangebot bleibt auf den bisherigen vier Karten.

Begrenzte Regel-/KI-Prüfungen erfassen Einheitentypen und Randzählung, relative Führung, vollständige Timerresets, tickgenaue Ergebnisprüfung, HQ-unabhängiges Überleben, vollständige Vernichtung und gleichzeitige Ergebnisse. Kartenprüfungen kontrollieren Fahrzeugzugänge zur inneren Zone aus allen vier Starts. UI-/Persistenzprüfungen behandeln Eintrittsstage, Missionsauswahl ohne zusätzliche Zufallsziehung, Checkpoint-Neustart sowie unabhängige und unterbrechbare Hügeleinführung. Ein Abgleich mit dem Stand vor dem Missionsvertrag erhält auf den vier bisherigen Karten Startzustände, Terrainraster und die nächsten acht RNG-Ziehungen.

Der begrenzte Chromium-Check über `file://` (1280 × 900, KI deaktiviert und Simulation pausiert) bestätigt Zentrumseinführung ohne sichtbare Gegner, HUD-Haltestand und Neustart ohne erneute Einführung bzw. alten Timer. Keine JavaScript-/WebGL-Fehler, HTTP(S)-Anfragen oder normalen Profilzugriffe; lokale Belege unter `.tmp/king-of-the-hill/`. Kein autonomer Gefechtslauf und keine Echtgeräteabnahme. Die KI-/Simulations-Langläufe sind nicht beauftragt.
