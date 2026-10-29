import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:offline_todo/data/task_repository.dart';
import 'package:offline_todo/domain/task.dart';
import 'package:offline_todo/providers/providers.dart';
import 'package:offline_todo/ui/app.dart';

/// In-memory stand-in so the UI can be tested without Hive.
class FakeRepository implements TaskRepository {
  final _tasks = <Task>[];
  final _changes = StreamController<List<Task>>.broadcast();

  void _emit() => _changes.add(getAll());

  @override
  List<Task> getAll() => List.of(_tasks);

  @override
  Task? getById(String id) => _tasks.where((t) => t.id == id).firstOrNull;

  @override
  Future<Task> add(String title) async {
    final now = DateTime.utc(2026);
    final task = Task(
      id: 'id-${_tasks.length}',
      title: title.trim(),
      createdAt: now,
      updatedAt: now,
    );
    _tasks.add(task);
    _emit();
    return task;
  }

  @override
  Future<Task?> update(String id, {String? title, bool? completed}) async {
    final i = _tasks.indexWhere((t) => t.id == id);
    if (i < 0) return null;
    _tasks[i] = _tasks[i].copyWith(title: title, completed: completed);
    _emit();
    return _tasks[i];
  }

  @override
  Future<void> delete(String id) async {
    _tasks.removeWhere((t) => t.id == id);
    _emit();
  }

  @override
  Stream<List<Task>> watchAll() => _changes.stream;
}

Widget _app(FakeRepository repo) => ProviderScope(
      overrides: [taskRepositoryProvider.overrideWithValue(repo)],
      child: const App(),
    );

void main() {
  testWidgets('shows empty state on launch', (tester) async {
    await tester.pumpWidget(_app(FakeRepository()));
    await tester.pump();

    expect(find.text('Tasks'), findsOneWidget);
    expect(find.text('No tasks yet'), findsOneWidget);
  });

  testWidgets('adds a task and marks it complete', (tester) async {
    final repo = FakeRepository();
    await tester.pumpWidget(_app(repo));
    await tester.pump();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Buy milk');
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();

    expect(find.text('Buy milk'), findsOneWidget);
    expect(find.text('No tasks yet'), findsNothing);

    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();

    expect(repo.getAll().single.completed, isTrue);
  });

  testWidgets('cancelling the dialog adds nothing', (tester) async {
    final repo = FakeRepository();
    await tester.pumpWidget(_app(repo));
    await tester.pump();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Never saved');
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(repo.getAll(), isEmpty);
    expect(find.text('No tasks yet'), findsOneWidget);
  });

  testWidgets('a blank title is ignored', (tester) async {
    final repo = FakeRepository();
    await tester.pumpWidget(_app(repo));
    await tester.pump();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '   ');
    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();

    expect(repo.getAll(), isEmpty);
    expect(find.text('No tasks yet'), findsOneWidget);
  });

  testWidgets('submitting from the keyboard adds the task', (tester) async {
    final repo = FakeRepository();
    await tester.pumpWidget(_app(repo));
    await tester.pump();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Call mum');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(find.text('Call mum'), findsOneWidget);
    expect(repo.getAll().single.title, 'Call mum');
  });

  testWidgets('completed tasks can be unchecked again', (tester) async {
    final repo = FakeRepository();
    await repo.add('Water plants');
    await tester.pumpWidget(_app(repo));
    await tester.pump();

    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    expect(repo.getAll().single.completed, isTrue);

    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    expect(repo.getAll().single.completed, isFalse);
  });
}
