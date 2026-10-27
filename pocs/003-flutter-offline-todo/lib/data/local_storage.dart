import 'package:hive_flutter/hive_flutter.dart';

import '../domain/task.dart';
import 'task_adapter.dart';
import 'task_repository.dart';

/// Opens Hive once at startup and registers adapters and boxes.
class LocalStorage {
  const LocalStorage._();

  static Future<void> init() async {
    await Hive.initFlutter();
    registerAdapters();
    await Hive.openBox<Task>(TaskRepository.boxName);
  }

  static void registerAdapters() {
    if (!Hive.isAdapterRegistered(TaskAdapter.typeIdValue)) {
      Hive.registerAdapter(TaskAdapter());
    }
  }
}
