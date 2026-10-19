import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';
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
      child: const _AppView(),
    );
  }
}

class _AppView extends StatefulWidget {
  const _AppView();

  @override
  State<_AppView> createState() => _AppViewState();
}

class _AppViewState extends State<_AppView> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _router = AppRouter.createRouter(auth);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Mehwar Flow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.nordicSlateTheme,
      routerConfig: _router,
    );
  }
}
