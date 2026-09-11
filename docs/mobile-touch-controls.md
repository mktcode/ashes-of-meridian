# Touch-Befehle, Abbrechen und Entfernung der Bauhilfe

Dritter Bereinigungsschritt aus der [Desktop-Bestandsaufnahme](mobile-desktop-inventory.md).

## Änderungen

- `keydown`-Listener und `MeridianUI.keyDown()` vollständig entfernt. Keine Spiel-Hotkeys mehr für Befehle, Fähigkeiten, Reiter, Pause, Dialoge, Speichern/Laden oder Handbuch.
- Hotkey-Beschriftungen aus Aktionsbuttons, Tabs, Pausenmenü, Tutorial, Handbuch, Steuerungsleiste und `title`-Hinweisen entfernt. Ungenutzte Hotkey-Parameter und CSS-Regeln entfernt. Das Handbuch beschreibt jetzt Schaltflächen statt Tastenkombinationen.
- Bauplatzierung, Bewegung, Attack-Move, Sammelpunkt und alle vier Fähigkeiten zeigen einen **Cancel**-Button neben ihrem Zielhinweis. Dieser beendet nur den Modus und aktualisiert die Aktionsmarkierungen; er erteilt keinen Befehl, baut nichts, nutzt keine Fähigkeit und ändert nicht die Auswahl.
- Die Cancel-Fläche ist mindestens 88×44 CSS-Pixel groß, auch in schmalen Ansichten erreichbar und innerhalb des HUD über Funkmeldungen angeordnet. Der übrige Hinweis bleibt für Pointer-Ereignisse durchlässig. Während eines Zielmodus sind Hover-Tooltips ausgeblendet, damit sie den neuen Button nicht verdecken.
- **Bauhilfe entfernt:** Kontextbefehle auf unfertige eigene/verbündete Gebäude weisen keine zusätzlichen Bauarbeiter mehr zu. Sie fallen auf den normalen Bewegungsbefehl zurück. Reparaturbefehle gelten nur für fertige Ziele; auch der Worker-Verarbeitungspfad weist Reparatur an unfertigen Gebäuden zurück, statt dadurch weiterzubauen.
- Arbeiterbeschreibung und Bauanleitung entsprechend angepasst.

Quellen: `ui.js`, `index.html`, `styles.css`, `simulation.js`, `content.js`.

## Erhalten und abgegrenzt

- Regulärer Bau: `build()` bezahlt wie bisher einmal die Gebäudekosten und weist einen Arbeiter zu. Baugeschwindigkeit, Lebenspunktaufbau und Abschluss bleiben unverändert.
- Kein automatischer Ersatzarbeiter und keine automatische Fertigstellung eingeführt. Wenn der zugewiesene Arbeiter abgezogen wird oder ausfällt, gibt es keine manuelle Bauhilfe mehr zur Übernahme; das Fundament kann weiterhin über **Cancel build** abgebrochen werden. Das ist nicht mit **Cancel** für eine noch unbestätigte Platzierung zu verwechseln.
- Reparatur fertiger beschädigter eigener/verbündeter Gebäude und Einheiten bleibt mit den bisherigen Raten/Kosten erhalten. Keine Reparatur-Automatisierung in diesem Schritt.
- Vorhandene Buttons für Befehle, Fähigkeiten, Arbeiterauswahl, Kampftruppe, Reiter, Kamera, Pause, Menünavigation und Speicherung bleiben bestehen. Keine neuen Armee-Auswahlbuttons.
- Touch-Auswahl, Doppeltippen, Fingerziehen, Pinch-Zoom und Minimap bleiben unverändert. Rechtsklick-Befehle bleiben bis zu ihrer separaten Bereinigung bestehen.
- Native Browser-/Formularbedienung und Tastaturfokus auf Buttons werden nicht abgeschaltet. Entfernt sind die eigenen Spiel-Hotkeys, nicht die Browser-Standardaktionen.
- Hover-Tooltips außerhalb von Zielmodi sind noch nicht ersetzt; ein Touch-Zugang zu ihren Informationen ist der nächste separate UI-Schritt.
- Keine Asset-, Terrain-, Kollisions-, RNG-, Speicherformat- oder sonstigen Balancing-Änderungen. Keine Spielstandmigration.

## Prüfungen

### Node

Vollständiger Pflichtbefehl aus [testing.md](testing.md#automatisierte-tests): **134 Tests bestanden**. Feste Terrain-/Effekt-/RNG-Referenzen unverändert.

Angepasste und ergänzte Tests:

- Kein Tastaturhandler mehr vorhanden; bestehende Button-Aktionen und Pausenschutz bleiben erhalten.
- Cancel beendet alle acht Bau-/Zielvarianten ohne Änderung des Spielzustands, der Auswahl oder der Pause. Aktive Aktionsmarkierungen und Zielanzeige verschwinden; Tooltip verdeckt den Zielmodus nicht.
- Pause, Resume, Hilfe, Speichern/Laden und Dialogschließen über die gebundene Button-Verarbeitung.
- Handbuch, Tutorial, statisches HTML und Aktions-/Pausenmenü ohne Hotkey-Hinweise.
- Regulärer Bau weist genau einen Arbeiter zu, bezahlt einmal und kann normal fertiggestellt werden.
- Kontext- und Reparaturbefehle können unfertigen eigenen/verbündeten Gebäuden keine Bauhilfe geben.
- Fertige Gebäude und Einheiten beider Teams bleiben mit 38 Lebenspunkten pro Sekunde und 0,1 Alloy pro Lebenspunkt reparierbar, soweit Schaden und Ressourcen reichen.

### Browser unter `file://`

Chromium `152.0.7977.75`, Linux/headless, Touch-Emulation, Qualitätsstufe Performance, frisches temporäres Profil; kein Server und keine abgeschwächten Sicherheitsflags. Temporäre CDP-Probe: `/tmp/meridian-touch-controls-check.cjs`.

Bestanden:

- Direkter Dateistart und WebGL 2.
- Bei 960×600: vorhandene Aktions-/Reiterbuttons und Cancel in allen Bau-/Zielmodi über Browser-Touch-Ereignisse betätigt. Kein Aufruf von `command`, `build` oder `ability` durch diese Abbruchabläufe.
- An das Dokument zugestellte DOM-KeyboardEvents für frühere Hotkeys lösen keine Spielaktionen aus; diese Prüfung unterdrückt nicht die nativen Browser-Standardaktionen echter Tastendrücke.
- Cancel zusätzlich bei 844×390 und 390×844 per Touch getroffen; Hit-Test und Mindestgröße geprüft. Screenshots `/tmp/meridian-touch-cancel-{960,844,390}.png` gesichtet. Bei niedriger Höhe liegt der bestehende Zielhinweis über dem Kommandodeck; kein allgemeines HUD-Redesign.
- Pause, Speichern, Laden, Handbuch, Dialogschließen und Resume über Touch-Buttons. Für den langen Hilfedialog wurde der Schließen-Button vor dem Antippen per DOM in den sichtbaren Scrollbereich gebracht.
- Live-Simulations-API: normales Fundament mit genau einem zugewiesenen Bauarbeiter; Kontextbefehl eines zweiten Arbeiters erzeugt Bewegung statt Bauhilfe.
- Keine erfassten Laufzeit-, Ressourcen- oder Log-Fehler; abschließendes `gl.getError()` war 0.

**Bekannter, unverändert gelassener Ablauf:** Das Pausenmenü bestimmt die Verfügbarkeit von Load beim Öffnen. Nach dem allerersten Speichern in einem bereits offenen Menü wird ein zuvor deaktivierter Load-Button nicht sofort aktualisiert. Die Probe öffnete deshalb das Pausenmenü erneut. Keine beiläufige Korrektur in dieser Bereinigung.

Die temporären Proben/Bilder sind nicht eingecheckt; Browser-Testprofile wurden entfernt. Nicht geprüft: echte Mobilgeräte, andere Browser, High/Balanced im neuen Bedienablauf, erneuter vollständiger Kamera-/Doppeltipp-Browserablauf, native Scrollgesten im Handbuch, hörbares Audio, Backup-Import/-Export, vollständige Missionen oder systematische Performanceanalyse. Reparatur-Automatisierung und ein vollständiger Touch-Ersatz der Tooltips sind nicht implementiert.
