# KI: Bauversuche und Strategietimer entkoppeln

Zwei Controller-Randfälle nach der Doktrin-Implementierung reproduziert. Keine Freigabe für ein breites KI-Refactoring; Fehlerkorrekturen mit gezielten Regressionen getrennt halten.

## Bau-Fallback wird vom gemeinsamen Retry-Timer blockiert

`src/simulation/ai.ts`: `aiBuild()` setzt `nextBuild` bereits vor der erfolglosen Platzsuche. `aiEconomy()` versucht danach zwar weitere Kandidaten, diese scheitern jedoch am gerade gesetzten gemeinsamen Timer. Beim nächsten erlaubten Versuch erhält wieder derselbe erste Kandidat den Vorrang.

Prüfkontext: Nach aktuellem Build isolierter VM-Controllerfall auf Desert, Seed 1409, gegnerische Free Marches, vorhandene Barracks/Turret/Factory und eine Raffinerie am einzigen bekannten Vent; freie Worker und genügend Ressourcen. Economy-Aufrufe bei Zeit 0/4/8 scheiterten jeweils zuerst an der zweiten Raffinerie und anschließend am Hangar, mit `nextBuild` 3/7/11. Ein direkter regulärer `aiBuild('hangar')`-Aufruf bei Zeit 12 gelang. Kein vollständiger autonomer Run in diesem Prüfkontext.

Folge: Ein nicht platzierbares Prioritätsgebäude kann den weiteren Doktrinausbau blockieren, solange sich die Lage nicht ändert. Der Kommentar zum Raffinerie-Fallback verspricht damit mehr als der Code leistet.

Korrekturrichtung: Platzsuche, Kandidatenauswahl, Ressourcenreservierung und Wiederholungsbudget unterscheiden. Ein fehlgeschlagener Kandidat darf nicht sämtliche Alternativen dauerhaft verdrängen; die Begrenzung teurer Platzsuchen muss erhalten bleiben. Regression mit belegtem einzigem bekannten Vent und nachweislich baubarem Folgegebäude ergänzen, ohne `aiBuild` durch eine Erfolgsmockfunktion zu ersetzen.

## Zielneubewertung setzt die Angriffsuhr zurück

`aiStrategy()` verwendet `lastAttack` für Angriffsbeginn, erneute Zielwahl und Rückzugsbeginn. Ist eine Gruppe am Ziel, kann die erneute Wahl desselben Ziels `lastAttack` in jedem Strategietick zurücksetzen. Die neue Erschöpfungsprüfung verlangt dagegen mehr als sechs Sekunden seit `lastAttack`; auch die bestehende maximale Angriffsdauer verwendet diesen Wert.

Prüfkontext: Isolierte Strategieaufrufe auf Desert, Seed 1409, acht Court-Rifle-Einheiten mit leeren Schilden, sichtbarer schwacher Rifle-Kontakt innerhalb des erreichten Ziels und außerhalb der Heimatverteidigungszone. Angriffsuhr zunächst 99; Aufrufe von Zeit 100 bis 112 hielten den Modus durchgehend auf `attack` und setzten `lastAttack` jeweils auf die aktuelle Zeit. Keine Simulationsschritte oder Schildregeneration zwischen diesen Controlleraufrufen. Ein Ziel außerhalb des Ankunftsradius löste dagegen den erwarteten Rückzug aus.

Korrekturrichtung: Beginn eines Angriffs, Zielwechsel und Erholungsbeginn eindeutig trennen. Zeitgrenzen müssen an den passenden Zustandsübergängen hängen, nicht an wiederholter Befehlsausgabe. Regression für wiederholte Bewertung eines bereits erreichten Ziels und nachfolgende Erschöpfung ergänzen.

## Prüfung nach Korrektur

Neben den gezielten Controllerregressionen die bestehenden autonomen Partien einschließlich hoher Tiefe ausführen; keine Ergebnisanforderungen oder Zeitgrenzen zum Grünmachen abschwächen. Gemeinsame KI-/Simulationsverträge abschließend mit der Gesamtsuite prüfen. Ob die Korrekturen menschlich zu deutlich stärkerem Gegnerdruck führen, bleibt Teil der [Run-Validierung](playtest-validation.md).
