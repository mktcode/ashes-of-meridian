# Karten betrachten und Szenen aufnehmen

## Interaktiver Kartenbetrachter

Nach `npm run build` **`map-viewer.html` direkt öffnen**. Kein Server, Browserprofilzugriff oder laufendes Gefecht nötig. Optional direkt adressieren:

```text
map-viewer.html?map=westmark&seed=93401206
```

Die kleine Werkzeugleiste wählt Kartenfamilie und Seed, lädt erst auf Bestätigung, erzeugt einen Zufallsseed und bietet Gesamtansicht, Kamera-Reset, Distanzdunst, Tageszeit-Slider (00:00–23:59) und JSON-Rezeptexport. **Map boundary** schaltet einen gestrichelten, geländefolgenden Rahmen der tatsächlichen Kartenfläche (±Karten-Extent, ohne Außenkulisse) ein/aus. Im Viewer ist er zunächst an, bei automatischen Aufnahmen standardmäßig aus; die Wahl bleibt beim Seedwechsel bestehen und wird mitexportiert. Der Rahmen ist eine gut sichtbare 2D-Annotation, auch über verdeckenden Hügeln, keine Änderung der Bau-/Bewegungsgrenzen.

Der Slider ändert die Beleuchtung sofort, ohne die Simulation zu starten; eine selbst gewählte Uhrzeit bleibt bei Karten-/Seedwechseln erhalten und wird mitexportiert. Sie lässt sich ausblenden und wieder einblenden. Ungültige explizite Eingaben und Generierungsfehler werden gemeldet, nicht durch einen Ersatzseed verdeckt. Der HTML-Einstieg leitet in einen isolierten Modus von `index.html` weiter; es gibt keinen zweiten Renderer oder Terrain-Generator.

Die normale Maus-/Touchbedienung bleibt: Rechtsmaus-/Ein-Fingerziehen verschiebt, Mittelmausziehen/Zwei-Fingerdrehen dreht, Rad/Pinch zoomt. Ohne Einheiten lässt sich außerdem mit der linken Maustaste verschieben. Zoom und Verschieben sind auf die feste, bis zum Rand dekorierte Geländeausdehnung begrenzt. Auch bei gedrehter Kamera dürfen die Bildschirmecken nicht über das Gelände hinausblicken. Das Umfeld ist nicht spielbar. Reset wählt die größtmögliche Kartenübersicht im normalen Spielwinkel; je nach Fensterformat, Drehung und Höhen kann nicht die gesamte spielbare Fläche gleichzeitig im Bild liegen. Eine aktive Übersicht wird bei Resize neu eingepasst; auch manuelle Ansichten werden bei Bedarf wieder innerhalb der Geländegrenzen gehalten. Freie technische Orbit-/Look-at-Capture-Kameras bleiben davon unabhängig.

Die Landschaft enthält Terrain, Wirtschaftsressourcen und Kulisse, aber keine Einheiten/Gebäude oder Versorgungskisten. Vollständige Sicht, stillstehende Simulation und getrennte Kameraeingaben: kein Kampf, keine KI, Expedition, Auszahlung, Autosave oder normaler Profilzugriff. Distanzdunst und kosmetische Randverblendung sind standardmäßig aus. Vollständige Sicht deaktiviert auch die Grafik-Sichtnebelabdunklung außerhalb der spielbaren Fläche; das Umfeld bleibt gleichmäßig beleuchtet. Die normale Spielansicht behält ihre Sichtnebel-/Randdarstellung. Die statische Welt wird nur bei Vorbereitung, Kamera-/Viewport-/Darstellungsänderungen neu gezeichnet.

**Export recipe** lädt ein JSON mit der tatsächlich aufgelösten 3D-Kamera herunter, auch wenn der Bildmittelpunkt außerhalb der Karte liegt. Dieses Rezept ist direkt im Capture-Werkzeug verwendbar. Karte und Seed bestimmen gemeinsam die Landschaft im festen Zwei-Parteien-Kontext des Szenenrunners; das ist keine Rekonstruktion beliebiger aktueller Kampagnenwelten. Gleiche Seeds konservieren keine Landschaft über verschiedene Generator-/Buildversionen hinweg.

### Kartendiagnose

**Map diagnostics → Analyze map** untersucht die fertige CPU-Oberfläche rein lesend. Ohne Anforderung entsteht kein zusätzlicher Analyseaufwand. Danach werden Ergebnisse und geländefolgende Annotationen pro Welt wiederverwendet; Kamerabewegung projiziert nur die gespeicherten Punkte. Ein Diagnose-Ebenenwechsel zeichnet ausschließlich die 2D-Annotationen neu, nicht die 3D-Welt. Beim Karten-/Seedwechsel wird eine bereits aktivierte Analyse erneuert, bei fehlgeschlagenem Laden verworfen. Alle Ebenen sind einzeln abschaltbar:

- **Connections:** größtes radius-6-freies Netz grün, andere breite Komponenten orange; schmale, nur für Einzelkörper nutzbare Flächen bleiben ungefärbt.
- **Cliffs:** permanente Terrain-Klippen rot.
- **HQ terrain sample:** geeignete/ungeeignete HQ-Mittelpunkte im 10-Einheiten-Raster, mit dem tatsächlichen HQ-Radius und der normalen CPU-Fundamentprüfung. Nur Terrain: Ressourcen, Belegung, Sicht und Kosten werden nicht geprüft; keine Bauzusage.
- **Resolved routes and anchors:** geländefolgende Wirtschaftsverbindungen, Kristalle, Echo-Vents und HQ-Anker; ausgewählter Link gelb. Keine nachverfolgten Einheitenwege oder exakten Positionen der Reparaturrampen.
- **Original straight links:** unveränderte Graph-Kanten gestrichelt weiß, zum Vergleich mit den aufgelösten Trassen. Beide Geometrien werden auf dem aktuellen Terrain gezeichnet, nicht auf zwei verschiedenen Welten.
- **Terrain changes:** Abtrag orange, Auffüllung violett ab 0,5 Höheneinheiten gegenüber dem wirtschaftlich gestützten Gelände **vor** den Korridoren; einschließlich abschließender Reparaturrampen, nicht gegenüber einer unberührten Naturlandschaft.
- **Start candidates:** öffentliche Kandidaten weiß, die beiden ursprünglichen Viewer-Landungen gelb. Keine Vierparteienzuteilung oder Startfairnessbewertung.

**Height profile** wählt einen Wirtschaftslink; das Diagramm zeigt entlang seiner aufgelösten Weglänge das vorherige wirtschaftlich gestützte Feld, das geplante Trassenfeld und die endgültige CPU-Höhe. Auswahl und Kamera zeichnen nur gespeicherte Werte neu. Geometrie, Umwegfaktor, befahrbarer radius-6-Kern, geschätzte Längsneigung, Suchdurchläufe und Reparaturzahl stehen auch im JSON. Profilneigungen sind Stichproben, keine maximalen Dreieckssteigungen.

Abtrag/Auffüllung und absolute Geländeänderung sind Raster-Volumenschätzungen an den Weltraster-Mittelpunkten. Der zusätzliche **straight datum reference** wertet den Gerade-/Datum-Wegansatz mit aktuellen Wirtschaftsstützen und denselben bereits gezogenen Natur- und Schulterparametern aus, aber **ohne** Anschlussreparaturen, Startsuche oder Ökologie. Er ist keine nacherzeugte alte Generatorversion und kein Vergleich zweier vollständig geprüfter Welten. Diese lesende Gegenprobe und die Erzeugungsmetadaten sind flüchtig, kein Snapshot-/Navigationszustand. Das aktuelle Terrain und seine Regeln bleiben maßgeblich.

Der Bericht nennt Höhenbereich, Klippenanteil, breite/Fahrzeug-Komponenten, verbundene Innenfläche einschließlich neun Sektoren, Wirtschaftsanschlüsse und HQ-Stichproben. Der Anteil des größten Netzes bezieht sich auf die beim jeweiligen Radius freien Zellen, nicht die gesamte Kartenfläche. Landungsabstände zu Ressourcen sind Luftlinien. Warnungen vergleichen statische Merkmale mit den bestehenden Generatorgrenzen; erfüllte Grenzen beweisen weder dynamischen Gruppenverkehr, Walling noch Balance.

**Export report** speichert einen separaten JSON-Bericht mit Karte, Seed, aufgelöstem Rezept, Kennzahlen, Aussagegrenzen und Buildkennung. Diagnoseebenen sind reine, auch über verdeckendem Terrain sichtbare 2D-Annotationen. Sie verändern weder Welt/RNG noch Profil und gehören nicht zum Capture-Rezept; **Export recipe** bleibt ein Landschafts-/Kamerarezept ohne Diagnoseebenen. Bildwirkung und Bedienkomfort auf Zielgeräten benötigen menschliche Abnahme.

## Automatisierte Aufnahmen

```bash
npm run capture:scene -- --map westmark --seed 93401206 --content landscape --fit map --no-distance-mist
npm run capture:scene -- --scene scripts/scenes/map-overview.json --output .tmp/map-overview
npm run capture:scene -- --scene /pfad/zum/viewer-export.json --reuse-build --output .tmp/viewer-capture
npm run capture:scene -- --map random --count 3 --selection-seed 123 --content landscape --fit map
npm run capture:scene -- --map desert --seed 1409 --camera-mode orbit --projection perspective --pitch 0.45 --yaw 1.2 --fit map
```

Standardmäßig einmal bauen, Browser einmal starten und pro Szene die Welt einmal vorbereiten. Mehrere benannte Ansichten derselben Szene verwenden dieselbe Welt; Kartenwechsel verwenden denselben Browser und dieselbe Seite, setzen jedoch Szenen-/Viewzustand zurück. Höchstens 16 Szenen, 32 Ansichten je Szene und insgesamt 64 Bilder pro ausdrücklich gestarteten Lauf. Das ist keine Freigabe für breite Agenten-Screenshotserien.

`--reuse-build` prüft sowohl die Sourcekennung des letzten Builds (`dist/capture-source.json`) als auch die Runtime-/Assetkennung. Fehlende oder veraltete Builds werden abgewiesen. `node scripts/scene-capture.mjs --help` benötigt weder Build noch Browser. Der reine Rezeptvalidator verwendet über Node 24s TypeScript-Stripping denselben Quellvertrag wie die klassische Browserruntime; dabei kann Node eine ExperimentalWarning ausgeben.

Installiertes Chromium/Chrome erforderlich; `CHROMIUM_PATH` wählt ausdrücklich den Browser und ein ungültiger Pfad wird nicht still ersetzt. `--angle gl`, `--headed` und `--require-hardware` sind optional. Hardwareklassifizierung verwendet Treiberstrings, keinen unabhängigen Gerätenachweis. Sandbox und `file://`-Sicherheit bleiben unverändert; kein Browserdownload oder Server. Phasen-Timings und Grafikbackend stehen in der Ausgabe, Software-WebGL ist kein Geräteperformancebeleg.

### Parameter und Vorrang

Defaults → Rezept/Szenendefaults → benannte Ansicht → ausdrückliche CLI-Overrides. `--scene` liest ein Szenenrezept einschließlich Viewer-Export; `--batch` liest ausschließlich `{ "scenes": [ ... ] }`. Diese Eingaben schließen sich aus. Ohne Datei gelten direkte Karten-/Seedparameter; ohne Seed wird ein neuer gültiger Seed gewählt und dokumentiert.

`--map random --count N` wählt Karten ohne Wiederholung bis der Katalog einmal ausgeschöpft ist, dann beginnt eine neue Auswahlrunde. `--selection-seed` macht ausschließlich diese Auswahl reproduzierbar und ist keine Simulations-RNG. Für genau einen festen Landschaftsseed `--seed` verwenden, nicht zusammen mit `--count > 1`.

CLI: Karte/Seed, `--content`, `--fit`, `--camera-mode`, `--projection`, `--x/--z`, `--zoom`, `--yaw/--pitch`, `--distance`, `--fov`, `--eye/--target/--up x,y,z`, `--hour`, `--width/--height`, `--dpr`, `--quality`. Booleanoptionen mit positiver oder negativer Form: `--units/--no-units`, ebenso `buildings`, `effects`, `caches`, `guides`, `distance-mist`, `horizon-mist`, `map-boundary`, `hud`, `reveal`. Explizite CLI-Kameramodi ersetzen den bisherigen Modus; ein Fit-Override ersetzt vorherige explizite Rahmung. Widersprüchliche gleichzeitig angegebene Parameter werden abgewiesen.

### Szenenrezept

[Modellbeispiel](../scripts/scenes/model-lineup.json), [Landschaft mit drei Ansichten](../scripts/scenes/map-overview.json). Grundfelder:

- `map`, `seed`: technische Katalog-ID und ganze Zahl 1–99999999; unbekannte Karten sind Fehler.
- `content`: `landscape` ohne Start-Einheiten/-Gebäude, `landing` als Standard mit Landungsworkern, `arranged` ohne Start-Einheiten/-Gebäude, aber mit den angegebenen Objekten. Terrain/Ressourcen bleiben unverändert; Landschaft mit zusätzlichen Einheiten/Gebäuden ist widersprüchlich und wird abgewiesen.
- `faction`, `enemy`: 0–2, Standard 0 gegen 1.
- `entities`: höchstens 200 arrangierte Einheiten/Gebäude, jeweils `kind`, technischer `type`, `team` 0/1, `x/z`, optional `rot` und `anchor`. `anchor` ist `world` (Standard), `player` oder `enemy`. Landungsanker werden vor einer Entfernung gesichert. Gebäude werden arrangiert, nicht bezahlt/gebaut; Einheiten nutzen normale lokale Spawn-Platzsuche. Ergebnis enthält tatsächliche Positionen. Kein Balancing-/Bauzulässigkeitsnachweis.
- `camera`: unten beschriebener Kameravertrag. Ohne Kamera Gesamtansicht im Spielwinkel.
- `render`: booleans `units`, `buildings`, `effects`, `caches`, `guides`, `mapBoundary`, `distanceMist`, `horizonMist`, `hud`. Renderfilter entfernen keine CPU-Entitäten und verändern keine Belegung/Sicht/RNG. Verborgene Gebäude liefern auch keine Fundamente, Straßen, Siedlungsverkehr oder Schatten. Standardmäßig Einheiten/Gebäude/Effekte sichtbar, Hilfsmasken/Kartenrahmen/HUD aus; Landschaft zusätzlich ohne Kisten, Distanzdunst und kosmetische Randverblendung (`horizonMist`).
- `reveal`: Standard `true` für vollständige Sicht, `false` für normale Spielersicht. Deaktiviert bei vollständiger Sicht den Grafik-Sichtnebel auch im Umfeld. Unabhängig von Distanzdunst und kosmetischer Kulissen-Randverblendung.
- `hour`: feste Render-Tagesstunde 0 bis kleiner 24; sonst seedbasierte Startzeit. Keine Änderung von Simulation oder RNG.
- `width/height`: 64–4096, Standard 1920×1080, ganze Pixelmaße der Ausgabe bei Browser-DPR 1. `dpr`: interne High-Quality-Renderauflösung 0,5–2, nicht zusätzliche Ausgabepixel; `quality`: 0–2, niedrigere Qualitätsstufen behalten ihre reduzierte interne Renderauflösung.
- `hud`: Kurzform für HUD, hat Vorrang vor `render.hud` innerhalb derselben aufgelösten Ansicht.
- `shots`: optional 1–32 benannte Ansichten. Jede kann `camera`, `render`, `reveal`, `hour`, `width/height`, `dpr`, `quality`, `hud` überschreiben. Kamera wird als vollständiger Modus ersetzt, Renderoptionen werden einzeln überlagert. Änderungen einer Ansicht dürfen nicht in die nächste auslaufen. Namen ausschließlich Buchstaben/Ziffern/Bindestrich/Unterstrich, eindeutig je Szene.

### Kamera

Alle Winkel in Radiant. Yaw 0 blickt vom positiven Z-Rand, π/2 vom positiven X-Rand. Pitch 0 ist horizontal, π/2 senkrecht von oben. Endliche, gültige Werte und nicht entartete Vektoren sind erforderlich.

| Modus | Felder und Bedeutung |
| --- | --- |
| `game` (Standard) | `x/z` als Geländefokus, optional `anchor`, `yaw`, orthografische `zoom`-Bildhöhe. Normaler Spielkamerawinkel, aber Betrachtungszoom/-grenzen. |
| `orbit` | `target: [x,y,z]` (Standard Ursprung), `yaw`, `pitch`, `distance`; `projection: orthographic` mit separater `zoom`-Bildhöhe oder `perspective` mit vertikalem `fov`. |
| `lookAt` | Explizite `eye`, `target`, optional `up` (Standard Welt-Y), orthografische Bildhöhe oder perspektivischer FOV. Up darf nicht parallel zur Blickachse sein. Für senkrechte Draufsicht z. B. `[0,0,-1]` verwenden. |

`game` und `orbit` können statt expliziter Rahmung `fit: map|entities` und optional `padding` 0–1 verwenden. Fit und `zoom/distance` schließen sich aus; `lookAt` hat keinen Fit. Karten-Fit berücksichtigt spielbare Fläche, Höhen und konservative Dekor-/Objekthüllen im Kameraraum, Yaw/Neigung, Projektion und Viewport-Seitenverhältnis. Außenkulisse ist ausdrücklich nicht Teil der Fit-Punkte. Im Modus `game` begrenzt anschließend die endliche Geländeausdehnung den Ausschnitt; die Geländedeckung hat Vorrang vor vollständiger Einpassung aller Fit-Punkte. Entities-Fit benötigt sichtbare Einheiten/Gebäude. Orthografisch wird Bildhöhe, perspektivisch Abstand bei festem FOV gelöst.

`near/far` optional, mit gültigem Abstand und `far > near`. Augenabstand und Bildausschnitt sind bei orthografischen Betrachtungsansichten getrennt. Ein ganz flacher Blick oder eine Kamera unter Terrain erzeugt keine neuen Innenflächen; Terrain bleibt eine einseitige Höhenoberfläche. Spielkamerastandards bleiben unverändert. Explizite Clippinggrenzen können trotz Fit Teile abschneiden; extrem große Koordinaten/Abstände bleiben durch Gleitkommapräzision begrenzt.

## Ausgabe, Lebenszyklus und Grenzen

Ohne `--output` entsteht ein neues Verzeichnis im eigenen `.tmp/`. Explizite Verzeichnisse müssen neu sein und innerhalb des eigenen `.tmp/` oder `release/itch-media/` liegen; Symlink-Eltern und bestehende Ausgaben werden abgewiesen. Ein `.webp`-Dateipfad ist nur für genau ein Bild zulässig und benötigt ebenfalls ein neues Elternverzeichnis. Nach Ende wird nur eigenes Browser-/Hilfsscratch aufgeräumt, Bildbelege bleiben erhalten.

Pro Bild WebP Qualität 80 und JSON: aufgelöstes Rezept/Ansicht, Anker/Platzierungen, tatsächliche Kamera und Matrix, Viewport/interne Auflösung, Optionen, Simulationszustand, Buildkennung, Browser und Grafikbackend. Erfolgreicher Gesamtindex erst nach dem vollständigen Lauf; Teilresultate bei späteren Fehlern bleiben erhalten. PNG ist nur im Speicher Zwischenschritt für Chromiums WebP-Encoder.

Vor Aufnahme werden Ressourcenbereitschaft und ein nach der konkreten Anforderung gerenderter Frame geprüft, nicht eine feste Schlafdauer. Simulation bleibt bei Zeit 0; kosmetische Renderzeit ist fixiert. Browser-/Konsolen-/GL-Fehler und unerwarteter Zustand brechen ab. Timings unterscheiden Build, Browserstart, App-Laden, CPU-/View-Weltvorbereitung, Materialbereitschaft, Frame, Screenshot und Encoding. Die virtuelle Uhrverschiebung des älteren Einzelrunners war keine reale Minute Wartezeit.

`capture:itch` bleibt ein eigener Marketingworkflow mit laufenden arrangierten Feuergefechten und Kompositionen. Er nutzt gemeinsamen Browser-Harness sowie den stillen Kamera-/Renderpfad nach seinem begrenzten Kampfzeitfenster; optional `--camera camera.json`, `--hour`, `--no-units`, `--no-buildings`, `--no-distance-mist`. Der Echtzeit-[Diagnoserunner](diagnostic-capture.md) behält dagegen seine frischen Fälle, normale Sicht und echte Zeit samt bestehendem einfachen Szenenvertrag. Keine stille Umwandlung von Messläufen in statische Capture-Batches.

Kurze CPU-Verträge: `tests/ashes-of-meridian-capture.check.cjs`, bestehende Szenen-/Capture-Ausgabe-/Renderer-/Buildkennungsfälle. Echte Browserchecks nur für konkrete Lade-/Navigations-/Projektionsfragen. Gleiches Rezept ist innerhalb desselben Builds reproduzierbar, aber keine pixelgenaue Browser-/GPU-Garantie. **Visuelle und Echtgeräteabnahme bleiben menschlich.**
