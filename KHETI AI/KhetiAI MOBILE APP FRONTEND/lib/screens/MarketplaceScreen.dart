// lib/screens/MarketplaceScreen.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/MarketplaceService.dart';
import 'AddPostScreen.dart';
import 'PostDetailScreen.dart';
import 'MyPostsScreen.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key});

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  final MarketplaceService _marketplaceService = MarketplaceService();
  List<Map<String, dynamic>> _posts = [];
  bool _isLoading = false;
  bool _isInitialLoad = true;

  // Filters
  String? _selectedType;
  double? _minPrice;
  double? _maxPrice;
  String? _locationFilter;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPosts(showLoading: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadPosts({bool showLoading = false}) async {
    if (!mounted) return;

    if (showLoading) {
      setState(() => _isLoading = true);
    }

    try {
      final posts = await _marketplaceService.getPosts(
        listingType: _selectedType,
        minPrice: _minPrice,
        maxPrice: _maxPrice,
        location: _locationFilter,
        searchQuery: _searchController.text.trim().isEmpty ? null : _searchController.text.trim(),
      );

      if (mounted) {
        setState(() {
          _posts = posts;
          _isLoading = false;
          _isInitialLoad = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isInitialLoad = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('Error loading posts: $e')),
              ],
            ),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _FilterSheet(
        selectedType: _selectedType,
        minPrice: _minPrice,
        maxPrice: _maxPrice,
        locationFilter: _locationFilter,
        onApply: (type, min, max, location) {
          setState(() {
            _selectedType = type;
            _minPrice = min;
            _maxPrice = max;
            _locationFilter = location;
          });
          _loadPosts(showLoading: true);
        },
        onClear: () {
          setState(() {
            _selectedType = null;
            _minPrice = null;
            _maxPrice = null;
            _locationFilter = null;
          });
          _loadPosts(showLoading: true);
        },
      ),
    );
  }

  bool get _hasActiveFilters => _selectedType != null || _minPrice != null || _maxPrice != null || _locationFilter != null;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: CustomScrollView(
        slivers: [
          // App Bar
          SliverAppBar(
            floating: true,
            pinned: true,
            expandedHeight: 140,
            backgroundColor: colorScheme.surface,
            elevation: 0,
            surfaceTintColor: colorScheme.surface,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      colorScheme.primaryContainer.withOpacity(0.3),
                      colorScheme.surface,
                    ],
                  ),
                ),
              ),
              title: Text(
                'Marketplace',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
            ),
            actions: [
              IconButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const MyPostsScreen()),
                  ).then((result) {
                    if (result == true) {
                      _loadPosts(showLoading: false);
                    }
                  });
                },
                icon: const Icon(Icons.inventory_2_outlined),
                tooltip: 'My Posts',
                style: IconButton.styleFrom(
                  backgroundColor: colorScheme.primaryContainer,
                  foregroundColor: colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _isLoading ? null : () => _loadPosts(showLoading: true),
                icon: _isLoading
                    ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colorScheme.onSurface,
                  ),
                )
                    : const Icon(Icons.refresh_rounded),
                tooltip: 'Refresh',
                style: IconButton.styleFrom(
                  foregroundColor: colorScheme.onSurface,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _showFilterSheet,
                icon: Badge(
                  isLabelVisible: _hasActiveFilters,
                  child: const Icon(Icons.tune_rounded),
                ),
                tooltip: 'Filter',
                style: IconButton.styleFrom(
                  foregroundColor: colorScheme.onSurface,
                ),
              ),
              const SizedBox(width: 16),
            ],
          ),

          // Search Bar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Container(
                decoration: BoxDecoration(
                  color: colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: colorScheme.shadow.withOpacity(0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search machinery, equipment...',
                    hintStyle: TextStyle(color: colorScheme.onSurfaceVariant),
                    prefixIcon: Icon(Icons.search_rounded, color: colorScheme.onSurfaceVariant),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                      icon: const Icon(Icons.clear_rounded),
                      onPressed: () {
                        _searchController.clear();
                        _loadPosts(showLoading: false);
                        setState(() {});
                      },
                    )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  ),
                  onSubmitted: (_) => _loadPosts(showLoading: false),
                  onChanged: (value) => setState(() {}),
                ),
              ),
            ),
          ),

          // Active Filters Chips
          if (_hasActiveFilters)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (_selectedType != null)
                      Chip(
                        label: Text(_selectedType == 'rent' ? 'For Rent' : 'For Sale'),
                        deleteIcon: const Icon(Icons.close, size: 18),
                        onDeleted: () {
                          setState(() => _selectedType = null);
                          _loadPosts(showLoading: false);
                        },
                        backgroundColor: colorScheme.secondaryContainer,
                        labelStyle: TextStyle(color: colorScheme.onSecondaryContainer),
                      ),
                    if (_minPrice != null || _maxPrice != null)
                      Chip(
                        label: Text(
                          _minPrice != null && _maxPrice != null
                              ? '₹${_minPrice!.toInt()} - ₹${_maxPrice!.toInt()}'
                              : _minPrice != null
                              ? 'Min: ₹${_minPrice!.toInt()}'
                              : 'Max: ₹${_maxPrice!.toInt()}',
                        ),
                        deleteIcon: const Icon(Icons.close, size: 18),
                        onDeleted: () {
                          setState(() {
                            _minPrice = null;
                            _maxPrice = null;
                          });
                          _loadPosts(showLoading: false);
                        },
                        backgroundColor: colorScheme.tertiaryContainer,
                        labelStyle: TextStyle(color: colorScheme.onTertiaryContainer),
                      ),
                    if (_locationFilter != null)
                      Chip(
                        label: Text(_locationFilter!),
                        deleteIcon: const Icon(Icons.close, size: 18),
                        onDeleted: () {
                          setState(() => _locationFilter = null);
                          _loadPosts(showLoading: false);
                        },
                        backgroundColor: colorScheme.primaryContainer,
                        labelStyle: TextStyle(color: colorScheme.onPrimaryContainer),
                      ),
                  ],
                ),
              ),
            ),

          // Posts Grid
          if (_isInitialLoad && _isLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_posts.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: colorScheme.surfaceContainerHighest,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.inventory_2_outlined,
                        size: 64,
                        color: colorScheme.outline,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'No items found',
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: colorScheme.onSurface,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _hasActiveFilters
                          ? 'Try adjusting your filters'
                          : 'Be the first to post an item',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.68,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                ),
                delegate: SliverChildBuilderDelegate(
                      (context, index) {
                    final post = _posts[index];
                    final images = List<String>.from(post['images'] ?? []);
                    final isRent = post['listing_type'] == 'rent';

                    return Card(
                      elevation: 0,
                      color: colorScheme.surfaceContainerHighest,
                      clipBehavior: Clip.antiAlias,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(
                          color: colorScheme.outlineVariant.withOpacity(0.3),
                        ),
                      ),
                      child: InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => PostDetailScreen(postId: post['id']),
                            ),
                          ).then((result) {
                            if (result == true) {
                              _loadPosts(showLoading: false);
                            }
                          });
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Image with PageView for swiping
                            Expanded(
                              flex: 5,
                              child: _ImageCarousel(
                                images: images,
                                isRent: isRent,
                                colorScheme: colorScheme,
                              ),
                            ),
                            // Content
                            Expanded(
                              flex: 4,
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Title
                                    Text(
                                      post['title'],
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        height: 1.3,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
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
                                    const Spacer(),
                                    // Location
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.location_on,
                                          size: 14,
                                          color: colorScheme.onSurfaceVariant,
                                        ),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            post['location'] ?? 'N/A',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: colorScheme.onSurfaceVariant,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                  childCount: _posts.length,
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AddPostScreen()),
          ).then((result) {
            if (result == true) {
              _loadPosts(showLoading: false);
            }
          });
        },
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'Add Post',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 4,
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
      ),
    );
  }
}

// Image Carousel Widget for Cards
class _ImageCarousel extends StatefulWidget {
  final List<String> images;
  final bool isRent;
  final ColorScheme colorScheme;

  const _ImageCarousel({
    required this.images,
    required this.isRent,
    required this.colorScheme,
  });

  @override
  State<_ImageCarousel> createState() => _ImageCarouselState();
}

class _ImageCarouselState extends State<_ImageCarousel> {
  int _currentIndex = 0;
  final PageController _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.images.isEmpty) {
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: widget.colorScheme.surfaceContainer,
        ),
        child: Icon(
          Icons.agriculture,
          size: 48,
          color: widget.colorScheme.outline,
        ),
      );
    }

    return Stack(
      children: [
        PageView.builder(
          controller: _pageController,
          itemCount: widget.images.length,
          onPageChanged: (index) {
            setState(() => _currentIndex = index);
          },
          itemBuilder: (context, index) {
            return Image.network(
              widget.images[index],
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: widget.colorScheme.surfaceContainer,
                child: Icon(
                  Icons.agriculture,
                  size: 48,
                  color: widget.colorScheme.outline,
                ),
              ),
            );
          },
        ),
        // Type Badge
        Positioned(
          top: 8,
          right: 8,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: widget.isRent
                  ? Colors.blue.shade600
                  : Colors.green.shade600,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              widget.isRent ? 'RENT' : 'SALE',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
        // Image Indicators
        if (widget.images.length > 1)
          Positioned(
            bottom: 8,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                widget.images.length,
                    (index) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: _currentIndex == index ? 20 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _currentIndex == index
                        ? Colors.white
                        : Colors.white.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(3),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 2,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// Filter Sheet Widget
class _FilterSheet extends StatefulWidget {
  final String? selectedType;
  final double? minPrice;
  final double? maxPrice;
  final String? locationFilter;
  final Function(String?, double?, double?, String?) onApply;
  final VoidCallback onClear;

  const _FilterSheet({
    required this.selectedType,
    required this.minPrice,
    required this.maxPrice,
    required this.locationFilter,
    required this.onApply,
    required this.onClear,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  String? _type;
  final _minPriceController = TextEditingController();
  final _maxPriceController = TextEditingController();
  final _locationController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _type = widget.selectedType;
    _minPriceController.text = widget.minPrice?.toString() ?? '';
    _maxPriceController.text = widget.maxPrice?.toString() ?? '';
    _locationController.text = widget.locationFilter ?? '';
  }

  @override
  void dispose() {
    _minPriceController.dispose();
    _maxPriceController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          top: 24,
          left: 24,
          right: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Filters',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton.icon(
                  onPressed: () {
                    widget.onClear();
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.clear_all_rounded, size: 20),
                  label: const Text('Clear All'),
                  style: TextButton.styleFrom(
                    foregroundColor: colorScheme.error,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Listing Type
            Text(
              'Listing Type',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilterChip(
                    label: const Text('For Sale'),
                    selected: _type == 'sell',
                    onSelected: (selected) {
                      setState(() => _type = selected ? 'sell' : null);
                    },
                    selectedColor: Colors.green.shade100,
                    checkmarkColor: Colors.green.shade700,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _type == 'sell' ? Colors.green.shade700 : null,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilterChip(
                    label: const Text('For Rent'),
                    selected: _type == 'rent',
                    onSelected: (selected) {
                      setState(() => _type = selected ? 'rent' : null);
                    },
                    selectedColor: Colors.blue.shade100,
                    checkmarkColor: Colors.blue.shade700,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _type == 'rent' ? Colors.blue.shade700 : null,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Price Range
            Text(
              'Price Range',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _minPriceController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Min Price',
                      prefixIcon: const Icon(Icons.currency_rupee, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      filled: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _maxPriceController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Max Price',
                      prefixIcon: const Icon(Icons.currency_rupee, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      filled: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Location
            Text(
              'Location',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _locationController,
              decoration: InputDecoration(
                labelText: 'City or Area',
                hintText: 'e.g., Surat, Ahmedabad',
                prefixIcon: const Icon(Icons.location_on),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
            ),
            const SizedBox(height: 32),

            // Apply Button
            FilledButton.icon(
              onPressed: () {
                final minPrice = _minPriceController.text.isEmpty
                    ? null
                    : double.tryParse(_minPriceController.text);
                final maxPrice = _maxPriceController.text.isEmpty
                    ? null
                    : double.tryParse(_maxPriceController.text);
                final location = _locationController.text.isEmpty
                    ? null
                    : _locationController.text;

                widget.onApply(_type, minPrice, maxPrice, location);
                Navigator.pop(context);
              },
              icon: const Icon(Icons.check_rounded),
              label: const Text(
                'Apply Filters',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}