# Vollständige Runs und Geräteabnahme

Menschliche Abnahme bleibt offen; technische Regressionen ersetzen sie nicht. Relevante neue Befunde knapp mit Gerät/Browser, Build, Karte/Seed, Stage, Ausstattung und Ergebnis sichern.

## FFA-Expeditionen: gezielte Abnahme

- [ ] Frischer Run: ein Gegner auf Stage 1–3, zweiter Slot ab 4, dritter ab 8. Bestehende Slots behalten getrennte Vorteile bei Fraktionswechsel, neue starten leer; Briefing/Reload muss dazu passen.
- [ ] KI-gegen-KI-Druck, Ausscheiden und HQ-Abschluss beobachten. Gegen passiven/verteidigenden Spieler: erfolgreiche Belagerung fortsetzen, sinnvoller Rückzug bei Bedrohung, Reserven gegen Ablenkung, stabile FFA-Ziele.
- [ ] Militärischen Sieg von Civilization-Score-Freischaltung unterscheiden: live Score, fehlende Punkte, **Continue building**, Vorbauen in älteren Welten und spätere Rückkehr zur Expedition verständlich abnehmen; [Kurve/Bauaufwand](expeditions-schwierigkeit-und-upgrades.md).
- [ ] Einstieg ohne Flottenupgrades und tiefe Ressourcenstapel balancieren; [Progressionsbefunde](expeditions-schwierigkeit-und-upgrades.md). Faire Wege/Wirtschaft aller Eckstarts prüfen.

## Worker-Start und Tutorial

- [ ] Worker-Ankunft, Lesedauer der Textdialoge und Fahrt eigenes HQ → Gegner → eigenes HQ menschlich abnehmen, insbesondere im Hochformat. Platzieren des ersten HQ ohne Vorwissen verständlich?
- [ ] [Supply-Tutorial](../gameplay.md#kamera-und-befehle) im frischen Profil menschlich abnehmen: mehrere Infanterietrupps bis keine weitere Einheit passt, reserviertes Supply in der Warteschlange, Depot platzieren/fertigstellen und verständlicher Abschluss. Lesbarkeit der neuen Text-Funkmeldungen und bleibenden Hinweise im Hochformat, Wartezeit/Ressourcen für die größere erste Armee sowie Gegnerdruck währenddessen beurteilen; kein Balancing geändert. Abbrechen von Rekrutierung/Depot mitprüfen; Fortsetzen gemäß [Spielstandsabnahme](expeditions-spielstand.md).
- [ ] Tutorial-/Auswahlstimmen, Verständlichkeit gegenüber Musik/Kampf, Pause/Fortsetzen, SFX-Stummschaltung und verspätete mobile Autoplay-Freigabe akustisch prüfen. Wortlaut von `infantry-selected-3.mp3` („Pew pew pew yourself!“) gegen die automatische Katalogtranskription bestätigen. [Pflegevertrag](../audio.md).
- [ ] Bezahlten KI-HQ-Aufbau aus Worker-Sicht auf den spielbaren Karten gezielt prüfen; KI-/Simulationsläufe brauchen separate Freigabe. Danach Wirtschaft und frühe Angriffe unter dem längeren Aufbau vergleichen, kein automatisches Balancing.

## Commands und Bedienung

- [ ] Viererauswahl/-reihenfolge, Armory-Ränge, feste Slots/Loadouts über Übergänge und Reload verständlich.
- [ ] Fähigkeiten/Zielbedingungen und dominante Kombinationen im Gefecht; große Gruppen, Recall an belegten HQ-Ausgängen/Höhen und geschützte Reinforcements.
- [ ] [Rechteckauswahl](../gameplay.md#kamera-und-befehle): Haltezeit, Bereitschaftsring und Fingerverdeckung auf echten Touchgeräten abnehmen; frühes Kameraziehen sicher von Halten-und-Ziehen unterscheidbar? Desktop: Linksziehen zur Auswahl und Rechtsziehen zum Kameraschwenken verständlich?
- [ ] Touch unter Last: Pan/Pinch, Tapfolgen, Minimap, kleine Aktionen, Scroll/Back/Zielwahl, Ausrichtung und Hintergrundrückkehr. Desktopsteuerung auch im tatsächlich eingebetteten itch.io-Build.

## Fortschritt und Lebenszyklus

- [ ] Mehrere Siege/Vorteilswahlen, Upgrades, Niederlage/Abbruch und Fraktionsfreischaltungen. Auszahlung nicht durch erneuten Ergebnisaufruf vervielfachen.
- [ ] Profil/Expedition unter `file://` und Webhosting sowie Pause/Audio/Rückkehr menschlich abnehmen; Snapshot-Restore, Run-Ende und Speicherfehler nach [Spielstandsabnahme](expeditions-spielstand.md).
- [ ] Stage-Auswahl: gespeicherte Bebauung/Tageszeit, Pfeile/Labels, weiche Wechsel bei teuren Karten, Reduced motion und Reload. **Continue expedition** lädt die aktuelle Stage, **Enter world** die ausgewählte abgeschlossene Welt; während des Wechsels kein Eintritt. Weiterbau und getrennte Spielstände mit der [Spielstandsabnahme](expeditions-spielstand.md) zusammen prüfen; reine ältere Landschaftsvorschauen bleiben nicht betretbar.

Karten-/Darstellung zentral unter [Landschaften](project-tomorrow.md), Worker-Gegenverkehr unter [Navigation](worker-bauwegfindung/issue.md), Wärme/Stabilität unter [Performance](mobile-performance.md). Keine automatische Test-/Balancingfreigabe aus dieser Liste.
