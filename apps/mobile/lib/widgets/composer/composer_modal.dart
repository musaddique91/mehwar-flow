import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/validation/platform_rules.dart';
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
  final List<String> _mediaTypes = []; // 'image' or 'video'
  final MediaService _mediaService = MediaService();
  final ImagePicker _picker = ImagePicker();

  // Per-platform options controllers
  final TextEditingController _ytTitleController = TextEditingController();
  String _ytPrivacy = 'public';
  String _igPlacement = 'feed';
  String _ttPrivacy = 'PUBLIC_TO_EVERYONE';
  bool _ttDisableComments = false;
  bool _ttDisableDuet = false;
  bool _ttDisableStitch = false;

  DateTime? _scheduledDateTime;
  bool _submitting = false;
  double? _uploadProgress;
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
    _ytTitleController.dispose();
    super.dispose();
  }

  Future<void> _pickMedia({bool isVideo = false}) async {
    try {
      XFile? picked;
      if (isVideo) {
        picked = await _picker.pickVideo(source: ImageSource.gallery);
      } else {
        picked = await _picker.pickImage(source: ImageSource.gallery);
      }
      if (picked == null) return;

      final file = File(picked.path);
      setState(() {
        _localMediaFiles.add(file);
        _mediaTypes.add(isVideo ? 'video' : 'image');
        _uploadProgress = 0.0;
      });

      final uploaded = await _mediaService.uploadMedia(
        file,
        onProgress: (sent, total) {
          if (total > 0 && mounted) {
            setState(() => _uploadProgress = sent / total);
          }
        },
      );

      setState(() {
        _uploadedMediaIds.add(uploaded.id);
        _uploadProgress = null;
      });
    } catch (e) {
      setState(() => _uploadProgress = null);
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
    final targetPlatformNames = selectedChannels.map((c) => c.platform.toLowerCase()).toSet().toList();

    // Check validation per target platform
    final validationErrors = <String>[];
    final imageCount = _mediaTypes.where((t) => t == 'image').length;
    final videoCount = _mediaTypes.where((t) => t == 'video').length;
    for (final p in targetPlatformNames) {
      final issues = validatePostForPlatform(
        platform: p,
        text: _textController.text,
        imageCount: imageCount,
        videoCount: videoCount,
      );
      for (final issue in issues) {
        if (issue.isError) {
          validationErrors.add('${issue.platform.toUpperCase()}: ${issue.message}');
        }
      }
    }

    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
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
                        // Attach image button
                        IconButton(
                          icon: const Icon(LucideIcons.image, size: 20, color: AppColors.primaryTeal),
                          tooltip: 'Add Image',
                          onPressed: _uploadProgress != null ? null : () => _pickMedia(isVideo: false),
                        ),
                        // Attach video button
                        IconButton(
                          icon: const Icon(LucideIcons.video, size: 20, color: AppColors.primaryTeal),
                          tooltip: 'Add Video',
                          onPressed: _uploadProgress != null ? null : () => _pickMedia(isVideo: true),
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
                        color: validationErrors.isNotEmpty ? Colors.red : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),

                // Live Validation Errors
                if (validationErrors.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.red.withAlpha(20),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.withAlpha(80)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: validationErrors.map((err) => Text(
                        err,
                        style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.w600),
                      )).toList(),
                    ),
                  ),
                ],

                // Upload Progress Bar
                if (_uploadProgress != null) ...[
                  const SizedBox(height: 10),
                  LinearProgressIndicator(value: _uploadProgress),
                  const SizedBox(height: 4),
                  Text('Uploading media: ${((_uploadProgress ?? 0) * 100).toInt()}%', style: const TextStyle(fontSize: 11)),
                ],

                // Media Previews
                if (_localMediaFiles.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 80,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _localMediaFiles.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, idx) {
                        final file = _localMediaFiles[idx];
                        final isVid = _mediaTypes[idx] == 'video';
                        return Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: isVid
                                  ? Container(
                                      width: 80,
                                      height: 80,
                                      color: Colors.black87,
                                      child: const Icon(Icons.movie, color: Colors.white70),
                                    )
                                  : Image.file(
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
                                    _mediaTypes.removeAt(idx);
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

                // Per-platform options sections
                if (targetPlatformNames.contains('youtube')) ...[
                  const SizedBox(height: 16),
                  _buildPlatformOptionsHeader('YouTube Options'),
                  TextField(
                    controller: _ytTitleController,
                    decoration: const InputDecoration(
                      labelText: 'Video Title *',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _ytPrivacy,
                    decoration: const InputDecoration(labelText: 'Privacy', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'public', child: Text('Public')),
                      DropdownMenuItem(value: 'unlisted', child: Text('Unlisted')),
                      DropdownMenuItem(value: 'private', child: Text('Private')),
                    ],
                    onChanged: (v) => setState(() => _ytPrivacy = v ?? 'public'),
                  ),
                ],

                if (targetPlatformNames.contains('instagram')) ...[
                  const SizedBox(height: 16),
                  _buildPlatformOptionsHeader('Instagram Placement'),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'feed', label: Text('Feed')),
                      ButtonSegment(value: 'reels', label: Text('Reels')),
                      ButtonSegment(value: 'story', label: Text('Story')),
                    ],
                    selected: {_igPlacement},
                    onSelectionChanged: (s) => setState(() => _igPlacement = s.first),
                  ),
                ],

                if (targetPlatformNames.contains('tiktok')) ...[
                  const SizedBox(height: 16),
                  _buildPlatformOptionsHeader('TikTok Settings'),
                  DropdownButtonFormField<String>(
                    initialValue: _ttPrivacy,
                    decoration: const InputDecoration(labelText: 'Privacy Level', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'PUBLIC_TO_EVERYONE', child: Text('Public')),
                      DropdownMenuItem(value: 'MUTUAL_FOLLOW_FRIENDS', child: Text('Friends Only')),
                      DropdownMenuItem(value: 'SELF_ONLY', child: Text('Private')),
                    ],
                    onChanged: (v) => setState(() => _ttPrivacy = v ?? 'PUBLIC_TO_EVERYONE'),
                  ),
                  CheckboxListTile(
                    title: const Text('Disable Comments'),
                    value: _ttDisableComments,
                    onChanged: (v) => setState(() => _ttDisableComments = v ?? false),
                    contentPadding: EdgeInsets.zero,
                  ),
                  CheckboxListTile(
                    title: const Text('Disable Duet'),
                    value: _ttDisableDuet,
                    onChanged: (v) => setState(() => _ttDisableDuet = v ?? false),
                    contentPadding: EdgeInsets.zero,
                  ),
                  CheckboxListTile(
                    title: const Text('Disable Stitch'),
                    value: _ttDisableStitch,
                    onChanged: (v) => setState(() => _ttDisableStitch = v ?? false),
                    contentPadding: EdgeInsets.zero,
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
                      _scheduledDateTime != null ? 'Schedule Post' : 'Save Draft',
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
                    onPressed: _submitting || _selectedChannelIds.isEmpty || validationErrors.isNotEmpty
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

  Widget _buildPlatformOptionsHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryTeal),
      ),
    );
  }

  Future<void> _submit({required bool schedule}) async {
    if (_textController.text.trim().isEmpty && _uploadedMediaIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter post text or attach media')),
      );
      return;
    }

    setState(() => _submitting = true);
    final postsProvider = context.read<PostsProvider>();
    final channels = context.read<ChannelsProvider>().allChannels;

    try {
      final targets = <TargetInput>[];
      for (final cid in _selectedChannelIds) {
        final ch = channels.firstWhere((c) => c.id == cid, orElse: () => channels.first);
        final platform = ch.platform.toLowerCase();

        TargetOptions? opts;
        if (platform == 'youtube') {
          opts = TargetOptions(
            title: _ytTitleController.text.trim().isNotEmpty ? _ytTitleController.text.trim() : null,
            privacy: _ytPrivacy,
          );
        } else if (platform == 'instagram') {
          opts = TargetOptions(igMediaType: _igPlacement);
        } else if (platform == 'tiktok') {
          opts = TargetOptions(
            privacy: _ttPrivacy,
            disableComment: _ttDisableComments,
            disableDuet: _ttDisableDuet,
            disableStitch: _ttDisableStitch,
          );
        }

        targets.add(TargetInput(channelId: cid, options: opts));
      }

      String? localDateTimeStr;
      String? timezoneStr;

      if (schedule && _scheduledDateTime != null) {
        localDateTimeStr = DateFormat("yyyy-MM-dd'T'HH:mm:ss").format(_scheduledDateTime!);
        try {
          final tzInfo = await FlutterTimezone.getLocalTimezone();
          timezoneStr = tzInfo.identifier;
        } catch (_) {
          timezoneStr = 'UTC';
        }
      }

      if (_isEditing) {
        await postsProvider.updatePost(
          id: widget.editPost!.id,
          text: _textController.text.trim(),
          firstComment: _commentController.text.trim().isNotEmpty ? _commentController.text.trim() : null,
          localDateTime: localDateTimeStr,
          timezone: timezoneStr,
          mediaIds: _uploadedMediaIds.isNotEmpty ? _uploadedMediaIds : null,
          targets: targets,
        );
        if (!schedule) {
          await postsProvider.publishNow(widget.editPost!.id);
        }
      } else {
        final post = await postsProvider.createPost(
          text: _textController.text.trim(),
          firstComment: _commentController.text.trim().isNotEmpty ? _commentController.text.trim() : null,
          localDateTime: localDateTimeStr,
          timezone: timezoneStr,
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
