import 'package:flutter/material.dart';
import '../../core/config/app_config.dart';
import '../../core/theme/platform_brand.dart';

/// A circular avatar displaying platform branding color, gradient border
/// and an avatar image (if provided) — matching the web's channel bubbles.
class PlatformAvatar extends StatelessWidget {
  final String platform;
  final String? avatarUrl;
  final double size;
  final bool showBadge;

  const PlatformAvatar({
    super.key,
    required this.platform,
    this.avatarUrl,
    this.size = 48,
    this.showBadge = true,
  });

  @override
  Widget build(BuildContext context) {
    final brand = brandOf(platform);
    final letter = platformLetter(platform);
    final badgeSize = size * 0.33;

    final String? resolvedUrl;
    if (avatarUrl == null || avatarUrl!.isEmpty) {
      resolvedUrl = null;
    } else if (avatarUrl!.startsWith('http://') || avatarUrl!.startsWith('https://')) {
      resolvedUrl = avatarUrl;
    } else {
      final base = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');
      resolvedUrl = '$base$avatarUrl';
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: brand.gradient,
            shape: BoxShape.circle,
          ),
          padding: const EdgeInsets.all(2),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: ClipOval(
              child: resolvedUrl != null && resolvedUrl.isNotEmpty
                  ? Image.network(
                      resolvedUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _fallback(brand, letter, size),
                    )
                  : _fallback(brand, letter, size),
            ),
          ),
        ),
        if (showBadge)
          Positioned(
            bottom: -2,
            right: -2,
            child: Container(
              width: badgeSize,
              height: badgeSize,
              decoration: BoxDecoration(
                color: brand.color,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: Center(
                child: Text(
                  letter.length <= 2 ? letter : letter[0],
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: badgeSize * 0.44,
                    fontWeight: FontWeight.bold,
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _fallback(PlatformBrand brand, String letter, double size) {
    return Container(
      color: brand.color.withValues(alpha: 0.12),
      child: Center(
        child: Text(
          letter.length <= 2 ? letter : letter[0],
          style: TextStyle(
            color: brand.color,
            fontSize: size * 0.36,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
