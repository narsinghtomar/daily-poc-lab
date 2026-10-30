import '../domain/task.dart';
import 'pending_change.dart';

class SyncException implements Exception {
  const SyncException(this.message);
  final String message;
  @override
  String toString() => 'SyncException: $message';
}

/// The remote side of sync. Swap the fake for a real HTTP client later.
abstract class SyncService {
  Future<void> push(PendingChange change);
}

/// In-memory stand-in for a server. [failNext] makes the next N pushes throw,
/// which is enough to exercise retry and backoff without a network.
class FakeSyncService implements SyncService {
  FakeSyncService({this.failNext = 0});

  int failNext;
  int pushCount = 0;
  final Map<String, Task> remote = {};

  @override
  Future<void> push(PendingChange change) async {
    pushCount++;
    if (failNext > 0) {
      failNext--;
      throw const SyncException('network unavailable');
    }
    if (change.type == ChangeType.delete) {
      remote.remove(change.id);
    } else {
      remote[change.id] = change.task!;
    }
  }
}
