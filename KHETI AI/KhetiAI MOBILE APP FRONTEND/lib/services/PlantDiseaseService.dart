// lib/services/PlantDiseaseService.dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class PlantDiseaseService {
  static const String _baseUrl = 'https://plant-detector-ai.vishwajeetadkine705.workers.dev';

  /// Default prompt for plant disease analysis
  static const String _defaultPrompt = '''
Analyze this plant image and provide:
1. The type of plant
2. Any disease present (or "Healthy" if none)
3. Severity of the disease (Low/Medium/High or N/A if healthy)
4. Step-by-step treatment recommendations

Please be detailed and specific in your analysis.
''';

  /// Analyzes a plant image for diseases
  Future<Map<String, dynamic>> analyzeImage(File imageFile, {String? customPrompt}) async {
    try {
      // Read image file as bytes and convert to base64
      final bytes = await imageFile.readAsBytes();
      final base64Image = base64Encode(bytes);

      // Prepare the request body as per Cloudflare Worker API
      final requestBody = {
        'image_data': base64Image,  // Note: 'image_data' not 'image'
        'prompt': customPrompt ?? _defaultPrompt,
      };

      print('Sending request to: $_baseUrl');
      print('Image size: ${bytes.length} bytes');

      // Send POST request
      final response = await http.post(
        Uri.parse(_baseUrl),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode(requestBody),
      ).timeout(
        const Duration(seconds: 60), // Increased timeout for AI processing
        onTimeout: () {
          throw Exception('Request timeout. The AI is taking too long to respond.');
        },
      );

      print('Response Status: ${response.statusCode}');
      print('Response Body: ${response.body}');

      // Check response status
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        return data;
      } else {
        // Parse error response
        try {
          final errorData = jsonDecode(response.body);
          throw Exception(errorData['error'] ?? 'Failed to analyze image. Status: ${response.statusCode}');
        } catch (e) {
          throw Exception('Failed to analyze image. Status: ${response.statusCode}\nResponse: ${response.body}');
        }
      }
    } on SocketException {
      throw Exception('No internet connection. Please check your network.');
    } on FormatException catch (e) {
      throw Exception('Invalid response format from server: $e');
    } on http.ClientException catch (e) {
      throw Exception('Network error: $e');
    } catch (e) {
      if (e.toString().contains('Exception:')) {
        rethrow; // Re-throw our custom exceptions
      }
      throw Exception('Error analyzing image: $e');
    }
  }

  /// Helper method to validate image file
  bool isValidImage(File file) {
    final validExtensions = ['.jpg', '.jpeg', '.png'];
    final path = file.path.toLowerCase();
    return validExtensions.any((ext) => path.endsWith(ext));
  }

  /// Helper method to check file size (max 5MB for base64 encoding)
  Future<bool> isFileSizeValid(File file) async {
    final bytes = await file.length();
    const maxSize = 5 * 1024 * 1024; // 5MB
    return bytes <= maxSize;
  }
}
