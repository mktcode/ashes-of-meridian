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

## Technischer Prüfkontext

Build, alle 495 Standardtests sowie Serverbuild und 15 kurze Servertests bestanden. Die vier bisherigen Karten behalten gegenüber dem Vor-Missionsstand Startzustände, Terrainraster und die nächsten acht Simulations-RNG-Ziehungen. Das Netzwerkangebot bleibt unverändert.

Begrenzte Verträge prüfen physische Bergung/Anlieferung, getrennte Fracht/Währung, Verlust und Auftragswechsel, Ergebnispriorität, Parteienausscheiden, bezahlte KI-Aufträge, Eingaben und Checkpoints. Worker-only-Prüfung: je ein vollständiger Hin-/Rücktransport aus allen vier Starts, ohne KI-Gefechtslauf. Modellprüfung: deterministische endliche Geometrie, Normalen, bestehender Sockelumriss und begrenztes Dreiecksbudget. Keine neuen Echtzeitlichter, Shader oder Renderpässe.

Der pausierte Chromium-Check über `file://` (1280 × 900, KI deaktiviert) prüft Zentrumseinführung ohne Gegnerfreigabe, neues Modell und eine gezielt gesetzte Bergungs-/Lieferprobe ohne Echo-Gutschrift. Keine JS-/GL-Fehler oder HTTP(S)-Anfragen. Die temporären Bilder und Logs wurden bei der Repo-Bereinigung gelöscht; dieser Prüfkontext bleibt erhalten. Das ist keine autonome Gefechts-, visuelle oder Echtgeräteabnahme. Umfangreiche KI-/Simulations-Langläufe sind nicht beauftragt.
