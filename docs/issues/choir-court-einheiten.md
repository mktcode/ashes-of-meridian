# Verdant Choir / Veiled Court: Abnahme der Einheitensilhouetten

## Auftrag und Grenzen

Alle sieben Einheiten beider Fraktionen haben eine eigene Gestaltung und Modellregistrierung. Rollen, technische IDs, Namen, Spielwerte, Kollisionsradien, Bewegungs-/Schusslogik und Simulations-RNG bleiben unverändert. Gebäude und Free Marches sind nicht Teil dieses Auftrags. Offen ist die unten genannte menschliche Sichtung; Vorschaukacheln werden im [Modellkachel-Issue](modell-kacheln.md) gepflegt.

## Gestaltung

| Rolle | Verdant Choir | Veiled Court |
| --- | --- | --- |
| Worker | **Tender:** niedrige sechsbeinige Gärtnerameise, Blattsammelkörbe und zwei schaufelartige Greifer; sichtbare Fracht nur beladen. | **Custodian:** schwebendes hufeisenförmiges Werkzeugchassis, offener Sammelschacht und gegliederte Zangen; kein Kampfgewand. |
| Infantry | **Thornling:** aufrechter, sprungbeiniger Pflanzenmantis, gefaltete Blattschultern, ein langer Dornenwerfer statt symmetrischer Krabbe. | **Pallbearer:** maskierter Wachritter mit breiten Schulterplatten, geteiltem Mantel und seitlicher langer Energielanze. |
| Medic | **Lifesinger:** laufende Kelchblüte auf vier Wurzelbeinen, offene Blütenkrone und warmer Pollenkern; unbewaffnet. | **Absolver:** schwebendes Weihrauchgefäß in einem offenen Hufeisenreliquiar, hängende Pendel und Heillicht; keine Soldatensilhouette. |
| Tank | **Rootbeast:** gedrungener vierbeiniger Borkenriese mit überlappenden Panzerplatten, kräftigen Wurzelfüßen und frontalem Hornwerfer. | **Sepulcher:** breiter flacher Schwebesarkophag, seitliche Panzerkufen, kompakter Geschützturm mit gespaltenen Schienen. |
| Artillery | **Sporecaller:** bodennaher Schneckenkörper, gerippte Spiralschale und große nach vorne geneigte Sporentrompete; sichtbar anderes Gewicht als Rootbeast. | **Elegist:** fahrbare schwebende Trauerorgel; drei hohe Resonanzpfeifen und nach vorne gerichtete Fokussiergabel auf langem Schlitten. |
| Aircraft | **Mothwing:** echtes Mottenwesen mit vier breiten, geäderten Blattflügeln, Augenflecken, kleinem behaartem Körper und Fühlern; Flügelschlag. | **Seraph:** starrer sichelförmiger Abfangjäger mit langem Bugkiel, geschwungenen Klingentragflächen und getrennten Hecktriebwerken; keine flatternden Flügel. |
| Commander | **The First Voice:** aufrechte Waldseherin mit Astkrone, Blütenmantel und Samenzepter, länglicher Kopf statt vergrößertem Insekt. | **The Unmasked:** maskenloser schwebender Regent mit dunklem Gesicht, gestuftem Gewand, offenem Aureolenbogen und seitlichen Schrifttafeln. |

## Abnahme

- Technische Modellprüfungen decken Normalen, vollständige Bounds, Dreiecks-/Instanzbudgets, Fracht, Team-/Ghost-/Tönungsvarianten und RNG-Isolation ab. Die historischen Referenzfixtures bleiben unverändert; nicht beteiligte Gebäude bleiben im Isolationsvergleich.
- Standbilder und `file://`-Rendering sind in allen Qualitätsstufen sowie eigenen/feindlichen Teamfarben und Vorschauvarianten ohne WebGL-Fehler geprüft. Das ist kein Mobilperformance- oder menschlicher Darstellungsnachweis. Keine KI-/Simulationslangläufe beauftragt.
- Die Gestaltung wurde vom Nutzer positiv bewertet; beanstandet wurde die kaum sichtbare Tender-Laufbewegung. Sie verwendet nun einen distanzgesteuerten Dreibeingang mit deutlichem Vorschwingen und Fußhub, ohne Bewegung des Rumpfs oder der Sammelwerkzeuge. Die korrigierte Laufanimation ist noch menschlich zu sichten.
- Lesbarkeit unter Gefechtsbedingungen und Echtgeräteperformance bleiben gesondert zu beurteilen. Vorschaukacheln: [Modellkacheln](modell-kacheln.md).
