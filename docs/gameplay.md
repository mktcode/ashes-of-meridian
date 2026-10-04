# Spiel und Bedienung

Regelkonzept; aktuelle Preise, Ränge, Eintrittsschwellen und Fraktionsboni stehen im Spiel und in `src/content.ts`.

## Gefecht und Fortschritt

**New expedition** wählt freigeschaltete Fraktion und vier verschiedene Command-Fähigkeiten in HUD-Reihenfolge. Dieses Loadout bleibt für den Run fest. Frühe Stages führen nacheinander gegen die drei Fraktionen; später treten weitere Gegner-Slots im Free-for-all ein. Alle Parteien sind feindlich, auch bei gleicher Fraktion. Gegner, Karte und Seed werden am Übergang festgeschrieben; keine unmittelbare Kartenwiederholung, kein Neuwürfeln durch Reload.

Jede Partei startet ohne Gebäude mit einem Worker; Flottenupgrades und Expeditionsvorteile können zusätzliche Start-Einheiten liefern. Die Baukosten eines HQ kommen zu den bisherigen Startreserven hinzu. Das erste HQ wird regulär platziert, bezahlt und vom Worker gebaut, auch durch die KI. Nur der erste Tutorialstart eines neuen Profils stellt Ressourcen in Sicht bereit; spätere Gefechte und neue Runs erfahrener Profile beginnen mit Erkundung. Diese Startregel wird mit dem Gefecht gespeichert.

In **HQ elimination** hält vor dem ersten fertigen HQ ein lebender Worker die Partei im Spiel. Nach dessen Fertigstellung gewinnt die letzte Partei mit HQ. Letztes HQ verloren → Ausscheiden samt Restarmee; bereits abgefeuerte Geschosse bleiben. Eigener Verlust hat bei Gleichzeitigkeit Vorrang. Commander-Verlust allein beendet nichts. KI-gegen-KI-Abschüsse und Ausscheidungsbereinigung geben keine Spieler-Killpunkte.

Sieg erhöht Tiefe und bietet einen Vorteil für folgende Gefechte. Bestehende Gegner-Slots sammeln eigene Vorteile desselben Pools, behalten sie bei Fraktionswechsel; neue Slots beginnen leer. Permanente Flottenupgrades gelten nur für den Spieler und werden beim Start kopiert. Worker liefern Cinder zum fertigen HQ, Raffinerien an Vents Echo.

Expeditionskarten verteilen einmalige Vorratsfunde auf erreichbaren Freiflächen abseits der Vorkommen. Orange Kisten enthalten Cinder, türkis markierte Echo; Echo-Funde sind seltener. Eine Einzelkiste, ein kleiner Stapel oder ein größerer Vorratshaufen zeigen die zufällige Mengenstufe. Eine lebende Bodeneinheit sammelt bei sichtbarem, klippenfreiem Zugang in unmittelbarer Nähe automatisch ein; die nächste berechtigte Einheit erhält den Fund für ihre Partei, auch Gegner können ihn bergen. Es braucht weder Worker noch HQ. Eigene Bergung zeigt die farbige, aufsteigende Menge am Fundort und spielt einen kurzen SFX-Bergungston, ohne Dialog oder Toast; fremde Bergung erzeugt keine eigene Auszahlungsmeldung. Ungeborgene Kisten halten ihre Baufläche frei, sperren aber keine Fahrwege. Interne Szenarien enthalten keine Vorratsfunde.

Ungenutztes Echo wird begrenzt evakuiert; vom Spieler zerstörte fertige Feindgebäude liefern zusätzliche permanente Bergung. Reserve finanziert Fleet Systems und Command Modules. Besttiefe schaltet Fraktionen frei; Score ist keine Währung. Auszahlung/Fortschritt erfolgt nur einmal, auch bei erneutem Ergebnisaufruf.

Die KI nutzt bezahlte Aktionen, eigene Sicht und verzögerte Beobachtung, keine künstlichen Wellen/Sichtcheats. Kleine bewaffnete Suchtrupps erkunden unbekannte Landungsregionen und Gelände; die Basisreserve bleibt zurück. Doktrin und begrenzter Verhaltensdruck hängen von Fraktion/Tiefe ab; Vorteilsstapel können weiter wachsen. Wetter, Ruinen und Kampfspuren sind dekorativ. Aktuelle Sicht und Erkundung sind verschieden: bekanntes Gelände verrät keine aktuelle Feindposition. Auf Karten mit Sichtstufen sehen Bodenquellen nur gleich hoch/nach unten; Flugzeuge und Recon scans umgehen diese Grenze, ohne weitere Höhenkampfboni.

## Landschaften

Desert, Alien Planet, Mothership, Westmark, Frontier und Haven sind seedbasierte Landschaftsfamilien für Expeditionen. Maße, Höhen, Ressourcenverteilung und Varianten wechseln zwischen Gefechten; es gibt keine festen Eckbasen. Wirtschaftsflächen und Wege werden vor den getrennten Parteienstarts erzeugt. Hohe Positionen behalten ihre Sichtvorteile; dekorative Dächer sind nicht begehbar. Die Tageszeit startet seedabhängig und durchläuft in zehn Minuten Spielzeit einen ganzen Tag mit Morgen-/Abenddämmerung. Pause hält den Zyklus an, Spieltempo beschleunigt ihn mit. Auch nachts bleibt die Welt durch kühles Fülllicht sichtbar; Aufklärung und Sichtweiten ändern sich nicht. [Technische Weltgrenzen](architecture.md#weltrezepte-und-feste-designs).

## Kamera und Befehle

Der Tempoknopf neben der Gefechtsuhr wechselt zwischen **1×, 2× und 3×** der Basisgeschwindigkeit. Jedes neue Gefecht startet mit 1×; ein fortgesetztes Gefecht behält seine gespeicherte Auswahl. Die Basis entspricht 1,5 Sekunden Simulationszeit pro realer Sekunde. UI und Audio bleiben in Echtzeit.

- Ziehen mit einem Finger/linker Maus verschiebt, Ziehen mit mittlerer Maus dreht die Kamera. Zwei Finger drehen per Drehgeste und zoomen per Pinch; das Mausrad zoomt. Beim Drehen bleibt der sichtbare Geländepunkt in der Mitte des Spielfeldfensters fest, nicht die Mitte zwischen den Fingern oder die gesamte Bildschirmmitte. Am Kartenrand haben die Kameragrenzen Vorrang; sie umfassen die gesamte Karte einschließlich des projektionsbedingten Höhenversatzes, unabhängig vom Zoom. Minimap sowie Basis-/Zoomknöpfe ergänzen die Navigation. Tap/Linksklick wählt.
- Doppeltap auf dieselbe eigene Einheit gruppiert sichtbare Einheiten dieses Typs; Dreifachtap sichtbare Nicht-Worker. Gruppenschalter ergänzen sichtbare/gesamte Kampfauswahl. Pan, Zielwechsel und Befehle unterbrechen Tapfolgen.
- Boden-Tap mit Auswahl bewegt; Schwerter-Schalter aktiviert Attack-move für zukünftige Kampfbefehle, nicht Worker. Ziel-Tap/Rechtsklick erteilt Kontextbefehle. Neuer Auftrag ersetzt den bisherigen, keine Befehlsqueue.
- **Cancel** beendet Zielwahl ohne Verbrauch. Fehlplatzierung erlaubt Wiederholung. Keine Hotkeys, Rechteck-/Shift-Auswahl oder Kontrollgruppen.
- Das erste Wirtschaftstutorial beginnt mit Worker-Ankunft und HQ-Bau. Danach fährt die Kamera zum eigenen HQ, zum Gegner und zurück. Während Ankunft und Aufklärungsfahrt sind Spiel-/Kameraeingaben gesperrt, nicht die Simulation; das Pausenmenü bleibt verfügbar. Die Fahrt gewährt keine Simulationssicht, zeigt aber den gegnerischen Außenposten vorübergehend in der Darstellung. Abgeschlossene Anleitungen werden im Profil vermerkt.

## Wirtschaft, Bau und Produktion

Rekrutierung verteilt neue Aufträge auf die kürzeste passende Produktionsqueue, bucht laufende Aufträge nicht um. Versorgung wird reserviert; blockierter Ausgang hält Folgeproduktion auf. Queue-Tap storniert bevorzugt wartende Aufträge mit Erstattung.

Worker verteilen Abbau-/Rücktransport auf Servicepunkte. Raffinerievorschau rastet auf erkundete Vents ein; im Baumodus ist auch ein verdeckter Vent über seine Kontursilhouette ansteuerbar. Raffinerien arbeiten ohne dauerhaft gebundenen Worker. Einheiten halten Körperabstand, beladene Worker haben Ausweichvorrang; keine allgemeine Crowd-Garantie.

Bau braucht einen freien Worker, erreichbaren Arbeitsbereich und freie stabile Baufläche, auch auf sanften Hängen; Fahrt zu Bau/Reparatur belegt ihn bereits. Worker-Tap auf eigenes Fundament überträgt den Auftrag an genau einen Worker, ohne Mehrarbeiterbonus. Unterbrochene Arbeit nimmt nicht automatisch wieder auf.

Gebäudeaktionen: **Sell**, **Repair/Stop repair**, **Rally point**, bei Fundamenten **Cancel build**. Reparatur kostet Cinder und beginnt erst am Ziel. Verkauf bestätigt pausiert die ursprüngliche Gebäude-ID; letztes fertiges HQ ist geschützt. Verkauf/Bauabbruch erstatten anteilig, offene Rekrutierungen vollständig. Versorgungsverlust entfernt keine bestehenden Truppen.

Fähigkeiten brauchen Energie/Cooldown und ihre jeweiligen Technologie-/Zielbedingungen; HUD ist nur Anzeige. Orbital Strike benötigt fertige Fahrzeugfabrik und aktuelle Zielsicht, Reinforcements erkundeten Boden nahe eigenen Ankern. Gleiche Flächenwirkungen stapeln nicht multiplikativ. Tempo gilt nur im Gefecht, neuer Start beginnt mit 1×.

## Speichern und Lebenszyklus

Profil und genau eine Expedition liegen lokal im Browser. **Continue expedition** stellt ein begonnenes Gefecht pausiert wieder her, einschließlich Armeen, Konten, eingesammelter Vorratsfunde, Erkundung und laufender Aufträge. Ein Gefecht kann nicht neu gestartet werden. Im Übergang bleibt die offene Vorteilswahl erhalten. Flottenkäufe ändern nur künftige Gefechte, nicht die im laufenden Gefecht übernommenen Upgrades. Niederlage/Abbruch löscht den Run; eine neue Expedition ersetzt ihn erst nach Bestätigung.

Gespeichert wird vor Freigabe eines neuen Gefechts, während des Spiels alle fünf Echtzeitsekunden sowie bei Pause, Hauptmenü, Hintergrund/`pagehide` und bestmöglich bei Grafikverlust. Ein harter Prozessabbruch kann zum letzten erfolgreichen Autosave zurückführen; Schließen allein ist kein zuverlässiger Speicherzeitpunkt. Pause und Tab-Rückkehr setzen nicht automatisch fort, offline vergeht keine Gefechtszeit. Storage-Ausfall bedeutet flüchtigen Fortschritt in diesem Tab; vor dem Menüwechsel wird gewarnt, Reload kann ältere Werte laden. Beschädigte oder inkompatible Saves werden nicht als frischer Gefechtsstart geladen, sondern müssen ausdrücklich verworfen werden. Alte reine Startcheckpoints werden nicht migriert; permanente Profilfortschritte bleiben erhalten. Lokale Speicherung ist kein manipulationssicherer Anti-Savescumming-Schutz.

Checkpoint-Pfeile zeigen nur aufgezeichnete Landschaften, keine historischen Armeen; sie verändern Continue nicht. Archiv endet mit dem Run, fehlende frühere Seeds werden nicht erfunden. Kein frei konfigurierbarer Skirmish oder Ingame-Forschung. [Offene Spielstandsabnahme](issues/expeditions-spielstand.md) und [vollständige Runs](issues/playtest-validation.md).
