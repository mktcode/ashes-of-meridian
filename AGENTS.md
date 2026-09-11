# Arbeitsregeln für KI-Assistenten

## Orientierung

- Einstieg und Startanleitung: [README.md](README.md).
- Vor strukturellen Änderungen [docs/architecture.md](docs/architecture.md) lesen; Ist-Zustand und noch nicht implementiertes Zielbild unterscheiden.
- `index.html`, `styles.css` und die lokalen JavaScript-Dateien sind handgepflegte Quellen und werden direkt ausgeliefert. Kein Build, keine npm-Abhängigkeiten. Skripte, Stylesheet und Bilddateien liegen neben dem HTML; Texturen sind teilweise zusätzlich eingebettet.

## Leitplanken

- Direktes Öffnen über `file://` als Ziel erhalten. Keine erforderlichen Server, CDN-Abhängigkeiten, Laufzeit-Imports oder Paketinstallationen zum Spielen einführen. Browsergrenzen nicht durch abschwächende Sicherheitsflags umgehen.
- Zusammenhängende, geprüfte Änderungen eigenständig committen. Fremde oder bereits vorhandene unzusammenhängende Änderungen nicht in den eigenen Commit aufnehmen.
- Formatierung, strukturelles Refactoring und absichtliche Verhaltensänderungen getrennt halten. Keine beiläufigen Änderungen an Balancing, Darstellung oder Spielregeln; bekannte Probleme nicht stillschweigend im Refactoring korrigieren.
- Seedbasierte Hindernisverteilung, Kollisionsradien und RNG-Aufrufreihenfolge schützen. Auch kosmetische Effekte verwenden teilweise den Simulations-RNG. Layout-Prüfsummen nicht nur zur Reparatur fehlgeschlagener Tests neu erzeugen.
- Entwicklungsprototyp: Keine Rückwärtskompatibilität, Spielstandmigrationen oder Legacy-Adapter ohne ausdrücklichen Auftrag. Alte Spielstände dürfen durch Änderungen unbrauchbar werden.
- Schnell und zielgerichtet liefern: kleinste sinnvolle Änderung, passende Tests, kurze Dokumentation. Keine vorsorglichen Zusatzsysteme.
- Keine Assets löschen, austauschen oder neu kodieren, nur weil sie redundant erscheinen. Externe PNGs und eingebettete Texturen werden derzeit nicht automatisch synchronisiert.

## Prüfen und dokumentieren

- Prüfaufwand nach Risiko wählen: Nach JavaScript-Spielcode-/Teständerungen grundsätzlich den vollständigen Node-Befehl aus [docs/testing.md](docs/testing.md) ausführen. Ausnahme: Für mechanische, verhaltensneutrale JavaScript-Kleinständerungen (z. B. lokale Konstantenextraktion bei unverändertem Wert) genügen Syntaxprüfung der betroffenen Dateien und Diff-Sichtung. Bei Änderungen an Spiellogik, RNG, Schnittstellen oder Tests sowie im Zweifel bleibt der vollständige Lauf Pflicht. Für reine Dokumentation oder minimale, risikoarme Text-/Rahmen-/Abstandsänderungen genügen Diff-Sichtung und passende statische Prüfungen; keine zusätzlichen Browsertests auf Vorrat.
- Bei Änderungen an Eingabe, Layoutstruktur, Rendering oder Auslieferung gezielt `file://` prüfen. Node-Tests sind kein Browser-/WebGL-Nachweis; Headless-Touch ist kein Echtgerätetest.
- `docs/` als kurze, aktuelle Referenz pflegen. Geänderte Zuständigkeiten, Bedienung, Befehle und offene Entscheidungen direkt nachführen, statt Nachträge anzuhängen. Keine eigene Berichtdatei für jede Änderung.
- Das einzige fortlaufende Arbeitsprotokoll ist [docs/worklog.md](docs/worklog.md): kurze zusammenhängende Einträge mit Änderung, Prüfung/Ergebnis und relevanten offenen Grenzen. Tatsächlich ausgeführte Prüfungen von älteren Nachweisen unterscheiden; keine ausführlichen Tool-/Screenshot-Protokolle in Referenzdokumenten.
- Bei Dokumentationspflege regelmäßig veraltete Angaben, Wiederholungen und tote Links entfernen; ältere Protokolleinträge verdichten. Details bleiben in Git auffindbar. Diese Datei enthält nur Regeln, keine Arbeitshistorie.
