import 'package:flutter/material.dart';
import '../models/post_model.dart';
import '../services/posts_service.dart';

class PostsProvider extends ChangeNotifier {
  final PostsService _postsService = PostsService();

  List<PostDto> _posts = [];
  bool _isLoading = false;
  String? _errorMessage;
  String? _statusFilter;
  String _searchQuery = '';

  List<PostDto> get posts {
    return _posts.where((p) {
      final matchesStatus = _statusFilter == null || _statusFilter!.isEmpty || _statusFilter == 'ALL'
          ? true
          : p.status.toUpperCase() == _statusFilter!.toUpperCase();
      final matchesSearch = _searchQuery.isEmpty
          ? true
          : p.text.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              p.targets.any((t) => t.channelName.toLowerCase().contains(_searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    }).toList();
  }

  List<PostDto> get allPosts => _posts;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get statusFilter => _statusFilter;
  String get searchQuery => _searchQuery;

  void setStatusFilter(String? status) {
    _statusFilter = status;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  Future<void> fetchPosts({String? status, String? from, String? to}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _posts = await _postsService.getPosts(
        status: status,
        from: from,
        to: to,
        limit: 100,
      );
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<PostDto> createPost({
    required String text,
    String? firstComment,
    String? scheduledAt,
    List<String>? mediaIds,
    required List<Map<String, dynamic>> targets,
  }) async {
    final newPost = await _postsService.createPost(
      text: text,
      firstComment: firstComment,
      scheduledAt: scheduledAt,
      mediaIds: mediaIds,
      targets: targets,
    );
    _posts.insert(0, newPost);
    notifyListeners();
    return newPost;
  }

  Future<PostDto> updatePost({
    required String id,
    required String text,
    String? firstComment,
    String? scheduledAt,
    List<String>? mediaIds,
    required List<Map<String, dynamic>> targets,
  }) async {
    final updated = await _postsService.updatePost(
      id: id,
      text: text,
      firstComment: firstComment,
      scheduledAt: scheduledAt,
      mediaIds: mediaIds,
      targets: targets,
    );
    final idx = _posts.indexWhere((p) => p.id == id);
    if (idx != -1) {
      _posts[idx] = updated;
      notifyListeners();
    }
    return updated;
  }

  Future<void> deletePost(String id) async {
    await _postsService.deletePost(id);
    _posts.removeWhere((p) => p.id == id);
    notifyListeners();
  }

  Future<PostDto> publishNow(String id) async {
    final updated = await _postsService.publishNow(id);
    final idx = _posts.indexWhere((p) => p.id == id);
    if (idx != -1) {
      _posts[idx] = updated;
    } else {
      _posts.insert(0, updated);
    }
    notifyListeners();
    return updated;
  }

  Future<PostDto> schedulePost(String id, String scheduledAt) async {
    final updated = await _postsService.schedulePost(id, scheduledAt);
    final idx = _posts.indexWhere((p) => p.id == id);
    if (idx != -1) {
      _posts[idx] = updated;
      notifyListeners();
    }
    return updated;
  }

  Future<PostDto> cancelPost(String id) async {
    final updated = await _postsService.cancelPost(id);
    final idx = _posts.indexWhere((p) => p.id == id);
    if (idx != -1) {
      _posts[idx] = updated;
      notifyListeners();
    }
    return updated;
  }

  Future<PostDto> retryPost(String id) async {
    final updated = await _postsService.retryPost(id);
    final idx = _posts.indexWhere((p) => p.id == id);
    if (idx != -1) {
      _posts[idx] = updated;
      notifyListeners();
    }
    return updated;
  }
}
