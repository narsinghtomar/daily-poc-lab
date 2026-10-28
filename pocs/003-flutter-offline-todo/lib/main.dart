import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';

import 'data/local_storage.dart';
import 'data/task_repository.dart';
import 'domain/task.dart';
import 'providers/providers.dart';
import 'ui/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalStorage.init();
  final box = Hive.box<Task>(TaskRepository.boxName);
  runApp(ProviderScope(
    overrides: [taskRepositoryOverride(box)],
    child: const App(),
  ));
}
