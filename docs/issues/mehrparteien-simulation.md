# Mehrparteien-Prüfungen und tolerierte Simulationsgrenzen

- [ ] Vor neuen Aussagen die [veralteten HQ-Startfixtures](teststrategie-review.md#vorrang-fachlich-veraltete-startannahmen) berichtigen. Danach mit eigener Freigabe echte FFA-KI-Fälle eingrenzen; kurze Dispatch-/Startprüfungen belegen keine Erntezyklen, Gaszugänge oder autonome Partie. [Szenariovertrag](../architecture.md#teamzustand-sicht-und-ki).

## Tolerierte Grenzen im gemeinsamen Unterbau

**Court gegen Free Marches, Mothership, Seed 1471:** aktives Patt am unveränderten 20-Minuten-Limit (24.000×0,05 s). Genau dieser Testfall darf ohne Sieger enden, muss aber HQ/Kampfeinheiten beider Seiten und allgemeine Wirtschafts-/Angriffsnachweise erfüllen; keine allgemeine Verlängerung oder Abschwächung.

Dabei Court-Rifle 138 ab etwa Minute 7 am Ausgang von Barracks 129 (`-86.8,84.1`) fest: Position `-86.25,86.25`, `pathStatus: unreachable`, 254 gedrosselte Recoveries. Tolerierter isolierter Edge-Case, kein gewünschtes Regressionsergebnis. Bei normaler Spielreproduktion/weiteren Seeds oder mehreren Betroffenen neu priorisieren.

Prüfkontext: vollständige KI-/Simulationsläufe auf Basis `f0dba62`, Node v23.11.1; kein Beleg für spätere Rezeptänderungen. Dieselbe Seednummer rekonstruiert nach Rezeptänderungen nicht dieselbe Szene. Patt-Ausnahme und festhängende Entitäts-IDs daher nicht als aktuellen Reproduktionsnachweis oder allgemeine Toleranz übernehmen. [Worker-Befund](worker-bauwegfindung/issue.md) separat. Weitere Läufe nur nach [Freigabe](../testing.md), menschliche Perspektiv-/Geräteabnahme bleibt offen.
