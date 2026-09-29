# Aurelion: offene Karten- und Darstellungsabnahme

Aurelion ist eine spielbare Nachtstadt mit vier erhöhten Startplattformen, Brücken, Ringzentrum, gestaffelten Hochhäusern und Unterdeckverkehr. Im Zentrum steht der Reaktorkern der [Echo-Bergung](aurelion-echo-bergung.md). Probelauf nach dem Build: `index.html?experiment=aurelion-playable`; normale Browser-Spielstände bleiben unberührt.

Die separate Hologlobus-Visualstudie ist durch die Spielintegration überholt und entfernt. Ihre Rotationsaufgabe entfällt mit dem Objekt, nicht durch eine behauptete visuelle Fehlerbehebung. Gestaltungshistorie bleibt in Git. Pflege und technische Grenzen stehen in [Rendering](../rendering.md#terrain-und-renderpässe) und [Architektur](../architecture.md#welt-darstellung-und-zufall).

[Project Tomorrow](project-tomorrow.md) ergänzt einen optionalen gemeinsamen Tageszeitvertrag auch für Aurelion-Designs: Stadt-/Modelllicht, Himmel, Reflexion und Wolkenfarben lesen dieselbe Atmosphäre. Das bestehende Aurelion bleibt ausdrücklich bei seiner Nachtgestaltung und festen Geometrie; alternative Tageszeitdesigns brauchen eine eigene Kontrast-/Wolkenabnahme und sind kein laufender Tag-Nacht-Zyklus.

## Menschlich zu prüfen

- [ ] Lesbarkeit der Einheiten und Gebäude im kühlen Fülllicht/warmen Deck-Reflexlicht beurteilen. Die Stadt behält ihre dunklen Schluchten, hellen Decks, Fenster und Reklamen; das Modelllicht verändert nicht die globale Nachtbeleuchtung.
- [ ] Sichtbare Bewegung und räumliche Lesbarkeit der Ost/West- und Nord/Süd-Verkehrsachsen mit Nebenstraßen beurteilen. Zivilfahrzeuge und Spuren verlaufen ausschließlich unter den Decks. Portalblenden sind ein Darstellungstrick, keine Navigation oder Kollisionsvermeidung für spielbare Flugzeuge.
- [ ] Nachtkontrast, Wolken, Werbemotive und regelmäßige Stadtsilhouetten auf Zielgeräten beurteilen. Die ursprüngliche Bildvorlage war Architektur-, nicht mehr Beleuchtungsziel; keine Behauptung einer exakten Übereinstimmung.
- [ ] Qualität, Bewegung und Eingabelatenz auf echter Hardware/Mobilgeräten messen. Historisch lag die Stadtgeometrie der Studie bei rund 635.000 Dreiecken und etwa 69 MiB Mesh-VBOs, ohne Renderziele/Texturen. Diese Größenordnung ist ein Kostenhinweis, keine aktuelle Geräte- oder FPS-Messung.
- [ ] Schwarze Rechteckfläche links oben unter der HUD-Leiste eingrenzen: in pausierten Chromium-Spielchecks bei 1280 × 900 etwa 200 × 136 px, bereits vor dem Missions-HUD sichtbar. Ursache und Auftreten auf echten Geräten bleiben offen; erfolgreiche GL-Fehlerprüfungen belegen nicht die korrekte Darstellung.

Spielbare Flächen, Gegenverkehr, Ressourcen, Missionsbalance und Modellabnahme des Reaktors bleiben im [Bergungs-Issue](aurelion-echo-bergung.md). Keine stillschweigenden Geometrie-, Licht- oder Performanceänderungen aus dieser Prüfliste ableiten.

## Aussagegrenzen der bisherigen Prüfungen

CPU-Prüfungen lesen echte Stadt-Dreiecke für freie Starts, Rampen, Bodenflächen und abgetastete Zivilflugzeughüllen. Sie sind kein kontinuierlicher Kollisionsnachweis. Rendererprüfungen erfassen Tiefenziel-Wiederverwendung, Resize, Allokations-/Resolvefehler, Programmwechsel und nicht blockierende Fence-Abfragen.

Frühere pausierte Chromium-Checks über `file://` blieben ohne JS-/GL-Fehler oder externe Abrufe. Unter Software-WebGL hatte die alte Studie trotzdem erhebliche Eingabelatenz; die Einzel-Frame-Begrenzung ist keine Performancegarantie. Die temporären Vergleichsbilder/Profile wurden bei der Repo-Bereinigung gelöscht. Die oben festgehaltenen offenen Befunde bleiben bestehen; technische Prüfungen ersetzen keine menschliche oder Echtgeräteabnahme.
