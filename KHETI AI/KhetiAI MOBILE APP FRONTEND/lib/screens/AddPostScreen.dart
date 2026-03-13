// lib/screens/AddPostScreen.dart

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/MarketplaceService.dart';

class AddPostScreen extends StatefulWidget {
  final Map<String, dynamic>? existingPost;

  const AddPostScreen({super.key, this.existingPost});

  @override
  State<AddPostScreen> createState() => _AddPostScreenState();
}

class _AddPostScreenState extends State<AddPostScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _priceController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();
  final _contactController = TextEditingController();
  final _sellerNameController = TextEditingController();
  final _sellerEmailController = TextEditingController();
  final MarketplaceService _marketplaceService = MarketplaceService();
  final ImagePicker _picker = ImagePicker();

  String _listingType = 'sell';
  String _rateType = 'fixed';
  List<File> _selectedImages = [];
  List<String> _existingImageUrls = [];
  bool _isSaving = false;
  bool _isEditMode = false;
  double? _latitude;
  double? _longitude;

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.existingPost != null;
    _loadSavedLocation();

    if (_isEditMode) {
      _loadExistingPost();
    }
  }

  void _loadExistingPost() {
    final post = widget.existingPost!;
    _titleController.text = post['title'];
    _listingType = post['listing_type'];
    _rateType = post['rate_type'] ?? 'fixed';
    _priceController.text = post['price'].toString();
    _locationController.text = post['location'] ?? '';
    _latitude = post['latitude'];
    _longitude = post['longitude'];
    _existingImageUrls = List<String>.from(post['images'] ?? []);
    _descriptionController.text = post['description'] ?? '';

    // Load seller information
    _sellerNameController.text = post['seller_name'] ?? '';
    _sellerEmailController.text = post['seller_email'] ?? '';
    _contactController.text = post['seller_contact'] ?? '';
  }

  Future<void> _loadSavedLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.containsKey('city')) {
        setState(() {
          _locationController.text = prefs.getString('city') ?? '';
          _latitude = prefs.getDouble('latitude');
          _longitude = prefs.getDouble('longitude');
        });
      }
    } catch (e) {
      debugPrint('Error loading location: $e');
    }
  }

  Future<void> _pickImages() async {
    try {
      final pickedFiles = await _picker.pickMultiImage();
      if (pickedFiles.isNotEmpty) {
        setState(() {
          _selectedImages.addAll(
            pickedFiles.map((xFile) => File(xFile.path)).toList(),
          );
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error picking images: $e')),
        );
      }
    }
  }

  Future<void> _takePicture() async {
    try {
      final pickedFile = await _picker.pickImage(source: ImageSource.camera);
      if (pickedFile != null) {
        setState(() {
          _selectedImages.add(File(pickedFile.path));
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error taking picture: $e')),
        );
      }
    }
  }

  void _removeImage(int index) {
    setState(() {
      _selectedImages.removeAt(index);
    });
  }

  void _removeExistingImage(int index) {
    setState(() {
      _existingImageUrls.removeAt(index);
    });
  }

  Future<void> _savePost() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedImages.isEmpty && _existingImageUrls.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one image')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      // Upload new images
      List<String> uploadedUrls = [];
      for (var imageFile in _selectedImages) {
        final url = await _marketplaceService.uploadImage(imageFile);
        uploadedUrls.add(url);
      }

      // Combine with existing URLs
      final allImageUrls = [..._existingImageUrls, ...uploadedUrls];

      if (_isEditMode) {
        await _marketplaceService.updatePost(
          postId: widget.existingPost!['id'],
          title: _titleController.text.trim(),
          listingType: _listingType,
          price: double.parse(_priceController.text),
          rateType: _listingType == 'rent' ? _rateType : null,
          description: _descriptionController.text.trim(),
          location: _locationController.text.trim(),
          latitude: _latitude,
          longitude: _longitude,
          imageUrls: allImageUrls,
          sellerName: _sellerNameController.text.trim(),
          sellerEmail: _sellerEmailController.text.trim(),
          sellerContact: _contactController.text.trim(),
        );
      } else {
        await _marketplaceService.createPost(
          title: _titleController.text.trim(),
          listingType: _listingType,
          price: double.parse(_priceController.text),
          rateType: _listingType == 'rent' ? _rateType : null,
          description: _descriptionController.text.trim(),
          location: _locationController.text.trim(),
          latitude: _latitude,
          longitude: _longitude,
          imageUrls: allImageUrls,
          sellerName: _sellerNameController.text.trim(),
          sellerEmail: _sellerEmailController.text.trim(),
          sellerContact: _contactController.text.trim(),
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                Text(_isEditMode ? 'Post updated!' : 'Post created!'),
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
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _priceController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    _contactController.dispose();
    _sellerNameController.dispose();
    _sellerEmailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditMode ? 'Edit Post' : 'Add Post'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            // Title Field
            TextFormField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: 'Title *',
                hintText: 'e.g., Tractor, Harvester, Plow',
                prefixIcon: const Icon(Icons.title),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
              validator: (v) => v == null || v.isEmpty ? 'Enter title' : null,
            ),
            const SizedBox(height: 20),

            // Listing Type
            Text(
              'Listing Type *',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Sell'),
                    selected: _listingType == 'sell',
                    onSelected: (selected) {
                      setState(() {
                        _listingType = 'sell';
                        _rateType = 'fixed';
                      });
                    },
                    selectedColor: Colors.green.shade100,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: _listingType == 'sell'
                          ? Colors.green.shade700
                          : null,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Rent'),
                    selected: _listingType == 'rent',
                    onSelected: (selected) {
                      setState(() {
                        _listingType = 'rent';
                        _rateType = 'hourly';
                      });
                    },
                    selectedColor: Colors.blue.shade100,
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: _listingType == 'rent'
                          ? Colors.blue.shade700
                          : null,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Rate Type (Only for Rent)
            if (_listingType == 'rent') ...[
              Text(
                'Rate Type *',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Text('Hourly Rate'),
                      selected: _rateType == 'hourly',
                      onSelected: (selected) {
                        setState(() => _rateType = 'hourly');
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ChoiceChip(
                      label: const Text('Daily Rate'),
                      selected: _rateType == 'daily',
                      onSelected: (selected) {
                        setState(() => _rateType = 'daily');
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
            ],

            // Price Field
            TextFormField(
              controller: _priceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
              ],
              decoration: InputDecoration(
                labelText: _listingType == 'rent'
                    ? 'Price per ${_rateType == 'hourly' ? 'Hour' : 'Day'} *'
                    : 'Price *',
                hintText: '0.00',
                prefixIcon: const Icon(Icons.currency_rupee),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Enter price';
                final price = double.tryParse(v);
                if (price == null || price <= 0) return 'Enter valid price';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Description Field
            TextFormField(
              controller: _descriptionController,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Description',
                hintText: 'Describe your item...',
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(bottom: 60),
                  child: Icon(Icons.description_outlined),
                ),
                alignLabelWithHint: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
            ),
            const SizedBox(height: 20),

            // Seller Name Field
            TextFormField(
              controller: _sellerNameController,
              decoration: InputDecoration(
                labelText: 'Seller Name *',
                hintText: 'Your name',
                prefixIcon: const Icon(Icons.person_outline),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
              validator: (v) => v == null || v.isEmpty ? 'Enter seller name' : null,
            ),
            const SizedBox(height: 20),

            // Seller Email Field
            TextFormField(
              controller: _sellerEmailController,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Seller Email *',
                hintText: 'your@email.com',
                prefixIcon: const Icon(Icons.email_outlined),
                helperText: 'Buyers will contact you via this email',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Enter email';
                if (!v.contains('@')) return 'Enter valid email';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Contact Number Field
            TextFormField(
              controller: _contactController,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              decoration: InputDecoration(
                labelText: 'Contact Number *',
                hintText: 'e.g., 9876543210',
                prefixIcon: const Icon(Icons.phone),
                helperText: 'Your contact number for buyers',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Enter contact number';
                if (v.length < 10) return 'Enter valid 10-digit number';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Location Field
            TextFormField(
              controller: _locationController,
              decoration: InputDecoration(
                labelText: 'Location *',
                hintText: 'Your city/area',
                prefixIcon: const Icon(Icons.location_on),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
              ),
              validator: (v) => v == null || v.isEmpty ? 'Enter location' : null,
            ),
            const SizedBox(height: 24),

            // Images Section
            Text(
              'Images *',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            // Existing Images
            if (_existingImageUrls.isNotEmpty) ...[
              SizedBox(
                height: 120,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _existingImageUrls.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              _existingImageUrls[index],
                              width: 120,
                              height: 120,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 120,
                                height: 120,
                                color: colorScheme.surfaceContainer,
                                child: const Icon(Icons.error),
                              ),
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: IconButton(
                              icon: const Icon(Icons.close, color: Colors.white),
                              onPressed: () => _removeExistingImage(index),
                              style: IconButton.styleFrom(
                                backgroundColor: Colors.black54,
                                padding: const EdgeInsets.all(4),
                                minimumSize: const Size(28, 28),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Selected New Images
            if (_selectedImages.isNotEmpty) ...[
              SizedBox(
                height: 120,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _selectedImages.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.file(
                              _selectedImages[index],
                              width: 120,
                              height: 120,
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: IconButton(
                              icon: const Icon(Icons.close, color: Colors.white),
                              onPressed: () => _removeImage(index),
                              style: IconButton.styleFrom(
                                backgroundColor: Colors.black54,
                                padding: const EdgeInsets.all(4),
                                minimumSize: const Size(28, 28),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Add Image Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickImages,
                    icon: const Icon(Icons.photo_library),
                    label: const Text('Gallery'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _takePicture,
                    icon: const Icon(Icons.camera_alt),
                    label: const Text('Camera'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // Submit Button
            FilledButton(
              onPressed: _isSaving ? null : _savePost,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _isSaving
                  ? const SizedBox(
                height: 24,
                width: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Colors.white,
                ),
              )
                  : Text(
                _isEditMode ? 'Update Post' : 'Create Post',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}