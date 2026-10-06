import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'screens/home/dashboard_screen.dart';
import 'state/analytics_provider.dart';
import 'state/auth_provider.dart';
import 'state/channels_provider.dart';
import 'state/posts_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MehwarFlowApp());
}

class MehwarFlowApp extends StatelessWidget {
  final AuthProvider? authProvider;
  final ChannelsProvider? channelsProvider;
  final PostsProvider? postsProvider;
  final AnalyticsProvider? analyticsProvider;

  const MehwarFlowApp({
    super.key,
    this.authProvider,
    this.channelsProvider,
    this.postsProvider,
    this.analyticsProvider,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProvider ?? AuthProvider()),
        ChangeNotifierProvider.value(value: channelsProvider ?? ChannelsProvider()),
        ChangeNotifierProvider.value(value: postsProvider ?? PostsProvider()),
        ChangeNotifierProvider.value(value: analyticsProvider ?? AnalyticsProvider()),
      ],
      child: MaterialApp(
        title: 'Mehwar Flow',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.nordicSlateTheme,
        home: const DashboardScreen(),
      ),
    );
  }
}
