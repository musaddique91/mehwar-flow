import 'package:flutter/material.dart';

/// Per-platform branding colors, gradients, and icon data.
/// Mirrors the web's `PLATFORM_BRAND` in `apps/web/src/lib/platforms.tsx`.
class PlatformBrand {
  final Color color;
  final Gradient gradient;
  final String label;

  const PlatformBrand({
    required this.color,
    required this.gradient,
    required this.label,
  });
}

const Map<String, PlatformBrand> kPlatformBrand = {
  'x': PlatformBrand(
    color: Color(0xFF14171A),
    gradient: LinearGradient(colors: [Color(0xFF14171A), Color(0xFF333333)]),
    label: 'X / Twitter',
  ),
  'twitter': PlatformBrand(
    color: Color(0xFF14171A),
    gradient: LinearGradient(colors: [Color(0xFF14171A), Color(0xFF333333)]),
    label: 'X / Twitter',
  ),
  'facebook': PlatformBrand(
    color: Color(0xFF1877F2),
    gradient: LinearGradient(colors: [Color(0xFF1877F2), Color(0xFF42A5F5)]),
    label: 'Facebook',
  ),
  'instagram': PlatformBrand(
    color: Color(0xFFE4405F),
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFFF56040), Color(0xFFE4405F), Color(0xFF833AB4)],
    ),
    label: 'Instagram',
  ),
  'threads': PlatformBrand(
    color: Color(0xFF101010),
    gradient: LinearGradient(colors: [Color(0xFF101010), Color(0xFF444444)]),
    label: 'Threads',
  ),
  'youtube': PlatformBrand(
    color: Color(0xFFFF0000),
    gradient: LinearGradient(colors: [Color(0xFFFF0000), Color(0xFFCC0000)]),
    label: 'YouTube',
  ),
  'tiktok': PlatformBrand(
    color: Color(0xFF010101),
    gradient: LinearGradient(colors: [Color(0xFF010101), Color(0xFF69C9D0)]),
    label: 'TikTok',
  ),
  'linkedin': PlatformBrand(
    color: Color(0xFF0A66C2),
    gradient: LinearGradient(colors: [Color(0xFF0A66C2), Color(0xFF0073B1)]),
    label: 'LinkedIn',
  ),
  'pinterest': PlatformBrand(
    color: Color(0xFFBD081C),
    gradient: LinearGradient(colors: [Color(0xFFBD081C), Color(0xFFE60023)]),
    label: 'Pinterest',
  ),
  'bluesky': PlatformBrand(
    color: Color(0xFF1185FE),
    gradient: LinearGradient(colors: [Color(0xFF1185FE), Color(0xFF0077FF)]),
    label: 'Bluesky',
  ),
  'whatsapp': PlatformBrand(
    color: Color(0xFF25D366),
    gradient: LinearGradient(colors: [Color(0xFF25D366), Color(0xFF128C7E)]),
    label: 'WhatsApp',
  ),
};

PlatformBrand brandOf(String platform) {
  return kPlatformBrand[platform.toLowerCase()] ??
      const PlatformBrand(
        color: Color(0xFF2F4B4E),
        gradient: LinearGradient(colors: [Color(0xFF2F4B4E), Color(0xFF4A7B80)]),
        label: 'Unknown',
      );
}

/// Returns a single emoji/letter avatar that works with brand color
String platformLetter(String platform) {
  switch (platform.toLowerCase()) {
    case 'x':
    case 'twitter':
      return 'X';
    case 'facebook':
      return 'f';
    case 'instagram':
      return '📷';
    case 'threads':
      return '@';
    case 'youtube':
      return '▶';
    case 'tiktok':
      return '♪';
    case 'linkedin':
      return 'in';
    case 'pinterest':
      return 'P';
    case 'bluesky':
      return '☁';
    case 'whatsapp':
      return '✉';
    default:
      return platform.isNotEmpty ? platform[0].toUpperCase() : '?';
  }
}

/// Returns all known platform keys for the "connect" flow
const List<String> kAllPlatforms = [
  'x',
  'facebook',
  'instagram',
  'threads',
  'youtube',
  'tiktok',
  'linkedin',
  'pinterest',
  'bluesky',
];
