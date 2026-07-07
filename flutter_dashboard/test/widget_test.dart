import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_dashboard/main.dart';

void main() {
  testWidgets('dashboard shell renders', (tester) async {
    await tester.pumpWidget(const AuraDashboardApp());
    expect(find.text('Patient Dashboard'), findsWidgets);
  });
}
