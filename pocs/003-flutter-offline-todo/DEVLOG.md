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
