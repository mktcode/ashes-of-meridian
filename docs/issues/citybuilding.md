# Citybuilding: Siedlungsaufbau nach dem Gefecht

Der erste kleine Mechanikkern verwendet das Meridian Forum als automatisch wachsendes Siedlungszentrum. Maßgeblicher Vertrag: [Wirtschaft, Bau und Produktion](../gameplay.md#wirtschaft-bau-und-produktion). Weitere Regeln oder breite Tests sind durch dieses Issue nicht freigegeben.

## Forum-Zugänge: offene menschliche Abnahme

Maßgeblich sind die [Liefer-/Bau-/Drehungsregeln](../gameplay.md#wirtschaft-bau-und-produktion) und die [weltgebundene Wiederholungsplanung](../architecture.md#zustands--und-verantwortungsgrenzen). Keine volle A*-Suche pro Rasterzelle ergänzen und zivile Stelzen nicht pauschal durch militärische Fundamentregeln ersetzen.

Referenz für die Abnahme: abgeschlossene Frontier-Welt, Seed `13644411`, gemeldeter Einbruch auf ungefähr 1 FPS nach Forum-Zuweisung bei etwa 22:53; Pause oder Umleitung der Worker beseitigt den Einbruch. Der unveränderte, regulär dekodierbare Export enthält ein früheres archiviertes Abbild von etwa 20:53 ohne diese Zuweisungen, nicht den exakten Freeze-Moment. Forum `211` bei `(131.2526,52.2235)`, `visualRotation=5.666666666666667`, ist der Hang-Referenzfall: Maßgeblich ist der gesamte umlaufende Lieferbereich, nicht die gesperrten Klippenpositionen vor den drei Modelltreppen. Sein Vorrat wird nicht künstlich aufgefüllt und der Standort nicht automatisch repariert.

- [ ] **Echtgeräte-Abnahme im Firefox:** Im vorhandenen Stand Worker zuweisen, liefern lassen, pausieren und nach Reload fortsetzen. Die Beseitigung des Einfrierens wurde im Firefox bestätigt. Noch offen: umlaufende Lieferung und Fortsetzen nach Reload. Ein vollständig blockierter Bereich muss ohne dauerhaften FPS-Einbruch warten, Ladung erhalten und einen verständlichen Hinweis zeigen. Der begrenzte CPU-Nachweis mit exportiertem Forum und nachträglich beladenem/zugewiesenem Worker verwendet keine Tick-/KI-Schleife und ersetzt diesen Spielflussnachweis nicht.
- [ ] **Zugangs- und Bedienungsabnahme:** Erreichbare Gegenstelle auf ebenem Gelände und am Hang von vorne, hinten und seitlich beliefern, insbesondere bei gesperrten Fronttreppen. Bau/Drehung ohne erreichbaren umlaufenden Lieferbereich muss ohne Zahlung/Layoutmutation scheitern. Fremde/militärische Hindernisse bleiben erhalten. Ein vollständig unzugängliches Bestandsforum benötigt eine freigeräumte Zufahrt oder Verkauf/Neubau; Vorratsverlust und erhaltene Worker-Ladung müssen verständlich sein. Ohne eigenen Worker ist kein neuer Drehungs-Wegnachweis möglich.
- [ ] **Weiterer Prüfrahmen:** Umfangreiche KI-/Simulationsabnahme ist nicht erfolgt. Die bestehende Persistenz-Fixture-Auswahl mit Seed `1409` liefert innerhalb eines 45-s-Zeitbudgets keinen Fallabschluss; für deren Prüfung eigenes Zeitbudget vereinbaren. Die begrenzte direkte Snapshot-/Restore-Probe am Export ist kein Ersatz für die gesamte Persistenzabnahme.

## Baugrid: Darstellung und Bedienung

Der [zentral beginnende Ringeffekt](../rendering.md#viewport-und-hud) ist im Firefox menschlich positiv bewertet. Rasterauflösung, Ringoptik und genaue Klickprüfung bleiben unverändert.

- [ ] Pan/Zoom/Drehung/Resize und reduzierte Bewegung auf Zielgeräten prüfen. Bereits sichtbare, zwischengespeicherte Flächen benötigen weiterhin aktuelle Belegungs-/Sichtprüfungen; Farbe zwischen Validatorproben bleibt Orientierung.

Kosten bei weitem Zoom, kalter Aufbau und Vorbereitung unter Last werden zentral unter [Performance/Bauplatzraster](performance/README.md#bauplatzraster) geführt. Die Forum-Liefer-/Reload-Abnahme bleibt hier; allgemeine [Navigation](worker-bauwegfindung/issue.md) bleibt separat. Kein Optimierungsauftrag aus der visuellen Abnahme.

## Offene menschliche Abnahme

- [ ] **Einstieg:** Nach dem Sieg die abgeschlossene Welt wieder betreten, ein Forum gründen und Prospectors gezielt zuweisen. Menü-Sperre, Lieferung und Ausbauziel müssen ohne Erklärung außerhalb des Spiels verständlich sein.
- [ ] **Standort und Bild:** Normale Bauanimation ohne Worker sowie eine unregelmäßige, dichte Mischung aller sechs Modelle mit häufigen mittelgroßen Gebäuden prüfen; Hochhäuser sollen nahe dem Forum wahrscheinlicher sein, kleine Gebäude außen; drei parallele Straßen mit einer Querachse sollen acht erkennbare Parzellen bilden. Das Raster dreht mit dem Forum; alle Straßenarme sollen über den freien runden Forumplatz zu den drei Eingängen führen. Zulässige Forum-Drehung in einer bebauten Siedlung prüfen: fehlplatzierte automatische Gebäude müssen verzögert verschwinden und normal nachwachsen; Zurückdrehen vor Ablauf muss den Rückbau aufheben. Ressourcen und Militär bleiben unverändert; vollständiger Zugangsverlust muss Lieferung unterbrechen und darf nicht als erfolgreicher Standortnachweis gelten. Auswahlradius und transparente Zyan-Parzellen auf ebenem Gelände und an Hängen auf Lesbarkeit prüfen; Straßen und der sichtbare Forumplatz bis zum kleinen Auswahlkreis müssen ausgespart bleiben und bei erlaubter Drehung sofort mitwandern, auch bei Pause; die größere interne Zufahrtsreserve ist keine zusätzliche sichtbare Aussparung. Automatische Platzierung verändert kein Terrain; eine freie geometrische Zufahrt garantiert keinen Weg über natürliche Klippen oder bestehende Hindernisse.
- [ ] **Wirtschaft und Progression:** Ausreichende Cinder-/Echo-Reste nach ressourcenintensiven Siegen, Aufwand mehrerer Foren und Wartezeit bis zur nächsten Score-Schwelle prüfen. Keine automatische Rettung bei erschöpften Ressourcen; ein Gründungspaket ist nicht beschlossen. Obergrenzen sind Startparameter, keine Balanceabnahme.
- [ ] **Weltbesuche und Verlust:** Weiterlieferung und Wachstum nach Save/Restore, voller Speicher mit Restladung, Umzuweisung, individuelle zivile Drehung/Verkauf/Fundamentabbruch, gespeicherte Fristen beim Neuordnen sowie langsamer Rückbau nach Verkauf/Zerstörung im normalen Spielfluss prüfen. Pausierte und archivierte Welten wachsen nicht offline.

## Prüfgrenzen und Zuständigkeiten

Kleine CPU-Verträge prüfen Vorratsbuchung, begrenztes Wachstum, Korridor-Ausschlüsse, Rückbau sowie gespeicherte Zuweisungen und Wachstumscursor. Visuelle Wirkung, [Echtgeräteperformance](performance/README.md), echte Pendelstrecken auf den verschiedenen Landschaften und vollständige Runs bleiben offen; keine breite KI-/Simulationsabnahme daraus ableiten.

[Progressionsbalance](expeditions-schwierigkeit-und-upgrades.md), [Weltbesuche/Spielstand](expeditions-spielstand.md), [Modellabnahme](modelle.md) und [menschliche Run-Abnahme](playtest-validation.md) bleiben in ihren Fachissues. Bevölkerung, Steuern, Verkehr, Produktionsketten oder Viertelspezialisierung gehören nicht zum aktuellen Kern.
