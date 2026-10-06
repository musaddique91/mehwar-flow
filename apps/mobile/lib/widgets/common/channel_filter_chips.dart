import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class ChannelFilterChips extends StatelessWidget {
  final List<String> options;
  final String? selected;
  final ValueChanged<String> onSelected;

  const ChannelFilterChips({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = options[index];
          final isSelected = selected == item || (selected == null && item == 'ALL');

          return Semantics(
            button: true,
            selected: isSelected,
            label: 'Filter by $item',
            child: ChoiceChip(
              label: Text(item),
              selected: isSelected,
              selectedColor: AppColors.primaryTeal,
              backgroundColor: AppColors.cardSurface,
              side: BorderSide(
                color: isSelected ? AppColors.primaryTeal : AppColors.softMistSurface,
                width: 1.2,
              ),
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.textHeadline,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              onSelected: (_) => onSelected(item),
            ),
          );
        },
      ),
    );
  }
}
