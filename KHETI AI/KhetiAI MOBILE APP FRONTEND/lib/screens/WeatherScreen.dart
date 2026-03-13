// lib/screens/WeatherScreen.dart

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class WeatherScreen extends StatefulWidget {
  const WeatherScreen({super.key});

  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen> {
  bool _isLoading = false;
  bool _isLocationLoading = false;

  String _city = 'Loading...';
  String _country = '';
  double _latitude = 21.1702; // Default Surat
  double _longitude = 72.8311;

  double _temperature = 0;
  double _feelsLike = 0;
  double _humidity = 0;
  double _windSpeed = 0;
  String _condition = 'Loading...';
  int _weatherCode = 0;

  List<Map<String, dynamic>> _forecast = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSavedLocation();
    });
  }

  @override
  void dispose() {
    super.dispose();
  }

  /// Load saved location from SharedPreferences
  Future<void> _loadSavedLocation() async {
    if (!mounted) return;

    setState(() => _isLocationLoading = true);

    try {
      final prefs = await SharedPreferences.getInstance();

      // Check if location is saved
      if (prefs.containsKey('latitude') && prefs.containsKey('longitude')) {
        // Load saved location
        _latitude = prefs.getDouble('latitude') ?? 21.1702;
        _longitude = prefs.getDouble('longitude') ?? 72.8311;
        _city = prefs.getString('city') ?? 'Surat';
        _country = prefs.getString('country') ?? 'India';

        if (mounted) {
          setState(() {});
        }

        // Fetch weather for saved location
        await _fetchWeather();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Loaded saved location: $_city'),
              duration: const Duration(seconds: 2),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        // No saved location, get current location
        await _getCurrentLocation();
      }
    } catch (e) {
      debugPrint('Error loading saved location: $e');
      await _getCurrentLocation();
    } finally {
      if (mounted) {
        setState(() => _isLocationLoading = false);
      }
    }
  }

  /// Save location to SharedPreferences
  Future<void> _saveLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble('latitude', _latitude);
      await prefs.setDouble('longitude', _longitude);
      await prefs.setString('city', _city);
      await prefs.setString('country', _country);
      debugPrint('Location saved: $_city ($_latitude, $_longitude)');
    } catch (e) {
      debugPrint('Error saving location: $e');
    }
  }

  /// Get current location with proper permission handling
  Future<void> _getCurrentLocation() async {
    if (!mounted) return;

    setState(() {
      _isLocationLoading = true;
    });

    try {
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showLocationDialog(
          'Location Services Disabled',
          'Please enable location services to get weather for your current location.',
          onConfirm: () async {
            await Geolocator.openLocationSettings();
          },
        );
        await _useFallbackLocation();
        return;
      }

      // Check location permission status
      LocationPermission permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        // Request permission
        permission = await Geolocator.requestPermission();

        if (permission == LocationPermission.denied) {
          _showLocationDialog(
            'Location Permission Denied',
            'Location permission is required to show weather for your current location. Using default location (Surat).',
          );
          await _useFallbackLocation();
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _showLocationDialog(
          'Location Permission Permanently Denied',
          'Please enable location permission from app settings to use your current location.',
          onConfirm: () async {
            await openAppSettings();
          },
        );
        await _useFallbackLocation();
        return;
      }

      // Permission granted, get position
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      ).timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw Exception('Location request timeout');
        },
      );

      if (!mounted) return;

      _latitude = position.latitude;
      _longitude = position.longitude;

      // Get city name from coordinates
      try {
        List<Placemark> placemarks = await placemarkFromCoordinates(
          position.latitude,
          position.longitude,
        ).timeout(const Duration(seconds: 5));

        if (placemarks.isNotEmpty && mounted) {
          Placemark place = placemarks[0];
          setState(() {
            _city = place.locality ??
                place.subAdministrativeArea ??
                place.administrativeArea ??
                'Unknown';
            _country = place.country ?? '';
          });
        }
      } catch (e) {
        debugPrint('Geocoding error: $e');
        if (mounted) {
          setState(() {
            _city = 'Location Found';
            _country = '';
          });
        }
      }

      // Save location to preferences
      await _saveLocation();

      // Fetch weather data
      await _fetchWeather();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location updated: $_city'),
            duration: const Duration(seconds: 2),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint('Location error: $e');

      if (mounted) {
        String errorMessage = 'Could not get location. Using default location (Surat).';

        if (e.toString().contains('timeout')) {
          errorMessage = 'Location request timeout. Using default location (Surat).';
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            duration: const Duration(seconds: 3),
            action: SnackBarAction(
              label: 'Retry',
              onPressed: _getCurrentLocation,
            ),
          ),
        );
      }

      await _useFallbackLocation();
    } finally {
      if (mounted) {
        setState(() {
          _isLocationLoading = false;
        });
      }
    }
  }

  /// Use fallback location (Surat)
  Future<void> _useFallbackLocation() async {
    if (!mounted) return;

    setState(() {
      _city = 'Surat';
      _country = 'India';
      _latitude = 21.1702;
      _longitude = 72.8311;
    });

    // Save fallback location
    await _saveLocation();

    await _fetchWeather();
  }

  /// Show location permission dialog
  void _showLocationDialog(String title, String message, {VoidCallback? onConfirm}) {
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          if (onConfirm != null)
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                onConfirm();
              },
              child: const Text('Open Settings'),
            ),
        ],
      ),
    );
  }

  /// Fetch weather data from Open-Meteo
  Future<void> _fetchWeather() async {
    if (!mounted) return;

    setState(() {
      _isLoading = true;
      
    });

    try {
      final url = Uri.parse(
        "https://api.open-meteo.com/v1/forecast?"
            "latitude=$_latitude&longitude=$_longitude"
            "&current_weather=true"
            "&hourly=relative_humidity_2m,apparent_temperature"
            "&daily=temperature_2m_max,temperature_2m_min,weathercode"
            "&timezone=auto",
      );

      final response = await http.get(url).timeout(
        const Duration(seconds: 10),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        // Current weather
        final current = data['current_weather'];
        final hourly = data['hourly'];

        if (!mounted) return;

        setState(() {
          _temperature = current['temperature'].toDouble();
          _windSpeed = current['windspeed'].toDouble();
          _weatherCode = current['weathercode'];
          _feelsLike = hourly['apparent_temperature'][0].toDouble();
          _humidity = hourly['relative_humidity_2m'][0].toDouble();
          _condition = _mapWeatherCode(_weatherCode);
        });

        // Daily Forecast (7 days)
        final daily = data['daily'];
        final List<String> days = List<String>.from(daily['time']);
        final List tempsMax = daily['temperature_2m_max'];
        final List tempsMin = daily['temperature_2m_min'];
        final List weatherCodes = daily['weathercode'];

        _forecast = [];
        for (int i = 0; i < days.length && i < 7; i++) {
          double tempMax = tempsMax[i] is int
              ? (tempsMax[i] as int).toDouble()
              : tempsMax[i];
          double tempMin = tempsMin[i] is int
              ? (tempsMin[i] as int).toDouble()
              : tempsMin[i];

          _forecast.add({
            'day': _formatDate(days[i]),
            'tempMax': tempMax,
            'tempMin': tempMin,
            'condition': _mapWeatherCode(weatherCodes[i]),
            'weatherCode': weatherCodes[i],
          });
        }
      } else {
        throw Exception("Failed to load weather: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint('Weather fetch error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Error loading weather: $e"),
            action: SnackBarAction(
              label: 'Retry',
              onPressed: _fetchWeather,
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final tomorrow = today.add(const Duration(days: 1));
      final dateToCheck = DateTime(date.year, date.month, date.day);

      if (dateToCheck == today) return 'Today';
      if (dateToCheck == tomorrow) return 'Tomorrow';

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return days[date.weekday - 1];
    } catch (e) {
      return dateStr;
    }
  }

  String _mapWeatherCode(int code) {
    switch (code) {
      case 0:
        return "Clear Sky";
      case 1:
      case 2:
      case 3:
        return "Partly Cloudy";
      case 45:
      case 48:
        return "Foggy";
      case 51:
      case 53:
      case 55:
        return "Drizzle";
      case 61:
      case 63:
      case 65:
        return "Rainy";
      case 71:
      case 73:
      case 75:
        return "Snowy";
      case 95:
        return "Thunderstorm";
      default:
        return "Cloudy";
    }
  }

  IconData _getWeatherIcon(int code) {
    switch (code) {
      case 0:
        return Icons.wb_sunny;
      case 1:
      case 2:
      case 3:
        return Icons.wb_cloudy;
      case 45:
      case 48:
        return Icons.foggy;
      case 51:
      case 53:
      case 55:
        return Icons.grain;
      case 61:
      case 63:
      case 65:
        return Icons.water_drop;
      case 71:
      case 73:
      case 75:
        return Icons.ac_unit;
      case 95:
        return Icons.thunderstorm;
      default:
        return Icons.cloud;
    }
  }

  Color _getWeatherColor(int code) {
    switch (code) {
      case 0:
        return Colors.orange;
      case 1:
      case 2:
      case 3:
        return Colors.blue;
      case 45:
      case 48:
        return Colors.grey;
      case 51:
      case 53:
      case 55:
      case 61:
      case 63:
      case 65:
        return Colors.blueAccent;
      case 71:
      case 73:
      case 75:
        return Colors.lightBlue;
      case 95:
        return Colors.deepPurple;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              _getWeatherColor(_weatherCode).withOpacity(0.3),
              colorScheme.surface,
            ],
          ),
        ),
        child: RefreshIndicator(
          onRefresh: _fetchWeather, // Only refresh weather, not location
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // App Bar
              SliverAppBar(
                expandedHeight: 80,
                floating: true,
                pinned: false,
                backgroundColor: Colors.transparent,
                elevation: 0,
                flexibleSpace: FlexibleSpaceBar(
                  title: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.location_on,
                        color: colorScheme.primary,
                        size: 20,
                      ),
                      const SizedBox(width: 6),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _city,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: colorScheme.onSurface,
                              fontSize: 16,
                            ),
                          ),
                          if (_country.isNotEmpty)
                            Text(
                              _country,
                              style: TextStyle(
                                fontSize: 11,
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                  centerTitle: false,
                ),
                actions: [
                  IconButton(
                    icon: _isLocationLoading
                        ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                        : const Icon(Icons.my_location),
                    onPressed: _isLocationLoading ? null : _getCurrentLocation,
                    tooltip: 'Update Location',
                  ),
                  IconButton(
                    icon: _isLoading
                        ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                        : const Icon(Icons.refresh),
                    onPressed: _isLoading ? null : _fetchWeather,
                    tooltip: 'Refresh Weather',
                  ),
                ],
              ),

              // Content
              SliverPadding(
                padding: const EdgeInsets.all(20.0),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    // Main Weather Card
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            _getWeatherColor(_weatherCode).withOpacity(0.2),
                            _getWeatherColor(_weatherCode).withOpacity(0.1),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(40),
                        border: Border.all(
                          color: _getWeatherColor(_weatherCode).withOpacity(0.3),
                          width: 1,
                        ),
                      ),
                      padding: const EdgeInsets.all(32.0),
                      child: Column(
                        children: [
                          Icon(
                            _getWeatherIcon(_weatherCode),
                            size: 100,
                            color: _getWeatherColor(_weatherCode),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '${_temperature.toStringAsFixed(1)}°',
                            style: TextStyle(
                              fontSize: 72,
                              fontWeight: FontWeight.bold,
                              color: colorScheme.onSurface,
                              height: 1,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _condition,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: colorScheme.onSurface,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Feels like ${_feelsLike.toStringAsFixed(1)}°',
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Weather Details Grid
                    Row(
                      children: [
                        Expanded(
                          child: _buildDetailCard(
                            context,
                            icon: Icons.water_drop,
                            label: 'Humidity',
                            value: '${_humidity.toStringAsFixed(0)}%',
                            color: Colors.blue,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildDetailCard(
                            context,
                            icon: Icons.air,
                            label: 'Wind Speed',
                            value: '${_windSpeed.toStringAsFixed(1)}',
                            unit: 'km/h',
                            color: Colors.teal,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 36),

                    // Forecast Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '7-Day Forecast',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Icon(
                          Icons.calendar_month,
                          color: colorScheme.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Forecast List
                    ..._forecast.map((day) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: colorScheme.outlineVariant.withOpacity(0.5),
                            ),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 12,
                            ),
                            leading: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _getWeatherColor(day['weatherCode'])
                                    .withOpacity(0.15),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(
                                _getWeatherIcon(day['weatherCode']),
                                color: _getWeatherColor(day['weatherCode']),
                                size: 28,
                              ),
                            ),
                            title: Text(
                              day['day'],
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            subtitle: Text(
                              day['condition'],
                              style: TextStyle(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${day['tempMax'].toStringAsFixed(1)}°',
                                  style: theme.textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: colorScheme.onSurface,
                                  ),
                                ),
                                Text(
                                  ' / ',
                                  style: TextStyle(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                                ),
                                Text(
                                  '${day['tempMin'].toStringAsFixed(1)}°',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),

                    const SizedBox(height: 20),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailCard(
      BuildContext context, {
        required IconData icon,
        required String label,
        required String value,
        String unit = '',
        required Color color,
      }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: colorScheme.outlineVariant.withOpacity(0.5),
        ),
      ),
      padding: const EdgeInsets.all(20.0),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              icon,
              size: 32,
              color: color,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          if (unit.isNotEmpty)
            Text(
              unit,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}