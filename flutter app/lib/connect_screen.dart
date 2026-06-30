import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'game_service.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();}
class _ConnectScreenState extends State<ConnectScreen> {
  final _ipController = TextEditingController(text: '192.168.');
  final _portController = TextEditingController(text: '8080');
  final _tokenController = TextEditingController();
  bool _connecting = false;
  Future<void> _connect() async {
    final address = _ipController.text.trim();
    final port = _portController.text.trim();
    final token = _tokenController.text.trim();
    if (address.isEmpty || port.isEmpty || token.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter IP, port, and a 6 digit session token')),);
      return;}

    setState(() => _connecting = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Connecting')),);
    final service = context.read<GameService>();
    final ok = await service.connect(address, port);
    if (!mounted) return;
    setState(() => _connecting = false);
    if (ok) {
      const storage = FlutterSecureStorage();
      await storage.write(key: 'last_server_address', value: address);
      await storage.write(key: 'last_server_port', value: port);
      await storage.write(key: 'last_session_token', value: token);
      service.joinGame(token);
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/controller');}
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection failed check IP and port')),
      );}}

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF02090C),
      body: Stack(
        children: [
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.teal.withOpacity(0.1),
                boxShadow: [
                  BoxShadow(
                      color: Colors.teal.withOpacity(0.1), blurRadius: 100),],),),),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'UPLINK',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w300,
                      letterSpacing: 8,
                      color: Colors.white,
                    ),),
                  const SizedBox(height: 48),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                              color: Colors.white.withOpacity(0.1)),),
                        child: Column(
                          children: [
                            _buildInputField(
                              controller: _ipController,
                              label: 'Master Node IP',
                              icon: Icons.dns_outlined,
                            ),
                            const SizedBox(height: 16),
                            _buildInputField(
                              controller: _portController,
                              label: 'Port',
                              icon: Icons.settings_ethernet,
                            ),
                            const SizedBox(height: 16),
                            _buildInputField(
                              controller: _tokenController,
                              label: 'Session Token',
                              icon: Icons.key_outlined,
                              maxLength: 6,
                            ),],),),),),
                  const SizedBox(height: 32),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    height: 56,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(28),
                      gradient: LinearGradient(
                        colors: _connecting
                            ? [Colors.teal.shade800, Colors.teal.shade900]
                            : [Colors.teal.shade400, Colors.teal.shade600],
                      ),
                      boxShadow: _connecting
                          ? []
                          : [
                              BoxShadow(
                                color: Colors.teal.withOpacity(0.3),
                                blurRadius: 12,
                                offset: const Offset(0, 4),)],),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(28),
                        onTap: _connecting ? null : _connect,
                        child: Center(
                          child: _connecting
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor:
                                        AlwaysStoppedAnimation<Color>(
                                            Colors.white),
                                  ),
                                )
                              : const Text(
                                  'INITIALIZE LINK',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 2,
                                    color: Colors.white,),),),),),),
                  const SizedBox(height: 24),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/status'),
                    style:
                        TextButton.styleFrom(foregroundColor: Colors.white54),
                    child: const Text('Open Status View',
                        style: TextStyle(letterSpacing: 1)),),],),),),],),);}

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int? maxLength,
  }) {
    return TextField(
      controller: controller,
      maxLength: maxLength,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
        prefixIcon: Icon(icon, color: Colors.white.withOpacity(0.5)),
        counterText: '',
        filled: true,
        fillColor: Colors.black.withOpacity(0.2),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.teal.withOpacity(0.5)),
        ),
      ),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
    );}}
