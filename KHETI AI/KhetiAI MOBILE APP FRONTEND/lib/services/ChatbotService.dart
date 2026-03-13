// lib/services/ChatbotService.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class ChatbotService {
  static const String apiUrl = 'https://agriculture-chatbot.vishwajeetadkine705.workers.dev';

  static Future<Map<String, dynamic>> sendMessage(String message) async {
    try {
      final response = await http.post(
        Uri.parse(apiUrl),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'message': message,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('Failed to get response: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error sending message: $e');
    }
  }
}
