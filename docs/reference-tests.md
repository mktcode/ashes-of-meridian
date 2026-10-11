# Feste Testreferenzen

**Sollwerte niemals allein wegen eines Fehlers neu erzeugen.** Ursache und beauftragten Umfang klären; nur betroffene Erwartungen ändern und unabhängig absichern. Mechanische Auslagerungen müssen vorhandene Referenzen unverändert treffen.

Fixtures prüfen ausgewählte CPU-/Zeichenverträge, keine GPU-Pixel. `effect-rng-v1.json` schützt die Effekt-Zufallsfolge ab einem festen Seed samt reservierter Samples; lokale Effektfälle prüfen Payload und Lebensdauer direkt, ohne Kampagnenkarte oder Startbasis. Landschaftstests prüfen aktuelle Geometrie und Reproduzierbarkeit statt Hashes entfernter Weltrezepte. Modellfixtures schützen jeweils ihre geprüften Varianten; nicht pauschal alle Modelle nachziehen. Details/Normalisierungen stehen in Tests und Git.

Kontrollierte RNG-Einstiege und reservierte Samples sind Schutzverträge, nicht automatisch entfernbares Legacy-Verhalten. Wiederholbarer Seed beweist weder Crowd-Liveness noch plattformübergreifenden Lockstep. Ergänzende Prüfungen nach [Risiko und Zeitbudget](testing.md).
