# Konfigurationsreferenz

Wippy wird über `.wippy.yaml`-Dateien konfiguriert. Alle Optionen haben sinnvolle Standardwerte.

## Log-Manager

Steuert das Runtime-Log-Routing. Konsolenausgabe wird über [CLI-Flags](guides/cli.md) (`-v`, `-c`, `-s`) konfiguriert.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `propagate_downstream` | bool | true | Logs an Konsolen-/Dateiausgabe senden |
| `stream_to_events` | bool | false | Logs für programmatischen Zugriff zum Event-Bus veröffentlichen |
| `min_level` | int | -1 | Minimales Level: -1=debug, 0=info, 1=warn, 2=error |

```yaml
logmanager:
  propagate_downstream: true
  stream_to_events: false
  min_level: 0
```

Siehe: [Logger-Modul](lua/system/logger.md)

## Profiler

Go pprof HTTP-Server für CPU-/Speicher-Profiling. Mit `-p` Flag oder Konfiguration aktivieren.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | Profiler-Server starten |
| `address` | string | localhost:6060 | Adresse zum Lauschen |
| `read_timeout` | duration | 15s | HTTP Read-Timeout |
| `write_timeout` | duration | 15s | HTTP Write-Timeout |
| `idle_timeout` | duration | 60s | Keep-Alive-Timeout |

```yaml
profiler:
  enabled: true
  address: "localhost:6060"
```

Zugriff unter `http://localhost:6060/debug/pprof/`

## Sicherheit

Globales Sicherheitsverhalten. Individuelle Richtlinien werden als [security.policy-Einträge](guides/entry-kinds.md) definiert.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `strict_mode` | bool | false | Zugriff verweigern wenn Sicherheitskontext unvollständig |

```yaml
security:
  strict_mode: true
```

Siehe: [Sicherheitssystem](system/security.md), [Sicherheitsmodul](lua/security/security.md)

## Registry

Eintragsspeicherung und Versionshistorie. Die Registry enthält alle Konfigurationseinträge.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enable_history` | bool | true | Eintragsversionen verfolgen |
| `history_type` | string | memory | Speicher: memory, sqlite, nil |
| `history_path` | string | .wippy/registry.db | SQLite-Dateipfad |

```yaml
registry:
  history_type: sqlite
  history_path: /var/lib/wippy/registry.db
```

Siehe: [Registry-Konzept](concepts/registry.md), [Registry-Modul](lua/core/registry.md)

## Relay

Nachrichtenrouting zwischen Prozessen über Knoten hinweg.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `node_name` | string | local | Bezeichner für diesen Relay-Knoten |

```yaml
relay:
  node_name: worker-1
```

Siehe: [Prozessmodell](concepts/process-model.md)

## Supervisor

Dienst-Lebenszyklus-Verwaltung. Steuert das interne Steuerungs-Postfach des Supervisors, das zum Versand von Lebenszyklus-Ereignissen verwendet wird.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `host.buffer_size` | int | 1024 | Kapazität des internen Steuerungs-Postfachs |
| `host.worker_count` | int | 16 | Nebenläufige Dispatcher-Worker |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Siehe: [Supervision-Anleitung](guides/supervision.md)

<note>
Worker und Warteschlangen pro `process.host` werden am Eintrag selbst konfiguriert (`workers`, `queue_size`, `local_queue_size`), nicht in diesem globalen Abschnitt. Siehe den [Process Host](system/process-host.md)-Eintragstyp.
</note>

## Lua-Runtime

Lua-VM-Caching und Expression-Auswertung.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `proto_cache_size` | int | 60000 | Kompilierter Prototype-Cache |
| `main_cache_size` | int | 10000 | Main-Chunk-Cache |
| `cache.enabled` | bool | false | Kompilierten Bytecode-/Typecheck-Cache auf Disk persistieren |
| `cache.dir` | string | (System-Cache-Verzeichnis) | Cache-Verzeichnis-Pfad |
| `cache.mode` | string | `read_write` | Cache-Modus: `read_write`, `read_only`, `write_only` |
| `type_system.enabled` | bool | false | Statische Typprüfung aktivieren |
| `type_system.strict` | bool | false | Typwarnungen als Fehler behandeln |

```yaml
lua:
  proto_cache_size: 60000
  cache:
    enabled: true
    dir: .cache/lua
  type_system:
    enabled: true
```

Siehe: [Lua-Übersicht](lua/overview.md)

## Finder

Registry-Such-Caching. Wird intern für Eintrags-Lookups verwendet.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `query_cache_size` | int | 1000 | Gecachte Abfrageergebnisse |
| `regex_cache_size` | int | 100 | Kompilierte Regex-Muster |

```yaml
finder:
  query_cache_size: 2000
```

## OpenTelemetry

Verteiltes Tracing und Metrik-Export über OTLP.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | OTEL aktivieren |
| `endpoint` | string | localhost:4318 | OTLP-Endpunkt |
| `protocol` | string | http/protobuf | Protokoll: grpc, http/protobuf |
| `service_name` | string | wippy | Dienst-Bezeichner |
| `sample_rate` | float | 1.0 | Trace-Sampling (0.0-1.0) |
| `traces_enabled` | bool | false | Traces exportieren |
| `metrics_enabled` | bool | false | Metriken exportieren |
| `http.enabled` | bool | true | HTTP-Anfragen tracen |
| `process.enabled` | bool | true | Prozess-Lebenszyklus tracen |
| `interceptor.enabled` | bool | false | Funktionsaufrufe tracen |

```yaml
otel:
  enabled: true
  endpoint: "http://jaeger:4318"
  traces_enabled: true
  process:
    trace_lifecycle: true
```

Siehe: [Observability-Anleitung](guides/observability.md)

## Shutdown

Verhalten beim kontrollierten Herunterfahren.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `timeout` | duration | 30s | Maximale Wartezeit für Komponenten zum Stoppen |

```yaml
shutdown:
  timeout: 60s
```

## Metriken

Interner Metriken-Sammlungspuffer.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `buffer.size` | int | 10000 | Metriken-Puffer-Kapazität |
| `interceptor.enabled` | bool | false | Funktionsaufrufe automatisch verfolgen |

```yaml
metrics:
  buffer:
    size: 20000
  interceptor:
    enabled: true
```

Siehe: [Metriken-Modul](lua/system/metrics.md), [Observability-Anleitung](guides/observability.md)

## Prometheus

Prometheus-Metriken-Endpunkt.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | Metriken-Server starten |
| `address` | string | localhost:9090 | Adresse zum Lauschen |

```yaml
prometheus:
  enabled: true
  address: "0.0.0.0:9090"
```

Stellt `/metrics`-Endpunkt für Prometheus-Scraping bereit.

Siehe: [Observability-Anleitung](guides/observability.md)

## Cluster

Multi-Node-Clustering mit Gossip-Discovery.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `enabled` | bool | false | Clustering aktivieren |
| `name` | string | hostname | Knoten-Bezeichner |
| `internode.bind_addr` | string | 0.0.0.0 | Inter-Node-Bind-Adresse |
| `internode.bind_port` | int | 0 | Port (0=auto 7950-7959) |
| `membership.bind_port` | int | 7946 | Gossip-Port |
| `membership.join_addrs` | string | | Seed-Knoten (kommasepariert) |
| `membership.secret_key` | string | | Verschlüsselungsschlüssel (base64) |
| `membership.secret_file` | string | | Schlüsseldatei-Pfad |
| `membership.advertise_addr` | string | | Öffentliche Adresse für NAT |

```yaml
cluster:
  enabled: true
  name: node-1
  membership:
    bind_port: 7946
    join_addrs: "10.0.0.1:7946,10.0.0.2:7946"
    secret_file: /etc/wippy/cluster.key
```

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `GOMEMLIMIT` | Speicherlimit (überschreibt `--memory-limit` Flag) |

## Siehe auch

- [CLI-Referenz](guides/cli.md) - Kommandozeilenoptionen
- [Entry-Typen](guides/entry-kinds.md) - Alle Entry-Typen
- [Observability-Anleitung](guides/observability.md) - Logging, Metriken, Tracing
