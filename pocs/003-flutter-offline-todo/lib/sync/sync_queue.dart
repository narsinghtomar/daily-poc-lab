import 'dart:collection';

import '../domain/task.dart';
import 'pending_change.dart';

/// Ordered queue of unsynced changes, keeping at most one entry per task.
///
/// Coalescing means a task edited ten times offline is pushed once, with its
/// latest state, and a task created then deleted offline is never pushed
/// unless the server may already know it.
class SyncQueue {
  final _changes = LinkedHashMap<String, PendingChange>();

  bool get isEmpty => _changes.isEmpty;
  int get length => _changes.length;
  List<PendingChange> get pending => List.unmodifiable(_changes.values);

  PendingChange? get first => _changes.isEmpty ? null : _changes.values.first;

  void enqueueUpsert(Task task) => _changes[task.id] = PendingChange.upsert(task);

  void enqueueDelete(String id) => _changes[id] = PendingChange.delete(id);

  /// Drops [change] once the server acknowledged it. A newer change for the
  /// same task, queued while the push was in flight, is kept.
  void ack(PendingChange change) {
    if (identical(_changes[change.id], change)) _changes.remove(change.id);
  }
}
