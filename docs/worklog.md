# Arbeitsprotokoll

Kompakter Übergabestand und letzte Prüfnachweise. Ältere Implementierungs-, Diagnose- und Refactoringprotokolle liegen in Git. Neue Einträge kurz halten; Regeln und offene Prioritäten direkt in den Referenzdokumenten pflegen.

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
