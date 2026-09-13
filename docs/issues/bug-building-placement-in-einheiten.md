# Gebäudeplatzierung über Einheiten blockiert Bewegung

Neue Gebäude lassen sich auf bereits dort stehenden Einheiten platzieren; diese können sich danach nicht mehr bewegen.

Die [Gegner-KI](../architecture.md#teamzustand-sicht-und-ki) verlangt sichtbare Bauflächen und meidet belegte Plätze sowie reservierte Produktionsausgänge. Das ist nur vorsichtige Platzwahl, keine Behebung im gemeinsamen Bauvalidator: `canBuild()` überspringt Einheiten weiterhin. Eine allgemeine Lösung muss beide Akteure und laufende Ausfahrten berücksichtigen; keine unterschiedliche Kollisionsregel für UI und KI einführen.

Die geplante [direkte Raffinerie-/Vent-Platzierung](aether-vent-und-refinary-bauen.md) muss denselben Validator verwenden.
