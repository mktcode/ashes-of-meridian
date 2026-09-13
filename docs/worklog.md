# Arbeitsprotokoll

Kompakter Übergabestand und letzte Prüfnachweise. Ältere Implementierungs-, Diagnose- und Refactoringprotokolle liegen in Git. Neue Einträge kurz halten; Regeln und offene Prioritäten direkt in den Referenzdokumenten pflegen.

## Alle Gebäude: mechanische Auslagerung

- Weitere 18 Gebäudeassemblierungen in eigene Fraktion-/Typdateien ausgelagert. Alle 21 Gebäude laufen durch die Registry; Einheiten/Ressourcen bleiben unangetastet. Zentraler Gebäudekontext ergänzt Basisrotation für den zielenden Turmkopf und optionales Effektring-Glow für unveränderte Fraktion-2-Orbitale. Noch keine visuelle Änderung.
- **Geprüft:** Build; 63/63 gezielte Modell-/Harness-/Präsentationstests; alle 756 Zeichenvarianten, fünf vorhandene Meshfabriken/Barracks und drei kontrollierte 20-s-Fraktionsruns samt RNG/Schüssen identisch. Chromium `file://`: alle 21 Gebäude pixelidentisch zum vorherigen Dispatcher, GL 0, keine Lade-/Laufzeitfehler. Die vollständige Suite und breite Zustandssichtung folgen auf Benutzerwunsch gebündelt nach dem Detailpass; kein Docker-Neubau.

## Factory/Hangar: verfeinerte Produktionsgebäude

- Nach der zeichnungsidentischen Auslagerung (`58088fc`) zwei eigene Hüllen umgesetzt: Factory mit gepanzerter Montagebucht, Kühlbänken, Hohlstutzen und Fachwerkkran; Hangar mit gestuftem Hex-Flugdeck, Anfluglichtern und Kontrollturm. Je 21 Instanzen; Hüllen 1.648/1.640, komplette Modelle 1.984/1.976 Dreiecke. Nur beide zugehörigen 320×320-WebP-Portraits erneuert (Qualität 80). Vorhandenes Meshkit/Registry/Renderer und die freigegebene Barracks unverändert; gemeinsamer Produktionsgebäude-Testvertrag ergänzt.
- **Geprüft:** `npm test` **267/267 bestanden**; nur 36 Factory-/Hangar-Varianten ändern sich. 720 übrige Zeichenvarianten, bestehende Meshes einschließlich Barracks und drei kontrollierte 20-s-Fraktionsruns samt RNG/Schüssen identisch; sämtliche Fixtures unverändert. Diff, Dokumentationslinks und vollständige WebP-Dekodierung geprüft.
- **Chromium `file://`:** einmaliger Hüllupload, Nahansichten/Spieler/Gegner/Teilbau/Ghost in Performance/Balanced/High gesichtet, beide neuen Portraits 320×320 geladen, GL 0 und keine Lade-/Laufzeitfehler. Bei 390×844 mit emuliertem Touch Baumenü gesichtet und beide Platzierungsmodi mit kontrolliert bereitgestellten Voraussetzungen geöffnet. Seed-1409-Szene mit 132 Entitäten, je einer Spieler-Factory/einem Hangar, Zoom 57 bei 1280×800 vor/nachher gesichtet: 172.042 → 175.298 Dreiecke, Modell-/Terrainchargen Performance 28 → 30, Balanced/High 54 → 58 einschließlich Schatten, ohne Vollbildpässe.
- **Messgrenzen:** Software-WebGL, jeweils 3 Warmup-/20 Messframes via RAF mit Pixel-Readback: Performance 8,50 → 8,24 FPS, Balanced 3,17 → 3,11, High 3,20 → 3,05. Kurzer readbackbelasteter Headless-Vergleich, kein belastbarer Echtgeräte-/Langzeitnachweis. Nur bekannte Software-WebGL-Warnungen; keine Sicherheitsflags gelockert, keine vollständigen Runs oder öffentliche Auslieferung geprüft.

## Factory/Hangar: mechanische Auslagerung

- Fraktion 0 / building / factory und hangar in getrennte Modelldateien verschoben; vorhandene Registry, Meshhilfen und Renderer-Laufzeit unverändert. Gemeinsame Zeichenisolation aus dem Barracks-Test gelöst, freigegebene Barracks-Zeichenfolge aus `19dd176` zusätzlich festgehalten. Noch keine neue Gestaltung oder Portraitänderung.
- **Geprüft:** `npm test` **265/265 bestanden**; alle 756 Varianten, bestehende Meshes einschließlich Barracks sowie drei kontrollierte 20-s-Fraktionsruns/RNG/Schüsse identisch. Chromium `file://`: beide isolierten Modelle pixelidentisch zum alten Dispatcher, Spieler/Gegner/Teilbau/Ghost in allen drei Qualitätsstufen, beide Portraits 320×320 geladen, GL 0 und keine Lade-/Laufzeitfehler. Factory 18 Instanzen/368 Dreiecke, Hangar 19/336; nur bekannte Software-WebGL-Warnung, keine Sicherheitsflags gelockert. Gestaltung folgt separat.

## Modellpilot: detaillierte Barracks von Fraktion 0

- Nach der separaten mechanischen Migration (`248a15c`) nur die eigene Barracks-Datei verfeinert: geschlossene Panzerhülle, Truppenschleuse, Seitenmodule, Kühlgitter und Dachdetails. Hülle 1.392 Dreiecke; fertiges Modell 12 Teilinstanzen/1.620 Dreiecke statt 15/304. Das zugehörige 320×320-Portrait aus dem tatsächlichen Modell in Balanced ohne Welt/Himmel erneuert, WebP-Qualität 80; alle anderen Assets unverändert. Modellworkflow und Auswertung stehen in der Grafikreferenz; Pilotissue abgeschlossen und entfernt.
- **Geprüft:** `npm test` **263/263 bestanden**, darunter Geometrie/Normals/Bounds, deterministische Erzeugung, keine Frame-Meshallokation, Bau-/Team-/Yaw-/Tint-/Alpha-/Layer-/Materialvarianten. Nur die 18 Fraktion-0-Barracks-Zeichenvarianten ändern sich; 738 übrige Varianten, fünf vorhandene Meshfabriken und drei kontrollierte 20-s-Fraktionsruns samt RNG/Schüssen identisch. Alle vorhandenen Fixtures einschließlich der neuen Ausgangs-Modellreferenz unangetastet.
- **Chromium `file://`:** Nahansichten, Gegner, Teilbau und Ghost in Performance/Balanced/High gesichtet; einmaliger Hüllupload, erneuertes 320×320-Portrait im Baumenü, GL 0 und keine Lade-/Laufzeitfehler. Zusätzlich 390×844 mit emuliertem Touch: Portrait/Baumenü gesichtet, Barracks-Aktion öffnet den Platzierungsmodus. Kontrollierte ausgebaute Seed-1409-Szene mit 131 Entitäten (davon eine Spieler-Barracks), Standardzoom 57 bei 1280×800 vor/nachher gesichtet: 170.390 → 171.706 Szenendreiecke; Modell-/Terrainchargen Performance 27 → 28, Balanced/High 52 → 54 inklusive Schatten, ohne Vollbildpässe.
- **Messgrenze:** jeweils 3 Warmup-/20 Messframes mit `requestAnimationFrame` und synchronisierendem Pixel-Readback auf Software-WebGL: Performance 7,66 → 8,63 FPS, Balanced 3,33 → 3,27, High 3,24 → 3,29. Das ist ein kurzer, readbackbelasteter Headless-Vergleich, kein belastbarer Speedup/Regressions- oder Echtgerätetest. Nur bekannte Software-WebGL-Warnungen, keine Sicherheitsflags gelockert; keine vollständigen Runs oder öffentliche Auslieferung geprüft.

## Modellpilot: mechanische Barracks-Auslagerung

- Kleine synchrone Registry und getestete CPU-Meshhilfen eingeführt; Fraktion 0 / building / barracks als eigene Modelldatei, unveränderte Plattform/Baugerüste im Adapter. Explizite HTML-/Testladereihenfolge und getrennte Modelltests; kein Gameplay-/Assetwechsel.
- **Geprüft:** `npm test` **262/262 bestanden**; 756 Zeichenvarianten gegenüber `d4689d2`, fünf bestehende Meshfabriken und drei kontrollierte 20-s-Fraktionsruns einschließlich RNG/Schüssen identisch. Neue separate Modellreferenz aus dem Ausgangscode, bestehende Fixtures unangetastet.
- **Chromium `file://`:** isolierte fertige Barracks pixelidentisch zum Ausgangscode; normal/Gegner/im Bau/Ghost in allen drei Qualitätsstufen, Portrait 320×320 geladen, GL 0 und keine Lade-/Laufzeitfehler. 15 Instanzen/304 Dreiecke; 8 tatsächliche Modell-Draw-Calls mit Schatten, 4 ohne. Nur bekannte Software-WebGL-Warnung; keine Sicherheitsflags gelockert, kein Echtgerätetest. Detailmodell ist der nächste getrennte Schritt.

## Field-Manual-Test aktualisiert

- Veraltete Erwartungen an drei bereits bewusst entfernte Langformulierungen durch Prüfungen der aktuellen kompakten Touch-Anleitung ersetzt: normaler Ziel-Tap, Attack-move/Rückzug, Worker-Ausnahme, Pan/Pinch und Doppeltap. Nur Regressionstest und Protokoll geändert; Handbuch, Bedienung und Laufzeitcode unverändert.
- **Geprüft:** `npm test` inklusive Build **257/257 bestanden**; Diff-Prüfung erfolgreich. Kein Browsercheck nötig, da keine ausgelieferte Datei geändert wurde.

## Neutrale Biome-IDs und Portraitpfade

- Alle fünf Biome verwenden `biome0`–`biome4`; Namen, Reihenfolge, Parameter und Eruptionsereignis unverändert. 14 Portraits nach `faction-<id>-<unit|building>-<type>.webp` umbenannt, bytegleich gegen Git geprüft. ID-/Pfadkonventionen in Architektur/Grafikreferenz; keine Aliase, neue Assetpipeline oder Profilmigration.
- **Geprüft:** `npm test` inklusive Build **256/257**; einzig der schon im Ausgangslauf fehlschlagende Field-Manual-Test (`Move (default)`) bleibt unverändert rot. Geänderte Katalognamen, alle Biomauflösungen und die weiterhin ausschließlich an `biome4` gebundene Eruption geprüft. Fixture-Diff enthält nur 16 umbenannte Biomeingaben, sämtliche Seeds/Hashes/Effekt-/RNG-Erwartungen unverändert. Vergleich mit Ausgangsbuild erneut identisch für 756 Modellvarianten, fünf Mesh-Fabriken und drei kontrollierte Fraktionsruns. Textur-Generatorcheck, Diff und Dokumentationslinks geprüft.
- **Chromium `file://` und Container-HTTP:** alle fünf Biome gestartet, alle 14 Portraits in vier Kategorien als 320×320 geladen; geänderte Testnamen lassen Pfade unverändert, andere Fraktion bleibt bei Icons. Gefechts-/Portraitansichten bei 1280×800 und 390×844 gesichtet, GL 0 und keine verknüpften Lade-/Laufzeitfehler. Docker erfolgreich gebaut, gesund als UID 101; `nginx -t`, bytegleiche Auslieferung aller Portraits als `image/webp`/`no-cache` und 404 für alte/fehlende Pfade geprüft. Nur Software-WebGL-Deprecation-Warnung, keine Sicherheitsflags gelockert. Kein Echtgerät-/Langzeitnachweis oder öffentliches Deployment.

## Neutrale Fraktionsbezeichner

- `b2b5ab1`: `FACTION_ID.FIRST / SECOND / THIRD` mit unveränderten Werten 0/1/2; technische Bezeichner und Modellkommentare neutral, Gegnerauswahl/Freischaltungshilfe aus Katalognamen. Kein Modell-, Balancing-, RNG- oder Profilformatwechsel.
- **Damals geprüft:** Ausgangslauf `npm test` **252/253**, danach **255/256** (derselbe Field-Manual-Fehler); 756 Modellvarianten, fünf Mesh-Fabriken und drei 20-s-Fraktionsruns/RNG identisch. Chromium `file://` bei 1280×800 und 390×844: Testnamen einschließlich `<>&`, Gegnerreihenfolge 2/1/0, kontrollierte Freischaltungen 1→2 und Profil-Reload; GL 0, keine Lade-/Laufzeitfehler. Kein Echtgerät-/vollständiger Run-Nachweis.

## Dirt-Projektion in nativer Dichte

- Die 941×1672-Dirt-Textur wird nicht mehr auf eine quadratische 83,3×83,3-m-Wiederholung verzerrt. Der Shader leitet die UV-Skalierung jetzt aus der tatsächlichen Texturgröße ab und hält auf beiden Achsen 14 Quellpixel pro Weltmeter; dadurch bleiben Seitenverhältnis und näherungsweise native Bildschirmdichte bei der Standardansicht erhalten. Beleuchtung, Schatten, Fog, Dekor, RNG und Quelldatei bleiben unverändert.
- **Geprüft:** `npm test` baut erfolgreich und erreicht **252/253**; einziger Fehler bleibt die sachfremde alte Erwartung `Move (default)` im Field-Manual-Test. Generatorcheck und Diff-Prüfung erfolgreich. Chromium `file://` mit festem Rust-Seed 1409: neue Dirt-Skalierung visuell gesichtet, Fog aktiv, GL 0 und keine Laufzeit-/Ladefehler. Kein Echtgerätetest.

## Neue Dirt-, Metall- und Bio-Texturen

- `new-dirt.png`, `new-spacehip.png` und `new-alienplanet.png` ersetzen die kanonischen Dirt-, Metall- und Bio-Quellen unter ihren bestehenden WebP-Pfaden. Konvertierung ohne Skalierung auf 941×1672 mit WebP-Qualität 80; die PNG-Eingaben wurden anschließend entfernt. Der allgemeine Pflegewert ist auf Qualität 80 angehoben, Einbettungen wurden zentral neu erzeugt.
- **Geprüft:** `npm test` baut erfolgreich und erreicht **252/253**; einziger Fehler bleibt die sachfremde alte Erwartung `Move (default)` im Field-Manual-Test. Generatorcheck, PNG-Ausschluss und Diff-Prüfung erfolgreich. Chromium `file://` mit Rust-Seed 1409 und Free-Marches-/Choir-HQ: alle drei neuen Einbettungen geladen, Dirt-/Materialwirkung visuell gesichtet, Fog aktiv, GL 0 und keine Laufzeit-/Ladefehler. Kein Echtgerätetest.

## Dirt-Boden ohne Biomtönung

- Der Bodenshader verwendet die Dirt-WebP jetzt direkt als Grundfarbe statt sie überwiegend mit den fünf Biomfarben zu mischen. Schatten, Fog of War, Entfernungsdunst, Postprocessing und die schwachen Dekoratlanten bleiben erhalten; Simulation, Terrain-RNG und Texturdatei sind unverändert.
- **Geprüft:** `npm test` baut erfolgreich und erreicht **252/253**; einziger Fehler bleibt die sachfremde alte Erwartung `Move (default)` im Field-Manual-Test. Textur-Generatorcheck und Diff-Prüfung erfolgreich. Chromium `file://` mit festem Rust-Seed 1409: kräftige Dirt-Farbe im aufgedeckten Bereich visuell gesichtet, Schatten und Fog aktiv, GL 0 und keine Laufzeit-/Ladefehler. Kein Echtgerätetest.

## Neue Dirt-Basis und WebP-only-Bildassets

- Neue nahtlose Dirt-Basis (941×1672) eingebaut. Sämtliche sechs Texturquellen, die 14 Aktionsporträts unter `assets/portraits/` und die Grafikreferenz liegen nun als WebP mit Qualität 60 vor; RGBA-Dekoralpha bleibt erhalten, keine PNG-Dateien mehr unter Versionskontrolle. `npm run embed:textures` erzeugt alle Data-URLs weiterhin bytegleich aus `assets/textures/`; `-- --check` erkennt Abweichungen. Laufzeitpfade, Docker-Allowlist, Tests und Referenzen auf WebP umgestellt.
- **Neu geprüft:** `npm test` baut erfolgreich und erreicht **252/253**; einziger Fehler ist die bereits bestehende, sachfremde Erwartung `Move (default)` an den zuvor gekürzten Field-Manual-Text. Betroffene Portraitprüfung besteht, sämtliche Einbettungen stimmen bytegleich mit den WebP-Quellen überein; Generator-Check und Diff-Prüfung erfolgreich. Chromium `file://`, 1280×800: neue Bodenwirkung gesichtet, vier Infantry-Porträts vollständig als 320×320 aus `assets/portraits/` geladen, GL 0 und keine Laufzeit-/Ladefehler. Docker nach der Verschiebung erneut gebaut; HTTP liefert den neuen Portraitpfad als `image/webp`, alter Rootpfad 404. Kein Echtgerätetest.

## Field Manual gekürzt und auf Touch ausgerichtet

- Hilfetext in `src/ui/screens.js` auf vier kurze Bereiche reduziert: Touch, Gefechtsknöpfe, Basis/Wirtschaft und Fortschritt. Rechtsklick-/Provisoriumshinweise, Wiederholungen und Detailregeln entfernt; wesentliche Schritte für Auswahl, Attack-move, Bau, Reparatur, Rally, Produktion, Upgrades und fehlende Run-Speicherung bleiben. Mit aktueller Eingabelogik und Spielreferenz abgeglichen; keine Änderung an Bedienung oder Spielregeln.
- **Neu geprüft:** Diff-Sichtung und `npm run build` erfolgreich, lokale Laufzeitausgabe aktualisiert. Auf ausdrücklichen Wunsch keine automatisierten Tests ausgeführt oder hinzugefügt; kein Browser-/Gerätenachweis für die gekürzte Ansicht.

## Last Light Relay als zweiter Gefechtstrack

- Freigegebenen Entwurf bytegleich nach `audio/music-last-light-relay.mp3` kopiert. Reihenfolge: **Ratchet Theory → Last Light Relay → Breach Protocol → Black Channel → von vorn**. Weiterhin 10 % Pegel, 10 s Startverzögerung und 10 s Pause zwischen allen Stücken; Menü/SFX unverändert. Docker-Allowlist und Referenzen auf vier Tracks erweitert; Hörentwurfsordner und Nutzerreferenz bleiben außerhalb der Auslieferung.
- **Neu geprüft:** `npm test` einschließlich Build, **252/252 bestanden** (rund 61 s), Viererfolge/Rücksprung und bytegleiche Freigaben abgesichert. Chromium `file://` und Container-HTTP bei 390×844 mit simuliertem Touch: Erststart, alle vier Dateien in gewünschter Reihenfolge, echte Endereignisse nach gezieltem Spulen, 10-s-Übergänge bei Tempo 2×, Pause/Resume, Neustart, Ergebnis und Menüreset; Pegel 0,028 bei Gesamtlautstärke 0,28, GL 0 und keine Laufzeit-/Ladefehler. Docker gebaut, gesund als UID 101, 45 Laufzeitdateien; bytegleiche MP3s, `audio/mpeg`/`no-cache`, 206-Byte-Range, echte 404 für fehlende/ausgeschlossene Assets und `nginx -t` geprüft. Diff/Links geprüft; kein neuer Hör-/Echtgeräte- oder ungespulter Langzeitnachweis, öffentliches Deployment nicht ausgeführt.

## Vierter Hörentwurf: Last Light Relay

- Separater **96-BPM-/83-s-Industrial-Dub-Entwurf** unter `music-drafts/04-last-light-relay.mp3`: Halftime-Beat, runder Bass, kurze Orgel-Echos, verstimmte Signalmelodie und drei neue generische Funkphrasen. Langsamer Aufbau, fünfsekündiger Beat-Aussetzer; keine Gitarren/Hats/Flächen, getrennte Vordergrundfenster. Neuer Offline-Generator verwendet eigene Synthese und bestehende Drum-/Flite-Funktionen, keine Aufnahme als Quelle. **Nicht eingebaut**; Spiel, Deployment, alle bisherigen Fassungen und Nutzerreferenz unverändert.
- **Neu geprüft:** Generator und byteidentische Regeneration, Python-Syntax, 255 rastergebundene Ereignisse ohne konkurrierende Vordergrundarten einschließlich Echos; vollständige MP3-Dekodierung, 82,8 s PCM, Stereo/44,1 kHz/224 kbit/s, endliche Samples ohne Clipping, etwa −15,24 LUFS/−2,14 dBTP. Hashes aller bisherigen Audiodateien unverändert; Diff/Links geprüft. Kein Spielcode geändert, daher kein neuer Build/`npm test`-/Browser-/Docker-Lauf. Technische Prüfung ist kein Hörurteil; Nutzerabnahme steht aus.

## Gefechtsmusik mit längeren Ruhephasen

- Startverzögerung und Pausen zwischen allen Tracks auf **10 Sekunden** gesetzt. Gemeinsame pausierbare Audio-Uhr; nur beendete Tracks wechseln nach der Wartezeit, Gefechtsstart/Neustart bleibt bei Track 1. Pegel weiterhin 10 %, Menüpartitur, Effekte und Dateien unverändert.
- **Neu geprüft:** `npm test` inklusive Build, **252/252 bestanden** (rund 60 s); exakte 10-s-Grenzen, Pause/Mute der Startwartezeit und Neustart während einer Wartezeit abgesichert. Chromium `file://`, simuliertes Touch: verzögerter Erststart, alle Übergänge/Rücksprung bei Tempo 2× nach echtem Dateiende (dorthin gespult), angehaltene Restwartezeit, Resume, kontrollierter Neustart, Ergebnis und Menüreset; GL 0, keine Laufzeit-/Ladefehler. Diff/Links geprüft. Kein neuer Hör-/Echtgeräte-/Docker-Nachweis; gebaute lokale Ausgabe aktualisiert.

## Gefechtsmusik leiser

- Nach Hörfeedback schrittweise auf **10 % des ursprünglichen Pegels** reduziert (Faktor 0,1 statt zuletzt 0,25). Profilregler, Menümusik, Effekte, Dateien und Playlistablauf unverändert. Regressionen prüfen 0,028 bei Gesamtlautstärke 0,28 beziehungsweise 0,04 bei 0,4 mit Gleitkommatoleranz sowie unveränderte Menü-/Effektpegel.
- **Neu geprüft:** `npm test` einschließlich Build, **251/251 bestanden** (rund 59 s), Diff gesichtet. Lokale Laufzeitausgabe aktualisiert; kein neuer Browser-/Hör-/Docker-Test für die reine Pegelskalierung.

## Freigegebene Minimalmusik als Gefechtsplaylist

- **Ratchet Theory → Breach Protocol → Black Channel**, zyklisch mit jeweils **5 s Musikpause**, auch vor Track 1. Freigegebene Minimal-MP3s bytegleich nach `audio/` kopiert, Stimmen unverändert. Ein Audioplayer, Zeitmessung über Audio-Uhr unabhängig vom Spieltempo; Pause/Musik-Aus halten Position und Restwartezeit. Menü und jeder Gefechtsstart/Neustart setzen auf Track 1 zurück, Ergebnis verstummt. Menüpartitur und SFX bleiben unverändert. Docker enthält gezielt nur die drei aktiven MP3s; alte OGG-, Referenz- und Entwurfsdateien bleiben lokal erhalten und außerhalb der Auslieferung.
- **Neu: `npm test` einschließlich Build, 251/251 bestanden** (rund 60 s). Playlistfolge/Rücksprung, exakte 5-s-Grenze, Pause/Mute/Reset, bytegleiche Freigaben, Wiedergabefehler und Start-vs.-Resume geprüft. Im Browser entdeckte Endereignis-Race behoben und abgesichert: Ein Frame vor `ended` darf die alte Datei nicht neu starten.
- **Neu: Chromium `file://` und Container-HTTP**, 390×844 mit simuliertem Touch: alle drei MP3s geladen, Übergänge und Rücksprung nach echtem Dateiende (gezielt dorthin gespult), 5-s-Wartezeit bei Spieltempo 2×, pausierte Restwartezeit und positionsgleiches Resume geprüft. Gemessener Abstand bis `playing` rund 5,6–5,8 s inklusive Browserladung/Dekodierung. Unter `file://` zusätzlich kontrollierter neuer Run, Ergebnisstopp und Menüreset; GL 0, keine Console-/Laufzeit-/Ladefehler. Docker gebaut, gesund als UID 101, 44 Laufzeitdateien, bytegleiche MP3-Auslieferung mit `audio/mpeg`/Ranges/`no-cache`, echte 404 für fehlende/ausgeschlossene Assets; `nginx -t`, Diff/Links geprüft. Kein neuer Hör-/Echtgeräte- oder vollständiger ungespulter Langzeitnachweis; Musik selbst zuvor vom Nutzer freigegeben.

## Industrial-Breakbeat-Hörentwürfe (Entwurfsphase)

- **Neue Minimal Mixes:** drei separate `-minimal.mp3`, 116 BPM/67 s. Erst nur Kick/Snare, Gitarre nach 4,1 s, Bass nach 12,4 s; Funk und Melodie später abwechselnd statt gleichzeitig mit Gitarre. Keine zusätzliche Percussion oder Gitarrendopplung; gemeinsames Achtelraster, deutlich weniger Noten. Separater Generator nutzt bestehende Sounds; Funkstimmen samt Verarbeitung/Chops/Echo unverändert. **Neu geprüft:** Ereignis-/Überlappungscheck aller Varianten (238–299 Einsätze, reines Drumintro, höchstens eine Vordergrundstimme, exakte Instrumentenraster und ursprüngliche Radioabstände/-pegel), vollständige MP3-Dekodierung ohne Clipping, rund −15,2 LUFS/−1,7 dBTP; Hashes aller bisherigen Audiofassungen unverändert. Python-Syntax, Diff und Links geprüft. Kein Spiel-/Auslieferungseingriff, kein neuer `npm test`-/Browser-/Docker-Lauf; Hörabnahme steht aus.

- Drei getrennte 116-BPM-Skizzen unter [`music-drafts/`](../music-drafts/README.md): **Ratchet Theory** (Funkbass/Swing), **Breach Protocol** (Gitarrenakzente/härtere Breaks), **Black Channel** (dunkle Funk-/Metalltexturen). Je rund 67 s als Stereo-MP3; eigene synthetische One-Shots, Saitenmodelle und lokal erzeugte generische Flite-Kommandos, keine fremden Samples. Separater Python-/FFmpeg-Generator; Spiel, bestehender Loop, Referenz-MP3 und Auslieferung unverändert.
- **Neu geprüft:** Generator ausgeführt, Python-Syntax und Diff/Links geprüft; alle drei MP3s vollständig dekodiert, 44,1 kHz Stereo, endliche/nicht übersteuerte Samples, rund −15,2 LUFS und True Peaks −3,1 bis −2,5 dBTP. Einzelregeneration von Variante 3 bytegleich. Keine Spielcodeänderung, daher kein neuer `npm test`-/Browser-/Docker-Lauf. Keine fertigen Spielloops.
- **Luftigere Vergleichsmixe nach positivem Hörfeedback:** Originale behalten, drei separate `-reduced.mp3` erzeugt. Weniger konkurrierende Hi-Hat-/Ghostnote-/Clap-/Fill-Schichten, sparsamere Metallakzente und zurückgenommene Gitarrendopplungen; Hook-/Funkpassagen bekommen mehr Platz. Bass, Melodien, Durchsagen, Hauptbeat und deren Mikrotiming unverändert. **Neu geprüft:** Ereignisvergleich aller Varianten gegen den vorherigen Generator (Originalpfad identisch; geschützte Stimmen und alle Einsatzzeiten exakt erhalten), Hashprüfung bestehender Audiodateien, vollständige MP3-Dekodierung ohne Clipping, je 67,007 s Stereo/44,1 kHz, −15,17 LUFS und −3,18 bis −2,43 dBTP. Diff/Links geprüft; kein Einbau oder neuer Spiel-/Browser-/Docker-Test. Hörvergleich der reduzierten Fassungen steht aus.

## Eigener Gefechtsmusik-Loop

- **Frontier Pressure** ergänzt: eigenständiger, lokal erzeugter 60-s-Stereo-Loop mit 128 BPM als Ogg Vorbis/44,1 kHz (rund 1,29 MB). Industrieller Beat, verzerrte Basspulse, Metallperkussion, dunkle Flächen und sparsame Signale; keine übernommene Melodie oder Arrangementstruktur des genannten Referenzstücks. `scripts/generate-battle-music.py` reproduziert die Komposition bewusst mit Python/`ffmpeg`; kein Buildschritt, Netzwerkasset oder Simulations-RNG.
- Ruhige prozedurale Musik bleibt in Hauptmenü/Gefechtsauswahl. Der neue Loop läuft nur im aktiven Gefecht; Pause/Spielmodals halten Position, Resume setzt dort fort, Ergebnis verstummt und Menürückkehr setzt zurück. Vorhandene Musik-/Gesamtlautstärke und gemeinsamer HUD-Audioknopf gelten weiter. Fehlende/gesperrte Wiedergabe blockiert das Spiel nicht und erzeugt keine Warnschleife.
- **Neu: `npm test` einschließlich Build, 248/248 bestanden** (rund 55,9 s), Audio-Modustest und OGG-Grundvertrag ergänzt. Asset geprüft: exakt 60 s, 44,1 kHz Stereo, etwa −14,9 LUFS/−2,1 dBTP, vernachlässigbarer DC-Anteil; dekodierte Regeneration bytegleich und Loopnaht mit rund 0,0005/0,0024 Amplitudendifferenz. **Chromium `file://` und Container-HTTP** bei 390×844 mit simuliertem Touch: Track vollständig dekodiert, Start/Loop/Pause/positionsgleiches Resume/Menüreset korrekt, GL 0 und keine Console-/Laufzeit-/Ladefehler. Docker gesund als UID 101, 42 Laufzeitdateien, OGG mit `audio/ogg`, Byte-Ranges und `no-cache`. Technische Analyse ersetzt kein tatsächliches Anhören; musikalische Abnahme und Echtgerätetest stehen aus.

## Statisches Docker-/Dokploy-Deployment

- Multi-Stage-`Dockerfile` ergänzt: Node 22 installiert exakt den Lockfile-Stand, baut `dist/src/` und entfernt Source Maps; ein Nginx-1.28-Alpine-Laufzeitimage dient ausschließlich `index.html`, drei Stylesheets, 23 Buildskripte und 14 Porträts als Benutzer 101 auf Port 8080 aus. `.dockerignore` begrenzt den Buildkontext. `nginx.conf` aktiviert vorab erzeugtes Gzip, Revalidierung für ungehashte Dateinamen, echte 404-Antworten und grundlegende Response-Header. Kein Backend, Volume, Profilserver oder Einfluss auf `file://`/Android.
- **Docker-Image zweimal erfolgreich gebaut**; interner `npm run build`, Nginx-Healthcheck `healthy`, 41 erwartete unkomprimierte Laufzeitdateien ohne Quellen/Tests/Maps, korrekte MIME-Typen, Gzip und 200/404-Verhalten geprüft. Laufzeit läuft als UID 101; lokales Image rund 70,9 MB. **Chromium über Container-HTTP** bei 1280×800 und simuliertem Touch bei 390×844: Auswahl lädt, Touch startet ein Gefecht, GL 0, kein Überlauf sowie keine Console-/Laufzeit- oder verknüpften Assetfehler. `file://` zusätzlich bei 390×844 unverändert geladen. Der automatische, nicht verknüpfte Browserabruf von `/favicon.ico` erhält erwartungsgemäß 404. Kein Echtgerät- oder Langzeitnachweis.
- **Dokploy-Testinstanz veröffentlicht:** [aom.markus-kottlaender.de](https://aom.markus-kottlaender.de/) dient dem Projektinhaber und ersten Playtestern; Funktion vom Betreiber bestätigt. HTTPS-Abruf zusätzlich mit HTTP 200, erwarteter Nginx-Auslieferung, `no-cache` und Sicherheitsheadern geprüft. Keine serverseitige Profil-/Run-Speicherung oder Verfügbarkeitszusage.

## Zufälliger Seed und breiter Gefechtsstart

- Seed-Eingabe samt zugehörigen Styles entfernt. Gefechtsstart und Neustart aus Pause/Ergebnis überlassen den Seed der bestehenden Zufallsauswahl in `game.start()`; Fraktionen und Biom bleiben beim Neustart erhalten. Bestätigungstext nennt das neue zufällige Schlachtfeld. Interne feste Seeds für Tests bleiben möglich, Layout-/Simulations-RNG und Fixtures unverändert. **Start battle** füllt unter der Startaufstellung die ganze Panel-Inhaltsbreite.
- **Neu: `npm test` einschließlich Build, 247/247 bestanden** (rund 62 s): automatische Seed-Auswahl bei wiederholtem Start, Auswahl-/Neustartübergaben und Layoutvertrag abgesichert. **Chromium `file://`** bei 375×667, 320×740, 1280×800 und 932×430: kein Seed-Feld, volle Buttonbreite, kein horizontaler Überlauf, Start erreichbar. Simulierte Touch-Starts aus Auswahl, Pause und kontrolliertem Ergebnis erzeugten drei verschiedene Seeds bei gleichen Fraktionen/Biom; GL 0, keine Console-/Laufzeitfehler. Screenshots, Diff und lokale Dokumentationslinks geprüft; kein Echtgerät- oder vollständiger Run-Nachweis.

## Detaillierter Free-Marches-Sentinel

- Sechskantsockel mit Ankerplatten/Schrauben, Pfeilerrippen und Drehkranz; abgeschrägter Waffenkopf mit Dachbefestigungen, Kühlgitter, Kennstreifen und gerippten Doppelläufen mit vertieften Mündungen. Zwei einmalig hochgeladene Meshes (624/1.064 Dreiecke); Sockel-/Zielausrichtung, Bau-/Teamdarstellung, Spielwerte und RNG unverändert. Nur zugehöriges Menü-PNG manuell erneuert, keine Bildautomatik eingebaut.
- **Neu: `npm test` einschließlich Build, 245/245 bestanden** (rund 35 s). Deterministische Meshgrenzen, endliche flache Normalen, nicht degenerierte Flächen/Mündungen, reine gecachte Darstellung, unabhängiger Zielwinkel für beide Teams, Baufortschritt und Vorschau abgesichert. Fixtures unverändert; 82 unbetroffene Einheiten-/Gebäude-/Teamvarianten liefern exakt dieselben Zeichenaufrufe wie zuvor. Diff und lokale Dokumentationslinks geprüft.
- **Neu: Chromium `file://`**, 1280×800 und 390×844: Nah-/Spielansichten, alle Qualitätsstufen, kontrollierte Bau-/Gegner-/Vorschau- und gedrehte Kopfvarianten sowie erneuertes Menübild gesichtet. GL 0, keine Console-/Laufzeitfehler, durch Zeichnen unveränderte Entität. Kontrollierter Schuss auf seitliches Ziel: korrekte 90°-Ausrichtung und unverändert 28 Schaden. Kein Echtgeräte-/Massenmodell-Leistungs- oder vollständiger neuer Bauablaufnachweis.

## Modellbilder für alle Free-Marches-Aktionsbuttons

- Nach Prospector/HQ jetzt alle sieben Einheiten und sieben Gebäude mit nahen Ausschnitten ihrer tatsächlichen Spielmodelle: zwölf weitere lokale 320×320-PNGs einmalig aus `renderEntity` erzeugt, die beiden vorhandenen unverändert. Keine automatische Erzeugung eingebaut; bei späteren Modelländerungen Bilder manuell erneuern. Buttonmaße, Namen, Kosten, Badges, Aktiv-/Sperrstatus, andere Fraktionen und Queue-/Kategorie-/Befehlsicons bleiben erhalten. Keine Spielmodell-/Regel-/RNG-Änderungen oder zusätzlichen Laufzeit-WebGL-Pässe.
- **Neu: `npm test` einschließlich Build, 243/243 bestanden** (rund 36 s). Vorhandenen Porträttest auf alle 14 Dateien/Aktionen sowie Alloy-/Aetherkosten erweitert. Diff und lokale Dokumentationslinks geprüft; bestehende Fixtures unverändert.
- **Neu: Chromium `file://`** bei 1280×800, 390×844, 320×740 und 932×430: alle vier Untermenüs laden sämtliche Porträts; Buttonmaße und Überlauf exakt gleich zur Linienicon-Ausgabe. Bilder und Menüansichten gesichtet. Per CDP-Touch alle sieben Einheitentypen mit korrekten Kosten in reguläre Queues aufgenommen und alle sieben Gebäudebilder bis zum aktiven Baumodus angetippt. Andere Fraktionen in allen Kategorien ohne Porträts, GL 0, keine Console-/Laufzeitfehler. Kontrolliertes Setup mit bereitgestellten Produktionsgebäuden/Ressourcen; kein Echtgerät- oder vollständiger neuer Bauablaufnachweis. Bestehender horizontaler Überlauf der Worker-Statusmeldung bei 320 px bewusst unverändert.

## Eine zusätzliche Nahzoomstufe

- Untere Kameragrenze für Plus-Button und Pinch von 32 auf 27,2 gesenkt: eine weitere Stufe mit Faktor 0,85, rund 18 % größere Darstellung. Herauszoomgrenze 115 und Schrittweiten unverändert; bestehende Grenzwert-Erwartungen und Bedienreferenz nachgeführt.
- Auf Wunsch kein Test- oder Browserlauf; Build und `git diff --check` erfolgreich. Die neuen Test-Erwartungen wurden nicht ausgeführt.

## Detaillierte Free-Marches-Worker

- Prospector als kleines Kettenfahrzeug beibehalten: abgeschrägtes Gehäuse/Sensorkopf, Kühler, sechs Laufrollen, 48 einzelne Kettenglieder, Scheinwerfer, Signallichtfassung und geriffelter Bohrkopf. Zwei einmalig hochgeladene Meshes mit 1.452/120 Dreiecken; keine neuen Assets/Shader, RNG-Aufrufe oder Bewegungsanimationen. Spielgröße, Tempo, Sammel-/Bauregeln und bestehende Frachtanzeige unverändert.
- **Neu: `npm test` einschließlich Build, 242/242 bestanden** (rund 60 s). Deterministische Meshgrenzen/Normalen, nicht degenerierte Flächen, Wiederverwendung ohne Frame-Erzeugung, Ausrichtung, Fracht-, Team-/Vorschaufarben und unveränderte Entitäten abgesichert. Bestehende Fixtures unverändert; 94 unbetroffene Modell-/Teamvarianten lieferten identische Zeichenaufrufe zum Vorgänger. Diff und lokale Dokumentationslinks geprüft.
- **Chromium `file://`:** 1280×800 und 390×844, Nah-/Spielansicht, alle Qualitätsstufen sowie kontrollierte Front-/Fracht-/Gegner-/Vorschauvarianten gesichtet. Regulär rekrutierter Worker sammelte und lieferte in 45 s kontrollierter Simulation 90 Alloy. GL 0, keine Console-/Laufzeitfehler. Software-WebGL, kein Echtgeräte-, Massenworker-Leistungs- oder neuer Bauablaufnachweis.

## Free-Marches-HQ verfeinert

- Vorlagennahe Detailüberarbeitung ohne neue Grundsilhouette: abgeschrägte Rumpf-/Dachplatten, kräftigere Seitenrippen und Eingangspfeiler, Trittstufe, Türfuge, Dachmarkierungen, Lüftungsgitter und zwei zusätzliche Antennen. Ein gemeinsames `commandHull`-Metallmesh mit 1.152 Dreiecken; Fundament, Radarrotation, Bau-/Teamdarstellung und sämtliche Spielregeln/Radien unverändert. Keine neuen Assets, Shader oder RNG-Aufrufe.
- **Neu: `npm test` einschließlich Build, 240/240 bestanden** (rund 60 s). Meshgrenzen, geschlossene konvexe Panzerteile/Normalen, Fraktionsbegrenzung, Baufortschritt, Vorschaufarbe/-transparenz und Zeichenisolation ergänzt. Bestehende Fixtures unverändert; zusätzlicher Vorher-/Nachher-Vergleich von 94 unbetroffenen Modell-/Teamvarianten lieferte identische Zeichenaufrufe. Diff und lokale Dokumentationslinks geprüft.
- **Chromium `file://`:** 1280×800 und 390×844, Nah-/Spielansicht und alle drei Qualitätsstufen gesichtet; zusätzlich kontrollierte Zeichenvarianten für Baustelle, Gegnerausrichtung und transparente Vorschau. GL 0, keine Console-/Laufzeitfehler. Software-WebGL, kein Echtgeräte-/Leistungs- oder neuer vollständiger Bauablaufnachweis.

## Detaillierter Aether Vent

- Bildvorlage als flache industrielle Panzerplattform umgesetzt: abgeschrägte achteckige Deckplatten, 16 Sockelsegmente, vier Halteklammern, Kristallfassung, zwei cyanfarbene Leuchtringe und rotierender Kristall mit sichtbaren Lichtfacetten. Ein gemeinsames Metallmesh mit 1.152 Dreiecken statt pro Frame zusammengesetzter Detailteile; keine neuen Texturen/Shader. Dampfeffekte, Ressourcenwerte/-positionen, Kollisionsradien, Raffinerieregeln und RNG bleiben unverändert.
- **Neu: `npm test` einschließlich Build, 238/238 bestanden** (rund 60 s). Ergänzte Tests sichern Meshgrenzen, nicht degenerierte Flächen/Normalen, Material-/Animationszeichnung und unveränderte Ressourcen/Dampfeffekte; bestehende Layout-/Navigations-/RNG-Fixtures unverändert bestanden. Diff und lokale Dokumentationslinks geprüft.
- **Chromium `file://`:** Nahansicht und normale Spielentfernung bei 1280×800 und 390×844 gesichtet, alle drei Qualitätsstufen geprüft; GL 0, keine Console-/Laufzeitfehler. Software-WebGL, kein Echtgeräte-/Leistungsnachweis.

## Englische HUD-Kategorien

- Verbliebene deutsche Laufzeittexte vereinheitlicht: **Buildings**, **Infantry**, **Vehicles**, **Aircraft** und **Back** erscheinen nun in Kategorien, Untermenüs, Startmeldung und Feldhandbuch. Dokumentierte UI-Bezeichnungen entsprechend aktualisiert; die deutschsprachige Projektdokumentation bleibt deutsch.
- Auf ausdrücklichen Wunsch keine Tests und kein Browserlauf. `git diff --check`, lokale Markdown-Links und Quellsuche nach den ersetzten deutschen Laufzeitbegriffen geprüft.

## Startmenü freigestellt und neu angeordnet

- **Fleet upgrades** aus der kleinen Unternavigation als zweite große, sekundäre Startaktion direkt unter **New battle** angeordnet; darunter verbleiben nur **Field Manual** und **Settings**. Der Titelblock steht oben, der Aktionsblock unten; beide liegen ohne eigenen Panelhintergrund, Außenrahmen oder Box-Shadow direkt über der Weltvorschau. Die Eyebrow und Zierlinien entfallen, **ASHES OF** steht in einer Zeile über **MERIDIAN**, die Tagline lautet **A roguelite RTS.**
- Für Fenster bis 500 px Höhe verdichtet eine reine CSS-Variante Titel, Abstände und Schaltflächen und blendet den nicht interaktiven Fuß aus; dadurch bleiben alle vier Aktionen auch bei 932×430 ohne Scrollen sichtbar.
- **Neu: `npm test` einschließlich Build, 237/237 bestanden** (rund 60 s). **Chromium `file://`:** 375×667, 390×844, 1280×800 und 932×430 geprüft; Aktionsreihenfolge korrekt, Panelstil rechnerisch `background: none`, Rahmen 0 und Schatten `none`, keine Überlappungen oder unerwarteten Scrollbereiche, GL 0, keine Console-/Laufzeitfehler. Kein Echtgerätetest.

## Permanentes Start-Alloy

- Neues erstes Fleet-Upgrade `startingAlloy`: Stufen 0–5 starten mit 250 / 300 / 350 / 400 / 450 / 500 Alloy; Einzelkosten 100 / 200 / 300 / 450 / 650 Aether. Start-Aether bleibt 0. Der beim Gefechtsstart normalisierte Profilwert wird in `game.s.meta` eingefroren, verbraucht keinen RNG und wirkt deshalb weder rückwirkend auf laufende Runs noch auf deren Layout.
- Waffenkammer-Reihenfolge, Gefechtsnotiz, Feldhandbuch, README, Gameplay und Architektur aktualisiert. Persistenz verwirft unbekannte Schlüssel weiterhin und begrenzt auch `startingAlloy` auf ganzzahlige Stufen 0–5.
- **Neu: `npm test` einschließlich Build, 237/237 bestanden** (rund 67 s). **Chromium `file://`, 430×932:** Upgrade als erste Karte mit Einstiegspreis 100 Aether gesichtet; Stufe 1 startete mit 300 Alloy, Kauf von Stufe 2 ließ den aktiven Run bei 300 und Neustart setzte 350; Profil-Reload zeigte weiterhin Stufe 2/350, GL 0, keine Console-/Laufzeitfehler. Kein vollständiger manuell gespielter Sieg oder Echtgerätetest.

## Sequenzielle Fraktionsfreischaltung

- Fortschritt von einem gemeinsamen Boolean auf `factionUnlockLevel` (0–2) umgestellt: Free-Marches-Sieg öffnet nur Verdant Choir, erst ein Choir-Sieg die Veiled Court. Ergebnis meldet jeweils genau die neu geöffnete Fraktion. Gesperrte Karten und manipulierte Startauswahl bleiben abgesichert; falsche, verlorene und wiederholte Siege überspringen keine Stufe und speichern nicht erneut.
- Profil bleibt unter `meridian.profile.v1`; das alte Feld `factionsUnlocked` wird gemäß Prototypregel nicht migriert und als unbekannt verworfen, andere gültige Profilwerte bleiben beim Laden erhalten. README, Gameplay und Architektur aktualisiert.
- **Neu: `npm test` einschließlich Build, 235/235 bestanden** (rund 65 s). **Chromium `file://`, 430×932:** initial 1/3, nach erstem Sieg 2/3 und nach zweitem Sieg sowie Reload 3/3 Fraktionen aktiv; beide Ergebnisnachrichten gesichtet, GL 0, keine Console-/Laufzeitfehler. Kein vollständiger manuell gespielter Sieg oder Echtgerätetest.

## Außenring detailliert

- Gesamter Gebirgsstand samt Testbereinigung und Android-Vorüberlegung nach Nutzerfreigabe gemeinsam zum Commit abgeschlossen. Abschließend nur Dokumentationsstatus und Diff geprüft; die folgenden Spiel-/Browsernachweise stammen aus dem unmittelbar vorherigen Prüflauf.
- Nur die äußere Mapbegrenzung verfeinert: 36.480 statt 640 Dreiecke, breite unregelmäßige Gipfel, Schultern, Rinnen, raue Hänge und eingebettetes Geröll. Dasselbe streifenfreie Material wie die Innenmassive; weiterhin ein Mesh/eine statische Charge je aktivem Pass. Fuß und Außengrenze bleiben bei ±87/±123. Innenmassive und deren Geometrie unverändert.
- **Neu: `npm test` einschließlich Build, 235/235 bestanden**, reine Testlaufzeit rund 63 s. Erweiterter Ringtest prüft auch vollständige Dreiecke an Ecken/Geröll, Nahtschluss und Polygonbudget. Abgleich aller 16 CPU-Welten: ausschließlich Ring-Materialkennung geändert, dafür gezielt 16 Platzierungsdigests angepasst; Navigation, Terrain, übrige Platzierungen und Massiv-Deskriptoren gleich. Lokale Math-Bindung reduziert VM-Mehrkosten bei identischen Meshdaten. Diff und lokale Dokumentationslinks geprüft.
- **Neu: Chromium `file://`, Rust/43015**, 430×932 und 1280×1000: Vorschau, Start, alle Randseiten, Übersicht und Nahansichten, Portrait-Ring in High/Performance; GL 0, keine Console-/Laufzeitfehler. Übersicht zusätzlich mit diagnostischer Kamera/Aufklärung. Einzelmessung der Ring-Erzeugung im lokalen Browser rund 100 ms; kein Echtgeräte-/GPU-Leistungsnachweis. Größeres Polygonbudget und Sichtverdeckung bleiben relevante Grenzen.

## Android-/Werbeoption festgehalten

- `docs/android.md` dokumentiert Capacitor/AdMob als zurückgestellte Option, Geräteprüfungen, Datenschutz und den groben Play-Ablauf; aus der Architektur verlinkt. Zuerst weitere Spielarbeit, keine Implementierung oder Monetarisierungsentscheidung.
- Nur Dokumentation: Diff und lokale Links geprüft, keine erneuten Spiel-/Browsertests. Aktuelle Store-/SDK-Vorgaben sind bei Umsetzung nachzuschlagen.

## Breite Gebirge und gezielte Testbereinigung

- Gebirgsstand abgeschlossen: geschlossener Außenring (640 Dreiecke, Gipfel bis 50 m), höhere kleine Innenfelsen und höchstens zwei breite Gebirgszüge statt der verworfenen Felsnadel. Je Massiv 11.712 Dreiecke mit verbundenen Gipfeln, Rinnen, rauen Hängen und Geröll; eigenes streifenfreies Felsmaterial aus bestehenden Texturen. CPU-Umrisse blockieren tatsächlich und erscheinen auf der Minimap. Basis-/Ressourcenabstände und verbundene Zugänge geprüft, keine Änderungen an Rohstoffmengen oder Simulations-RNG.
- Die breiten Massive dürfen Laufwege bewusst ändern. Vorher/Nachher-Abgleich aller 16 Referenzwelten bestätigt: alte kleine Felsblocker, Terrainfarben und übrige Platzierungen unverändert, zusätzliche Sperrzellen ausschließlich aus `massifGrid`. Entsprechende Platzierungs-/Deskriptor- und Navigationshashes angepasst; ursprüngliche Kleinblocker-Hashes und aktive Terrain-/Effekt-/RNG-Referenzen erhalten.
- **Neu: Chromium `file://`, Rust/43015**, 430×932 und 1280×1000: Start/Vorschau, Gesamtübersicht und Massiv-Nahansicht, High/Performance sowie Minimap gesichtet; GL 0, keine Console-/Laufzeitfehler. Gesamtübersicht diagnostisch aufgeklärt und mit weiterer Kamera, normale Kamera separat geprüft. Sichtverdeckung bleibt beabsichtigte offene Grenze; kein Echtgeräte-/Langzeitnachweis.
- Anschließend nur Tests/Dokumentation bereinigt, keine weitere Spielcode- oder Grafikänderung: CPU-Simulation ohne Renderer/Mesh-Erzeugung; Worker-Matrix von 105 auf 21 Starts reduziert (alle Stufen für jede Fraktion), Biomabdeckung separat mit fünf statt 15 Kombinationen. Terrainprüfungen ohne redundanten GPU-Adapter; vollständiger Raster-/Umrissabgleich einmal statt 16-mal. Alle 16 festen Layout-/Navigationsreferenzen, Zugangsprüfungen, echte Umwege und durchgehende Simulationsszenarien bleiben. Fog-Uploadvertrag gezielt im View-Test statt in Simulationstests.
- **Neu: `npm test` inklusive Build, 235/235 bestanden.** Reine Testlaufzeit gegenüber dem vollständigen Gebirgsstand von rund 151 auf 50 s reduziert (etwa 67 %). Keine erhöhten Zeitlimits im Projekt, keine übersprungenen Tests, keine Fixtureänderung durch die Bereinigung. Spielcode-/Fixture-Prüfsummen, Diff und lokale Dokumentationslinks geprüft. Der Versuch blieb bis zur abschließenden Nutzerfreigabe uncommittet.

## Dokumentations- und Testbereinigung

- AGENTS.md als Wegweiser mit Lesereihenfolge, Quellen/Befehlen, Schutzregeln und pausiertem Refactoring neu gefasst. README gekürzt; Gameplay-/Architektur-/Grafikreferenzen auf aktuellen HUD-, Menü- und Aether-Stand gebracht. Validierungsprioritäten statt veralteter Featurewünsche dokumentiert. Doppelte allgemeine Wegfindungsrecherche gelöscht, ausführliche Arbeitshistorie durch diesen Übergabestand ersetzt.
- Tests gezielt entschlackt: drei redundante bzw. reine Altfunktionsfälle entfernt (alte Startboni, separate Kontrollgruppen-Tastenprüfung, Kampagnen-API-Abwesenheit mit bereits abgedecktem Neustart). Starre Prototyp-Methodenzahlen durch relevante API-Prüfungen ersetzt bzw. gestrichen. Ungültige Bau-/Rekrutierungseingaben und aktuelle Grundraten weiterhin geprüft, ohne historische Typ-/Upgrade-Namen als Vertrag. Ungenutzte Effektfall-Liste und übersprungenen Boss-Waffen-Fixture-Eintrag entfernt; alle aktiven Referenzwerte unverändert.
- **Neu ausgeführt: `npm test`, 231/231 bestanden**, inklusive Build (rund 38 s). Diff, lokale Markdown-Links und gezielter Fixture-Vergleich geprüft. Kein Browserlauf: keine Spielcode-, Eingabe-, Layout-, Rendering- oder Auslieferungsänderung.

## Vorhandener, nicht erneut erhobener Nachweis

- `688b4bf`: Menügestaltung, damals 234 Tests und Chromium `file://` bei 390×844, 1280×800, 932×430 und 320×740; unter anderem Menüwechsel, Settings-Checkbox, Scrollen, Pause/Bestätigung und Ergebnis → Upgrades → Ergebnis.
- `2a2a08d`: kompaktes Dreier-HUD, damals 234 Tests und `file://` in fünf Fenstergrößen, einschließlich DPR 2; Touch für Kategorien, Workerrekrutierung/Queue-Abbruch, Rally/Scan, Tempo/Attack-move sowie Kamera- und Pausebedienung.
- Diese Nachweise stammen aus Headless-Chromium, nicht von echten Mobilgeräten. Sie belegen weder Langzeitbalancing noch GPU-Speicherbedarf, Akkulast, Tap-Timing unter Last oder allgemeine Crowd-Stabilität.

## Übergabe

Core Loop und Aether-Progression sind implementiert. Als Nächstes echte Mobilgeräte, vollständige Runs und Upgradeökonomie validieren; konkrete Reihenfolge und Grenzen unter [Gameplay](gameplay.md#nächste-schritte-und-grenzen). Breites Refactoring und weitere TypeScript-Migration bleiben pausiert. Keine neuen Systeme oder Balancingänderungen pauschal freigegeben.
