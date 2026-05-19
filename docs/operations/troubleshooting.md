# Betrieb und Troubleshooting

## Top-Checks
- Dienst erreichbar
- Abhängigkeiten verfügbar
- Konfiguration konsistent
- Logs ohne kritische Fehler

## Fehlerbaum
~~~mermaid
flowchart TD
A[Fehler erkannt] --> B{Login betroffen?}
B -->|Ja| C[Auth Konfiguration prüfen]
B -->|Nein| D{Datenquelle betroffen?}
D -->|Ja| E[DB/API Connectivity prüfen]
D -->|Nein| F{Performance betroffen?}
F -->|Ja| G[Timeout, Retry, Rate Limit prüfen]
F -->|Nein| H[Logs korrelieren und Incident anlegen]
~~~

## Ralph Quality Loop
~~~mermaid
stateDiagram-v2
[*] --> Implement
Implement --> Verify
Verify --> Fix: FAIL
Fix --> Verify
Verify --> Done: PASS
Done --> [*]
~~~

## Cross-Links
- Quickstart: ../guides/quickstart.md
- E2E Admin: ../guides/e2e/admin-onboarding.md
- Konfigurationsreferenz: ../reference/configuration.md
