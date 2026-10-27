/// A single to-do item. Immutable; use [copyWith] to derive changes.
class Task {
  const Task({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    this.completed = false,
  });

  final String id;
  final String title;
  final bool completed;
  final DateTime createdAt;
  final DateTime updatedAt;

  Task copyWith({String? title, bool? completed, DateTime? updatedAt}) => Task(
        id: id,
        title: title ?? this.title,
        completed: completed ?? this.completed,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  @override
  bool operator ==(Object other) =>
      other is Task &&
      other.id == id &&
      other.title == title &&
      other.completed == completed &&
      other.createdAt == createdAt &&
      other.updatedAt == updatedAt;

  @override
  int get hashCode => Object.hash(id, title, completed, createdAt, updatedAt);
}
