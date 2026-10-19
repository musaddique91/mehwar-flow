import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/media_model.dart';
import '../../services/media_service.dart';

class MediaScreen extends StatefulWidget {
  final bool isPicker;
  const MediaScreen({super.key, this.isPicker = false});

  @override
  State<MediaScreen> createState() => _MediaScreenState();
}

class _MediaScreenState extends State<MediaScreen> {
  final MediaService _service = MediaService();
  final ImagePicker _picker = ImagePicker();

  List<MediaItem> _items = [];
  bool _loading = false;
  String? _error;
  String _filter = 'all'; // all, image, video

  double? _uploadProgress;
  String? _uploadStatusText;

  @override
  void initState() {
    super.initState();
    _loadMedia();
  }

  Future<void> _loadMedia() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _service.listMedia(type: _filter == 'all' ? null : _filter);
      setState(() => _items = items);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _pickAndUpload(ImageSource source, {bool isVideo = false}) async {
    try {
      XFile? picked;
      if (isVideo) {
        picked = await _picker.pickVideo(source: source);
      } else {
        picked = await _picker.pickImage(source: source);
      }
      if (picked == null) return;

      final file = File(picked.path);
      setState(() {
        _uploadProgress = 0.0;
        _uploadStatusText = 'Starting upload...';
      });

      await _service.uploadMedia(
        file,
        onProgress: (sent, total) {
          if (total > 0 && mounted) {
            setState(() {
              _uploadProgress = sent / total;
              _uploadStatusText = 'Uploading: ${(sent / (1024 * 1024)).toStringAsFixed(1)}MB / ${(total / (1024 * 1024)).toStringAsFixed(1)}MB';
            });
          }
        },
      );

      setState(() {
        _uploadProgress = null;
        _uploadStatusText = null;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Upload successful!')));
      }
      _loadMedia();
    } catch (e) {
      setState(() {
        _uploadProgress = null;
        _uploadStatusText = null;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    }
  }

  void _showUploadPickerOptions() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Pick Image from Gallery'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUpload(ImageSource.gallery, isVideo: false);
              },
            ),
            ListTile(
              leading: const Icon(Icons.video_library),
              title: const Text('Pick Video from Gallery'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUpload(ImageSource.gallery, isVideo: true);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take Photo with Camera'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUpload(ImageSource.camera, isVideo: false);
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam),
              title: const Text('Record Video with Camera'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUpload(ImageSource.camera, isVideo: true);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isPicker ? 'Select Media' : 'Media Library'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadMedia,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _uploadProgress != null ? null : _showUploadPickerOptions,
        child: const Icon(Icons.cloud_upload),
      ),
      body: Column(
        children: [
          if (_uploadProgress != null)
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.blue.withAlpha(20),
              child: Column(
                children: [
                  LinearProgressIndicator(value: _uploadProgress),
                  const SizedBox(height: 6),
                  Text(_uploadStatusText ?? '', style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'all', label: Text('All')),
                ButtonSegment(value: 'image', label: Text('Images')),
                ButtonSegment(value: 'video', label: Text('Videos')),
              ],
              selected: {_filter},
              onSelectionChanged: (newSel) {
                setState(() => _filter = newSel.first);
                _loadMedia();
              },
            ),
          ),
          Expanded(
            child: _loading && _items.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _error != null && _items.isEmpty
                    ? Center(child: Text('Error: $_error'))
                    : _items.isEmpty
                        ? const Center(child: Text('No media items found.'))
                        : RefreshIndicator(
                            onRefresh: _loadMedia,
                            child: GridView.builder(
                              padding: const EdgeInsets.all(12),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: 8,
                                mainAxisSpacing: 8,
                                childAspectRatio: 1,
                              ),
                              itemCount: _items.length,
                              itemBuilder: (context, index) {
                                final item = _items[index];
                                return _buildMediaTile(item);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildMediaTile(MediaItem item) {
    final isVideo = item.mediaType == 'video';

    return GestureDetector(
      onTap: () {
        if (widget.isPicker) {
          Navigator.pop(context, item);
        } else {
          _showMediaDetail(item);
        }
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              color: Colors.grey.shade900,
              child: Image.network(
                item.displayUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Center(
                  child: Icon(Icons.broken_image, color: Colors.grey),
                ),
              ),
            ),
            if (isVideo)
              const Center(
                child: Icon(Icons.play_circle_filled, color: Colors.white70, size: 36),
              ),
            if (item.status == 'processing')
              Container(
                color: Colors.black54,
                child: const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  ),
                ),
              ),
            Positioned(
              bottom: 4,
              right: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  isVideo && item.durationSec != null
                      ? '${item.durationSec}s'
                      : '${(item.sizeBytes / (1024 * 1024)).toStringAsFixed(1)}M',
                  style: const TextStyle(color: Colors.white, fontSize: 10),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMediaDetail(MediaItem item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item.filename, style: const TextStyle(fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                item.displayUrl,
                height: 180,
                width: double.infinity,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const SizedBox(
                  height: 100,
                  child: Center(child: Icon(Icons.movie, size: 48)),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text('Type: ${item.mediaType} (${item.mimeType})'),
            Text('Size: ${(item.sizeBytes / (1024 * 1024)).toStringAsFixed(2)} MB'),
            if (item.durationSec != null) Text('Duration: ${item.durationSec} seconds'),
            if (item.width != null && item.height != null) Text('Dimensions: ${item.width} x ${item.height}'),
            Text('Status: ${item.status}'),
            if (item.processingError != null)
              Text('Error: ${item.processingError}', style: const TextStyle(color: Colors.red)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final confirm = await showDialog<bool>(
                context: context,
                builder: (c) => AlertDialog(
                  title: const Text('Delete Media'),
                  content: const Text('Are you sure you want to permanently delete this file?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                    TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
                  ],
                ),
              );
              if (confirm == true) {
                try {
                  await _service.deleteMedia(item.id);
                  _loadMedia();
                } catch (e) {
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                }
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
