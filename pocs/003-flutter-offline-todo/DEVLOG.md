# Devlog · 003


## Mon
- Hand-wrote the Flutter project skeleton (pubspec, lib/data|domain|ui, entrypoint with ProviderScope and Hive init) and a smoke widget test.
- Run `flutter create .` once locally to generate the platform folders.
- 2026-10-26 (W1 Mon): Scaffold offline todo app with data, domain and ui layers plus Riverpod and Hive

## Tue
- Added the `Task` entity, a hand-written Hive adapter with index-based fields (tolerant of added fields) and `TaskRepository` CRUD with injectable clock and id generator.
- Repository tests written; run `flutter test` after `flutter create .` (Flutter SDK was not available here, so they have not been run yet).
- 2026-10-27 (W1 Tue): Add Task model, Hive adapter and CRUD repository for offline todo

## Wed
- Added `taskRepositoryProvider` (overridden with the Hive box in `main`) and a `tasksProvider` stream, so the UI never touches Hive directly.
- Home page now lists tasks, adds through a dialog and toggles completion with a checkbox; widget tests use an in-memory fake repository.
- Flutter SDK is not available here, so the tests have not been run yet.
- 2026-10-28 (W1 Wed): Add Riverpod providers and list, add and complete UI for offline todo

## Thu
- Extended repository tests (blank-title update, trimming, ordering, persistence after reopening the box, change stream) and widget tests for the add flow (cancel, blank title, keyboard submit, uncheck).
- Flutter SDK is not available here, so the suite has not been run yet; run `flutter test` after `flutter create .`.
- 2026-10-29 (W1 Thu): Add repository and add-flow widget tests for offline todo

## Fri
- Added `lib/sync`: coalescing pending-changes queue, `SyncService` interface with a fake server, and a `SyncEngine` with exponential-backoff retry that stops at the first change that keeps failing.
- Sync tests are pure Dart with an injected delay, so backoff is asserted without waiting. Flutter SDK is not available here, so they have not been run yet.
- Queue is in memory for now; persisting it is listed under production work.
- 2026-10-30 (W1 Fri): Add fake sync service with pending-changes queue and retry
- 2026-10-30 (W1 Fri): Add fake sync service with pending-changes queue and retry for offline todo
- 2026-10-31 (W1 Sat): Add architecture diagram, screens and trade-offs to offline todo README

## Sun
- Wrote the weekly review below and marked the POC done.

## Weekly review

### What worked
- Layering from day one (`data` / `domain` / `ui` / `sync`) meant each day's milestone landed without touching earlier code.
- Hive as the source of truth with the UI reading only a stream made offline behaviour the default instead of a special case.
- Injecting the clock, id generator and retry delay kept repository and sync tests fast and deterministic; backoff is asserted without waiting.
- Coalescing the queue to one pending change per task kept the sync engine small and the server traffic minimal.

### What I would change
- The Flutter SDK was not available while building, so no test has actually run. First step next week is `flutter create` and `flutter test`, then fix whatever surfaces.
- The sync queue is in memory, so pending changes vanish on restart. Persist it in its own Hive box.
- Nothing triggers `flush` yet; wire it to connectivity changes and app resume.
- Add real conflict handling (per-task version or updated-at) instead of last write wins against a fake server.
- Add screenshots and a Hive encryption key.

### Interview talking points
- Local-first: the database is the source of truth, reads never wait on the network, and sync is a separate background concern.
- Queue design: one change per task, drained in order, with exponential backoff; stopping at the first exhausted change preserves per-task ordering at the cost of head-of-line blocking.
- Hive vs SQLite: a typed box is enough for a flat entity, but queries and migrations are manual.
- Riverpod: providers are overridable in tests, so the same UI runs on a fake repository or the real box.
- Testability: injected time, ids and delays instead of mocks of the clock.
- 2026-11-01 (W1 Sun): Add weekly review for offline todo POC
