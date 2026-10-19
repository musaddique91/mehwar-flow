import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../screens/analytics/analytics_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/register_screen.dart';
import '../../screens/automation/automation_screen.dart';
import '../../screens/calendar/calendar_screen.dart';
import '../../screens/channels/channel_detail_screen.dart';
import '../../screens/channels/channel_select_screen.dart';
import '../../screens/channels/channels_screen.dart';
import '../../screens/comments/comments_screen.dart';
import '../../screens/customers/customers_screen.dart';
import '../../screens/home/dashboard_screen.dart';
import '../../screens/media/media_screen.dart';
import '../../screens/more/more_screen.dart';
import '../../screens/notifications/notifications_screen.dart';
import '../../screens/post_detail/post_detail_screen.dart';
import '../../screens/schedules/schedules_screen.dart';
import '../../screens/settings/settings_screen.dart';
import '../../state/auth_provider.dart';
import '../../widgets/composer/composer_modal.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<NavigatorState> shellNavigatorKey = GlobalKey<NavigatorState>();

class AppRouter {
  static GoRouter createRouter(AuthProvider authProvider) {
    return GoRouter(
      navigatorKey: rootNavigatorKey,
      initialLocation: '/home',
      refreshListenable: authProvider,
      redirect: (context, state) {
        if (!authProvider.isInitialized) return null;

        final loggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/register';

        if (!authProvider.isAuthenticated) {
          return loggingIn ? null : '/login';
        }

        if (loggingIn) {
          return '/home';
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/register',
          builder: (context, state) => const RegisterScreen(),
        ),
        ShellRoute(
          navigatorKey: shellNavigatorKey,
          builder: (context, state, child) {
            return MainShellScaffold(child: child);
          },
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const DashboardScreen(),
            ),
            GoRoute(
              path: '/schedules',
              builder: (context, state) => const SchedulesScreen(),
            ),
            GoRoute(
              path: '/comments',
              builder: (context, state) => const CommentsScreen(),
            ),
            GoRoute(
              path: '/more',
              builder: (context, state) => const MoreScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/calendar',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const CalendarScreen(),
        ),
        GoRoute(
          path: '/customers',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const CustomersScreen(),
        ),
        GoRoute(
          path: '/automation',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const AutomationScreen(),
        ),
        GoRoute(
          path: '/media',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const MediaScreen(),
        ),
        GoRoute(
          path: '/notifications',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/channels',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const ChannelsScreen(),
          routes: [
            GoRoute(
              path: 'detail/:id',
              parentNavigatorKey: rootNavigatorKey,
              builder: (context, state) => ChannelDetailScreen(
                channelId: state.pathParameters['id']!,
              ),
            ),
            GoRoute(
              path: 'select',
              parentNavigatorKey: rootNavigatorKey,
              builder: (context, state) => ChannelSelectScreen(
                sessionToken: state.uri.queryParameters['session'] ?? '',
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/analytics',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const AnalyticsScreen(),
        ),
        GoRoute(
          path: '/settings',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => const SettingsScreen(),
        ),
        GoRoute(
          path: '/posts/:id',
          parentNavigatorKey: rootNavigatorKey,
          builder: (context, state) => PostDetailScreen(
            postId: state.pathParameters['id']!,
          ),
        ),
      ],
    );
  }
}

class MainShellScaffold extends StatelessWidget {
  final Widget child;
  const MainShellScaffold({super.key, required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/schedules')) return 1;
    if (location.startsWith('/comments')) return 3;
    if (location.startsWith('/more')) return 4;
    return 0; // /home
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.softMistSurface)),
        ),
        child: BottomNavigationBar(
          currentIndex: selectedIndex,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.primaryTeal,
          unselectedItemColor: AppColors.textMuted,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          onTap: (index) {
            if (index == 0) context.go('/home');
            if (index == 1) context.go('/schedules');
            if (index == 2) {
              ComposerModal.show(context);
            }
            if (index == 3) context.go('/comments');
            if (index == 4) context.go('/more');
          },
          items: [
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.layoutDashboard, size: 20),
              label: 'Home',
            ),
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.calendarClock, size: 20),
              label: 'Schedules',
            ),
            BottomNavigationBarItem(
              icon: Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: AppColors.primaryTeal,
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.plus, size: 18, color: Colors.white),
              ),
              label: 'Create',
            ),
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.messageSquare, size: 20),
              label: 'Inbox',
            ),
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.moreHorizontal, size: 20),
              label: 'More',
            ),
          ],
        ),
      ),
    );
  }
}
