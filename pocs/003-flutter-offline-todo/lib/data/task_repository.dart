import 'package:hive/hive.dart';

import '../domain/task.dart';

/// CRUD over a Hive box of tasks. The box is the source of truth, so every
/// operation works without a network connection.
class TaskRepository {
  TaskRepository(this._box, {DateTime Function()? clock, String Function()? idGen})
      : _clock = clock ?? DateTime.now,
        _idGen = idGen ?? _defaultId;

  static const boxName = 'tasks';

  final Box<Task> _box;
  final DateTime Function() _clock;
  final String Function() _idGen;

  static int _counter = 0;
  static String _defaultId() =>
      '${DateTime.now().microsecondsSinceEpoch}-${_counter++}';

  /// All tasks, oldest first.
  List<Task> getAll() =>
      _box.values.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));

  Task? getById(String id) => _box.get(id);

  Future<Task> add(String title) async {
    final trimmed = title.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError.value(title, 'title', 'must not be blank');
    }
    final now = _clock();
    final task = Task(id: _idGen(), title: trimmed, createdAt: now, updatedAt: now);
    await _box.put(task.id, task);
    return task;
  }

  /// Updates fields of an existing task. Returns null if [id] is unknown.
  Future<Task?> update(String id, {String? title, bool? completed}) async {
    final existing = _box.get(id);
    if (existing == null) return null;
    final trimmed = title?.trim();
    if (trimmed != null && trimmed.isEmpty) {
      throw ArgumentError.value(title, 'title', 'must not be blank');
    }
    final updated = existing.copyWith(
      title: trimmed,
      completed: completed,
      updatedAt: _clock(),
    );
    await _box.put(id, updated);
    return updated;
  }

  Future<void> delete(String id) => _box.delete(id);

  /// Emits whenever the box changes, for providers to listen to.
  Stream<List<Task>> watchAll() => _box.watch().map((_) => getAll());
}
