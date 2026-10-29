import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:offline_todo/data/local_storage.dart';
import 'package:offline_todo/data/task_repository.dart';
import 'package:offline_todo/domain/task.dart';

void main() {
  late Directory dir;
  late TaskRepository repo;
  var tick = 0;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('hive_test');
    Hive.init(dir.path);
    LocalStorage.registerAdapters();
    final box = await Hive.openBox<Task>(TaskRepository.boxName);
    tick = 0;
    repo = TaskRepository(
      box,
      clock: () => DateTime.utc(2026, 1, 1).add(Duration(minutes: tick++)),
      idGen: () => 'id-$tick',
    );
  });

  tearDown(() async {
    await Hive.deleteFromDisk();
    await dir.delete(recursive: true);
  });

  test('add persists a trimmed task and round-trips through the adapter', () async {
    final task = await repo.add('  Buy milk ');
    expect(task.title, 'Buy milk');
    expect(repo.getById(task.id), task);
  });

  test('add rejects blank titles', () {
    expect(() => repo.add('   '), throwsArgumentError);
  });

  test('update changes fields and bumps updatedAt', () async {
    final task = await repo.add('Write');
    final updated = await repo.update(task.id, completed: true);
    expect(updated!.completed, isTrue);
    expect(updated.updatedAt.isAfter(task.updatedAt), isTrue);
  });

  test('update returns null for unknown id', () async {
    expect(await repo.update('missing', completed: true), isNull);
  });

  test('delete removes the task and getAll is ordered by creation', () async {
    final a = await repo.add('a');
    await repo.add('b');
    await repo.delete(a.id);
    expect(repo.getAll().map((t) => t.title), ['b']);
  });

  test('update rejects blank titles and leaves the task untouched', () async {
    final task = await repo.add('Write');
    expect(() => repo.update(task.id, title: '  '), throwsArgumentError);
    expect(repo.getById(task.id), task);
  });

  test('update trims the new title and keeps completion state', () async {
    final task = await repo.add('Write');
    await repo.update(task.id, completed: true);
    final renamed = await repo.update(task.id, title: ' Draft ');
    expect(renamed!.title, 'Draft');
    expect(renamed.completed, isTrue);
    expect(renamed.createdAt, task.createdAt);
  });

  test('getAll returns tasks oldest first', () async {
    await repo.add('first');
    await repo.add('second');
    await repo.add('third');
    expect(repo.getAll().map((t) => t.title), ['first', 'second', 'third']);
  });

  test('tasks survive closing and reopening the box', () async {
    final task = await repo.add('Persist me');
    await Hive.close();
    final reopened = await Hive.openBox<Task>(TaskRepository.boxName);
    expect(TaskRepository(reopened).getById(task.id), task);
  });

  test('watchAll emits the fresh list after each change', () async {
    final emitted = expectLater(
      repo.watchAll().map((tasks) => tasks.map((t) => t.title).toList()),
      emitsInOrder([
        ['a'],
        ['a', 'b'],
      ]),
    );
    await repo.add('a');
    await repo.add('b');
    await emitted;
  });
}
