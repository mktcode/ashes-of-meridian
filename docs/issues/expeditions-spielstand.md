# Expedition: verbleibende Spielstandsabnahme

## Vertrag und Prüfgrenze

Das manuelle Feedback zur Implementierung ist positiv. Gezielte Persistenz-/UI-Regressionen sichern Snapshot-Restore mit einem begrenzten Fortsetzungstick, RNG/Sicht/Navigation, laufende Aufträge und Fähigkeiten, Spieler-/Gegner-Kistenverbrauch, ursprüngliche Gefechtsupgrades, Autosave/`pagehide`, pausiertes Continue, Neustartsperre, Vorteilsbestätigung, einmalige Auszahlung und Speicherfehler ab. Keine breite Suite, KI-/Simulationslangläufe oder Browserautomatisierung als Abnahmenachweis.

Maßgeblicher Vertrag: [Speichern und Lebenszyklus](../gameplay.md#speichern-und-lebenszyklus), technische Grenzen in der [Architektur](../architecture.md#zustands--und-verantwortungsgrenzen). Alte reine Startcheckpoints werden nicht übernommen, permanente Profilwerte bleiben erhalten. Diese Abnahme umfasst keine Migrationen, historischen Gefechtsstände, Replay, Multiplayer-Persistenz oder Offline-Fortschritt. Die separat geplante Erweiterung für [Stage-Wiederbesuche und Weiterbau](stage-wiederbesuche.md) verändert künftig Archiv-, Ergebnis- und Speichergrenzen; deren neue Nachweise gehören in das verlinkte Fachissue, nicht zum bisherigen Abnahmenachweis.

## Offene menschliche Grenzen

- [ ] Tutorial während Ankunft, Aufklärungsflug und Wirtschaftszielen unterbrechen: Kamerafahrten werden übersprungen, Ziele erhalten und die Kamera bleibt bedienbar. Die technische Restore-Regression ersetzt keine Abnahme der tatsächlichen Kamerafahrten.
- [ ] Unter `file://` und Webhosting sowie mobil Hintergrund, Prozessende und bestmöglich Grafikverlust abnehmen. Nach hartem Abbruch ist Rücksprung zum letzten erfolgreichen Autosave zulässig; keine Verlustfreiheit beim Schließen zugesagt.
- [ ] Sichtbarkeit und Verständlichkeit der Speicher-Ausfallmeldung, des Einstellungsstatus, der Warnung vor Menüwechsel und des expliziten Verwerfens beschädigter Saves menschlich abnehmen. Automatisierung sichert Zustandsverträge, nicht vollständige Dialog-/Geräteabläufe.
- [ ] Speichergröße und synchrone Save-Kosten am konkreten Spielstand/Zielgerät messen. `window.Meridian.ui.battleSaveBytes` zeigt die geschätzte UTF-16-Payloadgröße des gemeinsamen Saves, `battleSaveMilliseconds` die letzte Snapshot-/Speicherdauer; keine tatsächliche Browserquota- oder Speicherresidenzmessung. Fünfsekundenintervall und kompaktes Rasterformat danach beurteilen, kein vorsorglicher Storage-Umbau.

Technischen Browsercheck nur bei einer konkreten verbleibenden Lade-/Lebenszyklusfrage; [Prüfwahl](../testing.md) beachten. Verbundene Abnahme: [vollständige Runs](playtest-validation.md), [prozedurale Karten](procedural-battlefields.md), [Android](android.md), [mobile Grafikabbrüche](mobile-performance.md). Autosaves beheben nicht die Ursache von Grafikabbrüchen. Lokale Speicherung ist nicht manipulationssicher; gleichzeitiges Spielen desselben Profils in mehreren Tabs ist nicht koordiniert.
