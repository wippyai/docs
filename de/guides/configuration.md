# Konfigurationsreferenz

Wippy wird über `.wippy.yaml`-Dateien konfiguriert. Alle Optionen haben sinnvolle Standardwerte.

## Log-Manager

Steuert das Runtime-Log-Routing. Konsolenausgabe wird über [CLI-Flags](guide-cli.md) (`-v`, `-c`, `-s`) konfiguriert.

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

Siehe: [Logger-Modul](lua-logger.md)

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

Globales Sicherheitsverhalten. Individuelle Richtlinien werden als [security.policy-Einträge](guide-entry-kinds.md) definiert.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `strict_mode` | bool | false | Zugriff verweigern wenn Sicherheitskontext unvollständig |

```yaml
security:
  strict_mode: true
```

Siehe: [Sicherheitssystem](system-security.md), [Sicherheitsmodul](lua-security.md)

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

Siehe: [Registry-Konzept](concept-registry.md), [Registry-Modul](lua-registry.md)

## Relay

Nachrichtenrouting zwischen Prozessen über Knoten hinweg.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `node_name` | string | local | Bezeichner für diesen Relay-Knoten |

```yaml
relay:
  node_name: worker-1
```

Siehe: [Prozessmodell](concept-process-model.md)

## Supervisor

Dienst-Lebenszyklus-Verwaltung. Steuert wie überwachte Einträge starten/stoppen.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `host.buffer_size` | int | 1024 | Nachrichtenwarteschlangen-Kapazität |
| `host.worker_count` | int | NumCPU | Nebenläufige Worker |

```yaml
supervisor:
  host:
    buffer_size: 2048
    worker_count: 32
```

Siehe: [Supervision-Anleitung](guide-supervision.md)

## Funktionen

Funktionsausführungs-Host. Führt `function.lua`-Einträge aus.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `host.buffer_size` | int | 1024 | Task-Warteschlangen-Kapazität |
| `host.worker_count` | int | NumCPU | Nebenläufige Worker |

```yaml
functions:
  host:
    buffer_size: 2048
    worker_count: 32
```

Siehe: [Funktionen-Konzept](concept-functions.md), [Funcs-Modul](lua-funcs.md)

## Lua-Runtime

Lua-VM-Caching und Expression-Auswertung.

| Feld | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `proto_cache_size` | int | 60000 | Kompilierter Prototype-Cache |
| `main_cache_size` | int | 10000 | Main-Chunk-Cache |
| `expr.cache_enabled` | bool | true | Kompilierte Expressions cachen |
| `expr.capacity` | int | 5000 | Expression-Cache-Größe |
| `json.cache_enabled` | bool | true | JSON-Schemas cachen |
| `json.capacity` | int | 1000 | JSON-Cache-Größe |

```yaml
lua:
  proto_cache_size: 60000
  expr:
    cache_enabled: true
    capacity: 5000
```

Siehe: [Lua-Übersicht](lua-overview.md)

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

Siehe: [Observability-Anleitung](guide-observability.md)

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

Siehe: [Metriken-Modul](lua-metrics.md), [Observability-Anleitung](guide-observability.md)

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

Siehe: [Observability-Anleitung](guide-observability.md)

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

Siehe: [Cluster-Anleitung](guide-cluster.md)

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `GOMEMLIMIT` | Speicherlimit (überschreibt `--memory-limit` Flag) |

## Siehe auch

- [CLI-Referenz](guide-cli.md) - Kommandozeilenoptionen
- [Entry-Typen](guide-entry-kinds.md) - Alle Entry-Typen
- [Cluster-Anleitung](guide-cluster.md) - Multi-Node-Setup
- [Observability-Anleitung](guide-observability.md) - Logging, Metriken, Tracing
