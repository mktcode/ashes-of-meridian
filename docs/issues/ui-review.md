# UI: offene technische Grenzen

Geltungsbereich: Menüs, Codex, Dialoge, Flottenupgrades, Ergebnisse und Gefechts-HUD
im gemeinsamen [Designsystem](../ui-design-system.md). Die folgenden technischen
Grenzen bestehen unabhängig vom übernommenen Demo-Look.

## Fokus und Dialogsemantik

Statischer Abgleich auf `937914e`: [`openModal`](../../src/ui/screens.ts) ersetzt
Markup weiterhin ohne Dialogrolle, initialen Fokus, Tab-Begrenzung oder Fokusrückgabe. Hintergrundkontrollen bleiben per Tastatur erreichbar. Auch vollständige
Neurenderings nach Upgrade-Käufen können den Fokus verlieren.
Eine gemeinsame Fokus-/Dialogverwaltung muss Rückkehr zu Pause, Ergebnis und Hauptmenü
unterscheiden; Escape darf keine erforderliche Bestätigung überspringen. Keine bloße CSS-Lösung.

## CSS-Verantwortung

`hud.css` enthält responsive Regeln für Menüs, Dialoge und Einstellungen; `base.css`
enthält globale Kontrollgestaltung. Die explizit begrenzte Theme-Schicht isoliert das
neue Design, beseitigt aber nicht diese ältere Layout-Kopplung. Spätere Bereinigung als
separater struktureller Schritt mit Vergleich des HUDs einschließlich dynamischer
Aktions-/Funk-/Queuezustände. Nicht einfach die globalen Tokens ersetzen.

## Technische und menschliche Abnahme

Technischer Prüfkontext: `file://`, lokale Motive/Font, Menü-Scrollaktionen und
unbeschnittene Kontroll-Fokusrahmen bei 375×667, 1280×800 und 844×390. HUD-Diagnose
mit pausierter Welt und angehaltener WebGL-Bildfolge: vier Slots, Kategorie-/Modellkacheln,
Cancel-/Cooldown-/TECH-Anzeigen, Queue-Overlay, Funk-Dismiss über aufgeklapptem
Produktionspanel und Pause-/Restart-Dialog. Keine Shader-/Performanceabnahme.
Kameradrehung technisch mit `file://`/Software-WebGL geprüft: Mittelmausziehen,
emulierte Zwei-Finger-Drehung mit Pinch und Picking bei gedrehter Kamera.
Drehgefühl und kombinierte Gesten auf echten Mobilgeräten bleiben menschlich abzunehmen,
insbesondere der feste [Geländeanker](../gameplay.md#kamera-und-befehle) auf Höhen/Hängen,
die Begrenzung am Kartenrand und die Höhenzentrierung beim Stage-Start ohne Tutorial
sowie beim Basis-Knopf. Gezielte Node-Prüfungen decken Start-/Basis-/Tutorial-Framing
und Projektion auf erhöhtem Terrain ab, nicht das tatsächliche Kameragefühl.
Statische Zustandsprojektionen schützen keine vollständigen Echtgeräteinteraktionen.
Die Außenkulisse bleibt visuell abzunehmen: breite Sichtfenster, erhöhte Kartenränder
und gedrehte Kamera ohne sichtbares Ende oder Durchblick unter das Terrain.
Lebendige Randgestaltung soll aus passender Verteilung vorhandener Dekoration entstehen,
nicht aus unnötig großer Kulisse oder pauschal erhöhten Instanzbudgets.
Noch offen:
visuelle Abnahme auf Zielgeräten, kleine Querformate, lange Briefings, Fokusführung und
Screenreader-Bedienung. Reduzierte Filterkosten sind kein gemessener Performancegewinn;
GPU-/Gerätemessungen erst mit konkretem Vergleichsziel.
