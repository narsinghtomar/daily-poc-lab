# 003 · Offline-first task app (Riverpod + Hive)

**Stack:** Flutter · **Week:** 1 · **Status:** in progress

## Problem
Mobile users lose connectivity constantly, and apps that block on the network feel broken. This POC keeps the local database as the source of truth so tasks can be created and completed offline and synced later.

## What this POC shows
- Layered structure: `lib/data` (storage), `lib/domain` (entities), `lib/ui` (widgets)
- Riverpod for state and Hive for local persistence, initialised before `runApp`
- Immutable `Task` entity, a hand-written Hive `TypeAdapter` (no build_runner) and a `TaskRepository` with add/update/delete/list/watch
- Tests: repository tests run against a real Hive box in a temp dir (CRUD, validation, ordering, persistence across reopen, change stream); widget tests drive the add flow (cancel, blank title, keyboard submit, check and uncheck) against an in-memory fake repository
- `lib/providers`: a repository provider (overridden with the Hive box at startup) and a `tasksProvider` stream that drives the list; the UI lists tasks, adds via a dialog and completes via checkbox

## Run
```bash
cd pocs/003-flutter-offline-todo
flutter create --org dev.poc --project-name offline_todo .   # generates android/ios/etc, keeps lib/
flutter pub get
flutter test
flutter run
```

## What I'd do in production
- Add a Hive encryption key from secure storage
- Add schema versioning and migrations for stored data

## Interview talking points
- Why local-first: reads never wait on the network, sync is a background concern
- Why Riverpod: compile-safe, testable providers without BuildContext

## Daily plan
- [x] Mon: Flutter create, folder structure (data/domain/ui), add riverpod + hive
- [x] Tue: Task model + Hive adapter + repository with CRUD
- [x] Wed: Riverpod providers + list/add/complete UI
- [x] Thu: Unit tests for repository + widget test for add flow
- [ ] Fri: Fake sync service with pending-changes queue and retry
- [ ] Sat: README with architecture diagram, screenshots, trade-offs
- [ ] Sun: weekly review in DEVLOG.md
