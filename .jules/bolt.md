## 2025-05-23 - Micro-optimizations in V8
**Learning:** Simple object allocation in V8 is incredibly fast (nanoseconds). Caching small objects provides minimal CPU gain in isolation but reduces GC pressure.
**Action:** Focus on object caching for larger objects or frequently called methods where GC pressure is a concern.
