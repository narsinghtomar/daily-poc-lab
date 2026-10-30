import 'package:flutter_test/flutter_test.dart';
import 'package:offline_todo/domain/task.dart';
import 'package:offline_todo/sync/fake_sync_service.dart';
import 'package:offline_todo/sync/sync_engine.dart';
import 'package:offline_todo/sync/sync_queue.dart';

Task task(String id, {String title = 'x', bool completed = false}) => Task(
      id: id,
      title: title,
      completed: completed,
      createdAt: DateTime.utc(2026),
      updatedAt: DateTime.utc(2026),
    );

void main() {
  late SyncQueue queue;
  late FakeSyncService service;
  late List<Duration> delays;

  SyncEngine engine({int maxAttempts = 4}) => SyncEngine(
        queue,
        service,
        maxAttempts: maxAttempts,
        baseDelay: const Duration(milliseconds: 100),
        delay: (d) async => delays.add(d),
      );

  setUp(() {
    queue = SyncQueue();
    service = FakeSyncService();
    delays = [];
  });

  group('SyncQueue', () {
    test('keeps only the latest change per task', () {
      queue.enqueueUpsert(task('a', title: 'one'));
      queue.enqueueUpsert(task('a', title: 'two'));
      expect(queue.length, 1);
      expect(queue.first!.task!.title, 'two');
    });

    test('a delete replaces a pending upsert', () {
      queue.enqueueUpsert(task('a'));
      queue.enqueueDelete('a');
      expect(queue.pending.single.task, isNull);
    });

    test('ack keeps a newer change queued meanwhile', () {
      queue.enqueueUpsert(task('a', title: 'old'));
      final inFlight = queue.first!;
      queue.enqueueUpsert(task('a', title: 'new'));
      queue.ack(inFlight);
      expect(queue.first!.task!.title, 'new');
    });
  });

  group('SyncEngine', () {
    test('drains the queue in order', () async {
      queue.enqueueUpsert(task('a'));
      queue.enqueueUpsert(task('b'));
      queue.enqueueDelete('a');
      final result = await engine().flush();
      expect(result.complete, isTrue);
      expect(result.synced, 2);
      expect(service.remote.keys, ['b']);
    });

    test('retries with exponential backoff then succeeds', () async {
      service.failNext = 2;
      queue.enqueueUpsert(task('a'));
      final result = await engine().flush();
      expect(result.complete, isTrue);
      expect(service.pushCount, 3);
      expect(delays, const [Duration(milliseconds: 100), Duration(milliseconds: 200)]);
    });

    test('gives up after maxAttempts and keeps changes queued in order', () async {
      service.failNext = 99;
      queue.enqueueUpsert(task('a'));
      queue.enqueueUpsert(task('b'));
      final result = await engine(maxAttempts: 3).flush();
      expect(result.synced, 0);
      expect(result.remaining, 2);
      expect(service.pushCount, 3);
      expect(queue.first!.id, 'a');
    });

    test('a later flush resumes after the service recovers', () async {
      service.failNext = 99;
      queue.enqueueUpsert(task('a'));
      await engine(maxAttempts: 2).flush();
      service.failNext = 0;
      final result = await engine().flush();
      expect(result.complete, isTrue);
      expect(service.remote.keys, ['a']);
    });

    test('an empty queue is a no-op', () async {
      final result = await engine().flush();
      expect(result.synced, 0);
      expect(service.pushCount, 0);
    });
  });
}
