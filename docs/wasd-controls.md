# Feste WASD-Kamerasteuerung

Absichtliche Verhaltensänderung nach `fe9c355`, kein strukturelles Refactoring.

## Steuerung

- Tastaturkamera ausschließlich W/A/S/D; Pfeiltasten werden weder als Kameratasten registriert noch beim Kameratick ausgewertet. Die WASD-Umschaltoption ist vollständig aus Settings entfernt.
- Attack-Move liegt immer auf **F** statt A. Sonstige Belegungen bleiben bestehen: M bewegen, H halten, X stoppen, Q/B/N/T Tabs, E/R/C/V Fähigkeiten, Y Rally, F2/F3 Auswahl, Space/Home Kamera zentrieren, F5/F9 speichern/laden und Kontrollgruppen.
- Ctrl+A wählt weiterhin die Kampfeinheiten, Ctrl+S speichert. Modifizierte WASD-Tasten werden nicht als Kamerabewegung registriert; sonst würde z. B. Ctrl+A gleichzeitig schwenken. Shift+WASD bleibt verwendbar. Wiederholte Keydown-Ereignisse lösen Befehle nicht mehrfach aus.
- Statischer und dynamischer Controlstrip, Befehlsbutton, Field Manual und Tutorial nennen F/WASD. Mausziehen, Mausrad, Minimap und die bestehende Edge-Scrolling-Option bleiben unverändert.

## Profil-/Backup-Kompatibilität

`settings.wasd` entfällt im Standardprofil. Die bestehende Version-1-Normalisierung entfernt ein eingelesenes Alt-Feld unabhängig von seinem Wert; auch noch direkt übergebene alte UI-Profile können die feste Steuerung nicht zurückschalten. Alle anderen Profilwerte, Versionen und Storage-Schlüssel bleiben unverändert; Operationsdaten werden nicht migriert.

Kein automatisches Umschreiben des Browserspeichers beim Start. Wie bisher speichert Backup-Import zunächst das rohe importierte Profil und normalisiert es für die laufende Anwendung. Beim nächsten normalen Profil-Speichern wird das obsolete Feld nicht mehr geschrieben; Export verwendet das normalisierte aktive Profil. Alte Backups bleiben ladbar, der bisherige nicht transaktionale Importablauf bleibt erhalten.

## Prüfungen

- Sechs neue Kontrolltests mit echten UI-Methoden und gezielten DOM-/Spiel-Testdoubles: vier Richtungen, Großbuchstaben, Wiederholung und Entfernen aus dem Held-Key-Set, Pfeiltasten, Altflag-Unabhängigkeit, F, Modifier, Eingabefokus/Pause, andere Hotkeys sowie Settings/Hilfe/Controlstrip. Node simuliert hier keine nativen Keyup-Ereignisse; diese wurden separat im Browser geprüft.
- Zusätzlicher Persistenztest für Laden und Import alter Profile mit `wasd:false`, `true` und einem sonstigen Altwert, einschließlich anschließenden Speicherns. Standardprofil-Erwartung absichtlich ohne das entfernte Feld; keine aktualisierten Layout-/Simulations-/Effekt-Referenzen.
- Vollständiger [Testbefehl](testing.md#automatisierte-tests): **110 bestanden, 0 fehlgeschlagen**, Node.js `v23.11.1` / Linux, 128-MiB-Heaplimit, ein Worker.
- Chromium `152.0.7977.75`, Linux/headless, `file://`, frisches temporäres Profil, keine abgeschwächten Sicherheitsflags. Probe `/tmp/meridian-wasd-browser.cjs`, Phase `wasd`, startet ausdrücklich mit einem Version-1-Profil mit `wasd:false`. Aktive Einstellung entfernt, keine Checkbox; Ansichten bei 1280×800 und 800×700 erfolgreich geladen. Wegen beabsichtigter Text-/Settings-Änderungen kein Gleichheitsvergleich der alten Layout-Messsätze.
- Tatsächliche CDP-Tastaturereignisse: W/A/S/D schwenken in die richtige Richtung, Keyup stoppt, alle vier Pfeiltasten schwenken nicht, Ctrl+A wählt ohne Schwenk, F aktiviert Attack-Move und Escape beendet den Modus. F-Buttonbeschriftung und Field Manual geprüft. Der erweiterte bisherige Spiel-/Bau-/Rekrutierungs-/Save-/Reload-/Download-/Import-Ablauf besteht ebenfalls, einschließlich Audio-Kontext-/Gain-API-Prüfung, nicht hörbarer Ausgabe.
- Die erste erweiterte Probe scheiterte an ihrer bisherigen Zeitannahme für F9 (maximal 0,2 Sekunden späterer Frame-Fortschritt). Die Probe erfasst nun delegierte F5-/F9-Aufrufe direkt und pausiert unmittelbar nach Laden. Exakte gespeicherte Zeit und Wiederherstellung eines zwischenzeitlich absichtlich veränderten Alloy-Werts wurden damit geprüft, statt die Toleranz zu erhöhen. Kein Spielcode dafür geändert.
- Nur die drei bekannten Skybox-SecurityErrors erfasst, keine neuen erfassten Laufzeit-/Konsolen-/Ressourcenfehler. Temporäre Browserprofile und heruntergeladene Backups entfernt. Dokumentationslinks/Anker und `git diff --check` geprüft.

Nicht geprüft: HTTP, andere Browser, hörbare Audioausgabe, alle nativen Dialoge und vollständige Kampagnen-/Performanceprüfung. Die Skybox-Sperre bleibt unverändert.
