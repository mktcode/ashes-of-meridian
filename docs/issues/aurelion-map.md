# Aurelion: Geometrie nach Bildreferenz, mit menschlichen Haltepunkten

## Auftrag und Abnahmegrenze

Die gelieferte Vorlage zeigt „Aurelion · The Crown District – Sector 07“: vier Eckplattformen, Ringzentrum mit blauem Globus, Brücken über tiefen Stadtschluchten, gestaffelte Hochhäuser, große Fassaden-Reklamen und eine kühle, dunstige Stadt mit warmen Fensterlichtern. Gewünscht ist außerdem fliegender Fahrzeugverkehr im Stil einer vertikalen Science-Fiction-Metropole.

**Aktuelle Freigabe: zuerst nur Geometrie.** Spielimplementierung erst, wenn der Nutzer mit der Gestaltung zufrieden ist. Nach jedem abgegrenzten Gestaltungsstand einen echten Renderer-Screenshot mit der Vorlage vergleichen und auf menschliches Feedback warten, nicht selbstständig alle Phasen durcharbeiten.

Lokale Originalvorlage: `.tmp/aurelion.png`, SHA-256 `5b4affbf4e80c73f58dc84f4eb6bcffdaba27f69612ddf42379e42c2bc9dfe0b`. Sie ist kein Laufzeitasset und wird nicht mit ausgeliefert. Die Beschriftungen und aus dem Bild erschlossenen Wege sind noch kein beschlossener Spielregelvertrag.

## Aufruf und Isolation

Nach dem Build `index.html?experiment=aurelion` direkt über `file://` öffnen. Ziehen verschiebt, Rechtsziehen dreht, das Mausrad zoomt; die Vorschau bietet Referenzblick, Draufsicht und Zentrum. Rückkehr ins Spiel lädt den normalen Einstieg neu.

Die Studie verwendet den vorhandenen WebGL-Renderer, aber erzeugt weder `MeridianGame` noch `Battlefield`, liest/schreibt keine Profile und ist nicht im Kartenkatalog registriert. Geometrie entsteht einmalig aus einem eigenen festen kosmetischen Seed; es gibt keine Simulations-RNG-Aufrufe. Die Szene wird nur bei Ansichtänderung neu gezeichnet. Balanced ist für diese Beurteilung fest eingestellt; die normalen Qualitätsstufen und Shader bleiben unverändert.

## Erster Haltepunkt: Proportionen und Grundaufbau

Vier abgeschrägte Decks, ein zentraler Ring mit getrenntem Innenpodest, Verbindungsstege, tiefe Gebäudeschäfte und gerahmte Reklameträger sind modelliert. Pavillons, Leuchtmarken und die abstrakten Bildschirmmotive sind neutrale Platzhalter, keine HQs, Ressourcen oder fertigen Werbeassets.

Vergleich mit der Vorlage:

- Grundkomposition vorhanden, aber die Plattformverbindungen sind deutlich rechtwinkliger und regelmäßiger; die Vorlage hat mehr diagonale, aufgefächerte Zwischenflächen.
- Türme besitzen noch zu ähnliche Schäfte/Kronen. Es fehlen die reich gegliederten Dachlandschaften, Terrassen, Stützkonstruktionen und abgestuften Stadtblöcke.
- Decks liegen bisher auf einem gemeinsamen Niveau. Die in der Vorlage sichtbaren Treppen/Rampen und Höhenstaffelung sind noch nicht umgesetzt.
- Ansicht ist orthografisch; die perspektivische Tiefenwirkung der Vorlage ist nicht exakt getroffen. Der sichtbare untere Stadtdatum-Boden ist nur ein geometrischer Abschluss, keine Wolkendecke.
- Fassadenmaterialien, kräftige Reklamebilder, atmosphärische Lichtstaffelung und Flugverkehr fehlen bewusst. Der dünne Globus ist nur eine geometrische Stellvertretung des Hologramms.

Lokale Vergleichsaufnahmen liegen unter `.tmp/aurelion-geometry-01/` (Übersicht, Draufsicht, Zentrum, Gegenüberstellung). Sie sind temporäre Abnahmehilfen; dauerhafte Entscheidungen gehören hierher. Noch keine menschliche Abnahme.

## Nächste Entscheidungen

- [ ] Nutzerfeedback zu Plattformgrößen, Brückenführung, Schluchtenbreite, Skyline und Reklamegrößen abwarten.
- [ ] Danach den freigegebenen Geometriepass ausarbeiten, erneut Screenshotvergleich und Halt.
- [ ] Materialien/Atmosphäre und fertige Werbemotive separat abstimmen; keine gemeinsam verwendeten Texturen austauschen. Reklamen und spätere Flugfahrzeuge müssen aus verschiedenen Kamerawinkeln überzeugen.
- [ ] Erst nach Zufriedenheit mit der Gestaltung spielbare Flächen, Höhen, Baureserven, Navigation, Ressourcen und Katalogintegration festlegen. Die Studie ist dafür keine gültige CPU-Oberfläche oder Kollisionsmaske.
- [ ] Später Darstellungsbudget und mobile Kosten untersuchen. Die Studie backt viele Fenster/Rippen und verwendet bestehendes räumliches Mesh-Chunking; Instanzierung allein ist kein Performancenachweis.

Technischer `file://`-Browsercheck: Übersicht/Ansichtwechsel/Rotation/Zoom und Rückkehr zum normalen Menü ohne JavaScript- oder WebGL-Fehler. Keine HTTP(S)-Requests und kein Storagezugriff im Experiment. Das ersetzt weder visuelle Freigabe noch Echtgeräteprüfung. KI-/Simulations-Langläufe sind nicht beauftragt und nicht ausgeführt.
