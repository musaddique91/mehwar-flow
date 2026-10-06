import 'package:flutter/material.dart';

class AppColors {
  // Nordic Slate Teal & Sage Design System
  static const Color primaryTeal     = Color(0xFF2F4B4E); // 01
  static const Color sageMist        = Color(0xFFBFC7C8); // 02
  static const Color coolSlate       = Color(0xFFA5B3B4); // 03
  static const Color obsidianInk     = Color(0xFF152223); // 04
  static const Color softMistSurface = Color(0xFFDCDEDE); // 05
  static const Color scaffoldBg      = Color(0xFFF7F9F9);
  static const Color cardSurface     = Color(0xFFFFFFFF);
  static const Color inputBg         = Color(0xFFF2F4F4);
  static const Color textHeadline    = Color(0xFF152223);
  static const Color textBody        = Color(0xFF2A3638);
  static const Color textMuted       = Color(0xFF7E8B8C);
  static const Color warmAmber       = Color(0xFFE5A93C);
  static const Color softRed         = Color(0xFFD9534F);
  static const Color successGreen    = Color(0xFF2E7D32);

  // Platform Colors
  static Color platformColor(String platform) {
    switch (platform.toLowerCase()) {
      case 'x':
      case 'twitter':
        return const Color(0xFF14171A);
      case 'facebook':
        return const Color(0xFF1877F2);
      case 'instagram':
        return const Color(0xFFE4405F);
      case 'threads':
        return const Color(0xFF101010);
      case 'youtube':
        return const Color(0xFFFF0000);
      case 'tiktok':
        return const Color(0xFF010101);
      case 'linkedin':
        return const Color(0xFF0A66C2);
      case 'pinterest':
        return const Color(0xFFBD081C);
      case 'bluesky':
        return const Color(0xFF1185FE);
      default:
        return primaryTeal;
    }
  }
}
