import 'fake_sync_service.dart';
import 'pending_change.dart';
import 'sync_queue.dart';

class SyncResult {
  const SyncResult({required this.synced, required this.remaining});
  final int synced;
  final int remaining;
  bool get complete => remaining == 0;
}

/// Drains a [SyncQueue] into a [SyncService] in order.
///
/// Each change is retried with exponential backoff. If one exhausts its
/// attempts the run stops and leaves it (and everything after it) queued, so
/// ordering is preserved and the next [flush] resumes where this one ended.
class SyncEngine {
  SyncEngine(
    this._queue,
    this._service, {
    this.maxAttempts = 4,
    this.baseDelay = const Duration(milliseconds: 500),
    Future<void> Function(Duration)? delay,
  }) : _delay = delay ?? Future.delayed;

  final SyncQueue _queue;
  final SyncService _service;
  final int maxAttempts;
  final Duration baseDelay;
  final Future<void> Function(Duration) _delay;

  bool _running = false;

  Future<SyncResult> flush() async {
    if (_running) return SyncResult(synced: 0, remaining: _queue.length);
    _running = true;
    var synced = 0;
    try {
      while (!_queue.isEmpty) {
        final change = _queue.first!;
        if (!await _pushWithRetry(PendingChange change)) break;
        _queue.ack(change);
        synced++;
      }
    } finally {
      _running = false;
    }
    return SyncResult(synced: synced, remaining: _queue.length);
  }

  Future<bool> _pushWithRetry(PendingChange change) async {
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await _service.push(change);
        return true;
      } on SyncException {
        if (attempt == maxAttempts - 1) return false;
        await _delay(baseDelay * (1 << attempt));
      }
    }
    return false;
  }
}
