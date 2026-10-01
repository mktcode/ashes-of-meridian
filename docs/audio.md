# Audio und Sprachinhalte

Lokale Laufzeitaufnahmen liegen unter `audio/`; Entwürfe bleiben außerhalb dieses Verzeichnisses. MP3s unverändert übernehmen, nicht bei jedem Build erneut encodieren. Audio wird über lokale HTML-Medienelemente geladen, ohne `fetch`, Server oder gelockerte `file://`-Sicherheit. Die prozeduralen Effekte und Menümusik bleiben Web Audio. [Musikherstellung](../music-drafts/README.md#herstellung-und-grenzen).

## Sprachzeilen pflegen

`src/voice-content.ts` ist der maßgebliche Katalog: stabile Zeilen-ID, Sprecher, englischer Text und optionale lokale Aufnahme gehören zusammen. Tutorial-Code referenziert IDs statt Text oder Dateinamen. Ohne Aufnahme bleibt die Zeile als Text spielbar; Lade-/Autoplayfehler dürfen den Tutorialfortschritt nie blockieren. Auswahltexte sind dort ebenfalls hinterlegt, werden aber nicht als zusätzliche Dialogbox eingeblendet.

1. Aufnahme nach `audio/voices/` kopieren. Nur freigegebene Laufzeitdateien, keine Entwürfe oder temporären Exporte.
2. Text gegen die Aufnahme prüfen und den Katalogeintrag gemeinsam aktualisieren. Zeilen-ID beibehalten, solange ihre Bedeutung gleich bleibt; Dateinamen sind kein Ablaufvertrag.
3. Für Auswahlmeldungen die ID in `SELECTION_VOICE_LINES` dem technischen Einheitentyp zuordnen. Mehr Varianten brauchen keinen Controller-Umbau. Fehlende Zuordnungen fallen beim normalen Anwählen auf den bisherigen Auswahlton zurück. Neue Rollen/Fraktionsstimmen ausdrücklich zuordnen, nicht aus Dateinamen erraten.
4. Bauen und die betroffenen Audio-/UI-Verträge prüfen; Aufnahme, Text, Katalog und Paketweg zusammen committen. Akustik, Aussprache und Mischung bleiben menschliche Abnahme.

Die ZIP-Auslieferung liest Aufnahmewege aus dem gebauten Katalog und bricht bei fehlenden Dateien ab. Docker führt das gesamte freigegebene `audio/voices/`-Verzeichnis mit. Dateien dort nicht ohne Katalogeintrag sammeln. [Auslieferung](deployment.md).

## Wiedergabevertrag

- Ein wiederverwendeter Sprachkanal, keine Warteschlange: aktuelle Auswahlmeldung ersetzt eine ältere; Tutorialdialoge haben Vorrang und dürfen nicht von Auswahlmeldungen abgeschnitten werden.
- Normale Auswahl nimmt eine zufällige passende Zeile der lebenden eigenen ausgewählten Einheiten. HUD-Gruppenauswahl erzeugt genau eine zufällige Meldung; ohne passende Aufnahme fällt sie auf den gesamten Auswahlpool zurück. Leere, fremde und tote Einheiten erzeugen keine Auswahlstimme.
- Schnelle Wiederholungen sind begrenzt; direkt dieselbe Aufnahme wird vermieden, sofern Alternativen existieren. Zufall ist ausschließlich Audio-/Präsentationszufall, niemals Simulations-RNG.
- Stimmen folgen Gesamtlautstärke und SFX-Schalter, nicht dem Musikschalter. Gefechtsmusik wird während Sprache leiser und danach zurückgestellt.
- Pause/Hintergrund hält Dialogsprache an und verwirft Auswahlmeldungen. Explizites Fortsetzen setzt den Dialog an derselben Stelle fort. Menü, neues Gefecht, Ergebnis, Perspektivwechsel, Dialogschließen oder Stummschaltung verwerfen passende alte Sprache. Keine verspäteten Wiederholungen nach Ladefehlern.
- Untertitel verschwinden nicht vor dem Ende ihrer laufenden Aufnahme. Kamerafahrten und Simulation warten nicht auf Audio: stumme oder fehlgeschlagene Wiedergabe bleibt vollständig bedienbar.

Weitere Sprachereignisse über denselben Katalog und Kanal ergänzen. Avatare, neue Lautstärkeregler oder Lokalisierung erst bei konkretem Auftrag; keine parallelen Text-/Audiosollquellen anlegen.
