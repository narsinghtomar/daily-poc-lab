import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:offline_todo/ui/app.dart';

void main() {
  testWidgets('shows empty state on launch', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: App()));

    expect(find.text('Tasks'), findsOneWidget);
    expect(find.text('No tasks yet'), findsOneWidget);
  });
}
