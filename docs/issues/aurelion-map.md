# Aurelion: Visualstudie nach Bildreferenz, mit menschlichen Haltepunkten

## Auftrag und Abnahmegrenze

Die gelieferte Vorlage zeigt „Aurelion · The Crown District – Sector 07“: vier Eckplattformen, Ringzentrum mit blauem Globus, Brücken über tiefen Stadtschluchten, gestaffelte Hochhäuser, große Fassaden-Reklamen und eine kühle, dunstige Stadt mit warmen Fensterlichtern. Zusätzlich gewünscht ist fliegender Fahrzeugverkehr im Stil einer vertikalen Science-Fiction-Metropole.

**Die Spielintegration ist inzwischen separat beauftragt:** [Aurelion / King of the Hill mit zwei Zwischenabnahmen](aurelion-king-of-the-hill.md). Dieses Issue führt weiterhin die Visualstudie und ihre offene Darstellungsabnahme. Deren letzter Gestaltungsauftrag betraf den langsam drehenden Hologlobus und zwei mehrspurige Hauptbahnen mit Nebenstraßen. Die hell lesbaren Decks, dunklen Nebelschluchten, ausschließlich unter den Decks verlaufender Zivilverkehr und bereinigten Startplattformen bleiben erhalten. Die Nachtgestaltung ersetzt bewusst die Tagesbeleuchtung der ursprünglichen Referenz. Die neue Integrationsfreigabe ist keine allgemeine Geometrie- oder Darstellungsabnahme; nach abgegrenzten Gestaltungsänderungen weiterhin menschliches Feedback abwarten.

Die vier Ecksektoren bleiben breitflächig erhaben; der verringerte Höhenversatz und der geschlossene Mittelkreis mit Hologramm bleiben erhalten. Die markierte Azur-Plattform dient als Muster für die gezielte Bereinigung aller vier Startflächen, nicht für den Abbau der übrigen Stadt. Beschriftungen, Startmarken und dargestellte Wege sind weiterhin kein beschlossener Spielregelvertrag.

Lokale Originalvorlage: `.tmp/aurelion.png`, SHA-256 `5b4affbf4e80c73f58dc84f4eb6bcffdaba27f69612ddf42379e42c2bc9dfe0b`. Sie ist kein Laufzeitasset und wird nicht mit ausgeliefert.

## Aufruf und Bedienung

Nach dem Build `index.html?experiment=aurelion` direkt über `file://` öffnen. Ziehen verschiebt, Rechtsziehen dreht, das Mausrad zoomt. Referenzblick verwendet eine schwache Langbrennweiten-Perspektive; „Alte Kamera“ behält die orthografische Kamera des vorigen Geometriestands, nicht dessen Beleuchtung. Hinzu kommen Draufsicht, Zentrum, Hochplateau und Skyline.

- Mit Bewegungsknopf bzw. Leertaste lässt sich die gesamte visuelle Uhr pausieren/fortsetzen: Verkehr, Wolken, Hologramm und Reklameeffekte.
- `&still=1` startet reproduzierbar eingefroren. `prefers-reduced-motion: reduce` startet ebenfalls pausiert; Bewegung kann bewusst eingeschaltet werden. `&motion=1` ist der ausdrückliche Diagnose-Override und startet trotz dieser beiden Vorgaben animiert.
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

## Aktueller Haltepunkt: korrigierte Bewegungsdarstellung 09

Stand 08 bewegte sich bei starkem GPU-Rückstau unbeabsichtigt in extremer Zeitlupe: Die visuelle Uhr durfte je fertiggestelltem Bild höchstens 0,1 Sekunden aufholen. Das ließ den Hologlobus und die neuen Routen im belasteten Browser statisch erscheinen. Verdeckte Tabs setzen die Uhr weiterhin zurück, sichtbare langsame Frames übernehmen jetzt aber ihre tatsächliche verstrichene Zeit. Der Footer zeigt ausdrücklich „Bewegung läuft“ oder „Bewegung pausiert“; `motion=1` erzwingt für die Diagnose den laufenden Zustand.

Der Hologlobus besitzt eine leichte Achsneigung; seine asymmetrischen Kontinentalfelder bewegen sich mit der pausierbaren visuellen Uhr. Das dominante, teilweise diagonale Liniengerüst wirkt in der menschlichen Live-Abnahme jedoch weiterhin unbewegt. Technische Modell-/Shaderänderungen und unterschiedliche Einzelbilder belegen nicht die gewünschte sichtbare Rotation. Ursachenisolation und Abnahme sind deshalb im eigenen Issue [Hologlobus-Liniengerüst sichtbar drehen](aurelion-hologlobus-rotation.md) offen.

Der Unterdeckverkehr ist als Ost/West- und Nord/Süd-Hauptbahn gegliedert. Je zwei übereinanderliegende Richtungsfahrspuren führen durch die vier geprüften Schluchten. Langsamere Nebenstraßen belegen nur noch kürzere Abschnitte der gegenüberliegenden Canyonbögen und vervollständigen dadurch nicht länger die fehlenden Hälften der alten Rundkurse. Längere Triebwerksspuren verdeutlichen die Fahrtrichtung. Fahrzeuge blenden an verdeckten Turmportalen aus und erst hinter dem anderen Ende wieder ein. Die Portale sind ein Darstellungstrick, keine neue Geometrie. Alle 48 Fahrzeuge und ihre Spuren bleiben unter den Decks.

Die vier Startplattformen und ihre Brücken behalten das kühle, weiche Flächenlicht, warme Lichtinseln und Randakzente aus Stand 07; der Mittelkreis bleibt zurückhaltender ergänzt. Feine eingelassene Streifen betonen die Wege, ohne neue Aufbauten oder Hindernisse. Pflaster, Materialfarben und bestehende Schatten bleiben sichtbar. Stadtgeometrie und sämtliche Kamera-Presets sind unverändert.

Schwaches Richtungslicht, dunkle Himmelsreflexionen und blau-schwarze Tiefenwolken erhalten die Nachtwirkung. Himmel, Dunst, Wolkenparameter und globale Lichtstärken wurden nicht aufgehellt. Reklamen, Fenster und Hologramm bleiben die starken Stadtakzente. Diese Gestaltung gilt nur für die Studie, nicht für normale Karten.

Auf allen vier Startplattformen sind zentrale Podeste samt angedeuteten Ressourcenringen, der Empfangsbau mit Antenne am Querbrückenzugang, die beiden kleinen Häuser neben der diagonalen Zufahrt und der markierte Lüfterbau entfernt. Auch die künstliche Ressourcenring-Aufhellung auf dem Boden entfällt. Nicht markierte Randbebauung, Brücken, Plattformränder und der geschlossene Hologrammkreis bleiben bestehen.

Lokale Abnahmebilder: `.tmp/aurelion-motion-09/` mit Übersicht, Zentrum, Hologlobus zu zwei visuellen Zeiten und Unterdeckverkehr bei den visuellen Zeiten 12 und 18. Zentrum und Unterdeck verwenden zusätzliche Renderer-Diagnoseblicke, keine neuen Kamera-Presets. Die Bilder sind keine freigegebenen Laufzeitassets.

**Vergleichsgrenzen:** Die ursprüngliche Vorlage bleibt Architektur-/Stadtreferenz, nicht mehr das Beleuchtungsziel. Sie besitzt stärker verzahnte Zwischenräume, unregelmäßigere Silhouetten/Fassaden und feinere Materialdetails. Große Plätze, Brückenführung und Baukörper bleiben sichtbar regelmäßiger. Nachtkontrast, Lesbarkeit der freien Decks, dunkler Wolkenlook und Werbemotive benötigen menschliche Beurteilung. Keine Behauptung einer exakten Übereinstimmung oder visuellen Abnahme.

## Technischer Prüfkontext und offene Kosten

Die CPU-Prüfung erhält die abgesenkten, breiten Sektorflächen und freien Rampenübergänge anhand echter Dreiecke; Fläche und Abtastpunkte prüfen den geschlossenen Kreisboden sowie die freien Start- und Brückenbereiche. Sie prüft außerdem deterministische Fernstadt/Flugmodelle, nicht degenerierte Fluggeometrie und stetige Routen. Ein konservatives dreidimensionales Raster der tatsächlich erzeugten Stadt prüft die abgetasteten Flugzeughüllen einschließlich Neigung und Sicherheitsabstand gegen Fassaden und Brückenunterseiten. Die Unterdeck-Höhengrenze gilt jetzt ausnahmslos für alle Fahrzeugtypen; auch Triebwerksspuren bleiben unten. Ein reines Dachhöhenraster wäre für diese Unterflüge ungeeignet. GPU-Orchestrierungsprüfungen decken Tiefenziel-Wiederverwendung, Resize, Allokations-/Resolvefehler und nicht blockierende Fence-Abfragen ab. Das ist kein Navigations- oder kontinuierlicher Kollisionsnachweis.

Build und gezielte Aurelion-/Renderertests prüfen weiterhin Geometrie, Rendererressourcen und Flugmodelle. Für das neue Netz kontrollieren sie außerdem die zwei Hauptbahnfamilien, bewusst unvollständige Nebenstraßen, deterministische Portalblenden, stetige sichtbare Bewegung und die vollständigen Fahrzeughüllen gegen echte Stadtgeometrie. Unsichtbare Routenübergänge erzeugen keine quer durch die Stadt gezogenen Triebwerksspuren. Die Standardtestsuite wurde für diesen lokalen Darstellungs-/Verkehrspass nicht erneut ausgeführt.

Technischer Chromium-Check bei 1672 × 941 über `file://`: bewegte Hologlobus-Projektionen und überarbeitetes Unterdecknetz mit MSAA/Tiefeneffekten, Ansichtwechsel, Effektumschaltung und Bewegung/Pause ohne JavaScript-/WebGL-Fehler. Er belegt ausdrücklich nicht die gewünschte sichtbare Rotation des dominanten Liniengerüsts. Unter dem starken SwiftShader-Rückstau schritt die visuelle Uhr während des Bewegungsfensters nun von 12,0 auf 65,7 fort, statt wie zuvor nur auf 13,5; nach dem Pausieren blieb sie stehen. Keine HTTP(S)-Anfragen, Profilzugriffe oder gestartete Simulation im Experiment. Single-Sample, Resize, Reduced Motion und Rückkehr zum normalen Menü wurden beim ursprünglichen Atmosphärenpass geprüft; diese Verträge wurden nicht verändert. Der Browser verwendete SwiftShader ohne zusätzlich freigeschaltete unsichere Browserflags; dessen Software-Warnung und screenshotbedingte Readback-Warnungen sind keine Hardwareabnahme.

Die bereinigte Geometrie liegt bei rund 635.000 statischen Stadtdreiecken plus instanzierter Flug-/Effektgeometrie. Das bisherige Kostenprofil des Atmosphärenpasses ergab bis zu rund 1,37 Mio. eingereichte Dreiecke und 1.356 GL-Zeichenaufrufe einschließlich Schatten/Vollbildpässen. Mesh-VBOs belegten rechnerisch rund 69 MiB, Renderziele/Texturen kommen hinzu. Im kurzen Bewegungsausschnitt keine Textur-/Renderziel-Neuallokationen und höchstens rund 40 KiB Instanzupload je Frame. Gemessene CPU-Einreichzeiten sind ausdrücklich **keine GPU-Zeiten oder Geräte-FPS**; GPU-Timer waren im Softwarekontext nicht verfügbar. Der automatisierte Pausenklick braucht in den aktuellen SwiftShader-Läufen rund 31 bis 36 Sekunden: Die 30-Sekunden-Prüffrist wird überschritten, mit 90-Sekunden-Frist funktioniert der Übergang und die visuelle Uhr bleibt danach stehen. Die Einzel-Frame-Begrenzung garantiert keine geringe Eingabelatenz. Keine Bedienbarkeitsabnahme; Hardware- und Mobilkosten bleiben offen. Die zusätzliche Deckbeleuchtung benötigt keine neuen Meshes oder Renderpässe, erhöht aber die Shaderarbeit.

## Nächste Entscheidungen

- [ ] Die nicht sichtbare Rotation des dominanten Hologlobus-Liniengerüsts getrennt untersuchen; dazu [eigenes Issue](aurelion-hologlobus-rotation.md). Bis dahin nicht erneut auf Verdacht weitere Gitter überlagern.
- [ ] Menschlich bestätigen, dass das Verkehrsnetz sichtbar fortschreitet und nicht mehr als vier kleine Rundkurse wirkt. Danach erst den nächsten Gestaltungsumfang festlegen.
- [ ] Auf dem Zielgerät Bewegung/Bedienbarkeit und Qualität bewerten. Das hohe Studienbudget ist kein Freibrief für eine spätere Echtzeitkarte.
- [ ] Falls weitere Annäherung gewünscht ist: zuerst klären, ob die regelmäßige Geometrie, Wolken/Licht oder Werbemotive nachgearbeitet werden sollen; erneut Screenshotvergleich und Halt.
- Spielbare Flächen, Höhen, Baureserven, Navigation, Ressourcen und Katalogintegration werden im [separaten Integrationsauftrag](aurelion-king-of-the-hill.md) mit eigenem Haltepunkt geprüft. Die Visualstudie selbst bleibt ohne Simulation; sie verwendet dieselben Stadtmeshes und nun CPU-seitig gehaltene Deck-/Brückendeskriptoren.

KI-/Simulations-Langläufe sind nicht beauftragt. Technische Prüfungen ersetzen weder menschliche Darstellungsabnahme noch Echtgeräteprüfung.
