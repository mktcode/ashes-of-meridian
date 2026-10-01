# UI: offene technische Grenzen

Review-Kontext: Menüs, Codex, Dialoge, Flottenupgrades und Ergebnisansicht;
Gefechts-HUD ausdrücklich ausgenommen. [Designsystem](../ui-design-system.md).

## Fokus und Dialogsemantik

`openModal` ersetzt Markup ohne Dialogrolle, initialen Fokus, Tab-Begrenzung oder
Fokusrückgabe. Hintergrundkontrollen bleiben per Tastatur erreichbar. Auch vollständige
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

Gezielte Browserdiagnose erfolgt über `file://` mit isoliertem Profil. Statische
HUD-Vergleiche schützen keine noch nicht erzeugten dynamischen Elemente. Noch offen:
visuelle Abnahme auf Zielgeräten, kleine Querformate, lange Briefings, Fokusführung und
Screenreader-Bedienung. Reduzierte Filterkosten sind kein gemessener Performancegewinn;
GPU-/Gerätemessungen erst mit konkretem Vergleichsziel.
