// lib/screens/PostDetailScreen.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:carousel_slider/carousel_slider.dart';
import '../services/MarketplaceService.dart';
import '../services/AuthService.dart';
import 'AddPostScreen.dart';

class PostDetailScreen extends StatefulWidget {
  final String postId;

  const PostDetailScreen({super.key, required this.postId});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final MarketplaceService _marketplaceService = MarketplaceService();
  final AuthService _authService = AuthService();
  final CarouselSliderController _carouselController = CarouselSliderController();

  Map<String, dynamic>? _post;
  bool _isLoading = true;
  int _currentImageIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadPost();
  }

  Future<void> _loadPost() async {
    if (!mounted) return;
    setState(() => _isLoading = true);

    try {
      final post = await _marketplaceService.getPostById(widget.postId);
      if (mounted) {
        setState(() {
          _post = post;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('Error loading post: $e')),
              ],
            ),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _deletePost() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Post'),
        content: const Text('Are you sure you want to delete this post? This action cannot be undone.'),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
      await _marketplaceService.deletePost(widget.postId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 12),
                Text('Post deleted successfully'),
              ],
            ),
            backgroundColor: Colors.green.shade600,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('Error deleting post: $e')),
              ],
            ),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _contactSeller() async {
    if (_post == null) return;

    final sellerEmail = _post!['seller_email'];
    final sellerPhone = _post!['seller_contact'];

    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Contact Seller',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              // Email Option
              if (sellerEmail != null && sellerEmail.isNotEmpty)
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.email, color: Colors.blue.shade700),
                  ),
                  title: const Text('Email', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(sellerEmail),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () async {
                    final uri = Uri.parse('mailto:$sellerEmail?subject=Interested in: ${_post!['title']}');
                    try {
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
                      } else {
                        throw 'Could not launch email';
                      }
                    } catch (e) {
                      if (mounted) {
                        await Clipboard.setData(ClipboardData(text: sellerEmail));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Email copied to clipboard')),
                        );
                      }
                    }
                  },
                ),

              const SizedBox(height: 12),

              // Phone Option
              if (sellerPhone != null && sellerPhone.isNotEmpty)
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.phone, color: Colors.green.shade700),
                  ),
                  title: const Text('Phone', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(sellerPhone),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () async {
                    final uri = Uri.parse('tel:$sellerPhone');
                    try {
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri);
                      } else {
                        throw 'Could not launch phone';
                      }
                    } catch (e) {
                      if (mounted) {
                        await Clipboard.setData(ClipboardData(text: sellerPhone));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Phone number copied to clipboard')),
                        );
                      }
                    }
                  },
                ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  bool get _isOwner {
    if (_post == null) return false;
    return _post!['user_id'] == _authService.currentUser?.id;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colorScheme.surface,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_post == null) {
      return Scaffold(
        backgroundColor: colorScheme.surface,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 80,
                color: colorScheme.outline,
              ),
              const SizedBox(height: 16),
              const Text('Post not found'),
            ],
          ),
        ),
      );
    }

    final images = List<String>.from(_post!['images'] ?? []);
    final listingType = _post!['listing_type'];
    final rateType = _post!['rate_type'];
    final price = _post!['price'];
    final sellerName = _post!['seller_name'] ?? 'Anonymous';
    final sellerEmail = _post!['seller_email'] ?? 'N/A';
    final sellerPhone = _post!['seller_contact'] ?? 'N/A';
    final createdAt = DateTime.parse(_post!['created_at']);

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Material 3 Carousel Image Gallery
                _Material3Carousel(
                  images: images,
                  currentIndex: _currentImageIndex,
                  controller: _carouselController,
                  onPageChanged: (index) {
                    setState(() => _currentImageIndex = index);
                  },
                ),

                // Content
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Listing Type Badge & Posted Date
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: listingType == 'rent'
                                    ? [Colors.blue.shade400, Colors.blue.shade600]
                                    : [Colors.green.shade400, Colors.green.shade600],
                              ),
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                  color: (listingType == 'rent' ? Colors.blue : Colors.green)
                                      .withOpacity(0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Text(
                              listingType == 'rent' ? 'FOR RENT' : 'FOR SALE',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: colorScheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.access_time,
                                  size: 14,
                                  color: colorScheme.onSurfaceVariant,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  DateFormat('d MMM yyyy').format(createdAt),
                                  style: TextStyle(
                                    color: colorScheme.onSurfaceVariant,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // Title
                      Text(
                        _post!['title'],
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Price Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              colorScheme.primaryContainer,
                              colorScheme.secondaryContainer,
                            ],
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: colorScheme.primary.withOpacity(0.1),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.currency_rupee,
                                  color: colorScheme.primary,
                                  size: 28,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Price',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              rateType == 'hourly'
                                  ? '${currencyFormat.format(price)}/hour'
                                  : rateType == 'daily'
                                  ? '${currencyFormat.format(price)}/day'
                                  : currencyFormat.format(price),
                              style: theme.textTheme.displaySmall?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Description
                      if (_post!['description'] != null &&
                          _post!['description'].toString().isNotEmpty) ...[
                        _buildInfoSection(
                          context,
                          icon: Icons.description_outlined,
                          title: 'Description',
                          child: Text(
                            _post!['description'],
                            style: theme.textTheme.bodyLarge?.copyWith(
                              height: 1.6,
                              color: colorScheme.onSurface,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Location
                      _buildInfoSection(
                        context,
                        icon: Icons.location_on,
                        title: 'Location',
                        child: Text(
                          _post!['location'],
                          style: theme.textTheme.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Seller Info
                      _buildInfoSection(
                        context,
                        icon: Icons.person_outline,
                        title: 'Seller Information',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 32,
                                  backgroundColor: colorScheme.primaryContainer,
                                  child: Text(
                                    sellerName.substring(0, 1).toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.bold,
                                      color: colorScheme.onPrimaryContainer,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        sellerName,
                                        style: theme.textTheme.titleLarge?.copyWith(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      if (sellerEmail != 'N/A')
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.email_outlined,
                                              size: 16,
                                              color: colorScheme.onSurfaceVariant,
                                            ),
                                            const SizedBox(width: 6),
                                            Expanded(
                                              child: Text(
                                                sellerEmail,
                                                style: TextStyle(
                                                  color: colorScheme.onSurfaceVariant,
                                                  fontSize: 14,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                      const SizedBox(height: 4),
                                      if (sellerPhone != 'N/A')
                                        Row(
                                          children: [
                                            Icon(
                                              Icons.phone_outlined,
                                              size: 16,
                                              color: colorScheme.onSurfaceVariant,
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              sellerPhone,
                                              style: TextStyle(
                                                color: colorScheme.onSurfaceVariant,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ],
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Floating Action Bar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Back Button
                    IconButton(
                      icon: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.5),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.arrow_back, color: Colors.white),
                      ),
                      onPressed: () => Navigator.pop(context),
                    ),

                    // Action Buttons
                    if (_isOwner)
                      Row(
                        children: [
                          IconButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => AddPostScreen(existingPost: _post),
                                ),
                              ).then((result) {
                                if (result == true) {
                                  _loadPost();
                                }
                              });
                            },
                            icon: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: colorScheme.primaryContainer,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(Icons.edit_rounded, color: colorScheme.onPrimaryContainer),
                            ),
                          ),
                          IconButton(
                            onPressed: _deletePost,
                            icon: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.red.withOpacity(0.9),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.delete_rounded, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: !_isOwner
          ? Container(
        decoration: BoxDecoration(
          color: colorScheme.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 20,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton.icon(
              onPressed: _contactSeller,
              icon: const Icon(Icons.contact_phone_rounded),
              label: const Text(
                'Contact Seller',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
            ),
          ),
        ),
      )
          : null,
    );
  }

  Widget _buildInfoSection(
      BuildContext context, {
        required IconData icon,
        required String title,
        required Widget child,
      }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: colorScheme.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

// Material 3 Expressive Carousel Widget with Enhanced Touch Support
class _Material3Carousel extends StatelessWidget {
  final List<String> images;
  final int currentIndex;
  final CarouselSliderController controller;
  final Function(int) onPageChanged;

  const _Material3Carousel({
    required this.images,
    required this.currentIndex,
    required this.controller,
    required this.onPageChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final size = MediaQuery.of(context).size;

    if (images.isEmpty) {
      return Container(
        height: 400,
        color: colorScheme.surfaceContainer,
        child: Center(
          child: Icon(
            Icons.agriculture,
            size: 100,
            color: colorScheme.outline,
          ),
        ),
      );
    }

    return Stack(
      children: [
        // Main Carousel with proper gesture handling
        GestureDetector(
          onHorizontalDragEnd: (details) {
            // Enable manual swipe detection
            if (details.primaryVelocity! > 0) {
              // Swiped right
              controller.previousPage(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            } else if (details.primaryVelocity! < 0) {
              // Swiped left
              controller.nextPage(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            }
          },
          child: CarouselSlider.builder(
            carouselController: controller,
            itemCount: images.length,
            itemBuilder: (context, index, realIndex) {
              return Container(
                width: size.width,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(0),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(0),
                  child: Image.network(
                    images[index],
                    fit: BoxFit.cover,
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Container(
                        color: colorScheme.surfaceContainer,
                        child: Center(
                          child: CircularProgressIndicator(
                            value: loadingProgress.expectedTotalBytes != null
                                ? loadingProgress.cumulativeBytesLoaded /
                                loadingProgress.expectedTotalBytes!
                                : null,
                          ),
                        ),
                      );
                    },
                    errorBuilder: (_, __, ___) => Container(
                      color: colorScheme.surfaceContainer,
                      child: Center(
                        child: Icon(
                          Icons.agriculture,
                          size: 100,
                          color: colorScheme.outline,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
            options: CarouselOptions(
              height: 400,
              viewportFraction: 1.0,
              enableInfiniteScroll: images.length > 1,
              autoPlay: false,
              enlargeCenterPage: false,
              scrollPhysics: images.length > 1
                  ? const BouncingScrollPhysics()
                  : const NeverScrollableScrollPhysics(),
              pageSnapping: true,
              onPageChanged: (index, reason) {
                onPageChanged(index);
              },
            ),
          ),
        ),

        // Gradient Overlay
        Positioned.fill(
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.4),
                    Colors.transparent,
                    Colors.transparent,
                    Colors.black.withOpacity(0.1),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Material 3 Page Indicators
        if (images.length > 1)
          Positioned(
            bottom: 20,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  images.length,
                      (index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOutCubic,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    width: currentIndex == index ? 40 : 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: currentIndex == index
                          ? Colors.white
                          : Colors.white.withOpacity(0.4),
                      borderRadius: BorderRadius.circular(5),
                      boxShadow: currentIndex == index
                          ? [
                        BoxShadow(
                          color: Colors.white.withOpacity(0.3),
                          blurRadius: 8,
                          spreadRadius: 2,
                        ),
                      ]
                          : null,
                    ),
                  ),
                ),
              ),
            ),
          ),

        // Image Counter Badge
        if (images.length > 1)
          Positioned(
            top: 20,
            right: 20,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: Colors.white.withOpacity(0.3),
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.image,
                      color: Colors.white,
                      size: 16,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${currentIndex + 1}/${images.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

        // Navigation Arrows (Optional - for better UX)
        if (images.length > 1) ...[
          // Left Arrow
          Positioned(
            left: 16,
            top: 0,
            bottom: 0,
            child: Center(
              child: AnimatedOpacity(
                opacity: currentIndex > 0 ? 0.8 : 0.3,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.chevron_left, color: Colors.white, size: 32),
                    onPressed: currentIndex > 0
                        ? () {
                      controller.previousPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    }
                        : null,
                  ),
                ),
              ),
            ),
          ),

          // Right Arrow
          Positioned(
            right: 16,
            top: 0,
            bottom: 0,
            child: Center(
              child: AnimatedOpacity(
                opacity: currentIndex < images.length - 1 ? 0.8 : 0.3,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.chevron_right, color: Colors.white, size: 32),
                    onPressed: currentIndex < images.length - 1
                        ? () {
                      controller.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    }
                        : null,
                  ),
                ),
              ),
            ),
          ),
        ],

        // Swipe Hint Animation (only on first image)
        if (images.length > 1 && currentIndex == 0)
          Positioned(
            left: 0,
            right: 0,
            bottom: 60,
            child: IgnorePointer(
              child: Center(
                child: TweenAnimationBuilder(
                  tween: Tween<double>(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 2000),
                  curve: Curves.easeInOut,
                  builder: (context, double value, child) {
                    return Opacity(
                      opacity: 1 - (value * 0.7),
                      child: Transform.translate(
                        offset: Offset(30 * (1 - value), 0),
                        child: child,
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.swipe_left,
                          color: Colors.white.withOpacity(0.9),
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Swipe to see more',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.9),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}