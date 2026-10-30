import '../domain/task.dart';

enum ChangeType { upsert, delete }

/// A local mutation that the server has not acknowledged yet.
class PendingChange {
  PendingChange.upsert(Task task)
      : id = task.id,
        type = ChangeType.upsert,
        task = task;

  const PendingChange.delete(this.id)
      : type = ChangeType.delete,
        task = null;

  final String id;
  final ChangeType type;

  /// The task being pushed; null for deletes.
  final Task? task;
}
