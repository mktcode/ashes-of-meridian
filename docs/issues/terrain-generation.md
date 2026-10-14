# Terrain und Gefechtsstarts

## Generierungsabbrüche

- [ ] `alien-planet` und `haven`, Seed `16053245`, auf `8f4580b` im reinen CPU-Aufbau:
  `Cannot connect broad terrain shelf with a safe ramp`, vor Dekor/Rendering/Simulation.
  Rezepte `broken-crater`/`basin`. Westliche Hochfläche ungefähr `x=-154…-106`, `z=-4…39`
  mit 182 Zellen bleibt vom breiten Hauptnetz (10.252 Zellen) getrennt.
  Wirtschaft/HQ-Stützen und Gesamt-/Sektorabdeckung bestehen anfänglich; die Insel
  überschreitet die anschlusspflichtige Grenze. Von 48 geprüften Rampenalternativen
  scheitern 22 am Höhenprofil, 22 an Breite, vier würden Wirtschaftswege trennen.
  Anschlussauswahl und Rampenprofil gemeinsam mit bestehenden Wegen untersuchen.
  Kein Ersatzseed oder Abschalten von Insel-/Breiten-/Klippenschutz.
- Historischer [Frontier-/Evakuierungsfall](expeditions-spielstand.md) separat; beide
  Befunde sind keine universelle Seedabnahme und nicht auf aktuellem Stand neu ausgeführt.

## Starts und Wirtschaft

- [ ] Tutorial-Ressourcenstart und Erkundung erfahrener Profile mit bezahltem HQ,
  Bonusworker/Commander und Fortsetzen menschlich spielen.
- [ ] Nach [Fixturepflege](test-und-werkzeugpflege.md) und separater Freigabe echten
  KI-HQ-Abschluss beobachten: Ressourcen entdecken, Fundament bezahlen/fertigstellen,
  Unterbrechung übernehmen, Wirtschaft starten. Screenshot eines festhängenden
  Gegnerworkers ohne Seed/Save bleibt unzugeordnet; Ausweichkorrektur beweist keinen Originalabschluss.
- [ ] Knappe Bauflächen und mehrere Worker an offenen Kristall-Halbkreisen/benachbarten
  HQs abnehmen. Vergleichsseeds Desert `1`, `3`, `1409`: lokale HQ-/Raffinerieproben
  bestanden, tatsächlicher Bauabschluss/Verkehr offen. Sanfte Hangfundamente und
  kleine Stützflächen müssen ohne sichtbare Großplateaus funktionieren.
- [ ] Zwei-/Vierparteienstarts: Mindestabstand, faire erreichbare Wirtschaft und seltene
  konkurrierende Erst-HQs am selben Vorkommen. Nähepräferenz beweist keine Startfairness.
- [ ] Vorratsfunde: Lesbarkeit/Mengenstufen, Bodenkontakt, Auffindbarkeit und einmalige
  Bergung durch Spieler/Gegner; Mengenfeedback und Bergungston im Gefechtszoom.

## Wege, Höhen und Spielbarkeit

- [ ] Geländefolgende Trassen im [Viewer](../scene-capture.md) beurteilen: Pässe/Umgehungen
  statt unnötiger Gräben, Aufschüttungen oder langer Umwege. Abtrag/Höhenprofile sind
  Näherungen, Gerade-/Datum-Referenz keine vollständig geprüfte alte Welt.
- [ ] Breite Rampen in beide Richtungen mit echten Gruppen, Gegenverkehr und Ausgängen;
  Picking/Minimap/Hangposen. Statischer Freiraum ist kein Livenessnachweis.
- [ ] Hänge, Wirtschaft, Fundamente und Erweiterungsflächen für verschiedene Körper/
  Parteien; keine Arbeit durch Klippen. Gewünschte absichtliche Walling-Regel offen.
- [ ] Bodensicht oben/unten/Rampenmitte, Quellenvereinigung/-verlust, Flugzeug/Scan.
- [ ] Größere Karten: Erkundungsdauer und Expansion. Plateau-/Passvorteile sind keine
  Symmetriegarantie; Kämpfe hinter Desert-Wänden im Run prüfen.

Interessante Nutzerseeds: `30227062`, `39095729`, `69454296`, `62745379`, `8115531`, `19763024`.
Familienzuordnung, Viewer-Rezept/Build und gewünschte Komposition fehlen noch.
Keine Seed-Whitelist; langweilige Beispiele auf Nutzerwunsch nicht weiterführen.

Bildwirkung unter [Darstellung](landschaften-und-taktische-darstellung.md),
Workerstillstände unter [Navigation](navigation-worker-und-gruppenankunft.md),
Kosten unter [Performance](performance-und-mobilstabilitaet.md).
