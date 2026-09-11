# Dreifachtap-Auswahl

## Verhalten

In `ui.js` zählt die bestehende Tap-Erkennung bis drei:

1. Ein Tap wählt die getroffene Einheit.
2. Zwei schnelle Taps auf dieselbe eigene Einheit wählen sichtbare eigene Einheiten ihres Typs.
3. Drei wählen alle sichtbaren eigenen Einheiten außer Workern – einschließlich Sanitätern, Scouts, Flugzeugen und Kommandant. Auch ein Worker kann die Geste auslösen, wird beim dritten Tap aber nicht mit ausgewählt.

Es gilt weiterhin **weniger als 330 ms zwischen aufeinanderfolgenden Releases**, nicht insgesamt für alle drei Taps. Weitere schnelle Taps behalten die Combat-Auswahl; nach einer Pause beginnt die Zählung wieder bei eins. Andere Ziele/Zeigerarten beginnen ebenfalls neu. Ziehen, Pinch, Pointer-Abbruch, Bodenbefehle und Zielaktionen unterbrechen die Folge; Gefechtsstart/Load setzt sie zurück.

Kein neuer Auswahlbutton, Befehl oder Kameraschwenk. Gebäude und Gegner lösen keine Combat-Auswahl aus; Maus-Doppelklickverhalten bleibt bestehen, Maus-Dreifachklick erweitert nicht auf Combat.

Der bestehende Bildschirmfilter des Doppeltaps bleibt unverändert: lebende eigene Einheiten mit projiziertem Mittelpunkt innerhalb X `0..innerWidth`, Y `55..innerHeight−210` (jeweils exklusiv). Keine neue Verdeckungsprüfung oder Neuberechnung der HUD-Grenzen. Handbuch, leere Auswahl und Bedienleiste nennen die neue Geste. Keine Simulations-/RNG-/Save-Änderung.

## Geprüft

- Vollständiger Befehl aus [testing.md](testing.md): **166 Node-Tests bestanden**. Neue Fälle für Einzel-/Doppel-/Dreifach-/weitere Taps, Worker als Auslöser, alle normalen Einheitentypen, Ausschluss von Workern/Gegnern/Gebäuden/Toten/offscreen/nicht projizierbaren Einheiten; 330-ms-Grenze, anderes Ziel, Pan, Pinch, Pointer-Abbruch, Boden-/Zielauftrag und Mausverhalten. Terrain-/Effekt-Fixtures unverändert.
- Chromium direkt über **`file://`**, frisches Profil, Headless/CDP-Touch, Performance, 960×600, keine Sicherheitsflags: native Welt-Taps wählen erst einen Infanteristen, dann zwei Infanteristen, schließlich zusätzlich Panzer und Sanitäter, aber nicht den danebenstehenden Worker. Kein Einheitenbefehl; nach 400 ms wieder Einzelauswahl. Screenshot betrachtet, keine erfassten Laufzeit-/Ressourcen-/Log-Fehler; `gl.getError() === 0`.
- Temporär: `/tmp/meridian-triple-tap-check.cjs`, `/tmp/meridian-triple-tap-browser.log`, `/tmp/meridian-triple-tap-tests.log`, `/tmp/buildings-triple-tap-selection.png`. `git diff --check` bestanden.

**Grenzen:** Browserprobe mit kontrolliertem Aufgebot/Kamera und angehaltener Simulation. Die erste sequenziell bestätigte CDP-Probe überschritt mit rund 422 ms die bestehende Zeitgrenze. Erfolgreiche Probe: native Touch-Ereignisse zeitversetzt ohne Warten auf jede CDP-Bestätigung eingereiht; gemessene Release-Abstände rund 8 und 129 ms. Kein künstliches Ändern der Spieluhr oder des 330-ms-Fensters, aber auch kein Nachweis zuverlässig erreichbarer Tap-Zeiten auf echten Geräten. Portrait/andere Größen, High/Balanced und echte Mobilgeräte nicht neu geprüft; vorangegangene Berichte bleiben historisch.
