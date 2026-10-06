import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../services/ai_service.dart';

class AiWritingSheet extends StatefulWidget {
  final String initialText;
  final List<String> targetPlatforms;
  final ValueChanged<String> onApplyText;

  const AiWritingSheet({
    super.key,
    required this.initialText,
    required this.targetPlatforms,
    required this.onApplyText,
  });

  static Future<void> show({
    required BuildContext context,
    required String initialText,
    required List<String> targetPlatforms,
    required ValueChanged<String> onApplyText,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AiWritingSheet(
        initialText: initialText,
        targetPlatforms: targetPlatforms,
        onApplyText: onApplyText,
      ),
    );
  }

  @override
  State<AiWritingSheet> createState() => _AiWritingSheetState();
}

class _AiWritingSheetState extends State<AiWritingSheet> {
  final AiService _aiService = AiService();
  late final TextEditingController _promptController;
  String _selectedTone = 'Engaging';
  String _selectedMode = 'caption'; // 'caption', 'rewrite', 'hashtags'
  bool _isLoading = false;
  String? _errorMessage;
  List<AiCaptionResult> _captionResults = [];
  String? _rewrittenText;
  List<String> _hashtags = [];

  final List<String> _tones = ['Engaging', 'Professional', 'Casual', 'Bold', 'Minimalist'];

  @override
  void initState() {
    super.initState();
    _promptController = TextEditingController(text: widget.initialText);
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final input = _promptController.text.trim();
    if (input.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _captionResults = [];
      _rewrittenText = null;
      _hashtags = [];
    });

    try {
      if (_selectedMode == 'caption') {
        final results = await _aiService.generateCaptions(
          prompt: input,
          platforms: widget.targetPlatforms.isEmpty ? ['x'] : widget.targetPlatforms,
          tone: _selectedTone,
        );
        setState(() => _captionResults = results);
      } else if (_selectedMode == 'rewrite') {
        final platform = widget.targetPlatforms.isNotEmpty ? widget.targetPlatforms.first : 'x';
        final result = await _aiService.rewrite(
          text: input,
          platform: platform,
          instruction: 'Make it $_selectedTone and optimized for maximum reader engagement',
        );
        setState(() => _rewrittenText = result);
      } else if (_selectedMode == 'hashtags') {
        final platform = widget.targetPlatforms.isNotEmpty ? widget.targetPlatforms.first : 'x';
        final tags = await _aiService.generateHashtags(
          text: input,
          platform: platform,
        );
        setState(() => _hashtags = tags);
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString());
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: const BoxDecoration(
        color: AppColors.cardSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Drag handle & title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(LucideIcons.sparkles, size: 20, color: AppColors.primaryTeal),
                    SizedBox(width: 8),
                    Text(
                      'AI Writing Assistant',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textHeadline,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 20, color: AppColors.textMuted),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Close AI sheet',
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.softMistSurface),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Mode selector tabs
                Row(
                  children: [
                    _buildModeChip('caption', 'Captions', LucideIcons.fileText),
                    const SizedBox(width: 8),
                    _buildModeChip('rewrite', 'Rewrite', LucideIcons.repeat),
                    const SizedBox(width: 8),
                    _buildModeChip('hashtags', 'Hashtags', LucideIcons.hash),
                  ],
                ),
                const SizedBox(height: 16),

                // Prompt Input
                TextField(
                  controller: _promptController,
                  maxLines: 4,
                  decoration: InputDecoration(
                    hintText: _selectedMode == 'caption'
                        ? 'Describe your post topic, bullet points, or idea...'
                        : 'Enter draft text to transform...',
                  ),
                ),
                const SizedBox(height: 14),

                // Tone selection chips
                if (_selectedMode != 'hashtags') ...[
                  const Text(
                    'TONE OF VOICE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: _tones.map((tone) {
                      final selected = _selectedTone == tone;
                      return ChoiceChip(
                        label: Text(tone),
                        selected: selected,
                        selectedColor: AppColors.primaryTeal,
                        backgroundColor: AppColors.inputBg,
                        side: BorderSide(
                          color: selected ? AppColors.primaryTeal : AppColors.softMistSurface,
                        ),
                        labelStyle: TextStyle(
                          color: selected ? Colors.white : AppColors.textHeadline,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                        onSelected: (_) => setState(() => _selectedTone = tone),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],

                // Action generate button
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _generate,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(LucideIcons.sparkles, size: 18),
                  label: Text(_isLoading ? 'Generating with AI...' : 'Generate with AI'),
                ),

                if (_errorMessage != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.softRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: AppColors.softRed, fontSize: 13),
                    ),
                  ),
                ],

                // Results section
                if (_captionResults.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'GENERATED CAPTIONS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ..._captionResults.map((c) => _buildCaptionCard(c)),
                ],

                if (_rewrittenText != null) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'REWRITTEN RESULT',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.inputBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.softMistSurface),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _rewrittenText!,
                          style: const TextStyle(fontSize: 14, color: AppColors.textHeadline),
                        ),
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            icon: const Icon(LucideIcons.check, size: 16),
                            label: const Text('Use This Text'),
                            onPressed: () {
                              widget.onApplyText(_rewrittenText!);
                              Navigator.pop(context);
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                if (_hashtags.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'GENERATED HASHTAGS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textMuted,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _hashtags.map((tag) {
                      final formatted = tag.startsWith('#') ? tag : '#$tag';
                      return ActionChip(
                        label: Text(formatted),
                        backgroundColor: AppColors.inputBg,
                        onPressed: () {
                          widget.onApplyText('${widget.initialText} $formatted');
                          Navigator.pop(context);
                        },
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeChip(String mode, String label, IconData icon) {
    final selected = _selectedMode == mode;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedMode = mode),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? AppColors.primaryTeal.withValues(alpha: 0.1) : AppColors.inputBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.primaryTeal : AppColors.softMistSurface,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: selected ? AppColors.primaryTeal : AppColors.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: selected ? AppColors.primaryTeal : AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCaptionCard(AiCaptionResult result) {
    final pColor = AppColors.platformColor(result.platform);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.inputBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.softMistSurface),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: pColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  result.platform.toUpperCase(),
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: pColor),
                ),
              ),
              TextButton.icon(
                icon: const Icon(LucideIcons.check, size: 14),
                label: const Text('Use', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                onPressed: () {
                  String fullText = result.text;
                  if (result.hashtags.isNotEmpty) {
                    final tags = result.hashtags.map((h) => h.startsWith('#') ? h : '#$h').join(' ');
                    fullText = '$fullText\n\n$tags';
                  }
                  widget.onApplyText(fullText);
                  Navigator.pop(context);
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            result.text,
            style: const TextStyle(fontSize: 14, color: AppColors.textHeadline),
          ),
          if (result.hashtags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              result.hashtags.map((h) => h.startsWith('#') ? h : '#$h').join(' '),
              style: const TextStyle(fontSize: 12, color: AppColors.primaryTeal, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }
}
