# Aurelion: Visualstudie nach Bildreferenz, mit menschlichen Haltepunkten

## Auftrag und Abnahmegrenze

Die gelieferte Vorlage zeigt „Aurelion · The Crown District – Sector 07“: vier Eckplattformen, Ringzentrum mit blauem Globus, Brücken über tiefen Stadtschluchten, gestaffelte Hochhäuser, große Fassaden-Reklamen und eine kühle, dunstige Stadt mit warmen Fensterlichtern. Zusätzlich gewünscht ist fliegender Fahrzeugverkehr im Stil einer vertikalen Science-Fiction-Metropole.

**Aktuelle Freigabe: den Hologlobus in der Mitte langsam drehen und die kreisförmig wirkenden Flugbahnen durch zwei mehrspurige Hauptbahnen mit Nebenstraßen ersetzen.** Die hell lesbaren Decks, dunklen Nebelschluchten, ausschließlich unter den Decks verlaufender Zivilverkehr und bereinigte Startplattformen bleiben erhalten. Die Nachtgestaltung ersetzt bewusst die Tagesbeleuchtung der ursprünglichen Referenz. Das ist keine allgemeine Geometrieabnahme und **keine Freigabe zur Spielintegration**. Nach jedem abgegrenzten Gestaltungsstand echte Renderer-Screenshots mit der Vorlage vergleichen und auf menschliches Feedback warten.

Die vier Ecksektoren bleiben breitflächig erhaben; der verringerte Höhenversatz und der geschlossene Mittelkreis mit Hologramm bleiben erhalten. Die markierte Azur-Plattform dient als Muster für die gezielte Bereinigung aller vier Startflächen, nicht für den Abbau der übrigen Stadt. Beschriftungen, Startmarken und dargestellte Wege sind weiterhin kein beschlossener Spielregelvertrag.

Lokale Originalvorlage: `.tmp/aurelion.png`, SHA-256 `5b4affbf4e80c73f58dc84f4eb6bcffdaba27f69612ddf42379e42c2bc9dfe0b`. Sie ist kein Laufzeitasset und wird nicht mit ausgeliefert.

## Aufruf und Bedienung

Nach dem Build `index.html?experiment=aurelion` direkt über `file://` öffnen. Ziehen verschiebt, Rechtsziehen dreht, das Mausrad zoomt. Referenzblick verwendet eine schwache Langbrennweiten-Perspektive; „Alte Kamera“ behält die orthografische Kamera des vorigen Geometriestands, nicht dessen Beleuchtung. Hinzu kommen Draufsicht, Zentrum, Hochplateau und Skyline.

- Mit Bewegungsknopf bzw. Leertaste lässt sich die gesamte visuelle Uhr pausieren/fortsetzen: Verkehr, Wolken, Hologramm und Reklameeffekte.
- `&still=1` startet reproduzierbar eingefroren. `prefers-reduced-motion: reduce` startet ebenfalls pausiert; Bewegung kann bewusst eingeschaltet werden.
- „Atmosphäre“ schaltet Tiefenwolken, SSAO und Bloom zur technischen Gegenüberstellung aus/ein; neue Materialien, Werbemotive und Geometrie bleiben bestehen.
- `H` blendet die Bedienleiste für Bildvergleiche aus/ein. Rückkehr ins Spiel lädt den normalen Einstieg neu.

## Isolation und Pflege

Die Vorschau erzeugt weder `MeridianGame` noch `Battlefield`, greift nicht auf Profile zu und ist nicht im Kartenkatalog registriert. Architektur, Fernstadt, Reklamemotive, Noise und Verkehr haben eigene feste kosmetische Seeds. Kein gemeinsamer Simulations-RNG, keine Spielentitäten, Ressourcen oder Navigation. Flugbahnen sind analytische Dekorrouten, keine KI oder Kollisionsvermeidung im Spiel.

Die Vorschau verwendet eine lokale Renderer-Unterklasse mit eigenen Oberflächen-, Himmel- und Postprogrammen. Die normalen Shader, Qualitätsstufen und gemeinsam verwendeten Texturbilder bleiben unverändert. Unbenutzte, vom Basiskonstruktor angelegte Modellmeshes werden nur in dieser Rendererinstanz freigegeben; das gemeinsame Strahlprimitiv bleibt für Triebwerksspuren erhalten.

- Physische Reklamerechtecke und Atlasprojektion lesen dieselben Deskriptoren. Vier originale, prozedurale Canvas-Motive werden einmalig lokal hochgeladen, ohne Bildabrufe oder zweckentfremdete Portraits. Künftige gepflegte Rastermotive müssen dem [Assetverfahren](../rendering.md#texturen-und-portraits) folgen.
- Die lokale Deckbeleuchtung liest Plattformumrisse, Rampenverläufe/-höhen und Kreisfläche aus denselben Deskriptoren wie der Geometriebau. Nur nach oben gerichtete Flächen nahe der jeweiligen Bodenhöhe erhalten Flächenlicht und eingelassene Lichtstreifen; keine globale Belichtungsanhebung oder zusätzlichen Schattenpässe. Diese Lichtmasken sind keine CPU-Spieloberfläche.
- Die deckende Szenentiefe wird nach dem Szenenpass aus dem normalen bzw. multisamplefähigen Tiefenpuffer in eine eigene Textur aufgelöst. Größe und Tiefenformat müssen übereinstimmen. Der Postpass rekonstruiert daraus Weltpositionen für Kontaktabdunklung, Dunst und einen höhenbegrenzten Wolken-Raymarch mit lokalem 3D-Noise und Lichtabschattung.
- Tiefenziele werden bei Resize ersetzt, nicht im Animationsframe neu angelegt. Bei fehlgeschlagener Allokation/Auflösung entfallen Tiefeneffekte mit sichtbarem Hinweis; Licht und Bloom bleiben verfügbar. Eigene Texturen, Tiefenziele und GPU-Fences werden beim endgültigen Verlassen freigegeben.
- Die Animation zeichnet höchstens 60-mal pro Sekunde und hält höchstens einen GPU-Frame in Arbeit. Ein Fence wird ohne Wartezeit abgefragt; kein `gl.finish()` und kein blockierendes GPU-Warten. Hintergrundtabs setzen die visuelle Uhr aus. Pausiert wird nur bei Änderungen neu gezeichnet. Stadtgeometrie und Reklame-/Noise-Texturen bleiben während der Animation unverändert.

Das ist eine gezielt inszenierte WebGL-Studie, kein physikalisch vollständiger Renderer: RGBA8-Szenenziel statt HDR, angenäherte Reflexionen/Leuchtflächen-Abstrahlung statt zusätzlicher Echtzeitlichter. SSAO und Wolkenkomposition verwenden die deckende Tiefe; transparente Effekte erhalten keine separate Tiefenschicht. Diese Grenzen insbesondere bei extremen Kamerawinkeln mitbeurteilen.

## Aktueller Haltepunkt: Hologlobus und Verkehrsnetz 08

Der Hologlobus besitzt eine leichte Achsneigung und dreht sein Gitternetz, asymmetrische Kontinentalfelder sowie einen hervorgehobenen Meridian gemeinsam und langsam um diese Achse. Die Bewegung folgt weiter ausschließlich der pausierbaren visuellen Uhr; es gibt keinen zweiten Zeitgeber.

Der Unterdeckverkehr ist jetzt als Ost/West- und Nord/Süd-Hauptbahn gegliedert. Je zwei übereinanderliegende Richtungsfahrspuren führen durch die vier geprüften Schluchten. Langsamere Nebenstraßen verwenden die gegenüberliegenden Canyonbögen. Fahrzeuge blenden an verdeckten Turmportalen aus und erst hinter dem anderen Ende wieder ein; dadurch wird die analytische Wiederholung nicht mehr als vollständig sichtbarer kleiner Rundkurs gefahren. Die Portale sind ein Darstellungstrick, keine neue Geometrie. Alle 48 Fahrzeuge und ihre Spuren bleiben unter den Decks.

Die vier Startplattformen und ihre Brücken behalten das kühle, weiche Flächenlicht, warme Lichtinseln und Randakzente aus Stand 07; der Mittelkreis bleibt zurückhaltender ergänzt. Feine eingelassene Streifen betonen die Wege, ohne neue Aufbauten oder Hindernisse. Pflaster, Materialfarben und bestehende Schatten bleiben sichtbar. Stadtgeometrie und sämtliche Kamera-Presets sind unverändert.

Schwaches Richtungslicht, dunkle Himmelsreflexionen und blau-schwarze Tiefenwolken erhalten die Nachtwirkung. Himmel, Dunst, Wolkenparameter und globale Lichtstärken wurden nicht aufgehellt. Reklamen, Fenster und Hologramm bleiben die starken Stadtakzente. Diese Gestaltung gilt nur für die Studie, nicht für normale Karten.

Auf allen vier Startplattformen sind zentrale Podeste samt angedeuteten Ressourcenringen, der Empfangsbau mit Antenne am Querbrückenzugang, die beiden kleinen Häuser neben der diagonalen Zufahrt und der markierte Lüfterbau entfernt. Auch die künstliche Ressourcenring-Aufhellung auf dem Boden entfällt. Nicht markierte Randbebauung, Brücken, Plattformränder und der geschlossene Hologrammkreis bleiben bestehen.

Lokale Abnahmebilder: `.tmp/aurelion-traffic-08/` mit Übersicht, Zentrum, Hologlobus zu zwei visuellen Zeiten, Unterdeck-Diagnose und Vergleichen zu Stand 07. Zentrum und Unterdeck verwenden zusätzliche Renderer-Diagnoseblicke, keine neuen Kamera-Presets. Die Bilder sind keine freigegebenen Laufzeitassets.

**Vergleichsgrenzen:** Die ursprüngliche Vorlage bleibt Architektur-/Stadtreferenz, nicht mehr das Beleuchtungsziel. Sie besitzt stärker verzahnte Zwischenräume, unregelmäßigere Silhouetten/Fassaden und feinere Materialdetails. Große Plätze, Brückenführung und Baukörper bleiben sichtbar regelmäßiger. Nachtkontrast, Lesbarkeit der freien Decks, dunkler Wolkenlook und Werbemotive benötigen menschliche Beurteilung. Keine Behauptung einer exakten Übereinstimmung oder visuellen Abnahme.

## Technischer Prüfkontext und offene Kosten

Die CPU-Prüfung erhält die abgesenkten, breiten Sektorflächen und freien Rampenübergänge anhand echter Dreiecke; Fläche und Abtastpunkte prüfen den geschlossenen Kreisboden sowie die freien Start- und Brückenbereiche. Sie prüft außerdem deterministische Fernstadt/Flugmodelle, nicht degenerierte Fluggeometrie und stetige Routen. Ein konservatives dreidimensionales Raster der tatsächlich erzeugten Stadt prüft die abgetasteten Flugzeughüllen einschließlich Neigung und Sicherheitsabstand gegen Fassaden und Brückenunterseiten. Die Unterdeck-Höhengrenze gilt jetzt ausnahmslos für alle Fahrzeugtypen; auch Triebwerksspuren bleiben unten. Ein reines Dachhöhenraster wäre für diese Unterflüge ungeeignet. GPU-Orchestrierungsprüfungen decken Tiefenziel-Wiederverwendung, Resize, Allokations-/Resolvefehler und nicht blockierende Fence-Abfragen ab. Das ist kein Navigations- oder kontinuierlicher Kollisionsnachweis.

Build und gezielte Aurelion-/Renderertests prüfen weiterhin Geometrie, Rendererressourcen und Flugmodelle. Für das neue Netz kontrollieren sie außerdem die zwei Hauptbahnfamilien, Nebenstraßen, deterministische Portalblenden, stetige sichtbare Bewegung und die vollständigen Fahrzeughüllen gegen echte Stadtgeometrie. Unsichtbare Routenübergänge erzeugen keine quer durch die Stadt gezogenen Triebwerksspuren. Die Standardtestsuite wurde für diesen lokalen Darstellungs-/Verkehrspass nicht erneut ausgeführt.

Technischer Chromium-Check bei 1672 × 941 über `file://`: rotierender Hologlobus und neues Unterdecknetz mit MSAA/Tiefeneffekten, Ansichtwechsel, Effektumschaltung und Bewegung/Pause ohne JavaScript-/WebGL-Fehler. Keine HTTP(S)-Anfragen, Profilzugriffe oder gestartete Simulation im Experiment. Single-Sample, Resize, Reduced Motion und Rückkehr zum normalen Menü wurden beim ursprünglichen Atmosphärenpass geprüft; diese Verträge wurden nicht verändert. Der Browser verwendete SwiftShader ohne zusätzlich freigeschaltete unsichere Browserflags; dessen Software-Warnung und screenshotbedingte Readback-Warnungen sind keine Hardwareabnahme.

Die bereinigte Geometrie liegt bei rund 635.000 statischen Stadtdreiecken plus instanzierter Flug-/Effektgeometrie. Das bisherige Kostenprofil des Atmosphärenpasses ergab bis zu rund 1,37 Mio. eingereichte Dreiecke und 1.356 GL-Zeichenaufrufe einschließlich Schatten/Vollbildpässen. Mesh-VBOs belegten rechnerisch rund 69 MiB, Renderziele/Texturen kommen hinzu. Im kurzen Bewegungsausschnitt keine Textur-/Renderziel-Neuallokationen und höchstens rund 40 KiB Instanzupload je Frame. Gemessene CPU-Einreichzeiten sind ausdrücklich **keine GPU-Zeiten oder Geräte-FPS**; GPU-Timer waren im Softwarekontext nicht verfügbar. Der automatisierte Pausenklick braucht in den aktuellen SwiftShader-Läufen rund 31 bis 36 Sekunden: Die 30-Sekunden-Prüffrist wird überschritten, mit 90-Sekunden-Frist funktioniert der Übergang und die visuelle Uhr bleibt danach stehen. Die Einzel-Frame-Begrenzung garantiert keine geringe Eingabelatenz. Keine Bedienbarkeitsabnahme; Hardware- und Mobilkosten bleiben offen. Die zusätzliche Deckbeleuchtung benötigt keine neuen Meshes oder Renderpässe, erhöht aber die Shaderarbeit.

## Nächste Entscheidungen

- [ ] Menschliches Feedback zur Lesbarkeit der langsamen Hologlobusrotation und zum Eindruck von Hauptbahnen/Nebenstraßen statt kleiner Rundkurse abwarten. Danach erst den nächsten Gestaltungsumfang festlegen.
- [ ] Auf dem Zielgerät Bewegung/Bedienbarkeit und Qualität bewerten. Das hohe Studienbudget ist kein Freibrief für eine spätere Echtzeitkarte.
- [ ] Falls weitere Annäherung gewünscht ist: zuerst klären, ob die regelmäßige Geometrie, Wolken/Licht oder Werbemotive nachgearbeitet werden sollen; erneut Screenshotvergleich und Halt.
- [ ] Erst nach Zufriedenheit mit der Gestaltung spielbare Flächen, Höhen, Baureserven, Navigation, Ressourcen und Katalogintegration festlegen. Die Studie liefert dafür keine gültige CPU-Oberfläche oder Kollisionsmaske.

KI-/Simulations-Langläufe sind nicht beauftragt. Technische Prüfungen ersetzen weder menschliche Darstellungsabnahme noch Echtgeräteprüfung.
