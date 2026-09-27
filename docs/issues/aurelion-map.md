# Aurelion: Geometrie nach Bildreferenz, mit menschlichen Haltepunkten

## Auftrag und Abnahmegrenze

Die gelieferte Vorlage zeigt „Aurelion · The Crown District – Sector 07“: vier Eckplattformen, Ringzentrum mit blauem Globus, Brücken über tiefen Stadtschluchten, gestaffelte Hochhäuser, große Fassaden-Reklamen und eine kühle, dunstige Stadt mit warmen Fensterlichtern. Gewünscht ist außerdem fliegender Fahrzeugverkehr im Stil einer vertikalen Science-Fiction-Metropole.

**Aktuelle Freigabe: zuerst nur Geometrie.** Spielimplementierung erst, wenn der Nutzer mit der Gestaltung zufrieden ist. Nach jedem abgegrenzten Gestaltungsstand einen echten Renderer-Screenshot mit der Vorlage vergleichen und auf menschliches Feedback warten, nicht selbstständig alle Phasen durcharbeiten.

**Nutzerkorrektur zum ersten Entwurf:** Die gesamten vier relativ separaten Ecksektoren sollen größere, erhabene Flächen sein, nicht nur ein kleiner Teil in ihrer Mitte. Der folgende Geometriepass ist freigegeben; daraus folgt noch keine Abnahme des Gesamtlooks.

Lokale Originalvorlage: `.tmp/aurelion.png`, SHA-256 `5b4affbf4e80c73f58dc84f4eb6bcffdaba27f69612ddf42379e42c2bc9dfe0b`. Sie ist kein Laufzeitasset und wird nicht mit ausgeliefert. Die Beschriftungen und aus dem Bild erschlossenen Wege sind noch kein beschlossener Spielregelvertrag.

## Aufruf und Isolation

Nach dem Build `index.html?experiment=aurelion` direkt über `file://` öffnen. Ziehen verschiebt, Rechtsziehen dreht, das Mausrad zoomt; die Vorschau bietet Referenzblick, Draufsicht, Zentrum und eine Nahansicht „Hochplateau“. Rückkehr ins Spiel lädt den normalen Einstieg neu.

Die Studie verwendet den vorhandenen WebGL-Renderer, aber erzeugt weder `MeridianGame` noch `Battlefield`, liest/schreibt keine Profile und ist nicht im Kartenkatalog registriert. Geometrie entsteht einmalig aus einem eigenen festen kosmetischen Seed; es gibt keine Simulations-RNG-Aufrufe. Die Szene wird nur bei Ansichtänderung neu gezeichnet. Balanced ist für diese Beurteilung fest eingestellt; die normalen Qualitätsstufen und Shader bleiben unverändert.

## Aktueller Haltepunkt: vier große Hochplateaus

Die Ecksektoren bilden jetzt jeweils ein zusammenhängendes, abgeschrägtes Hochplateau mit ungefähr doppelter Fläche gegenüber dem ersten Entwurf. Auch die zuvor nur von schmalen Stegen eingefassten Zwischenbereiche gehören zur oberen Ebene. Das Ringzentrum bleibt tiefer; breite diagonale Rampen führen dorthin, seitliche Rampen zu den tieferen Verbindungen zwischen Nachbarsektoren. Schmale Treppen flankieren die durchgehenden Rampenflächen. Das ist weiterhin nur Geometrie, kein geprüfter Fahrwegvertrag.

Breitere Gebäudeschäfte, ein zusammenhängender Fassadenunterbau mit Gesimsen/Fensterreihen, niedrigere Nebenterrassen und Service-/Turmaufbauten geben den Plattformen mehr Masse. Verdeckte Dächer/Fenster innerhalb des Unterbaus werden nicht mitgebacken. Rampenmündungen bleiben frei von Geländern und vorspringenden Fassadenblöcken. Pavillons, Leuchtmarken und Bildschirmmotive bleiben neutrale Platzhalter, keine HQs, Ressourcen oder fertigen Werbeassets.

Vergleich mit der Vorlage:

- Die vier erhabenen Stadtsektoren und ihre Übergänge zum tieferen Zentrum sind jetzt deutlich lesbarer. Der Referenzblick behält für den Vorher-/Nachher-Vergleich Kamera und Licht des ersten Entwurfs.
- Die großen Flächen sind noch regelmäßiger und leerer als die komplex verzahnten Dachlandschaften der Vorlage. Flächengröße und Höhenwirkung müssen vor weiterer Ausgestaltung menschlich bestätigt werden.
- Skyline-Türme besitzen weiterhin zu ähnliche Schäfte/Kronen. Weitere gestaffelte Zwischenbauten, Fassaden- und Dachdetails bleiben offen.
- Ansicht ist orthografisch; die perspektivische Tiefenwirkung der Vorlage ist nicht exakt getroffen. Der sichtbare untere Stadtdatum-Boden ist nur ein geometrischer Abschluss, keine Wolkendecke.
- Fassadenmaterialien, kräftige Reklamebilder, atmosphärische Lichtstaffelung und Flugverkehr fehlen bewusst. Der dünne Globus ist nur eine geometrische Stellvertretung des Hologramms.

Lokale Vergleichsaufnahmen liegen unter `.tmp/aurelion-geometry-02/` (Übersicht, Draufsicht, Hochplateau, Zentrum, Schrägblick sowie Referenz- und Vorher-/Nachher-Vergleich). Sie sind temporäre Abnahmehilfen; dauerhafte Entscheidungen gehören hierher. Noch keine menschliche Abnahme dieses Stands.

## Nächste Entscheidungen

- [ ] Nutzerfeedback zu den vergrößerten, vollständig erhöhten Ecksektoren und Rampen abwarten: trifft das die gemeinte Plateauaufteilung?
- [ ] Danach den nächsten Geometriepass abgrenzen, insbesondere Dachlandschaften, Zwischenbauten und variablere Turmkronen; erneut Screenshotvergleich und Halt.
- [ ] Materialien/Atmosphäre und fertige Werbemotive separat abstimmen; keine gemeinsam verwendeten Texturen austauschen. Reklamen und spätere Flugfahrzeuge müssen aus verschiedenen Kamerawinkeln überzeugen.
- [ ] Erst nach Zufriedenheit mit der Gestaltung spielbare Flächen, Höhen, Baureserven, Navigation, Ressourcen und Katalogintegration festlegen. Die Studie ist dafür keine gültige CPU-Oberfläche oder Kollisionsmaske.
- [ ] Später Darstellungsbudget und mobile Kosten untersuchen. Die Studie backt viele Fenster/Rippen und verwendet bestehendes räumliches Mesh-Chunking; Instanzierung allein ist kein Performancenachweis.

Gezielte Geometrieprüfung: endliche, nicht degenerierte Dreiecke im bestehenden Studienbudget; große obere Sektorflächen und kontinuierliche Rampenmitten samt seitlichem Freiraum anhand der tatsächlich erzeugten Mesh-Dreiecke. Das ist keine CPU-Navigation oder Spielabnahme.

Technischer `file://`-Browsercheck: Übersicht/Ansichtwechsel einschließlich Hochplateau/Rotation/Zoom und Rückkehr zum normalen Menü ohne JavaScript- oder WebGL-Fehler. Keine HTTP(S)-Requests und kein Storagezugriff im Experiment. Das ersetzt weder visuelle Freigabe noch Echtgeräteprüfung. KI-/Simulations-Langläufe sind nicht beauftragt und nicht ausgeführt.
