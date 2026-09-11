# Beschreibungs- und Browser-Tooltips entfernt

Nach der [Forschungsentfernung](research-removal.md) entfällt das Tooltip-System vollständig, ohne neue Infofenster oder Touch-Ersatzgesten einzuführen.

## Umsetzung und Grenzen

- `MeridianUI.tooltipFor()`, `data-tooltip`, der Dokument-`mousemove`-Listener sowie sämtliche Zugriffe zum Verbergen/Positionieren des Tooltip-Fensters entfernt.
- `#tooltip` aus `index.html` und alle zugehörigen CSS-Regeln einschließlich `.tt-cost` entfernt.
- Native `title`-Hinweise aus Ressourcenleiste, Symbolbuttons, Minimap, Einheitenporträts, Produktionswarteschlange und anklickbaren Meldungen entfernt. Der HTML-Dokumenttitel bleibt natürlich erhalten.
- Symbolbuttons, Minimap und Einheitenporträts behalten ihre Namen über `aria-label`, ohne sichtbare Hover-Popups. Produktionsbuttons benennen Einheit und Abbruchaktion ebenfalls über `aria-label`.
- **Erhalten:** sichtbare Buttonnamen, Ressourcenpreise, Energie-/Cooldown-Badges, Produktionszeiten/-fortschritt, Handbuch, Tutorialhinweise, Funkmeldungen, Warnungen und Toast-Rückmeldungen. Auch Meldungen bei unzulässigen Aktionen bleiben bestehen.
- `domPressed` und die Pointer-Listener zum Schutz laufender Buttonbetätigungen bleiben erhalten; sie verhindern weiterhin HUD-Neuaufbau während des Drückens. Spielfeld-Pointerverarbeitung, Auswahl, Befehle und Kamera unverändert.
- Welt-Hover für Zielmarkierung, Namen/Lebensbalken und Cursor sowie CSS-Hervorhebungen auf Buttons bleiben bestehen. Diese Spielwelt-/Button-Rückmeldungen sind nicht das entfernte Beschreibungsfenster; keine beiläufige Änderung daran.
- Beschreibungstexte in `content.js` bleiben unverändert. Die ausschließlich in `tooltipFor()` gehaltenen Befehls-/Fähigkeitserklärungen werden mit der Methode gelöscht, nicht in ein neues System verschoben. Detaillierte Werte und Einschränkungen sind damit nicht mehr vollständig vor dem Einsatz ablesbar; kein Anspruch, dass bereits jede Spielregel selbsterklärend ist.
- Keine Änderungen an Simulation, Balancing, RNG, Terrain, Assets, Speicherung oder permanenten Upgrades. Keine neuen Abhängigkeiten.

Quellen: `ui.js`, `index.html`, `styles.css`; Regressionstests in `tests/ashes-of-meridian-controls.check.cjs`.

## Prüfungen

### Node

Vollständiger Pflichtbefehl aus [testing.md](testing.md#automatisierte-tests): **145/145 bestanden**. Bestehende Terrain-/Effekt-/RNG-Referenzen unverändert.

Zusätzliche Absicherung:

- Kein Tooltip-Handler, keine Methode, kein Markup/CSS und keine nativen `title`-Hinweise in den betroffenen Quellen. Der DOM-Teststub weist jeden Zugriff auf das entfernte Element zurück.
- Pointer-Press-Guard und Spielfeld-Pointerbewegung bleiben gebunden; bestehende Tests für Touch, Kamera, Zielmodi und Cancel bestehen ohne Tooltip-DOM.
- Zugängliche Namen der Symbolbuttons/Minimap und dynamischen Einheitenporträts/Produktionsbuttons vorhanden.
- Aktionskosten bleiben sichtbar, Porträtauswahl und Queue-Abbruch werden weiterhin ausgelöst.

### Browser unter `file://`

Chromium 152.0.7977.75, Linux/headless, Touch-Emulation, Performance, frisches temporäres Profil; kein Server und keine abgeschwächten Sicherheitsflags. Probe: `/tmp/meridian-tooltip-check.cjs`.

Bestanden:

- Direkter Start und WebGL 2. Auf besuchten Menü-, Modal-, HUD- und Ergebnisansichten keine Tooltip-Elemente/-Attribute oder `title`-Attribute.
- Zusätzlich Browser-Mausbewegung mit Wartezeit über Bau-, Bewegungs-, Rekrutierungs-, Porträt- und Produktionsbuttons: keine Beschreibungs-/Browser-Tooltips. Hover-Bauansicht und Porträts per Screenshot gesichtet.
- Namen von Pause, Basiszentrierung, Zoom, Audio und Handbuch im Browser-Accessibility-Baum geprüft. Das ersetzt keinen vollständigen Screenreader-Test.
- Native emulierte Touch-Eingaben: Porträtauswahl und Produktionsabbruch mit exakter Rückerstattung; anklickbare Warnmeldung zentriert weiterhin die Kamera. Die Rückerstattungs-Toastmeldung bleibt sichtbar.
- Vorheriger Forschungs-/Touch-Browserablauf erneut bestanden: permanenter Upgrade-Kauf, drei Reiter/sieben Gebäude je Fraktion, Rekrutierung, aktuelle Checkpoints, alle acht Bau-/Zielmodi mit Cancel, Pause/Speichern/Laden/Hilfe/Resume sowie Einzelarbeiter-Bau ohne Bauhilfe.
- 960×600 für Hauptabläufe; Cancel zusätzlich bei 844×390 und 390×844; Baumenü bei 390×844 gesichtet. Sichtbarer Schutzgenerator und Schild-/Siegablauf über die Live-API ebenfalls erneut geprüft.
- Keine erfassten Laufzeit-, Ressourcen- oder Log-Fehler; abschließendes `gl.getError()` war 0.

Die gezielten Tier-3-Prüfungen verwenden wie im [vorherigen Bericht](research-removal.md) per Live-API `speed = 0`. Erster Checkpoint-Load nach erneutem Öffnen des Pausenmenüs; Handbuch-Schließen nach DOM-Scrollen zum Button. Keine Behebung dieser bestehenden Abläufe in diesem Schritt.

Screenshots `/tmp/tooltips-build-faction-0.png`, `/tmp/tooltips-portraits.png` und `/tmp/tooltips-build-portrait.png` gesichtet; Proben/Bilder nicht eingecheckt, Browserprofil entfernt.

Nicht geprüft: echte Mobilgeräte, andere Browser, High/Balanced in diesem Ablauf, vollständige Screenreader-Nutzung, erneuter vollständiger Kamera-/Doppeltipp-Browserablauf, native Handbuch-Scrollgesten, hörbares Audio, Browser-Backup-Import/-Export, vollständige Missionen oder ein Verständlichkeitstest mit neuen Spielern. Reparatur-Automatisierung, weitere Rechtsklick-/Hover-Bereinigung und ein neues Roguelite-System bleiben separate Aufgaben.
