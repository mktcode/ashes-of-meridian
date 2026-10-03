# Expedition: Spielstand und Neustartsperre abnehmen

## Status und Vertrag

Snapshot-/Restore, Autosaves, pausiertes Continue und die Entfernung des Gefechtsneustarts sind implementiert. Profil und Expedition besitzen einen gemeinsamen Speicherabschluss für Ergebnis und Echo-Auszahlung. Der aktuelle Stand ist nur durch TypeScript/Build und statische Diffprüfung abgesichert; menschliche Abnahme und automatisierte Regressionen stehen aus.

**Nutzerreihenfolge:** zuerst manuelles Feedback. Vor Anpassung oder Ausführung von Tests erneut Bescheid geben; bis dahin keine Tests ändern oder starten. Die Freigaben für breite Läufe und `test:ai`/`test:simulation` bleiben zusätzlich erforderlich.

Maßgeblicher Vertrag: [Speichern und Lebenszyklus](../gameplay.md#speichern-und-lebenszyklus), technische Grenzen in der [Architektur](../architecture.md#zustands--und-verantwortungsgrenzen). Alte reine Startcheckpoints werden nicht übernommen, permanente Profilwerte bleiben erhalten. Keine Implementierung von Migrationen, frei auswählbaren historischen Gefechten, Replay, Multiplayer-Persistenz oder Offline-Fortschritt.

## Manuelles Feedback zuerst

- [ ] Gefecht mit mehreren Einheiten, beschädigtem Gebäude, laufendem Bauauftrag und Rekrutierungsqueue spielen; Hauptmenü → Continue und Reload → Continue vergleichen. Konten, Befehle, Fortschritt, Erkundung, Kamera und Tempo bleiben erhalten; Wiedereinstieg ist pausiert, Neustart fehlt.
- [ ] Cinder- und Echo-Kisten einsammeln, danach speichern/fortsetzen. Kisten bleiben verbraucht, Gutschriften bleiben genau einmal erhalten; auch gegnerischer Verbrauch darf nicht zurückgesetzt werden. Kistenverteilung und Balancing werden durch die Speicherung nicht geändert.
- [ ] Tutorial während Ankunft, Aufklärungsflug und Wirtschaftszielen unterbrechen. Restore überspringt Kamerafahrten, behält erreichte Ziele und kehrt zu einer bedienbaren Kameraposition zurück.
- [ ] Nach Menüwechsel Flottenupgrades kaufen, dann laufendes Gefecht fortsetzen: nur die ursprünglichen Gefechtsupgrades gelten. Erst das nächste Gefecht übernimmt Käufe. Neue Expedition braucht eine ausdrückliche Bestätigung zum Verwerfen des alten Runs.
- [ ] Sieg, offene Vorteilswahl, gewählter Vorteil, Niederlage und Abandon mit anschließendem Reload prüfen. Keine doppelte Echo-Auszahlung oder Wiederbelebung eines beendeten Gefechts; Landschaftsarchiv bleibt rein visuell.
- [ ] Unter `file://` und Webhosting Speichern/Fortsetzen prüfen; mobil Hintergrund, Prozessende und bestmöglich Grafikverlust abnehmen. Nach hartem Abbruch ist Rücksprung zum letzten erfolgreichen Autosave zulässig; keine Verlustfreiheit beim Schließen zugesagt.
- [ ] Speicher-Ausfallmeldung, Status in Einstellungen und Warnung vor Menüwechsel abnehmen. Fortschritt bleibt dann nur im Tab; beschädigte oder inkompatible Saves bieten explizites Verwerfen, nie einen stillen Gefechtsneustart.

## Danach gezielte Regressionen und Messung

- [ ] Snapshot-Roundtrip und Fortsetzung für Entitätsreihenfolge/IDs, Befehle/Wege, Navigation/Belegung, verzögerte KI-Beobachtungen, Sichtintervalle, laufende Fähigkeiten und RNG-Folge absichern. Wertkopien der KI-Beobachtungen nicht auf Live-Entitäten umbiegen; reine Effekte dürfen ohne neue Simulations-RNG-Draws zurückgesetzt werden.
- [ ] Persistenz-/UI-Fälle für gemeinsames Profil-/Expeditionsschreiben, Ergebniswiederholung, alte Formate, beschädigte Snapshots, Quota-/Lese-/Schreib-/Löschfehler, flüchtigen Fallback, konkurrierende Ladeanfragen und fehlenden Neustartpfad nachziehen. Bestehende Checkpoint-/Neustartannahmen erst nach Feedback ersetzen; keine Referenzen zum Grünmachen regenerieren.
- [ ] Speichergröße und synchrone Save-Kosten am konkreten Spielstand/Zielgerät messen. `window.Meridian.ui.battleSaveBytes` zeigt die geschätzte UTF-16-Payloadgröße des gemeinsamen Saves, `battleSaveMilliseconds` die letzte Snapshot-/Speicherdauer; keine tatsächliche Browserquota- oder Speicherresidenzmessung. Fünfsekundenintervall und kompaktes Rasterformat danach beurteilen, kein vorsorglicher Storage-Umbau.
- [ ] Technischen `file://`-Browsercheck nur für verbleibende konkrete Lade-/Lebenszyklusfragen durchführen. [Prüfwahl](../testing.md) beachten; visuelle, akustische und Echtgeräteabnahme bleibt menschlich.

Verbundene Abnahme: [vollständige Runs](playtest-validation.md), [prozedurale Karten](procedural-battlefields.md), [Android](android.md), [mobile Grafikabbrüche](mobile-performance.md). Autosaves beheben nicht die Ursache von Grafikabbrüchen. Lokale Speicherung ist nicht manipulationssicher; gleichzeitiges Spielen desselben Profils in mehreren Tabs ist nicht koordiniert.
