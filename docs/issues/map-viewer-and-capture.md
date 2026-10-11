# Kartenbetrachter und parametrisierte Capture-Werkzeuge

Planungsauftrag: interaktive seedbasierte Landschaftsansicht mit vertrauter Spielkamera und erweitertem Zoom sowie automatisierte Aufnahmen mit frei wählbarer Kamera und Szeneninhalt. Dieser Plan ist noch keine Implementierung oder Freigabe für breite Browser-/Simulationsläufe.

## Ziel und Nicht-Ziele

- [ ] `map-viewer.html` direkt über `file://` öffnen: Karte und Seed auswählen, Landschaft ohne Einheiten/Gebäude betrachten, mit den normalen Maus-/Touchgesten navigieren und deutlich weiter herauszoomen.
- [ ] Viewer und automatisierte Captures verwenden denselben Szenen-, Kamera- und Darstellungsvertrag; eine im Viewer gewählte Ansicht kann als Capture-Rezept exportiert werden.
- [ ] Automatisierte Werkzeuge erlauben Gesamtansichten, beliebige horizontale Richtungen, variable Neigung, orthografische und perspektivische Kameras sowie explizite 3D-Position/Zielpunkt.
- [ ] Mehrere Aufnahmen desselben Szenenzustands ohne erneuten Build, Browserstart oder Welterzeugung; verschiedene Karten/Seeds innerhalb eines begrenzten Batchlaufs.
- Keine Änderung von Spielkamerastandards, Terrain/Ressourcen, RNG-Reihenfolge, Balancing, Profilformat oder Expeditionen. Kein Karteneditor, keine Zuschauerpartie, kein Videorecorder, kein neues generisches Plugin-System und keine unbegrenzte Kameradistanz-/GPU-Zusage.

## Ausgangslage und konkrete Hindernisse

Statischer Quellabgleich, keine Laufzeitmessung:

- [Szenenfixture](../../scripts/scene-capture-fixture.mjs): `zoom` nur 5–200; Kamera besitzt `x/z/zoom/yaw`, keine Neigung/3D-Position/Projektionswahl. `entities` fügt Objekte hinzu, entfernt aber keine Landungsworker. Fokuskorrektur verwendet die begrenzte UI-Spielkamera.
- [Szenenrunner](../../scripts/scene-capture.mjs): ein Bild pro Aufruf; eigener Browser-/Scratch-Lebenszyklus statt vorhandener Harness; kein Phasen-Timing oder Batchvertrag.
- [App](../../src/app.ts): begrenzt die Spielkamera bei jedem Renderframe. Simulation, UI, Audio und Autosave laufen innerhalb desselben App-Lebenszyklus; Ausblenden des HUD allein schafft keinen isolierten Viewer.
- [UI](../../src/ui/core.ts): `controlsLocked` enthält `paused`; damit blockiert bloßes Pausieren auch Kameraeingaben. [Eingaben](../../src/ui/input.ts) verwenden dieselbe Sperre für Betrachtung und Befehle.
- [Renderer](../../src/renderer/runtime.ts): fester Spielkamerawinkel, orthografisches `zoom` beeinflusst zugleich Bildausschnitt und Augenabstand. Perspektivische Menükamera ist ein fester Orbit. Schatten-Fit schneidet Viewstrahlen mit horizontalen Ebenen und braucht Schutz für nahezu horizontale Kameras.
- [Shader](../../src/renderer/shaders.ts): Distanzdunst ist separat vom Nebel des Krieges und verschleiert weite Übersichten. Textreplacement/Monkeypatching aus lokalen Scratch-Skripten ist kein Implementierungsweg.
- [Marketingrunner](../../scripts/capture-itch-media.mjs): Browser und Seite werden bereits wiederverwendet; Szenen/Kameras sind hart kodiert, mehrere feste Wartezeiten, zusätzliche Kompositionen bleiben eigener Workflow.
- [Diagnoserunner](../../scripts/diagnostics/capture.mjs): nutzt die Szenenfixture, erfordert aber echte Zeit und frische Fälle. Seine Messisolation nicht zugunsten schnellerer Bildserien ändern.
- [Buildkennung](../../scripts/build-info.mjs) und [ZIP](../../scripts/build-zip.mjs) führen bisher `index.html` explizit. Die neue Startseite muss bewusst in Auslieferung, Fingerabdruck und zugehörige Prüfungen aufgenommen werden.

## Architekturentscheidung

Gemeinsame kleine Laufzeitbausteine für validierte Szenenbeschreibung, Kameraauflösung/Fit und Darstellungsoptionen. Klassische TypeScript-Skripte in bestehender Ladereihenfolge; Node-Runner orchestrieren und transportieren Rezepte, kopieren aber keine Kameramathematik.

`map-viewer.html` wird eine dünne Startseite analog zum vorhandenen [Simulationseinstieg](../../visible-simulation.html), die validierte Parameter in einen expliziten Viewer-Modus des bestehenden `index.html` übergibt. Sie erhält keinen zweiten manuellen Script-/DOM-Katalog und keinen eigenen Renderer. Der Viewer-Modus zeigt nach Vorbereitung ausschließlich Landschaft plus kleine ausblendbare Werkzeugleiste. Der Name und die Launcher-Struktur sind eine bewusste Umsetzung des separaten HTML-Einstiegs, kein zweites Spiel.

Der Viewer-Modus wird vor Persistenz-/Home-Vorbereitung erkannt. Er verwendet ausschließlich flüchtige Dienste, keinen Zugriff auf das normale Profil, keinen normalen Menühintergrund als unnötige erste Welt und kein zwischenzeitlich sichtbares Hauptmenü. Rendering und Kameraeingaben bleiben aktiv, Simulationsschritte, Missionsergebnisverarbeitung, Expeditions-Autosave und Kampf-/Sprachausgabe bleiben aus. Nicht über `ui.paused = false` mit leerem Gefecht und weiterlaufender KI improvisieren.

In Betrachtungsmodi getrennte Berechtigungen für Kamera und Spielaktionen: Kamera erlaubt, Auswahl/Bau/Rekrutierung/Befehle/Pausemenü verboten. Gemeinsame Gesten beibehalten; keine globale Lockerung von `controlsLocked`. Resize, Framekamera und direkte Eingabereprojektion müssen denselben Kamerakontext verwenden.

## Interaktiver Viewer

### Einstieg und Bedienung

Vorgeschlagener Einstieg: `map-viewer.html?map=westmark&seed=93401206` (noch nicht vorhanden). Ohne Parameter gültige, sichtbare Standardkarte/Standardseed. Ungültige explizite Parameter melden, nicht still auf eine andere Landschaft ausweichen. Karte und Seed identifizieren zusammen die Landschaft; Seed allein ist nicht familienübergreifend eindeutig und konserviert kein Terrain über Buildversionen hinweg.

- Kleine Toolbar: Kartenfamilie, Seedfeld, Laden, Zufallsseed, Gesamtansicht, Kamera zurücksetzen, Dunst ein/aus, Rezept exportieren, Toolbar ausblenden.
- Seedwechsel erst bei Bestätigung, nicht bei jedem Tastendruck. Zufallsseed außerhalb der Simulations-RNG; aufgelösten Seed anzeigen und in URL/Rezept übernehmen.
- Maus/Touch wie im Spiel: Pan, Yaw, Rad/Pinch. Standard bleibt orthografischer Spielkamerawinkel; freie Neigung/Perspektive sind im ersten Viewer-Schritt keine Voraussetzung und später optional über erweiterte Kameraregler erreichbar.
- Erweiterter Zoom mit endlichem, aus Karten-Fit abgeleitetem Maximum plus Übersichtsreserve; kein pauschales Maximum 200 und kein unendlicher Zoom.
- Betrachtungspan mit eigenem Bounds-Vertrag: vollständige Karte bleibt erreichbar, Rotation/Resize springen nicht zurück in Spielgrenzen. Außenkulisse ist keine spielbare Karte und erhält keine Navigationsdaten.
- Start in Gesamtansicht, Reset zurück zur Gesamtansicht bei normalem Spielkamerawinkel. Nutzerkamera bei reinem Resize erhalten; explizit aktive Fit-Ansichten neu einpassen.
- Vollständige Sicht, keine Einheiten oder Gebäude; Terrain, Wirtschaftsressourcen und natürliche/industrielle Kulisse bleiben. Versorgungskisten sind separat definierter Zusatzinhalt, für reine Landschaft standardmäßig aus.
- Toolbar nimmt keinen impliziten HUD-Rand ein. Eingaben auf Feldern/Toolbar dürfen weder Canvasgesten noch Spielhotkeys auslösen. Fehler und WebGL-Kontextverlust sichtbar und bedienbar behandeln.
- URL speichert Karte/Seed; Kamera und weitere Optionen im exportierten Rezept. Copy-Link als Komfort mit Fallback auf auswählbaren Text, da Clipboard über `file://` nicht überall verfügbar ist.

### Laden und Lebenszyklus

Ein begrenzter, expliziter Ladepfad: validieren → Welt vorbereiten → Sicht/Inhalt auflösen → Materialien bereitstellen → Kamera anwenden → neuen fertigen Frame anzeigen. Mehrfach-Laden sperren oder per Request-ID neueste Anforderung gewinnen lassen; alte GPU-/View-Ressourcen sauber freigeben. Generierungsfehler sichtbar melden, keinen Ersatzseed ziehen. Für den ersten Schritt darf die bestehende Weltvorbereitung wiederverwendet werden; kein zweiter Terrain-Generator und keine vorgezogene große Simulationsextraktion.

## Gemeinsamer Kamera- und Szenenvertrag

Die folgenden Namen sind Zielentwurf und müssen vor Implementierung konsistent in Validator, Runtime, Rezeptbeispielen und Tests festgelegt werden. Kein Legacy-Adapter nötig; bestehende Repository-Rezepte gezielt aktualisieren, Spielzustandskamera unverändert lassen.

### Kamera

Disjunkte Modi statt widersprüchlicher Parameterkombinationen:

1. `game`: Geländefokus, orthografische Bildhöhe und Yaw; bestehender Spielwinkel, mit betrachtungsspezifischen Bounds/Zoomgrenzen.
2. `orbit`: 3D-Ziel oder Geländefokus, Yaw, Neigung, physischer Abstand; Projektion `orthographic` mit separater Bildhöhe oder `perspective` mit vertikalem FOV.
3. `lookAt`: explizite 3D-Augenposition, Zielpunkt und Up-Vektor; gleiche Projektionsparameter. Zulässige Blickrichtungen nicht auf vier Seiten beschränken.

Alle Zahlen endlich, gültige FOV-/Clippingintervalle, nicht zusammenfallende Augen-/Zielpunkte und nicht kollineare Up-/Blickvektoren. Senkrechte Draufsicht erhält eine stabile Up-Achse. Extreme/unterirdische Kameras nicht still verschieben; ungültige Konfigurationen ablehnen, zulässige Positionen können bewusst verdeckte Ansichten erzeugen. Innenflächen unter der einseitigen Terrainoberfläche sind keine zugesagte neue Geometrie.

`fit: map` und optional `fit: entities` mit Padding: relevante Höhen/Baum-/Modellhüllen in den Kameraraum projizieren, nach Seitenverhältnis und tatsächlich nutzbarem Viewport einpassen. Orthografisch Bildhöhe lösen; perspektivisch Abstand bei festem FOV lösen. Fit und expliziter Abstand/Bildausschnitt sind gegenseitig exklusiv. Nicht nur ein quadratisches Extent mal Faktor verwenden. Außenkulisse standardmäßig nicht Teil des Karten-Fit; Garantie bezieht sich auf spielbare Fläche einschließlich gewählter sichtbarer Aufbauten.

Near/Far, inverse Projektion/Picking, Frustum-/Modellculling, Schatten-Fit und Auflösung berücksichtigen. Kamerageometrie gehört zum Renderer, Inputgrenzen zum jeweiligen Betriebsmodus. Ein optionaler, instanzgebundener Betrachtungskontext wird zuverlässig zurückgesetzt; kein globaler Prototyp-Patch.

### Szeneninhalt und Darstellung

- Inhaltspreset `landscape`, `landing`, `arranged`: Landschaft ohne Start-Einheiten/-Gebäude; normaler Landungszustand; nur arrangierte Einheiten/Gebäude zusätzlich zur Landschaft. Ressourcen und Terrain bleiben unverändert. Ankerkoordinaten aus der normalen Startzuteilung vor Entfernung sichern und im Setup-Ergebnis anbieten, damit leere Szenen und Diagnosetools keine Workerreferenzen voraussetzen.
- Separate Renderfilter für Einheiten und Gebäude; Ausblenden verändert keine CPU-Entitäten, Belegung, Sicht oder RNG. Alle zugehörigen Zeichenpfade berücksichtigen, insbesondere Fundamente, Straßen, Siedlungsverkehr, Auswahlringe und Schatten. Landschaftsvoreinstellung benötigt keine aufwendig weiterbetriebene unsichtbare Siedlung.
- Explizite Optionen für HUD/Werkzeugleiste, Auswahl/Hilfsmasken, Effekte, Versorgungskisten und vollständige/Spielersicht.
- Distanzdunst als reguläre Renderoption separat von Fog-of-war und Rand-/Horizontverblendung. Standardspiel bleibt unverändert; Viewer/Gesamtansicht standardmäßig klar, auf Wunsch spielgetreuer Dunst. Abweichung im Export dokumentieren.
- Tageszeit, Renderqualität, Viewport und DPR explizit. Capturezeit getrennt von Kampf-RNG; keine Behauptung pixelidentischer Bilder über verschiedene Browser/GPU hinweg.

## Automatisierte Capture-Werkzeuge

### Eingaben

- Ein Szenenrezept und eine Liste benannter Aufnahmen: Kameravarianten, Viewport, Tageszeit, Sichtbarkeitsfilter. Eine Aufnahme ist der Sonderfall einer Liste mit einem Eintrag.
- Begrenzte Batchliste mehrerer Karten/Seeds; Zufallsauswahl mit expliziter Anzahl und dokumentierten aufgelösten Karten/Seeds. Wiederholbarer Auswahlseed optional, strikt getrennt vom Landschafts-/Simulationsseed.
- CLI-Kurzformen für häufige Fälle (Karte, Seed, Inhaltspreset, Gesamtansicht, Richtung, Dunst, Auflösung). Vorrang klar: Defaults → Rezept → explizite CLI-Overrides. Keine stillen Overrides zwischen exklusiven Kameramodi.
- Viewer-Export direkt verwendbar. Im Report zusätzlich effektive Kamera einschließlich Projektionsmatrix/Clipping, tatsächlich platzierte Objekte, Buildkennung, Browser-/Grafikbackend und alle Renderabweichungen.

### Ablauf und Performance

- Vor Browserstart Rezepte, Batchgrenzen und Ausgabewege validieren.
- Standardbefehl baut einmal pro Lauf; ausdrücklich gewählte Wiederverwendung eines vorhandenen Builds prüft dessen Kennung gegen aktuelle Auslieferungsquellen. Fehlender/veralteter Build ist Fehler, nicht still erlaubter Zustand. Gemeinsame Fingerprintlogik verwenden, keinen zweiten abweichenden Hashalgorithmus.
- Bestehenden [Browser-Harness](../../scripts/browser/harness.mjs) für Browserpfad, Sandbox, Dateizugriff, Zeitbudget und Scratch-Cleanup nutzen. Ein Browser pro Batch, Seite/Runtime und Welt pro identischer Szene wiederverwenden; bei Kartenwechsel Szenenzustand und GPU-/View-Ressourcen zurücksetzen. Keine parallelen GPU-Seiten als ungeprüfte Standardoptimierung.
- Kamera-/Filterwechsel erzeugen einen neuen Request-/Frame-Nachweis. Aufnahme erst nach fertig vorbereiteten Ressourcen und einem nach dieser Anforderung eingereichten Frame; nicht nur allgemeines `frameReady()` oder eine feste Sleepdauer prüfen.
- Statische Aufnahme hält Simulation bei Zeit 0. Definierte visuelle Zeit/Frozen-Frame-Steuerung beibehalten; Marketingfeuergefechte bleiben ausdrücklich laufende, begrenzte Sonderfälle. Die virtuelle 60-Sekunden-Uhrverschiebung im bisherigen Runner ist keine echte Wartezeit.
- Phasen-Timings ausgeben: Build, Browserstart, App-Laden, Weltaufbau, Ressourcenbereitschaft, Frame, Screenshot, WebP-Encoding. Erst anhand dieser Werte zusätzliche Optimierung entscheiden; keine Laufzeitversprechen ohne Messung.
- Neues laufbezogenes Ausgabeverzeichnis im eigenen `.tmp/`; gemeinsame Symlink-/Containmentprüfung, keine stillen Überschreibungen. WebP Qualität 80 bleibt, PNG höchstens im Speicher. Teilresultate bei Fehler erhalten, erfolgreicher Gesamtindex nur bei vollständigem Lauf. Scratch nach Browserende aufräumen.
- Marketingrunner übernimmt gemeinsame Kamera-/Szenen-/Framebausteine und Harness, behält seine Motive/Kompositionen. Echtzeit-Diagnoserunner behält frische Fälle, echte Zeit, normale Sicht und explizite Hardwareanforderungen; Batchbeschleunigung nicht ungefragt übertragen.

## Umsetzung in begrenzten Etappen

### A — Gemeinsame Grundlage und interaktiver Mindest-Viewer

- [ ] Betrachtungsmodus, flüchtige Persistenz und getrennte Kamera-/Aktionsberechtigungen einführen.
- [ ] Landschaftsinhalt, vollständige Sicht, reguläre Dunstoption und orthografische Spielkamera mit erweitertem Zoom/Karten-Fit implementieren.
- [ ] `map-viewer.html`, kleine Toolbar, Seed/Karte/URL, Laden/Fehler, Reset und Rezeptexport ergänzen.
- [ ] Launcher, klassische Ladereihenfolge, Buildkennung und ZIP-Auslieferung gezielt prüfen.

Abnahme: dieselbe Karte/Seed liefert dieselbe Landschaft wie das Spiel; keine Einheiten/Gebäude, keine Simulationsticks/Profilschreibvorgänge; Pan/Yaw/Rad/Pinch funktionieren trotz stillstehender Welt; ganze Karte bei Rotation und Resize erreichbar.

### B — Parametrisierte, wiederverwendende Aufnahmeabläufe

- [ ] Szenenvalidator/Fixture auf gemeinsamen Vertrag umstellen; vorhandene Rezepte aktualisieren.
- [ ] Ein-/Mehrbildaufnahme, mehrere Karten, CLI-Overrides, Build-Wiederverwendung, Phasen-Timings und strukturierte Reports einführen.
- [ ] Harness, sichere Ausgabe und requestbezogene Renderbereitschaft vereinheitlichen.
- [ ] Inhaltspresets und unabhängige Renderfilter mit zugehörigen Zeichenpfaden umsetzen.

Abnahme: exportiertes Viewer-Rezept direkt aufnehmen; drei Landschaften in einem Browserlauf; mehrere Ansichten derselben Welt ohne neue Erzeugung; ungültige Eingaben und veralteter Build scheitern vor Aufnahme; keine fremden Ausgaben überschrieben.

### C — Freie 3D-Kamera und besondere Perspektiven

- [ ] Orbit/Look-at, variable Neigung, Draufsicht, Perspektive/FOV und projektionstauglicher Fit ergänzen.
- [ ] Clipping, Schatten und Culling für flache/hohe/nahe Blickwinkel absichern; Renderstandards bleiben unverändert.
- [ ] Optional erweiterte Viewer-Kameraregler auf denselben Vertrag aufsetzen, keine zweite Gestenbedienung als Pflicht.
- [ ] Marketing-/Diagnosenutzer im jeweils betroffenen Umfang an gemeinsame Bausteine anbinden und Anleitungen aktualisieren.

Abnahme: Aufnahmen aus allen horizontalen Richtungen, senkrecht von oben, flach seitlich, orthografisch/perspektivisch; endliche Matrizen und keine GL-Fehler; keine verschobene normale Spielkamera.

## Prüfplan und Grenzen

Pro Etappe Build und kurze betroffene CPU-Verträge: Parser/Validator, Default-/Overrideauflösung, Kamera-/Fitmathematik, nahezu kollineare Vektoren, Clipping, Bounds/Resize, Renderer-Pickingroundtrip, Inhalt/Anker, Renderfilter, Batch-Wiederverwendung, Ausgabesicherheit und Fehlercleanup. Fingerprint-/Pakettests gezielt ergänzen. Bestehende Renderer- und Szenentests erweitern, keine GPU-Sollbildsammlung oder Regenerierung von Simulationsreferenzen.

Begrenzte Browserchecks nur mit konkretem Ziel: `file://`-Viewerstart ohne Profilzugriff, reale Mausnavigation trotz stehender Simulation, Whole-map-Fit nach Rotation/Resize, Shader/Frame-Bereitschaft bei Kamera-/Filterwechsel sowie ein Viewer-Rezeptexport mit anschließender Aufnahme. Emuliertes Touch ist ein technischer Gestentest, kein Echtgerätenachweis. Kontextverlust/Generierungsfehler und schnelles mehrfaches Laden gezielt behandeln.

Keine automatisch gestartete KI-/Zuschauerpartie, keine breite KI-/Simulationssuite und kein Kreuzprodukt aller Karten/Kameras. Visuelle Bildqualität, neue flache Perspektiven und Touchkomfort bleiben menschliche Abnahme. Software-WebGL-Timings sind kein Zielgeräteperformancebeleg.

## Dokumentations- und Integrationsgrenzen

Nach Umsetzung dauerhafte Nutzung zentral in [Szenen-Capture](../scene-capture.md), Betriebs-/Storagegrenzen in [Architektur](../architecture.md), Prüfungshinweise in [Testing](../testing.md); README verlinkt Viewer/Capture. [Release-Tooling](release-tooling.md) verweist hierher, kein zweiter konkurrierender Captureplan. Dieser offene Plan wird bei abgeschlossener Umsetzung entfernt. Implementierung im eigenen Aufgaben-Worktree committen; Integration nach `main` nur auf ausdrücklichen Auftrag.
