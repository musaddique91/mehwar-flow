import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/post_model.dart';
import '../../services/media_service.dart';
import '../../state/channels_provider.dart';
import '../../state/posts_provider.dart';
import 'ai_writing_sheet.dart';
import 'channel_selector_row.dart';

class ComposerModal extends StatefulWidget {
  final PostDto? editPost; // non-null = edit mode

  const ComposerModal({super.key, this.editPost});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ComposerModal(),
    );
  }

  /// Opens the composer pre-filled with an existing post for editing.
  static Future<void> showEdit(BuildContext context, {required PostDto post}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ComposerModal(editPost: post),
    );
  }

  @override
  State<ComposerModal> createState() => _ComposerModalState();
}

class _ComposerModalState extends State<ComposerModal> {
  final TextEditingController _textController = TextEditingController();
  final TextEditingController _commentController = TextEditingController();
  final Set<String> _selectedChannelIds = {};
  final List<String> _uploadedMediaIds = [];
  final List<File> _localMediaFiles = [];
  final MediaService _mediaService = MediaService();
  final ImagePicker _picker = ImagePicker();

  DateTime? _scheduledDateTime;
  bool _submitting = false;
  bool _uploadingMedia = false;
  bool _showCommentField = false;

  bool get _isEditing => widget.editPost != null;

  @override
  void initState() {
    super.initState();
    final ep = widget.editPost;
    if (ep != null) {
      _textController.text = ep.text;
      if (ep.firstComment != null && ep.firstComment!.isNotEmpty) {
        _commentController.text = ep.firstComment!;
        _showCommentField = true;
      }
      if (ep.scheduledAt != null) {
        _scheduledDateTime = DateTime.tryParse(ep.scheduledAt!)?.toLocal();
      }
      for (final t in ep.targets) {
        _selectedChannelIds.add(t.channelId);
      }
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final picked = await _picker.pickImage(source: ImageSource.gallery);
      if (picked == null) return;

      final file = File(picked.path);
      setState(() {
        _localMediaFiles.add(file);
        _uploadingMedia = true;
      });

      final uploaded = await _mediaService.uploadFile(
        file: file,
        fileName: picked.name,
        mimeType: 'image/jpeg',
      );

      setState(() {
        _uploadedMediaIds.add(uploaded.id);
        _uploadingMedia = false;
      });
    } catch (e) {
      setState(() => _uploadingMedia = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Media upload error: $e')),
        );
      }
    }
  }

  Future<void> _pickScheduleTime() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _scheduledDateTime ?? now.add(const Duration(hours: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );

    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduledDateTime ?? now.add(const Duration(hours: 1))),
    );

    if (pickedTime == null || !mounted) return;

    setState(() {
      _scheduledDateTime = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final channels = context.watch<ChannelsProvider>().allChannels;
    final selectedChannels = channels.where((c) => _selectedChannelIds.contains(c.id)).toList();
    final targetPlatformNames = selectedChannels.map((c) => c.platform).toSet().toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
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
                Text(
                  _isEditing ? 'Edit Post' : 'New Post',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textHeadline,
                  ),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 20, color: AppColors.textMuted),
                  onPressed: () => Navigator.pop(context),
                  tooltip: 'Close Composer',
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.softMistSurface),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // 1. Channel Selector Chips (Min 48dp)
                const Text(
                  'TARGET CHANNELS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textMuted,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 10),
                ChannelSelectorRow(
                  channels: channels,
                  selectedChannelIds: _selectedChannelIds,
                  onToggle: (id) {
                    setState(() {
                      if (_selectedChannelIds.contains(id)) {
                        _selectedChannelIds.remove(id);
                      } else {
                        _selectedChannelIds.add(id);
                      }
                    });
                  },
                ),
                const SizedBox(height: 18),

                // 2. Main Post Text Editor
                TextField(
                  controller: _textController,
                  maxLines: 6,
                  decoration: InputDecoration(
                    hintText: "What's happening? Write once, schedule across all channels...",
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                    filled: true,
                    fillColor: AppColors.inputBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(18),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),

                // Character Counter & Extras Toolbar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        // Attach media button
                        IconButton(
                          icon: const Icon(LucideIcons.image, size: 20, color: AppColors.primaryTeal),
                          tooltip: 'Add Image',
                          onPressed: _uploadingMedia ? null : _pickImage,
                        ),
                        // First comment toggle
                        IconButton(
                          icon: Icon(
                            LucideIcons.messageSquare,
                            size: 20,
                            color: _showCommentField ? AppColors.primaryTeal : AppColors.textMuted,
                          ),
                          tooltip: 'First Comment',
                          onPressed: () {
                            setState(() => _showCommentField = !_showCommentField);
                          },
                        ),
                        // Schedule time button
                        IconButton(
                          icon: Icon(
                            LucideIcons.calendar,
                            size: 20,
                            color: _scheduledDateTime != null ? AppColors.warmAmber : AppColors.textMuted,
                          ),
                          tooltip: 'Schedule Date & Time',
                          onPressed: _pickScheduleTime,
                        ),
                      ],
                    ),
                    Text(
                      '${_textController.text.length} chars',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _textController.text.length > 280
                            ? AppColors.warmAmber
                            : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),

                // Media Previews
                if (_localMediaFiles.isNotEmpty || _uploadingMedia) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 80,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _localMediaFiles.length + (_uploadingMedia ? 1 : 0),
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, idx) {
                        if (_uploadingMedia && idx == _localMediaFiles.length) {
                          return Container(
                            width: 80,
                            decoration: BoxDecoration(
                              color: AppColors.inputBg,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                          );
                        }
                        final file = _localMediaFiles[idx];
                        return Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(
                                file,
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: InkWell(
                                onTap: () {
                                  setState(() {
                                    _localMediaFiles.removeAt(idx);
                                    if (idx < _uploadedMediaIds.length) {
                                      _uploadedMediaIds.removeAt(idx);
                                    }
                                  });
                                },
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: const BoxDecoration(
                                    color: Colors.black54,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(LucideIcons.x, size: 12, color: Colors.white),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ],

                // Scheduled Time Tag if set
                if (_scheduledDateTime != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.warmAmber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.warmAmber.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(LucideIcons.clock, size: 16, color: AppColors.warmAmber),
                            const SizedBox(width: 8),
                            Text(
                              'Scheduled for: ${DateFormat('EEE, MMM d • h:mm a').format(_scheduledDateTime!)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF946200),
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: const Icon(LucideIcons.x, size: 16, color: Color(0xFF946200)),
                          onPressed: () => setState(() => _scheduledDateTime = null),
                        ),
                      ],
                    ),
                  ),
                ],

                // First Comment Field (if toggled)
                if (_showCommentField) ...[
                  const SizedBox(height: 14),
                  TextField(
                    controller: _commentController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'First comment (e.g. hashtags, resource link)...',
                      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                      filled: true,
                      fillColor: AppColors.inputBg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 18),

                // 3. AI Writing Assistant Trigger Button
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    side: const BorderSide(color: AppColors.softMistSurface),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(LucideIcons.sparkles, size: 18, color: AppColors.primaryTeal),
                  label: const Text(
                    'AI Writing Assistant',
                    style: TextStyle(color: AppColors.primaryTeal, fontWeight: FontWeight.bold),
                  ),
                  onPressed: () {
                    AiWritingSheet.show(
                      context: context,
                      initialText: _textController.text,
                      targetPlatforms: targetPlatformNames,
                      onApplyText: (newText) {
                        setState(() => _textController.text = newText);
                      },
                    );
                  },
                ),
              ],
            ),
          ),

          // Bottom Action Bar
          Container(
            padding: EdgeInsets.fromLTRB(
              20,
              12,
              20,
              MediaQuery.of(context).viewInsets.bottom + 16,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.softMistSurface)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 52),
                      side: const BorderSide(color: AppColors.sageMist),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: _submitting ? null : () => _submit(schedule: true),
                    child: Text(
                      _scheduledDateTime != null ? 'Schedule Time' : 'Save Draft',
                      style: const TextStyle(
                        color: AppColors.textHeadline,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(0, 52),
                      backgroundColor: AppColors.primaryTeal,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: _submitting || _selectedChannelIds.isEmpty
                        ? null
                        : () => _submit(schedule: false),
                    child: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Publish Now'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit({required bool schedule}) async {
    if (_textController.text.trim().isEmpty && _uploadedMediaIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter post text or attach an image')),
      );
      return;
    }

    setState(() => _submitting = true);
    final postsProvider = context.read<PostsProvider>();
    try {
      final targets = _selectedChannelIds.map((cid) => {'channelId': cid}).toList();
      final scheduledAtStr = schedule && _scheduledDateTime != null
          ? _scheduledDateTime!.toUtc().toIso8601String()
          : null;

      if (_isEditing) {
        await postsProvider.updatePost(
          id: widget.editPost!.id,
          text: _textController.text.trim(),
          firstComment: _commentController.text.trim().isNotEmpty
              ? _commentController.text.trim()
              : null,
          scheduledAt: scheduledAtStr,
          mediaIds: _uploadedMediaIds.isNotEmpty ? _uploadedMediaIds : null,
          targets: targets,
        );
        if (!schedule) {
          await postsProvider.publishNow(widget.editPost!.id);
        }
      } else {
        final post = await postsProvider.createPost(
          text: _textController.text.trim(),
          firstComment: _commentController.text.trim().isNotEmpty
              ? _commentController.text.trim()
              : null,
          scheduledAt: scheduledAtStr,
          mediaIds: _uploadedMediaIds.isNotEmpty ? _uploadedMediaIds : null,
          targets: targets,
        );

        if (!schedule) {
          await postsProvider.publishNow(post.id);
        }
      }

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}
