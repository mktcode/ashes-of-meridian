# Multiplayer: Netzwerk- und Sitzungsarchitektur

Abhängig vom [Simulationsmodell](multiplayer-simulationsmodell.md).

- [ ] Autoritätsmodell wählen und prototypisieren: bevorzugt serverautoritativ oder belegtes deterministisches Lockstep.
- [ ] Lobby, Beitritt, Sitzplatzzuweisung, Bereitschaft, Befehlsübertragung und Versionsprüfung definieren.
- [ ] Desync-Erkennung, Latenz, Abbruch und Wiederverbindung mindestens für ein laufendes Gefecht behandeln.
- [ ] Sicherheits- und Betriebsgrenze klären: Der aktuelle statische `file://`-Client besitzt weder Backend noch Netzwerktransport.
- [ ] Lokales Einzelspiel und direkte `file://`-Auslieferung weiterhin ohne Multiplayerdienst startbar halten.
