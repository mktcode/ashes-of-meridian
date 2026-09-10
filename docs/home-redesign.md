# Startscreen nach Nutzervorlage

Gezielte Darstellungsänderung nach `3f4d376`, zunächst ausschließlich für den Startscreen. Referenz: `/tmp/pi-clipboard-786f4be8-de56-4844-9293-ff23120253ba.png`.

## Umsetzung

- Technische Randkontur und Kommando-Emblem als dekoratives Inline-SVG; feine Header-/Footer-Linien, Systemkennung aus der Vorlage und cyanfarbener Statusring.
- Serifentitel mit goldenen Linien um „OF“, größerer kursiver Unterzeile und neu abgestimmten Abständen.
- Breitere goldene Hauptaktion mit Verlauf, Lichtkante und Eckmarkierungen; blaugraue Sekundäraktionen mit Pfeil; getrennte untergeordnete Navigation. Hover und sichtbarer Tastaturfokus bleiben vorhanden.
- Angepasste Hintergrundabdunklung und Zitatposition. Die vorhandene animierte 3D-Vorschau, Skybox, Kamera und Assets bleiben unangetastet. Daher Annäherung an die Vorlage, keine pixelidentische Reproduktion des dort bearbeiteten Hintergrunds.
- Nur `showHome()`-Markup in `ui.js` verändert; außerhalb dieser Methode Bytegleichheit zum vorherigen Stand geprüft. Vorhandene `data-ui`-Ziele und die dynamische Logik bleiben bestehen: „Enter“ ohne Fortschritt, „Continue“ mit Medaillen, „Resume operation“ als Hauptaktion bei Checkpoint. Die Beispielanzeige 2/16 wurde nicht fest eingebaut.
- Styles und responsive Regeln sind auf `.home-screen`/`.home-layout` beschränkt. Der Hintergrundwechsel am Menücontainer nutzt `:has(> .home-screen)`; keine zusätzliche JS-Zustandsverwaltung. Alte ausschließlich Home betreffende Styles/Media-Regeln ersetzt, keine Änderungen an gemeinsamen Buttons, Kampagnen- oder HUD-Styles.
- Grid-Anordnung, kompakte Regeln bei niedrigen Fenstern und Scrollen bei Platzmangel statt überlappender/unerreichbarer Buttons. Auf schmalen Fenstern entfallen dekorative Zusatzangaben wie zuvor. Keine neuen Downloads, Fonts, Abhängigkeiten oder Builds; `file://` bleibt Ziel.

## Ausgeführte Prüfungen

- Vollständiger [Node-Testbefehl](testing.md#automatisierte-tests): **112 bestanden**, 0 fehlgeschlagen, Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit und ein Worker. Neuer UI-Methodentest mit DOM-Testdouble prüft vier Kombinationen aus Fortschritt/Checkpoint, Aktionsreihenfolge, genau eine Hauptaktion, dynamische Beschriftung/Zähler und Preview-Aufruf. Keine geänderten bestehenden Layout-/Simulations-/Effekt-Fixtures.
- Chromium `152.0.7977.75`, Linux/headless, `file://`, temporäres Profil und keine abgeschwächten Sicherheitsflags. Erweiterte Probe `/tmp/meridian-home-browser.cjs`, Phase `home-final`: bisheriger GPU-/Qualitäts-/WASD-/Maus-/Bau-/Rekrutierungs-/Save-/Reload-/Backup-/Audio-API-Ablauf bestanden, keine erfassten Laufzeit-/Konsolen-/Ladefehler.
- Sechs gemessene Nicht-Home-Ansichten (Kampagne, Settings, Spiel bei 1280×800 und 800×700) stimmen bezüglich erfasster Styles und Rechtecke exakt mit Phase `skybox-replacement` überein. Kein animierter Pixelvergleich und keine Behauptung, jede andere Ansicht vollständig geprüft zu haben.
- Acht zusätzliche Home-Fälle: 1774×887 ohne Fortschritt und mit 2/16 ohne Checkpoint; 1280×800, 800×700, 650×700, 360×740, 320×640 und 900×500 jeweils mit Checkpoint. Header/Hauptinhalt/Footer überlappen nicht; kein horizontaler Überlauf. Alle Buttons nach ggf. Scrollen per `elementFromPoint` erreichbar. Bei 320×640 und 900×500 ist vertikales Scrollen erforderlich, bei den übrigen Fällen nicht.
- Screenshots insbesondere bei Vorlagengröße 1774×887, 800×700 mit Resume und 320×640 visuell geprüft. Temporäre Bilder: `/tmp/meridian-home-<Breite>-<Höhe>-<Zustand>.png`.
- Alle sechs Navigationseinstiege per tatsächlichem CDP-Mausklick geprüft: Kampagne, Gefecht, Fleet Upgrades, Field Manual, Settings, Resume. Danach tatsächliche Tab-Ereignisse durch die Menüeinträge, sichtbare Fokus-Outline und Enter-Aktivierung von Settings geprüft. Erste Enter-Probe enthielt keinen vollständigen nativen Keycode/Text; das wurde nur im temporären Probe-Skript korrigiert.
- Browserprofile und heruntergeladene Backups entfernt, Dokumentationslinks/Anker und `git diff --check` geprüft.

Offen: Firefox/andere Browser, HTTP, echte Touchbedienung, Screenreader, hörbares Audio, alle Modalvarianten, vollständige Kampagnen und umfassende Performance-/Browserprüfung. Die schmalen Ansichten wurden als Desktop-Viewport geprüft, nicht auf einem Mobilgerät.
