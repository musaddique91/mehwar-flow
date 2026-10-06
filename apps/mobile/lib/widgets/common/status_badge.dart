import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.status,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label = status.toUpperCase();

    switch (status.toUpperCase()) {
      case 'PUBLISHED':
        bg = AppColors.successGreen.withValues(alpha: 0.12);
        fg = AppColors.successGreen;
        break;
      case 'SCHEDULED':
        bg = AppColors.warmAmber.withValues(alpha: 0.15);
        fg = const Color(0xFFB8780E);
        break;
      case 'DRAFT':
        bg = AppColors.softMistSurface;
        fg = AppColors.textMuted;
        break;
      case 'PUBLISHING':
        bg = AppColors.primaryTeal.withValues(alpha: 0.12);
        fg = AppColors.primaryTeal;
        break;
      case 'FAILED':
        bg = AppColors.softRed.withValues(alpha: 0.12);
        fg = AppColors.softRed;
        break;
      default:
        bg = AppColors.inputBg;
        fg = AppColors.textMuted;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
