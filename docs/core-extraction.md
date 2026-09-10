# Mathematik und RNG: Referenzen und Auslagerung

## Zuerst: Referenztests vor der Auslagerung

Quelle der Core-Referenzen: `e0734ec:index.html`, Renderer-Block. Die Implementierung blieb bei Einführung der acht Tests in `tests/ashes-of-meridian-core.check.cjs` unverändert im HTML.

Die ersten sechs Ergebnisse von `seeded()` für die Seeds `0`, `1409`, `-1`, `2147483648` und `77` wurden einmalig direkt aus diesem Git-Stand erfasst. Im Test stehen sie als ganzzahlige Werte `random() * 4294967296`; diese Darstellung erhält die exakten 32-Bit-Ergebnisse ohne gerundete Dezimalwerte. Keine automatische Neugenerierung beim Testlauf. Zusätzliche Prüfungen erfassen die bestehende `seed | 0`-Konvertierung, unabhängige Generatorzustände und Werte in `[0, 1)`.

Mathematiktests verwenden einfache, unabhängig nachvollziehbare Referenzen für Vektorrechnung, Translation/Skalierung, Projektionsgrenzen und Kamerakoordinaten. Sie prüfen die spaltenweise Matrixablage, die Multiplikationsreihenfolge, fehlende implizite Division durch `w`, Eingabe-Isolation und Inversion mit Zeilentausch. Bestehende Sonderfälle bleiben ausdrücklich erhalten: Nullvektor-Normalisierung, Nullbasis bei identischer Kameraposition/Ziel sowie Identitätsmatrix als Fallback bei singulärer oder zu kleiner Pivotkomponente. Diese Tests sind kein Anlass für beiläufige mathematische „Korrekturen“.

Prüfung vor jeder Auslagerung: kompletter [Node-Testbefehl](testing.md#automatisierte-tests), Node.js `v23.11.1` / Linux, **52 bestanden, 0 fehlgeschlagen**. Spiel-HTML, CSS, Assets und vorhandene Erwartungen blieben unverändert. Für diesen reinen Testschritt wurde kein zusätzlicher Browserlauf ausgeführt.
