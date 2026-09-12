# Arbeitsprotokoll

Einzige fortlaufende Änderungshistorie unter `docs/`. Neue Einträge kurz nach oben setzen: Änderung, tatsächlich ausgeführte Prüfung und relevante Grenzen. Zusammengehörige Schritte bündeln; ältere Einträge verdichten. Referenzen beschreiben den Ist-Zustand, frühere Details bleiben in Git.

## Kompaktes HUD nach Grafikvorbild

- Dreier-Deck wie in `graphics-inspiration.png`: Minimap links, sechs Werkzeuge über vier Fähigkeiten mittig, Kategorien als 2×2 rechts; Unterkanten bündig. Untermenüs wachsen scrollbar nach oben, ohne Werkzeuge/Fähigkeiten zu verdecken. Tempo direkt unter der Uhr, Attack-move neben Home; auch Energie bleibt mobil sichtbar. Dunkelblaue CSS-Verläufe, cyanfarbene Rahmen und Lichtkanten ohne neue Assets/Renderpässe. Minimap quadratisch eingepasst; Queue/Radio/Toast nachgeführt. Schmale und niedrige Fenster erhalten Rückfalllayouts.
- Welt reicht nun bis zum mittleren Werkzeugblock; höhere Seitenpanels überdecken die unteren Weltecken und blockieren dort DOM-Eingaben. Bei 430×932 wächst der Welt-Viewport von 586 auf 755 px Höhe, unveränderte Zoom-Objektgröße und Spielregeln. Referenzen/Bedienhilfe aktualisiert; keine Fixtures geändert.
- **234 Tests inklusive Build bestanden** (rund 36 s), darunter neuer HTML-Vertrag für Deck-Reihenfolge und einmaligen Tempo-Button unter der Uhr. **Chromium `file://`: 430×932, 390×844/DPR 2, 1280×800, 932×430, 320×740**: Screenshots gesichtet, Unterkanten/Viewportgrenzen, sichtbare und nicht verdeckte Knöpfe sowie scrollbarfreie Kategorien geprüft. Bei 390×844 zusätzlich Touch für Tempo, Attack-move, alle Kategorien, Scrollen/Zurück, Workerauftrag/Queue-Abbruch, Rally/Scan samt Abbruch, Minimap, Pan/Zoom/Home, Pause/Hilfe, Audio-Umschalter und Hauptmenü/Neustart geprüft. Keine Console-/Laufzeit-/GL-Fehler. Diff/lokale Markdown-Links geprüft.
- Headless-WebGL/Touch, kein Echtgerät-/Leistungsnachweis. Sechs mittlere Werkzeuge und Kategorienbeschriftungen sind auf schmalen Portraitgeräten bewusst klein; tatsächliche Lesbarkeit und Treffsicherheit müssen am Gerät beurteilt werden. Keine pixelgenaue Kopie des Vorbilds oder Änderung der Weltbeleuchtung.

## Bloom verstärkt

- Bloom-Faktor auf High/Balanced zunächst von 0,055 auf 0,08 erhöht, auf erneuten Wunsch auf 0,16 verdoppelt. Schwellen, Radien, Samplezahl und Renderpässe unverändert; Performance bleibt ohne Bloom.
- Für den Stand 0,16 erneut **234 Tests inklusive Build bestanden** (rund 38 s). Chromium `file://`, Rust/43015, 430×932, High: Screenshot am HQ gesichtet, GL-Fehler 0, keine Console-Meldungen/Exceptions, weiterhin 37 Draw Calls. Diff geprüft; kein Echtgeräte-/Leistungsnachweis.

## Einzelvarianten aus Boden-Atlanten

- Strauchbelegung anschließend auf Wunsch von 65 auf 10 % der Zellen reduziert (rund 85 % weniger). Nur Ausdünnung bestehender Positionen, keine Größen-/Varianten-/Felsänderung. Dafür erneut **234 Tests inklusive Build bestanden** (rund 37 s); Chromium `file://`, Rust/43015, 430×932: deutlich weniger Sträucher visuell bestätigt, 37 Draw Calls, GL-Fehler 0, keine Console-Meldungen/Exceptions. Diff geprüft; weiterhin kein Echtgeräte-Nachweis.

- Die bisher als Ganzes gekachelten Fels-/Strauchbilder dienen jetzt als unregelmäßig gepackte Atlanten: 15 Felsgruppen und 10 Sträucher mit expliziten Pixelrechtecken im Shader. Zufällige Variante, Position, Größe und Belegung pro Weltzelle aus eigenem 32-Bit-Hash/Weltseed; keine Spiel-/Terrain-RNG-Aufrufe, Kollisions- oder Layoutänderungen. Je PNG weiterhin ein Upload, Originale/Einbettungen unverändert, keine neuen Geometrien/Draw Calls. Alphastärken bleiben 18/28 %. Seitenverhältnis und transparente Ausschnittränder bleiben erhalten, Mip-Level begrenzt gegen Nachbarmotive.
- **234 Tests inklusive Build bestanden** (rund 37 s): Atlasgrenzen/-Anzahl, Upload-/Shadervertrag, Seedwechsel an der Weltansicht sowie unveränderte Terrain-/Platzierungs-/RNG-Referenzen. Keine Fixtures geändert. Alle 25 Ausschnitte als Montage gesichtet und Alpharänder statisch geprüft; Diff/Markdown-Links geprüft.
- **Chromium `file://`, Rust/43015, 430×932 und 1280×800, Nah-/Gesamtansicht, High/Performance:** einzelne, unregelmäßig verteilte Motive statt kompletter Bildkacheln visuell bestätigt; GL-Fehler 0, keine Console-Meldungen/Exceptions. Separater GPU-Pixelvergleich mit den tatsächlichen Atlas-Shaderfunktionen: Wiederholung und Weltverschiebung um acht Pixel exakt deckungsgleich, Seed 43016 verändert beide Dekorlagen. Headless-WebGL, kein Echtgeräte-/FPS-Nachweis; flache Bodendekore, bei großer Entfernung mögliches Aliasing durch begrenzte Mip-Stufen.

## Straßen-Geometrie statt Schatten entfernt

- Der markierte Screenshot widerlegt die vorige Schatten-Diagnose: `world.ts` zeichnete drei Straßen von HOME zu den Gegnerstandorten (45 Flächen für Fahrbahn, Rand und Mittelstreifen). Diesen RNG-freien Platzierungsblock entfernt; die irrtümlich abgeschalteten Bodenschatten wiederhergestellt. Terrain-Overlay bleibt aus, Fels-/Strauchdekore bleiben an.
- Vorher/Nachher-Abgleich aller 16 Referenzwelten: ausschließlich diese 45 Flächen entfernt, übrige Platzierungen samt Reihenfolge, Bodenfarben und Navigation identisch. Nur die beabsichtigt geänderten Platzierungshashes angepasst; Layout-/Terrain-/Effekt-/RNG-Referenzen unverändert. Regression gegen neue Straßenflächen ergänzt.
- **233 Tests inklusive Build bestanden** (rund 36 s). **Chromium `file://`, 430×932, Rust/43015:** Screenshot gesichtet, drei Fahrbahnen und Mittelstreifen am HQ nun tatsächlich verschwunden; 61 Einheiten, 37 Draw Calls, GL-Fehler 0, keine Console-Meldungen oder Exceptions. Diff/Markdown-Links geprüft. Headless-WebGL, kein Echtgeräte-/Leistungsnachweis.

## Boden-Dekore aus neuen Bildquellen

- Bodenquellen eindeutig benannt: `texture-ground-dirt-base.png`, `texture-ground-terrain-overlay.png`, `texture-ground-rock-clusters.png` und `texture-ground-desert-shrubs.png`. Der explizite Aktualisierer heißt `scripts/embed-ground-textures.mjs`, bettet alle vier PNGs bytegleich als Data-URLs ein und bleibt idempotent. Einbettung und anschließende Shader-/Materialnutzung sind getrennte Commits für einen nachvollziehbaren A/B-Stand.
- Die transparenten Fels- und Strauchquellen werden nur im Bodenfragment als zurückhaltende, weltprojizierte Alpha-Dekore gemischt: kleine Felsgruppen und trockene Vegetation. Keine Geometrie, Kollisionsradien, Terrainplatzierung oder RNG-Aufrufe geändert; die flachen Dekore erhalten erst mit künftiger 3D-Dekoration echte Kontaktschatten. Nur zwei zusätzliche PNGs werden hochgeladen und benötigen grob 16 MiB weitere GPU-Mipmaps; kein Echtgeräte-Speicher-/FPS-Nachweis.
- Nach Sichtvergleich die Dirt-Basis von 5,3 auf rund 83,3 Weltmeter vergrößert und ihren direkten PNG-Farbanteil von etwa 6 auf 32 % angehoben. Biom-Grundfarbe, Licht, Nebel und Postprocessing bleiben bewusst aktiv; ihre Unterschiede zur Quelldatei sind nun dokumentiert. Das Terrain-Overlay wird nicht mehr hochgeladen/gezeichnet. Fels- und Strauchdekore bleiben darüber. Die damalige Zuschreibung der Straßen zu Shadow-Map-Projektionen war falsch; Korrektur siehe oben.
- **Damals 233 Node-Tests inklusive Build bestanden**: bytegleiche PNG-Payloads, Shaderuniforms/-Skalen und Dirt-Skalierung/Farbmischung. Damals keine Fixtures geändert; der Shader-Quelltest belegte keine erfolgreiche Straßenentfernung.
- **`file://`, Chromium/High, 430×932 bei DPR 1, Rust, Seed 43015:** Damals Data-URL-Uploads, größere, farbstärkere Dirt-Basis und kleine Boden-/Strauchdekore neben dem HQ geprüft; Straßen waren entgegen der damaligen Auswertung noch sichtbar; 61 Einheiten, 39 Draw Calls, `gl.getError() = 0`, keine Console-Fehler/-Exceptions. Screenshot gesichtet. Headless-Software-WebGL, kein Echtgerät-/GPU-/FPS-/Speichernachweis.

## Aether-Reserve und Evakuierungsausbau

- Verbleibender Gefechts-Aether wird bei Sieg wie Niederlage einmalig als ganzzahliger Rest in die permanente `aether`-Reserve übertragen. Das Ergebnis zeigt die Auszahlung, die Waffenkammer Reserve, Preis und nicht bezahlbare Upgrades. Keine zweite Währung: Gefechts-Aether wird nur evakuiert, wenn er ungenutzt bleibt. `Starting workers` kostet 300 / 450 / 650 / 900 / 1.200 Aether statt kostenlos zu sein.
- Neues permanentes Upgrade **Aether evacuation**: fünf Stufen heben die Run-Grenze von 100 auf 200 / 350 / 500 / 750 / 1.000 Aether; Kosten 500 / 800 / 1.200 / 1.800 / 2.600. Die Grenze wird beim Run-Start in `game.s.meta` kopiert, damit ein Kauf während Pause/Ergebnis erst beim nächsten Start wirkt. Keine Simulation-/RNG-/Gefechtsbalancingänderung außer dem Profiltransfer am Ende; Profilwert auf 0–999.999 normalisiert.
- **233 Node-Tests inklusive Build bestanden** (rund 19 s): Profil- und Preisnormalisierung, nicht bezahlbare/abgezogene/begrenzte Upgrades, ganzzahliger Rest, Einmalauszahlung und alle sechs Evakuierungslimits bis 1.000 abgesichert. Keine Fixtures geändert. Diff und lokale Markdown-Links geprüft.
- Auf Nutzerwunsch kein zusätzlicher Browser-/End-to-End-Lauf; manuelle Balance-/Bedienungsprüfung und reale Ertragserfahrung stehen aus.

## Fraktionen nach erstem Sieg freischalten

- Die Gefechtsauswahl zeigt zunächst nur **The Free Marches** aktiv; Verdant Choir und Veiled Court bleiben sichtbar, ausgegraut und deaktiviert. Ein Sieg mit Spielerfraktion 0 setzt einmalig `factionsUnlocked` im bestehenden permanenten Profil, speichert es und zeigt im Ergebnis die Freischaltung. Danach sind beide Karten dauerhaft aktiv; Gegner bleiben unabhängig frei wählbar. Click-Handler und `startBattle()` verwerfen eine manipulierte gesperrte Auswahl zugunsten von Fraktion 0. Kein Fortschrittsfeld im Run, keine Simulations-/RNG-/Balancingänderung.
- **232 Node-Tests inklusive Build bestanden** (rund 19 s): Profil-Default/strikte Boolean-Normalisierung/Persistenz, gesperrte Karten, Sieg-vs.-Niederlage, einmaliges Speichern, manipulierte Startauswahl und aktivierte Karten geschützt. Keine Fixtures geändert. Diff und lokale Markdown-Links geprüft.
- **`file://`, Chromium, 430×932:** gesperrte Karten und Text, erzwungene gesperrte Startwahl, Ergebnis-Hinweis, aktive Karten nach Sieg und nach Reload geprüft; Bilder gesichtet. Keine Console-/Laufzeitfehler. Headless-Software-WebGL, kein Echtgerät-/Hör-/Leistungstest.

## Welt-Viewport vom HUD getrennt

- Welt, 2D-Overlay und Vignette in eigenem, abgeschnittenem Viewport zwischen Ressourcen- und Fähigkeitenleiste; keine Welt hinter dem Aktionsdeck. High-Unschärfe folgt damit den sichtbaren Welträndern. Kameramitte/Seitenverhältnis, Renderpuffer, Client-Projektion/Picking, Overlayoffsets, Minimap-Rahmen und Sicht-/Eingabegrenzen gemeinsam angepasst. Bisherige Objektgrößen pro Zoomstufe bleiben erhalten; kein zusätzliches Herauszoomen durch die kleinere Fläche. Menüvorschau bleibt bildschirmfüllend, Gefechtsdialoge behalten den Ausschnitt. Simulation/RNG/Texturen/Shader unverändert.
- **231 Node-Tests inklusive strengem Build bestanden** (rund 19 s), keine Fixtures geändert. Neue Regressionen für Viewport-/DPR-Puffermaße, Projektion/Rückprojektion/Zoomgröße/Offsetänderung, Menüwechsel, ungültige Pointer-Releases und Minimap-Ecken. Diff und lokale Markdown-Links geprüft.
- **`file://`, Chromium, alle Qualitätsstufen, 390×844 / 430×932 / 1280×800 / 932×430 bei DPR 1 sowie 390×844 bei DPR 2**: Canvasgrenzen liegen exakt zwischen HUD-Leisten, Puffer/Overlaytransformation stimmen; High-Mitte pixelgleich zum ungefilterten Vergleich, beide Weltränder verändert, Balanced/Performance-Postprocessing unverändert. Touch-Auswahl/Bodenauftrag, Scan-/Bauziel, Pan/Pinch/Minimap, Abbruch außerhalb der Welt sowie Pause/Settings/Qualitätswechsel/Ergebnis/Upgrades/Hauptmenü/Neustart geprüft; Bilder gesichtet. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler.
- Headless meldet Software-WebGL-/ReadPixels-Warnungen; keine abgeschwächten Sicherheitsflags. Kein Echtgerät-/FPS-Nachweis. Die bestehenden HUD-Höhen bleiben erhalten und lassen in flachem Querformat weiterhin wenig Weltfläche; kein zusätzlicher Landscape-Menüumbau.

## Dezenter High-Tilt-Shift als Grafikversuch

- High filtert obere/untere Bildbereiche im bestehenden Postshader; breite scharfe Mitte, auflösungsrelativer Radius, maximal acht zusätzliche Samples ohne weitere Renderziele/Pässe. Balanced/Performance, Licht/Materialien/Bloom, Kamera, HUD-Overlays und Simulation unverändert. Settings kennzeichnen High mit Tilt-Shift. Kein allgemeiner Gerätesupport-Kompromiss beschlossen.
- **227 Node-Tests inklusive strengem Build bestanden** (rund 21 s), keine Fixtures geändert. Shader-Vertrag schützt High-Schranke, Schärfezone und normierten Kernel; bestehende MSAA-/Fallbacktests bestehen. Diff und lokale Markdown-Links geprüft.
- **`file://`, Chromium, Rust/Ash, alle drei Qualitätsstufen, 390×844 / 430×932 / 1280×800 bei DPR 1 sowie 390×844 bei DPR 2**: alter/neuer Postshader auf derselben angehaltenen Szene verglichen. High-Mitte pixelgleich, Ränder sichtbar verändert; Balanced/Performance vollständig pixelgleich. Run-Zustand unverändert, PNG-Uploads/Shader/MSAA fehlerfrei. Touch-Auswahl/Bodenauftrag, Pause/Settings-Qualitätswechsel/Fortsetzen und Settings-Breite geprüft; Vergleichsbilder gesichtet.
- Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler; bekannte Chromium-Warnungen zu Software-WebGL, ReadPixels-Stalls und Audio-Autoplay protokolliert, keine Sicherheitsflags abgeschwächt. Kein Echtgerät-/GPU-/FPS-/Hörnachweis. Eindruck gegenüber `graphics-inspiration.png`: etwas weichere Randbereiche, aber die größere Lücke bleibt bei Bodenmaßstab, Materialplastizität und Kontaktschatten; diese sind noch unverändert.

## Aktualisierte Dirt-Textur eingebettet

- Neue gepflegte `texture-floor-dirt.png` bytegleich eingebettet (1254×1254 statt alter 512×512-WebP-Kopie), ohne Neukodierung oder Skalierung. Expliziter Aktualisierer `node scripts/embed-ground-texture.mjs` und Bytegleichheitsregression ergänzt; andere Texturen, Farb-/Lichtregeln und Layouts unverändert. Größere Einbettung und GPU-Textur betreffen alle Qualitätsstufen; keine Speicher-/Ladezeitgarantie für Altgeräte.
- **226 Node-Tests inklusive strengem Build bestanden** (rund 18 s), keine Fixtures geändert. Aktualisierer idempotent; Diff und lokale Dokumentationslinks geprüft.
- Vorher/Nachher unter **`file://`, Chromium High, 430×932**, Rust und Ash mit identischem kontrolliertem Aufbau/Scan: 1254×1254-PNG erfolgreich hochgeladen, Bilder gesichtet, keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Chromium meldet Software-WebGL-Fallback und Screenshot-/ReadPixels-Stalls; keine abgeschwächten Sicherheitsflags. Kein Echtgerät-/GPU-Leistungsnachweis. Der Vergleich bestätigt weiterhin stark biomgefärbte, kleinteilig gekachelte Bodendetails; Shader unverändert.

## Upgrades direkt vom Endscreen

- Sieg und Niederlage bieten Neustart, **Fleet Upgrades** und Hauptmenü untereinander über die volle Inhaltsbreite; vorhandenes `.btnstack` wiederverwendet, keine neuen CSS-Regeln. Upgrade-Rückkehr zeigt dasselbe gesperrte Ergebnis, gekaufte Upgrades gelten beim nächsten Start. Ergebnis-Sound an das Ereignis statt die erneute Darstellung gebunden. Keine neuen Navigationszustände oder Simulationsänderungen.
- **225 Node-Tests inklusive strengem Build bestanden** (rund 19 s): beide Ergebnisse, Upgrade-Kauf/Rückkehr, unveränderter Run, einmalige Ergebnis-Soundauslösung sowie bestehende Hauptmenü-/Pausenwege. Keine Fixtures geändert. Diff und lokale Markdown-Links geprüft.
- **`file://`**, Chromium/Performance, **390×844, 430×932 und 1280×800**: beide Endscreens nach kontrollierter HQ-Zerstörung, volle Buttonbreite, native Touch-Navigation/Kauf/Rückkehr, gespeichertes Upgrade beim gleichen Seed-Neustart und Hauptmenüwege bestanden; Bilder gesichtet. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät-/anderer Browser-/GPU-Test; Sound-Aufrufe automatisiert geprüft, kein Hörtest.

## Gefechtstempo direkt im HUD

- Links über den Fähigkeiten steht ein Tempo-Button mit aktueller Anzeige: 1× → 1,5× → 2× → 0,75× → 1×. Tempozeile unter der Uhr und Geschwindigkeitsauswahl/-Handler in den Settings entfernt; Queue-Symbole mit Abstand darüber platziert. Bedienung in `ui/input.js`, Darstellung in `ui/actions.js`; kein struktureller Umbau. `game.s.speed`, Startwert 1, Simulationsschleife und Speicherung unverändert. Pause behält das Tempo, Neustart setzt zurück; keine Änderung an Auswahl, Zielmodus oder laufenden Aufträgen.
- **223 Node-Tests inklusive strengem Build bestanden** (rund 17 s): Umschaltfolge, Button-/ARIA-Anzeige, Pausen-/Ergebnis-/Run-Schutz, Profilfreiheit, entfernte Settings-/Uhr-Anbindung und Neustart geprüft. Keine Fixtures geändert. Diff und lokale Markdown-Links geprüft.
- **`file://`**, Chromium/Performance, **390×844, 430×932 und 1280×800**: native Touch-Umschaltung bei laufender Simulation, Auswahl-/Fähigkeitsmodus ohne Weltauftrag, Pause/Settings/Fortsetzen, Neustart auf 1× und unverändertes gespeichertes Profil bestanden. Platz/Erreichbarkeit neben Kamera/Fähigkeiten und unter aktiver Produktionsqueue einschließlich 0,75× geprüft, Bilder gesichtet. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät-/anderer Browser-/GPU-/Screenreader-Nachweis.

## Geschützte Worker-Aufträge und Bau-/Reparatur-Kontexttaps

- Automatische Bau-/Repair-Zuweisung verwendet nur Worker ohne Bau-/Reparaturauftrag, einschließlich Anfahrt; Abbau zählt als frei. Kein freier Worker: keine Platzierung/Zahlung, sichtbarer Hinweis im Baumenü. Worker-Auswahl → eigenes Fundament/beschädigtes Gebäude oder eigene Einheit weist genau einen ausgewählten Worker zu, erhält Auswahl und sonstige Aufträge und darf ausdrücklich umleiten. An Baustellen wird der bisherige Bauarbeiter abgelöst, ohne Mehrarbeitertempo oder erneute Baukosten. Intakte Ziele bleiben normal auswählbar.
- Beim Browsercheck zusätzlich reproduziert: Die 0,65-m-Wegpunkttoleranz konnte neu zugewiesene Worker knapp außerhalb der Arbeitsreichweite stoppen. Bau-/Reparaturaufträge fahren den letzten Wegpunkt nun präzise an; Arbeitsreichweite, Kollisionsradien, Bau-/Reparaturraten und Kosten unverändert. Keine neuen RNG-Aufrufe; geänderte Arbeitsabläufe verwenden ihre regulären Effekt-Samples.
- **221 Node-Tests inklusive strengem Build bestanden** (rund 18 s), keine Fixtures geändert. Neue Zuweisungs-/Ablösungs- und Wegpunktregressionen scheiterten vor ihren Fixes; zusätzlich Kosten, Gruppen, gültige Arbeitsziele, Auswahl-/Pausen-/Gestenschutz und dynamischer Verfügbarkeitshinweis geprüft. Diff und lokale Markdown-Links geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: native Touch-Platzierung zweier Fundamente mit unterschiedlichen Workern, Bausperre/Hinweis bei belegten Workern, manuelle Ablösung/Fortsetzung bis Fertigstellung sowie Gebäude-/Einheitenreparatur bestanden. Auswahlerhalt und Auswahl intakter Ziele geprüft, Bilder gesichtet. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Kontrollierte Simulationsschritte und CDP-Touch, kein Echtgerät-/anderer Browser-/GPU- oder allgemeiner Navigationsnachweis.

## Umschaltbares Attack-move

- Schwerter-Schalter links neben der Basiskamera ergänzt: gold/`aria-pressed` = Attack-move, sonst normale Bewegung einschließlich Rückzug. Wirkt nur auf künftige Bodenaufträge (Touch und Welt-/Minimap-Rechtsklick), bleibt bei Auswahlwechsel/Cancel/Pause erhalten und startet pro Gefecht ausgeschaltet. Worker, Kontextziele, Bau/Fähigkeiten, Rally und laufende Aufträge bleiben unabhängig. Handbuch und Referenzdokumentation aktualisiert; kein weiteres Refactoring.
- **213 Node-Tests inklusive Build bestanden**, keine Fixtures geändert. Neue Tests decken beide Schalterzustände, wiederholte Befehle, Kontext-/Fähigkeitsziele, Pausen-/Ergebnisschutz, Startreset und Profilfreiheit ab. Diff und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: native Touch-Umschaltung, echte Move-/Attack-move-Aufträge samt Worker-Ausnahme, Pause/Fortsetzen, Pan ohne Auftrag und Neustartreset bestanden. Aktive/inaktive Darstellung gesichtet. Seed 444213 im Browser kontrolliert simuliert: HQ wird beschädigt und ohne Gegenwehr zerstört. Keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch und kontrollierte Simulationsschritte, kein Echtgerät- oder anderer Browser-/GPU-Test.

## Kampfannäherung ohne vorzeitigen Ankunftsstopp

- Die Toleranz für belegte Bewegungsziele stoppte Attack-move-Einheiten außerhalb ihrer Waffenreichweite. Kampfbewegungen deaktivieren nun nur diese Toleranz; Kollisionsradien, Waffenwerte und normale Zielankunft bleiben unverändert. Keine zusätzlichen RNG-Aufrufe; tatsächlich stattfindende Kämpfe verbrauchen wieder ihre regulären Effekt-Samples.
- Zwei neue Regressionen scheiterten vor dem Fix und bestehen danach: Annäherung beider Teams mit Rifle/Tank/Artillerie gegen Gebäude/Einheiten sowie unverteidigtes HQ bei Seed 444213. Ein zusätzlicher Rückzugstest schützt gewöhnliche Bewegung bei Feindkontakt. **210 Node-Tests inklusive Build bestanden**, keine Fixtures geändert. Kein eigener Browserlauf für diesen Simulationsfix; der folgende Eingabeschalter erhält einen gezielten `file://`-Check.

## Typisierte kosmetische Effekte

- `src/effects.ts` typisiert den aktuellen RNG-Provider, alle sechs Effektpayload-Varianten, Schadenszahlen und die Simulationseingaben für Schüsse, Bau, Abbau, Heilung und Drops. Der diskriminierte Payload-Vertrag verengt Partikel-, Rauch-, Beam- und Shell-Felder im Tick; `effects-view.js` bleibt als renderernahe Darstellung bewusst noch untypisiert.
- Strenger Build ohne TypeScript-Diagnosen und **207 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert. Temporäre Negativproben wiesen einen unvollständigen Partikelpayload sowie falsche Weltkoordinaten und Renderdatentupel zurück. Namen, Reihenfolge und Texte aller 11 `MeridianEffects`-Prototyp-Properties stimmen mit dem vorherigen Stand überein; Effektpayload-, Lebensdauer-, Sichtbarkeits- und RNG-Referenzen blieben grün.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Build-Ausgabe, Gefechtsstarts, Touch-Menüs, Startworker, Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder anderer Browser-/GPU-Test.

## Typisierte CPU-Welt

- `src/world.ts` typisiert Raster, Heap, Navigation, Sichtfelder, Geländeplätze und die von `BattlefieldView` konsumierten Renderdaten. Weltmethoden nehmen die bereits typisierten Entitäten und Scans entgegen; drei lokale Assertions in der Simulation dokumentieren bestehende Auftragsverengungen über Callback-Grenzen. Terrain-Erzeugung, Hindernisradien, Pfadschritte und RNG-Reihenfolge wurden nicht geändert.
- Strenger Build und **207 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert. Alle 11 `Battlefield`-Prototyp-Properties und Hilfsfunktionen blieben in Namen/Reihenfolge erhalten; die erzeugte Methodenausgabe unterscheidet sich nur durch Compilerformatierung in `generate()`. Sämtliche festen Welt-, Navigations-, Ressourcen-, Darstellungs- und RNG-Referenzen blieben grün.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Build-Ausgabe, Gefechtsstarts, Touch-Menüs, Startworker, Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder anderer Browser-/GPU-Test.

## Typisierte Gefechtssimulation

- Alle fünf Simulationsfragmente nach TypeScript migriert. `src/contracts.d.ts` modelliert jetzt den nullable Run-Zustand, Entitätsvarianten, Einheitenbefehle, Produktionsqueues, Kosten, Fähigkeiten und Simulationsgrenzen. Die generische Spawn-Fabrik koppelt Art und Rückgabetyp; die vorhandenen Methodenobjekte erweitern weiterhin gemeinsam `MeridianGame` und werden unverändert als klassische, nicht aufzählbare Prototypmethoden ausgeliefert.
- Strenger Build ohne TypeScript-Diagnosen und **207 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert. Drei temporäre Negativproben wiesen Tippfehler in Run-Zustand/Queue und einen falschen Mine-Auftrag wie vorgesehen zurück. Namen, Reihenfolge und Deskriptoren aller 59 Prototyp-Properties stimmen mit dem vorherigen Stand überein; direkte Ausgabeprüfung zeigte nur typbedingte Formatierung in drei Methodentexten und eine logisch gleichwertige Verengung im Befehlszweig. RNG-, Entitäts-, Kollisions- und Simulationsreferenzen blieben grün.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Build-Ausgabe, Touch-Menüs, Käufe bis fünf Startworker, Gefechtsstarts, zusätzliche Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder anderer Browser-/GPU-Test.

## Typisierte Inhalts- und Profilverträge

- `src/content.ts` typisiert Inhaltskataloge über `satisfies` und leitet Einheiten-, Gebäude-, Fähigkeits-, Biom- und Icon-Schlüssel aus den vorhandenen Objekten ab. `src/persistence.ts` typisiert injizierte Abhängigkeiten, Profil, Einstellungen, Storage und öffentliche API; gemeinsame reine Verträge liegen in `src/contracts.d.ts`. Keine Katalogwerte, Normalisierung oder Storage-Abläufe geändert.
- Strenger TypeScript-Build und **207 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert. Das erzeugte JavaScript beider migrierter Dateien ist bytegleich mit der Compiler-Ausgabe ihrer vorherigen JavaScript-Quellen. Kein erneuter Browsercheck, da Laufzeitwerte und erzeugte Skripte unverändert sind.

## Reproduzierbare TypeScript-Auslieferung

- TypeScript 7.0.2 als einzige lokale Entwicklungsabhängigkeit ergänzt. `npm run build` leert `dist/` und erzeugt aus den weiterhin handgepflegten Quellen klassische Skripte samt Source Maps unter `dist/src/`; `index.html` und die Tests laden ausschließlich diese nicht eingecheckte Ausgabe. Kein Bundle, Laufzeitimport oder Server; synchrone Skriptreihenfolge und `file://` bleiben erhalten.
- `npm test`: Build und **207 Node-Tests bestanden** (rund 17 s), keine Fixtures geändert. Der Loader schützt weiterhin klassische Bindungen, Reihenfolge, Fragment-APIs und lokale Pfade der tatsächlichen Build-Ausgabe.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der Build-Ausgabe, Touch-Menüs, Käufe bis fünf Startworker, Gefechtsstarts, zusätzliche Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder anderer Browser-/GPU-Test.

## Renderer-, Stylesheet- und Testladegruppen

- Wiederholte Listen der fünf Simulations- und fünf UI-Skripte als eingefrorene, benannte Gruppen im Testloader gebündelt; beim anschließenden Renderer-Umbau eine entsprechende Vierergruppe ergänzt. Aufrufstellen wählen Abhängigkeiten weiterhin ausdrücklich, der Loader führt sie weiterhin ausschließlich in Dokumentreihenfolge aus.
- `src/renderer.js` in vier synchrone klassische Skripte unter `src/renderer/` geteilt: eingebettete Assets/Materialien, Geometrie, Shader und WebGL-Laufzeit. Alle vier verschobenen Deklarationsblöcke sind textidentisch; Material-/Textur-/Shaderwerte, Geometriefunktionen sowie Texte, Reihenfolge und Deskriptoren aller 24 `MeridianRenderer`-Prototyp-Properties wurden direkt mit dem vorherigen Stand verglichen. Eine Harness-Regression schützt Dateireihenfolge, Bindungen und Klassen-API.
- `styles.css` entlang der vorhandenen Grenzen in `styles/base.css`, `styles/screens.css` und `styles/hud.css` geteilt. Die Verkettung in HTML-Reihenfolge ist bytegleich zum vorherigen Stylesheet; eine Steuerungsregression schützt lokale Pfade und Kaskadenreihenfolge.
- Abschließend einmal **207 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert. Syntax, Diff und veraltete Quellpfade geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der neuen Renderer- und Stylesheetdateien, Touch-Menüs, Gefechtsstarts, Upgrade-/Einstellungs-Persistenz, Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden. Menü- und Gefechtsbilder gesichtet; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät-, anderer Browser-/GPU- oder weiterer Qualitätsstufentest.

## Fachlich geteilte Benutzeroberfläche

- `src/ui.js` in fünf weiterhin klassische, synchron geladene Skripte unter `src/ui/` geteilt: Klasse/Ereignisse, Menüs/Dialoge, Aktionen/HUD, Eingabe sowie Minimap/Overlay. `core.js` deklariert `MeridianUI`; `defineMeridianUIMethods` registriert die ausgelagerten Methoden mit denselben nicht aufzählbaren, konfigurierbaren und schreibbaren Deskriptoren. `$` und `esc` bleiben gemeinsame lexikalische Bindungen; keine Imports oder Buildschritte ergänzt.
- Konstruktor und alle **45 Methodentexte** direkt mit dem vorherigen Stand verglichen: textidentisch. Signaturen, Deskriptoren und Reihenfolge aller 46 Prototyp-Properties stimmen ebenfalls überein. Neue Harness-Regression schützt Dateireihenfolge, vollständige Montage, Nichtaufzählbarkeit und die von `app.js` verwendete `esc`-Bindung.
- **205 Node-Tests bestanden** (rund 22 s), keine Fixtures geändert. Syntax, Diff, Quellpfade und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der fünf UI-Skripte, native Touch-Menüaktionen, Gefechtsstarts, Upgrade-/Einstellungs-Persistenz, Rekrutierung, Reload/Neustart und kontrollierter Abbau bestanden; Gefechtsbild gesichtet, keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerätetest.

## Fachlich geteilte Gefechtssimulation

- `src/simulation.js` in fünf weiterhin klassische, synchron geladene Skripte unter `src/simulation/` geteilt: Klasse/Entitäten, Bewegung, Wirtschaft, Kampf und Laufzeit. `game.js` deklariert `MeridianGame`; `defineMeridianGameMethods` registriert die übrigen Methoden mit denselben nicht aufzählbaren, konfigurierbaren und schreibbaren Deskriptoren. Öffentliche Methodennamen und Signaturen bleiben erhalten; keine Imports oder Buildschritte ergänzt.
- Alle **58 ausgelagerten Methodentexte** und `formatTime` direkt mit dem vorherigen Stand verglichen: textidentisch. Die Signaturen/Deskriptoren aller 59 Prototyp-Properties stimmen ebenfalls überein. Neue Harness-Regression schützt Dateireihenfolge, vollständige Montage und Nichtaufzählbarkeit.
- **204 Node-Tests bestanden** (rund 15 s), keine Fixtures geändert. Syntax, Diff und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden der fünf Skripte, Gefechtsstarts, Käufe, Reload/Neustart, Rekrutierung und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerätetest.

## Laufzeitquellen unter `src/`

- Alle zwölf direkt ausgelieferten JavaScript-Quellen mechanisch nach `src/` verschoben. `index.html`, Testpfade und Dokumentation folgen den neuen relativen Pfaden; Dateiinhalte und synchrone Ladefolge bleiben unverändert. Stylesheet und Bildquellen verbleiben bewusst in der Rootebene.
- Alte und verschobene Quellen bytegleich verglichen, Syntax und Diff geprüft; **203 Node-Tests bestanden** (rund 16 s), keine Fixtures geändert.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: Laden aller Quellen, Start, kostenlose Startworker-Käufe, Reload, Neustart, Rekrutierung und kontrollierter Abbau bestanden; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerätetest.

## Permanentes Startworker-Upgrade

- Command, Resolve und Industry samt Spieleffekten durch `Starting workers` ersetzt: kostenlos zum Testen, Stufen 0–5, ein sofort verfügbarer Worker je Stufe. 250 Alloy / 0 Aether bleiben erhalten; Wirkung nur bei neuem Gefecht/Neustart. Profil lädt nur aktuelle, begrenzte Ganzzahlstufen; alte Schlüssel werden verworfen, nicht migriert. Menü, Startanzeige, Funkhinweis und Hilfe angepasst.
- Bonusworker werden nach dem ursprünglichen Welt-/Gegneraufbau auf freien Plätzen nahe dem HQ erzeugt. Ressourcen/Gegner behalten ihre Seedwerte; je Worker kommt nur der reguläre Spawn-RNG-Aufruf hinzu. Keine Änderungen an Terrain, Kollisionsradien oder Fixtures.
- **203 Node-Tests bestanden** (abschließend rund 21 s bei parallelem Browsercheck). Unter anderem alle sechs Stufen × drei Fraktionen × fünf Biome, Abstände, RNG-Verbrauch, automatischer Abbau, Upgrade-Übernahme/Neustart, Speicherung und entfernte Boni geprüft. Syntax, Diff und lokale Dokumentationslinks geprüft.
- **`file://`**, Chromium/Performance, **390×844 und 430×932**: native Käufe bis Stufe 5, Maximalsperre, Starts mit 0/1/5 Workern, zusätzliche bezahlte Rekrutierung, Reload und Neustart bestanden; 60 Simulationssekunden Abbau kontrolliert durchlaufen. Upgrade-/Gefechtsbilder angesehen; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. CDP-Touch, kein Echtgerät- oder Langzeitbalancing-Nachweis.

## Produktionsabfrage, Industriefaktor und HUD-Signatur

- In drei separaten Refactorings Produktionsfilter für Simulation/HUD und damaligen Industriefaktor gebündelt sowie ungenutztes `updateHUD(force)` bereinigt. Sortierung, Rechenreihenfolge und Aktualisierungszeitpunkte blieben gleich. Der Industriefaktor wurde mit dem obigen Upgrade-Wechsel wieder entfernt.
- Damals **200 Node-Tests bestanden** (rund 13 s), nach 14 beziehungsweise 7 gezielten Tests. Syntax, Diff und Links geprüft; keine Fixtures geändert. Kein Browsercheck für diese verhaltensneutralen Refactorings.

## Fähigkeitsdefinitionen, Minimap-Koordinaten und HUD-Versorgung

- Energiekosten/Cooldowns unverändert nach `content.js` (`ABILITIES`) verschoben; Simulation und HUD lesen dieselbe Kostendefinition. Zielprüfungen, Effekte und Prüfungsreihenfolge bleiben unverändert. Fünf gezielte neue Node-Tests bestanden: alle vier Energie-/Cooldown-Grenzen samt Bezahlung sowie HUD-Badges/Sperren.
- `ui.js`: lokale Funktion `minimapPosition` für Drücken/Ziehen, weiterhin aktuelle Elementgrenzen pro Aufruf. **44 Steuerungstests bestanden**, darunter neue Prüfung mit wechselnden Abmessungen/Offsets, Abbruch und Rechtsklickauftrag.
- Gezielt **`file://`**, Chromium/Performance, **390×844 und 430×932**: native Touch-Taps, Ziehen und Kameragrenzen nach Größenwechsel geprüft; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Kontrolliertes CDP-Touch, kein Echtgerätetest.
- `updateHUD()` berechnet Versorgung/Kapazität einmal pro Aufruf und verwendet sie für Text, Warnfarbe und Rekrutierungssperren; kein Cache über Aufrufe hinweg. Neue Prüfung deckt Grenzwerte und Aktualisierung nach Versorgungs-/Kapazitätsänderungen ab.
- Abschließend **196 Node-Tests bestanden** (rund 13 s) über alle drei getrennten Refactorings. Syntax, Diff und lokale Dokumentationslinks geprüft; keine Fixtures geändert. Der obige Browsercheck wurde nach der Minimap-Extraktion, vor der reinen HUD-Berechnungsbündelung ausgeführt.

## Gemeinsame Hilfezeilen und Bewegungsgeschwindigkeit

- `ui.js`: drei identische Hilfezeilen-Templates in die lokale Funktion `renderHelpLines` innerhalb von `showHelp()` gezogen. `simulation.js`: `move()` und `moveYield()` verwenden dieselbe Methode `movementSpeed(e)`; Faktoren, Berechnungsreihenfolge, Kollisions-/Weglogik und unterschiedliche `walk`-Fortschritte unverändert.
- **189 Node-Tests bestanden** (rund 12 s), einschließlich neuer Prüfung für Worker-/Fluggeschwindigkeit aller Fraktionen, aktive/abgelaufene Verlangsamung und Mutations-/RNG-Freiheit. Syntax und Diff geprüft; keine Fixtures geändert.
- Erzeugtes Hilfe-HTML, Modalargumente und Pausenverhalten für Hauptmenü/Gefecht direkt gegen den vorherigen Git-Stand verglichen: identisch. Kein neuer Browsercheck, da weder ausgeliefertes Markup noch Eingabe-/Layout-/Renderverhalten geändert wurden.

## Benannte Simulationsschrittweite und risikogerechte Testpflicht

- `app.js`: vier identische Schrittweiten durch die lokale Konstante `SIMULATION_STEP_SECONDS = 0.05` ersetzt; Aufrufreihenfolge und Schrittbegrenzung unverändert.
- Für die Konstantenextraktion **188 Node-Tests bestanden** (rund 13 s), Diff geprüft. Kein Browsercheck für die reine Konstantenextraktion.
- Anschließend Testpflicht in `AGENTS.md` und `docs/testing.md` gelockert: Für mechanische, verhaltensneutrale JavaScript-Kleinständerungen genügen Syntaxprüfung und Diff-Sichtung; bei Logik-/RNG-/Schnittstellen-/Teständerungen sowie im Zweifel weiterhin vollständiger Node-Lauf. Für diese reine Regeländerung nur Diff und lokale Dokumentationslinks geprüft, keine erneuten Spieltests.

## Startökonomie nur durch Worker und Raffinerien

- Neue Runs beginnen fest mit **250 Alloy / 0 Aether**. Worker kosten für alle Fraktionen 50 Alloy, sodass genau fünf sofort bezahlbar sind. Passives HQ-Alloy/-Aether und das permanente Start-Alloy-Upgrade entfernt; Energie-Regeneration bleibt unverändert. Reguläres Alloy-/Aether-Einkommen kommt nur durch Worker beziehungsweise Raffinerien.
- Ausgebaute Testbasen deklarieren ihre 1100/400 Testwirtschaft nun ausdrücklich; feste Gelände-/RNG-Referenzen und übriges Balancing bleiben unverändert.
- **188 Node-Tests bestanden**, darunter 60 s ohne Worker/Refinery und ohne Alloy-/Aether-Zuwachs, exakt fünf bezahlbare Worker für jede Fraktion, Abbau, Raffinerieeinkommen und verbliebene Upgrades. Keine Fixtures neu erzeugt. Kein Browsercheck für die reine Simulations-/Balancingänderung; manueller Spieltest steht aus.

## Runs ohne Speicherung

- Manuelles Speichern/Laden, Autosave, Home-Resume, Retry checkpoint, Backup-Import/-Export und Simulation-Snapshot/Restore entfernt. Alte Checkpoints werden ignoriert, keine Migration. Nur Upgrades/Einstellungen bleiben im unveränderten lokalen Profil.
- Pause/Fortsetzen und automatisches Pausieren bei verborgenem Tab bleiben; Hauptmenü/Reload/Schließen verwerfen den Run. Nach Sieg/Niederlage ausschließlich Neustart oder Hauptmenü; beendete Runs lassen sich nicht fortsetzen. Hilfe, Abbruchwarnung und Grafikfehlertexte angepasst.
- **187 Node-Tests bestanden**. Entfallene Save-Tests entfernt, verbleibende Produktions-/Bewegungsprüfungen laufen ohne Restore weiter; neue Lebenszyklus-/Profiltests prüfen Abbruch, frischen Neustart, Pause und fehlende Speicherpfade. Feste Fixtures unverändert.
- Kurzer **`file://`-Check**, Chromium/CDP, Performance, **390×844**: native Rekrutierung/Pause/Fortsetzen, kein Autosave nach 45 s, Reload verliert Run und behält Profil, alter Checkpoint ignoriert, Niederlage → HQ-Neustart sowie Abbruch ins Hauptmenü. Pause-/Ergebnisbilder gesichtet; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler. Kontrollierter Headless-Check, kein Echtgerät- oder Langzeitspielnachweis.

## Gefechtsstart nur mit dem HQ

- Spieler startet ohne weitere Gebäude oder Einheiten; auch der erste Worker muss über Infanterie rekrutiert werden. Starttruppen-/Startworker-Upgrades aus Katalog und Startlogik entfernt, damals vier übrige Upgrades erhalten. Gegneraufstellung, Ressourcen und Wellenzeiten waren in diesem Schritt unverändert; kein neues Worker-Startupgrade oder Save-Umbau.
- Starttext/Hilfe und Referenzen angepasst. 24 reservierte Samples erhalten die festen Ressourcen-/RNG-Referenzen. Ausgebaute Basen sind jetzt ausdrückliche Testaufbauten, kein echter Spielstart.
- **196 Node-Tests bestanden**, einschließlich HQ-only über alle Fraktionen/Biome, erster Worker samt Bezahlung/Produktion/Restore/Abbau und erstem Gebäude, übrigen Upgrades sowie bestehenden Crowd-/Effektreferenzen. Keine Fixtures neu erzeugt. Browsercheck auf Nutzerwunsch ausgelassen; manueller Spiel- und Balancingtest steht aus.

## Seitliches und kontinuierliches Platzmachen

- `29fbfc4` begrenzte das Mitschieben auf seitliche Verschiebung mit Sperrzeit; trotz 193 bestandener Node-Tests meldete der Nutzer sichtbares Ruckeln durch Positionssprünge und 0,35-s-Pausen.
- Statt sofortiger Versetzung jetzt ein kurzes `yieldTo`-Manöver mit normaler Geschwindigkeit, Drehung und Bewegungsanimation, auch für untätige Einheiten. Möglichst den ganzen Laufweg freimachen, bei Platzmangel einen kürzeren Schritt. Normale Aufträge bleiben erhalten; die Sperrzeit stoppt nicht mehr die eigene Bewegung. Eigenes Umgehen vor Platzanforderung; bereits ausweichende Verbündete nicht seitlich verfolgen.
- **194 Node-Tests bestanden**: kontinuierliche Schritte ohne Anfangssprung, Auftrags-/Standplatzschutz, Save/Load und neu blockiertes Ausweichziel; bestehende sechsminütige Worker-Gegenverkehrstests weiterhin bestanden. Keine Fixtures geändert. Kein eigener neuer Browsercheck; Nutzer meldete eine Verbesserung, weitere Pathfinding-Arbeit ist zurückgestellt.

## Worker-Gegenverkehr und sichtbare Produktionsausfahrt

- Den gemeldeten Stau reproduziert: Der isolierte Acht-Worker-Probelauf blieb mit dem vorherigen Code über den sechsminütigen Test bei insgesamt 18 Alloy stehen. Die bisherigen Kurzprüfungen waren dafür unzureichend.
- Gleichbleibende Ausweichseite, Vorrang für beladene Worker, kurze Wartezeit nach Ausweichen und begrenztes gemeinsames Platzmachen ersetzen gegenseitiges Zurückdrücken. Bei Stillstand plant die vorhandene Wegsuche um Einheiten herum. Automatische Ressourcenzuweisung berücksichtigt Auslastung; Abbaurate/Ladung bleiben unverändert.
- Produktion startet im Gebäude und bewegt die Einheit tatsächlich zum reservierten Ausgang. Erst anschließend laufen normale Aufträge; Flugzeuge steigen dabei auf. Ausfahrt und Wartezeit überstehen Save/Load, bestehende Strukturen/Assets bleiben erhalten.
- **193 Node-Tests bestanden**, inklusive vier sechsminütiger Abbau-Szenarien mit acht/zwölf Workern, drei Fraktionen, eigener Startarmee, gemeinsamem Einzelvorkommen und Restore. Jeder Worker muss in jeder Minute liefern; anhaltende Richtungswechsel werden erkannt. Außerdem Ausfahrt aller sieben Typen, Reservierung, Verkauf des Produzenten, fehlerhafte Exit-Daten, Navigationsraster/RNG und Flugdarstellung geprüft. Feste Fixtures unverändert; `git diff --check` sauber.
- Gezieltes **`file://`**, Chromium 152/Performance, **390×844**: rekonstruierter gespeicherter Stau löst sich; alle acht Worker liefern in jeder der sechs Simulationsminuten (22–30 Ablieferungen je Worker insgesamt), auch nach erneutem Restore. Keine anhaltende Richtungswechselserie im gemessenen Ablauf. Live-Bildfolge beim Abbau sowie native Rifle-/Tank-/Air-Rekrutierung und Ausfahrt aufgenommen und angesehen; keine erfassten Laufzeit-/Ressourcen-/Log-/GL-Fehler.
- Grenzen: kontrollierter Aufbau und Simulationsschritte, ergänzende Live-Sequenzen; Gegnerwellen für die Abbau-Dauertests ausgesetzt. Kein Echtgerät-, großer Armee-/Crowd-Performance-, andere Browser-/Qualitätsstufen- oder allgemeiner Engstellen-Nachweis.

## Frühere Abstandsprüfung (`5182adf`, überarbeitet)

Freie Spawnplätze und Körperabstand eingeführt. Damals 183 Node-Tests und ein Portrait-Browsercheck bestanden; trotzdem traten anschließend Worker-Stau und Zittern auf. Diese Prüfung war keine ausreichende Langzeit-Gegenverkehrsabsicherung und wird durch die obigen Fälle ergänzt.

## Rally und Portrait-Deck (`ff63503`, `c588abd`)

- Rally nur über die Menü-Schaltfläche; Boden-Tap/-Klick wählt Gebäude ab. Damals 175 Node-Tests und gezielter Portrait-`file://`-Check bestanden.
- Aufklärer entfernt, Spawn-RNG-Sample für Kristallmengen reserviert. Minimap links halbbreit, rechts Kategorien/Zurück und feste Gebäudeaktionen; Fähigkeiten dauerhaft darüber. Globale Rekrutierung verteilt auf gebundene Gebäude-Queues; aggregierte Typ-Symbole zählen Aufträge und zeigen Fortschritt/Abbruch.
- Damals 172 Node-Tests und Chromium/CDP-Touch über `file://` bei 390×844, 320×568 und 430×932 bestanden. Kontrollierte Setups, keine Echtgerät-/Desktop-/Langzeitfreigabe; die damaligen sofortigen Spawnplätze sind inzwischen ersetzt.

## Dokumentation und Arbeitsregeln (`664c2fb`)

Einzelberichte durch aktuelle Referenzen und dieses Protokoll ersetzt; risikogerechte Prüfungen und regelmäßige Bereinigung in `AGENTS.md`. Lokale Links/Anker und Diff geprüft, keine Spieltests für die reine Dokumentationsänderung.

## Zusammengefasste frühere Entwicklung

- Klassische lokale Skripte statt Inline-Monolith; Speicherung, CPU-Welt und kosmetische Effekte getrennt. Feste Referenzen schützen Terrain/RNG/Zeichenverhalten. Skybox-Einbettung, MSAA und modellfeste Texturen umgesetzt; damalige Chromium-GPU-Prüfungen waren positiv, keine aktuelle vollständige Grafikfreigabe.
- Desktop-Kamera, Hotkeys, Rechteck-/Shift-Auswahl, Kontrollgruppen, Befehls-Auftragsketten, Bauhilfe, Forschung und Tooltips entfernt. Arbeitergestützte Gebäude-Reparatur und bestätigter Verkauf ergänzt.
- `cbd37f2`: wiederholbare HQ-Gefechte statt Kampagne/Sondermodi; kostenlose permanente Test-Upgrades. `3e7705d`: Dreifachtap für sichtbare Nicht-Worker, Timing nur kontrolliert geprüft.
- `71952f3`: Schwierigkeit entfernt, frühere Standard-Regeln fest, Checkpoints v3. Drei 120-s-Vergleiche entsprachen nach Normalisierung dem vorherigen Standard-Zustand samt Effekten/Folge-RNG.
- `7f81c48` bis `565b108`: Hinweisleiste, Dekoration und sechs Befehlsbuttons entfernt; Boden-Tap auf Attack-move (Worker: move), Deck randbündig/rahmenlos. Damals 170 Node-Tests und fünf Chromium-Viewportchecks bestanden; durch spätere Umbauten als UI-Nachweis überholt.

Offene Punkte: [Spiel und Bedienung](gameplay.md#offen-nicht-zur-umsetzung-freigegeben) · [technische Risiken](architecture.md#schutzgrenzen-und-offene-architekturfragen).
