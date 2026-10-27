import 'package:hive/hive.dart';

import '../domain/task.dart';

/// Hand-written Hive adapter, so no code generation step is needed.
///
/// Fields are written as (index, value) pairs. Readers tolerate unknown
/// and missing indexes, which lets new fields be added without a migration.
class TaskAdapter extends TypeAdapter<Task> {
  static const int typeIdValue = 1;

  @override
  int get typeId => typeIdValue;

  @override
  Task read(BinaryReader reader) {
    final count = reader.readByte();
    final fields = <int, dynamic>{
      for (var i = 0; i < count; i++) reader.readByte(): reader.read(),
    };
    return Task(
      id: fields[0] as String,
      title: fields[1] as String,
      completed: fields[2] as bool? ?? false,
      createdAt: fields[3] as DateTime,
      updatedAt: fields[4] as DateTime,
    );
  }

  @override
  void write(BinaryWriter writer, Task obj) {
    writer
      ..writeByte(5)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.title)
      ..writeByte(2)
      ..write(obj.completed)
      ..writeByte(3)
      ..write(obj.createdAt)
      ..writeByte(4)
      ..write(obj.updatedAt);
  }
}
