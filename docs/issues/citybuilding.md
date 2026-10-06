# Citybuilding: Siedlungsaufbau nach dem Gefecht

Planung, keine Implementierungs- oder Testfreigabe. Ziel ist ein RTS-/Citybuilding-Hybrid mit bewusst reduziertem zivilem Aufbau, nicht eine zusätzliche Verwaltungssimulation.

## Festgelegte Richtung

- Ziviles Bauen bleibt während laufender Gefechte vollständig außen vor. Der Siedlungsaufbau beginnt erst nach dem militärischen Sieg auf derselben Welt.
- Das vorhandene **Meridian Forum** dient als Siedlungszentrum; für den Einstieg wird kein neues 3D-Modell benötigt.
- Wenige verständliche Regeln, räumliche Entscheidungen und sichtbares Wachstum statt laufender Mikroverwaltung. Kein komplexes Straßen-, Verkehrs-, Steuer- oder Produktionskettensystem als Ausgangspunkt.

## Ausgangslage und Abhängigkeiten

Derzeit sind Zivilisationsgebäude Teil des regulären Baumenüs und auch während Gefechten verfügbar. Sie liefern Civilization Score, aber keine Bevölkerung oder Versorgung. Das Forum ist erst nach Freischaltung von Stage 4 baubar. Score-Schwellen sperren weitere Gefechte; abgeschlossene Welten können zum Weiterbauen besucht werden. Maßgebliche aktuelle Regeln: [Wirtschaft, Bau und Produktion](../gameplay.md#wirtschaft-bau-und-produktion).

Die neue Rolle des Forums erfordert eine Entscheidung über seine frühe Verfügbarkeit und Finanzierung. Bestehende Gebäudewerte, Score-Schwellen und Freischaltungen werden durch dieses Planungsissue noch nicht geändert.

## Zu planender erster Ablauf

Vorschlag zur Diskussion, noch kein festgelegter Mechanikvertrag:

1. Nach dem Sieg bietet der Übergang einen klaren Einstieg in den Siedlungsaufbau.
2. Der Spieler wählt einen Standort und errichtet dort das Meridian Forum.
3. Anschließend baut er erste Wohngebäude; die Siedlung wird sichtbar belebt.
4. Weiterbauen, spätere Weltbesuche und der Übergang zum nächsten Gefecht bleiben verständlich erreichbar.

## Offene Entscheidungen

- [ ] **Minimaler Kern:** Reichen Forum und Wohnen für den ersten Schritt? Abstrakte Bevölkerung und eine zusammengefasste Versorgung im Forum-Radius prüfen; keine einzelnen Bürger oder Arbeitsplätze verwalten. Verhältnis zur militärischen Supply festlegen.
- [ ] **Standort und Viertel:** Versorgungsradius, ein oder mehrere Foren pro Welt, sinnvolle Verdichtung und Erweiterung bestimmen. Vorhandene Landschaft und Infrastruktur nutzen, ohne Straßenpflicht oder Terraforming einzuführen.
- [ ] **Gründungsressourcen:** Aufbau auch nach einem ressourcenintensiven Sieg ermöglichen. Zweckgebundenes Gründungspaket versus bestehende Wirtschaft abwägen; Forum-Kosten und bisherige Stage-4-Sperre ausdrücklich klären.
- [ ] **Baumenü und Einstieg:** Eigenen Siedlungsbereich prüfen. Während des Gefechts ausblenden oder mit verständlicher Freischaltbedingung sperren? Ergebnisansicht, Vorteilswahl und erste Bauaufgabe zusammen planen.
- [ ] **Progression und Nutzen:** Rolle des Civilization Score neu bestimmen: Pflichtschwelle, freiwilliger Ausbau oder andere Kopplung? Gebäude-Spam und Warte-/Baupflicht vor dem nächsten Gefecht vermeiden. Mögliche Forschungs-/Industrie-/Kulturschwerpunkte nur bei Bedarf ergänzen, nicht als beschlossen behandeln.
- [ ] **Sichtbares Wachstum:** Bewohnte Fenster, dezentes ziviles Leben oder erkennbare Viertelentwicklung priorisieren. Bestehende Nachtatmosphäre nutzen; keine zusätzlichen Tageszeit-Strafen voraussetzen.
- [ ] **Weltbesuche und Grenzen:** Weiterbau, Speichern/Fortsetzen, zerstörtes oder verkauftes Forum und ausgeschöpfte Ressourcen berücksichtigen. Keine Änderungen an Gefechtsregeln, Militärwirtschaft oder Run-Lebenszyklus ohne eigene Entscheidung.

## Abgrenzung und spätere Abnahme

[Progressionsbalance](expeditions-schwierigkeit-und-upgrades.md) behandelt die Abnahme der bestehenden Score-Kurve; die künftige Citybuilding-Regelplanung liegt hier. [Weltbesuche/Spielstand](expeditions-spielstand.md), [Modellabnahme](modelle.md) und [menschliche Run-Abnahme](playtest-validation.md) bleiben in ihren Fachissues.

Nach Festlegung eines kleinen ersten Mechanikumfangs gezielt prüfen: verständlicher Wechsel vom Gefecht zum Aufbau, Gründung ohne Ressourcen-Sackgasse, sinnvolle Standortwahl, Rückkehr in eine bestehende Siedlung und Fortschritt ohne repetitiven Pflichtbau. Visuelle Wirkung und Spielgefühl benötigen menschliche Abnahme; daraus folgt noch keine Ausführungsfreigabe.
