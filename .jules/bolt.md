## 2025-02-18 - [Object Allocation and Scalar Replacement]
**Learning:** V8's scalar replacement optimization can eliminate object allocation entirely if the object doesn't escape the scope (e.g. only property access in a loop). This makes naive benchmarks show 0ms allocation cost, which is misleading for real-world scenarios where objects are returned/serialized.
**Action:** When benchmarking object allocation, ensure the object escapes the loop (e.g., store in an array or pass to a side-effect function) to measure the true cost that caching avoids.

## 2025-02-18 - [TypeScript Readonly vs Object.freeze]
**Learning:** `Object.freeze()` enforces runtime immutability, but TypeScript may not infer this if the variable is typed as mutable. This creates a dangerous mismatch where code compiles but throws at runtime on mutation.
**Action:** Always explicitly type cached properties as `Readonly<T>` when using `Object.freeze()`.
