# Aurelion / Echo-Bergung: offene Spiel- und Modellabnahme

## Stand und Grenze

Der freigegebene Bergungsauftrag ersetzt King of the Hill vollständig: detaillierter fremdartiger Reaktorkern statt Globus, Worker-Rücktransport und gesicherte Fragmente statt Einheitenmehrheit/Haltetimer. Maßgebliche [Spielregeln](../gameplay.md#echo-bergung-auf-aurelion) und [Missionsvertrag](../architecture.md#einzelspieler-missionen). Kein Holdout, keine Multiplayer-Erweiterung.

Nach dem Build startet `index.html?experiment=aurelion-playable` einen flüchtigen Probelauf auf Stage 4 mit drei Parteien und je zwei Workern. Worker auswählen und den markierten Kern antippen/anklicken; der Auftrag wiederholt Bergung und HQ-Rücktransport. Permanente Browserdaten bleiben unberührt. Die separate Visualstudie wurde entfernt; verbleibende [Karten-/Darstellungsbefunde](aurelion-map.md) beziehen sich auf die spielbare Karte.

Alte Hügel-Checkpoints werden wegen der entfernten Missionskennung verworfen, nicht umgedeutet. Permanente Upgrades/Reserve bleiben erhalten. Die neue Bergungseinführung besitzt ihren eigenen Abschlussmarker.

## Menschlich zu prüfen

- [ ] Reaktorkern als Mittelpunkt: kristalline Facetten, zerborstene Einfassung, Radiatoren, Befestigungen und eingelassene fremdartige Zeichen beurteilen. Leuchtringe sind im Spiel zurückgenommen, damit sie die Kristalle nicht überstrahlen. Die gesamte neue Geometrie bleibt auf dem bestehenden gesperrten Sockel; keine Änderung an Wegen, Kollisionsradien oder Lampenpositionen.
- [ ] Verständlichkeit von Einführung, Bergungsauftrag, Fracht und gesicherter Punktzahl. Gemischte Auswahl schickt nur Worker zur Bergung; Kampfeinheiten behalten Bewegungs-/Kampfbefehle. Abgebrochene Transporte behalten Fracht an Bord, bis der Bergungsauftrag erneut erteilt wird.
- [ ] Wirtschaft, Bergung und Eskorte gegeneinander abwägen: Zielwert 100 und Transportrate sind ein erster Balancingstand. Die KI reserviert Wirtschaftsworker, entsendet Sammler, eskortiert beladene Worker und sichert das Zentrum; echte FFA-Partien, Gegenverkehr und Angriffe auf Transportwege sind noch menschlich zu bewerten.
- [ ] HQ-Wiederaufbau mit überlebendem Worker und vorhandenen Mitteln, sofortige Niederlage ohne fertiges HQ und Worker, Ergebnis/Vorteilswahl sowie Reload desselben Gefechtsanfangs prüfen. Bei gleichzeitigem Zielerreichen im selben Tick gilt wie bei gleichzeitiger Eliminierung die konservative Spielerniederlage; kein Vorteil durch Entitätsreihenfolge.
- [ ] Nachtlesbarkeit, Bedienbarkeit und Kosten auf Zielgeräten. Das hohe Stadtbudget und fehlende Hindernisvermeidung von Flugzeugen an hohen Dekorbauten bleiben offene Grenzen. Keine allgemeine Karten-/Darstellungsabnahme durch die Umsetzung.

## Prüfgrenze

Begrenzte Bergungs-, Eingabe-, Checkpoint- und Modellregressionen ersetzen keine autonome Partie, Balancing-, visuelle oder Echtgeräteabnahme. Umfangreiche KI-/Simulationsläufe benötigen einen ausdrücklichen aktuellen Auftrag; [Prüfverfahren](../testing.md). Ressourcen-/RNG-Isolation und bestehender Sockelumriss bleiben technische Schutzverträge.
