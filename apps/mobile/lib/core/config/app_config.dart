class AppConfig {
  static const String defaultRemoteUrl = 'https://mehwar.maverickignite.com/api';

  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('API_URL');
    if (fromEnv.isNotEmpty) {
      return fromEnv;
    }
    return defaultRemoteUrl;
  }
}
