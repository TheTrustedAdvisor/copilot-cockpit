# Operations Guide

## Betriebliche Übersicht

Der Betrieb des Copilot Cockpit umfasst Setup, Monitoring, Maintenance und Support.

## Installation und Setup

### Voraussetzungen
- Laufende PostgreSQL-Instanz (12+)
- Netzwerkzugriff zu externen Datenquellen
- SSL-Zertifikat für HTTPS
- Docker oder systemd für Prozessverwaltung

### Setup-Schritte
1. Abhängigkeiten installieren
2. Datenbank initialisieren
3. Konfiguration setzen (siehe [Konfigurationsreferenz](../reference/configuration.md))
4. Service starten
5. Health Check durchführen

## Monitoring

### Key Metrics
- **Verfügbarkeit**: Uptime %
- **Performance**: Response Time p95
- **Fehlerrate**: Requests/min mit 5xx-Status
- **Datenquelle-Gesundheit**: Verbindungsstatus je Quelle

### Alerting
Kritische Schwellwerte:
- Uptime < 99%
- Response Time p95 > 5s
- Fehlerrate > 1%
- DB-Verbindungen > 90%

### Logging
- Struktur: JSON-Format
- Retention: 30 Tage
- Level: INFO (Produktion), DEBUG (Entwicklung)

## Maintenance

### Täglich
- Logs prüfen auf Fehler
- Disk-Space überwachen
- Backup Status prüfen

### Wöchentlich
- Performance-Trends analysieren
- Security-Patches prüfen
- Benutzer-Feedback reviewen

### Monatlich
- Datenbank-Optimierung
- Archiv älterer Logs
- Kapazitätsplanung

## Backup & Recovery

### Backup-Strategie
- Automatisch: täglich um 02:00 UTC
- Aufbewahrung: 30 Tage
- Ziel: S3 oder ähnliches Object Storage

### Recovery-Test
- Monatlich testen
- Dokumentieren der Wiederherstellungszeit (RTO)
- Recovery Point Objective (RPO): < 1 Tag

## Troubleshooting

Für häufige Fehlerfälle siehe [Troubleshooting Guide](troubleshooting.md).

## Eskalation

1. **Level 1**: Logs prüfen, Basic Checks
2. **Level 2**: Performance-Analyse, DB-Debugging
3. **Level 3**: Kernentwickler, Architektur-Review

Dokumentation siehe [Troubleshooting](troubleshooting.md).
