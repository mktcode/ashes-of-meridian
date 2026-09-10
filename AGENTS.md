# Arbeitsregeln für KI-Assistenten

## Orientierung

- Einstieg und Startanleitung: [README.md](README.md).
- Vor strukturellen Änderungen [docs/architecture.md](docs/architecture.md) lesen; Ist-Zustand und noch nicht implementiertes Zielbild unterscheiden.
- `index.html` ist aktuell Quelle und Spielartefakt. Kein Build, keine npm-Abhängigkeiten. Bilddateien liegen daneben; Texturen sind teilweise zusätzlich eingebettet.

## Leitplanken

- Direktes Öffnen über `file://` als Ziel erhalten. Keine erforderlichen Server, CDN-Abhängigkeiten, Laufzeit-Imports oder Paketinstallationen zum Spielen einführen. Browsergrenzen nicht durch abschwächende Sicherheitsflags umgehen.
- Formatierung, strukturelles Refactoring und absichtliche Verhaltensänderungen getrennt halten. Keine beiläufigen Änderungen an Balancing, Darstellung oder Spielregeln; bekannte Probleme nicht stillschweigend im Refactoring korrigieren.
- Seedbasierte Hindernisverteilung, Kollisionsradien und RNG-Aufrufreihenfolge schützen. Auch kosmetische Effekte verwenden teilweise den Simulations-RNG. Layout-Prüfsummen nicht nur zur Reparatur fehlgeschlagener Tests neu erzeugen.
- Storage-Schlüssel, Save-/Backup-Versionen, Entitätsdaten und Kampagnenzuordnung nicht ohne ausdrücklichen Kompatibilitätsplan ändern. Exakte deterministische Fortsetzung nach Laden ist derzeit nicht zugesichert.
- Keine Assets löschen, austauschen oder neu kodieren, nur weil sie redundant erscheinen. Externe PNGs und eingebettete Texturen werden derzeit nicht automatisch synchronisiert.

## Prüfen und dokumentieren

- Nach Spielcode-/Teständerungen mindestens ausführen: `node --max-old-space-size=128 --test --test-concurrency=1 tests/ashes-of-meridian-terrain.check.cjs tests/ashes-of-meridian-crystals.check.cjs`.
- Testabdeckung und Browser-Checkliste: [docs/testing.md](docs/testing.md). Bei Änderungen an Darstellung oder Verpackung ausdrücklich `file://` prüfen. Node-Tests sind kein Browser-/WebGL-Nachweis.
- Implementierungs- und Prüfnotizen gehören unter `docs/`, nicht in diese Datei. Ausgeführte Prüfungen, Ergebnisse und ungeprüfte Bereiche klar unterscheiden; historische Berichte nicht als aktuelle Testnachweise behandeln.
- Dokumentation bei geänderten Zuständigkeiten, Befehlen oder Abläufen aktualisieren. Diese Datei kurz und verbindlich halten, keine fortlaufende Arbeitshistorie ergänzen.
