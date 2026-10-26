import 'package:hive_flutter/hive_flutter.dart';

/// Opens Hive once at startup. Boxes and adapters are registered here
/// as the data layer grows.
class LocalStorage {
  const LocalStorage._();

  static Future<void> init() => Hive.initFlutter();
}
