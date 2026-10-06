import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/channel_model.dart';

class ChannelSelectorRow extends StatelessWidget {
  final List<ChannelDto> channels;
  final Set<String> selectedChannelIds;
  final ValueChanged<String> onToggle;

  const ChannelSelectorRow({
    super.key,
    required this.channels,
    required this.selectedChannelIds,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    if (channels.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.inputBg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Row(
          children: [
            Icon(Icons.info_outline, size: 20, color: AppColors.textMuted),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'No channels connected yet. Go to Channels tab to connect accounts.',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
          ],
        ),
      );
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: channels.map((channel) {
        final isSelected = selectedChannelIds.contains(channel.id);
        final pColor = AppColors.platformColor(channel.platform);

        return Semantics(
          button: true,
          selected: isSelected,
          label: 'Target ${channel.displayName} on ${channel.platform}',
          child: InkWell(
            onTap: () => onToggle(channel.id),
            borderRadius: BorderRadius.circular(14),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              constraints: const BoxConstraints(minHeight: 48),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primaryTeal : AppColors.inputBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isSelected ? AppColors.primaryTeal : AppColors.softMistSurface,
                  width: 1.2,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: isSelected ? Colors.white.withValues(alpha: 0.2) : pColor.withValues(alpha: 0.15),
                    backgroundImage: channel.avatarUrl != null ? NetworkImage(channel.avatarUrl!) : null,
                    child: channel.avatarUrl == null
                        ? Text(
                            channel.platform.substring(0, 1).toUpperCase(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? Colors.white : pColor,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    channel.displayName,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.textHeadline,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
