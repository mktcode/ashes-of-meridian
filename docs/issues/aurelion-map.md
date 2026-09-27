# Aurelion: Visualstudie nach Bildreferenz, mit menschlichen Haltepunkten

## Auftrag und Abnahmegrenze

Die gelieferte Vorlage zeigt „Aurelion · The Crown District – Sector 07“: vier Eckplattformen, Ringzentrum mit blauem Globus, Brücken über tiefen Stadtschluchten, gestaffelte Hochhäuser, große Fassaden-Reklamen und eine kühle, dunstige Stadt mit warmen Fensterlichtern. Zusätzlich gewünscht ist fliegender Fahrzeugverkehr im Stil einer vertikalen Science-Fiction-Metropole.

**Aktuelle Freigabe: Zivilverkehr überwiegend unter die Kartenebene verlegen und den Mittelkreis zu einer zusammenhängenden runden Fläche schließen.** Der bereits vorgestellte Atmosphärenstand bleibt ansonsten erhalten. Das ist keine allgemeine Geometrieabnahme und **keine Freigabe zur Spielintegration**. Nach jedem abgegrenzten Gestaltungsstand echte Renderer-Screenshots mit der Vorlage vergleichen und auf menschliches Feedback warten.

Die vier Ecksektoren bleiben breitflächig erhaben; der auf Nutzerwunsch verringerte Höhenversatz und die detaillierte Architektur bleiben erhalten. Beschriftungen, Startmarken und dargestellte Wege sind weiterhin kein beschlossener Spielregelvertrag.

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
- Die deckende Szenentiefe wird nach dem Szenenpass aus dem normalen bzw. multisamplefähigen Tiefenpuffer in eine eigene Textur aufgelöst. Größe und Tiefenformat müssen übereinstimmen. Der Postpass rekonstruiert daraus Weltpositionen für Kontaktabdunklung, Dunst und einen höhenbegrenzten Wolken-Raymarch mit lokalem 3D-Noise und Lichtabschattung.
- Tiefenziele werden bei Resize ersetzt, nicht im Animationsframe neu angelegt. Bei fehlgeschlagener Allokation/Auflösung entfallen Tiefeneffekte mit sichtbarem Hinweis; Licht und Bloom bleiben verfügbar. Eigene Texturen, Tiefenziele und GPU-Fences werden beim endgültigen Verlassen freigegeben.
- Die Animation zeichnet höchstens 60-mal pro Sekunde und hält höchstens einen GPU-Frame in Arbeit. Ein Fence wird ohne Wartezeit abgefragt; kein `gl.finish()` und kein blockierendes GPU-Warten. Hintergrundtabs setzen die visuelle Uhr aus. Pausiert wird nur bei Änderungen neu gezeichnet. Stadtgeometrie und Reklame-/Noise-Texturen bleiben während der Animation unverändert.

Das ist eine gezielt inszenierte WebGL-Studie, kein physikalisch vollständiger Renderer: RGBA8-Szenenziel statt HDR, angenäherte Reflexionen/Leuchtflächen-Abstrahlung statt zusätzlicher Echtzeitlichter. SSAO und Wolkenkomposition verwenden die deckende Tiefe; transparente Effekte erhalten keine separate Tiefenschicht. Diese Grenzen insbesondere bei extremen Kamerawinkeln mitbeurteilen.

## Aktueller Haltepunkt: Visualstudie 05

Der Mittelkreis besitzt eine geschlossene Bodenplatte bis zum Außenrand; innere Öffnungen und ihre vier Stege samt Geländern entfallen. Hologramm, Leuchtringe und äußere Zugänge bleiben erhalten. Der Boden unter den Dekorelementen ist durchgehend, ohne die vier Hochplateaus oder deren Höhenversatz zu verändern.

Der Großteil des Verkehrs zieht durch die unteren Schluchten und unter den Querstraßen hindurch. Engere Ost-/Westkorridore verwenden nur flügellose Lufttaxis; die weiteren Nord-/Südkorridore auch Kuriere. Versetzte Fluglagen geben den Fahrzeugen auf den schmaleren Routen mehr Abstand. Nur eine dünn besetzte Fernroute mit einzelnen Frachtern bleibt über der Stadt. Wolken, Beleuchtung, Reklamen und Hologrammeffekte sind unverändert.

Lokale Abnahmebilder: `.tmp/aurelion-refinement-05/` mit Übersicht, Zentrum, Draufsicht sowie Referenz-/Vorher-Nachher-Vergleichen. `traffic-05.webp` ist ein zusätzlicher Renderer-Diagnoseblick unter die Decks, kein neuer Kamera-Preset. Diese Bilder sind temporäre Abnahmehilfen, keine freigegebenen Laufzeitassets.

**Vergleichsgrenzen:** Der Look nähert sich durch Reklamen, Licht und atmosphärische Tiefenstaffelung deutlich an. Die Vorlage besitzt aber stärker verzahnte Zwischenräume, unregelmäßigere Silhouetten/Fassaden und feinere Material- und Lichtdetails. Große Plätze, Brückenführung und Baukörper bleiben sichtbar regelmäßiger; der Wolkenlook und die prozeduralen Werbemotive benötigen menschliche Beurteilung. Keine Behauptung einer exakten Übereinstimmung oder visuellen Abnahme.

## Technischer Prüfkontext und offene Kosten

Die CPU-Prüfung erhält die abgesenkten, breiten Sektorflächen und freien Rampenübergänge anhand echter Dreiecke; Fläche und Abtastpunkte prüfen den geschlossenen Kreisboden. Sie prüft außerdem deterministische Fernstadt/Flugmodelle, nicht degenerierte Fluggeometrie und stetige Routen. Ein konservatives dreidimensionales Raster der tatsächlich erzeugten Stadt prüft die abgetasteten Flugzeughüllen einschließlich Neigung und Sicherheitsabstand gegen Fassaden und Brückenunterseiten. Ein reines Dachhöhenraster wäre für diese Unterflüge ungeeignet. GPU-Orchestrierungsprüfungen decken Tiefenziel-Wiederverwendung, Resize, Allokations-/Resolvefehler und nicht blockierende Fence-Abfragen ab. Das ist kein Navigations- oder kontinuierlicher Kollisionsnachweis.

Technischer Chromium-Check bei 1672 × 941 über `file://`: neuer Geometriestand mit MSAA/Tiefeneffekten, Ansichtwechsel und Bewegung/Pause ohne JavaScript-/WebGL-Fehler. Keine HTTP(S)-Anfragen, Profilzugriffe oder gestartete Simulation im Experiment. Single-Sample, Effektumschaltung, Resize, Reduced Motion und Rückkehr zum normalen Menü wurden beim vorherigen Atmosphärenpass geprüft; diese Verträge wurden nicht verändert. Der Browser verwendete SwiftShader ohne zusätzlich freigeschaltete unsichere Browserflags; dessen Software-Warnung und screenshotbedingte Readback-Warnungen sind keine Hardwareabnahme.

Die Geometrie liegt weiterhin bei rund 660.000 statischen Stadtdreiecken plus instanzierter Flug-/Effektgeometrie. Das bisherige Kostenprofil des Atmosphärenpasses ergab bis zu rund 1,37 Mio. eingereichte Dreiecke und 1.356 GL-Zeichenaufrufe einschließlich Schatten/Vollbildpässen. Mesh-VBOs belegten rechnerisch rund 69 MiB, Renderziele/Texturen kommen hinzu. Im kurzen Bewegungsausschnitt keine Textur-/Renderziel-Neuallokationen und höchstens rund 40 KiB Instanzupload je Frame. Gemessene CPU-Einreichzeiten sind ausdrücklich **keine GPU-Zeiten oder Geräte-FPS**; GPU-Timer waren im Softwarekontext nicht verfügbar. Ein erster Dauerlauf staute GPU-Arbeit auf und erschwerte die Bedienung; die anschließende nicht blockierende Einzel-Frame-Begrenzung bestand den Bewegungs-/Pausencheck. Hardware- und Mobilkosten bleiben offen.

## Nächste Entscheidungen

- [ ] Menschliches Feedback zum geschlossenen Mittelkreis und tieferen Verkehr abwarten; die Gesamtgestaltung bleibt ebenfalls zur Abnahme offen. Danach erst den nächsten Gestaltungsumfang festlegen.
- [ ] Auf dem Zielgerät Bewegung/Bedienbarkeit und Qualität bewerten. Das hohe Studienbudget ist kein Freibrief für eine spätere Echtzeitkarte.
- [ ] Falls weitere Annäherung gewünscht ist: zuerst klären, ob die regelmäßige Geometrie, Wolken/Licht oder Werbemotive nachgearbeitet werden sollen; erneut Screenshotvergleich und Halt.
- [ ] Erst nach Zufriedenheit mit der Gestaltung spielbare Flächen, Höhen, Baureserven, Navigation, Ressourcen und Katalogintegration festlegen. Die Studie liefert dafür keine gültige CPU-Oberfläche oder Kollisionsmaske.

KI-/Simulations-Langläufe sind nicht beauftragt. Technische Prüfungen ersetzen weder menschliche Darstellungsabnahme noch Echtgeräteprüfung.
