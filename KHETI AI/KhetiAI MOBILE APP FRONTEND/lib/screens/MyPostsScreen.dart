// lib/screens/MyPostsScreen.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/MarketplaceService.dart';
import 'AddPostScreen.dart';
import 'PostDetailScreen.dart';

class MyPostsScreen extends StatefulWidget {
  const MyPostsScreen({super.key});

  @override
  State<MyPostsScreen> createState() => _MyPostsScreenState();
}

class _MyPostsScreenState extends State<MyPostsScreen> {
  final MarketplaceService _marketplaceService = MarketplaceService();
  List<Map<String, dynamic>> _myPosts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadMyPosts();
  }

  Future<void> _loadMyPosts() async {
    if (!mounted) return;
    setState(() => _isLoading = true);

    try {
      final posts = await _marketplaceService.getMyPosts();
      if (mounted) {
        setState(() {
          _myPosts = posts;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading posts: $e')),
        );
      }
    }
  }

  Future<void> _deletePost(String postId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Post'),
        content: const Text('Are you sure you want to delete this post? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await _marketplaceService.deletePost(postId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 12),
                Text('Post deleted successfully'),
              ],
            ),
            backgroundColor: Colors.green,
          ),
        );
        _loadMyPosts();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error deleting post: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App Bar
          SliverAppBar(
            floating: true,
            pinned: true,
            expandedHeight: 60,
            backgroundColor: colorScheme.surface,
            elevation: 0,
            surfaceTintColor: colorScheme.surface,
            title: Text(
              'My Posts',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            actions: [
              IconButton(
                onPressed: _loadMyPosts,
                icon: const Icon(Icons.refresh_rounded),
              ),
              const SizedBox(width: 8),
            ],
          ),

          // Content
          _isLoading
              ? const SliverFillRemaining(
            child: Center(child: CircularProgressIndicator()),
          )
              : _myPosts.isEmpty
              ? SliverFillRemaining(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.inventory_2_outlined,
                    size: 80,
                    color: colorScheme.outline,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No posts yet',
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Create your first post to get started',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AddPostScreen()),
                      ).then((_) => _loadMyPosts());
                    },
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Create Post'),
                  ),
                ],
              ),
            ),
          )
              : SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                    (context, index) {
                  final post = _myPosts[index];
                  final images = List<String>.from(post['images'] ?? []);
                  final imageUrl = images.isNotEmpty ? images[0] : null;
                  final createdAt = DateTime.parse(post['created_at']);

                  return Card(
                    elevation: 0,
                    color: colorScheme.surfaceContainerHighest,
                    margin: const EdgeInsets.only(bottom: 12),
                    clipBehavior: Clip.antiAlias,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PostDetailScreen(postId: post['id']),
                          ),
                        ).then((_) => _loadMyPosts());
                      },
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Image
                          Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              color: colorScheme.surfaceContainer,
                            ),
                            child: imageUrl != null
                                ? Image.network(
                              imageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Icon(
                                Icons.agriculture,
                                size: 40,
                                color: colorScheme.outline,
                              ),
                            )
                                : Icon(
                              Icons.agriculture,
                              size: 40,
                              color: colorScheme.outline,
                            ),
                          ),
                          // Content
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Type Badge
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: post['listing_type'] == 'rent'
                                          ? Colors.blue.withOpacity(0.15)
                                          : Colors.green.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      post['listing_type'] == 'rent' ? 'RENT' : 'SALE',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: post['listing_type'] == 'rent'
                                            ? Colors.blue.shade700
                                            : Colors.green.shade700,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  // Title
                                  Text(
                                    post['title'],
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  // Price
                                  Text(
                                    post['rate_type'] == 'hourly'
                                        ? '${currencyFormat.format(post['price'])}/hr'
                                        : post['rate_type'] == 'daily'
                                        ? '${currencyFormat.format(post['price'])}/day'
                                        : currencyFormat.format(post['price']),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: colorScheme.primary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  // Date
                                  Text(
                                    'Posted ${DateFormat('d MMM, yyyy').format(createdAt)}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Action Buttons
                          Column(
                            children: [
                              IconButton(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => AddPostScreen(existingPost: post),
                                    ),
                                  ).then((_) => _loadMyPosts());
                                },
                                icon: const Icon(Icons.edit_rounded),
                                color: colorScheme.primary,
                                style: IconButton.styleFrom(
                                  backgroundColor: colorScheme.primaryContainer,
                                ),
                              ),
                              IconButton(
                                onPressed: () => _deletePost(post['id']),
                                icon: const Icon(Icons.delete_rounded),
                                color: Colors.red,
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.red.withOpacity(0.1),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
                childCount: _myPosts.length,
              ),
            ),
          ),
        ],
      ),
    );
  }
}