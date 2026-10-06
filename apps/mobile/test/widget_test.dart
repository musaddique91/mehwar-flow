import 'package:flutter_test/flutter_test.dart';
import 'package:mehwar_mobile/main.dart';
import 'package:mehwar_mobile/state/auth_provider.dart';

void main() {
  testWidgets('MehwarFlowApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MehwarFlowApp(
        authProvider: AuthProvider(autoInit: false),
      ),
    );
    expect(find.byType(MehwarFlowApp), findsOneWidget);
  });
}
