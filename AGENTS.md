# Einstieg für KI-Agenten

## Orientierung

1. [README.md](README.md) für Start und Projektüberblick lesen, `git status --short` prüfen.
2. Betroffenes [Issue](docs/issues/), Quellen und Tests erkunden; `rg`/`find` statt einer gepflegten Codekarte nutzen.
3. Fachreferenzen nur nach Bedarf lesen: [Spielregeln](docs/gameplay.md), [Architektur](docs/architecture.md), [Grafik/Assets](docs/rendering.md), [Prüfverfahren](docs/testing.md). Vor strukturellen Änderungen Architektur lesen.

## Leitplanken

- Kleinste sinnvolle Änderung; Formatierung, strukturelles Refactoring und Verhaltensänderungen getrennt halten. Keine beiläufigen Änderungen an Balancing, Darstellung oder Regeln; bekannte Probleme nicht stillschweigend korrigieren.
- Breites Refactoring und weitere TypeScript-Migration bleiben ohne neuen Auftrag pausiert. Issues und Prüfprioritäten sind keine automatische Implementierungsfreigabe.
- Seedbasierte Hindernisverteilung, Kollisionsradien und RNG-Aufrufreihenfolge schützen. Auch kosmetische Effekte nutzen teilweise den Simulations-RNG. [Referenzwerte](docs/reference-tests.md) nicht zur Reparatur fehlgeschlagener Tests neu erzeugen.
- Entwicklungsprototyp: keine Rückwärtskompatibilität, Migrationen oder Legacy-Adapter ohne ausdrücklichen Auftrag.
- Quellen statt Build-Ausgaben bearbeiten; `dist/` nie direkt bearbeiten oder einchecken. Die generierte `src/renderer/assets.js` ausschließlich mit `npm run embed:textures` aus den Texturquellen aktualisieren.
- Bildassets ausschließlich als WebP mit Qualität 80 pflegen, keine PNGs einchecken. Assets nicht wegen vermeintlicher Redundanz löschen oder austauschen; [Pflegeverfahren](docs/rendering.md) beachten.
- Direkte `file://`-Auslieferung erhalten: kein erforderlicher Server, CDN, Laufzeit-Import oder abgeschwächte Browser-Sicherheitsflags.
- Zusammenhängende, geprüfte Änderungen eigenständig committen. Fremde oder unzusammenhängende vorhandene Änderungen nicht aufnehmen.

## Risikobasiert prüfen

- Prüfungen nach betroffenem Verhalten und Reichweite wählen, nicht pauschal nach Dateiendung. Lokale Änderungen brauchen meist Build und gezielte Tests; mechanische, verhaltensneutrale Kleinständerungen können mit Build und Diff geprüft werden.
- Gesamtsuite bei gemeinsamen Simulations-/RNG-/Ladeverträgen, breiten Eingriffen oder nicht sinnvoll eingrenzbaren Auswirkungen. Längere Simulationen gezielt für Langzeitverhalten, KI, Navigation und Ökonomie einsetzen; nicht bei jeder Kleinigkeit.
- Dokumentation mit Diff und betroffenen Links/Angaben prüfen. Browserchecks nur bei einer konkreten technischen Fragestellung; keine automatischen Screenshotserien auf Vorrat.
- Visuelle und akustische Abnahme erfolgt durch den Menschen. Technische Prüfung ist keine Darstellungs-, Hör- oder Echtgerätebestätigung. Ausgeführte Prüfungen und relevante offene Grenzen im Abschluss nennen; nötige Folgearbeiten ins Issue. Details und Befehle: [Prüfverfahren](docs/testing.md).

## Dokumentation pflegen

- Dokumentiere dauerhafte Entscheidungen, Begründungen, nicht offensichtliche Fallen und Pflegeverfahren; keine vollständigen Datei-/Methodenlisten, aus Code ablesbaren Wertetabellen oder nacherzählten Tests.
- Jede Information hat einen maßgeblichen Ort. Andere Stellen verlinken dorthin. README bleibt Einstieg, AGENTS.md Regelwerk; offene Arbeit gehört in Issues, abgeschlossene Historie nach Git. Kein zusätzliches Worklog.
- Bei Änderungen nur tatsächlich betroffene Dokumentation aktualisieren und dort veraltete Angaben, Wiederholungen und tote Links entfernen. Keine routinemäßigen Änderungsberichte oder Testzahlen an Fachreferenzen anhängen.
- Dokumentationsbereinigung ist eine regelmäßige Wartungsaufgabe: bei Wartungsrunden `docs/` auf Relevanz, Redundanzen und erledigte Issues durchsehen. Größere Bereinigungen als eigenen Auftrag bzw. eigenes Issue bündeln, nicht als Nebenarbeit jedes Codeauftrags.

## Issues

- Offene Aufgaben, Entscheidungen, Kommentare und nötige Übergaben ausschließlich in `docs/issues/` führen. Tatsächliche Befunde knapp mit Prüfkontext festhalten, nicht jeden Arbeitsschritt protokollieren.
- Auswirkungen auf andere bestehende Issues dort ergänzen. Erledigte Issue-Dateien löschen; ihre Historie bleibt in Git.
