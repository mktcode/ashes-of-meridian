# Aurelion: Geometrie nach Bildreferenz, mit menschlichen Haltepunkten

## Auftrag und Abnahmegrenze

Die gelieferte Vorlage zeigt „Aurelion · The Crown District – Sector 07“: vier Eckplattformen, Ringzentrum mit blauem Globus, Brücken über tiefen Stadtschluchten, gestaffelte Hochhäuser, große Fassaden-Reklamen und eine kühle, dunstige Stadt mit warmen Fensterlichtern. Gewünscht ist außerdem fliegender Fahrzeugverkehr im Stil einer vertikalen Science-Fiction-Metropole.

**Aktuelle Freigabe: zuerst nur Geometrie.** Spielimplementierung erst, wenn der Nutzer mit der Gestaltung zufrieden ist. Nach jedem abgegrenzten Gestaltungsstand einen echten Renderer-Screenshot mit der Vorlage vergleichen und auf menschliches Feedback warten, nicht selbstständig alle Phasen durcharbeiten.

**Gestaltungsvorgaben:** Die gesamten vier relativ separaten Ecksektoren sollen erhaben sein, nicht nur kleine Mittelstücke. Nach dem zweiten Entwurf wünscht der Nutzer einen geringeren Höhenunterschied zum Zentrum und ausdrücklich eine sehr starke Detaillierung der gesamten Geometrie. Diese Detailrunde ist freigegeben, nicht die Spielintegration oder der Gesamtlook.

Lokale Originalvorlage: `.tmp/aurelion.png`, SHA-256 `5b4affbf4e80c73f58dc84f4eb6bcffdaba27f69612ddf42379e42c2bc9dfe0b`. Sie ist kein Laufzeitasset und wird nicht mit ausgeliefert. Die Beschriftungen und aus dem Bild erschlossenen Wege sind noch kein beschlossener Spielregelvertrag.

## Aufruf und Isolation

Nach dem Build `index.html?experiment=aurelion` direkt über `file://` öffnen. Ziehen verschiebt, Rechtsziehen dreht, das Mausrad zoomt; die Vorschau bietet Referenzblick, Draufsicht, Zentrum sowie Nahansichten „Hochplateau“ und „Skyline“. Rückkehr ins Spiel lädt den normalen Einstieg neu.

Die Studie verwendet den vorhandenen WebGL-Renderer, aber erzeugt weder `MeridianGame` noch `Battlefield`, liest/schreibt keine Profile und ist nicht im Kartenkatalog registriert. Geometrie entsteht einmalig aus eigenen festen kosmetischen Seeds; Layout und Fassadendetails haben getrennte lokale Ströme, damit Fensteränderungen nicht mehr die Hintergrundbauten verschieben. Es gibt keine Simulations-RNG-Aufrufe. Die Szene wird nur bei Ansichtänderung neu gezeichnet. Balanced ist für diese Beurteilung fest eingestellt; die normalen Qualitätsstufen und Shader bleiben unverändert.

## Aktueller Haltepunkt: niedrigere Plateaus und detaillierte Architektur

Die großen, zusammenhängenden Eckplateaus behalten ihre Grundfläche. Ihr Versatz zum Zentrum wurde deutlich reduziert; die Rampen sind entsprechend flacher. Seitliche Verbindungen bleiben unterhalb der Startbereiche. Schmale Treppen flankieren weiterhin die durchgehenden Rampenflächen. Das ist nur Geometrie, kein geprüfter Fahrwegvertrag.

Die Detailrunde erfasst Skyline, Sektoren, Verbindungen und Zentrum: gestaffelte, geteilte und runde Turmkronen, gegliederte Glas-/Fensterfelder mit vorspringenden Rippen, zusätzliche Dach- und Anbauten, Empfangsschüsseln, Lüfter, Antennen, Vordächer und Wartungsbalkone. Unter den Brücken liegen sichtbare Fachwerkträger und Querstreben; Reklameträger besitzen Gehäuse, Halterungen und Wartungsstege. Ringzentrum und Projektorsockel sind stärker gegliedert, der Globus verwendet geschlossene Röhren statt einseitiger Bänder. Bodenfugen, Einlagen und Inspektionsluken bleiben flach; Rampenmitten bleiben frei. Pavillons, Leuchtmarken und Bildschirmmotive sind weiterhin neutrale Platzhalter, keine HQs, Ressourcen oder fertigen Werbeassets.

Die ausdrücklich gewünschte Detailrunde ersetzt das Budget der Grobstudie durch ein größeres, weiterhin getestetes Studienbudget. Kleine Rundteile und tiefe Nebendetails sind sparsamer als die großen sichtbaren Bauformen. Begrenzte Arbeitsarrays werden abschnittsweise in typisierte Puffer gepackt; das vermeidet einen einzigen riesigen Zahlenarray, ist aber kein Mobil- oder Echtzeitnachweis.

Vergleich mit der Vorlage:

- Referenzblick und Plateau-Nahansicht behalten Kamera und Licht des vorherigen Entwurfs. Der Vergleich zeigt zusätzliche Architektur statt einer durch andere Beleuchtung vorgetäuschten Detaillierung.
- Trotz deutlich reicherer Dächer und Silhouetten sind Flächen, Brückenführung und Fassadenraster weiterhin regelmäßiger als die komplex verzahnte Vorlage. Die vier großen Plätze wirken noch großzügig und geordnet, nicht wie ein eng gewachsenes Stadtnetz.
- Höhenwirkung, Detaildichte und die noch sichtbare Wiederholung der Baufamilien benötigen menschliches Feedback. Eine Übereinstimmung mit dem Referenzlook ist noch nicht erreicht.
- Ansicht ist orthografisch; die perspektivische Tiefenwirkung der Vorlage ist nicht exakt getroffen. Der sichtbare untere Stadtdatum-Boden ist nur ein geometrischer Abschluss, keine Wolkendecke.
- Fassadenmaterialien, kräftige Reklamebilder, atmosphärische Lichtstaffelung und Flugverkehr fehlen bewusst. Der dünne Globus ist nur eine geometrische Stellvertretung des Hologramms.

Lokale Vergleichsaufnahmen liegen unter `.tmp/aurelion-geometry-03/` (Übersicht, Draufsicht, Hochplateau, Zentrum, Skyline, Schrägblick sowie Referenz- und Vorher-/Nachher-Vergleiche einschließlich gleicher Plateau-Nahansicht). Sie sind temporäre Abnahmehilfen; dauerhafte Entscheidungen gehören hierher. Noch keine menschliche Abnahme dieses Stands.

## Nächste Entscheidungen

- [ ] Nutzerfeedback zum reduzierten Höhenversatz und zur umfassenden Detailrunde abwarten.
- [ ] Erst danach nächsten Gestaltungsumfang festlegen: bei weiterem Geometriebedarf insbesondere stärker verzahnte Zwischenflächen, vielfältigere Verbindungssilhouetten und weniger regelmäßige Baureihen; erneut Screenshotvergleich und Halt.
- [ ] Materialien/Atmosphäre und fertige Werbemotive separat abstimmen; keine gemeinsam verwendeten Texturen austauschen. Reklamen und spätere Flugfahrzeuge müssen aus verschiedenen Kamerawinkeln überzeugen.
- [ ] Erst nach Zufriedenheit mit der Gestaltung spielbare Flächen, Höhen, Baureserven, Navigation, Ressourcen und Katalogintegration festlegen. Die Studie ist dafür keine gültige CPU-Oberfläche oder Kollisionsmaske.
- [ ] Später Darstellungsbudget und mobile Kosten untersuchen. Die Studie backt viele Fenster/Rippen und verwendet bestehendes räumliches Mesh-Chunking; Instanzierung allein ist kein Performancenachweis.

Gezielte Geometrieprüfung: endliche, nicht degenerierte Dreiecke im Detailbudget, typisierte Ausgabe und identische Wiederholung ohne Ambient-RNG; große obere Sektorflächen auf dem abgesenkten Niveau und kontinuierliche Rampenmitten samt seitlichem Freiraum und unversperrte Übergänge zum Ring anhand der tatsächlich erzeugten Mesh-Dreiecke. Die Geländeröffnungen am Ring folgen den tatsächlichen schrägen Einmündungen, nicht einem gleichmäßigen Winkelraster. Das ist keine CPU-Navigation oder Spielabnahme.

Technischer `file://`-Browsercheck: Übersicht/Ansichtwechsel einschließlich Hochplateau/Skyline/Rotation/Zoom und Rückkehr zum normalen Menü ohne JavaScript- oder WebGL-Fehler. Keine HTTP(S)-Requests und kein Storagezugriff im Experiment. Das ersetzt weder visuelle Freigabe noch Echtgeräteprüfung. KI-/Simulations-Langläufe sind nicht beauftragt und nicht ausgeführt.
