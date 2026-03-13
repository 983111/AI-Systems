// lib/services/MarketplaceService.dart

import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'SupabaseConfig.dart';

class MarketplaceService {
  final SupabaseClient _supabase = SupabaseConfig.client;
  String? get _userId => _supabase.auth.currentUser?.id;

  // Upload image to Supabase Storage
  Future<String> uploadImage(File imageFile) async {
    if (_userId == null) throw Exception('User not logged in');

    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final fileName = '$_userId/${timestamp}_${imageFile.path.split('/').last}';

    await _supabase.storage.from('marketplace').upload(
      fileName,
      imageFile,
      fileOptions: const FileOptions(upsert: true),
    );

    return _supabase.storage.from('marketplace').getPublicUrl(fileName);
  }

  // Delete image from Supabase Storage
  Future<void> deleteImage(String imageUrl) async {
    try {
      final uri = Uri.parse(imageUrl);
      final path = uri.path.split('/marketplace/').last;
      await _supabase.storage.from('marketplace').remove([path]);
    } catch (e) {
      print('Error deleting image: $e');
    }
  }

  // Create a new marketplace post
  Future<void> createPost({
    required String title,
    required String listingType,
    required double price,
    String? rateType,
    String? description,
    required String location,
    double? latitude,
    double? longitude,
    required List<String> imageUrls,
    String? sellerName,
    String? sellerEmail,
    String? sellerContact,
  }) async {
    if (_userId == null) throw Exception('User not logged in');

    await _supabase.from('marketplace_posts').insert({
      'user_id': _userId,
      'title': title,
      'listing_type': listingType,
      'price': price,
      'rate_type': rateType,
      'description': description,
      'location': location,
      'latitude': latitude,
      'longitude': longitude,
      'images': imageUrls,
      'seller_name': sellerName,
      'seller_email': sellerEmail,
      'seller_contact': sellerContact,
      'status': 'active',
    });
  }

  // Update existing post
  Future<void> updatePost({
    required String postId,
    required String title,
    required String listingType,
    required double price,
    String? rateType,
    String? description,
    required String location,
    double? latitude,
    double? longitude,
    required List<String> imageUrls,
    String? sellerName,
    String? sellerEmail,
    String? sellerContact,
  }) async {
    if (_userId == null) throw Exception('User not logged in');

    await _supabase.from('marketplace_posts').update({
      'title': title,
      'listing_type': listingType,
      'price': price,
      'rate_type': rateType,
      'description': description,
      'location': location,
      'latitude': latitude,
      'longitude': longitude,
      'images': imageUrls,
      'seller_name': sellerName,
      'seller_email': sellerEmail,
      'seller_contact': sellerContact,
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', postId).eq('user_id', _userId!);
  }

  // Delete post
  Future<void> deletePost(String postId) async {
    if (_userId == null) throw Exception('User not logged in');

    // Get post to delete images
    final post = await _supabase
        .from('marketplace_posts')
        .select()
        .eq('id', postId)
        .eq('user_id', _userId!)
        .single();

    // Delete images from storage
    if (post['images'] != null) {
      for (String imageUrl in List<String>.from(post['images'])) {
        await deleteImage(imageUrl);
      }
    }

    // Delete post
    await _supabase
        .from('marketplace_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', _userId!);
  }

  // Helper to get user data from users table
  Future<Map<String, dynamic>> _getUserData(String userId) async {
    try {
      // Fetch from users table
      final userData = await _supabase
          .from('users')
          .select('id, email, full_name, phone, avatar_url')
          .eq('id', userId)
          .maybeSingle();

      if (userData != null) {
        return {
          'id': userData['id'],
          'email': userData['email'] ?? 'N/A',
          'full_name': userData['full_name'] ?? userData['email']?.split('@')[0] ?? 'Anonymous',
          'phone': userData['phone'],
          'avatar_url': userData['avatar_url'],
        };
      }

      // If not in users table, get from auth
      final authUser = _supabase.auth.currentUser;
      if (authUser != null && authUser.id == userId) {
        return {
          'id': userId,
          'email': authUser.email ?? 'N/A',
          'full_name': authUser.userMetadata?['full_name'] ?? authUser.email?.split('@')[0] ?? 'Anonymous',
          'phone': null,
          'avatar_url': null,
        };
      }

      // Last fallback
      return {
        'id': userId,
        'email': 'N/A',
        'full_name': 'Anonymous User',
        'phone': null,
        'avatar_url': null,
      };
    } catch (e) {
      print('Error fetching user data: $e');
      return {
        'id': userId,
        'email': 'N/A',
        'full_name': 'Anonymous User',
        'phone': null,
        'avatar_url': null,
      };
    }
  }

  // Get posts with filters
  Future<List<Map<String, dynamic>>> getPosts({
    String? listingType,
    double? minPrice,
    double? maxPrice,
    String? location,
    String? searchQuery,
  }) async {
    try {
      var queryBuilder = _supabase
          .from('marketplace_posts')
          .select()
          .eq('status', 'active');

      // Apply filters
      if (listingType != null) {
        queryBuilder = queryBuilder.eq('listing_type', listingType);
      }

      if (minPrice != null) {
        queryBuilder = queryBuilder.gte('price', minPrice);
      }

      if (maxPrice != null) {
        queryBuilder = queryBuilder.lte('price', maxPrice);
      }

      if (location != null && location.isNotEmpty) {
        queryBuilder = queryBuilder.ilike('location', '%$location%');
      }

      if (searchQuery != null && searchQuery.isNotEmpty) {
        queryBuilder = queryBuilder.or('title.ilike.%$searchQuery%,description.ilike.%$searchQuery%');
      }

      final posts = await queryBuilder.order('created_at', ascending: false);

      // Manually fetch and attach user data for each post
      List<Map<String, dynamic>> enrichedPosts = [];

      for (var post in posts) {
        final userId = post['user_id'];
        final userData = await _getUserData(userId);

        final enrichedPost = Map<String, dynamic>.from(post);
        enrichedPost['users'] = userData;
        enrichedPosts.add(enrichedPost);
      }

      return enrichedPosts;
    } catch (e) {
      print('Error fetching posts: $e');
      rethrow;
    }
  }

  // Get user's own posts
  Future<List<Map<String, dynamic>>> getMyPosts() async {
    if (_userId == null) return [];

    final response = await _supabase
        .from('marketplace_posts')
        .select()
        .eq('user_id', _userId!)
        .order('created_at', ascending: false);

    return List<Map<String, dynamic>>.from(response);
  }

  // Get post by ID
  Future<Map<String, dynamic>> getPostById(String postId) async {
    try {
      final post = await _supabase
          .from('marketplace_posts')
          .select()
          .eq('id', postId)
          .single();

      final userId = post['user_id'];
      final userData = await _getUserData(userId);

      final enrichedPost = Map<String, dynamic>.from(post);
      enrichedPost['users'] = userData;

      return enrichedPost;
    } catch (e) {
      print('Error fetching post by ID: $e');
      rethrow;
    }
  }

  // Mark post as sold/inactive
  Future<void> updatePostStatus(String postId, String status) async {
    if (_userId == null) throw Exception('User not logged in');

    await _supabase
        .from('marketplace_posts')
        .update({'status': status, 'updated_at': DateTime.now().toIso8601String()})
        .eq('id', postId)
        .eq('user_id', _userId!);
  }
}