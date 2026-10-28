import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';

import '../data/task_repository.dart';
import '../domain/task.dart';

/// The repository is built from the opened Hive box, so it is overridden at
/// the root `ProviderScope` (in `main` and in tests).
final taskRepositoryProvider = Provider<TaskRepository>(
  (ref) => throw UnimplementedError('Override taskRepositoryProvider'),
);

/// Builds the repository override from the box opened by `LocalStorage.init`.
Override taskRepositoryOverride(Box<Task> box) =>
    taskRepositoryProvider.overrideWithValue(TaskRepository(box));

/// Current tasks: the stored list first, then a fresh list on every change.
final tasksProvider = StreamProvider<List<Task>>((ref) async* {
  final repo = ref.watch(taskRepositoryProvider);
  yield repo.getAll();
  yield* repo.watchAll();
});
